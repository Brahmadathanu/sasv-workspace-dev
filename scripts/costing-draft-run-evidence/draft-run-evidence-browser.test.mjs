// CDE-1a Chromium tests: the REAL Costing Control Centre page and shell run against an inert in-memory backend (no
// Supabase, no network, no writes). The evidence provider is a test stub injected through the module's own setter; in
// production none is connected. Flags are set only in the browser's localStorage of the test context.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { startServer } from "../costing-responsive/responsive-audit.mjs";

const PERIOD = "2026-10-01";
const WRITE = /^rpc_(create|update|upsert|delete|submit|approve|accept|close|supersede|clone|set|apply|archive|retire|import|map|unmap|inactivate|cancel|correct|request|refresh|recalc|finali|lock)/i;
const sku = (id, run, extra = {}) => ({ period_start: PERIOD, valuation_date: "2026-10-31", refresh_run_id: run, product_id: 900 + id, product_name: `Product ${id}`, sku_id: id, sku_display_name: `SKU ${id}`, pack_size: 100, pack_uom: "g",
  control_severity: "REVIEW_REQUIRED", first_control_status: "PRIME_COST_REVIEW_REQUIRED", recommended_ui_route: "PRODUCTION_ROUTE_MANAGER", control_note: "Direct labour component needs review", rm_blocking_line_count: 0, pm_blocking_line_count: 0, ...extra });
const DATA = {
  period: PERIOD,
  views: {
    v_costing_pricing_sku_control_status_snapshot: [sku(1, 143, { control_severity: "READY", first_control_status: "READY", recommended_ui_route: "" })],
    v_costing_pricing_sku_control_status_by_run: [sku(11, 148), sku(12, 148)],
    v_costing_pricing_period_run_status: [{ period_start: PERIOD, display_state: "APPROVED", display_label: "Approved", displayed_run_id: 143, approved_run_id: 143, newer_draft_run_id: 148, active_run_id: null, active_run_status: null }],
  },
};
const FIXTURE = (id) => ({ status: "ok", record: { period_start: PERIOD, refresh_run_id: 148, sku_id: id, valuation_date: "2026-10-31", refreshed_at: "2026-11-01T02:00:00Z", material_costing_status: "READY", internal_material_conversion_status: "READY", direct_labour_allocation_status: "REVIEW_REQUIRED", allocation_reason_code: "REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION", allocation_basis_status: "NO_SKU_SALES_IN_LOOKBACK", allocation_resolution_status: "REVIEW_REQUIRED" } });

const STUB = `
const TARGETS = ["module:costing-control-center","module:material-cost-manager","module:cost-build-manager","module:pricing-policy-manager","module:cost-sheet-review","module:production-route-manager"];
const mock = (window.__mock = window.__mock || { rpc: [], from: [], mutations: [] });
const user = { id: "00000000-0000-0000-0000-000000000000", email: "mock@example.invalid" };
const session = { access_token: "stub", user };
const DATA = window.__cdeData || {};
function chain(view) {
  const eq = {}; let single = false; let offset = 0;
  const result = () => {
    let rows = DATA.views?.[view] ?? [];
    for (const [k, v] of Object.entries(eq)) rows = rows.filter((r) => String(r[k]) === String(v));
    if (offset > 0) rows = [];
    return { data: single ? (rows[0] ?? null) : rows, error: null };
  };
  const proxy = new Proxy(function () {}, {
    get(_t, p) {
      if (p === "then") return (res, rej) => Promise.resolve(result()).then(res, rej);
      if (p === "catch" || p === "finally") return () => proxy;
      if (["insert", "update", "upsert", "delete"].includes(p)) return () => { mock.mutations.push({ view, verb: p }); return proxy; };
      if (p === "eq") return (c, v) => { eq[c] = v; return proxy; };
      if (p === "maybeSingle" || p === "single") return () => { single = true; return proxy; };
      if (p === "range") return (a) => { offset = Number(a) || 0; return proxy; };
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
      const data = name === "get_user_permissions" ? TARGETS.map((target) => ({ target, can_view: true, can_edit: false })) : [];
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
  if (process.env.COSTING_CDE_SKIP_BROWSER === "1") { t.skip("COSTING_CDE_SKIP_BROWSER=1"); return null; }
  if (env) return env;
  let chromium;
  try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { t.skip("playwright not available"); return null; }
  const server = await startServer();
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  env = { browser, base: `http://127.0.0.1:${server.address().port}`, close: async () => { await browser.close(); server.close(); } };
  return env;
}
test.after(async () => { await env?.close(); });

