import { existsSync } from "fs";
import * as pty from "node-pty";

export const SCROLLBACK_LIMIT = 500 * 1024; // 500 KB

// /homeassistant is the add-on's mapped HA config dir; fall back so sessions
// still spawn if the mapping is unavailable (e.g. local development)
const SESSION_CWD = existsSync("/homeassistant")
  ? "/homeassistant"
  : process.env.HOME || "/";

// Structural socket contract used by session management.
// server.ts sockets and test fakes can both satisfy this shape.
export type Client = {
  data: { session: string | null };
  send: (msg: string) => unknown;
};

export type Session = {
  proc: pty.IPty | null;
  clients: Set<Client>;
  name: string;
  scrollback: string;
};

export const sessions = new Map<string, Session>();

export function appendScrollback(
  session: Pick<Session, "scrollback">,
  data: string
): void {
  session.scrollback += data;

  if (session.scrollback.length > SCROLLBACK_LIMIT) {
    session.scrollback = session.scrollback.slice(
      session.scrollback.length - SCROLLBACK_LIMIT
    );
  }
}

function broadcastSessionList(): void {
  const msg = JSON.stringify({
    type: "session_list",
    sessions: [...sessions.keys()],
  });

  for (const session of sessions.values()) {
    for (const ws of session.clients) {
      ws.send(msg);
    }
  }
}

function spawnPty(session: Session): void {
  const proc = pty.spawn("bash", ["--login"], {
    name: "xterm-256color",
    cols: 220,
    rows: 50,
    cwd: SESSION_CWD,
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: "/data/.claudecode",
      TERM: "xterm-256color",
      CLAUDE_SESSION_NAME: session.name,
    } as Record<string, string>,
  });

  session.proc = proc;

  proc.onData((data: string) => {
    appendScrollback(session, data);

    const msg = JSON.stringify({
      type: "output",
      data,
    });

    for (const ws of session.clients) {
      ws.send(msg);
    }
  });

  proc.onExit(() => {
    // Ignore exit if the session was deliberately removed.
    if (!sessions.has(session.name)) {
      return;
    }

    const deadMsg = JSON.stringify({
      type: "output",
      data:
        "\r\n\x1b[33mSession ended — press Enter to restart\x1b[0m\r\n",
    });

    for (const ws of session.clients) {
      ws.send(deadMsg);
    }

    session.proc = null;
    broadcastSessionList();
  });
}

export function createSession(name: string): Session {
  const session: Session = {
    proc: null,
    clients: new Set(),
    name,
    scrollback: "",
  };

  sessions.set(name, session);
  spawnPty(session);
  broadcastSessionList();

  return session;
}

export function restartSessionProc(session: Session): void {
  if (session.proc) {
    try {
      session.proc.kill();
    } catch {
      // Process may already have exited.
    }
  }

  spawnPty(session);
}

export function renameSession(
  oldName: string,
  newName: string
): boolean {
  const session = sessions.get(oldName);

  if (!session || !newName || sessions.has(newName)) {
    return false;
  }

  sessions.delete(oldName);
  session.name = newName;
  sessions.set(newName, session);

  const msg = JSON.stringify({
    type: "session_renamed",
    from: oldName,
    to: newName,
  });

  for (const ws of session.clients) {
    ws.data.session = newName;
    ws.send(msg);
  }

  broadcastSessionList();

  return true;
}

export function closeSession(name: string): void {
  const session = sessions.get(name);

  if (!session) {
    return;
  }

  if (session.proc) {
    try {
      session.proc.kill();
    } catch {
      // Process may already have exited.
    }
  }

  sessions.delete(name);
  broadcastSessionList();
}
