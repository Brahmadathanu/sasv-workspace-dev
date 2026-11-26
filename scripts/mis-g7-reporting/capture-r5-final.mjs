// R5 final evidence: representative lenses against the in-page Supabase mock (SYNTHETIC fixtures; not production, not owner evidence).
// Usage: node scripts/mis-g7-reporting/capture-r5-final.mjs <outDir>. Not a test (never runs in CI).
import fs from "node:fs";
import { launchBrowser, openDashboard, startServer, setHandler } from "../mis-c1/mis-harness.mjs";
const out = process.argv[2]; if (!out) throw new Error("usage: capture-r5-final.mjs <outDir>");
fs.mkdirSync(out, { recursive: true });
const chromium = launchBrowser(); const srv = await startServer(); const browser = await chromium.launch();
const ready = { overview: ".ei-overview .kpi-card", finance: "#financeChart .ei-bars", inventory: ".inventory-table", "finished-goods": ".fg-table", production: "#productionCounts .ei-subset", alerts: ".ei-alerts .ei-seg", sales: "#salesCmp .ei-bars" };
const view = (v, sel) => async (page) => { await page.click(`[data-sales-view="${v}"]`); await page.waitForSelector(sel); };
const months = (page) => setHandler(page, "ei_sales_history", () => { const mk = (m, v, r) => ({ dimension_id: "ALL", dimension_name: "All sales", month: m, sales_value: v, source_reported_amount: r ?? v, coverage: v === null ? "MISSING_OR_AMBIGUOUS_MEASURES" : "OBSERVED_NOT_CERTIFIED" }); const rows = [["2025-12-01", 9.1e6], ["2026-01-01", 10.4e6], ["2026-02-01", 9.8e6], ["2026-04-01", 11.9e6], ["2026-05-01", 12.6e6], ["2026-06-01", null, 8.2e6], ["2026-07-01", 12.1e6], ["2026-08-01", 13.3e6], ["2026-09-01", 12.8e6], ["2026-10-01", 13.26e6], ["2026-11-01", 11.32e6]].map((x) => mk(...x)); return { data: { anchor: "2026-11-24", start_date: "2025-12-01", latest_mapped_date: "2026-11-24", total: rows.length, limit: 50, offset: 0, import_completeness: "NOT_CERTIFIED", rows }, error: null }; });
const shots = [
  ["overview", "overview", [390, 1280, 320, 520]], ["finance", "finance", [390, 1280]], ["inventory", "inventory", [390, 320, 520]], ["finished-goods", "finished-goods", [390]],
  ["production", "production", [390, 1280]], ["alerts", "alerts", [390, 1280]], ["sales-overview", "sales", [390, 1280]],
  ["sales-mtd", "sales", [390], view("mtd", ".sales-table td")],
  ["sales-history", "sales", [390, 1280, 320], async (page) => { await months(page); await view("history", "#salesHistResults .ei-table")(page); await page.selectOption("#salesHistGroup", "product"); await page.selectOption("#salesHistGroup", "month"); await page.waitForSelector("#salesHistResults .ei-cols"); }],
  ["sales-exceptions", "sales", [390], view("exceptions", "#salesExcResults .ei-table")], ["sales-facility", "sales", [390, 1280], view("facility", "#salesFac .ei-bars")], ["sales-coverage", "sales", [390], view("coverage", "#salesCov .ei-table")],
];
for (const [name, lens, widths, prep] of shots) for (const w of widths) {
  const { page, context } = await openDashboard(browser, srv.base, { width: w, height: w < 600 ? 800 : 900, lens, noWait: true });
  await page.waitForSelector(ready[lens]);
  if (lens === "overview") await page.waitForFunction(() => [...document.querySelectorAll(".kpi-card")].every((c) => !/Loading/.test(c.textContent)));
  if (prep) await prep(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
  await context.close();
}
for (const w of [1280, 390]) { // HOME: MIS beside Stock Checker (same viewport), cropped to the header
  const { page, context } = await openDashboard(browser, srv.base, { width: w, height: 400, lens: "overview", noWait: true });
  await page.waitForSelector("#homeBtn svg");
  const sc = await context.newPage(); await sc.setViewportSize({ width: w, height: 400 });
  await sc.goto(`${srv.base}/shared/stock-checker.html`, { waitUntil: "domcontentloaded" }); await sc.waitForSelector("#homeBtn");
  await sc.evaluate(async () => { const m = await import("/shared/js/sasv-module-chrome.js"); m.mountModuleHome(document.getElementById("homeBtn")); });
  await page.locator("#homeBtn").screenshot({ path: `${out}/home-mis-${w}.png` }); await sc.locator("#homeBtn").screenshot({ path: `${out}/home-stock-checker-${w}.png` });
  await context.close();
}
await browser.close(); srv.server.close();
console.log("written", out);
