// Captures focused Executive Intelligence screenshots against the MIS-C1 in-page Supabase mock (synthetic data; not production).
// Usage: node scripts/mis-g7-reporting/capture-ei-screenshots.mjs <outDir>
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
const READY = { overview: ".ei-overview .kpi-card", finance: ".finance-table", sales: ".sales-table", inventory: ".inventory-table", "finished-goods": ".fg-table", production: ".pv-kpi", alerts: ".ei-alerts" };

async function shot(name, width, lens, prep, fullPage) {
  const { page, context } = await openDashboard(browser, srv.base, { width, height: width < 600 ? 800 : 900, lens, noWait: true, deviceScaleFactor: 1 });
  await page.waitForSelector(READY[lens]);
  if (lens === "production") await page.waitForSelector("#productionCounts .production-summary-card");
  if (prep) await prep(page);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: fullPage ?? width < 600 });
  await context.close();
}

for (const lens of Object.keys(READY)) for (const w of [1280, 390]) await shot(lens, w, lens);
await shot("overview", 1440, "overview"); await shot("overview", 768, "overview");
for (const lens of ["overview", "inventory", "sales"]) for (const w of [320, 375, 430, 520]) await shot(lens, w, lens);

const rollback = async (page) => {
  await page.evaluate(() => { window.__mis.handlers.v_mis_inventory_tab_summary = () => ({ data: { total_inventory_item_count: 1773 }, error: null }); });
  await page.click("#refreshBtn"); await page.waitForSelector(".ei-state-unavailable");
};
const partial = async (page) => {
  await page.evaluate(() => { const c = window.__mis.CANONICAL_INVENTORY; window.__mis.handlers.v_mis_inventory_tab_summary = () => ({ data: { ...c, canonical_pm_known_value: null, valuation_gap_item_count: 877, canonical_pm_valuation_gap_count: 877, unclassified_item_count: 3, duplicate_item_row_count: 2 }, error: null }); });
  await page.click("#refreshBtn"); await page.waitForFunction(() => /Known stock value/.test(document.querySelector("#inventoryScopeNote").textContent));
};
for (const w of [1280, 390]) { await shot("inventory-canonical-unavailable", w, "inventory", rollback); await shot("inventory-partial-coverage", w, "inventory", partial); }
const sheet = async (page) => { await page.click("#financeFilterBtn"); };
await shot("finance-filter-sheet", 390, "finance", sheet, false);
await shot("finance-filter-popover", 1280, "finance", sheet, false);

await browser.close();
srv.server.close();
console.log("screenshots written to", out);
