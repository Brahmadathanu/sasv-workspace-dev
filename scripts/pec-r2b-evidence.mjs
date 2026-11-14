#!/usr/bin/env node
/**
 * PEC R2b evidence capture + layout measurement (fixture based, NOT owner acceptance).
 * Serves a `public` directory (default: this repo's) with the synthetic Supabase stub
 * and records, per width, screenshots plus computed card/modal metrics as JSON.
 *
 * Usage: node scripts/pec-r2b-evidence.mjs --out <dir> [--root <publicDir>]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildFixtureStub } from "./lib/pec-fixture-stub.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(arg("--root", path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public")));
const out = path.resolve(arg("--out", "pec-r2b-shots"));
fs.mkdirSync(out, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const WIDTHS = [[320, 720], [390, 800], [820, 1000], [1440, 900]];
const metrics = {};

async function open(S, vp, tab) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: buildFixtureStub(S) }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(`${base}/shared/procurement-execution-console.html`);
  await page.waitForSelector("#mainPanel", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (tab) { if (vp[0] <= 520) await page.selectOption("#procTabSelect", tab); else await page.click(`.tabs .tab-btn[data-tab="${tab}"]`); await page.waitForTimeout(700); }
  return { ctx, page };
}
const shot = async (page, w, name) => page.screenshot({ path: path.join(out, `${w}px-${name}.png`) });
const modalMetrics = (page, sel) => page.evaluate((s) => {
  const bd = document.querySelector(s); const m = bd?.querySelector(".modal"); if (!m) return null;
  const r = m.getBoundingClientRect(); const body = m.querySelector(".modal-body");
  const last = [...m.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().height > 0 && !e.closest("[hidden]")).reduce((mx, e) => Math.max(mx, e.getBoundingClientRect().bottom), 0);
  return { modalW: Math.round(r.width), modalH: Math.round(r.height), vw: innerWidth, vh: innerHeight, bodyH: body ? Math.round(body.getBoundingClientRect().height) : null, bodyScrollH: body ? body.scrollHeight : null, lastContentBottom: Math.round(last), blankBelowContent: Math.round(r.bottom - last) };
}, sel);
const cardMetrics = (page, tbody) => page.evaluate((s) => {
  const rows = [...document.querySelectorAll(`${s} > tr`)].slice(0, 8); if (!rows.length) return null;
  const hs = rows.map((r) => Math.round(r.getBoundingClientRect().height));
  return { rows: rows.length, avgH: Math.round(hs.reduce((a, b) => a + b, 0) / hs.length), hs };
}, tbody);

for (const [w, h] of WIDTHS) {
  const M = (metrics[w] = {});
  const lenses = [["pr", "#prTbody", "pr"], ["indents", "#iTbody", "indents"], ["vendor-buylist", "#vwlTbody", "vendors"], ["action", "#aqTbody", "aq"], ["excess", "#eTbody", "excess"]];
  for (const [tab, tb, nm] of lenses) {
    const { ctx, page } = await open({ role: "edit", r2: true, aq: true }, [w, h], tab);
    try {
      await shot(page, w, `${nm}-list`);
      M[`${nm}-cards`] = await cardMetrics(page, tb);
      const filterBtn = { pr: "#prFilterBtn", indents: "#iFilterBtn", "vendor-buylist": "#vwlFilterBtn", action: "#aqFilterBtn", excess: "#eFilterBtn" }[tab];
      await page.click(filterBtn); await page.waitForTimeout(350);
      await shot(page, w, `${nm}-filter`);
      M[`${nm}-filter`] = await page.evaluate(() => { const d = [...document.querySelectorAll(".pec-filter-drawer")].find((e) => e.getBoundingClientRect().width > 0); if (!d) return null; const r = d.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight }; });
      await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    } catch (e) { M[`${nm}-error`] = String(e).slice(0, 200); }
    await ctx.close();
  }
  // row-detail modals
  const details = [
    ["pr", "pr", "#prTbody tr", "#prViewModalBackdrop"],
    ["indents", "indent", "#iTbody tr", "#indentViewModalBackdrop"],
    ["vendor-buylist", "vwl-short", "#vwlTbody tr", "#vwlBreakdownModalBackdrop", {}],
    ["vendor-buylist", "vwl-long", "#vwlTbody tr", "#vwlBreakdownModalBackdrop", { vwlBdLen: 40 }],
    ["action", "aq", "#aqTbody tr", "#detailModalBackdrop"],
    ["excess", "excess-audit", null, "#eAuditModalBackdrop"],
  ];
  for (const [tab, nm, rowSel, bd, extra] of details) {
    const { ctx, page } = await open({ role: "edit", r2: true, aq: true, ...(extra || {}) }, [w, h], tab);
    try {
      if (rowSel) await page.evaluate((s) => document.querySelector(s).click(), rowSel);
      else await page.click("#eAuditBtn");
      await page.waitForTimeout(700);
      await shot(page, w, `detail-${nm}`);
      M[`detail-${nm}`] = await modalMetrics(page, bd);
    } catch (e) { M[`detail-${nm}-error`] = String(e).slice(0, 200); }
    await ctx.close();
  }
}
fs.writeFileSync(path.join(out, "metrics.json"), JSON.stringify(metrics, null, 1));
console.log("metrics ->", path.join(out, "metrics.json"));
await browser.close(); server.close();
