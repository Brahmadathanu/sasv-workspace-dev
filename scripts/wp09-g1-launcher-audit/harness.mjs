// WP09 G1 launcher harness. Serves the repository as each client would (Electron: repo root; PWA: public/) and replaces the
// network with an in-page READ-ONLY Supabase stub fed by a SYNTHETIC registry fixture. Nothing here touches the live project.
// Any writer call attempted by a launcher page is recorded in window.__WRITES and asserted empty by the tests.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { repoRoot } from "./lib.mjs";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".webmanifest": "application/json" };

export const CLIENTS = Object.freeze({
  electron: { webRoot: "", home: "/index.html", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SASV-Workspace/6.1.0 Chrome/120 Electron/30.0.0 Safari/537.36" },
  pwa: { webRoot: "public", home: "/utilities-hub/index.html", userAgent: null },
});

export function startServer(client) {
  const base = path.join(repoRoot, CLIENTS[client].webRoot);
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
    const file = path.join(base, rel);
    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" }).end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const SUPABASE_STUB = `
const curUser = () => ({ id: window.__USER_ID || "00000000-0000-0000-0000-0000000000a1", email: (window.__USER_EMAIL || "wp09-g1@example.invalid") });
const writes = (window.__WRITES = window.__WRITES || []);
const reads = (window.__READS = window.__READS || []);
function builder(table) {
  const st = { table, eq: [], order: [], single: false, write: null };
  const run = () => {
    if (st.write) { writes.push({ table, op: st.write }); return { data: null, error: null }; }
    reads.push({ table, eq: st.eq.map((e) => e.join("=")).join("&") });
    let rows = [];
    if (table === "v_app_module_registry") rows = (window.__REGISTRY || []).slice();
    else if (table === "app_nav_sections") rows = (window.__SECTIONS || []).filter((r) => r.is_active !== false);
    for (const [c, v] of st.eq) rows = rows.filter((r) => r[c] === v);
    for (const [c, asc] of st.order) rows.sort((a, b) => (typeof a[c] === "number" ? a[c] - b[c] : String(a[c]).localeCompare(String(b[c]))) * (asc ? 1 : -1));
    if (st.single) return { data: rows[0] || null, error: null };
    return { data: rows, error: null };
  };
  const p = new Proxy({}, { get(_t, prop) {
    if (prop === "then") return (res, rej) => Promise.resolve(run()).then(res, rej);
    if (prop === "select") return () => p;
    if (prop === "eq") return (c, v) => (st.eq.push([c, v]), p);
    if (prop === "gt" || prop === "limit") return () => p;
    if (prop === "order") return (c, o) => (st.order.push([c, !(o && o.ascending === false)]), p);
    if (prop === "maybeSingle" || prop === "single") return () => (st.single = true, p);
    if (["insert", "update", "upsert", "delete"].includes(prop)) return () => (st.write = String(prop), p);
    return () => p;
  } });
  return p;
}
export function createClient() {
  const mkSession = () => (window.__NO_SESSION ? null : { access_token: "stub", user: curUser() });
  const client = {
    auth: {
      getSession: async () => ({ data: { session: mkSession() }, error: null }),
      getUser: async () => ({ data: { user: mkSession() ? curUser() : null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      refreshSession: async () => ({ data: { session: mkSession() }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: {}, error: null }),
    },
    from: (t) => builder(t),
    rpc: (name) => {
      if (name === "get_user_permissions") {
        const f = window.__PERM_FAIL;
        if (f === "error") return Promise.resolve({ data: null, error: { message: "mock" } });
        if (f === "nonarray") return Promise.resolve({ data: { x: 1 }, error: null });
        return Promise.resolve({ data: window.__GRANTS || [], error: null });
      }
      writes.push({ rpc: name });
      return Promise.resolve({ data: null, error: null });
    },
    schema() { return client; },
    channel() { const c = { on: () => c, subscribe: () => c, unsubscribe() {} }; return c; },
    removeChannel() {},
  };
  return client;
}
`;

export async function launch() {
  let chromium;
  try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { return null; }
  try {
    const browser = await chromium.launch();
    return { browser, close: () => browser.close() };
  } catch { return null; }
}

/**
 * registry: rows in v_app_module_registry shape; sections: app_nav_sections rows; grants: [{target,can_view,can_edit}].
 * Returns { page, context, errors, close }.
 */
export async function openLauncher(env, { client, width, registry, sections, grants, permFail = null, storage = null, userAgentOverride, userId = null, height = 900, context: sharedContext = null, deviceScaleFactor = null, rewrites = [] }) {
  const server = env.servers[client];
  const origin = `http://127.0.0.1:${server.address().port}`;
  const cfg = CLIENTS[client];
  const context = sharedContext || await env.browser.newContext({ viewport: { width, height }, ...(deviceScaleFactor ? { deviceScaleFactor } : {}), ...(cfg.userAgent ? { userAgent: cfg.userAgent } : {}), ...(userAgentOverride ? { userAgent: userAgentOverride } : {}) });
  await context.addInitScript(([r, s, g, f, st, uid]) => {
    if (uid) window.__USER_ID = uid;
    window.__REGISTRY = r; window.__SECTIONS = s; window.__GRANTS = g; window.__PERM_FAIL = f;
    window.electronAPI = window.electronAPI || { getAppVersion: async () => "6.1.0-test", onUpdateStatus() {}, checkForUpdates: async () => ({}), getUpdateState: async () => ({}) };
    if (st) { try { for (const [k, v] of Object.entries(st)) if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch {} }
  }, [registry, sections, grants, permFail, storage, userId]);
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const url = route.request().url();
    if (/esm\.sh\/@supabase\/supabase-js/.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: SUPABASE_STUB });
    return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
  // Test-only response rewrites for LOCAL files: [[urlRegex, (body, url) => newBody]] (baseline comparison / mutation controls).
  for (const [rx, fn] of rewrites) {
    await context.route(rx, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: fn(await res.text(), route.request().url()) });
    });
  }
  const page = await context.newPage();
  const requests = [];
  page.on("request", (r) => { if (!r.url().startsWith(origin)) requests.push(r.url()); });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(origin + cfg.home, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  return { page, context, errors, origin, requests, close: () => context.close() };
}

export function row(moduleKey, label, sectionKey, sectionLabel, sortOrder, extra = {}) {
  return { module_key: moduleKey, target_key: `module:${moduleKey}`, label, description: extra.description ?? `Synthetic description for ${label}`, section_key: sectionKey, section_label: sectionLabel, sort_order: sortOrder, min_nav_mode: extra.min_nav_mode ?? "view", route_path: extra.route_path ?? `public/shared/${moduleKey}.html`, nav_enabled: true, client_key: extra.client_key ?? "electron" };
}
export const grantAll = (rows, mode = "use") => rows.map((r) => ({ target: r.target_key, can_view: true, can_edit: mode === "use" }));
