#!/usr/bin/env node
/**
 * PEC Phase A (R1 harness, extended for R2) - client visual/responsive acceptance (fixture based).
 * Real shared PEC HTML/JS/CSS in Chromium; only js/supabaseClient.js is a
 * synthetic stub (scripts/lib/pec-fixture-stub.mjs). Produces labelled
 * screenshots + machine-checked layout invariants at 320/390/820/1440 px.
 * NOT evidence of genuine sessions, permissions or the hosted deployment.
 *
 * Usage: node scripts/pec-phase-a-visual-acceptance.mjs [--out <dir>] [--widths 320,390]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildFixtureStub } from "./lib/pec-fixture-stub.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "public");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const outDir = path.resolve(arg("--out", path.join(here, "..", "docs/procurement-execution/evidence/pec-r2-claude-visual")));
const WIDTHS = arg("--widths", "320,390,820,1440").split(",").map(Number);
const HEIGHTS = { 320: 720, 390: 800, 820: 1100, 1440: 900 };
fs.mkdirSync(outDir, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const sha = (() => { try { return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch { return "unknown"; } })();

const results = [];
const check = (id, ok, detail = "") => { results.push({ id, ok: Boolean(ok), detail }); (ok ? console.log : console.error)(`${ok ? "PASS" : "FAIL"}: ${id}${detail ? " - " + detail : ""}`); };
const browser = await chromium.launch();

async function open(S, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: buildFixtureStub(S) }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(`${base}/shared/procurement-execution-console.html`);
  await page.waitForSelector("#mainPanel", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}
const gotoLens = async (page, lens, narrow) => {
  if (narrow) await page.selectOption("#procTabSelect", lens);
  else await page.click(`.tabs .tab-btn[data-tab="${lens}"]`);
  await page.waitForTimeout(650);
};

/** Layout invariants evaluated inside the page. Returns a list of problems. */
const layoutProblems = (page, scope = "page") => page.evaluate((scope) => {
  const problems = [];
  const vw = document.documentElement.clientWidth;
  const de = document.documentElement;
  if (de.scrollWidth - de.clientWidth > 1) problems.push(`horizontal page overflow ${de.scrollWidth - de.clientWidth}px`);
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !e.closest("[hidden]") && !e.closest("[inert]"); };
  const inScroller = (e) => !!e.closest(".table-scroll, .tabs, .modal-scroll, .modal-body, .detail-rail, #iLinesScroll");
  const name = (e) => (e.id ? "#" + e.id : e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : e.tagName.toLowerCase()) + (e.textContent.trim() ? ` "${e.textContent.trim().slice(0, 24)}"` : "");
  // 1) nothing interactive/heading outside the viewport horizontally (excluding internal scrollers)
  for (const e of document.querySelectorAll("button, input, select, textarea, h1, h2, h3, .tab-btn, .pill, .pec-filter-btn, .export-dropdown button")) {
    if (!visible(e) || inScroller(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) problems.push(`outside viewport: ${name(e)} [${Math.round(r.left)}..${Math.round(r.right)}] vw=${vw}`);
  }
  // 2) clipped text (overflow hidden/clip with content wider than box), excluding deliberate ellipsis with title
  for (const e of document.querySelectorAll("button, .pill, .tab-btn, h1, h2, h3, label, th, .pec-section-note, .page-sub, .view-only-banner, .status-area")) {
    if (!visible(e)) continue;
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(cs.overflowX) && !(cs.textOverflow === "ellipsis" && (e.title || e.getAttribute("aria-label")))) problems.push(`clipped text: ${name(e)} (${e.scrollWidth}>${e.clientWidth})`);
  }
  // 3) overlapping controls (siblings in the same toolbar/actions row)
  // When an overlay (dialog or filter drawer) is open, only ITS controls are compared:
  // controls underneath a backdrop legitimately sit "behind" it.
  const overlays = [...document.querySelectorAll(".modal-backdrop.show .modal, .pec-filter-drawer.open")].filter(visible);
  const top = overlays.length ? overlays[overlays.length - 1] : null;
  const ctl = [...document.querySelectorAll("button, input:not([type=hidden]), select, textarea, a[href]")].filter((e) => visible(e) && !e.matches(".pec-input-clear, .pec-filter-badge, .sr-only") && (top ? top.contains(e) : !inScroller(e)));
  for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) {
    const a = ctl[i], b = ctl[j];
    if (a.contains(b) || b.contains(a)) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 3 && h > 3) problems.push(`overlap: ${name(a)} x ${name(b)} (${Math.round(w)}x${Math.round(h)})`);
  }
  // 4) table scrollers must scroll, not clip
  for (const t of document.querySelectorAll(".table-scroll")) {
    if (!visible(t)) continue;
    if (t.scrollWidth > t.clientWidth + 1 && !/auto|scroll/.test(getComputedStyle(t).overflowX)) problems.push(`table clipped (overflow-x ${getComputedStyle(t).overflowX})`);
  }
  // 5) dialogs fit the viewport
  for (const m of document.querySelectorAll(".modal-backdrop.show .modal, .pec-filter-drawer.open")) {
    if (!visible(m)) continue;
    const r = m.getBoundingClientRect();
    if (r.left < -1 || r.right > vw + 1) problems.push(`dialog outside viewport horizontally: ${name(m)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    if (r.height > innerHeight + 1 && !/auto|scroll/.test(getComputedStyle(m).overflowY) && ![...m.querySelectorAll(".modal-body")].some((b) => /auto|scroll/.test(getComputedStyle(b).overflowY))) problems.push(`dialog taller than viewport and not scrollable: ${name(m)}`);
  }
  return problems;
}, scope);

const shotName = (w, label) => `${w}px-${label}.png`;
const shot = async (page, w, label) => { await page.screenshot({ path: path.join(outDir, shotName(w, label)) }); return shotName(w, label); };
const verify = async (page, id, w, label) => { const p = await layoutProblems(page); check(`${id} @${w}px`, p.length === 0, p.slice(0, 4).join("; ")); await shot(page, w, label); };

const LENSES = [["pr", "01-purchase-requisitions"], ["indents", "02-purchase-indents"], ["vendor-buylist", "03-vendor-wise"], ["action", "04-action-queue"], ["excess", "05-excess-purchases"]];

for (const w of WIDTHS) {
  const vp = { width: w, height: HEIGHTS[w] || 900 };
  const narrow = w <= 520;

  // ── five lenses, editor fixture (large data) ──
  {
    const { ctx, page, errors } = await open({ role: "edit", aq: true, indentDate: true }, vp);
    check(`console renders (editor fixture) @${w}px`, await page.isVisible("#mainPanel"));
    const head = await page.evaluate(() => { const h = document.querySelector(".page-header h1"); const home = document.getElementById("homeBtn"); const r = home.getBoundingClientRect(); return { title: h.textContent.trim(), homeVisible: r.width > 0 && r.right <= innerWidth + 1, homeName: home.getAttribute("aria-label") }; });
    check(`title + HOME visible with accessible name @${w}px`, head.title === "Procurement Execution Console" && head.homeVisible && head.homeName === "HOME");
    for (const [lens, label] of LENSES) {
      await gotoLens(page, lens, narrow);
      const info = await page.evaluate(() => { const c = document.querySelector(".tab-panel.active .pec-lens-count"); const tr = document.querySelector(".tab-panel.active tbody tr"); return { count: c?.textContent.trim() || "", pagers: document.querySelectorAll("#prPaging,#iPaging,#vwlPaging,#ePaging,.pager-mini").length, row: tr ? getComputedStyle(tr).display : "", footer: !!document.querySelector(".tab-panel.active .pec-feed-footer") }; });
      check(`${lens}: exact count "${info.count}", no numbered pager, incremental footer @${w}px`, /\d/.test(info.count) && info.pagers === 0 && info.footer);
      check(`${lens}: rows render as ${w <= 640 ? "cards" : "table rows"} @${w}px`, w <= 640 ? info.row === "grid" : info.row === "table-row");
      await verify(page, `layout ${lens}`, w, label);
    }
    check(`no JS errors across five lenses @${w}px`, errors.length === 0, errors.slice(0, 2).join(" | "));

    // ── drawers / menus / dialogs (editor) ──
    await gotoLens(page, "pr", narrow);
    await page.click("#prFilterBtn"); await page.waitForTimeout(250); await verify(page, "PR filter drawer", w, "06-pr-filter-drawer"); await page.keyboard.press("Escape");
    await gotoLens(page, "indents", narrow);
    await page.click("#iFilterBtn"); await page.waitForTimeout(250); await verify(page, "Indents filter drawer", w, "07-indents-filter-drawer"); await page.keyboard.press("Escape");
    await gotoLens(page, "vendor-buylist", narrow);
    await page.click("#vwlFilterBtn"); await page.waitForTimeout(250); await verify(page, "Vendor-wise filter drawer", w, "08-vwl-filter-drawer"); await page.keyboard.press("Escape");
    await page.click("#vwlExportBtn"); await page.waitForTimeout(250); await verify(page, "Vendor-wise export menu", w, "09-vwl-export-menu"); await page.keyboard.press("Escape");
    await gotoLens(page, "excess", narrow);
    await page.click("#eFilterBtn"); await page.waitForTimeout(250); await verify(page, "Excess filter drawer", w, "10-excess-filter-drawer"); await page.keyboard.press("Escape");
    await page.click("#eAuditBtn"); await page.waitForTimeout(700); await verify(page, "Excess acceptance audit dialog", w, "11-excess-audit-dialog");
    await page.click("#btnEAuditClose"); await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector("#eTbody tr")?.click()); await page.waitForTimeout(400);
    if (await page.isVisible("#acceptExcessModalBackdrop.show")) await verify(page, "Accept-excess dialog", w, "12-excess-accept-dialog"); else check(`Accept-excess dialog opens @${w}px`, false, "did not open");
    await page.evaluate(() => document.getElementById("btnAcceptExcessClose")?.click()); await page.waitForTimeout(200);
    // indent modal + vendor selection (draft indent)
    await gotoLens(page, "indents", narrow);
    await page.evaluate(() => [...document.querySelectorAll("#iTbody tr")].find((r) => /draft/i.test(r.textContent))?.click()); await page.waitForTimeout(800);
    await verify(page, "Indent modal (draft)", w, "13-indent-modal-draft");
    await page.evaluate(() => document.querySelector("#iLinesTbody tr")?.click());
    if (await page.isVisible("#iBtnSelectVendor")) {
      await page.evaluate(() => document.getElementById("iBtnSelectVendor").click()); await page.waitForTimeout(400);
      await verify(page, "Vendor selection dialog", w, "14-vendor-selection-dialog");
      await page.evaluate(() => document.getElementById("btnVendorClose").click()); await page.waitForTimeout(200);
    } else check(`Select Vendor available on draft indent @${w}px`, false, "button hidden");
    await page.evaluate(() => document.getElementById("btnIndentViewClose").click()); await page.waitForTimeout(200);
    // Action Queue detail
    await gotoLens(page, "action", narrow);
    await page.evaluate(() => document.querySelector("#aqTbody tr")?.click()); await page.waitForTimeout(500);
    if (await page.isVisible("#detailModalBackdrop.show")) await verify(page, "Action Queue line detail", w, "15-action-queue-detail"); else check(`AQ detail opens @${w}px`, false, "did not open");
    // R2 dialogs: new-PR dialog, PR detail (expanded), Vendor-wise row detail, Excess help
    await gotoLens(page, "pr", narrow);
    await page.evaluate(() => document.getElementById("btnGeneratePr").click()); await page.waitForTimeout(350);
    await verify(page, "New PR dialog", w, "20-new-pr-dialog");
    await page.evaluate(() => document.getElementById("btnGenPrClose").click()); await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector("#prTbody tr")?.click()); await page.waitForTimeout(700);
    await page.evaluate(() => document.getElementById("prTitleToggle")?.click()); await page.waitForTimeout(150);
    await verify(page, "PR detail (secondary info expanded)", w, "21-pr-detail-expanded");
    await page.evaluate(() => document.getElementById("btnPrViewClose").click()); await page.waitForTimeout(200);
    await gotoLens(page, "vendor-buylist", narrow);
    await page.evaluate(() => document.querySelector("#vwlTbody tr")?.click()); await page.waitForTimeout(500);
    await verify(page, "Vendor-wise row detail", w, "22-vendor-wise-row-detail");
    await page.evaluate(() => document.getElementById("btnVwlBdClose").click()); await page.waitForTimeout(200);
    await gotoLens(page, "excess", narrow);
    if (narrow) { await page.evaluate(() => document.getElementById("eHelpBtn").click()); await page.waitForTimeout(150); }
    await verify(page, "Excess Purchases header", w, "23-excess-purchases-header");
    await ctx.close();
  }

  // ── error / empty / permission states ──
  for (const [S, id, label, lens, sel] of [
    [{ role: "edit", failPaged: true }, "paged-read error state", "16-error-state-indents", "indents", "td.pec-table-state.is-error"],
    [{ role: "edit", empty: true }, "empty state", "17-empty-state-indents", "indents", "td.pec-table-state.is-empty"],
  ]) {
    const { ctx, page } = await open(S, vp);
    await gotoLens(page, lens, narrow);
    check(`${id} rendered @${w}px`, (await page.locator(`#tab-${lens} ${sel}`).count()) === 1);
    await verify(page, id, w, label);
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ role: "view" }, vp);
    check(`read-only banner visible @${w}px`, await page.isVisible("#viewOnlyBanner"));
    await gotoLens(page, "indents", narrow);
    const gated = await page.evaluate(() => [...document.querySelectorAll("[data-edit-action='true']")].filter((e) => e.offsetParent !== null).every((e) => e.disabled));
    check(`all visible edit actions disabled for view-only fixture @${w}px`, gated);
    await verify(page, "view-only indents", w, "18-view-only-indents");
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ role: "none" }, vp);
    check(`no-access fixture: console panel hidden @${w}px`, !(await page.isVisible("#mainPanel")));
    await verify(page, "no-access state", w, "19-no-access-state");
    await ctx.close();
  }
}

await browser.close();
server.close();
const pass = results.filter((r) => r.ok).length, fail = results.length - pass;
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ sha, generated: new Date().toISOString(), widths: WIDTHS, pass, fail, results }, null, 2));
console.log(`\npec-phase-a-visual-acceptance: ${pass} PASS / ${fail} FAIL (${results.length} checks) @ ${sha.slice(0, 8)}`);
process.exit(fail ? 1 : 0);