async function open(e, { flag = true, width = 1280, uxFlag = false } = {}) {
  const context = await e.browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(({ d, f, u }) => {
    window.__cdeData = d;
    try { if (f) localStorage.setItem("COSTING_REVIEW_WORKLIST_V1", "1"); if (u) localStorage.setItem("COSTING_UX_CONSISTENCY_V1", "1"); } catch { /* ignore */ }
  }, { d: DATA, f: flag, u: uxFlag });
  await context.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/esm\.sh\/@supabase\/supabase-js/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (x) => errors.push(String(x.message).slice(0, 200)));
  await page.goto(`${e.base}/shared/costing-control-center.html?lens=sku-control-status&period_start=${PERIOD}`, { waitUntil: "load" });
  await page.waitForSelector("#tableBody tr[data-row-index]", { timeout: 8000 });
  return { context, page, errors };
}
async function pickDraft(page) {
  if (!(await page.locator("#rwlRunSelect").count())) return false;
  await page.selectOption("#rwlRunSelect", "148");
  await page.waitForFunction(() => document.querySelector("#tableBody")?.textContent?.includes("Product 11"), null, { timeout: 8000 });
  return true;
}
const openRow = async (page, text) => {
  await page.locator("#tableBody tr[data-row-index]", { hasText: text }).first().click();
  await page.waitForSelector("#drawerContent .cp-card, #drawerContent .detail-panel, #drawerContent *", { timeout: 5000 });
  await page.waitForTimeout(300);
};
const closeDrawer = async (page) => { await page.locator("#drawerClose").first().click(); await page.waitForTimeout(250); };
const reopen = async (page, text) => { await closeDrawer(page); await openRow(page, text); };
const expandAndLoad = async (page) => { await page.locator("[data-cde-section] > summary").click(); await page.locator("[data-cde-load]").click(); };
const setProvider = (page, body) => page.evaluate(async (src) => {
  const m = await import("/shared/js/costing-draft-run-evidence.js");
  window.__calls = [];
  // eslint-disable-next-line no-new-func
  const impl = new Function("req", "window", src);
  m.setDraftRunEvidenceProvider({ readSkuEvidence: (req) => { window.__calls.push(req); return impl(req, window); } });
}, body);

test("flag OFF: drawer is unchanged (no evidence section or host), and no provider/loader is touched", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page, errors } = await open(e, { flag: false });
  await openRow(page, "Product 1");
  assert.equal(await page.locator("[data-cde-section], [data-cde-host]").count(), 0);
  assert.equal(await page.locator("#rwlRunSelect").count(), 0, "worklist is OFF too");
  const m = await page.evaluate(() => window.__mock);
  assert.deepEqual(m.rpc.filter((c) => WRITE.test(c.name)), []);
  assert.deepEqual(errors, []);
  await context.close();
});

