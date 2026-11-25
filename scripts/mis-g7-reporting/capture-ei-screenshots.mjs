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
  await page.waitForSelector(ready || ({ overview: ".ei-overview .kpi-card", finance: ".finance-table", sales: "#salesCmp .ei-table", inventory: ".inventory-table", "finished-goods": ".fg-table", production: ".pv-kpi", alerts: ".ei-alerts .ei-table" }[lens]));
  if (lens === "overview") await page.waitForFunction(() => [...document.querySelectorAll(".kpi-card")].every((c) => !/Loading/.test(c.textContent)));
  if (prep) await prep(page);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: full ?? width < 600 });
  await context.close();
}
const view = (v, sel) => async (page) => { await page.click(`[data-sales-view="${v}"]`); await page.waitForSelector(sel); };

for (const w of [1280, 768, 520, 390, 320]) await shot("overview", w, "overview");
for (const w of [1280, 390]) await shot("inventory", w, "inventory");
for (const w of [1280, 768, 390, 320]) await shot("sales-overview", w, "sales");
for (const w of [1280, 390]) await shot("sales-history", w, "sales", view("history", "#salesHistResults .ei-table"));
await shot("sales-history-month-grid", 1280, "sales", async (page) => { await view("history", "#salesHistResults .ei-table")(page); await page.selectOption("#salesHistGroup", "sku_month"); await page.waitForSelector("[data-hist-grid]"); await page.click("[data-hist-grid]"); await page.waitForSelector(".ei-grid"); });
await shot("sales-exceptions", 1280, "sales", view("exceptions", "#salesExcResults .ei-table"));
for (const w of [1280, 390]) await shot("sales-coverage", w, "sales", async (page) => { await view("coverage", "#salesCov .ei-table")(page); await page.waitForSelector("#salesRefresh .ei-dl"); });
await shot("sales-only-entry", 390, "sales", null, { permission: "sales-only" });
await shot("sales-only-entry", 1280, "sales", null, { permission: "sales-only" });
for (const w of [1280, 390]) await shot("alerts", w, "alerts");
await shot("production", 1280, "production");
await shot("finished-goods", 390, "finished-goods");
await shot("finance-filter-sheet", 390, "finance", async (page) => { await page.click("#financeFilterBtn"); }, { full: false });
await shot("inventory-canonical-unavailable", 390, "inventory", async (page) => { await page.evaluate(() => { window.__mis.handlers.v_mis_inventory_tab_summary = () => ({ data: { total_inventory_item_count: 1773 }, error: null }); }); await page.click("#refreshBtn"); await page.waitForSelector(".ei-state-unavailable"); });
await shot("sales-contract-not-installed", 1280, "sales", async (page) => {
  await page.evaluate(() => { const f = () => ({ data: null, error: { code: "42883", message: "function does not exist" } }); Object.assign(window.__mis.handlers, { ei_sales_comparison: f, ei_sales_window_totals: f, ei_sales_dimensions: f }); });
  await page.click("#refreshBtn"); await page.waitForSelector("#salesCmp .ei-state-unavailable");
}, { ready: "#salesCmp .ei-table" });

await browser.close();
srv.server.close();
console.log("screenshots written to", out);
