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
const LOOPBACK_NAMES = ["127.0.0.1", "localhost"];
const ALLOWED_HOST_HEADERS = (port) => new Set(LOOPBACK_NAMES.map((name) => name + ":" + port));
const ALLOWED_ORIGINS = (port) => new Set(LOOPBACK_NAMES.map((name) => "http://" + name + ":" + port));
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

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
    const port = server.address()?.port;
    const hostHeader = String(req.headers.host ?? "").toLowerCase();
    if (!ALLOWED_HOST_HEADERS(port).has(hostHeader)) return reply(res, 403, "loopback host required");
    // Opaque / cross-origin browsers requests are refused outright (DNS-rebinding and drive-by defence).
    const origin = req.headers.origin;
    if (origin !== undefined && !ALLOWED_ORIGINS(port).has(String(origin).toLowerCase())) return reply(res, 403, "cross-origin request forbidden");
    const site = req.headers["sec-fetch-site"];
    if (site !== undefined && !["same-origin", "none"].includes(String(site))) return reply(res, 403, "cross-site request forbidden");
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
    if (pathname === "/sw.js" || pathname === "/service-worker.js") return reply(res, 403, "preview service workers forbidden");
    if (pathname === "/__preview/status") {
      return reply(res, 200, method === "HEAD" ? "" : JSON.stringify({
        kind: "LOCAL_ONLY_SYNTHETIC_PREVIEW",
        backend: "DISCONNECTED",
        realAuthentication: false,
        readWrites: "NOT_AVAILABLE",
        signedInAcceptance: "NOT_TESTED",
      }), { "content-type": "application/json; charset=utf-8" });
    }
    if (pathname === "/__preview/" || pathname === "/__preview") {
      const launcher = await readFile(resolve(here, "synthetic-launcher.html"));
      return reply(res, 200, method === "HEAD" ? "" : launcher, { "content-type": "text/html; charset=utf-8" });
    }
    if (pathname === "/shared/js/supabaseClient.js") {
      const synthetic = await readFile(resolve(here, "synthetic-supabase-client.mjs"));
      return reply(res, 200, method === "HEAD" ? "" : synthetic, { "content-type": "text/javascript; charset=utf-8" });
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
      let bytes = method === "HEAD" ? "" : await readFile(real);
      // Only the six Costing module pages receive an explicit synthetic-preview label.
      if (method === "GET" && type.startsWith("text/html") &&
          /^\/shared\/(costing-control-center|material-cost-manager|cost-build-manager|pricing-policy-manager|cost-sheet-review|production-route-manager)\.html$/.test(pathname)) {
        const notice = '<div id="synthetic-preview-banner" role="status" style="position:fixed;z-index:2147483647;top:0;left:0;right:0;padding:5px 12px;background:#622118;color:#fff;font:700 13px system-ui;text-align:center;pointer-events:none">SYNTHETIC COSTING PREVIEW — NO REAL DATA · NO REAL LOGIN · ALL WRITES DISABLED</div>';
        bytes = Buffer.from(bytes.toString("utf8").replace(/(<body[^>]*>)/i, "$1" + notice));
      }
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
  process.stdout.write("LOCAL ONLY: http://127.0.0.1:" + server.address().port + "/__preview/\n");
  process.stdout.write("Synthetic preview; backend DISCONNECTED, fake view-only authentication, no real signed-in acceptance.\n");
}
