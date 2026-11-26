// Captures focused Executive Intelligence screenshots against the MIS-C1 in-page Supabase mock (synthetic fixture data; NOT production,
// NOT acceptance evidence). Usage: node scripts/mis-g7-reporting/capture-ei-screenshots.mjs <outDir>
// Not a test (no *.test.mjs suffix), so it never runs in CI and never regenerates unrelated assets.
import fs from "node:fs";
import { launchBrowser, openDashboard, startServer } from "../mis-c1/mis-harness.mjs";

const out = process.argv[2];
if (!out) throw new Error("usage: capture-ei-screenshots.mjs <outDir>");
fs.mkdirSync(out, { recursive: true });
const chromium = launchBrowser();
if (!chromium) throw new Error("Playwright chromium is not available");
const srv = await startServer();
const browser = await chromium.launch();

async function shot(name, width, lens, prep, { permission = "granted", ready, full } = {}) {
  const { page, context } = await openDashboard(browser, srv.base, { width, height: width < 600 ? 800 : 900, lens, noWait: true, permission });
  await page.waitForSelector(ready || ({ overview: ".ei-overview .kpi-card", finance: ".finance-table", sales: "#salesCmp .ei-table, #salesCmp .ei-rc", inventory: ".inventory-table", "finished-goods": ".fg-table", production: ".pv-kpi", alerts: ".ei-alerts .ei-table" }[lens]));
  if (lens === "overview") await page.waitForFunction(() => [...document.querySelectorAll(".kpi-card")].every((c) => !/Loading/.test(c.textContent)));
  if (prep) await prep(page);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: full ?? width < 600 });
  await context.close();
}
const view = (v, sel) => async (page) => { await page.click(`[data-sales-view="${v}"]`); await page.waitForSelector(sel); };

const ALL = [320, 375, 390, 430, 520, 768, 1280, 1440];
const subs = { overview: "#salesCmp .ei-table, #salesCmp .ei-rc", mtd: ".sales-table td", history: "#salesHistResults .ei-table", exceptions: "#salesExcResults .ei-table", facility: "#salesFac .ei-table", coverage: "#salesRefresh .ei-dl" };
for (const w of ALL) await shot("overview", w, "overview");
for (const w of ALL) for (const [v, sel] of Object.entries(subs)) await shot(`sales-${v}`, w, "sales", v === "overview" ? null : view(v, sel), { ready: "#salesCmp .ei-table, #salesCmp .ei-rc" });
for (const w of [1280, 390, 320]) for (const l of ["finance", "inventory", "finished-goods", "production", "alerts"]) await shot(l, w, l);
await shot("sales-history-month-grid", 1280, "sales", async (page) => { await view("history", "#salesHistResults .ei-table")(page); await page.selectOption("#salesHistGroup", "sku_month"); await page.waitForSelector("[data-hist-grid]"); await page.click("[data-hist-grid]"); await page.waitForSelector(".ei-grid"); });
await shot("sales-hierarchy-filters", 1280, "sales", async (page) => { await page.click("#salesFilterToggle"); await page.selectOption("#salesHier-category", "1"); await page.selectOption("#salesHier-subcategory", "11"); await page.selectOption("#salesHier-group", "111"); await page.waitForTimeout(300); });
for (const w of [390, 320]) await shot("sales-filter-sheet", w, "sales", async (page) => { await page.click("#salesFilterToggle"); await page.waitForTimeout(150); }, { full: false });
for (const w of [1280, 390]) await shot("sales-only", w, "sales", null, { permission: "sales-only" });
await shot("sales-only-facility", 390, "sales", view("facility", "#salesFac .ei-table"), { permission: "sales-only", ready: "#salesCmp .ei-table, #salesCmp .ei-rc" });
await shot("sales-sort-popover", 1280, "sales", async (page) => { await view("history", "#salesHistResults .ei-table")(page); await page.click("#salesSortBtn"); await page.waitForTimeout(150); });
await shot("sales-sort-sheet", 390, "sales", async (page) => { await view("history", "#salesHistResults .ei-table")(page); await page.click("#salesSortBtn"); await page.waitForTimeout(150); }, { full: false });
await shot("sales-history-toolbar", 390, "sales", view("history", "#salesHistResults .ei-table"), { full: false });
for (const w of [1280, 390, 320]) await shot("freshness-panel", w, "overview", async (page) => { await page.click("#lastRefreshed"); await page.waitForSelector("#eiFreshPanel"); }, { full: false });
await shot("freshness-panel-sales-only", 390, "sales", async (page) => { await page.click("#lastRefreshed"); await page.waitForSelector("#eiFreshPanel"); }, { permission: "sales-only", full: false });
await shot("finance-filter-popover", 1280, "finance", async (page) => { await page.click("#financeFilterBtn"); await page.waitForTimeout(150); }, { full: false });
await shot("finance-filter-sheet", 390, "finance", async (page) => { await page.click("#financeFilterBtn"); }, { full: false });
await shot("inventory-canonical-unavailable", 390, "inventory", async (page) => { await page.evaluate(() => { window.__mis.handlers.v_mis_inventory_tab_summary = () => ({ data: { total_inventory_item_count: 1773 }, error: null }); }); await page.click("#refreshBtn"); await page.waitForSelector(".ei-state-unavailable"); });
await shot("sales-facility-unavailable", 1280, "sales", async (page) => {
  await page.evaluate(() => { window.__mis.handlers.ei_facility_sales_scope = () => ({ data: null, error: { code: "42883", message: "function does not exist" } }); });
  await view("facility", "#salesFac .ei-state-unavailable")(page);
}, { ready: "#salesCmp .ei-table, #salesCmp .ei-rc" });
await shot("sales-refresh-failed", 1280, "sales", async (page) => {
  await page.evaluate(() => { const j = { status: "failed", active: true, last_started_at: "2026-11-26T01:00:00Z", last_finished_at: "2026-11-26T01:00:09Z" }; window.__mis.handlers.ei_sales_refresh_status = () => ({ data: { monthly_latest_month: "2026-11-01", monthly_source_max_inserted_at: "2026-11-25T21:45:00Z", daily_source_max_inserted_at: "2026-11-26T02:00:00Z", daily_last_date_in_month: "2026-11-25", monthly_reported_amount: 100, daily_reported_amount: 98, amount_difference: -2, refresh_job_status: "failed", refresh_job: j }, error: null }); });
  await view("coverage", "#salesRefresh .ei-dl")(page);
}, { ready: "#salesCmp .ei-table, #salesCmp .ei-rc" });
await shot("sales-contract-not-installed", 1280, "sales", async (page) => {
  await page.evaluate(() => { const f = () => ({ data: null, error: { code: "42883", message: "function does not exist" } }); Object.assign(window.__mis.handlers, { ei_sales_comparison: f, ei_sales_window_totals: f, ei_sales_dimensions: f }); });
  await page.click("#refreshBtn"); await page.waitForSelector("#salesCmp .ei-state-unavailable");
}, { ready: "#salesCmp .ei-table, #salesCmp .ei-rc" });

await browser.close();
srv.server.close();
console.log("screenshots written to", out);
