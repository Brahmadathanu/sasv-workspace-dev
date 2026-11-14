#!/usr/bin/env node
/**
 * PEC R2c regression (fixture based; NOT owner acceptance, NOT a genuine-session test).
 *   1. Vendor-wise (and Audit) row detail: full-screen phone detail, no footer / bottom total / bottom Close.
 *   2. Filter sheets: one compact typographic scale in every drawer, focus never lands on a
 *      native <select>/<input> when a sheet opens (iOS opens a focused select picker at once).
 *   3. Action Queue -> Excess race: deterministic overlap / stale / abort / error scenarios with
 *      latest-wins, no stuck mask, honest error state with sanitized diagnostics and bounded retry.
 * Usage: node scripts/pec-r2c-ui-smoke.mjs
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
const AQ = "proc_procurement_action_queue_paged", EX = "proc_pec_purchase_excess_filtered_paged";

async function goTab(page, vp, tab) {
  if (vp.width <= 520) await page.selectOption("#procTabSelect", tab); else await page.click(`.tabs .tab-btn[data-tab="${tab}"]`);
}
async function open(S, vp, tab) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errors = [], logs = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => logs.push(m.text()));
  await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: buildFixtureStub(S) }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(`${base}/shared/procurement-execution-console.html`);
  await page.waitForSelector("#mainPanel", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (tab) { await goTab(page, vp, tab); await page.waitForTimeout(700); }
  return { ctx, page, errors, logs };
}
const W = [[320, 720], [390, 800], [820, 1000], [1440, 900]].map(([width, height]) => ({ width, height }));
const PHONES = W.filter((v) => v.width <= 640);
const calls = (page, n) => page.evaluate((x) => globalThis.__rpcCalls.filter((c) => c.name === x).map((c) => ({ q: c.params.p_q ?? null, off: c.params.p_offset ?? 0, aborted: !!c.aborted, failed: !!c.failed })), n);
const excessState = (page) => page.evaluate(() => ({
  rows: document.querySelectorAll("#eTbody tr:not(.pec-table-state-row)").length,
  stateRow: document.querySelector("#eTbody .pec-table-state-row")?.textContent.replace(/\s+/g, " ").trim() || "",
  busy: document.getElementById("tab-excess").getAttribute("aria-busy"),
  mask: !!document.querySelector("#tab-excess .table-loading-mask"),
  active: document.getElementById("tab-excess").classList.contains("active"),
  search: document.getElementById("eSearch").value,
  count: document.getElementById("eMeta").textContent.trim(),
}));

// ───────── 1. Vendor-wise / Audit: full-screen detail without footer ─────────
for (const vp of W) {
  for (const [label, extra] of [["short", {}], ["long", { vwlBdLen: 40 }]]) {
    const { ctx, page } = await open({ role: "edit", ...extra }, vp, "vendor-buylist");
    await page.evaluate(() => document.querySelector("#vwlTbody tr").click()); await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const bd = document.getElementById("vwlBreakdownModalBackdrop"), mo = bd.querySelector(".modal"), r = mo.getBoundingClientRect(), body = mo.querySelector(".modal-body");
      const cards = [...mo.querySelectorAll("#vwlBdTbody tr")].filter((e) => e.offsetParent);
      const bg = getComputedStyle(body).backgroundColor, surf = getComputedStyle(mo).backgroundColor;
      const behind = document.elementFromPoint(innerWidth / 2, innerHeight - 4);
      return { shown: bd.classList.contains("show"), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, footer: !!mo.querySelector(".pec-detail-foot, [data-pec-close]"), summary: !!document.getElementById("vwlBdSummary"), closeBtns: mo.querySelectorAll(".modal-close-btn").length, sub: document.getElementById("vwlBdSub").textContent, rows: cards.length, bg, surf, listVisibleBehind: !!behind && !bd.contains(behind), scrolls: body.scrollHeight > body.clientHeight, callout: !!document.getElementById("vwlBdSplitCallout"), ovf: document.documentElement.scrollWidth - innerWidth };
    });
    const tag = `${vp.width}px Vendor-wise ${label}`;
    check(m.shown && !m.footer && !m.summary, `${tag}: no footer, no bottom total, no bottom Close`);
    check(m.closeBtns === 1, `${tag}: exactly one Close (header x)`);
    check(/Total Qty to Buy/.test(m.sub) && m.rows === (label === "long" ? 40 : 1) && m.callout, `${tag}: purchasing quantity ("${m.sub}"), ${m.rows} line card(s) and split-notice slot retained`);
    if (vp.width <= 640) {
      check(m.w === m.vw && m.h === m.vh, `${tag}: full-screen (${m.w}x${m.h})`);
      check(!m.listVisibleBehind, `${tag}: no dimmed list visible below the detail`);
      check(m.bg !== "rgb(255, 255, 255)" && m.bg !== m.surf, `${tag}: body is an intentional neutral canvas (${m.bg})`);
      if (label === "long") check(m.scrolls, `${tag}: 40 lines scroll inside the body`);
    } else {
      check(m.h < m.vh && m.w < m.vw, `${tag}: centred panel on larger screens (${m.w}x${m.h})`);
    }
    check(m.ovf <= 1, `${tag}: no horizontal overflow`);
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
    check(!(await page.evaluate(() => document.getElementById("vwlBreakdownModalBackdrop").classList.contains("show"))), `${tag}: Escape closes`);
    await ctx.close();
  }
}
{
  const { ctx, page } = await open({ role: "edit" }, W[1], "excess");
  await page.click("#eAuditBtn"); await page.waitForTimeout(700);
  const a = await page.evaluate(() => ({ foot: !!document.querySelector("#eAuditModalBackdrop .pec-detail-foot"), closeBtns: document.querySelectorAll("#eAuditModalBackdrop .modal-close-btn").length, h: document.querySelector("#eAuditModalBackdrop .modal").getBoundingClientRect().height, vh: innerHeight }));
  check(!a.foot && a.closeBtns === 1 && Math.round(a.h) === a.vh, "390px Acceptance Audit: full screen, header Close only (no footer)");
  await ctx.close();
}

// ───────── 2. Filter sheets: compact scale + safe focus ─────────
const FILTERS = [
  ["pr", "#prFilterBtn", "#prFilterDrawer"], ["indents", "#iFilterBtn", "#iFilterDrawer"], ["vendor-buylist", "#vwlFilterBtn", "#vwlFilterDrawer"],
  ["action", "#aqFilterBtn", "#aqFilterDrawer"], ["excess", "#eFilterBtn", "#eFilterPanel"],
];
const metricsOf = (page, drawer) => page.evaluate((sel) => {
  const d = document.querySelector(sel); const px = (e, k) => parseFloat(getComputedStyle(e)[k]);
  const ctl = [...d.querySelectorAll(".pec-filter-select, .pec-filter-input")].filter((e) => e.offsetParent);
  const labels = [...d.querySelectorAll(".pec-filter-label, .pec-filter-section-title, .pec-filter-section > label:not(.pec-filter-check)")].filter((e) => e.offsetParent);
  const checks = [...d.querySelectorAll(".pec-filter-check")].filter((e) => e.offsetParent);
  const ae = document.activeElement;
  const uniq = (a) => [...new Set(a)];
  return { controlFonts: uniq(ctl.map((e) => px(e, "fontSize"))), controlH: uniq(ctl.map((e) => Math.round(e.getBoundingClientRect().height))), labelFonts: uniq(labels.map((e) => px(e, "fontSize"))), labelUpper: labels.some((e) => getComputedStyle(e).textTransform === "uppercase"), checkFonts: uniq(checks.map((e) => px(e, "fontSize"))), n: ctl.length, activeTag: ae?.tagName, activeInDrawer: d.contains(ae), activeIsFormControl: ["SELECT", "INPUT", "TEXTAREA"].includes(ae?.tagName), headingFocused: ae === d.querySelector(".pec-filter-drawer-head h3"), titleFont: px(d.querySelector(".pec-filter-drawer-head h3"), "fontSize") };
}, drawer);
const focusOn = (page, btn) => page.evaluate((b) => document.activeElement === document.querySelector(b), btn);
for (const vp of W) {
  const sheet = vp.width <= 640;
  const seen = [];
  for (const [tab, btn, drawer] of FILTERS) {
    const { ctx, page } = await open({ role: "edit", r2: true, aq: true }, vp, tab);
    await page.click(btn); await page.waitForTimeout(300);
    const m = await metricsOf(page, drawer); seen.push(m);
    const tag = `${vp.width}px ${tab} filter`;
    if (sheet) {
      check(m.controlFonts.length === 1 && m.controlFonts[0] === 16 && m.n > 0, `${tag}: controls 16px (iOS no-zoom floor), one size (${m.controlFonts})`);
      check(m.controlH.length === 1 && m.controlH[0] <= 38, `${tag}: compact control height ${m.controlH}px`);
      check(!m.activeIsFormControl && m.activeInDrawer && m.headingFocused, `${tag}: opening the sheet focuses the heading, not a data control (${m.activeTag})`);
    } else {
      check(m.controlFonts.length === 1 && m.controlFonts[0] === 13, `${tag}: popover controls 13px (${m.controlFonts})`);
    }
    check(m.labelFonts.length === 1 && m.labelFonts[0] === 12 && !m.labelUpper, `${tag}: labels one size 12px, no legacy uppercase (${m.labelFonts})`);
    if (m.checkFonts.length) check(m.checkFonts.length === 1 && m.checkFonts[0] === 13, `${tag}: checkbox label 13px`);
    if (sheet) {
      await page.keyboard.press("Shift+Tab");
      check(await page.evaluate((d) => document.querySelector(d).contains(document.activeElement), drawer), `${tag}: Shift+Tab from the heading stays inside the sheet`);
    }
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
    check(await focusOn(page, btn), `${tag}: Escape returns focus to the trigger`);
    await page.click(btn); await page.waitForTimeout(250);
    await page.click(`${drawer} .pec-filter-done-btn`); await page.waitForTimeout(200);
    check(await focusOn(page, btn), `${tag}: Done returns focus to the trigger`);
    await page.click(btn); await page.waitForTimeout(250);
    await page.click(`${drawer} .pec-filter-close`); await page.waitForTimeout(200);
    check(await focusOn(page, btn), `${tag}: Close returns focus to the trigger`);
    if (sheet) check(!(await page.evaluate(() => document.body.classList.contains("pec-sheet-open"))), `${tag}: background scroll lock released`);
    await ctx.close();
  }
  if (sheet) {
    const f = new Set(seen.flatMap((s) => s.controlFonts)), l = new Set(seen.flatMap((s) => s.labelFonts)), t = new Set(seen.map((s) => s.titleFont));
    check(f.size === 1 && l.size === 1 && t.size === 1, `${vp.width}px all five lens sheets share one scale (controls ${[...f]}, labels ${[...l]}, title ${[...t]})`);
  }
}
for (const vp of PHONES) { // nested PR / Indent line filters
  for (const [tab, btn, drawer, find] of [["indents", "#iLineFilterBtn", "#iLineFilterDrawer", "IND-26-0001"], ["pr", "#prLineFilterBtn", "#prLineFilterDrawer", null]]) {
    const { ctx, page } = await open({ role: "edit", r2: true }, vp, tab);
    if (find) { await page.fill("#iSearch", find); await page.waitForTimeout(700); await page.click("#iTbody tr"); }
    else await page.evaluate(() => [...document.querySelectorAll("#prTbody tr")].find((r) => /active/i.test(r.textContent)).click());
    await page.waitForTimeout(800);
    await page.click(btn); await page.waitForTimeout(300);
    const m = await metricsOf(page, drawer);
    const tag = `${vp.width}px nested ${tab} line filter`;
    check(m.controlFonts.join() === "16" && m.labelFonts.join() === "12" && m.n > 0, `${tag}: same scale as the lens sheets (controls ${m.controlFonts}, labels ${m.labelFonts})`);
    check(!m.activeIsFormControl && m.headingFocused, `${tag}: no select focused on open (${m.activeTag})`);
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
    check(await focusOn(page, btn), `${tag}: Escape returns focus to the trigger`);
    await ctx.close();
  }
}

// ───────── 3. Action Queue -> Excess race ─────────
const RACE = { role: "edit", r2: true, aq: true, aqRows: 200 };
for (const vp of [W[1], W[3]]) {
  const tag = `${vp.width}px`;
  { // (a) the owner's sequence: type, clear while the reload is pending, switch to Excess at once
    const { ctx, page, errors } = await open({ ...RACE, delay: { [AQ]: 700 } }, vp, "action");
    await page.fill("#fSearch", "abc"); await page.waitForTimeout(650); // debounce (500ms) fired: the "abc" request is now pending
    await page.click("#fSearchClear");
    await goTab(page, vp, "excess");
    await page.waitForTimeout(2200);
    const x = await excessState(page);
    check(x.active && x.rows > 0 && !/could not be loaded|Change the search/.test(x.stateRow) && !x.mask && x.busy === "false" && x.search === "", `${tag} AQ type-clear-Excess: Excess loads independently (${x.rows} rows, ${x.count}), no error, no stuck mask`);
    const exc = await calls(page, EX), aqc = await calls(page, AQ);
    check(exc.length === 1 && exc[0].off === 0 && !exc[0].aborted, `${tag} AQ type-clear-Excess: exactly one Excess request, not aborted by the AQ activity`);
    check(aqc.some((c) => c.q === "abc") && aqc.at(-1).q === null, `${tag} AQ type-clear-Excess: AQ latest-wins (last AQ request is the cleared search)`);
    check(await page.evaluate(() => !document.getElementById("tab-action").classList.contains("active") && document.getElementById("tab-action").getAttribute("aria-busy") === "false"), `${tag} AQ type-clear-Excess: stale AQ response did not touch the active tab or leave AQ busy`);
    check(errors.length === 0, `${tag} AQ type-clear-Excess: no page errors`);
    await ctx.close();
  }
  { // (b) rapid tab switching with overlapping slow requests
    const { ctx, page } = await open({ ...RACE, delay: { [AQ]: 500, [EX]: 400 } }, vp, "action");
    for (let i = 0; i < 6; i++) { await goTab(page, vp, "excess"); await page.waitForTimeout(60); await goTab(page, vp, "action"); await page.waitForTimeout(60); }
    await goTab(page, vp, "excess"); await page.waitForTimeout(2500);
    const x = await excessState(page), exc = await calls(page, EX);
    check(x.active && x.rows > 0 && !x.mask && x.busy === "false" && !/could not be loaded/.test(x.stateRow), `${tag} rapid AQ/Excess switching: Excess settles loaded (${x.rows} rows), no stuck mask`);
    check(exc.length >= 2 && exc.slice(0, -1).every((c) => c.aborted) && !exc.at(-1).aborted, `${tag} rapid switching: ${exc.length} Excess requests, every superseded one aborted, the last completed`);
    await ctx.close();
  }
  { // (c) stale slow Excess response must not overwrite a newer search
    const { ctx, page } = await open({ ...RACE, delayQ: { [EX]: { "": 900, widget: 100 } } }, vp, "action");
    await goTab(page, vp, "excess"); await page.waitForTimeout(150);
    await page.fill("#eSearch", "widget"); await page.waitForTimeout(2200);
    const x = await excessState(page), exc = await calls(page, EX);
    check(exc.some((c) => c.q === null && c.aborted) && x.search === "widget" && !x.mask && x.busy === "false", `${tag} stale Excess response (slow, superseded by a search) is aborted and dropped; no stuck mask`);
    await ctx.close();
  }
  { // (d) one transient network failure: bounded automatic retry recovers silently
    const { ctx, page } = await open({ ...RACE, fail: { [EX]: { times: 1, error: { message: "TypeError: Failed to fetch" }, status: 0 } } }, vp, "action");
    await goTab(page, vp, "excess"); await page.waitForTimeout(2200);
    const x = await excessState(page), exc = await calls(page, EX);
    check(x.rows > 0 && !/could not be loaded/.test(x.stateRow) && exc.length === 2 && exc[0].failed, `${tag} one transient network failure: one automatic retry recovers (${exc.length} requests), no error shown`);
    await ctx.close();
  }
  { // (e) persistent server failure: honest message, diagnostics, bounded attempts, Retry works
    const secret = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk";
    const { ctx, page, logs } = await open({ ...RACE, fail: { [EX]: { times: 2, error: { message: "canceling statement due to statement timeout " + secret, code: "57014" }, status: 503 } } }, vp, "action");
    await goTab(page, vp, "excess"); await page.waitForTimeout(2800);
    const x = await excessState(page), exc = await calls(page, EX);
    const diag = await page.evaluate(() => document.querySelector("#eTbody [data-pec-diag]")?.textContent || "");
    check(exc.length === 2, `${tag} persistent failure: bounded to 2 requests (1 + 1 automatic retry), got ${exc.length}`);
    check(/server did not complete/.test(x.stateRow) && !/Change the search or filters/.test(x.stateRow), `${tag} persistent failure: says the server failed, does not blame search/filters ("${x.stateRow.slice(0, 90)}")`);
    check(diag.includes(EX) && diag.includes("HTTP 503") && diag.includes("code 57014") && /req pec-/.test(diag) && /2 attempts/.test(diag), `${tag} persistent failure: diagnostics show RPC, status, code, request id, attempts ("${diag}")`);
    check(!diag.includes("eyJ") && !(await page.evaluate(() => document.body.innerText)).includes("eyJhbGci") && !logs.join("\n").includes("eyJhbGci"), `${tag} persistent failure: credentials never appear in the UI or console`);
    check(!x.mask && x.busy === "false", `${tag} persistent failure: no stuck loading mask`);
    await page.click("#eTbody .pec-error-retry"); await page.waitForTimeout(1200);
    const y = await excessState(page);
    check(y.rows > 0 && !/could not be loaded/.test(y.stateRow), `${tag} persistent failure: Retry loads the list (${y.rows} rows)`);
    await ctx.close();
  }
  { // (f) auth failure is not retried blindly and says "session"
    const { ctx, page } = await open({ ...RACE, fail: { [EX]: { times: 3, error: { message: "JWT expired", code: "PGRST301" }, status: 401 } } }, vp, "action");
    await goTab(page, vp, "excess"); await page.waitForTimeout(1800);
    const x = await excessState(page), exc = await calls(page, EX);
    check(exc.length === 1 && /session problem/.test(x.stateRow), `${tag} auth failure (401): single request, session message ("${x.stateRow.slice(0, 70)}")`);
    await ctx.close();
  }
  { // (g) AQ failure is classified too and does not break Excess
    const { ctx, page } = await open({ ...RACE, fail: { [AQ]: { times: 1, error: { message: "boom", code: "XX000" }, status: 500 } } }, vp, "action");
    await page.waitForTimeout(900);
    const aq = await page.evaluate(() => ({ state: document.querySelector("#aqTbody .pec-table-state-row")?.textContent.replace(/\s+/g, " ").trim() || "", diag: document.querySelector("#aqTbody [data-pec-diag]")?.textContent || "" }));
    check(/Action Queue could not be loaded/.test(aq.state) && !/Change the search or filters/.test(aq.state) && aq.diag.includes(AQ) && aq.diag.includes("HTTP 500"), `${tag} Action Queue failure: honest message + diagnostics ("${aq.diag}")`);
    await goTab(page, vp, "excess"); await page.waitForTimeout(1200);
    const x = await excessState(page);
    check(x.rows > 0 && !/could not be loaded/.test(x.stateRow), `${tag} Action Queue failure does not affect Excess (${x.rows} rows)`);
    await ctx.close();
  }
  { // (h) genuinely empty Excess still says "no match", not an error
    const { ctx, page } = await open({ ...RACE, empty: true }, vp, "action");
    await goTab(page, vp, "excess"); await page.waitForTimeout(1200);
    const x = await excessState(page);
    check(/No excess purchases match/.test(x.stateRow) && !/could not be loaded/.test(x.stateRow), `${tag} empty result keeps the filter message ("${x.stateRow.slice(0, 60)}")`);
    await ctx.close();
  }
}

console.log(`\npec-r2c-ui-smoke: ${passes} PASS / ${failures} FAIL`);
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
