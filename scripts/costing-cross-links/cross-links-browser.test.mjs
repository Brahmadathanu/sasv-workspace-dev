// MDC-07 / N3 browser tests (Chromium via Playwright; skipped only when Playwright is unavailable or
// COSTING_XLINK_SKIP_BROWSER=1). Real Cost Sheet Review / Pricing Policy pages and shell run against an inert
// in-memory backend: no Supabase, no network, no writes. Feature flags are set only in the browser's localStorage.
import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../costing-responsive/responsive-audit.mjs";
import { createRequire } from "node:module";

const SKIP = process.env.COSTING_XLINK_SKIP_BROWSER === "1";
const WRITE = /^rpc_(create|update|upsert|delete|submit|approve|supersede|clone|set|apply|archive|retire|import|map|unmap|inactivate|cancel|correct|request|refresh|recalc)/;
const PERIOD = "2026-09-01";
const SCHEME_ROWS = [
  { period_start: PERIOD, product_id: 3, product_name: "Gamma", sku_id: 30, sku_display_name: "G 1kg", scheme_name: "Promo", scheme_viability_status: "VIABLE" },
  { period_start: PERIOD, product_id: 1, product_name: "Alpha", sku_id: null, sku_display_name: "A", scheme_name: "Base", scheme_viability_status: "REVIEW" },
  { period_start: null, product_id: 2, product_name: "Beta", sku_id: 20, sku_display_name: "B", scheme_name: "Flat", scheme_viability_status: "REVIEW" },
];
const QC_ROW = { refresh_run_id: 5, period_start: PERIOD, product_id: 7, product_name: "QC Prod", sku_id: 70, action_code: "BLOCKED_MISSING_FG_PROTOCOL_MAPPING", action_severity: "BLOCKER", recommended_action: "Map", total_count: 1 };
const MS_ROW = { refresh_run_id: 5, period_start: PERIOD, product_id: 8, product_name: "MS Prod", sku_id: 80, pack_size: 10, pack_uom: "g", action_code: "BLOCKED_MISSING_RM_EVIDENCE", action_severity: "BLOCKER", recommended_action: "Fix", total_count: 1 };

const STUB = `
const TARGETS = ["module:costing-control-center","module:material-cost-manager","module:cost-build-manager","module:pricing-policy-manager","module:cost-sheet-review","module:production-route-manager"];
const mock = (window.__mock = window.__mock || { rpc: [], from: [], mutations: [] });
const user = { id: "00000000-0000-0000-0000-000000000000", email: "mock@example.invalid" };
const session = { access_token: "stub", user };
const DATA = window.__xlinkData || {};
function chain(view) {
  let from = 0;
  const result = () => ({ data: from > 0 ? [] : (DATA.views?.[view] ?? (view === "v_costing_pricing_control_dashboard_snapshot" ? [{ period_start: DATA.period }] : [])), error: null, count: 0 });
  const proxy = new Proxy(function () {}, {
    get(_t, p) {
      if (p === "then") return (res, rej) => Promise.resolve(result()).then(res, rej);
      if (p === "catch" || p === "finally") return () => proxy;
      if (["insert", "update", "upsert", "delete"].includes(p)) return () => { mock.mutations.push({ view, verb: p }); return proxy; };
      if (p === "range") return (a) => { from = Number(a) || 0; return proxy; };
      return () => proxy;
    },
    apply: () => proxy,
  });
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
    from: (view) => { mock.from.push(view); return chain(view); },
    rpc: (name, args) => {
      mock.rpc.push({ name, args: JSON.parse(JSON.stringify(args ?? {})) });
      const data = name === "get_user_permissions" ? TARGETS.map((target) => ({ target, can_view: true, can_edit: false }))
        : (DATA.rpc?.[name] ?? []);
      const p = Promise.resolve({ data, error: null });
      const q = { then: (a, b) => p.then(a, b), catch: (b) => p.catch(b), range: () => q, select: () => q, single: () => q, maybeSingle: () => q };
      return q;
    },
    schema: () => client,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel() {},
  };
  return client;
}
`;

