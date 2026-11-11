// FG-BIT-UX-1 browser regression: REAL fg-bulk-internal-transfer.html against an in-memory fake
// (no network, no Supabase, no writes). Skips honestly if Playwright/Chromium is unavailable.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { /* skipped below */ }
const SK = !chromium && "Playwright unavailable";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(req.url.split("?")[0]);
  const filePath = /^\/(shared|utilities-hub|sw\.js)(\/|$)/.test(requestPath) ? `public${requestPath}` : requestPath;
  const f = path.join(root, filePath);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }).end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = chromium ? await chromium.launch() : null;
test.after(async () => { await browser?.close(); server.close(); });

export async function open({ cfg = {}, width = 1280, height = 800, ctxOpts = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const blocked = [];
  await page.route("**/*", (r) => {
    const u = r.request().url();
    if (u.startsWith(base)) return r.fallback();
    if (u.startsWith("https://esm.sh/")) return r.fulfill({ contentType: "text/javascript", body: `import { createFake } from "${base}/scripts/fg-bit-ux-1/fake-supabase.mjs"; export const createClient = () => createFake(window.__cfg);` });
    blocked.push(u); return r.abort();
  });
  await page.addInitScript(({ cfg }) => { window.__cfg = cfg; }, { cfg });
  await page.goto(`${base}/shared/fg-bulk-internal-transfer.html`);
  await page.waitForSelector("#sourceTbody tr[data-idx]");
  return { page, ctx, errors, blocked };
}
const log = (p, name) => p.evaluate((n) => (window.__cfg.log || []).filter((l) => l.kind === "rpc" && (!n || l.name === n)), name);
const SRC = "rpc_fg_bulk_internal_transfer_source_page";
const POST = "rpc_create_fg_bulk_internal_transfer";
const modalHidden = (p) => p.$eval("#transferModal", (m) => m.hidden);
const activeId = (p) => p.evaluate(() => document.activeElement?.id || document.activeElement?.dataset?.idx || document.activeElement?.className);
async function fillValid(page, qty = "10") {
  await page.fill("#transferQty", qty);
  await page.selectOption("#dstSection", "2");
  await page.selectOption("#dstSubsection", "21");
  await page.selectOption("#dstArea", "201");
  await page.waitForFunction(() => document.querySelectorAll("#dstPlant option").length > 1);
  await page.selectOption("#dstPlant", "2001");
}

test("loads first page of 50 via source_page RPC, no console errors, no external requests", { skip: SK }, async () => {
  const { page, ctx, errors, blocked } = await open();
  const calls = await log(page, SRC);
  assert.equal(calls[0].args.p_limit, 50);
  assert.equal(calls[0].args.p_offset, 0);
  assert.equal(await page.textContent("#rowCount"), "Showing 50 of 120");
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked.filter((u) => !u.includes("/fonts/")), []);
  await ctx.close();
});

test("debounced server-side filters, clear buttons, no early refetch", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.type("#filterItem", "Item 01", { delay: 20 });
  assert.equal((await log(page, SRC)).length, 1, "debounce holds the fetch");
  await page.waitForFunction(() => window.__cfg.log.filter((l) => l.name === "rpc_fg_bulk_internal_transfer_source_page").length === 2);
  const last = (await log(page, SRC)).at(-1).args;
  assert.equal(last.p_item_filter, "Item 01"); assert.equal(last.p_batch_filter, null); assert.equal(last.p_offset, 0);
  assert.equal(await page.isVisible("#filterItemClear"), true);
  await page.click("#filterItemClear");
  assert.equal(await page.inputValue("#filterItem"), "");
  assert.equal(await activeId(page), "filterItem");
  assert.equal(await page.isVisible("#filterItemClear"), false);
  await page.fill("#filterBatch", "B0007");
  await page.waitForFunction(() => document.querySelector("#rowCount").textContent === "Showing 1 of 1");
  await ctx.close();
});

test("infinite scroll appends pages; Load more fallback and no overlap", { skip: SK }, async () => {
  const { page, ctx } = await open({ height: 700 });
  await page.evaluate(() => { const w = document.querySelector(".source-table-wrap"); w.scrollTop = w.scrollHeight; });
  await page.waitForFunction(() => document.querySelectorAll("#sourceTbody tr[data-idx]").length >= 100, null, { timeout: 5000 });
  const offsets = (await log(page, SRC)).map((c) => c.args.p_offset);
  assert.deepEqual(offsets, [...new Set(offsets)], "no duplicate offset requests");
  assert.equal(offsets[0], 0); assert.equal(offsets[1], 50);
  await ctx.close();
});

