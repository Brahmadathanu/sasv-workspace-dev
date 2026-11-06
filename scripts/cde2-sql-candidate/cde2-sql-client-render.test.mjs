// CDE-2 client compatibility in REAL Chromium: the real Costing Control Centre drawer + the real CDE-1b adapter + the real CDE-1a section,
// fed with the ACTUAL JSON produced by the CDE-2 SQL candidate in an isolated PostgreSQL (D3 gate opened in a throw-away copy only).
// Backend for the page is the inert in-memory stub below (no Supabase, no network, no writes). Isolated evidence, NOT authenticated production acceptance.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { startServer } from "../costing-responsive/responsive-audit.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPgBin, startCluster } from "../cde2-sql-candidate/pg-isolated.mjs";
import { realGovernedViewsSql } from "../cde2-sql-candidate/real-ddl.mjs";

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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "docs/master-data-costing/cde2-sql-candidate");
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const bin = findPgBin();
let cluster; const SQL_OUT = {};
test.before(() => {
  if (!bin) return;
  cluster = startCluster(bin); cluster.createDb("open");
  cluster.run("open", read(path.join(dir, "test/00_stub_schema.sql"))); cluster.run("open", realGovernedViewsSql(root)); cluster.run("open", read(path.join(dir, "test/01_fixtures.sql")));
  cluster.run("open", read(path.join(dir, "rpc_get_costing_draft_component_evidence_v1.candidate.sql")).replace("v_d3_decided boolean := false;", "v_d3_decided boolean := true;"));
  const q = (sku) => JSON.parse(cluster.run("open", `set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false); select public.rpc_get_costing_draft_component_evidence_v1('2026-10-01', 148, ${sku});`).out.split("\n").pop());
  SQL_OUT["11"] = q(11); SQL_OUT["12"] = q(999999);  // 11: real "ok" record; 12 is served the real denial envelope (a SKU the run does not contain)
});
test.after(() => cluster?.stop());

test("real Chromium: the real adapter + loader + drawer render the SQL's actual output (labels, no money, no notes) and the denial as an empty state", async (t) => {
  if (!bin) return t.skip("no PostgreSQL server binaries: NOT RUN (a skip is not evidence)");
  const e = await getEnv(t); if (!e) return;
  assert.equal(SQL_OUT["11"].status, "ok"); assert.deepEqual(SQL_OUT["12"], { status: "empty" });
  const { context, page, errors } = await open(e, { uxFlag: true });
  await pickDraft(page);
  await openRow(page, "Product 11");
  await page.evaluate(async (out) => {
    const m = await import("/shared/js/costing-draft-run-evidence.js"), pv = await import("/shared/js/costing-draft-run-evidence-provider.js");
    window.__rpc = [];
    m.setDraftRunEvidenceProvider(pv.createDraftRunEvidenceRpcProvider({ callRpc: async (name, args) => { window.__rpc.push({ name, args }); return { data: out[String(args.p_sku_id)], error: null }; } }));
  }, SQL_OUT);
  await reopen(page, "Product 11");
  assert.deepEqual(await page.evaluate(() => window.__rpc), [], "nothing is requested automatically");
  await expandAndLoad(page);
  await page.waitForSelector('[data-cde-state="ok"]');
  assert.deepEqual(await page.evaluate(() => window.__rpc), [{ name: "rpc_get_costing_draft_component_evidence_v1", args: { p_period_start: "2026-10-01", p_refresh_run_id: 148, p_sku_id: 11 } }]);
  const text = (await page.locator("[data-cde-section]").innerText()).replace(/\s+/g, " ");
  assert.match(text, /Review required/); assert.match(text, /No SKU sales in the lookback period|NO_SKU_SALES_IN_LOOKBACK/);
  assert.match(text, /Regional Marketing/); assert.match(text, /is not evidence from this draft run/);
  for (const leak of ["₹", "Ramesh", "Rs ", "55.50", "a@b.example", "1,20,000", "salary", "111", "222.22"]) assert.ok(!text.includes(leak), "rendered " + leak);
  await reopen(page, "Product 12");
  await expandAndLoad(page);
  await page.waitForSelector('[data-cde-state="empty"]');
  const empty = (await page.locator("[data-cde-section]").innerText()).replace(/\s+/g, " ");
  assert.match(empty, /No component evidence was returned for this SKU in run 148/);
  assert.equal((empty.match(/ Unknown /g) || []).length, 5, "all five components are Unknown on a denial: " + empty);
  assert.ok(!/Review required|Blocked|NO_SKU_SALES/i.test(empty), "no component status or reason leaks into the denial state");
  assert.deepEqual(await page.evaluate(() => window.__mockMutations ?? (window.__mock?.mutations ?? [])), [], "no write attempted");
  assert.deepEqual(errors, []);
  await context.close();
});