let env;
async function getEnv(t) {
  if (SKIP) { t.skip("COSTING_XLINK_SKIP_BROWSER=1"); return null; }
  if (env) return env;
  let chromium;
  try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { t.skip("playwright not available"); return null; }
  const server = await startServer();
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  env = { browser, base: `http://127.0.0.1:${server.address().port}`, close: async () => { await browser.close(); server.close(); } };
  return env;
}
test.after(async () => { await env?.close(); });

async function open(e, rel, { flag = false, width = 1280 } = {}) {
  const context = await e.browser.newContext({ viewport: { width, height: 900 } });
  const data = {
    period: PERIOD,
    views: { v_costing_pricing_sku_scheme_comparison: SCHEME_ROWS },
    rpc: { rpc_get_qc_action_queue: [{ row_data: [QC_ROW], total_count: 1 }], rpc_get_materials_stores_action_queue: [{ row_data: [MS_ROW], total_count: 1 }] },
  };
  await context.addInitScript(({ d, f }) => {
    window.__xlinkData = d;
    try { if (f) localStorage.setItem("COSTING_NAV_GROUPS_V1", "1"); } catch { /* ignore */ }
  }, { d: data, f: flag });
  await context.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/esm\.sh\/@supabase\/supabase-js/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (x) => errors.push(String(x.message).slice(0, 200)));
  await page.goto(`${e.base}/${rel}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  return { context, page, errors };
}
const mock = (page) => page.evaluate(() => window.__mock);
const writesOf = (m) => ({ rpc: m.rpc.filter((c) => WRITE.test(c.name)), mutations: m.mutations });

for (const flag of [false, true]) {
  test(`Scheme Comparison (nav groups ${flag ? "ON" : "OFF"}): per-row Pricing Policy link opens PPM SKU Policy Overview with period/product/SKU; no link without own context`, async (t) => {
    const e = await getEnv(t); if (!e) return;
    const { context, page, errors } = await open(e, `shared/cost-sheet-review.html?lens=scheme-comparison&period_start=${PERIOD}`, { flag });
    const links = page.locator('#tableBody a[data-sc-ppm-link="sku-overview"]');
    assert.equal(await links.count(), 1, "only the row with its own period and SKU gets a link");
    assert.equal(await page.locator("#tableBody tr[data-row-index]").count(), 3);
    const href = await links.first().getAttribute("href");
    const u = new URL(href, "http://x/");
    assert.deepEqual(Object.fromEntries(u.searchParams), { workspace: "sku-overview", period_start: PERIOD, product_id: "3", sku_id: "30" });
    // clicking the link does not open the row drawer
    const popupP = context.waitForEvent("page");
    await links.first().click();
    const popup = await popupP;
    await popup.waitForLoadState("load");
    assert.match(popup.url(), /\/shared\/pricing-policy-manager\.html\?/);
    const pu = new URL(popup.url());
    assert.equal(pu.searchParams.get("workspace"), "sku-overview");
    assert.equal(pu.searchParams.get("period_start"), PERIOD);
    assert.equal(pu.searchParams.get("sku_id"), "30");
    assert.equal(pu.searchParams.get("product_id"), "3");
    assert.equal(await page.locator("#drawer.open, #drawer[aria-hidden='false']").count(), 0, "link click is not a row click");
    // read-only: no write RPC or table mutation from the originating page
    const w = writesOf(await mock(page));
    assert.deepEqual(w, { rpc: [], mutations: [] });
    assert.equal(await page.evaluate(() => (localStorage.getItem("COSTING_NAV_GROUPS_V1"))), flag ? "1" : null, "no flag is activated by navigation");
    // the opener keeps its own context (no window.opener handle exposed to the new tab)
    assert.equal(await popup.evaluate(() => window.opener), null);
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test("Scheme Comparison: row click still opens the Scheme drawer (historical behaviour) and the data request is unchanged", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page, errors } = await open(e, `shared/cost-sheet-review.html?lens=scheme-comparison&period_start=${PERIOD}`);
  await page.locator("#tableBody tr[data-row-index]").first().locator("td").nth(1).click();
  await page.waitForTimeout(400);
  assert.ok(await page.locator("#drawerContent").innerText().then((x) => x.trim().length > 0), "drawer opened with content");
  const m = await mock(page);
  assert.ok(m.from.includes("v_costing_pricing_sku_scheme_comparison"));
  assert.deepEqual(writesOf(m), { rpc: [], mutations: [] });
  assert.deepEqual(errors, []);
  await context.close();
});

for (const [from, to, rpcFrom, rpcTo, label] of [
  ["qc-action-queue", "materials-stores-action-queue", "rpc_get_qc_action_queue", "rpc_get_materials_stores_action_queue", "QC → Materials & Stores"],
  ["materials-stores-action-queue", "qc-action-queue", "rpc_get_materials_stores_action_queue", "rpc_get_qc_action_queue", "Materials & Stores → QC"],
]) {
  test(`Action Queues (${label}): sibling link carries the governed period only; target lens loads its own RPC; nothing written`, async (t) => {
    const e = await getEnv(t); if (!e) return;
    const { context, page, errors } = await open(e, `shared/cost-sheet-review.html?lens=${from}&period_start=${PERIOD}`, { flag: true });
    const active = await page.evaluate(() => [...document.querySelectorAll("#lensPills .pill.active")].map((b) => b.dataset.lens));
    assert.deepEqual(active, [from]);
    // both queues stay in one labelled group as two separate pills
    const group = await page.evaluate(() => [...document.querySelectorAll('[data-nav-group="action-queues"] .pill')].map((b) => b.dataset.lens));
    assert.deepEqual(group, ["qc-action-queue", "materials-stores-action-queue"]);
    await page.locator(from === "qc-action-queue" ? "#tableBody tr.cp-qc-aq-row" : "#tableBody tr.cp-ms-aq-row").first().click();
    const attr = from === "qc-action-queue" ? "data-qc-aq-nav" : "data-ms-aq-nav";
    const btn = page.locator(`[${attr}="sibling-queue"]`);
    await btn.waitFor({ state: "visible", timeout: 5000 });
    const popupP = context.waitForEvent("page");
    await btn.click();
    const popup = await popupP;
    await popup.waitForLoadState("load");
    await popup.waitForTimeout(1500);
    const pu = new URL(popup.url());
    assert.match(pu.pathname, /\/shared\/cost-sheet-review\.html$/);
    assert.equal(pu.searchParams.get("lens"), to);
    assert.equal(pu.searchParams.get("period_start"), PERIOD);
    assert.equal(pu.searchParams.has("product_id"), false, "queue lenses do not consume a product filter: none is claimed");
    const pm = await mock(popup);
    const call = pm.rpc.find((c) => c.name === rpcTo);
    assert.ok(call, `${rpcTo} called by the target lens`);
    assert.equal(call.args.p_period_start, PERIOD);
    assert.ok(!pm.rpc.some((c) => c.name === rpcFrom), "the other queue's RPC is not called by the target lens");
    assert.deepEqual(Object.keys(call.args).sort(), ["p_action_code", "p_limit", "p_offset", "p_period_start", "p_q"]);
    assert.deepEqual(writesOf(pm), { rpc: [], mutations: [] });
    assert.deepEqual(writesOf(await mock(page)), { rpc: [], mutations: [] });
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test("Action Queues: existing remediation button (QC absorption → PPM) still passes period and product", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const row = { ...QC_ROW, action_code: "REVIEW_REQUIRED_QC_ABSORPTION_BASIS" };
  const context = await e.browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((d) => { window.__xlinkData = d; }, {
    period: PERIOD, views: {}, rpc: { rpc_get_qc_action_queue: [{ row_data: [row], total_count: 1 }] },
  });
  await context.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/esm\.sh\/@supabase\/supabase-js/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
    return r.fulfill({ status: 200, contentType: /\.css/.test(r.request().url()) ? "text/css" : "text/javascript", body: "" });
  });
  const page = await context.newPage();
  await page.goto(`${e.base}/shared/cost-sheet-review.html?lens=qc-action-queue&period_start=${PERIOD}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.locator("#tableBody tr.cp-qc-aq-row").first().click();
  const popupP = context.waitForEvent("page");
  await page.locator('[data-qc-aq-nav="absorption"]').click();
  const popup = await popupP;
  const pu = new URL(popup.url());
  assert.equal(pu.searchParams.get("workspace"), "commercial-sales-assumptions");
  assert.equal(pu.searchParams.get("period_start"), PERIOD);
  assert.equal(pu.searchParams.get("product_id"), "7");
  await context.close();
});