test("source list error and empty-filter states are readable (no rows, no crash)", { skip: SK }, async () => {
  for (const [cfg, re] of [[{ sourceError: true }, /Unable to load source stock/], [{ n: 0 }, /No source stock found/]]) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith(base)) return r.fallback(); if (u.startsWith("https://esm.sh/")) return r.fulfill({ contentType: "text/javascript", body: `import { createFake } from "${base}/scripts/fg-bit-ux-1/fake-supabase.mjs"; export const createClient = () => createFake(window.__cfg);` }); return r.abort(); });
    await page.addInitScript((c) => { window.__cfg = c; }, cfg);
    await page.goto(`${base}/shared/fg-bulk-internal-transfer.html`);
    await page.waitForSelector("#sourceTbody .empty-row");
    assert.match(await page.textContent("#sourceTbody"), re);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test("row click opens modal with selected highlight; keyboard Enter/Space opens; initial focus on date", { skip: SK }, async () => {
  const { page, ctx } = await open();
  const row = page.locator("#sourceTbody tr[data-idx='2']");
  assert.equal(await row.getAttribute("tabindex"), "0");
  await row.focus(); await page.keyboard.press("Enter");
  assert.equal(await modalHidden(page), false);
  assert.equal(await activeId(page), "transferDate");
  assert.equal(await page.locator("tr.row-selected").count(), 1);
  assert.match(await page.textContent("#selectedSourceBody"), /Item 002/);
  await page.keyboard.press("Escape");
  assert.equal(await modalHidden(page), true);
  await page.locator("#sourceTbody tr[data-idx='3']").focus(); await page.keyboard.press("Space");
  assert.equal(await modalHidden(page), false);
  await ctx.close();
});

test("Escape / backdrop / cancel / X close and return focus to the originating row", { skip: SK }, async () => {
  const { page, ctx } = await open();
  const openRow = async (i = 4) => { await page.click(`#sourceTbody tr[data-idx='${i}'] td.col-item`); };
  for (const how of ["escape", "backdrop", "cancel", "x"]) {
    await openRow();
    assert.equal(await modalHidden(page), false, how);
    if (how === "escape") await page.keyboard.press("Escape");
    if (how === "backdrop") await page.mouse.click(3, 3);
    if (how === "cancel") await page.click("#cancelBtn");
    if (how === "x") await page.click("#modalCloseBtn");
    assert.equal(await modalHidden(page), true, how);
    assert.equal(await page.locator("tr.row-selected").count(), 0, "selection cleared on close");
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.idx), "4", `focus returned (${how})`);
    assert.equal(await page.$eval("main", (m) => m.hasAttribute("inert")), false, "background restored");
  }
  await ctx.close();
});

test("focus trap: Tab and Shift+Tab stay in dialog; background is inert", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.click("#sourceTbody tr[data-idx='1'] td.col-item");
  assert.equal(await page.$eval("main", (m) => m.hasAttribute("inert")), true);
  const inside = () => page.evaluate(() => document.getElementById("transferModal").contains(document.activeElement));
  for (let i = 0; i < 16; i++) { await page.keyboard.press("Tab"); assert.equal(await inside(), true, `fwd ${i}`); }
  await page.focus("#transferDate");
  for (let i = 0; i < 4; i++) { await page.keyboard.press("Shift+Tab"); assert.equal(await inside(), true, `rev ${i}`); }
  await page.focus("#modalCloseBtn"); // first focusable in DOM order
  await page.keyboard.press("Shift+Tab");
  assert.equal(await activeId(page), "cancelBtn", "Shift+Tab from first wraps to last enabled control");
  await page.keyboard.press("Tab");
  assert.equal(await activeId(page), "modalCloseBtn", "Tab from last wraps to first");
  await ctx.close();
});

