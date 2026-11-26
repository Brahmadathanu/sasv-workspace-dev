// Executive MIS: headline production count cards and the Production lens share ONE live pipeline response (v_mis_batch_pipeline).
// Client behaviour only (MIS-C1 in-page Supabase mock); skipped, not failed, without Playwright.
import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, openDashboard, startServer, calls } from "../mis-c1/mis-harness.mjs";

const skip = process.env.MIS_C1_SKIP_BROWSER === "1";
const chromium = skip ? null : launchBrowser();
const srv = chromium ? await startServer() : null;
const browser = chromium ? await chromium.launch() : null;
const SK = skip || !browser ? "browser unavailable" : false;
test.after(async () => { await browser?.close(); srv?.server.close(); });

const PIPE = (a, w, o) => ({ data: { active_pipeline_batch_count: a, work_in_process_batch_count: w, overdue_work_in_process_batch_count: o, finished_goods_bulk_batch_count: 7, bottled_stock_batch_count: 8, total_canonical_batch_count: 900 }, error: null });
// Snapshot (materialized view) deliberately DISAGREES with live (as in the owner screenshot): 315/92/84 snapshot vs 315/96/70 live.
const init = () => {
  const m = window.__mis; m.handlers = m.handlers || {}; m.pipe = { n: 0, mode: "ok", q: [] };
  m.snap = { mis_summary_id: 1, mv_refreshed_at: new Date(Date.now() - 6 * 3600e3).toISOString(), active_pipeline_batch_count: 315, work_in_process_batch_count: 92, overdue_work_in_process_batch_count: 84, transferred_to_finished_goods_value: 123456, planning_period_status: "CURRENT_MONTH_PLAN_AVAILABLE" };
  m.handlers.mv_mis_executive_summary = () => ({ data: m.snap, error: null });
  m.handlers.v_mis_batch_pipeline = () => {
    m.pipe.n += 1;
    if (m.pipe.mode === "fail") return { data: null, error: { message: "pipeline boom", code: "XX000" } };
    if (m.pipe.mode === "defer") { const d = m.defer(); m.pipe.q.push(d); return d.promise; }
    return { data: { active_pipeline_batch_count: 315, work_in_process_batch_count: 96, overdue_work_in_process_batch_count: 70, finished_goods_bulk_batch_count: 7, bottled_stock_batch_count: 8, total_canonical_batch_count: 900 }, error: null };
  };
};
const kpi = (page, title) => page.$$eval(".kpi-card", (cs, t) => { const c = cs.find((x) => x.querySelector(".kpi-title")?.textContent.trim() === t); return c ? c.querySelector(".kpi-value").textContent.trim() : null; }, title);
const lens = (page, title) => page.$$eval(".production-summary-card", (cs, t) => { const c = cs.find((x) => x.querySelector(".production-summary-title")?.textContent.trim() === t); return c ? c.querySelector(".production-summary-value").textContent.trim() : null; }, title);
const open = (o) => openDashboard(browser, srv.base, { init, lens: "overview", ...o });
const goOverview = async (page) => { await page.click('[data-tab="overview"]'); await page.waitForSelector(".ei-overview .kpi-card"); };
const goProduction = async (page) => { await page.click('[data-tab="production"]'); await page.waitForSelector("#productionCounts .production-summary-card"); };
const triple = (page) => Promise.all([kpi(page, "Active Pipeline Batches"), kpi(page, "Work in Process Batches"), kpi(page, "Overdue Work in Process Batches")]);
const lensTriple = (page) => Promise.all([lens(page, "Active Pipeline Batches"), lens(page, "Work in Process Batches"), lens(page, "Overdue WIP Batches")]);

test("Overview indicators equal the Production lens (live 315/96/70), not the stale snapshot (315/92/84), with exactly ONE live request", { skip: SK }, async () => {
  const { page } = await open();
  const overview = await triple(page);
  assert.deepEqual(overview, ["315", "96", "70"]);
  await goProduction(page);
  assert.deepEqual(await lensTriple(page), ["315", "96", "70"]);
  assert.deepEqual(overview, await lensTriple(page), "Overview and the Production lens show the same live response");
  assert.equal((await calls(page, "v_mis_batch_pipeline")).length, 1, "tab entry reuses the shared live response");
  assert.equal((await calls(page, "mv_mis_executive_summary")).length, 1);
  await page.click('[data-tab="finance"]'); await page.click('[data-tab="production"]'); await page.waitForSelector("#productionCounts .production-summary-card");
  assert.equal((await calls(page, "v_mis_batch_pipeline")).length, 1, "switching tabs does not duplicate the live request");
  await goOverview(page);
  assert.deepEqual(await triple(page), ["315", "96", "70"]);
  assert.equal((await calls(page, "v_mis_batch_pipeline")).length, 1, "returning to the Overview does not duplicate it either");
  await page.context().close();
});

