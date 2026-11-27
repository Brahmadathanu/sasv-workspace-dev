// R7 parity evidence (SYNTHETIC fixtures; not production, not owner acceptance). Works on any checkout:
//   node scripts/mis-g7-reporting/capture-r7-parity.mjs <outDir> [--refs]
// Captures every lens and sales sub-view at 390 and 1280; with --refs also the reference module headers for side-by-side comparison.
import fs from "node:fs";
import { launchBrowser, openDashboard, startServer } from "../mis-c1/mis-harness.mjs";
const out = process.argv[2]; if (!out) throw new Error("usage: capture-r7-parity.mjs <outDir> [--refs]");
fs.mkdirSync(out, { recursive: true });
const chromium = launchBrowser(); const srv = await startServer(); const browser = await chromium.launch();
const views = [["overview", "overview"], ["finance", "finance"], ["inventory", "inventory"], ["finished-goods", "finished-goods"], ["production", "production"], ["alerts", "alerts"], ["sales-overview", "sales"], ["sales-mtd", "sales", "mtd"], ["sales-history", "sales", "history"], ["sales-exceptions", "sales", "exceptions"], ["sales-facility", "sales", "facility"], ["sales-coverage", "sales", "coverage"]];
for (const w of [390, 1280]) for (const [name, lens, sub] of views) {
  const { page, context } = await openDashboard(browser, srv.base, { width: w, height: w < 600 ? 800 : 900, lens, noWait: true });
  await page.waitForSelector(".ei-lens, .ei-overview"); await page.waitForTimeout(500);
  if (lens === "overview") await page.waitForFunction(() => [...document.querySelectorAll(".kpi-card")].every((c) => !/Loading/.test(c.textContent)));
  if (sub) { await page.click(`[data-sales-view="${sub}"]`); await page.waitForTimeout(700); }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
  await context.close();
}
if (process.argv.includes("--refs")) {
  const STUB = "export const createClient=()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>({select:()=>Promise.resolve({data:[],error:null})}),rpc:async()=>({data:[],error:null})});";
  for (const w of [390, 1280]) for (const [n, p] of [["stock-checker", "/shared/stock-checker.html"], ["pec", "/shared/procurement-execution-console.html"], ["cost-sheet-review", "/shared/cost-sheet-review.html"], ["ei", "/shared/executive-mis-dashboard.html#finance"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 420 } }); const page = await ctx.newPage();
    await page.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith(srv.base)) return r.continue(); if (u.includes("esm.sh/@supabase/supabase-js")) return r.fulfill({ status: 200, contentType: "text/javascript", body: STUB }); return r.abort(); });
    await page.goto(srv.base + p, { waitUntil: "domcontentloaded" }).catch(() => {}); await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/ref-${n}-${w}.png` }); await ctx.close();
  }
}
await browser.close(); srv.server.close(); console.log("written", out);