test("destination cascade, posting summary reaction, reset", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.click("#sourceTbody tr[data-idx='1'] td.col-item");
  assert.equal(await page.$eval("#dstSubsection", (s) => s.disabled), true);
  await page.selectOption("#dstSection", "1");
  assert.equal(await page.$eval("#dstSubsection", (s) => s.disabled), false);
  assert.equal(await page.$eval("#dstArea", el => el.disabled), true, "area unavailable until subsection selected");
  await page.selectOption("#dstSubsection", "11");
  assert.equal(await page.$$eval("#dstArea option", (o) => o.length), 2, "narrowed by subsection");
  await fillValid(page);
  const sum = await page.textContent("#postingSummaryBody");
  assert.match(sum, /Packing › Packing Bay › Line 1 › Filler F1/); assert.match(sum, /10 L/);
  await page.click("#resetBtn");
  assert.equal(await page.inputValue("#transferQty"), "");
  assert.equal(await page.inputValue("#dstSection"), "");
  assert.equal(await page.$eval("#dstArea", (s) => s.disabled), true);
  await ctx.close();
});

test("Submit stays disabled until mandatory fields pass all local readiness rules", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.click("#sourceTbody tr[data-idx='1'] td.col-item");
  assert.equal(await page.$eval("#submitBtn", e => e.disabled), true, "initially disabled");
  await page.fill("#transferQty", "99999");
  assert.equal(await page.$eval("#submitBtn", e => e.disabled), true, "too large");
  await page.fill("#transferQty", "5");
  assert.equal(await page.$eval("#submitBtn", e => e.disabled), true, "no destination");
  await page.selectOption("#dstSection", "1");
  await page.selectOption("#dstSubsection", "11");
  await page.selectOption("#dstArea", "101");
  await page.waitForFunction(() => document.querySelectorAll("#dstPlant option").length > 1);
  await page.selectOption("#dstPlant", "1001");
  assert.equal(await page.$eval("#submitBtn", e => e.disabled), true, "same location");
  assert.equal((await log(page, POST)).length, 0);
  await page.selectOption("#dstSection", "2");
  await page.selectOption("#dstSubsection", "21");
  await page.selectOption("#dstArea", "201");
  await page.waitForFunction(() => document.querySelectorAll("#dstPlant option").length > 1);
  await page.selectOption("#dstPlant", "2001");
  assert.equal(await page.$eval("#submitBtn", e => e.disabled), false, "valid destination");
  await page.fill("#transferQty", "0");
  assert.equal(await page.$eval("#submitBtn", e => e.disabled), true, "zero quantity");
  await page.fill("#transferQty", "5");
  assert.equal(await page.$eval("#submitBtn", e => e.disabled), false, "restored");
  await page.fill("#transferDate", "");
  assert.equal(await page.$eval("#submitBtn", e => e.disabled), true, "missing date");
  await page.click("#resetBtn");
  assert.equal(await page.$eval("#submitBtn", e => e.disabled), true, "reset");
  await ctx.close();
});


test("governed destination: valid area without plant enables posting and RPC passes null plant", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.click("#sourceTbody tr[data-idx='1'] td.col-item");
  await page.fill("#transferQty", "5");
  await page.selectOption("#dstSection", "2");
  assert.equal(await page.$eval("#dstArea", e => e.disabled), true, "choose subsection first");
  await page.selectOption("#dstSubsection", "21");
  await page.selectOption("#dstArea", "202"); // has no plant/machinery master rows
  await page.waitForFunction(() => document.querySelector("#dstPlant").disabled);
  assert.equal(await page.inputValue("#dstPlant"), "");
  assert.equal(await page.$eval("#submitBtn", e => e.disabled), false, "area-level transfer valid");
  await page.click("#submitBtn");
  await page.waitForFunction(() => /posted successfully/i.test(document.querySelector("#modalMsgArea").textContent));
  const posts = await log(page, POST);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].args.p_to_subsection_id, 21);
  assert.equal(posts[0].args.p_to_area_id, 202);
  assert.equal(posts[0].args.p_to_plant_id, null);
  await ctx.close();
});

test("post success (source remains): payload exact, modal stays, balance refreshed", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.click("#sourceTbody tr[data-idx='1'] td.col-item");
  await fillValid(page, "10");
  await page.click("#submitBtn");
  await page.waitForFunction(() => /posted successfully/i.test(document.querySelector("#modalMsgArea").textContent));
  const posts = await log(page, POST);
  assert.equal(posts.length, 1);
  assert.deepEqual(Object.keys(posts[0].args).length, 16);
  assert.equal(posts[0].args.p_qty, 10); assert.equal(posts[0].args.p_to_plant_id, 2001); assert.equal(posts[0].args.p_from_plant_id, 1001);
  assert.equal(posts[0].args.p_source_work_log_id, null);
  assert.equal(await modalHidden(page), false);
  assert.match(await page.textContent("#selectedSourceBody"), /91/);
  assert.equal(await page.$eval("#submitBtn", (b) => b.disabled), true, "must be disabled again after post");
  assert.equal(await page.inputValue("#transferQty"), "");
  assert.equal(await page.evaluate(() => document.getElementById("transferModal").contains(document.activeElement)), true);
  await ctx.close();
});

