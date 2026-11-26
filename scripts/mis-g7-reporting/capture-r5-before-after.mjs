// R5 before/after evidence: representative lenses at 390 and 1280 against the in-page Supabase mock (SYNTHETIC fixtures; not production,
// not owner evidence). Usage: node scripts/mis-g7-reporting/capture-r5-before-after.mjs <outDir>. Not a test (never runs in CI).
import fs from "node:fs";
import { launchBrowser, openDashboard, startServer } from "../mis-c1/mis-harness.mjs";
const out = process.argv[2]; if (!out) throw new Error("usage: capture-r5-before-after.mjs <outDir>");
fs.mkdirSync(out, { recursive: true });
const chromium = launchBrowser(); const srv = await startServer(); const browser = await chromium.launch();
const ready = { overview: ".ei-overview .kpi-card", finance: ".finance-table", sales: "#salesCmp .ei-table", inventory: ".inventory-table", "finished-goods": ".fg-table", production: ".pv-kpi", alerts: ".ei-alerts .ei-table" };
const view = (v, sel) => async (page) => { await page.click(`[data-sales-view="${v}"]`); await page.waitForSelector(sel); };
const shots = [
  ["overview", "overview"], ["finance", "finance"], ["inventory", "inventory"], ["finished-goods", "finished-goods"], ["production", "production"], ["alerts", "alerts"],
  ["sales-overview", "sales"], ["sales-mtd", "sales", view("mtd", ".sales-table td")], ["sales-history", "sales", view("history", "#salesHistResults .ei-table")],
  ["sales-exceptions", "sales", view("exceptions", "#salesExcResults .ei-table")], ["sales-facility", "sales", view("facility", "#salesFac .ei-table")], ["sales-coverage", "sales", view("coverage", "#salesRefresh .ei-dl")],
];
for (const w of [390, 1280]) for (const [name, lens, prep] of shots) {
  const { page, context } = await openDashboard(browser, srv.base, { width: w, height: w < 600 ? 800 : 900, lens, noWait: true });
  await page.waitForSelector(ready[lens]);
  if (lens === "overview") await page.waitForFunction(() => [...document.querySelectorAll(".kpi-card")].every((c) => !/Loading/.test(c.textContent)));
  if (prep) await prep(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
  await context.close();
}
await browser.close(); srv.server.close();
console.log("written", out);