test("flag ON, default (approved) run: no evidence section; draft run: section present with provider-not-connected state, all Unknown, warning kept", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page, errors } = await open(e);
  await openRow(page, "Product 1");
  assert.equal(await page.locator("[data-cde-section]").count(), 0, "approved/default run");
  await page.keyboard.press("Escape");
  assert.ok(await pickDraft(page), "run picker offers draft 148");
  await openRow(page, "Product 11");
  const sec = page.locator("[data-cde-section]");
  assert.equal(await sec.count(), 1);
  assert.equal(await page.locator("[data-cde-host]").count(), 1);
  assert.equal(await sec.getAttribute("data-cde-state"), "no-provider");
  const text = await sec.innerText();
  assert.match(text, /Draft-run component evidence/);
  assert.match(text, /Run 148 · not for pricing/);
  await sec.locator("summary").click(); // expand (collapsed by default)
  const body = await sec.innerText();
  assert.match(body, /Draft-run component evidence unavailable — provider not connected/);
  assert.match(body, /is not evidence from this draft run/);
  assert.deepEqual(await sec.locator("[data-cde-status]").evaluateAll((n) => n.map((x) => x.getAttribute("data-cde-status"))), ["UNKNOWN", "UNKNOWN", "UNKNOWN", "UNKNOWN", "UNKNOWN"]);
  assert.equal(await page.locator("[data-cde-load]").count(), 0);
  // production module has no provider
  assert.equal(await page.evaluate(async () => (await import("/shared/js/costing-draft-run-evidence.js")).getDraftRunEvidenceProvider()), null);
  assert.deepEqual(errors, []);
  await context.close();
});

test("keyboard: the section is a native details/summary, reachable and toggled with Enter/Space; focus outline is visible", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await pickDraft(page);
  await openRow(page, "Product 11");
  const summary = page.locator("[data-cde-section] > summary");
  await summary.focus();
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), "SUMMARY");
  assert.equal(await page.locator("[data-cde-section]").evaluate((d) => d.open), false);
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("[data-cde-section]").evaluate((d) => d.open), true);
  await page.keyboard.press("Space");
  assert.equal(await page.locator("[data-cde-section]").evaluate((d) => d.open), false);
  assert.equal(await page.locator("table.cde-table caption").count(), 1);
  await context.close();
});

test("injected test provider: explicit Load, exact request identity, ok render, UX labels; open state survives repaint", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e, { uxFlag: true });
  await pickDraft(page);
  await openRow(page, "Product 11");
  await setProvider(page, `const rec = ${JSON.stringify(FIXTURE(11).record)}; return Promise.resolve({ status: "ok", record: { ...rec, sku_id: Number(req.skuId) } });`);
  await reopen(page, "Product 11"); // re-open so the Load button appears now that a provider exists
  assert.equal(await page.locator("[data-cde-section]").getAttribute("data-cde-state"), "not-requested");
  assert.deepEqual(await page.evaluate(() => window.__calls), [], "nothing is requested automatically");
  await expandAndLoad(page);
  await page.waitForSelector('[data-cde-state="ok"]');
  assert.deepEqual(await page.evaluate(() => window.__calls), [{ periodStart: PERIOD, runId: "148", skuId: "11" }]);
  const sec = page.locator("[data-cde-section]");
  assert.equal(await sec.evaluate((d) => d.open), true, "stays open across repaints");
  assert.match(await sec.innerText(), /Review required/, "U11 labels with COSTING_UX_CONSISTENCY_V1");
  assert.match(await sec.innerText(), /NO_SKU_SALES_IN_LOOKBACK/);
  assert.match(await sec.innerText(), /is not evidence from this draft run/);
  await context.close();
});

test("late answer after switching SKU is discarded; the new SKU shows its own state", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await pickDraft(page);
  await openRow(page, "Product 11");
  await page.evaluate(async () => {
    const m = await import("/shared/js/costing-draft-run-evidence.js");
    window.__calls = []; window.__release = null;
    m.setDraftRunEvidenceProvider({ readSkuEvidence: (req) => { window.__calls.push(req); return new Promise((r) => { window.__release = () => r({ status: "ok", record: { period_start: req.periodStart, refresh_run_id: Number(req.runId), sku_id: Number(req.skuId), direct_labour_allocation_status: "REVIEW_REQUIRED", allocation_reason_code: "STALE_MARKER" } }); }); } });
  });
  await reopen(page, "Product 11");
  await expandAndLoad(page);
  await page.waitForSelector('[data-cde-state="loading"]');
  await reopen(page, "Product 12"); // switch SKU while loading
  await page.evaluate(() => window.__release());
  await page.waitForTimeout(300);
  assert.equal(await page.locator("[data-cde-section]").getAttribute("data-cde-state"), "not-requested", "new SKU is untouched by the old answer");
  assert.doesNotMatch(await page.locator("#drawerContent").innerText(), /STALE_MARKER/);
  await context.close();
});

