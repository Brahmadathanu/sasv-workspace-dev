// #273 client: real Cost Sheet Review page + shell in Chromium against an inert in-memory backend (no Supabase, no network).
// Compares flag OFF (original view read) with flag ON (scoped RPC) at 1280 and 390 px. Flags exist only in each test
// context's own localStorage; nothing activates a production flag. Mock-data proof only: not a server or role proof.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { startServer } from "../costing-responsive/responsive-audit.mjs";
import { COMPARISON_COLUMNS, COMPARISON_VIEW, COMPARISON_SCOPED_RPC } from "../../public/shared/js/costing-cost-comparison-read.js";

const sweep = fs.readFileSync(fileURLToPath(new URL("../costing-wp12-flag-sweep/flag-sweep-browser.test.mjs", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const BASE_STUB = sweep.match(/const STUB = `([\s\S]*?)`;\n/)?.[1];
assert.ok(BASE_STUB, "base inert backend located");
const FLAG = "COSTING_CSR_SCOPED_COMPARISON_RPC_V1";

const mkRow = (i, n = 3) => Object.fromEntries(COMPARISON_COLUMNS.map((c) => [c, ({
  snapshot_period_start: "2026-11-01", product_id: i, product_name: `Product ${String(i).padStart(4, "0")}`, sku_id: i, sku_column_label: `SKU ${i}`,
  manufacturing_cop: 100 + i, previous_month_manufacturing_cop: 90 + i, manufacturing_cop_mom_change_percent: 11.1, internal_loaded_cost: 120 + i,
  previous_month_internal_loaded_cost: 110 + i, internal_loaded_cost_mom_change_percent: 9.1, profit_value_ik: 20 + i, profit_value_ik_mom_change: 2,
  profit_value_ok: 30 + i, profit_value_ok_mom_change: 3, cost_sheet_status: "COMPLETE", snapshot_selection_basis: "LATEST_SUCCESS", snapshot_refresh_run_id: 149,
  snapshot_run_label: "DRAFT run 149 - not approved", category_name: "Cat", group_name: "Grp",
})[c] ?? null]));

function stubFor(rows, rpcError) {
  return BASE_STUB.replace("export function createClient() {", "function createClientBase() {") + `
const VIEW = ${JSON.stringify(COMPARISON_VIEW)}, RPC = ${JSON.stringify(COMPARISON_SCOPED_RPC)};
const ROWS = ${JSON.stringify(rows)}; const RPC_ERROR = ${JSON.stringify(rpcError || null)};
export function createClient() {
  const c = createClientBase(); const baseFrom = c.from, baseRpc = c.rpc;
  c.from = (view) => {
    if (view !== VIEW) return baseFrom(view);
    window.__mock.from.push(view); const eq = {}; const q = {};
    q.select = () => q; q.eq = (k, v) => { eq[k] = v; return q; }; q.order = () => q;
    q.limit = (n) => { window.__mock.viewReads = (window.__mock.viewReads || []).concat([{ eq: { ...eq }, limit: n }]); return Promise.resolve({ data: ROWS, error: null }); };
    return q;
  };
  c.rpc = (name, args) => {
    if (name !== RPC) return baseRpc(name, args);
    window.__mock.rpc.push({ name, args: JSON.parse(JSON.stringify(args ?? {})) });
    if (window.__deferred) return new Promise((res) => { (window.__pending = window.__pending || {})[args.p_period_start] = res; });
    return Promise.resolve(RPC_ERROR ? { data: null, error: RPC_ERROR } : { data: ROWS, error: null });
  };
  return c;
}`;
}

let env;
async function getEnv(t) {
  if (env) return env;
  let chromium;
  try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { t.skip("playwright not available"); return null; }
  const server = await startServer();
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  env = { browser, base: `http://127.0.0.1:${server.address().port}`, close: async () => { await browser.close(); server.close(); } };
  return env;
}
test.after(async () => { await env?.close(); });

async function run(e, { flagOn, width = 1280, rows, rpcError, keepOpen = false }) {
  const context = await e.browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(([on, f, d]) => { if (on) localStorage.setItem(f, "1"); if (d) window.__deferred = true; }, [flagOn, FLAG, keepOpen]);
  const stub = stubFor(rows, rpcError);
  await context.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/esm\.sh\/@supabase\/supabase-js/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/javascript", body: stub });
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (x) => errors.push(String(x.message).slice(0, 200)));
  await page.goto(`${e.base}/shared/cost-sheet-review.html`, { waitUntil: "load" });
  await page.waitForSelector('#lensPills [data-lens="cost-comparison"], #lensSelect', { state: "attached", timeout: 15000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__mock.from.length = 0; window.__mock.rpc.length = 0; window.__mock.viewReads = []; });
  const pill = page.locator('#lensPills [data-lens="cost-comparison"]');
  if (await pill.isVisible()) await pill.click();                       // desktop path
  else await page.locator("#lensSelect").selectOption("cost-comparison"); // narrow-screen path (real user control)
  if (keepOpen) return { page, context, errors };
  await page.waitForFunction(() => document.querySelectorAll("#tableBody tr").length > 0 || /not available|permission|timed out|Failed/i.test(document.getElementById("statusArea")?.textContent || ""), null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const snap = await page.evaluate(() => ({
    bodyText: document.body.innerText,
    tbody: document.getElementById("tableBody").innerHTML.replace(/\s+/g, " ").trim(),
    rows: document.querySelectorAll("#tableBody tr").length,
    status: document.getElementById("statusArea")?.textContent?.trim() || "",
    toasts: [...document.querySelectorAll(".toast, [class*='toast']")].map((n) => n.textContent.trim()).join(" | "),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    from: window.__mock.from.slice(), rpc: window.__mock.rpc.slice(), viewReads: window.__mock.viewReads || [], mutations: window.__mock.mutations.slice(),
    scopedFlag: localStorage.getItem("COSTING_CSR_SCOPED_COMPARISON_RPC_V1"),
  }));
  await context.close();
  return { ...snap, errors };
}

const ROWS3 = [mkRow(1), mkRow(2), mkRow(3)];

for (const width of [1280, 390]) {
  test(`@${width}px flag OFF reads the original view only; flag ON reads the scoped RPC only; rendered table is identical`, async (t) => {
    const e = await getEnv(t); if (!e) return;
    const off = await run(e, { flagOn: false, width, rows: ROWS3 });
    const on = await run(e, { flagOn: true, width, rows: ROWS3 });
    assert.deepEqual(off.errors, []); assert.deepEqual(on.errors, []);
    assert.equal(off.scopedFlag, null); assert.equal(on.scopedFlag, "1");
    // OFF: original path
    assert.deepEqual(off.rpc.filter((r) => r.name === COMPARISON_SCOPED_RPC), []);
    assert.equal(off.viewReads.length, 1); assert.equal(off.viewReads[0].limit, 2000);
    assert.match(off.viewReads[0].eq.snapshot_period_start, /^\d{4}-\d{2}-01$/);
    // ON: scoped path, same period
    const scoped = on.rpc.filter((r) => r.name === COMPARISON_SCOPED_RPC);
    assert.equal(scoped.length, 1, "exactly one scoped call");
    assert.deepEqual(scoped[0].args, { p_period_start: off.viewReads[0].eq.snapshot_period_start, p_limit: 2000 });
    assert.deepEqual(on.viewReads, [], "flag ON never reads the view");
    // identical semantics: same rows rendered
    assert.equal(off.rows, 3); assert.equal(on.rows, 3);
    assert.equal(on.tbody, off.tbody, "identical rendered rows for identical data");
    assert.deepEqual(on.mutations, []); assert.deepEqual(off.mutations, []);
    assert.ok(on.overflowX <= 1, `no horizontal page overflow at ${width}px (${on.overflowX})`);
  });
}

test("flag ON with RPC not installed: clear status message, one call, no fallback to the view, no retry, no page error", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const on = await run(e, { flagOn: true, rows: ROWS3, rpcError: { code: "PGRST202", message: "Could not find the function public.rpc_get_cost_sheet_sku_monthly_comparison_scoped in the schema cache" } });
  assert.deepEqual(on.errors, []);
  assert.match(on.status, /not available on this server/);
  assert.match(on.status, /COSTING_CSR_SCOPED_COMPARISON_RPC_V1/);
  assert.equal(on.rpc.filter((r) => r.name === COMPARISON_SCOPED_RPC).length, 1);
  assert.deepEqual(on.viewReads, [], "no silent view fallback");
});

test("flag ON with a permission denial: safe message, no fallback", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const on = await run(e, { flagOn: true, rows: ROWS3, rpcError: { code: "42501", message: "permission denied for function rpc_get_cost_sheet_sku_monthly_comparison_scoped" } });
  assert.match(on.status, /do not have permission/);
  assert.doesNotMatch(on.status, /rpc_get_cost_sheet/);
  assert.deepEqual(on.viewReads, []);
});

test("flag ON with exactly 2000 rows shows a visible truncation warning", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const many = Array.from({ length: 2000 }, (_, i) => mkRow(i + 1));
  const on = await run(e, { flagOn: true, rows: many });
  assert.deepEqual(on.errors, []);
  assert.match(on.toasts, /2000-row limit/);
});

