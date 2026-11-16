// Shared mocked-browser harness for the REAL Manage Products controller (public/shared/js/products.js served unmodified from the repository root).
// Mocked data only: the Supabase client is a recording stub; no network, no production. Used by browser-preview.test.mjs.
import { createRequire } from "node:module";
import { startServer, repoRoot } from "../wp08-g2-0-shared-master-data/harness.mjs";

export { repoRoot };
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
export const skip = process.env.WP10_G2_BROWSER_SKIP === "1" || !chromium ? "playwright/chromium unavailable or skipped" : false;

const STUB = `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "wp10@example.invalid" };
const calls = (window.__MOCK_CALLS = window.__MOCK_CALLS || []);
const PRODUCTS = [
  { id: 7, item: "Test Product", malayalam_name: "ടെസ്റ്റ്", status: "Active", sub_group_id: 1, is_pto: false, uom_base: "Nos", conversion_to_base: 1, is_seasonal: false, season_profile_id: null, is_llt: false, manufacture_lead_time_months: null },
  { id: 8, item: "Other Product", malayalam_name: "മറ്റൊന്ന്", status: "Active", sub_group_id: 1, is_pto: false, uom_base: "Nos", conversion_to_base: 1, is_seasonal: false, season_profile_id: null, is_llt: false, manufacture_lead_time_months: null },
];
function table(name) {
  let single = false; let eqId = null;
  const proxy = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (res, rej) => {
        let data = [];
        if (name === "products") data = single ? (PRODUCTS.find((p) => p.id === eqId) || PRODUCTS[0]) : PRODUCTS;
        else if (name === "sub_groups") data = single ? { id: 1, sub_group_name: "SG1", product_group_id: 1 } : [{ id: 1, sub_group_name: "SG1", product_group_id: 1 }, { id: 2, sub_group_name: "SG2", product_group_id: 1 }];
        else if (name === "product_groups") data = single ? { id: 1, group_name: "G1", sub_category_id: 1 } : [];
        else if (name === "sub_categories") data = single ? { id: 1, sub_category_name: "SC1", category_id: 1 } : [];
        else if (name === "product_skus") data = [];
        return Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : 1 }).then(res, rej);
      };
      return (...a) => { if (prop === "single" || prop === "maybeSingle") single = true; if (prop === "eq" && a[0] === "id") eqId = Number(a[1]); calls.push({ kind: "from", table: name, method: String(prop) }); return proxy; };
    },
    apply: () => proxy,
  });
  return proxy;
}
export function createClient() {
  const session = { access_token: "stub", user };
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }), getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), refreshSession: async () => ({ data: { session }, error: null }), signOut: async () => ({ error: null }),
    },
    from: (t) => table(t),
    rpc: async (name, args) => {
      calls.push({ kind: "rpc", name, args });
      const h = (window.__RPC || {})[name];
      if (h) return typeof h === "function" ? await h(args) : h;
      if (name === "get_user_permissions" || name === "app_get_my_permissions") return { data: window.__MOCK_GRANTS || [], error: null };
      if (name === "app_get_current_user_context") return { data: { user_id: user.id, email: user.email, is_authenticated: true }, error: null };
      if (name === "rpc_get_latest_governed_cost_period_start") return { data: "2026-10-01", error: null };
      return { data: null, error: { message: "function not found", code: "PGRST202", status: 404 } };
    },
    schema() { return client; },
  };
  return client;
}
`;
const JSPDF_STUB = `window.jspdf = { jsPDF: function () { this.text = () => {}; this.save = () => {}; this.autoTable = () => {}; } };`;
const GRANTS = [{ target: "module:manage-products", can_view: true, can_edit: true }, { target: "module:pm-templates", can_view: true, can_edit: false }, { target: "module:production-route-manager", can_view: true, can_edit: false }];

let server; let browser;
export async function startHarness() { if (skip) return; server = await startServer("pwa"); browser = await chromium.launch(); }
export async function stopHarness() { await browser?.close(); await new Promise((r) => server?.close(r)); }
export const shotsOn = process.env.WP10_G2_SHOTS !== "0";