test("post success (source exhausted): modal closes, focus lands on deterministic fallback", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.click("#sourceTbody tr[data-idx='1'] td.col-item"); // qty 101
  await fillValid(page, "101");
  await page.click("#submitBtn");
  await page.waitForFunction(() => document.querySelector("#transferModal").hidden);
  assert.equal(await page.evaluate(() => document.activeElement.className), "source-table-wrap");
  assert.equal(await page.locator("tr.row-selected").count(), 0);
  await ctx.close();
});

test("posting is non-reentrant: double click/Enter posts once; Esc/backdrop/Cancel ignored while busy", { skip: SK }, async () => {
  const { page, ctx } = await open({ cfg: { postDelayMs: 600 } });
  await page.click("#sourceTbody tr[data-idx='1'] td.col-item");
  await fillValid(page, "10");
  await page.click("#submitBtn");
  assert.equal(await page.$eval("#submitBtn", (b) => b.disabled), true);
  assert.equal(await page.textContent("#submitBtn"), "Posting...");
  assert.equal(await page.getAttribute("#transferModal", "aria-busy"), "true");
  await page.evaluate(() => { document.getElementById("transferForm").requestSubmit(); document.getElementById("transferForm").dispatchEvent(new Event("submit", { cancelable: true })); });
  await page.keyboard.press("Escape");
  await page.mouse.click(3, 3);
  assert.equal(await modalHidden(page), false, "modal not closed while posting");
  await page.waitForFunction(() => document.getElementById("transferModal").getAttribute("aria-busy") === "false");
  assert.equal(await page.$eval("#submitBtn", e => e.disabled), true, "successful post clears mandatory quantity");
  assert.equal((await log(page, POST)).length, 1, "exactly one post");
  await ctx.close();
});

test("post errors (RPC error and network failure) show alert, re-enable controls, keep values", { skip: SK }, async () => {
  for (const cfg of [{ postError: "Insufficient balance" }, { postThrows: true }]) {
    const { page, ctx } = await open({ cfg });
    await page.click("#sourceTbody tr[data-idx='1'] td.col-item");
    await fillValid(page, "10");
    await page.click("#submitBtn");
    await page.waitForFunction(() => document.querySelector("#modalMsgArea [role=alert]"));
    assert.match(await page.textContent("#modalMsgArea"), cfg.postError ? /Insufficient balance/ : /Unexpected error/);
    assert.equal(await page.$eval("#submitBtn", (b) => b.disabled), false);
    assert.equal(await page.inputValue("#transferQty"), "10");
    assert.equal(await modalHidden(page), false);
    await ctx.close();
  }
});

test("guidance toggle works at phone width", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, height: 800 });
  assert.equal(await page.isVisible("#guidanceBody"), false);
  await page.click("#guidanceToggle");
  assert.equal(await page.isVisible("#guidanceBody"), true);
  assert.equal(await page.getAttribute("#guidanceToggle", "aria-expanded"), "true");
  await ctx.close();
});

