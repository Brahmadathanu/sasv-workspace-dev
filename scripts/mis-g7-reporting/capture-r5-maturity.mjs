// R5 maturity before/after evidence (SYNTHETIC fixtures; not production, not owner evidence). Works on either checkout:
// node scripts/mis-g7-reporting/capture-r5-maturity.mjs <outDir>. Not a test.
import fs from "node:fs";
import { launchBrowser, openDashboard, startServer } from "../mis-c1/mis-harness.mjs";
const out = process.argv[2]; if (!out) throw new Error("usage: capture-r5-maturity.mjs <outDir>");
fs.mkdirSync(out, { recursive: true });
const chromium = launchBrowser(); const srv = await startServer(); const browser = await chromium.launch();
const shots = [["overview", 1280, "overview"], ["overview", 390, "overview"], ["inventory", 390, "inventory"], ["finished-goods", 390, "finished-goods"], ["sales-exceptions", 390, "sales"], ["finance", 1280, "finance"], ["production", 390, "production"]];
for (const [name, w, lens] of shots) {
  const { page, context } = await openDashboard(browser, srv.base, { width: w, height: w < 600 ? 800 : 900, lens, noWait: true });
  await page.waitForSelector(".kpi-card, .inventory-table, .fg-table, .ei-subnav, .production-summary-card, .finance-table, .ei-rc");
  if (lens === "overview") await page.waitForFunction(() => [...document.querySelectorAll(".kpi-card")].every((c) => !/Loading/.test(c.textContent)));
  if (name === "sales-exceptions") { await page.click('[data-sales-view="exceptions"]'); await page.waitForSelector("#salesExcResults .ei-table, #salesExcResults .ei-rc"); }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
  await context.close();
}
await browser.close(); srv.server.close(); console.log("written", out);
