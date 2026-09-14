import { mkdirSync, readFileSync } from "fs";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

import {
  sessions,
  createSession,
  closeSession,
  renameSession,
  restartSessionProc,
  type Client,
} from "./session.ts";

import { handleUpload, DEFAULT_UPLOAD_BASE } from "./upload.ts";
import { serveAsset } from "./assets.ts";

// --- Startup ---

mkdirSync(DEFAULT_UPLOAD_BASE, { recursive: true });

const APP_DIR = path.dirname(new URL(import.meta.url).pathname);
const htmlTemplate = readFileSync(path.join(APP_DIR, "index.html"), "utf8");

const FONT_SIZE = process.env.TERMINAL_FONT_SIZE || "14";
const THEME = process.env.TERMINAL_THEME || "dark";
const PORT = 7681;

// --- Types ---

type ClientMessage =
  | { type: "join"; session: string }
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "new_session"; session: string }
  | { type: "close_session"; session: string }
  | { type: "rename_session"; from: string; to: string };

type NodeClient = WebSocket &
  Client & {
    data: {
      session: string | null;
    };
  };

// --- WebSocket message handler ---

function handleMessage(ws: NodeClient, raw: string): void {
  let msg: ClientMessage;

  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.type === "join" || msg.type === "new_session") {
    const previousName = ws.data.session;

    if (previousName) {
      const previous = sessions.get(previousName);
      if (previous) {
        previous.clients.delete(ws);
      }
    }

    const session =
      sessions.get(msg.session) ?? createSession(msg.session);

    session.clients.add(ws);
    ws.data.session = msg.session;

    if (session.scrollback) {
      ws.send(
        JSON.stringify({
          type: "output",
          data: session.scrollback,
        })
      );
    }

    ws.send(
      JSON.stringify({
        type: "session_list",
        sessions: [...sessions.keys()],
      })
    );

    return;
  }

  if (msg.type === "rename_session") {
    if (!renameSession(msg.from, msg.to)) {
      ws.send(
        JSON.stringify({
          type: "session_list",
          sessions: [...sessions.keys()],
        })
      );
    }

    return;
  }

  if (msg.type === "close_session") {
    const closing = sessions.get(msg.session);

    if (closing) {
      closing.clients.delete(ws);
    }

    closeSession(msg.session);

    if (ws.data.session === msg.session) {
      ws.data.session = null;
    }

    return;
  }

  const sessionName = ws.data.session;

  if (!sessionName) {
    return;
  }

  const session = sessions.get(sessionName);

  if (!session) {
    return;
  }

  if (msg.type === "input") {
    // node-pty uses a null proc in our session wrapper after the shell exits.
    // Restart it on the first input, preserving the old "press Enter to restart" UX.
    if (!session.proc) {
      restartSessionProc(session);
    }

    try {
      session.proc?.write(msg.data);
    } catch {
      // Ignore writes to a process that exited between checks.
    }

    return;
  }

  if (msg.type === "resize") {
    try {
      session.proc?.resize(msg.cols, msg.rows);
    } catch {
      // Ignore resize failures during process shutdown/restart.
    }
  }
}

// --- Helpers ---

async function sendWebResponse(
  response: Response,
  res: http.ServerResponse
): Promise<void> {
  res.statusCode = response.status;

  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

function buildWebRequest(
  req: http.IncomingMessage,
  body?: Buffer
): Request {
  const host = req.headers.host || `localhost:${PORT}`;
  const url = `http://${host}${req.url || "/"}`;

  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const method = req.method || "GET";

  if (
    body &&
    body.length > 0 &&
    method !== "GET" &&
    method !== "HEAD"
  ) {
    return new Request(url, {
      method,
      headers,
      body,
    });
  }

  return new Request(url, {
    method,
    headers,
  });
}

async function collectRequestBody(
  req: http.IncomingMessage
): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }

  return Buffer.concat(chunks);
}

// --- HTTP server ---

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const url = new URL(req.url || "/", `http://${host}`);
    const pathname = url.pathname;

    // Image upload
    if (pathname === "/upload" && req.method === "POST") {
      const body = await collectRequestBody(req);
      const webRequest = buildWebRequest(req, body);
      const response = await handleUpload(webRequest);

      await sendWebResponse(response, res);
      return;
    }

    // Static assets
    if (pathname.startsWith("/assets/")) {
      const response = await serveAsset(
        pathname,
        path.join(APP_DIR, "assets")
      );

      await sendWebResponse(response, res);
      return;
    }

    // Serve index.html
    const ingressHeader = req.headers["x-ingress-path"];
    const ingressPath = Array.isArray(ingressHeader)
      ? ingressHeader[0] || ""
      : ingressHeader || "";

    const html = htmlTemplate
      .replaceAll("{{INGRESS_PATH}}", ingressPath)
      .replaceAll("{{THEME}}", THEME)
      .replaceAll("{{FONT_SIZE}}", FONT_SIZE);

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  } catch (error) {
    console.error("HTTP request failed:", error);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }

    res.end("Internal server error");
  }
});

// --- WebSocket server ---

const wss = new WebSocketServer({
  noServer: true,
});

server.on("upgrade", (req, socket, head) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const url = new URL(req.url || "/", `http://${host}`);

  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (socketConnection) => {
    const ws = socketConnection as NodeClient;

    ws.data = {
      session: null,
    };

    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (socket) => {
  const ws = socket as NodeClient;

  ws.send(
    JSON.stringify({
      type: "session_list",
      sessions: [...sessions.keys()],
    })
  );

  ws.on("message", (message) => {
    handleMessage(
      ws,
      typeof message === "string"
        ? message
        : message.toString()
    );
  });

  ws.on("close", () => {
    const name = ws.data?.session;

    if (!name) {
      return;
    }

    const session = sessions.get(name);

    if (session) {
      session.clients.delete(ws);
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

// WebSocket-level pings every 30 seconds.
// This helps keep Home Assistant Ingress from dropping idle connections.
setInterval(() => {
  for (const session of sessions.values()) {
    for (const client of session.clients) {
      const ws = client as NodeClient;

      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      } catch {
        // Ignore stale sockets.
      }
    }
  }
}, 30_000);

// --- Start server ---

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Claude Code terminal running on :${PORT}`);
});
