import path from "path";

export async function serveAsset(pathname: string, assetsDir: string): Promise<Response> {
  const resolved = path.resolve(assetsDir, pathname.slice("/assets/".length));
  // resolve() follows absolute/dot segments wherever they lead — only serve inside assetsDir
  if (!resolved.startsWith(assetsDir + path.sep)) {
    return new Response("Not found", { status: 404 });
  }
  const file = Bun.file(resolved);
  if (!(await file.exists())) {
    return new Response("Not found", { status: 404 });
  }
  // no-cache = revalidate every load; keeps browsers from serving a stale
  // xterm.js against newer addons after an add-on upgrade
  return new Response(file, { headers: { "Cache-Control": "no-cache" } });
}
