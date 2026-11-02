// CW-06 browser acceptance harness: drives the REAL Production Route Manager page and controllers (real
// production-route.js, editor and candidates modules, real PRM modal) against an in-memory MOCK backend.
// Nothing here talks to Supabase: the Supabase ESM module and the CDN scripts are replaced by inert fakes that
// record every RPC. COSTING_DIALOGS_V1 is switched on in the browser's localStorage only.
//
// Two scenarios, both reached through the same UI controls a user would use:
//   A. Supersede  - deep link ?lens=product-route-editor&product_route_id=9001&product_id=77 -> Product route
//                   editor shows the "Supersede" action -> dialog.
//   B. Create family - lens historical-candidate-review -> choose a Product Group (Mode B) -> "Preview selected
//                   hierarchy" -> "Create Manufacturing Route Family" -> dialog.
// Requires Playwright (chromium); returns { skipped } when it is not installed.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };

export const WRITE_RPC = /^rpc_(create|update|upsert|delete|submit|approve|supersede|clone|set|apply|archive|retire|import|map|unmap)/;

export const MOCK = Object.freeze({
  productRouteId: 9001,
  productId: 77,
  newRouteId: 9002,
  productGroupId: 501,
});

// Inert Supabase. State lives on window.__mock so the test can read the recorded calls.
const STUB = `
const TARGETS = ["module:production-route-manager","module:costing-control-center"];
const calls = (window.__mock = window.__mock || { rpc: [], failWrites: false });
const user = { id: "00000000-0000-0000-0000-000000000000", email: "mock@example.invalid" };
const session = { access_token: "stub", user };
const ok = (data) => ({ data, error: null });
function respond(name, args) {
  switch (name) {
    case "get_user_permissions":
      return ok(TARGETS.map((target) => ({ target, can_view: true, can_edit: true })));
    case "rpc_get_production_route_master_options":
      return ok({ product_groups: [{ product_group_id: ${MOCK.productGroupId}, product_group_name: "Mock Group A" }], products: [{ product_id: ${MOCK.productId}, product_name: "Mock Product" }], route_families: [], product_subgroups: [], cost_centres: [], activities: [] });
    case "rpc_get_product_route_detail":
      return ok({ header: { product_route_id: ${MOCK.productRouteId}, product_id: ${MOCK.productId}, product_name: "Mock Product", status: "APPROVED", version_label: "v3", route_family_name: "Mock Family", base_route_family_route_id: null }, validation: null, overrides: [], effective_steps: [] });
    case "rpc_preview_route_family_candidate":
      return ok({ scope_mode: "PRE_MAPPING_PRODUCT_GROUP_SET", selected_product_groups: [{ product_group_id: ${MOCK.productGroupId}, product_group_name: "Mock Group A" }], family_steps: [], counts: { products: 1 } });
    case "rpc_supersede_product_route":
      return ok({ ok: true });
    case "rpc_create_route_family":
      return ok({ route_family_id: 8001 });
    default:
      return ok([]);
  }
}
function chain() {
  const result = { data: [], error: null, count: 0 };
  const fn = () => proxy;
  const proxy = new Proxy(fn, { get(_t, p) { if (p === "then") return (res) => Promise.resolve(result).then(res); if (p === "catch" || p === "finally") return () => proxy; return () => proxy; }, apply: () => proxy });
  return proxy;
}
export function createClient() {
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      refreshSession: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => chain(),
    rpc: (name, args) => {
      calls.rpc.push({ name, args: JSON.parse(JSON.stringify(args ?? {})) });
      const pending = new Promise((resolve) => {
        const write = /^rpc_(create|update|upsert|delete|submit|approve|supersede|clone|set|apply)/.test(name);
        const go = () => resolve(calls.failWrites && write ? { data: null, error: { message: "mock: connection lost" } } : respond(name, args));
        if (write && calls.holdWrites) calls.release = go; else go();
      });
      const q = { then: (a, b) => pending.then(a, b), catch: (b) => pending.catch(b), range: () => q, select: () => q, single: () => q, maybeSingle: () => q };
      return q;
    },
    schema: () => client,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel() {},
  };
  return client;
}
`;

export function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
    const file = path.join(root, "public", rel);
    if (!file.startsWith(path.join(root, "public")) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" }).end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/** Opens the real page with the mock backend. `flagOn` sets COSTING_DIALOGS_V1 in localStorage only. */
export async function openMockPage(browser, base, search, { flagOn = true, width = 1280 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  await page.addInitScript((on) => { try { if (on) localStorage.setItem("COSTING_DIALOGS_V1", "1"); else localStorage.removeItem("COSTING_DIALOGS_V1"); } catch { /* ignore */ } }, flagOn);
  await page.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  await page.route(/esm\.sh\/@supabase\/supabase-js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB }));
  await page.goto(`${base}/shared/production-route-manager.html${search}`, { waitUntil: "load" });
  return { context, page, errors };
}

export async function launch() {
  let chromium;
  try {
    chromium = createRequire(import.meta.url)("playwright").chromium;
  } catch {
    return null;
  }
  const server = await startServer();
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  return { browser, server, base: `http://127.0.0.1:${server.address().port}`, close: async () => { await browser.close(); server.close(); } };
}

export const rpcCalls = (page) => page.evaluate(() => (window.__mock?.rpc || []).map((c) => ({ name: c.name, args: c.args })));

/** Scenario A: reaches the Supersede dialog through the real Product route editor. */
export async function openSupersedeDialog(page) {
  await page.waitForSelector('[data-prm-action="supersede-product"]', { timeout: 15000 });
  await page.click('[data-prm-action="supersede-product"]');
  await page.waitForSelector("#prmSupersedeNewRouteId", { timeout: 5000 });
}

/** Scenario B: reaches the Create Route Family dialog through the real Historical Candidate Review lens. */
export async function openCreateFamilyDialog(page) {
  await page.waitForSelector("#prmCandidateGroups", { timeout: 15000 });
  await page.selectOption("#prmCandidateGroups", String(MOCK.productGroupId));
  await page.click('button[data-prm-candidate="family-b"]');
  await page.waitForSelector("[data-prm-create-family]", { timeout: 10000 });
  await page.click("[data-prm-create-family]");
  await page.waitForSelector("#prmCreateFamilyName", { timeout: 5000 });
}

export const SUPERSEDE_URL = `?lens=product-route-editor&product_route_id=${MOCK.productRouteId}&product_id=${MOCK.productId}`;
export const CANDIDATE_URL = "?lens=historical-candidate-review";