// ── Geometry: measured bounding boxes / scroll ownership, not screenshots ──
const VIEWPORTS = [[1440, 900], [1024, 768], [768, 1024], [520, 800], [390, 844], [320, 568], [1280, 480], [844, 390], [390, 844, "tall"]];
for (const [w, h] of VIEWPORTS) {
  test(`geometry ${w}x${h}: no horizontal overflow, modal fits, one scroll owner, all fields+actions reachable`, { skip: SK }, async () => {
    const { page, ctx, errors } = await open({ width: w, height: h });
    const pg = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.ok(pg.sw <= pg.cw, `page h-overflow ${pg.sw}>${pg.cw}`);
    await page.click("#sourceTbody tr[data-idx='1'] td.col-item");
    const m = await page.evaluate(() => {
      const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, w: b.width, h: b.height }; };
      const vh = window.innerHeight, vw = window.innerWidth;
      const ownerCount = [".modal-overlay", ".modal-box", ".modal-body", ".mcard-body"].filter((s) => { const e = document.querySelector(s); return e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== "visible"; }).length;
      const body = document.querySelector(".modal-body");
      return { vh, vw, box: r(".modal-box"), hdr: r(".modal-hdr"), body: r(".modal-body"), foot: r(".modal-footer"), overlayScrolls: getComputedStyle(document.querySelector(".modal-overlay")).overflowY, bodyScrolls: getComputedStyle(body).overflowY, mcardOverflow: getComputedStyle(document.querySelector(".mcard-body")).overflowY, ownerCount, docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, boxScrollW: document.querySelector(".modal-box").scrollWidth - document.querySelector(".modal-box").clientWidth, bodyScrollW: body.scrollWidth - body.clientWidth };
    });
    assert.ok(m.box.t >= -0.5 && m.box.b <= m.vh + 0.5, `box vertically inside viewport ${JSON.stringify(m.box)} vh=${m.vh}`);
    assert.ok(m.box.l >= -0.5 && m.box.r <= m.vw + 0.5, "box horizontally inside viewport");
    assert.ok(m.foot.b <= m.vh + 0.5 && m.hdr.t >= -0.5, "header and action bar are on screen");
    assert.ok(m.foot.t >= m.body.b - 0.5, "footer does not overlap body (never covers the last field)");
    assert.equal(m.overlayScrolls, "hidden");
    assert.equal(m.bodyScrolls, "auto");
    assert.equal(m.mcardOverflow, "visible", "cards do not own scroll");
    assert.equal(m.boxScrollW, 0); assert.equal(m.bodyScrollW, 0); assert.equal(m.docOverflowX, 0);
    // Every required control and action can be scrolled into view and sits inside the box.
    for (const sel of ["#transferDate", "#transferQty", "#dstSection", "#dstSubsection", "#dstArea", "#dstPlant", "#remarks", "#submitBtn", "#resetBtn", "#cancelBtn", "#modalCloseBtn"]) {
      await page.locator(sel).scrollIntoViewIfNeeded();
      const q = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); const bx = document.querySelector(".modal-box").getBoundingClientRect(); return { ok: b.width > 0 && b.height > 0 && b.left >= bx.left - 0.5 && b.right <= bx.right + 0.5 && b.top >= bx.top - 0.5 && b.bottom <= bx.bottom + 0.5, w: b.width, h: b.height }; }, sel);
      assert.ok(q.ok, `${sel} not operable ${JSON.stringify(q)}`);
      if (/^#(dst|transferQty|transferDate)/.test(sel)) assert.ok(q.w >= 100 && q.h >= 30, `${sel} too small ${q.w}x${q.h}`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

test("desktop modal layout: three columns >=1100, two columns 760-1000, one column <=760", { skip: SK }, async () => {
  for (const [w, cols] of [[1440, 3], [1100, 3], [900, 2], [760, 1], [390, 1]]) {
    const { page, ctx } = await open({ width: w, height: 900 });
    await page.click("#sourceTbody tr[data-idx='1'] td.col-item");
    const n = await page.evaluate(() => new Set([...document.querySelectorAll(".mcard")].map((c) => Math.round(c.getBoundingClientRect().left))).size);
    assert.equal(n, cols, `width ${w}`);
    await ctx.close();
  }
});

test("200% zoom equivalent (640x400 CSS px) and soft-keyboard height keep actions reachable", { skip: SK }, async () => {
  for (const [w, h] of [[640, 400], [390, 340]]) {
    const { page, ctx } = await open({ width: w, height: h });
    await page.click("#sourceTbody tr[data-idx='1'] td.col-item");
    await page.locator("#remarks").focus();
    const r = await page.evaluate(() => ({ foot: document.querySelector(".modal-footer").getBoundingClientRect().bottom, vh: innerHeight, sub: getComputedStyle(document.querySelector(".modal-hdr-sub")).display }));
    assert.ok(r.foot <= r.vh + 0.5, `footer visible at ${w}x${h}`);
    await page.locator("#submitBtn").scrollIntoViewIfNeeded();
    assert.equal(await page.locator("#submitBtn").isVisible(), true, "disabled action remains visible and reachable");
    await ctx.close();
  }
});

test("phone card list: rows are cards, selected state visible, no h-overflow; HOME icon-only with accessible name", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, height: 844 });
  assert.equal(await page.$eval("thead", (t) => getComputedStyle(t).display), "none");
  const home = await page.$eval("#homeBtn", (b) => ({ label: b.getAttribute("aria-label"), w: b.getBoundingClientRect().width, labelVisible: b.querySelector(".home-label").getBoundingClientRect().width > 2, svg: !!b.querySelector("svg") }));
  assert.equal(home.label, "HOME"); assert.equal(home.svg, true); assert.equal(home.labelVisible, false); assert.ok(home.w >= 34);
  await page.click("#sourceTbody tr[data-idx='0']");
  await page.keyboard.press("Escape");
  await page.click("#sourceTbody tr[data-idx='1']");
  await page.click("#cancelBtn");
  const card = await page.$eval("#sourceTbody tr[data-idx='1']", (t) => { const c = getComputedStyle(t); return { display: c.display, br: c.borderTopLeftRadius }; });
  assert.equal(card.display, "grid"); assert.notEqual(card.br, "0px");
  await page.evaluate(() => { document.querySelector("#sourceTbody tr[data-idx='1']").classList.add("row-selected"); });
  const bg = await page.$eval("#sourceTbody tr[data-idx='1']", (t) => getComputedStyle(t).backgroundColor);
  const plain = await page.$eval("#sourceTbody tr[data-idx='3']", (t) => getComputedStyle(t).backgroundColor);
  assert.notEqual(bg, plain, "selected card is visually distinct");
  await ctx.close();
});