test("foreign-run answer renders nothing from the record; permission-denied is shown; errors offer Retry", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await pickDraft(page);
  await openRow(page, "Product 11");
  const click = () => reopen(page, "Product 11");
  await setProvider(page, `return Promise.resolve({ status: "ok", record: { period_start: req.periodStart, refresh_run_id: 143, sku_id: Number(req.skuId), direct_labour_allocation_status: "READY", allocation_reason_code: "FOREIGN_MARKER" } });`);
  await click();
  await expandAndLoad(page);
  await page.waitForSelector('[data-cde-state="foreign-run"]');
  assert.doesNotMatch(await page.locator("#drawerContent").innerText(), /FOREIGN_MARKER/);
  await setProvider(page, `return Promise.resolve({ status: "forbidden" });`);
  await click();
  await expandAndLoad(page);
  await page.waitForSelector('[data-cde-state="forbidden"]');
  assert.match(await page.locator("[data-cde-section]").innerText(), /do not have permission/);
  await setProvider(page, `return Promise.reject(new Error("socket closed"));`);
  await reopen(page, "Product 12"); // forbidden has no retry action; use the other SKU
  await expandAndLoad(page);
  await page.waitForSelector('[data-cde-state="error"]');
  assert.match(await page.locator("[data-cde-section]").innerText(), /socket closed/);
  assert.equal(await page.locator("[data-cde-load]").innerText(), "Retry");
  await context.close();
});

test("navigation: the labour remedy opens the existing Production Route Manager in a new tab with period/product only (no draft run id); no write calls", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await pickDraft(page);
  await openRow(page, "Product 11");
  await page.locator("[data-cde-section] > summary").click();
  const popupP = context.waitForEvent("page");
  await page.locator('[data-cde-nav="direct-labour"]').click();
  const popup = await popupP;
  await popup.waitForLoadState("load");
  const u = new URL(popup.url());
  assert.match(u.pathname, /production-route-manager\.html$/);
  assert.equal(u.searchParams.get("lens"), "product-route-assignments");
  assert.equal(u.searchParams.get("product_id") ?? u.searchParams.get("productId"), "911");
  for (const [k, v] of u.searchParams) assert.ok(!/run/i.test(k) && v !== "148", `no run id in ${k}`);
  const m = await page.evaluate(() => window.__mock);
  assert.deepEqual(m.rpc.filter((c) => WRITE.test(c.name)), []);
  assert.deepEqual(m.mutations, []);
  assert.ok(m.from.every((v) => !/^costing\.|sku_direct_labour|sku_prime_cost|sku_regional/.test(v)), "no costing.* source is read by the browser");
  await context.close();
});

for (const width of [360, 1280]) {
  test(`layout at ${width}px: no horizontal page overflow and the section stays inside the drawer`, async (t) => {
    const e = await getEnv(t); if (!e) return;
    const { context, page } = await open(e, { width });
    await pickDraft(page);
    await openRow(page, "Product 11");
    await page.locator("[data-cde-section] > summary").click();
    const m = await page.evaluate(() => {
      const sec = document.querySelector("[data-cde-section]").getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, left: sec.left, right: sec.right, rows: document.querySelectorAll("[data-cde-component]").length };
    });
    assert.equal(m.rows, 5);
    assert.ok(m.sw <= m.iw + 1, `page overflow ${m.sw} > ${m.iw}`);
    assert.ok(m.left >= -1 && m.right <= m.iw + 1, `section within viewport: ${m.left}..${m.right}`);
    await context.close();
  });
}

