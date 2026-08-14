import { describe, test, expect, afterEach } from "bun:test";
import { appendScrollback, renameSession, sessions, SCROLLBACK_LIMIT } from "./session.ts";

describe("appendScrollback", () => {
  test("appends data to empty scrollback", () => {
    const session = { scrollback: "" } as any;
    appendScrollback(session, "hello\r\n");
    expect(session.scrollback).toBe("hello\r\n");
  });

  test("appends data to existing scrollback", () => {
    const session = { scrollback: "existing" } as any;
    appendScrollback(session, "more");
    expect(session.scrollback).toBe("existingmore");
  });

  test("caps scrollback at SCROLLBACK_LIMIT bytes by dropping oldest bytes", () => {
    const session = { scrollback: "x".repeat(SCROLLBACK_LIMIT) } as any;
    appendScrollback(session, "NEW");
    expect(session.scrollback.length).toBe(SCROLLBACK_LIMIT);
    expect(session.scrollback.endsWith("NEW")).toBe(true);
    expect(session.scrollback.startsWith("x")).toBe(true);
  });

  test("does not truncate scrollback that is exactly at limit after append", () => {
    const data = "y".repeat(10);
    const existing = "x".repeat(SCROLLBACK_LIMIT - 10);
    const session = { scrollback: existing } as any;
    appendScrollback(session, data);
    expect(session.scrollback.length).toBe(SCROLLBACK_LIMIT);
  });

  test("does not truncate scrollback below limit", () => {
    const session = { scrollback: "short" } as any;
    appendScrollback(session, "data");
    expect(session.scrollback).toBe("shortdata");
    expect(session.scrollback.length).toBeLessThanOrEqual(SCROLLBACK_LIMIT);
  });
});

describe("renameSession", () => {
  afterEach(() => {
    sessions.clear();
  });

  function makeClient(name: string) {
    const sent: string[] = [];
    return { data: { session: name }, send: (m: string) => sent.push(m), sent } as any;
  }

  function makeSession(name: string) {
    const session = { proc: { pid: 42 }, clients: new Set(), name, scrollback: "history" } as any;
    sessions.set(name, session);
    return session;
  }

  test("re-keys the session under the new name, preserving proc and scrollback", () => {
    const session = makeSession("main");
    const ok = renameSession("main", "kitchen");
    expect(ok).toBe(true);
    expect(sessions.has("main")).toBe(false);
    expect(sessions.get("kitchen")).toBe(session);
    expect(session.proc.pid).toBe(42);
    expect(session.scrollback).toBe("history");
    expect(session.name).toBe("kitchen");
  });

  test("updates ws.data.session for attached clients and notifies them", () => {
    const session = makeSession("main");
    const client = makeClient("main");
    session.clients.add(client);

    renameSession("main", "kitchen");

    expect(client.data.session).toBe("kitchen");
    const renamed = client.sent
      .map((m: string) => JSON.parse(m))
      .find((m: any) => m.type === "session_renamed");
    expect(renamed).toEqual({ type: "session_renamed", from: "main", to: "kitchen" });
  });

  test("refuses to rename onto an existing session name", () => {
    makeSession("main");
    const other = makeSession("other");
    const ok = renameSession("main", "other");
    expect(ok).toBe(false);
    expect(sessions.get("main")?.name).toBe("main");
    expect(sessions.get("other")).toBe(other);
  });

  test("returns false when the old name does not exist", () => {
    expect(renameSession("ghost", "new")).toBe(false);
    expect(sessions.size).toBe(0);
  });

  test("returns false for an empty new name", () => {
    makeSession("main");
    expect(renameSession("main", "")).toBe(false);
    expect(sessions.has("main")).toBe(true);
  });

  test("sends session_renamed before session_list to attached clients", () => {
    // The client auto-switches away from unknown sessions on session_list,
    // so it must learn the new name first
    const session = makeSession("main");
    const client = makeClient("main");
    session.clients.add(client);

    renameSession("main", "kitchen");

    const types = client.sent.map((m: string) => JSON.parse(m).type);
    expect(types.indexOf("session_renamed")).toBeLessThan(types.indexOf("session_list"));
  });

  test("does not send session_renamed to clients attached to other sessions", () => {
    const renamed = makeSession("main");
    renamed.clients.add(makeClient("main"));
    const other = makeSession("other");
    const bystander = makeClient("other");
    other.clients.add(bystander);

    renameSession("main", "kitchen");

    const types = bystander.sent.map((m: string) => JSON.parse(m).type);
    expect(types).not.toContain("session_renamed");
    expect(types).toContain("session_list");
    expect(bystander.data.session).toBe("other");
  });
});