test("PWA HOME navigates to Utilities Hub", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.route("**/utilities-hub/index.html", (r) => r.fulfill({ contentType: "text/html", body: "<title>home</title>" }));
  await Promise.all([page.waitForURL("**/utilities-hub/index.html"), page.click("#homeBtn")]);
  await ctx.close();
});

// ── Review round 2: refresh / exhaustion / short-viewport regressions ──
const scrollOwners = (page) => page.evaluate(() => {
  const els = [document.documentElement, document.body, ...document.querySelectorAll(".modal-overlay, .modal-box, .modal-body, .mcard, .mcard-body, .modal-cards")];
  return els.filter((e) => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY) && !(e === document.documentElement)).map((e) => e.className || e.tagName);
});

test("320px short viewport: only .modal-body scrolls (wheel moves it, nothing else moves)", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 320, height: 400 });
  await page.click("#sourceTbody tr[data-idx='1']");
  assert.deepEqual(await scrollOwners(page), ["modal-body"]);
  const before = await page.evaluate(() => ({ b: document.querySelector(".modal-body").scrollTop, d: scrollY, o: document.querySelector(".modal-overlay").scrollTop, w: document.querySelector(".source-table-wrap").scrollTop }));
  await page.mouse.move(160, 200); await page.mouse.wheel(0, 300);
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ b: document.querySelector(".modal-body").scrollTop, d: scrollY, o: document.querySelector(".modal-overlay").scrollTop, w: document.querySelector(".source-table-wrap").scrollTop, dsw: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  assert.ok(after.b > before.b, "modal body scrolled");
  assert.equal(after.d, before.d, "page did not scroll"); assert.equal(after.o, 0); assert.equal(after.w, before.w, "background list did not scroll");
  assert.equal(after.dsw, 0);
  const f = await page.evaluate(() => { const b = document.querySelector(".modal-footer").getBoundingClientRect(); return { b: b.bottom, h: b.height, vh: innerHeight }; });
  assert.ok(f.b <= f.vh + 0.5 && f.h > 30, "footer stays on screen while body scrolls");
  await ctx.close();
});