test("close -> reopen the SAME SKU while a request is in flight: the old answer never appears; the reopened drawer is a clean session", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page, errors } = await open(e);
  await pickDraft(page);
  await openRow(page, "Product 11");
  await page.evaluate(async () => {
    const m = await import("/shared/js/costing-draft-run-evidence.js");
    window.__calls = []; window.__releases = [];
    m.setDraftRunEvidenceProvider({ readSkuEvidence: (req) => { window.__calls.push(req); const n = window.__calls.length; return new Promise((r) => { window.__releases.push(() => r({ status: "ok", record: { period_start: req.periodStart, refresh_run_id: Number(req.runId), sku_id: Number(req.skuId), direct_labour_allocation_status: "REVIEW_REQUIRED", allocation_reason_code: `SESSION_${n}_MARKER` } })); }); } });
  });
  await reopen(page, "Product 11");
  await expandAndLoad(page);
  await page.waitForSelector('[data-cde-state="loading"]');
  await closeDrawer(page);                    // close while the request is in flight
  await openRow(page, "Product 11");          // reopen the very same SKU (same period/run/sku identity)
  assert.equal(await page.locator("[data-cde-section]").getAttribute("data-cde-state"), "not-requested", "clean session");
  await page.evaluate(() => window.__releases[0]()); // the old session's answer arrives now
  await page.waitForTimeout(400);
  assert.equal(await page.locator("[data-cde-section]").getAttribute("data-cde-state"), "not-requested", "old answer discarded");
  assert.doesNotMatch(await page.locator("#drawerContent").innerText(), /SESSION_1_MARKER/);
  // a deliberate load in the new session shows only the new answer
  await expandAndLoad(page);
  await page.waitForSelector('[data-cde-state="loading"]');
  await page.evaluate(() => window.__releases[1]());
  await page.waitForSelector('[data-cde-state="ok"]');
  const text = await page.locator("#drawerContent").innerText();
  assert.match(text, /SESSION_2_MARKER/);
  assert.doesNotMatch(text, /SESSION_1_MARKER/);
  assert.equal(await page.evaluate(() => window.__calls.length), 2);
  assert.deepEqual(errors, []);
  await context.close();
});

test("close -> reopen after a resolved answer: cached evidence is not carried into the new drawer session; no automatic re-request", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await pickDraft(page);
  await openRow(page, "Product 11");
  await setProvider(page, `return Promise.resolve({ status: "ok", record: { period_start: req.periodStart, refresh_run_id: Number(req.runId), sku_id: Number(req.skuId), direct_labour_allocation_status: "REVIEW_REQUIRED", allocation_reason_code: "RESOLVED_MARKER" } });`);
  await reopen(page, "Product 11");
  await expandAndLoad(page);
  await page.waitForSelector('[data-cde-state="ok"]');
  assert.match(await page.locator("#drawerContent").innerText(), /RESOLVED_MARKER/);
  await reopen(page, "Product 11");
  assert.equal(await page.locator("[data-cde-section]").getAttribute("data-cde-state"), "not-requested");
  assert.doesNotMatch(await page.locator("#drawerContent").innerText(), /RESOLVED_MARKER/);
  assert.equal(await page.evaluate(() => window.__calls.length), 1, "no automatic re-request");
  await context.close();
});

test("switching drawer tabs inside the same open drawer keeps the in-flight session and its result", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await pickDraft(page);
  await openRow(page, "Product 11");
  await page.evaluate(async () => {
    const m = await import("/shared/js/costing-draft-run-evidence.js");
    window.__calls = []; window.__release = null;
    m.setDraftRunEvidenceProvider({ readSkuEvidence: (req) => { window.__calls.push(req); return new Promise((r) => { window.__release = () => r({ status: "ok", record: { period_start: req.periodStart, refresh_run_id: Number(req.runId), sku_id: Number(req.skuId), direct_labour_allocation_status: "REVIEW_REQUIRED", allocation_reason_code: "TAB_MARKER" } }); }); } });
  });
  await reopen(page, "Product 11");
  await expandAndLoad(page);
  await page.waitForSelector('[data-cde-state="loading"]');
  const tabs = page.locator("#drawerTabs .tab");
  if ((await tabs.count()) > 1) {
    await tabs.nth(1).click();
    await page.waitForTimeout(300);
    await tabs.nth(0).click();
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => window.__release());
  await page.waitForSelector('[data-cde-state="ok"]');
  assert.match(await page.locator("#drawerContent").innerText(), /TAB_MARKER/);
  await context.close();
});
