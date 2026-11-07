// Issue #208 regression (CLIENT LAYOUT ONLY, LOCAL evidence — not hosted/authenticated acceptance).
// Real Chromium, real sasv-costing.css from the working tree, inert fake backend (no network, no writes). The nine-column Exact Material Evidence
// table markup mirrors renderDenseMaterialEvidenceTable(); it is injected into the real #detailsModal/#drawerContent of costing-control-center.html.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as S from "./lib/selftest-support.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pub = path.join(root, "public");
let chromium = null; try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { /* skipped visibly below */ }
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const HEADS = ["Material", "Code", "Area", "Issue", "Rate", "Source", "Date", "Warning", "Trace"];
const row = (m) => `<tr><td class="cp-evidence-material">${m} packing material with a long descriptive name</td><td class="cp-evidence-code">PM-0042-LONG</td><td class="cp-evidence-area"><span>Packing</span></td><td class="cp-evidence-issue">Rate remediation needed</td><td class="cp-evidence-rate-cell c-right">12.50</td><td class="cp-evidence-source">Manual rate register</td><td class="cp-evidence-date">02 Nov 2026</td><td class="cp-evidence-warning">Rate older than policy</td><td class="cp-evidence-trace-col"><button type="button">Trace</button></td></tr>`;
const TABLE = `<div class="cp-evidence-table-scroll"><table class="cp-table cp-evidence-dense-table cp-sku-evidence-table"><thead><tr>${HEADS.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${row("A")}${row("B")}</tbody></table></div>`;

let server, origin, be;
test.before(async () => {
  be = await S.startFakeBackend();
  server = http.createServer((req, res) => {
    const f = path.join(pub, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end("nf"); }
    res.setHeader("content-type", MIME[path.extname(f)] || "application/octet-stream"); res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r)); origin = "http://127.0.0.1:" + server.address().port;
});
test.after(async () => { await be?.close(); server?.closeAllConnections?.(); await new Promise((r) => server?.close(r) ?? r()); });

async function open(browser, width) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: mobile, isMobile: mobile, serviceWorkers: "block" });
  await S.selfTestContextHook({ backendOrigin: be.origin })(ctx);
  const page = await ctx.newPage();
  await page.goto(origin + "/shared/costing-control-center.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#drawerContent", { state: "attached" }); await page.waitForTimeout(1200);
  await page.evaluate((h) => { document.getElementById("detailsModal").classList.remove("hidden"); document.getElementById("drawerContent").innerHTML = h; }, TABLE);
  return { ctx, page };
}
const metrics = (page) => page.evaluate(() => {
  const sc = document.querySelector(".cp-evidence-table-scroll"), t = sc.querySelector("table");
  return { overflowX: getComputedStyle(sc).overflowX, client: sc.clientWidth, scroll: sc.scrollWidth, left: sc.scrollLeft, tableW: t.offsetWidth, cols: t.querySelectorAll("thead th").length,
    pageOverflow: document.documentElement.scrollWidth - window.innerWidth, vw: window.innerWidth };
});

const t = (name, fn) => test(name, { skip: chromium ? false : "Playwright not installed: NOT RUN (a skip is not evidence)" }, fn);

t("#208 390px: the wrapper is the scroll container, a real touch swipe reaches the Trace column, the page does not bleed", async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] }); const { ctx, page } = await open(browser, 390);
  try {
    const m0 = await metrics(page);
    assert.equal(m0.cols, 9); assert.ok(m0.scroll > m0.client, "table is wider than the drawer: scrolling is required");
    assert.equal(m0.overflowX, "auto");
    const cdp = await ctx.newCDPSession(page); const box = await page.locator(".cp-evidence-table-scroll").boundingBox(); 
    // Real touch drags through CDP (touchStart/Move/End). Repeat until the far end so the full 9-column width is proven reachable.
    for (let i = 0; i < 6; i++) {
      const sx = box.x + box.width - 20, sy = box.y + 30;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy }] });
      for (let k = 1; k <= 12; k++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: sx - k * 25, y: sy }] }); await page.waitForTimeout(16); }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForTimeout(350);
    }
    const m1 = await metrics(page);
    assert.ok(m1.left > 0, "touch swipe moved the table");
    assert.ok(m1.left + m1.client >= m1.scroll - 1, "scrolled to the far end");
    const traceVisible = await page.evaluate(() => { const sc = document.querySelector(".cp-evidence-table-scroll").getBoundingClientRect(), th = document.querySelector(".cp-sku-evidence-table th:last-child").getBoundingClientRect(); return th.left >= sc.left - 1 && th.right <= sc.right + 1; });
    assert.ok(traceVisible, "Trace header fully inside the visible scroll area");
    assert.ok(m1.pageOverflow <= 1, "no page-level horizontal bleed");
  } finally { await ctx.close(); await browser.close(); }
});

t("#208 1280px desktop parity: all nine columns remain reachable and the page does not bleed", async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] }); const { ctx, page } = await open(browser, 1280);
  try {
    const m = await metrics(page);
    assert.equal(m.cols, 9); assert.ok(m.pageOverflow <= 1);
    await page.evaluate(() => { const sc = document.querySelector(".cp-evidence-table-scroll"); sc.scrollLeft = sc.scrollWidth; });
    const reachable = await page.evaluate(() => { const sc = document.querySelector(".cp-evidence-table-scroll").getBoundingClientRect(), th = document.querySelector(".cp-sku-evidence-table th:last-child").getBoundingClientRect(); return th.left >= sc.left - 1 && th.right <= sc.right + 1; });
    assert.ok(reachable, "Trace header reachable by scrolling the wrapper at desktop width");
  } finally { await ctx.close(); await browser.close(); }
});

test("static: the scroll wrapper rule is scoped, adds no write behaviour, and the renderer still emits the wrapper", () => {
  const css = fs.readFileSync(path.join(pub, "shared/css/sasv-costing.css"), "utf8");
  assert.match(css, /body\.sasv-costing \.cp-evidence-table-scroll\s*\{[^}]*overflow-x:\s*auto/);
  const js = fs.readFileSync(path.join(pub, "shared/js/costing-suite-control-center.js"), "utf8");
  assert.ok((js.match(/class="cp-evidence-table-scroll"/g) ?? []).length >= 1);
});