test("390x340 footer is really usable: real clicks on Reset/Cancel/Submit, message not covering last field", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, height: 340 });
  await page.click("#sourceTbody tr[data-idx='1']");
  assert.equal(await page.$eval("#submitBtn", b => b.disabled), true, "incomplete form cannot submit");
  await page.locator("#remarks").scrollIntoViewIfNeeded();
  const g = await page.evaluate(() => { const r = document.querySelector("#remarks").getBoundingClientRect(), f = document.querySelector(".modal-footer").getBoundingClientRect(), b = document.querySelector(".modal-body").getBoundingClientRect(); return { remarksBottom: r.bottom, footTop: f.top, bodyBottom: b.bottom, footH: f.height, vh: innerHeight }; });
  assert.ok(g.remarksBottom <= g.footTop + 0.5, `last field not covered ${JSON.stringify(g)}`);
  assert.ok(g.footTop >= g.bodyBottom - 0.5 && g.footH < g.vh * 0.6, "footer is a separate row and leaves room for the body");
  const bodyH = await page.$eval(".modal-body", (b) => b.clientHeight);
  assert.ok(bodyH >= 80, `body keeps usable height (${bodyH}px)`);
  await page.fill("#transferQty", "5");
  await page.click("#resetBtn");
  assert.equal(await page.inputValue("#transferQty"), "");
  await page.click("#cancelBtn");
  assert.equal(await modalHidden(page), true);
  await ctx.close();
});

test("source refresh while modal is open (post, stock remains): focus stays inside, selection re-highlighted, scroll still body-only, close restores focus to the re-rendered opener row", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, height: 500 });
  await page.click("#sourceTbody tr[data-idx='5']");
  await fillValid(page, "10");
  await page.evaluate(() => { document.querySelector(".modal-body").scrollTop = 200; });
  const oldRow = await page.evaluateHandle(() => document.querySelector("#sourceTbody tr[data-idx='5']"));
  await page.click("#submitBtn");
  await page.waitForFunction(() => /posted successfully/i.test(document.querySelector("#modalMsgArea").textContent));
  assert.equal(await oldRow.evaluate((n) => n.isConnected), false, "list was really re-rendered");
  assert.equal(await page.evaluate(() => document.getElementById("transferModal").contains(document.activeElement)), true, "focus inside dialog after refresh");
  assert.equal(await page.locator("tr.row-selected").count(), 1, "selection restored on re-rendered list");
  assert.equal(await page.$eval("main", (m) => m.hasAttribute("inert")), true, "background still inert");
  assert.deepEqual(await scrollOwners(page), ["modal-body"]);
  await page.click("#cancelBtn");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset?.idx), "5", "focus restored to the new row element for the same source_key");
  assert.equal(await page.$eval("#sourceTbody tr[data-idx='5']", (t) => t.isConnected), true);
  await ctx.close();
});

test("post exhaustion: modal closed, background live, focus on list region (not lost to <body>), Tab continues into page, list scrolls, count updated", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 1024, height: 700 });
  await page.click("#sourceTbody tr[data-idx='1']"); // qty 101
  await fillValid(page, "101");
  await page.click("#submitBtn");
  await page.waitForFunction(() => document.querySelector("#transferModal").hidden);
  assert.equal(await page.evaluate(() => document.activeElement.className), "source-table-wrap");
  for (const sel of ["header", "main"]) assert.equal(await page.$eval(sel, (m) => m.hasAttribute("inert")), false, `${sel} not inert`);
  assert.equal(await page.evaluate(() => document.body.classList.contains("fgbit-modal-open")), false);
  assert.equal(await page.textContent("#rowCount"), "Showing 50 of 119");
  assert.equal(await page.locator("#sourceTbody tr", { hasText: "Item 001" }).count(), 0, "exhausted row gone");
  await page.keyboard.press("Tab"); // wrap region -> first focusable row
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "TR");
  await page.evaluate(() => { document.querySelector(".source-table-wrap").scrollTop = 120; });
  assert.ok(await page.$eval(".source-table-wrap", (w) => w.scrollTop > 0), "list scrolls");
  await page.keyboard.press("Enter");
  assert.equal(await modalHidden(page), false, "can reopen with keyboard after exhaustion");
  await ctx.close();
});


test("PWA-published route loads the real transfer form and HOME returns to Hub", { skip: SK }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.fallback();
    if (url.startsWith("https://esm.sh/")) return route.fulfill({ contentType: "text/javascript", body: `import { createFake } from "${base}/scripts/fg-bit-ux-1/fake-supabase.mjs"; export const createClient = () => createFake(window.__cfg);` });
    return route.abort();
  });
  await page.addInitScript(() => { window.__cfg = {}; });
  await page.goto(`${base}/shared/fg-bulk-internal-transfer.html`);
  await page.waitForSelector("#sourceTbody tr[data-idx]");
  await page.click("#sourceTbody tr[data-idx='1']");
  assert.equal(await page.isVisible("#transferDate"), true);
  await page.click("#cancelBtn");
  await page.route("**/utilities-hub/index.html", route => route.fulfill({ contentType: "text/html", body: "<title>PWA Hub</title>" }));
  await Promise.all([page.waitForURL("**/utilities-hub/index.html"), page.click("#homeBtn")]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("owner acceptance: guidance chevron advertises expandability", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, height: 844 });
  const chevron = page.locator(".guidance-indicator");
  assert.equal(await chevron.isVisible(), true);
  assert.equal(await page.getAttribute("#guidanceToggle", "aria-expanded"), "false");
  await page.click("#guidanceToggle");
  assert.equal(await page.getAttribute("#guidanceToggle", "aria-expanded"), "true");
  assert.equal(await page.isVisible("#guidanceBody"), true);
  await ctx.close();
});