const SENSITIVE = 'relation "costing.cost_sheet_line_monthly_snapshot" column "salary_x" failed; query: SELECT secret FROM auth.users; role postgres; password=hunter2';
const LEAKS = ["costing.cost_sheet", "salary_x", "auth.users", "postgres", "hunter2", "SELECT secret"];

for (const [label, err] of [
  ["unknown code XX000 with sensitive message", { code: "XX000", message: SENSITIVE, details: SENSITIVE, hint: SENSITIVE }],
  ["P0001 with sensitive message", { code: "P0001", message: SENSITIVE }],
  ["no code, sensitive details only", { details: SENSITIVE }],
]) {
  test(`unknown server error (${label}) is never rendered: generic status and toast, one call, no view fallback`, async (t) => {
    const e = await getEnv(t); if (!e) return;
    const on = await run(e, { flagOn: true, rows: ROWS3, rpcError: err });
    assert.deepEqual(on.errors, []);
    assert.match(on.status, /The cost comparison could not be loaded/);
    for (const l of LEAKS) { assert.ok(!on.status.includes(l), `status leaked ${l}`); assert.ok(!on.toasts.includes(l), `toast leaked ${l}`); assert.ok(!on.bodyText.includes(l), `page text leaked ${l}`); }
    assert.equal(on.rpc.filter((r) => r.name === COMPARISON_SCOPED_RPC).length, 1);
    assert.deepEqual(on.viewReads, []);
  });
}

