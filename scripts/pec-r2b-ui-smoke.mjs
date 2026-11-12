#!/usr/bin/env node
/**
 * PEC R2b - shared ERP design-system regression (fixture based; NOT owner acceptance).
 * Real shared PEC HTML/JS/CSS in Chromium with the synthetic Supabase stub.
 *
 * Covers: compact record cards (5 lenses + detail lists), the .pec-detail modal contract,
 * redundant loaded/total counters removed, modal search fill, Excess period gap,
 * unified filter panel (popover >=641px, full-viewport sheet <=640px: focus, trap, Escape,
 * Done/Clear, scroll lock, live server filtering), and the Vendor-wise short/long detail.
 *
 * Usage: node scripts/pec-r2b-ui-smoke.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildFixtureStub } from "./lib/pec-fixture-stub.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
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
let failures = 0, passes = 0;
const check = (ok, m) => { if (!ok) { failures++; console.error("FAIL:", m); } else { passes++; console.log("ok  :", m); } };

async function open(S, vp, tab) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: buildFixtureStub(S) }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(`${base}/shared/procurement-execution-console.html`);
  await page.waitForSelector("#mainPanel", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (tab) { if (vp.width <= 520) await page.selectOption("#procTabSelect", tab); else await page.click(`.tabs .tab-btn[data-tab="${tab}"]`); await page.waitForTimeout(700); }
  return { ctx, page, errors };
}
const W = [[320, 720], [390, 800], [820, 1000], [1440, 900]].map(([width, height]) => ({ width, height }));
const PHONES = W.filter((v) => v.width <= 640), WIDE = W.filter((v) => v.width > 640);
const rpcCount = (page) => page.evaluate(() => globalThis.__rpcCalls.length);

// ───────── 1. Compact record cards: density, hierarchy, no clipping (≤640px) ─────────
const LENSES = [["pr", "#prTbody", 95], ["indents", "#iTbody", 95], ["vendor-buylist", "#vwlTbody", 130], ["action", "#aqTbody", 110], ["excess", "#eTbody", 120]];
for (const vp of PHONES) {
  for (const [tab, tb, maxH] of LENSES) {
    const { ctx, page, errors } = await open({ role: "edit", r2: true, aq: true }, vp, tab);
    const r = await page.evaluate((s) => {
      const rows = [...document.querySelectorAll(`${s} > tr`)].slice(0, 8);
      const hs = rows.map((r) => r.getBoundingClientRect().height);
      const tr = rows[0]; const box = tr.getBoundingClientRect();
      const title = tr.querySelector('td[data-role="title"]');
      const status = tr.querySelector('td[data-role="status"]');
      const clipped = rows.flatMap((x) => [...x.querySelectorAll("td")].filter((t) => t.offsetParent && (t.scrollWidth > t.clientWidth + 1 || t.getBoundingClientRect().right > x.getBoundingClientRect().right + 1))).length;
      const t = title?.getBoundingClientRect(), st = status?.getBoundingClientRect();
      return { n: rows.length, avg: hs.reduce((a, b) => a + b, 0) / hs.length, max: Math.max(...hs), display: getComputedStyle(tr).display, hasTitle: !!title, titleBold: title ? Number(getComputedStyle(title).fontWeight) >= 600 : false, statusOnTitleLine: status ? Math.abs((st.top + st.height / 2) - (t.top + t.height / 2)) < 14 : null, clipped, ovf: document.documentElement.scrollWidth - innerWidth, kb: tr.tabIndex, fs: parseFloat(getComputedStyle(tr.querySelector("td:last-child")).fontSize) };
    }, tb);
    check(r.display === "flex" && r.hasTitle && r.titleBold, `${vp.width}px ${tab}: compact record card with a prominent identifier (title role, bold)`);
    check(r.avg <= maxH, `${vp.width}px ${tab}: card density avg ${Math.round(r.avg)}px <= ${maxH}px (R2 was 150-205px)`);
    check(r.clipped === 0 && r.ovf <= 1, `${vp.width}px ${tab}: no clipped cell, no horizontal overflow (${r.ovf}px)`);
    check(r.statusOnTitleLine !== false, `${vp.width}px ${tab}: status/band shares the primary line with the identifier`);
    check(r.fs >= 12, `${vp.width}px ${tab}: card text stays readable (${r.fs}px)`);
    if (tab !== "excess" && tab !== "vendor-buylist") check(r.kb === 0, `${vp.width}px ${tab}: row is keyboard reachable (tabindex 0)`);
    check(errors.length === 0, `${vp.width}px ${tab}: no page errors`);
    await ctx.close();
  }
}
{ // desktop keeps real tables
  const { ctx, page } = await open({ role: "edit", r2: true }, W[3], "indents");
  check(await page.evaluate(() => getComputedStyle(document.querySelector("#iTbody tr")).display === "table-row"), "1440px indents: rows remain a real table (cards only <=640px)");
  await ctx.close();
}

// ───────── 2. Row-detail modal contract ─────────
const DETAILS = [
  ["pr", "PR", "#prTbody tr", "#prViewModalBackdrop", "page", {}],
  ["indents", "Indent", "#iTbody tr", "#indentViewModalBackdrop", "page", {}],
  ["vendor-buylist", "Vendor-wise (short)", "#vwlTbody tr", "#vwlBreakdownModalBackdrop", "panel", {}],
  ["vendor-buylist", "Vendor-wise (long)", "#vwlTbody tr", "#vwlBreakdownModalBackdrop", "panel", { vwlBdLen: 40 }],
  ["action", "Action Queue", "#aqTbody tr", "#detailModalBackdrop", "panel", {}],
];
for (const vp of W) {
  for (const [tab, name, rowSel, bd, kind, extra] of DETAILS) {
    const { ctx, page } = await open({ role: "edit", r2: true, aq: true, ...extra }, vp, tab);
    await page.evaluate((s) => document.querySelector(s).click(), rowSel); await page.waitForTimeout(700);
    const m = await page.evaluate((b) => {
      const bdEl = document.querySelector(b); const mo = bdEl.querySelector(".modal"); const r = mo.getBoundingClientRect();
      const head = mo.querySelector(".modal-header"), close = head.querySelector(".modal-close-btn"), body = mo.querySelector(".modal-body"), foot = mo.querySelector(".pec-detail-foot");
      const hr = head.getBoundingClientRect(), cr = close.getBoundingClientRect(), br = body.getBoundingClientRect();
      const lastCard = [...mo.querySelectorAll("tbody tr, .detail-card")].filter((e) => e.offsetParent).pop();
      const content = [...body.children].filter((e) => e.offsetParent).reduce((mx, e) => Math.max(mx, Math.min(e.getBoundingClientRect().bottom, br.bottom)), 0);
      return { shown: bdEl.classList.contains("show"), contract: mo.classList.contains("pec-detail"), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, headFirst: hr.top - r.top < 2, closeInHead: cr.top >= hr.top - 1 && cr.bottom <= hr.bottom + 1 && cr.right <= hr.right + 1, closeSize: Math.min(cr.width, cr.height), bodyScrolls: body.scrollHeight > body.clientHeight + 1 || getComputedStyle(body).overflowY !== "visible", footBottom: foot ? Math.round(foot.getBoundingClientRect().bottom) : null, gapBelowContent: Math.round(br.bottom - content), ovf: document.documentElement.scrollWidth - innerWidth, hasLast: !!lastCard };
    }, bd);
    const tag = `${vp.width}px ${name}`;
    check(m.shown && m.contract, `${tag}: row click opens a .pec-detail modal`);
    check(m.headFirst && m.closeInHead && m.closeSize >= 32, `${tag}: header at top with Close inside it (${m.closeSize}px target)`);
    check(m.ovf <= 1, `${tag}: no horizontal page overflow`);
    if (vp.width <= 640) {
      check(m.w === m.vw, `${tag}: full viewport width (${m.w})`);
      if (kind === "page" || name === "Vendor-wise (long)" || name === "Action Queue") check(m.h >= m.vh - 1, `${tag}: fills the viewport height (${m.h}/${m.vh})`);
      if (name === "Vendor-wise (short)") check(m.h < m.vh * 0.5 && m.gapBelowContent <= 28, `${tag}: natural height - no blank lower area (modal ${m.h}/${m.vh}, gap below content ${m.gapBelowContent}px)`);
      if (name.startsWith("Vendor-wise")) check(m.footBottom !== null && Math.abs(m.footBottom - (m.h + (m.vh - m.h > 0 && name.endsWith("(short)") ? 0 : 0))) <= 2, `${tag}: docked footer (Close) sits at the modal bottom edge`);
    } else if (kind === "panel") {
      check(m.w <= m.vw - 31 && m.h <= m.vh * 0.9, `${tag}: centred panel inside the viewport (${m.w}x${m.h})`);
    } else {
      check(m.w === m.vw && m.h === m.vh, `${tag}: full-page at desktop (${m.w}x${m.h})`);
    }
    if (name === "Vendor-wise (long)") {
      const sc = await page.evaluate((b) => { const body = document.querySelector(`${b} .modal-body`); const before = body.scrollTop; body.scrollTop = 400; return { scrolled: body.scrollTop > before, overflow: body.scrollHeight > body.clientHeight }; }, bd);
      check(sc.overflow && sc.scrolled, `${tag}: 40 breakdown lines scroll inside the modal body`);
    }
    // Close: header button and Escape both work; focus is not stranded
    await page.evaluate((b) => document.querySelector(`${b} .modal-header .modal-close-btn`).click(), bd); await page.waitForTimeout(250);
    check(!(await page.evaluate((b) => document.querySelector(b).classList.contains("show"), bd)), `${tag}: header Close dismisses the modal`);
    await ctx.close();
  }
}
{ // docked footer Close + Escape (Vendor-wise, phone)
  const { ctx, page } = await open({ role: "edit" }, W[1], "vendor-buylist");
  await page.evaluate(() => document.querySelector("#vwlTbody tr").click()); await page.waitForTimeout(500);
  check(/indent line/.test(await page.textContent("#vwlBdSummary")), "390px Vendor-wise: footer summary names the indent lines and quantity");
  await page.click("#vwlBreakdownModalBackdrop .pec-detail-foot-close"); await page.waitForTimeout(250);
  check(!(await page.evaluate(() => document.getElementById("vwlBreakdownModalBackdrop").classList.contains("show"))), "390px Vendor-wise: footer Close dismisses the modal");
  await page.evaluate(() => document.querySelector("#vwlTbody tr").click()); await page.waitForTimeout(400);
  await page.keyboard.press("Escape"); await page.waitForTimeout(250);
  check(!(await page.evaluate(() => document.getElementById("vwlBreakdownModalBackdrop").classList.contains("show"))), "390px Vendor-wise: Escape dismisses the modal");
  await ctx.close();
}

// ───────── 3. Counters, search fill, filters inside the PR / Indent detail ─────────
for (const vp of [W[1], W[3]]) {
  const { ctx, page } = await open({ role: "edit", r2: true }, vp, "indents");
  await page.fill("#iSearch", "IND-26-0001"); await page.waitForTimeout(700);
  await page.click("#iTbody tr"); await page.waitForTimeout(800);
  const m = await page.evaluate(() => {
    const tool = document.querySelector("#indentViewModalBackdrop .table-toolbar");
    const probe = document.createElement("div"); probe.style.background = getComputedStyle(document.documentElement).getPropertyValue("--sasv-search-select-bg"); document.body.appendChild(probe);
    const token = getComputedStyle(probe).backgroundColor; probe.remove();
    return { counterEl: !!document.getElementById("iLinesCount"), text: tool.textContent.replace(/\s+/g, " "), bg: getComputedStyle(document.getElementById("iLineSearch")).backgroundColor, token, f: document.getElementById("iLineFilterBtn").getBoundingClientRect(), s: document.getElementById("iLineSearch").getBoundingClientRect(), foot: !!document.querySelector("#iLinesScroll .pec-feed-footer") };
  });
  check(!m.counterEl && !/\d+\s*\/\s*\d+/.test(m.text), `${vp.width}px indent detail: no loaded/total counter beside the search ("${m.text.trim()}")`);
  check(m.bg === m.token && m.bg !== "rgb(255, 255, 255)", `${vp.width}px indent detail: line search uses the semantic light fill (${m.bg})`);
  check(m.f.right <= m.s.left + 1, `${vp.width}px indent detail: filter button left of the search`);
  check(m.foot, `${vp.width}px indent detail: feed status/Load more footer retained`);
  // dark mode keeps the token fill (not a hard-coded colour)
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark")); await page.waitForTimeout(150);
  const dark = await page.evaluate(() => { const probe = document.createElement("div"); probe.style.background = getComputedStyle(document.documentElement).getPropertyValue("--sasv-search-select-bg"); document.body.appendChild(probe); const t = getComputedStyle(probe).backgroundColor; probe.remove(); return { bg: getComputedStyle(document.getElementById("iLineSearch")).backgroundColor, t }; });
  check(dark.bg === dark.t, `${vp.width}px indent detail (dark): search fill follows the dark token (${dark.bg})`);
  await ctx.close();
}
{
  const { ctx, page } = await open({ role: "edit", r2: true }, W[1], "pr");
  await page.evaluate(() => [...document.querySelectorAll("#prTbody tr")].find((r) => /active/i.test(r.textContent)).click()); await page.waitForTimeout(800);
  const m = await page.evaluate(() => ({ counterEl: !!document.getElementById("prLineRange"), text: document.querySelector("#prViewModalBackdrop .table-toolbar").textContent.replace(/\s+/g, " "), bg: getComputedStyle(document.getElementById("prLineSearch")).backgroundColor, main: getComputedStyle(document.getElementById("prSearch")).backgroundColor }));
  check(!m.counterEl && !/\d+\s*\/\s*\d+/.test(m.text), `390px PR detail: no loaded/total counter beside the search`);
  check(m.bg === m.main && m.bg !== "rgb(255, 255, 255)", `390px PR detail: line search fill equals the lens search fill (${m.bg})`);
  await ctx.close();
}

// ───────── 4. Excess Purchases: deliberate gap before the period control ─────────
for (const vp of W) {
  const { ctx, page } = await open({ role: "edit" }, vp, "excess");
  const g = await page.evaluate(() => {
    const sum = document.getElementById("eSummary"), btn = document.getElementById("eHelpBtn"), help = document.getElementById("eHelp");
    const s = sum.getBoundingClientRect(); const b = btn.offsetParent ? btn.getBoundingClientRect() : null; const h = help.offsetParent ? help.getBoundingClientRect() : null;
    const aud = document.getElementById("eAuditBtn").getBoundingClientRect();
    return { text: sum.textContent.trim(), horiz: b && Math.abs((b.top + b.height / 2) - (s.top + s.height / 2)) < 12 ? s.left - b.right : null, vert: h ? s.top - h.bottom : (b ? s.top - b.bottom : null), overlapAudit: !(s.right <= aud.left || s.left >= aud.right || s.bottom <= aud.top || s.top >= aud.bottom), inView: s.right <= innerWidth && s.left >= 0 };
  });
  check(/30 days/i.test(g.text), `${vp.width}px excess: period summary shown ("${g.text}")`);
  check((g.horiz !== null && g.horiz >= 8) || (g.vert !== null && g.vert >= 4), `${vp.width}px excess: deliberate gap before the period control (horizontal ${g.horiz}, vertical ${g.vert})`);
  check(!g.overlapAudit && g.inView, `${vp.width}px excess: period control neither overlaps Acceptance Audit nor leaves the viewport`);
  await ctx.close();
}

// ───────── 5. Unified filter panel ─────────
const FILTERS = [
  ["pr", "#prFilterBtn", "#prFilterDrawer", "#prFilterStatus", "draft", "#prFilterBadge"],
  ["indents", "#iFilterBtn", "#iFilterDrawer", "#iStatus", "approved", "#iFilterBadge"],
  ["vendor-buylist", "#vwlFilterBtn", "#vwlFilterDrawer", "#vwlRateStatusFilter", null, "#vwlFilterBadge"],
  ["action", "#aqFilterBtn", "#aqFilterDrawer", "#fBand", null, "#aqFilterBadge"],
  ["excess", "#eFilterBtn", "#eFilterPanel", "#eFDatePreset", null, "#eFilterBadge"],
];
for (const vp of [W[0], W[1], W[2], W[3]]) {
  const sheet = vp.width <= 640;
  for (const [tab, btn, drawer, sel, val, badge] of FILTERS) {
    const { ctx, page } = await open({ role: "edit", r2: true, aq: true }, vp, tab);
    const tag = `${vp.width}px ${tab} filter`;
    await page.focus(btn); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
    const o = await page.evaluate(({ btn, drawer }) => {
      const d = document.querySelector(drawer), b = document.querySelector(btn); const r = d.getBoundingClientRect();
      const names = (sel) => [...d.querySelectorAll(sel)].map((e) => e.textContent.trim());
      return { open: d.classList.contains("open"), expanded: b.getAttribute("aria-expanded"), title: d.querySelector(".pec-filter-drawer-head h3")?.textContent.trim(), close: !!d.querySelector(".pec-filter-close"), clear: names(".pec-filter-actions button"), rect: { x: r.x, y: r.y, w: r.width, h: r.height }, vw: innerWidth, vh: innerHeight, focusIn: d.contains(document.activeElement), lock: document.body.classList.contains("pec-sheet-open"), isSheet: d.classList.contains("is-sheet"), bodyScrolls: getComputedStyle(d.querySelector(".pec-filter-drawer-body")).overflowY };
    }, { btn, drawer });
    check(o.open && o.expanded === "true" && o.title && o.close && o.clear.join("|") === "Clear|Done", `${tag}: keyboard-opened; one anatomy (title "${o.title}", Close, ${o.clear.join("/")})`);
    check(o.focusIn, `${tag}: focus moves into the panel`);
    if (sheet) {
      check(o.isSheet && o.rect.x === 0 && o.rect.y === 0 && Math.round(o.rect.w) === o.vw && Math.round(o.rect.h) === o.vh && o.lock && o.bodyScrolls === "auto", `${tag}: full-viewport sheet, scrollable body, background scroll locked`);
    } else {
      check(!o.isSheet && !o.lock && o.rect.x >= 0 && o.rect.x + o.rect.w <= o.vw && o.rect.y + o.rect.h <= o.vh + 1, `${tag}: anchored popover fully inside the viewport (${Math.round(o.rect.w)}x${Math.round(o.rect.h)})`);
    }
    // live server-side filtering + badge + Clear
    const def = await page.$eval(sel, (e) => e.value);
    const target = val || await page.$eval(sel, (e, d) => [...e.options].map((o) => o.value).find((v) => v !== d), def);
    const before = await rpcCount(page);
    await page.selectOption(sel, target); await page.waitForTimeout(900);
    const after = await page.evaluate(({ badge }) => ({ n: globalThis.__rpcCalls.length, badge: document.querySelector(badge).style.display !== "none" ? document.querySelector(badge).textContent.trim() : "" }), { badge });
    check(after.n > before && /^[1-9]/.test(after.badge), `${tag}: selecting a value re-queries the server and shows badge "${after.badge}"`);
    await page.click(`${drawer} .pec-filter-clear-btn`); await page.waitForTimeout(900);
    const cleared = await page.evaluate(({ sel, badge }) => ({ v: document.querySelector(sel).value, badge: document.querySelector(badge).style.display }), { sel, badge });
    check(cleared.v === def && cleared.badge === "none", `${tag}: Clear restores the default and hides the badge`);
    // trap + Escape + focus return
    if (sheet) {
      for (let i = 0; i < 14; i++) await page.keyboard.press("Tab");
      check(await page.evaluate((drawer) => document.querySelector(drawer).contains(document.activeElement), drawer), `${tag}: Tab focus stays trapped in the sheet`);
      await page.keyboard.press("Shift+Tab");
      check(await page.evaluate((drawer) => document.querySelector(drawer).contains(document.activeElement), drawer), `${tag}: Shift+Tab focus stays trapped in the sheet`);
    }
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
    const e1 = await page.evaluate(({ btn, drawer }) => ({ open: document.querySelector(drawer).classList.contains("open"), focusBtn: document.activeElement === document.querySelector(btn), lock: document.body.classList.contains("pec-sheet-open") }), { btn, drawer });
    check(!e1.open && e1.focusBtn && !e1.lock, `${tag}: Escape closes, returns focus to the trigger, unlocks scroll`);
    await page.click(btn); await page.waitForTimeout(250);
    await page.click(`${drawer} .pec-filter-done-btn`); await page.waitForTimeout(250);
    check(!(await page.evaluate((drawer) => document.querySelector(drawer).classList.contains("open"), drawer)), `${tag}: Done closes the panel`);
    await page.click(btn); await page.waitForTimeout(250);
    await page.click(`${drawer} .pec-filter-close`); await page.waitForTimeout(200);
    check(!(await page.evaluate((drawer) => document.querySelector(drawer).classList.contains("open"), drawer)), `${tag}: header Close closes the panel`);
    await ctx.close();
  }
}
{ // nested line filters use the same panel
  for (const vp of [W[1], W[3]]) {
    const { ctx, page } = await open({ role: "edit", r2: true }, vp, "indents");
    await page.fill("#iSearch", "IND-26-0001"); await page.waitForTimeout(700);
    await page.click("#iTbody tr"); await page.waitForTimeout(800);
    await page.click("#iLineFilterBtn"); await page.waitForTimeout(300);
    const o = await page.evaluate(() => { const d = document.getElementById("iLineFilterDrawer"); return { open: d.classList.contains("open"), head: !!d.querySelector(".pec-filter-drawer-head"), btns: [...d.querySelectorAll(".pec-filter-actions button")].map((b) => b.textContent).join("|"), sheet: d.classList.contains("is-sheet"), z: Number(getComputedStyle(d).zIndex) }; });
    check(o.open && o.head && o.btns === "Clear|Done" && o.sheet === (vp.width <= 640), `${vp.width}px indent-line filter: same panel anatomy (${o.btns}), ${o.sheet ? "sheet" : "popover"}`);
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
    const still = await page.evaluate(() => ({ drawer: document.getElementById("iLineFilterDrawer").classList.contains("open"), modal: document.getElementById("indentViewModalBackdrop").classList.contains("show") }));
    check(!still.drawer, `${vp.width}px indent-line filter: Escape closes the filter first`);
    await ctx.close();
  }
}

console.log(`\npec-r2b-ui-smoke: ${passes} PASS / ${failures} FAIL`);
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
