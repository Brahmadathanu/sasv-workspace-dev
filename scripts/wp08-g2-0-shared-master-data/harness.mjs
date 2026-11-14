// WP08 G2-0 harness: serves the repository exactly as each client would, stubs the network, and opens the four
// shared Master Data pages in real Chromium. Read-only: the Supabase stub records every call and answers with empty data.
//
//   electron mode: HTTP root = repository root (main.js express.static(__dirname)), pages at /public/shared/<page>.html
//   pwa mode:      HTTP root = public/            (public/netlify.toml publish = "public"), pages at /shared/<page>.html
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const MODULES = Object.freeze([
  { key: "manage-products", target: "module:manage-products", file: "manage-products.html", js: "products.js", status: "accessStatus" },
  { key: "manage-rm-bom", target: "module:manage-rm-bom", file: "manage-rm-bom.html", js: "manage-rm-bom.js", status: "bomPageStatus" },
  { key: "pm-templates", target: "module:pm-templates", file: "manage-pm-bom.html", js: "manage-pm-bom.js", status: "bomPageStatus" },
  { key: "manage-sp-bom", target: "module:manage-sp-bom", file: "manage-sp-bom.html", js: "manage-sp-bom.js", status: "bomPageStatus" },
]);

export const PLATFORMS = Object.freeze({
  electron: { webRoot: "", pagePrefix: "/public/shared/", home: "/index.html", login: "/login.html", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SASV-Workspace/6.1.0 Chrome/120 Electron/30.0.0 Safari/537.36" },
  pwa: { webRoot: "public", pagePrefix: "/shared/", home: "/utilities-hub/index.html", login: "/utilities-hub/index.html", userAgent: null },
});

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon" };

export function startServer(platform) {
  const base = path.join(repoRoot, PLATFORMS[platform].webRoot);
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
    const file = path.join(base, rel);
    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" }).end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// The role is injected by the test before any page script runs: window.__MOCK_GRANTS = [{target, can_view, can_edit}], window.__MOCK_SESSION = bool.
const SUPABASE_STUB = `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "g2-0@example.invalid" };
const calls = (window.__MOCK_CALLS = window.__MOCK_CALLS || []);
const result = { data: [], error: null, count: 0 };
function chain(table) {
  const fn = () => proxy;
  const proxy = new Proxy(fn, {
    get(_t, prop) {
      if (prop === "then") return (res, rej) => Promise.resolve(result).then(res, rej);
      if (prop === "catch" || prop === "finally") return () => proxy;
      return (...a) => { calls.push({ kind: "from", table, method: String(prop) }); return proxy; };
    },
    apply: () => proxy,
  });
  return proxy;
}
export function createClient() {
  const session = window.__MOCK_SESSION === false ? null : { access_token: "stub", user };
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session ? user : null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      refreshSession: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (table) => chain(table),
    rpc: (name, args) => {
      calls.push({ kind: "rpc", name, args });
      if (name === "get_user_permissions") return Promise.resolve({ data: window.__MOCK_GRANTS || [], error: null });
      if (name === "app_get_current_user_context") return Promise.resolve({ data: { user_id: user.id, email: user.email, is_authenticated: !!session }, error: null });
      if (name === "app_get_my_permissions") return Promise.resolve({ data: window.__MOCK_GRANTS || [], error: null });
      return chain("rpc:" + name);
    },
    schema() { return client; },
  };
  return client;
}
`;
const JSPDF_STUB = `window.jspdf = { jsPDF: function () { this.text = () => {}; this.save = () => {}; this.autoTable = () => {}; } };`;

export async function launch() {
  let chromium;
  try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { return null; }
  try {
    const browser = await chromium.launch();
    return { browser, async close() { await browser.close(); } };
  } catch { return null; }
}

/** role: "denied" | "view" | "edit" | "legacy-pm-key-only". Returns page, requests log and error log. */
export async function openPage(env, { platform, moduleDef, role, width, session = true, pathSuffix = "" }) {
  const server = env.servers[platform];
  const origin = `http://127.0.0.1:${server.address().port}`;
  const cfg = PLATFORMS[platform];
  const context = await env.browser.newContext({ viewport: { width, height: 900 }, ...(cfg.userAgent ? { userAgent: cfg.userAgent } : {}) });
  const grants = {
    denied: [],
    view: [{ target: moduleDef.target, can_view: true, can_edit: false }],
    edit: [{ target: moduleDef.target, can_view: true, can_edit: true }],
    // Only the WRONG key for PM BOM: must stay denied (module:pm-templates is the sole gate).
    "wrong-key": [{ target: "module:manage-pm-bom", can_view: true, can_edit: true }],
  }[role];
  await context.addInitScript(([g, s]) => { window.__MOCK_GRANTS = g; window.__MOCK_SESSION = s; }, [grants, session]);
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const url = route.request().url();
    if (/esm\.sh\/@supabase\/supabase-js/.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: SUPABASE_STUB });
    if (/jspdf/.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: JSPDF_STUB });
    return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
  const page = await context.newPage();
  const failed = [];
  const errors = [];
  page.on("response", (r) => { if (r.url().startsWith(origin) && r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const url = `${origin}${cfg.pagePrefix}${moduleDef.file}${pathSuffix}`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(900);
  return { page, context, failed, errors, origin, url };
}

export async function overflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return { vw, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) };
  });
}

export async function mockCalls(page) { return page.evaluate(() => window.__MOCK_CALLS || []); }