test("owner acceptance: automatic paging hides routine Load more fallback", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 1100, height: 700 });
  assert.equal(await page.isVisible("#sourceLoadMore"), false, "automatic mode does not present a routine button");
  await page.evaluate(() => document.querySelector(".source-table-wrap").scrollTop = 100000);
  await page.waitForFunction(() => document.querySelectorAll("#sourceTbody tr[data-idx]").length >= 100);
  assert.equal(await page.isVisible("#sourceLoadMore"), false);
  await ctx.close();
});

test("owner acceptance: three modal cards have equal desktop outer heights", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 1440, height: 900 });
  await page.click("#sourceTbody tr[data-idx='1']");
  const sizes = await page.locator(".modal-cards > .mcard").evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height));
  assert.equal(sizes.length, 3);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) < 1, JSON.stringify(sizes));
  await ctx.close();
});

test("Electron compatibility entry preserves item, bn and hash in canonical route", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.goto(`${base}/fg-bulk-internal-transfer.html?item=Test%20Item&bn=0111#entry`);
  await page.waitForURL("**/public/shared/fg-bulk-internal-transfer.html?item=Test%20Item&bn=0111#entry");
  assert.equal(await page.locator("h1").textContent(), "FG Bulk Internal Transfer");
  await ctx.close();
});

test("responsive typography: field hierarchy stays proportionate at desktop and narrow widths", { skip: SK }, async () => {
  for (const width of [1440, 768, 390, 320]) {
    const { page, ctx } = await open({ width, height: 800 });
    await page.click("#sourceTbody tr[data-idx='1']");
    const metrics = await page.evaluate(() => {
      const css = (sel) => getComputedStyle(document.querySelector(sel));
      const fields = ["#transferDate", "#transferQty", "#dstSection", "#dstSubsection", "#dstArea", "#dstPlant", "#remarks"];
      const fz = fields.map(id => parseFloat(css(id).fontSize));
      const heights = fields.map(id => document.querySelector(id).getBoundingClientRect().height);
      return { label: parseFloat(css('label[for="transferDate"]').fontSize), fz, heights, modalWidth: document.querySelector(".modal-box").getBoundingClientRect().width, pageWidth: innerWidth };
    });
    assert.ok(metrics.fz.every(n => Math.abs(n - metrics.fz[0]) <= 0.2), JSON.stringify({ width, metrics }));
    assert.ok(metrics.fz[0] - metrics.label <= 3, "input text must not dwarf labels");
    assert.ok(metrics.heights.every(h => h >= 34), "usable field heights");
    assert.ok(metrics.modalWidth <= metrics.pageWidth + 1, "modal stays within viewport");
    if (width <= 760) {
      assert.equal(metrics.fz[0], 14, "Chromium narrow controls should not be oversized");
      assert.equal(metrics.label, 14, "field text and label in balance");
    }
    await ctx.close();
  }
});

test("posting summary uses readable date, clean blank quantity and location separators", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.click("#sourceTbody tr[data-idx='1']");
  const initial = await page.textContent("#postingSummaryBody");
  assert.doesNotMatch(initial, /- L| > -| - >/);
  assert.match(initial, /—/);
  const date = await page.inputValue("#transferDate");
  const [year, month, day] = date.split("-");
  assert.ok(initial.includes(`${day}-${month}-${year}`), "summary date matches input display order");
  await fillValid(page, "5");
  const ready = await page.textContent("#postingSummaryBody");
  assert.match(ready, /Packing › Packing Bay › Line 1 › Filler F1/);
  assert.match(ready, /5 L/);
  await ctx.close();
});
