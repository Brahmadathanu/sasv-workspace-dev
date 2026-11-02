// WP05-P02 browser harness: real Production Route Manager page + controllers against an in-memory MOCK backend.
// Nothing talks to Supabase: the Supabase ESM module and CDN scripts are replaced by inert fakes that record every
// RPC. COSTING_PRM_CORRECTIONS_V1 (and optionally COSTING_DIALOGS_V1) are set in the browser's localStorage only.
import { launch as baseLaunch } from "../costing-dialogs/route-dialogs-browser.mjs";

export { baseLaunch as launch };
export const WRITE_RPC = /^rpc_(create|update|upsert|delete|submit|approve|supersede|clone|set|apply|archive|retire|import|map|unmap|inactivate|cancel|correct)/;

export const ROUTES = [
  { product_route_id: 9001, product_id: 77, product_name: "Mock Product", status: "APPROVED", version_label: "v3", route_version: 3, effective_from: "2026-01-01", effective_to: null, approval_reference: "AP-3", route_family_name: "Mock Family" },
  { product_route_id: 9002, product_id: 77, product_name: "Mock Product", status: "APPROVED", version_label: "v4", route_version: 4, effective_from: "2026-09-01", effective_to: null, approval_reference: "AP-4", route_family_name: "Mock Family" },
  { product_route_id: 9003, product_id: 77, product_name: "Mock Product", status: "DRAFT", version_label: "v5", route_version: 5, effective_from: null, effective_to: null, route_family_name: "Mock Family" },
  { product_route_id: 9004, product_id: 77, product_name: "Mock Product", status: "SUPERSEDED", version_label: "v2", route_version: 2, effective_from: "2025-01-01", effective_to: "2025-12-31", route_family_name: "Mock Family" },
  { product_route_id: 9005, product_id: 77, product_name: "Mock Product", status: "APPROVED", version_label: "v1-archived", route_version: 1, effective_from: "2024-01-01", archived_at: "2025-01-01T00:00:00Z", route_family_name: "Mock Family" },
  { product_route_id: 9100, product_id: 78, product_name: "Other Product", status: "APPROVED", version_label: "v1", route_version: 1, effective_from: "2026-01-01", route_family_name: "Other Family" },
];

const STUB = `
const TARGETS = ["module:production-route-manager","module:costing-control-center"];
const mock = (window.__mock = window.__mock || {});
mock.rpc = mock.rpc || [];
mock.cfg = mock.cfg || {};
const user = { id: "00000000-0000-0000-0000-000000000000", email: "mock@example.invalid" };
const session = { access_token: "stub", user };
const ok = (data) => ({ data, error: null });
const bad = (message) => ({ data: null, error: { message } });
const WRITE = ${WRITE_RPC.toString()};
function respond(name, args) {
  const cfg = mock.cfg;
  const routes = cfg.routes || [];
  switch (name) {
    case "get_user_permissions":
      return ok(TARGETS.map((target) => ({ target, can_view: true, can_edit: cfg.canEdit !== false })));
    case "rpc_get_production_route_master_options":
      return ok({ product_groups: [{ product_group_id: 501, product_group_name: "Mock Group A" }, { product_group_id: 502, product_group_name: "Mock Group B" }], products: [{ product_id: 77, product_name: "Mock Product" }, { product_id: 78, product_name: "Other Product" }], route_families: [{ route_family_id: 11, route_family_name: "Mock Family A" }, { route_family_id: 12, route_family_name: "Mock Family B" }], product_subgroups: [], cost_centres: [], activities: [] });
    case "rpc_get_product_route_detail": {
      const id = Number(args.p_product_route_id ?? Object.values(args)[0]);
      const row = routes.find((r) => r.product_route_id === id);
      return row ? ok({ header: row, validation: null, overrides: [], effective_steps: [] }) : bad("not found");
    }
    case "rpc_get_product_route_history":
      if (cfg.failHistory) return bad("mock: history unavailable");
      return ok({ product_id: args.p_product_id, rows: routes.filter((r) => r.product_id === Number(args.p_product_id)) });
    case "rpc_preview_route_family_candidate":
      return ok({ scope_mode: "PRE_MAPPING_PRODUCT_GROUP_SET", selected_product_groups: [{ product_group_id: 501, product_group_name: "Mock Group A" }], family_steps: [], counts: { products: 1 } });
    case "rpc_supersede_product_route":
      return cfg.rejectSupersede ? bad("Both routes must be active approved versions of the same Product") : ok({ status: "SUPERSEDED" });
    case "rpc_create_route_family":
      return cfg.failCreate ? bad("mock: family code already exists") : ok({ route_family_id: 8001 });
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
      mock.rpc.push({ name, args: JSON.parse(JSON.stringify(args ?? {})) });
      const pending = Promise.resolve(respond(name, args || {}));
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

/**
 * Opens the real page. flags: { corrections, dialogs } set localStorage only. cfg overrides the mock backend.
 */
export async function openPage(browser, base, search, { corrections = true, dialogs = false, width = 1280, height = 900, cfg = {} } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  await page.addInitScript(({ corrections: c, dialogs: d, cfg: conf }) => {
    try {
      for (const [k, on] of [["COSTING_PRM_CORRECTIONS_V1", c], ["COSTING_DIALOGS_V1", d]]) {
        if (on) localStorage.setItem(k, "1"); else localStorage.removeItem(k);
      }
    } catch { /* ignore */ }
    window.__mock = { rpc: [], cfg: conf };
  }, { corrections, dialogs, cfg: { routes: ROUTES, ...cfg } });
  await page.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  await page.route(/esm\.sh\/@supabase\/supabase-js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB }));
  await page.goto(`${base}/shared/production-route-manager.html${search}`, { waitUntil: "load" });
  return { context, page, errors };
}

export const rpcCalls = (page) => page.evaluate(() => (window.__mock?.rpc || []).map((c) => ({ name: c.name, args: c.args })));
export const writeCalls = async (page) => (await rpcCalls(page)).filter((c) => WRITE_RPC.test(c.name));
