import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { serveAsset } from "./assets.ts";

const TEST_DIR = "/tmp/test-claude-assets-" + Date.now();

describe("serveAsset", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_DIR + "/xterm.js", "console.log('xterm')");
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("serves an existing asset", async () => {
    const res = await serveAsset("/assets/xterm.js", TEST_DIR);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("console.log('xterm')");
  });

  test("returns 404 for a missing asset", async () => {
    const res = await serveAsset("/assets/nope.js", TEST_DIR);
    expect(res.status).toBe(404);
  });

  test("strips path traversal segments", async () => {
    const res = await serveAsset("/assets/../assets.ts", TEST_DIR);
    expect(res.status).toBe(404);
  });

  test("refuses absolute paths that escape the assets dir", async () => {
    // /etc/hosts exists on the host — must never be served
    const res = await serveAsset("/assets//etc/hosts", TEST_DIR);
    expect(res.status).toBe(404);
  });

  test("serves assets with a no-cache header so upgrades are not served stale", async () => {
    const res = await serveAsset("/assets/xterm.js", TEST_DIR);
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });
});