test("a missing-columns result shows a generic message without schema column names", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const partial = ROWS3.map((r) => { const c = { ...r }; delete c.snapshot_run_label; delete c.previous_year_selection_basis; return c; });
  const on = await run(e, { flagOn: true, rows: partial });
  assert.match(on.status, /did not match the expected format/);
  assert.ok(!/snapshot_run_label|previous_year_selection_basis/.test(on.status + on.toasts + on.bodyText));
  assert.equal(on.rows, 0, "partial data is not rendered");
});

test("stale response: a late reply for the previous period never overwrites the newly selected period", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { page, context, errors } = await run(e, { flagOn: true, rows: ROWS3, keepOpen: true });
  const rowsFor = (label) => [mkRow(1), mkRow(2)].map((r) => ({ ...r, product_name: label }));
  await page.waitForFunction(() => window.__pending && window.__pending["2026-11-01"], null, { timeout: 15000 }); // load A (Nov) in flight
  await page.evaluate(() => { // change the active period through the real control while A is still pending
    const s = document.getElementById("costingPeriodSelect");
    s.insertAdjacentHTML("afterbegin", '<option value="2026-10-01">Oct 2026</option>');
    s.value = "2026-10-01"; s.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => window.__pending["2026-10-01"], null, { timeout: 15000 });  // load B (Oct) in flight
  await page.evaluate((rows) => window.__pending["2026-10-01"]({ data: rows, error: null }), rowsFor("OCT-ROW"));
  await page.waitForFunction(() => /OCT-ROW/.test(document.getElementById("tableBody").innerText), null, { timeout: 15000 });
  await page.evaluate((rows) => window.__pending["2026-11-01"]({ data: rows, error: null }), rowsFor("NOV-STALE-ROW")); // stale reply arrives last
  await page.waitForTimeout(500);
  const text = await page.evaluate(() => document.getElementById("tableBody").innerText);
  assert.match(text, /OCT-ROW/); assert.doesNotMatch(text, /NOV-STALE-ROW/, "stale period must not be displayed");
  const calls = await page.evaluate(() => window.__mock.rpc.map((r) => r.args.p_period_start));
  assert.deepEqual(calls, ["2026-11-01", "2026-10-01"], "exactly one call per load, no duplicates or retries");
  assert.deepEqual(errors, []);
  await context.close();
});

for (const width of [1280, 390]) {
  test(`@${width}px exactly 2000 rows: warning is a persistent status line and a toast; 1999 rows show neither`, async (t) => {
    const e = await getEnv(t); if (!e) return;
    const many = (n) => Array.from({ length: n }, (_, i) => mkRow(i + 1));
    const full = await run(e, { flagOn: true, width, rows: many(2000) });
    assert.match(full.status, /2000-row limit/); assert.match(full.toasts, /2000-row limit/);
    const under = await run(e, { flagOn: true, width, rows: many(1999) });
    assert.doesNotMatch(under.status, /2000-row limit/); assert.doesNotMatch(under.toasts, /2000-row limit/);
  });
}
