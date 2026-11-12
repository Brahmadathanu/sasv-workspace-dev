#!/usr/bin/env node
/**
 * Fast regression for the narrow-screen defects found by the Phase A visual
 * acceptance (320px): clipped export menu, wrapped pager, crushed table cells,
 * orphaned indent-dialog header. Fixture based (synthetic stub); real shared
 * HTML/JS/CSS. Use --public <dir> to run against another checkout (e.g. the
 * pre-fix tree) and prove the checks fail there.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildFixtureStub } from "./lib/pec-fixture-stub.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const pi = process.argv.indexOf("--public");
const root = path.resolve(pi > 0 ? process.argv[pi + 1] : path.join(here, "..", "public"));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let failures = 0;
const check = (ok, m) => { if (!ok) { failures++; console.error("FAIL:", m); } else console.log("ok  :", m); };

for (const W of [320, 390]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 760 } });
  const page = await ctx.newPage();
  await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: buildFixtureStub({ role: "edit" }) }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(`${base}/shared/procurement-execution-console.html`);
  await page.waitForSelector("#mainPanel", { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.selectOption("#procTabSelect", "vendor-buylist");
  await page.waitForTimeout(800);

  // 1) export dropdown fully inside the viewport
  await page.click("#vwlExportBtn"); await page.waitForTimeout(200);
  const dd = await page.evaluate(() => { const r = document.querySelector("#vwlExportMenu .export-dropdown").getBoundingClientRect(); return { l: r.left, r: r.right, vw: document.documentElement.clientWidth }; });
  check(dd.l >= 0 && dd.r <= dd.vw, `${W}px: Vendor-wise export menu inside viewport [${Math.round(dd.l)}..${Math.round(dd.r)}] of ${dd.vw}`);
  await page.keyboard.press("Escape");

  // 2) pager stays on one line (export, count, prev, page, next share a row)
  const pager = await page.evaluate(() => { const tops = ["#vwlExportBtn", "#vwlMeta", "#vwlPrev", "#vwlPaging", "#vwlNext"].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return Math.round(r.top + r.height / 2); }); return { spread: Math.max(...tops) - Math.min(...tops) }; });
  check(pager.spread <= 6, `${W}px: pager controls on a single row (vertical spread ${pager.spread}px)`);

  // 3) table cells not crushed to single characters ("VItem 0061" stays <= 2 lines)
  const cell = await page.evaluate(() => { const td = document.querySelector("#vwlTbody tr td:nth-child(2)"); const lh = parseFloat(getComputedStyle(td).lineHeight) || 18; return { lines: Math.round(td.getBoundingClientRect().height / lh) }; });
  check(cell.lines <= 3, `${W}px: item cell wraps at word boundaries (${cell.lines} lines)`);

  // 4) indent dialog: title row is not squeezed by the action buttons
  await page.selectOption("#procTabSelect", "indents"); await page.waitForTimeout(700);
  await page.evaluate(() => [...document.querySelectorAll("#iTbody tr")].find((r) => /draft/i.test(r.textContent))?.click());
  await page.waitForTimeout(800);
  const title = await page.evaluate(() => { const t = document.getElementById("iLinesTitle"); const lh = parseFloat(getComputedStyle(t).lineHeight) || 20; return { lines: Math.round(t.getBoundingClientRect().height / lh), w: Math.round(t.getBoundingClientRect().width) }; });
  check(title.lines <= 1, `${W}px: indent dialog title on one line (${title.lines} line(s), ${title.w}px wide)`);
  await ctx.close();
}
await browser.close();
server.close();
if (failures) { console.error(`pec-phase-a-narrow-regression: ${failures} FAILED`); process.exit(1); }
console.log("pec-phase-a-narrow-regression: PASS");
