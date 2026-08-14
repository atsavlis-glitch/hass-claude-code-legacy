import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { rmSync, mkdirSync, existsSync } from "fs";
import { handleUpload } from "./upload.ts";

const TEST_DIR = "/tmp/test-claude-paste-" + Date.now();

describe("handleUpload", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("saves image file and returns its path", async () => {
    const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([pngMagic], "screenshot.png", { type: "image/png" });
    const form = new FormData();
    form.append("image", file);

    const req = new Request("http://localhost/upload", { method: "POST", body: form });
    const res = await handleUpload(req, TEST_DIR);

    expect(res.status).toBe(200);
    const body = await res.json() as { path: string };
    expect(body.path).toMatch(/^\/tmp\/test-claude-paste-\d+\/default\/image_\d+\.png$/);
    expect(existsSync(body.path)).toBe(true);
  });

  test("returns 400 when form contains no file", async () => {
    const form = new FormData();
    form.append("text", "not a file");

    const req = new Request("http://localhost/upload", { method: "POST", body: form });
    const res = await handleUpload(req, TEST_DIR);

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
  });

  test("returns 400 for non-multipart content-type", async () => {
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "nope" }),
    });
    const res = await handleUpload(req, TEST_DIR);

    expect(res.status).toBe(400);
  });

  test("sanitizes file extension to alphanumeric", async () => {
    const file = new File([new Uint8Array([0])], "evil../../../etc.jpg", { type: "image/jpeg" });
    const form = new FormData();
    form.append("f", file);

    const req = new Request("http://localhost/upload", { method: "POST", body: form });
    const res = await handleUpload(req, TEST_DIR);

    expect(res.status).toBe(200);
    const body = await res.json() as { path: string };
    expect(body.path).toMatch(/\.[a-z0-9]+$/);
    expect(body.path).not.toContain("..");
  });
});