/**
 * Opens the REAL page, selects product 7 and enters edit mode with a CHANGED sub-group (1 -> 2) unless changeSubgroup is false.
 * rpc: map of rpc name -> value or async function source (functions are serialised and re-created inside the page: use window.* for state).
 * hook: when true, a TEST-ONLY line is appended to the served products.js exposing the access state (window.__wp10Access) so rights revocation can be simulated.
 */
export async function openProduct({ width = 1280, flag = true, rpc = {}, importDelayMs = 0, blockModule = false, mutateProducts = null, accessHook = false, changeSubgroup = true, mutateModules = [] } = {}) {
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(([g, f]) => { window.__MOCK_GRANTS = g; try { if (f) localStorage.setItem("WP10_SAFEGUARDS_V1", "1"); } catch { /* ignore */ } window.__RPC = {}; }, [GRANTS, flag]);
  const loaded = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const url = route.request().url();
    if (/esm\.sh\/@supabase\/supabase-js/.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
    if (/jspdf/.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: JSPDF_STUB });
    return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
  if (importDelayMs) await context.route(/wp10-safeguards(-ui)?\.js/, async (route) => { const res = await route.fetch(); await new Promise((r) => setTimeout(r, importDelayMs)); await route.fulfill({ response: res }); });
  for (const [re, from, to] of mutateModules) await context.route(re, async (route) => { const res = await route.fetch(); let body = await res.text(); if (!body.includes(from)) throw new Error("mutation target missing: " + from); await route.fulfill({ response: res, body: body.replace(from, to) }); });
  if (blockModule) await context.route(/wp10-safeguards(-ui)?\.js/, (route) => route.fulfill({ status: 500, body: "boom" }));
  if (mutateProducts || accessHook) await context.route(/\/js\/products\.js/, async (route) => {
    const res = await route.fetch(); let body = await res.text();
    for (const [from, to] of mutateProducts || []) { if (!body.includes(from)) throw new Error("mutation target missing: " + from); body = body.replace(from, to); }
    if (accessHook) body += "\nwindow.__wp10Access = accessState; // TEST-ONLY hook appended by the harness; the repository file is unchanged\n";
    await route.fulfill({ response: res, body });
  });
  const page = await context.newPage();
  page.on("request", (r) => { if (/wp10-safeguards/.test(r.url())) loaded.push(new URL(r.url()).pathname); });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(`${origin}/shared/manage-products.html`, { waitUntil: "load" });
  await page.waitForTimeout(700);
  await page.evaluate((entries) => { for (const [k, v] of entries) window.__RPC[k] = typeof v === "string" && v.startsWith("fn:") ? (0, eval)("(" + v.slice(3) + ")") : v; }, Object.entries(rpc).map(([k, v]) => [k, typeof v === "function" ? "fn:" + v.toString() : v]));
  await page.locator("#productRegisterBody tr, #productLedger button").locator("visible=true").first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById("editToggleBtn")?.click());
  await page.waitForTimeout(300);
  if (changeSubgroup) await setSubgroup(page, 2);
  return { page, context, loaded, errors };
}
/** Sets the sub-group <select> to a real option and fires the page's own change handlers. */
export async function setSubgroup(page, id) {
  await page.evaluate((v) => {
    const sel = document.getElementById("subgroupSelect");
    if (![...sel.options].some((o) => o.value === String(v))) sel.add(new Option("SG" + v, String(v)));
    sel.value = String(v);
    sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, id);
}
// Dispatches the form's own submit event (the page handler is the real one); native required-field validation of unrelated cascading selects is bypassed, as in the page's own requestSubmit fallback.
export const clickSave = (page) => page.evaluate(() => document.getElementById("productForm").dispatchEvent(new Event("submit", { cancelable: true })));
export const rpcCount = (page, name) => page.evaluate((n) => window.__MOCK_CALLS.filter((c) => c.kind === "rpc" && c.name === n).length, name);
export const rpcNames = (page) => page.evaluate(() => window.__MOCK_CALLS.filter((c) => c.kind === "rpc").map((c) => c.name));