test("freshness: snapshot age is labelled as the executive-summary snapshot; live cards say Live and are not snapshot-dated", { skip: SK }, async () => {
  const { page } = await open();
  assert.match(await page.textContent("#sc-status-detail"), /Executive summary snapshot refreshed at/); assert.match(await page.textContent("#sc-status-detail"), /Production batch counts are live/);
  const info = await page.$$eval('.kpi-card', (cs) => cs.filter((c) => /Pipeline|Work in Process/.test(c.querySelector(".kpi-title").textContent)).map((c) => decodeURIComponent(c.querySelector("[data-kpi-info]").getAttribute("data-kpi-info"))));
  assert.equal(info.length, 3); for (const i of info) { assert.match(i, /Live/); assert.doesNotMatch(i, /Production month/); }
  const fgv = await page.$$eval('.kpi-card', (cs) => cs.filter((c) => /Transferred to Finished Goods Value/.test(c.textContent)).map((c) => c.querySelector(".kpi-value").textContent.trim()));
  assert.equal(fgv.length, 1, "snapshot monetary card is preserved");
  await page.context().close();
});

test("Refresh: one new live request, both views move together; failure shows Unavailable in both (no snapshot fallback) and Retry recovers", { skip: SK }, async () => {
  const { page } = await open();
  await goProduction(page);
  await page.evaluate(() => { window.__mis.pipe.mode = "fail"; });
  await page.click("#refreshBtn");
  await page.waitForSelector("#productionCounts .pv-state.error");
  assert.match(await page.textContent("#productionCounts"), /pipeline boom/);
  await goOverview(page);
  assert.deepEqual(await triple(page), ["Unavailable", "Unavailable", "Unavailable"]);
  assert.ok(!/\b84\b|\b92\b/.test(await page.textContent("#kpiGrid")), "snapshot figures are never substituted");
  assert.equal((await calls(page, "v_mis_batch_pipeline")).length, 3, "first load, the refresh (failed), and one retry on re-entering a lens after a failure (also failed)");
  await page.evaluate(() => { window.__mis.pipe.mode = "ok"; });
  await page.click('[data-tab="production"]');                       // tab entry after a failure is itself a retry
  await page.waitForSelector("#productionCounts .production-summary-card");
  assert.equal((await calls(page, "v_mis_batch_pipeline")).length, 4);
  assert.deepEqual(await lensTriple(page), ["315", "96", "70"]);
  await goOverview(page);
  assert.deepEqual(await triple(page), ["315", "96", "70"]);
  await page.evaluate(() => { window.__mis.pipe.mode = "fail"; });
  await page.click("#refreshBtn");
  await page.click('[data-tab="production"]'); await page.waitForSelector("#productionCounts .pv-state.error");
  await page.evaluate(() => { window.__mis.pipe.mode = "ok"; });
  await page.click('[data-mis-retry="production-counts"]');
  await page.waitForSelector("#productionCounts .production-summary-card");
  assert.deepEqual(await lensTriple(page), ["315", "96", "70"]);
  await page.context().close();
});

test("latest-request-wins: a late older pipeline response never overwrites a newer one across tab switch and Refresh; tab re-entry joins the in-flight request", { skip: SK }, async () => {
  const { page } = await open();
  await page.evaluate(() => { window.__mis.pipe.mode = "defer"; });
  await page.click("#refreshBtn");                                   // request A in flight
  await page.waitForFunction(() => window.__mis.pipe.q.length === 1);
  await page.click('[data-tab="production"]');                       // joins A, no duplicate
  await page.click('[data-tab="finance"]'); await page.click('[data-tab="production"]');
  assert.equal(await page.evaluate(() => window.__mis.pipe.q.length), 1, "tab switches join the in-flight request");
  await page.click("#refreshBtn");                                   // request B supersedes A
  await page.waitForFunction(() => window.__mis.pipe.q.length === 2);
  await page.evaluate((v) => window.__mis.pipe.q[1].resolve(v), PIPE(400, 50, 5));
  await page.waitForFunction(() => /400/.test(document.getElementById("productionCounts").textContent));
  await page.evaluate((v) => window.__mis.pipe.q[0].resolve(v), PIPE(111, 1, 1));  // stale A arrives late
  await page.waitForTimeout(250);
  assert.deepEqual(await lensTriple(page), ["400", "50", "5"]);
  await goOverview(page);
  assert.deepEqual(await triple(page), ["400", "50", "5"]);
  await page.context().close();
});

test("preserved: finance/sales/inventory sources and the read-only evidence report are untouched by the pipeline change", { skip: SK }, async () => {
  const { page } = await open();
  await goProduction(page);
  assert.ok(await page.$("#productionGovernance"), "evidence report still mounted");
  assert.equal((await calls(page, "get_mis_production_value_summary")).length >= 1, true, "monetary production value source still used");
  assert.equal((await calls(page, "mv_mis_executive_summary")).length, 1);
  assert.equal((await calls(page, "v_mis_production_tab_summary")).length, 0);
  await page.context().close();
});
