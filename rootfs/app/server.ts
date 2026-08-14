import { mkdirSync, readFileSync } from "fs";
import path from "path";
import {
  sessions,
  createSession,
  closeSession,
  renameSession,
  restartSessionProc,
} from "./session.ts";
import { handleUpload, DEFAULT_UPLOAD_BASE } from "./upload.ts";
import { serveAsset } from "./assets.ts";

// --- Startup ---
mkdirSync(DEFAULT_UPLOAD_BASE, { recursive: true });

const htmlTemplate = readFileSync(path.join(import.meta.dir, "index.html"), "utf8");
const FONT_SIZE = process.env.TERMINAL_FONT_SIZE || "14";
const THEME = process.env.TERMINAL_THEME || "dark";

// --- Types ---
type ClientMessage =
  | { type: "join"; session: string }
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "new_session"; session: string }
  | { type: "close_session"; session: string }
  | { type: "rename_session"; from: string; to: string };

type WsData = { session: string | null };

// --- WebSocket message handler ---
function handleMessage(ws: any, raw: string): void {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.type === "join" || msg.type === "new_session") {
    const prev = sessions.get(ws.data.session);
    if (prev) prev.clients.delete(ws);
    const session = sessions.get(msg.session) ?? createSession(msg.session);
    session.clients.add(ws);
    ws.data.session = msg.session;
    if (session.scrollback) {
      ws.send(JSON.stringify({ type: "output", data: session.scrollback }));
    }
    ws.send(JSON.stringify({ type: "session_list", sessions: [...sessions.keys()] }));
    return;
  }

  if (msg.type === "rename_session") {
    if (!renameSession(msg.from, msg.to)) {
      // Rename refused (stale name, duplicate target) — resync the requester's tabs
      ws.send(JSON.stringify({ type: "session_list", sessions: [...sessions.keys()] }));
    }
    return;
  }

  if (msg.type === "close_session") {
    const closing = sessions.get(msg.session);
    if (closing) closing.clients.delete(ws);
    closeSession(msg.session);
    return;
  }

  const sessionName: string | null = ws.data.session;
  if (!sessionName) return;
  const session = sessions.get(sessionName);
  if (!session) return;

  if (msg.type === "input") {
    // If PTY process has exited, restart it on first input ("press Enter to restart" UX)
    if (session.proc?.exitCode !== null && session.proc?.exitCode !== undefined) {
      restartSessionProc(session);
    }
    try {
      session.proc?.terminal?.write(msg.data);
    } catch {}
  } else if (msg.type === "resize") {
    try {
      session.proc?.terminal?.resize(msg.cols, msg.rows);
    } catch {}
  }
}

// --- HTTP + WebSocket server ---
const server = Bun.serve<WsData>({
  port: 7681,

  fetch(req, server) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // WebSocket upgrade
    if (pathname === "/ws") {
      const ok = server.upgrade(req, { data: { session: null } });
      if (ok) return undefined;
      return new Response("WebSocket upgrade failed", { status: 426 });
    }

    // Image upload
    if (pathname === "/upload" && req.method === "POST") {
      return handleUpload(req);
    }

    // Static assets — sanitized and 404 on miss
    if (pathname.startsWith("/assets/")) {
      return serveAsset(pathname, path.join(import.meta.dir, "assets"));
    }

    // Serve index.html — inject ingress path, theme, font size per request
    const ingressPath = req.headers.get("X-Ingress-Path") || "";
    const html = htmlTemplate
      .replaceAll("{{INGRESS_PATH}}", ingressPath)
      .replaceAll("{{THEME}}", THEME)
      .replaceAll("{{FONT_SIZE}}", FONT_SIZE);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },

  websocket: {
    open(ws) {
      ws.send(JSON.stringify({ type: "session_list", sessions: [...sessions.keys()] }));
    },
    message(ws, msg) {
      handleMessage(ws, typeof msg === "string" ? msg : msg.toString());
    },
    close(ws) {
      const name = ws.data?.session;
      if (name) {
        const session = sessions.get(name);
        if (session) session.clients.delete(ws);
      }
    },
  },
});

// WebSocket-level pings every 30s — keeps HA Ingress proxy from dropping idle connections.
// Bun ServerWebSocket.ping() sends RFC 6455 §5.5.2 ping frames; frontend ignores them.
setInterval(() => {
  for (const session of sessions.values()) {
    for (const ws of session.clients) {
      try { ws.ping(); } catch {}
    }
  }
}, 30_000);

console.log(`Claude Code terminal running on :${server.port}`);
