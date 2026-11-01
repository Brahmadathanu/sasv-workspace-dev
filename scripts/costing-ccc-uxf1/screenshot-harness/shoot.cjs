// Usage: node shoot.cjs <publicDir> <outDir> <port>
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const [publicDir, outDir, port] = process.argv.slice(2);
const here = __dirname;
const STUB = fs.readFileSync(path.join(here, "stub-supabase.js"), "utf8");
const FIXTURES = fs.readFileSync(path.join(here, "fixtures.js"), "utf8");
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = spawn("python3", ["-m", "http.server", port, "--bind", "127.0.0.1", "--directory", publicDir], { stdio: "ignore" });
  await sleep(800);
  const browser = await chromium.launch();
  const report = { productionAttempts: [], aborted: [], shots: {} };
  async function open({ name, width, height, flag, lens, choose148 = false, openDetails = false }) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    await ctx.addInitScript({ content: FIXTURES });
    await ctx.addInitScript({ content: flag ? 'try{localStorage.setItem("COSTING_REVIEW_WORKLIST_V1","1")}catch(e){}' : 'try{localStorage.removeItem("COSTING_REVIEW_WORKLIST_V1")}catch(e){}' });
    await ctx.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(`http://127.0.0.1:${port}/`)) return route.continue();
      if (url.startsWith("https://esm.sh/@supabase/supabase-js")) return route.fulfill({ status: 200, contentType: "application/javascript", body: STUB });
      if (url.startsWith("https://cdnjs.cloudflare.com/")) return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
      if (url.includes("qhmoqtxpeasamtlxaoak")) report.productionAttempts.push(url);
      report.aborted.push(url);
      return route.abort();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${port}/shared/costing-control-center.html${lens ? `?lens=${lens}` : ""}`);
    await sleep(2500);
    if (choose148) {
      await page.waitForSelector("#rwlRunSelect:not([disabled])", { timeout: 8000 });
      await page.selectOption("#rwlRunSelect", "148");
      await page.waitForSelector('[data-rwl-pill="selected-not-approved"], .rwl-rc-draft', { timeout: 8000 }).catch(() => {});
      await sleep(800);
    }
    if (openDetails) {
      await page.focus(".rwl-details > summary");
      await page.keyboard.press("Enter");
      await sleep(300);
    }
    const metrics = await page.evaluate(() => {
      const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; };
      return {
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        badge: box("#costingRunStatusBadge"), badgeText: document.querySelector("#costingRunStatusBadge")?.textContent || null,
        refresh: box("#refreshBtn"), exportCsv: box("#exportCsv"), home: box("#homeBtn"), snapshot: box("#lastRefreshed"),
        caption: document.querySelector("#cccKpiRunCaption")?.textContent || null,
        detailsOpen: document.querySelector(".rwl-details")?.open ?? null,
      };
    });
    const file = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    report.shots[name] = { metrics, errors: errors.slice(0, 5) };
    await ctx.close();
  }
  const scenarios = [
    { name: "dashboard-flagoff-1440", width: 1440, height: 900, flag: false },
    { name: "dashboard-flagon-1440", width: 1440, height: 900, flag: true },
    { name: "dashboard-flagon-375", width: 375, height: 812, flag: true },
    { name: "sku-148-flagon-1440", width: 1440, height: 900, flag: true, lens: "sku-control-status", choose148: true },
    { name: "sku-148-flagon-375", width: 375, height: 812, flag: true, lens: "sku-control-status", choose148: true },
    { name: "sku-148-flagon-375-details", width: 375, height: 812, flag: true, lens: "sku-control-status", choose148: true, openDetails: true },
  ];
  for (const s of scenarios) {
    try { await open(s); } catch (e) { report.shots[s.name] = { failed: String(e).slice(0, 300) }; }
  }
  await browser.close();
  server.kill();
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ productionAttempts: report.productionAttempts.length, aborted: [...new Set(report.aborted.map((u) => new URL(u).host))], shots: Object.fromEntries(Object.entries(report.shots).map(([k, v]) => [k, v.failed ? "FAILED " + v.failed : `ok scrollWidth=${v.metrics.scrollWidth}/${v.metrics.viewport} badge=${JSON.stringify(v.metrics.badgeText)} errors=${v.errors.length}`])) }, null, 2));
})();
