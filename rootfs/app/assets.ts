import path from "path";
import { readFile } from "fs/promises";

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

export async function serveAsset(
  pathname: string,
  assetsDir: string
): Promise<Response> {
  const resolved = path.resolve(
    assetsDir,
    pathname.slice("/assets/".length)
  );

  // Only allow files located inside the assets directory.
  const relative = path.relative(assetsDir, resolved);

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    return new Response("Not found", {
      status: 404,
    });
  }

  try {
    const file = await readFile(resolved);

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": getContentType(resolved),
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response("Not found", {
      status: 404,
    });
  }
}
