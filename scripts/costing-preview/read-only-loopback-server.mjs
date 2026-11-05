// Test-only loopback static preview, with no Supabase or outbound proxy.
// Do not bind to non-loopback interfaces or use this as an authenticated deployment.
// Usage: node scripts/costing-preview/read-only-loopback-server.mjs
import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(here, "../../public");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".ico": "image/x-icon", ".webp": "image/webp", ".woff": "font/woff",
  ".woff2": "font/woff2",
};
const BLOCKED_PREFIXES = ["/rest/", "/rest/v1", "/auth/", "/auth/v1", "/rpc/", "/functions/", "/storage/", "/realtime/", "/pg/", "/api/"];
const HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

function reply(res, code, body = "", headers = {}) {
  res.writeHead(code, {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": CSP,
    "cross-origin-resource-policy": "same-origin",
    ...headers,
  });
  res.end(body);
}
export async function createReadOnlyLoopbackServer({ root = DEFAULT_ROOT } = {}) {
  const publicRoot = await realpath(root);
  const server = createServer(async (req, res) => {
    // Never act as an HTTP proxy, never accept incoming cross-site requests.
    const method = req.method ?? "";
    if (!["GET", "HEAD"].includes(method)) return reply(res, 405, "read-only preview: method denied", { allow: "GET, HEAD" });
    const host = (req.headers.host ?? "").split(":")[0].toLowerCase();
    if (!HOSTS.has(host)) return reply(res, 403, "loopback host required");
    const target = req.url ?? "";
    if (/^https?:\/\//i.test(target) || target.startsWith("//")) return reply(res, 403, "proxy request forbidden");
    let uri;
    try { uri = new URL(target, "http://localhost"); } catch { return reply(res, 400, "invalid URL"); }
    let pathname;
    try { pathname = decodeURIComponent(uri.pathname); } catch { return reply(res, 400, "invalid encoding"); }
    const lower = pathname.toLowerCase();
    if (BLOCKED_PREFIXES.some((prefix) => lower === prefix.slice(0, -1) || lower.startsWith(prefix)) ||
      lower === "/__preview/unsafe") return reply(res, 403, "backend access forbidden");
    if (pathname.includes("\0") || pathname.includes("\\") || pathname.split("/").includes("..")) {
      return reply(res, 403, "invalid static path");
    }
    if (pathname === "/__preview/status") {
      return reply(res, 200, method === "HEAD" ? "" : JSON.stringify({
        kind: "LOCAL_ONLY_INERT_STATIC_PREVIEW",
        backend: "DISCONNECTED",
        realAuthentication: false,
        readWrites: "NOT_AVAILABLE",
        signedInAcceptance: "NOT_TESTED",
      }), { "content-type": "application/json; charset=utf-8" });
    }
    const candidate = resolve(publicRoot, "." + pathname);
    if (candidate !== publicRoot && !candidate.startsWith(publicRoot + sep)) return reply(res, 403, "outside preview root");
    try {
      const real = await realpath(candidate);
      if (real !== publicRoot && !real.startsWith(publicRoot + sep)) return reply(res, 403, "symlink outside preview root");
      const info = await stat(real);
      if (!info.isFile()) return reply(res, 404, "not found");
      const type = MIME[extname(real).toLowerCase()];
      if (!type) return reply(res, 403, "unlisted static file type");
      const bytes = method === "HEAD" ? "" : await readFile(real);
      return reply(res, 200, bytes, { "content-type": type });
    } catch {
      return reply(res, 404, "not found");
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createReadOnlyLoopbackServer();
  process.stdout.write("LOCAL ONLY: http://127.0.0.1:" + server.address().port + "/shared/costing-control-center.html\n");
  process.stdout.write("Static preview only; backend DISCONNECTED, real signed-in acceptance NOT TESTED.\n");
}
