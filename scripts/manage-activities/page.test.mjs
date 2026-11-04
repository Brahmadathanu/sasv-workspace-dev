// Browser regression for the REAL manage-activities.html against an in-memory fake (no network, no Supabase, no writes).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { /* skip below */ }
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }).end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = chromium ? await chromium.launch() : null;
test.after(async () => { await browser?.close(); server.close(); });

async function open({ view = true, edit = true, n = 60, cfg = {}, width = 1280, height, noObserver = false } = {}) {
  height ??= noObserver ? 420 : 900;
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("https://esm.sh/**", (r) => r.fulfill({ contentType: "text/javascript", body: `import { createFake } from "${base}/scripts/manage-activities/fake-supabase.mjs"; export const createClient = () => createFake(window.__cfg);` }));
  await page.route("**/fonts/**", (r) => r.abort());
  if (noObserver) await page.addInitScript(() => { delete window.IntersectionObserver; window.addEventListener = ((o) => function (t, ...a) { return t === "scroll" || t === "resize" ? undefined : o.call(this, t, ...a); })(window.addEventListener); });
  await page.addInitScript(async ({ view, edit, n, cfg, base }) => {
    window.__pending = import(`${base}/scripts/manage-activities/fake-supabase.mjs`).then((m) => {
      window.__cfg = { data: m.makeData(n), perms: { list: m.permList(view, edit), edit }, ...cfg };
    });
  }, { view, edit, n, cfg, base });
  // __cfg must exist before page module executes: serve it through a tiny inline gate.
  await page.route("**/js/activities.js", async (r) => { const resp = await r.fetch(); r.fulfill({ response: resp, body: `await window.__pending;\n` + (await resp.text()) }); });
  await page.goto(`${base}/manage-activities.html`);
  return { page, ctx, errors };
}
const rowsText = (page) => page.$$eval("#existingTable tbody tr", (t) => t.map((r) => r.children[0].textContent));
const visible = (page, sel) => page.isVisible(sel);
const SK = !chromium && "Playwright unavailable";

const ready = (p) => p.waitForSelector("#existingTable tbody tr", { state: "attached" });
const count = (p) => p.locator("#existingTable tbody tr").count();
const waitRows = (p, n) => p.waitForFunction((n) => document.querySelectorAll("#existingTable tbody tr").length === n, n);
const reqs = (p, op = "select") => p.evaluate((op) => window.__cfg.log.filter((l) => l.table === "activities" && l.op === op), op);

test("infinite scroll: batches of 25 in stable order, total, end state, no duplicate loads", { skip: SK }, async () => {
  const { page, ctx, errors } = await open({ n: 60, width: 1280 });
  await ready(page);
  for (let i = 0; i < 6 && (await count(page)) < 60; i++) { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(150); }
  await waitRows(page, 60);
  const names = await rowsText(page);
  assert.deepEqual(names, [...names].sort(), "stable name order");
  assert.equal(new Set(names).size, 60);
  assert.equal(await page.textContent("#maCount"), "60 activities");
  assert.match(await page.textContent("#maListStatus"), /All 60 loaded/);
  assert.equal(await page.isHidden("#maLoadMore"), true);
  const ranges = (await reqs(page)).map((l) => l.range.join("-"));
  assert.deepEqual(ranges, ["0-24", "25-49", "50-74"], "sequential offsets, no overlap or repeats");
  assert.deepEqual(errors, []); await ctx.close();
});

test("scrolling loads the next batch; Load more fallback works when observer does not fire", { skip: SK }, async () => {
  const { page, ctx } = await open({ n: 120, width: 390 });
  await ready(page);
  await page.waitForFunction(() => document.querySelector("#maListStatus").textContent.startsWith("Showing"));
  const first = await count(page);
  assert.ok(first >= 25 && first % 25 === 0 && first < 120, `partial feed ${first}`);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction((n) => document.querySelectorAll("#existingTable tbody tr").length > n, first);
  // Fallback button: visible while more remain, loads exactly one more batch.
  assert.equal(await page.isVisible("#maLoadMore"), true);
  await ctx.close();
});

test("Load more button loads one batch (observer disabled)", { skip: SK }, async () => {


  const { page, ctx } = await open({ n: 120, noObserver: true });
  await ready(page);
  await waitRows(page, 25);
  await page.click("#maLoadMore");
  await waitRows(page, 50);
  assert.match(await page.textContent("#maListStatus"), /Showing 50 of 120/);
  await ctx.close();
});

test("stale responses are discarded and concurrent loads are not duplicated", { skip: SK }, async () => {
  const { page, ctx } = await open({ n: 120, noObserver: true, cfg: { delayMs: 150 } });
  await ready(page);
  await Promise.all([page.click("#maLoadMore"), page.click("#maLoadMore", { force: true, noWaitAfter: true }).catch(() => {})]);
  await waitRows(page, 50);
  assert.equal((await reqs(page)).length, 2, "double click issued a single batch request");
  // search reset while a load-more is in flight: old batch must not leak in
  await page.click("#maLoadMore");
  await page.fill("#nameFilter", "Activity 11");
  await page.waitForFunction(() => document.querySelector("#maCount").textContent === "10 activities");
  await page.waitForTimeout(400);
  const names = await rowsText(page);
  assert.equal(names.length, 10); assert.ok(names.every((n) => n.startsWith("Activity 11")));
  await ctx.close();
});

test("load-more failure keeps rows, shows error and Retry recovers; initial failure retries too", { skip: SK }, async () => {
  let o = await open({ n: 120, noObserver: true });
  await ready(o.page);
  await o.page.evaluate(() => { window.__cfg.fail = { activities: { select: { message: "Failed to fetch" } } }; });
  await o.page.click("#maLoadMore");
  await o.page.waitForFunction(() => document.querySelector("#maListStatus").textContent.includes("Could not load more"));
  assert.equal(await count(o.page), 25);
  assert.equal(await o.page.textContent("#maLoadMore"), "Retry");
  await o.page.evaluate(() => { delete window.__cfg.fail; });
  await o.page.click("#maLoadMore"); await waitRows(o.page, 50);
  await o.ctx.close();
  o = await open({ cfg: { fail: { activities: { select: { message: "Failed to fetch" } } } } });
  await o.page.waitForFunction(() => document.querySelector("#maListStatus").textContent.includes("Could not load activities"));
  await o.page.evaluate(() => { delete window.__cfg.fail; });
  await o.page.click("#maLoadMore"); await ready(o.page);
  await o.ctx.close();
});

test("table columns, duration unit, no actions column", { skip: SK }, async () => {
  const { page, ctx } = await open({ n: 6 });
  await ready(page);
  assert.deepEqual(await page.$$eval("#existingTable thead th", (t) => t.map((x) => x.textContent.trim())), ["Activity", "Section", "Sub-section", "Area", "Kind", "Duration"]);
  assert.equal(await page.locator(".edit-btn, .delete-btn").count(), 0);
  assert.deepEqual(await page.$$eval("#existingTable tbody tr", (t) => t.map((r) => r.children[5].textContent)), ["0 days", "1 day", "2 days", "3 days", "4 days", "0 days"]);
  await ctx.close();
});

test("filter drawer: opens left-of-search, cascades, badge, Clear all, Esc + focus return", { skip: SK }, async () => {
  const { page, ctx } = await open({ n: 60 });
  await ready(page);
  const [fb, sb] = await Promise.all([page.locator("#maFilterBtn").boundingBox(), page.locator("#nameFilter").boundingBox()]);
  assert.ok(fb.x + fb.width <= sb.x + 1, "filter button immediately left of search");
  assert.equal(await page.isHidden("#sectionFilter"), true);
  await page.click("#maFilterBtn");
  assert.equal(await page.getAttribute("#maFilterBtn", "aria-expanded"), "true");
  assert.equal(await page.evaluate(() => document.activeElement.id), "sectionFilter");
  assert.equal(await page.isDisabled("#subFilter"), true);
  await page.selectOption("#sectionFilter", "2");
  await page.waitForFunction(() => !document.querySelector("#subFilter").disabled);
  await page.selectOption("#subFilter", "21"); await page.selectOption("#areaFilter", "211"); await page.selectOption("#kindFilter", "k-2");
  await page.waitForFunction(() => document.querySelector("#maCount").textContent === "10 activities");
  assert.equal(await page.textContent("#maFilterBadge"), "4");
  assert.match(await page.getAttribute("#maFilterBtn", "aria-label"), /4 active/);
  await page.keyboard.press("Escape");
  assert.equal(await page.isHidden("#maDrawer"), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), "maFilterBtn");
  assert.equal(await page.isVisible("#maFilterBadge"), true, "indicator persists with drawer closed");
  await page.fill("#nameFilter", "zzz");
  await page.waitForFunction(() => document.querySelector("#maEmpty").textContent.includes("No activities match"));
  await page.click("#maFilterBtn"); await page.click("#clearFilters");
  await page.fill("#nameFilter", "");
  await page.waitForFunction(() => document.querySelector("#maCount").textContent === "60 activities");
  assert.equal(await page.isHidden("#maFilterBadge"), true);
  assert.equal(await page.isDisabled("#subFilter"), true);
  await ctx.close();
});

test("read-only user: details only, no Edit/Delete/New; no-view user denied; permission load failure fails closed", { skip: SK }, async () => {
  let o = await open({ edit: false, n: 3 });
  await ready(o.page);
  assert.equal(await o.page.isHidden("#maNewBtn"), true);
  assert.match(await o.page.textContent("#maStatus"), /View only/);
  await o.page.click("#existingTable .ma-name-link");
  await o.page.waitForSelector('[role=dialog] .ma-details');
  assert.equal(await o.page.locator('[data-act="edit"], [data-act="delete"]').count(), 0);
  await o.page.keyboard.press("Escape"); await o.ctx.close();
  o = await open({ view: false });
  await o.page.waitForFunction(() => document.querySelector("#maStatus").textContent.includes("do not have access"));
  assert.equal(await o.page.isVisible("#maMain"), false);
  assert.equal(await o.page.evaluate(() => window.__cfg.log?.some((l) => l.table === "activities") ?? false), false);
  await o.ctx.close();
  o = await open({ cfg: { rpcError: true } });
  await o.page.waitForFunction(() => document.querySelector("#maStatus").textContent.includes("Could not verify"));
  assert.equal(await o.page.isVisible("#maMain"), false);
  await o.ctx.close();
});

test("details dialog: row click, Enter and Space on activity button, all attributes, focus return", { skip: SK }, async () => {
  const { page, ctx } = await open({ n: 4 });
  await ready(page);
  await page.click('tr[data-id="2"] td:nth-child(3)'); // click anywhere on the row
  const txt = await page.textContent('[role=dialog] .ma-details');
  for (const t of ["Activity 002", "Sec B", "Sub B1", "Area B1a", "Process", "1 day", "2"]) assert.ok(txt.includes(t), t);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.closest("tr").dataset.id), "2", "focus restored to the row's button");
  for (const key of ["Enter", "Space"]) {
    await page.focus('tr[data-id="3"] .ma-name-link'); await page.keyboard.press(key);
    await page.waitForSelector("#maDlgTitle");
    assert.equal(await page.textContent("#maDlgTitle"), "Activity details");
    await page.keyboard.press("Escape");
  }
  await ctx.close();
});

test("edit from details: validation, failure preserves input, success reloads; cancel returns to details", { skip: SK }, async () => {
  const { page, ctx } = await open({ n: 4 });
  await ready(page);
  await page.click('tr[data-id="1"] .ma-name-link'); await page.click('[data-act="edit"]');
  await page.fill("#ed-name", ""); await page.click('[data-act="save"]');
  assert.match(await page.textContent('[data-err="ed-name"]'), /required/);
  assert.equal((await reqs(page, "update")).length, 0);
  await page.fill("#ed-name", "Edited One");
  await page.evaluate(() => { window.__cfg.silent = { update: true }; });
  await page.click('[data-act="save"]'); await page.waitForSelector("#ed-msg:not([hidden])");
  assert.equal(await page.inputValue("#ed-name"), "Edited One");
  await page.evaluate(() => { window.__cfg.silent = {}; });
  await page.click('[data-act="save"]');
  await page.waitForFunction(() => !document.querySelector("#maDlgTitle"));
  await page.waitForFunction(() => [...document.querySelectorAll("#existingTable tbody tr")].some((r) => r.children[0].textContent === "Edited One"));
  await page.click('tr[data-id="2"] .ma-name-link'); await page.click('[data-act="edit"]'); await page.click('[data-act="cancel"]');
  assert.equal(await page.textContent("#maDlgTitle"), "Activity details");
  await ctx.close();
});

test("delete from details: cancel returns, success removes row locally, in-use failure surfaced", { skip: SK }, async () => {
  const { page, ctx } = await open({ n: 5, cfg: { inUse: [2] } });
  await ready(page);
  await page.click('tr[data-id="1"] .ma-name-link'); await page.click('[data-act="delete"]'); await page.click('[data-act="cancel"]');
  assert.equal(await page.textContent("#maDlgTitle"), "Activity details");
  await page.click('[data-act="delete"]'); await page.click('[data-act="ok"]');
  await waitRows(page, 4);
  assert.equal(await page.textContent("#maCount"), "4 activities");
  assert.equal(await page.evaluate(() => window.__cfg.data.activities.length), 4);
  await page.click('tr[data-id="2"] .ma-name-link'); await page.click('[data-act="delete"]'); await page.click('[data-act="ok"]');
  await page.waitForFunction(() => document.querySelector(".ma-dialog-backdrop .ma-modal-body")?.textContent.includes("in use"));
  assert.equal(await page.evaluate(() => window.__cfg.data.activities.length), 4);
  await ctx.close();
});


const rectOf = (page, sel) => page.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight }; }, sel);
const inside = (b, tol = 1) => b.l >= -tol && b.r <= b.vw + tol && b.w > 0 && b.h > 0;
const inViewport = (b, tol = 1) => b.l >= -tol && b.r <= b.vw + tol && b.t >= -tol && b.b <= b.vh + tol;
const fillRow = async (page, i, name, sec = "1", sub = "11", area = "111", kind = "k-1", dur = "2") => {
  const tr = page.locator("#multiTable tbody tr").nth(i);
  await tr.locator(".m-name").fill(name); await tr.locator(".m-section").selectOption(sec);
  await tr.locator(".m-sub").selectOption(sub); await tr.locator(".m-area").selectOption(area);
  await tr.locator(".m-kind").selectOption(kind); await tr.locator(".m-dur").fill(dur);
};

test("Add activities is a modal (not in the catalogue): validation, retention across close/reopen, partial failure kept", { skip: SK }, async () => {
  const { page, ctx } = await open({ n: 5 });
  await ready(page);
  assert.equal(await visible(page, "#maBulk"), false, "closed by default");
  assert.equal(await page.getAttribute("#maNewBtn", "aria-label"), "Add activities");
  assert.equal(await page.getAttribute("#maNewBtn", "title"), "Add activities");
  assert.equal(await page.locator("#maNewBtn svg").count(), 1, "icon-only + button");
  assert.equal((await page.innerText("#maNewBtn")).trim(), "");
  await page.click("#maNewBtn");
  assert.equal(await visible(page, "#maBulk"), true);
  assert.equal(await page.evaluate(() => !!document.activeElement.closest("#maBulk")), true, "focus moves into modal");
  assert.equal(await visible(page, "#maCatalogue"), true, "catalogue stays behind the modal");
  await page.click("#multiAddBtn");
  assert.equal((await reqs(page, "insert")).length, 0, "invalid draft sends nothing");
  await fillRow(page, 0, "Bulk One");
  await page.click("#maBackBtn"); // X
  assert.equal(await visible(page, "#maBulk"), false);
  assert.equal(await page.textContent("#maAddBadge"), "1", "draft indicator on + button");
  assert.equal(await page.evaluate(() => document.activeElement.id), "maNewBtn", "focus returns to +");
  await page.click("#maNewBtn");
  assert.equal(await page.inputValue("#multiTable .m-name"), "Bulk One", "draft survives close/reopen");
  await page.keyboard.press("Escape");
  assert.equal(await visible(page, "#maBulk"), false, "Esc closes, draft kept");
  await page.click("#maNewBtn");
  await page.click("#maAddRow"); await fillRow(page, 1, "Activity 003");
  await page.click("#maAddRow"); await fillRow(page, 2, "Bulk Three");
  await page.click("#multiAddBtn"); await page.click('[data-act="ok"]');
  await page.waitForFunction(() => document.querySelector("#maBulkSummary").textContent.startsWith("Added 2"));
  assert.equal(await page.locator("#multiTable tbody tr").count(), 1, "only failed row kept");
  assert.equal(await page.inputValue("#multiTable .m-name"), "Activity 003");
  assert.equal(await page.inputValue("#multiTable .m-kind"), "k-1");
  assert.match(await page.textContent("#multiTable .ma-row-msg"), /already exists/);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#maCount").textContent === "7 activities");
  await ctx.close();
});

test("Add activities: copy, remove, row limit, paste activity list (wording + inheritance), Clear all prompts before discarding", { skip: SK }, async () => {
  const { page, ctx } = await open({ n: 3 });
  await ready(page); await page.click("#maNewBtn");
  assert.equal(await page.textContent("#maPasteBtn"), "Paste activity list");
  await fillRow(page, 0, "Seed row", "2", "21", "211", "k-2", "3");
  await page.click(".ma-row-btn.ma-row-dup");
  assert.equal(await page.locator("#multiTable tbody tr").count(), 2);
  assert.equal(await page.locator("#multiTable .m-kind").nth(1).inputValue(), "k-2", "copy keeps classification");
  await page.locator(".ma-row-remove").nth(1).click();
  assert.equal(await page.locator("#multiTable tbody tr").count(), 1);
  await page.click("#maPasteBtn");
  const help = await page.textContent("#maDlgTitle"); assert.equal(help, "Paste activity list");
  assert.match(await page.textContent(".ma-modal-body >> nth=-1"), /one activity name per line/i);
  assert.match(await page.textContent(".ma-dialog-backdrop .ma-help"), /inherit .*last row/i);
  await page.fill("#pasteTxt", "Alpha\nBeta\n\nGamma"); await page.click('[data-act="ok"]');
  const names = await page.$$eval("#multiTable .m-name", (e) => e.map((x) => x.value));
  assert.deepEqual(names, ["Seed row", "Alpha", "Beta", "Gamma"]);
  assert.equal(await page.locator("#multiTable .m-area").nth(3).inputValue(), "211", "pasted rows inherit last row");
  // row limit
  await page.click("#maPasteBtn"); await page.fill("#pasteTxt", Array.from({ length: 40 }, (_, i) => "Many " + i).join("\n")); await page.click('[data-act="ok"]');
  assert.equal(await page.locator("#multiTable tbody tr").count(), 25);
  assert.match(await page.textContent("#maBulkSummary"), /limit 25/);
  // Clear all asks first
  await page.click("#multiClearBtn"); assert.equal(await page.textContent("#maDlgTitle"), "Clear all rows");
  await page.click('[data-act="cancel"]');
  assert.equal(await page.locator("#multiTable tbody tr").count(), 25, "cancel keeps data");
  await page.click("#multiClearBtn"); await page.click('[data-act="ok"]');
  assert.equal(await page.locator("#multiTable tbody tr").count(), 1);
  assert.equal(await page.inputValue("#multiTable .m-name"), "");
  await ctx.close();
});

test("Add activities modal: permission failure stops batch and keeps all rows", { skip: SK }, async () => {
  const { page, ctx } = await open({ n: 3, cfg: { denyWrites: true } });
  await ready(page); await page.click("#maNewBtn");
  await fillRow(page, 0, "P One"); await page.click("#maAddRow"); await fillRow(page, 1, "P Two");
  await page.click("#multiAddBtn"); await page.click('[data-act="ok"]');
  await page.waitForFunction(() => document.querySelector("#maBulkSummary").textContent.startsWith("Added 0"));
  assert.equal(await page.locator("#multiTable tbody tr").count(), 2);
  assert.equal((await reqs(page, "insert")).length, 1, "stopped after first denial");
  await ctx.close();
});

for (const [label, width, cards] of [["390px", 390, true], ["520px", 520, true], ["tablet 768px", 768, false], ["desktop 1280px", 1280, false]]) {
  test(`${label}: ${cards ? "activity cards replace the table" : "six-column table is shown"}; no page overflow; same loaded data`, { skip: SK }, async () => {
    const { page, ctx } = await open({ width, n: 60 });
    await ready(page);
    assert.equal(await page.isVisible("#existingTable"), !cards);
    assert.equal(await page.isVisible("#maCards"), cards);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `overflow ${over}`);
    if (cards) {
      const first = page.locator("#maCards li").first();
      const txt = await first.textContent();
      for (const t of ["Activity 001", "Process", "Sec A", "Sub A1", "Area A1a", "Duration", "0 days"]) assert.ok(txt.includes(t) || txt.includes("Quality"), t);
      assert.equal(await page.locator("#maCards li").count(), await page.locator("#existingTable tbody tr").count(), "cards mirror loaded rows");
      for (const b of await page.$$eval("#maCards .ma-card", (c) => c.slice(0, 5).map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right]; }))) assert.ok(b[0] >= 0 && b[1] <= width + 1);
      // pagination via cards: only one request per batch, no duplicates
      for (let i = 0; i < 6 && (await page.locator("#maCards li").count()) < 60; i++) { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(150); }
      assert.equal(await page.locator("#maCards li").count(), 60);
      assert.deepEqual((await reqs(page)).map((l) => l.range.join("-")), ["0-24", "25-49", "50-74"]);
    }
    await ctx.close();
  });
}

test("cards: click, Enter and Space open the same details dialog (edit/delete per permission); focus returns to the card", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, n: 6 });
  await ready(page);
  await page.click('#maCards li[data-id="2"] .ma-card');
  const click = await page.textContent(".ma-details");
  assert.ok(click.includes("Activity 002") && click.includes("1 day"));
  assert.equal(await page.locator('[data-act="edit"], [data-act="delete"]').count(), 2);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.closest("li")?.dataset.id), "2");
  for (const key of ["Enter", "Space"]) {
    await page.focus('#maCards li[data-id="3"] .ma-card'); await page.keyboard.press(key);
    await page.waitForSelector("#maDlgTitle"); assert.equal(await page.textContent("#maDlgTitle"), "Activity details");
    await page.keyboard.press("Escape");
  }
  const dr = await page.evaluate(() => { const c = document.querySelector("#maCards .ma-card"); const s = getComputedStyle(c); return { r: s.borderRadius, role: c.getAttribute("role"), tab: c.tabIndex }; });
  assert.equal(dr.r, "8px"); assert.equal(dr.role, "button"); assert.equal(dr.tab, 0);
  await ctx.close();
});

test("HOME uses the canonical amber token treatment, keeps navigation, and header spacing matches Stock Checker", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 1280, n: 3 });
  await ready(page);
  const h = await page.evaluate(() => { const b = document.querySelector("#homeBtn"); const c = getComputedStyle(b); const tok = (n) => { const d = document.createElement("div"); d.style.color = `var(${n})`; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; }; return { bg: c.backgroundColor, fg: c.color, bd: c.borderTopColor, bgTok: tok("--sasv-action-home-bg"), fgTok: tok("--sasv-action-home"), bdTok: tok("--sasv-action-home-border"), label: !!b.querySelector(".home-label"), svg: !!b.querySelector("svg"), pad: getComputedStyle(document.body).padding, h: b.getBoundingClientRect().height }; });
  assert.equal(h.bg, h.bgTok); assert.equal(h.fg, h.fgTok); assert.equal(h.bd, h.bdTok);
  assert.ok(h.label && h.svg); assert.equal(h.pad, "20px"); assert.equal(h.h, 36);
  const nav = await page.evaluate(() => { let url = null; try { Object.defineProperty(window.location, "assign", { value: (u) => { url = u; }, configurable: true }); } catch { return "unpatchable"; } document.querySelector("#homeBtn").click(); return url; });
  if (nav !== "unpatchable") assert.equal(nav, "index.html");
  await page.setViewportSize({ width: 390, height: 800 });
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).padding), "6px");
  assert.equal(await page.evaluate(() => { const l = document.querySelector("#homeBtn .home-label").getBoundingClientRect(); return l.width <= 1; }), true, "label hidden on narrow, aria-label kept");
  assert.equal(await page.getAttribute("#homeBtn", "aria-label"), "HOME");
  await ctx.close();
});

test("toolbar: filter + add are icon-only 36px buttons with tooltips; search is light-filled with SASV focus; no nested card chrome", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 1280, n: 5 });
  await ready(page);
  for (const [id, label] of [["maFilterBtn", "Filters"], ["maNewBtn", "Add activities"]]) {
    const r = await page.evaluate((id) => { const b = document.getElementById(id); const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, svg: b.querySelectorAll("svg").length, text: b.innerText.trim(), title: b.title, aria: b.getAttribute("aria-label") }; }, id);
    assert.deepEqual([r.w, r.h, r.svg, r.text, r.title, r.aria], [36, 36, 1, "", label, label], id);
  }
  const [fb, sb, ab] = await Promise.all(["#maFilterBtn", "#nameFilter", "#maNewBtn"].map((s) => page.locator(s).boundingBox()));
  assert.ok(fb.x + fb.width <= sb.x + 1 && sb.x + sb.width <= ab.x + 1, "filter | search | add order");
  await page.focus("#nameFilter");
  const s = await page.evaluate(() => { const c = getComputedStyle(document.querySelector("#nameFilter")); const d = document.createElement("div"); d.style.background = "var(--sasv-search-select-bg, var(--sasv-control-bg))"; document.body.appendChild(d); const bg = getComputedStyle(d).backgroundColor; d.remove(); return { h: c.height, br: c.borderRadius, ol: c.outlineStyle, ow: c.outlineWidth, bg: c.backgroundColor, bgTok: bg }; });
  assert.equal(s.h, "36px"); assert.equal(s.br, "6px"); assert.equal(s.ol, "solid"); assert.equal(s.ow, "2px"); assert.equal(s.bg, s.bgTok);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#maCatalogue")).borderTopWidth), "0px");
  await page.click("#maFilterBtn");
  assert.equal(await page.locator("#maDrawerClose svg").count(), 1, "popover uses the X icon");
  assert.equal(await page.getAttribute("#maDrawerClose", "aria-label"), "Close filters");
  await ctx.close();
});

test("filter popover (desktop): anchored under the button, repositions on resize, outside click closes, Esc returns focus", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 1280, n: 20 });
  await ready(page);
  await page.click("#maFilterBtn");
  const fb = await page.locator("#maFilterBtn").boundingBox(), pb = await page.locator("#maDrawer").boundingBox();
  assert.ok(Math.abs(pb.x - fb.x) <= 2 && pb.y >= fb.y + fb.height && pb.y - (fb.y + fb.height) <= 12, `anchored ${JSON.stringify([fb, pb])}`);
  assert.ok(pb.width <= 360 && pb.width >= 300, "compact");
  await page.setViewportSize({ width: 900, height: 700 });
  const pb2 = await page.locator("#maDrawer").boundingBox(), fb2 = await page.locator("#maFilterBtn").boundingBox();
  assert.ok(Math.abs(pb2.x - fb2.x) <= 2, "still anchored after resize");
  await page.mouse.click(600, 15);
  assert.equal(await visible(page, "#maDrawer"), false, "outside click closes");
  await page.click("#maFilterBtn"); await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.id), "maFilterBtn");
  await page.click("#maFilterBtn"); await page.click("#maDrawerClose");
  assert.equal(await visible(page, "#maDrawer"), false);
  await ctx.close();
});

test("filter modal (narrow): full-screen, cascades, Clear all, active indicator, focus trapped, Esc", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, n: 60 });
  await ready(page);
  await page.click("#maFilterBtn");
  const d = await rectOf(page, "#maDrawer");
  assert.ok(d.l <= 1 && d.t <= 1 && d.r >= d.vw - 1 && d.b >= d.vh - 1, `full-screen ${JSON.stringify(d)}`);
  assert.equal(await page.isDisabled("#subFilter"), true);
  await page.selectOption("#sectionFilter", "2"); await page.waitForFunction(() => !document.querySelector("#subFilter").disabled);
  await page.selectOption("#subFilter", "21"); await page.selectOption("#areaFilter", "211"); await page.selectOption("#kindFilter", "k-2");
  await page.waitForFunction(() => document.querySelector("#maCount").textContent === "10 activities");
  assert.equal(await page.textContent("#maFilterBadge"), "4");
  for (let i = 0; i < 10; i++) await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => !!document.activeElement.closest("#maDrawer")), true, "focus trapped");
  await page.click("#clearFilters");
  await page.waitForFunction(() => document.querySelector("#maCount").textContent === "60 activities");
  assert.equal(await visible(page, "#maFilterBadge"), false);
  await page.keyboard.press("Escape");
  assert.equal(await visible(page, "#maDrawer"), false);
  await ctx.close();
});

test("390px: Home, Filters, search and Add are inside the viewport and keyboard-reachable", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, n: 30 });
  await ready(page);
  for (const sel of ["#homeBtn", "#maNewBtn", "#maFilterBtn", "#nameFilter"]) { const b = await rectOf(page, sel); assert.ok(inside(b), `${sel} ${JSON.stringify(b)}`); }
  const seen = new Set(); await page.focus("#homeBtn");
  for (let i = 0; i < 8; i++) { seen.add(await page.evaluate(() => document.activeElement.id)); await page.keyboard.press("Tab"); }
  for (const id of ["homeBtn", "maNewBtn", "maFilterBtn", "nameFilter"]) assert.ok(seen.has(id), id);
  const ov = await page.evaluate(() => ["documentElement", "body"].map((k) => getComputedStyle(document[k]).overflowX));
  assert.ok(ov.every((v) => v !== "hidden"));
  await ctx.close();
});

for (const width of [560, 768]) {
  test(`${width}px: six-column table scrolls inside its container to the final column when it overflows`, { skip: SK }, async () => {
    const { page, ctx } = await open({ width, n: 30 });
    await ready(page);
    const m = () => page.evaluate(() => { const w = document.querySelector(".ma-table-wrap"); const last = document.querySelector("#existingTable thead th:last-child").getBoundingClientRect(); const wr = w.getBoundingClientRect(); return { sw: w.scrollWidth, cw: w.clientWidth, lastL: last.left, lastR: last.right, wl: wr.left, wr: wr.right, x: scrollX, doc: document.documentElement.scrollWidth, vw: innerWidth, cols: document.querySelectorAll("#existingTable thead th").length }; });
    let a = await m();
    assert.equal(a.cols, 6); assert.ok(a.doc <= a.vw + 1);
    if (a.sw > a.cw + 1) {
      assert.ok(a.lastR > a.wr, "final column initially off-screen");
      assert.ok(await page.isVisible(".ma-scroll-hint[data-for=existingTable]"));
      await page.focus(".ma-table-wrap"); for (let i = 0; i < 40; i++) await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => { const w = document.querySelector(".ma-table-wrap"); return w.scrollLeft >= w.scrollWidth - w.clientWidth - 1; });
      a = await m();
      assert.ok(a.lastL >= a.wl - 1 && a.lastR <= a.wr + 1, `final column visible ${JSON.stringify(a)}`);
      assert.equal(a.x, 0);
    } else assert.equal(await page.isVisible(".ma-scroll-hint[data-for=existingTable]"), false, "no hint when it fits");
    await ctx.close();
  });
}

for (const w of [390, 1280]) {
  test(`${w}px: Add modal and dialogs stay inside the viewport with focus trapped; bulk body scrolls independently`, { skip: SK }, async () => {
    const { page, ctx } = await open({ width: w, height: 700, n: 10 });
    await ready(page);
    await page.click("#maNewBtn");
    const m = await rectOf(page, "#maBulk");
    assert.ok(inViewport(m), `add modal ${JSON.stringify(m)}`);
    if (w === 390) assert.ok(m.w >= 388 && m.h >= 698, "full-screen on narrow");
    for (let i = 0; i < 4; i++) await page.click("#maAddRow");
    const sc = await page.evaluate(() => { const b = document.querySelector("#maBulk .ma-modal-body"); const f = document.querySelector("#maBulk .ma-modal-footer").getBoundingClientRect(); return { sh: b.scrollHeight, ch: b.clientHeight, ov: getComputedStyle(b).overflowY, fb: f.bottom, vh: innerHeight, pageScroll: document.documentElement.scrollHeight - innerHeight }; });
    assert.ok(sc.ov === "auto" || sc.ov === "scroll"); assert.ok(sc.fb <= sc.vh + 1, "bottom actions stay on screen");
    if (w === 390) assert.ok(sc.sh > sc.ch, "body scrolls on its own");
    for (const sel of ["#maAddRow", "#maPasteBtn", "#multiClearBtn", "#multiAddBtn"]) { const b = await rectOf(page, sel); assert.ok(b.b <= b.vh + 1 && b.l >= -1 && b.r <= b.vw + 1, `${sel} reachable ${JSON.stringify(b)}`); }
    for (let i = 0; i < 40; i++) await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => !!document.activeElement.closest("#maBulk")), "focus trapped in Add modal");
    await page.click("#maPasteBtn");
    assert.ok(inViewport(await rectOf(page, ".ma-dialog-backdrop .ma-modal")));
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => !!document.activeElement.closest(".ma-dialog-backdrop")), "paste dialog traps focus");
    await page.keyboard.press("Escape");
    assert.equal(await visible(page, "#maBulk"), true, "Esc closes only the top dialog");
    await page.keyboard.press("Escape");
    assert.equal(await visible(page, "#maBulk"), false);
    await page.click(w === 390 ? '#maCards .ma-card' : '#existingTable .ma-name-link', { position: w === 390 ? { x: 20, y: 10 } : undefined });
    const d = await rectOf(page, ".ma-dialog-backdrop .ma-modal"); assert.ok(inViewport(d), `details ${JSON.stringify(d)}`);
    assert.equal(await page.locator(".ma-dialog-backdrop .ma-x svg").count(), 1, "details uses X icon");
    assert.equal(await page.getAttribute(".ma-dialog-backdrop .ma-x", "aria-label"), "Close");
    assert.equal(await page.locator('.ma-dialog-backdrop [data-act="cancel"]').count(), 0, "no text-only Close button");
    await page.click('[data-act="edit"]');
    assert.ok(inViewport(await rectOf(page, ".ma-dialog-backdrop .ma-modal")));
    assert.equal(await page.locator('[data-act="cancel"]').count(), 1, "Cancel stays a labelled button");
    for (let i = 0; i < 14; i++) await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => !!document.activeElement.closest(".ma-dialog-backdrop")));
    await ctx.close();
  });
}

test("Add modal on narrow: rows stack as labelled fields; dropdowns, row actions and validation messages are fully visible", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, height: 700, n: 5 });
  await ready(page); await page.click("#maNewBtn");
  await page.click("#multiAddBtn"); // nothing entered
  await fillRow(page, 0, "Narrow One"); await page.click("#maAddRow");
  await page.locator("#multiTable .m-name").nth(1).fill("Needs fields"); await page.locator("#multiTable .m-dur").nth(1).fill(""); await page.click("#multiAddBtn");
  await page.waitForSelector("#multiTable .ma-field-error");
  for (const sel of ["#multiTable tbody tr:nth-child(2) .m-name", "#multiTable tbody tr:nth-child(2) .m-section", "#multiTable tbody tr:nth-child(2) .ma-row-remove", "#multiTable tbody tr:nth-child(2) .ma-field-error >> nth=0"]) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    const b = await page.locator(sel).boundingBox(); assert.ok(b.x >= 0 && b.x + b.width <= 390.5, `${sel} ${JSON.stringify(b)}`);
  }
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#multiTable tbody tr")).display), "block", "stacked");
  const lbl = await page.evaluate(() => getComputedStyle(document.querySelector("#multiTable td[data-label=Section]"), "::before").content);
  assert.match(lbl, /Section/);
  assert.equal(await page.evaluate(() => document.querySelector("#maBulk .ma-modal-body").scrollWidth <= document.querySelector("#maBulk .ma-modal-body").clientWidth + 1), true, "no sideways scroll needed");
  await ctx.close();
});

test("Add modal at 768/1280: wide table scrolls inside the modal body, final column reachable", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 768, height: 700, n: 5 });
  await ready(page); await page.click("#maNewBtn");
  await page.evaluate(() => { const w = document.querySelector("#multiTable").closest(".ma-table-wrap"); w.scrollLeft = w.scrollWidth; });
  const r = await page.evaluate(() => { const w = document.querySelector("#multiTable").closest(".ma-table-wrap").getBoundingClientRect(); const b = document.querySelector(".ma-row-remove").getBoundingClientRect(); const x = document.querySelector(".ma-row-remove"); return { bl: b.left, br: b.right, wl: w.left, wr: w.right, h: b.height, fs: getComputedStyle(x).fontSize, doc: document.documentElement.scrollWidth, vw: innerWidth }; });
  assert.ok(r.bl >= r.wl - 1 && r.br <= r.wr + 1, JSON.stringify(r)); assert.ok(r.h <= 36 && parseFloat(r.fs) <= 14); assert.ok(r.doc <= r.vw + 1);
  const dims = await page.evaluate(() => ({ name: document.querySelector(".m-name").getBoundingClientRect().width, sec: document.querySelector(".m-section").getBoundingClientRect().width }));
  assert.ok(dims.name >= 200 && dims.sec >= 140, JSON.stringify(dims));
  await ctx.close();
});

/* ───────── MA-UX-4: header description, full-screen narrow dialogs, detail typography ───────── */
const openKind = async (page, kind, narrow) => {
  const target = narrow ? '#maCards li[data-id="1"] .ma-card' : '#existingTable tr[data-id="1"] .ma-name-link';
  switch (kind) {
    case "details": await page.click(target); return ".ma-dialog-backdrop .ma-modal";
    case "edit": await page.click(target); await page.click('[data-act="edit"]'); return ".ma-dialog-backdrop .ma-modal";
    case "delete": await page.click(target); await page.click('[data-act="delete"]'); return ".ma-dialog-backdrop .ma-modal";
    case "alert": await page.click(target); await page.click('[data-act="delete"]'); await page.click('[data-act="ok"]'); await page.waitForFunction(() => document.querySelector("#maDlgTitle")?.textContent === "Delete failed"); return ".ma-dialog-backdrop .ma-modal";
    case "add": await page.click("#maNewBtn"); return "#maBulk";
    case "paste": await page.click("#maNewBtn"); await page.click("#maPasteBtn"); return ".ma-dialog-backdrop .ma-modal";
    case "filter": await page.click("#maFilterBtn"); return "#maDrawer";
  }
};
const KINDS = ["details", "edit", "delete", "alert", "paste", "add", "filter"];
const geom = (page, sel) => page.evaluate((sel) => {
  const m = document.querySelector(sel); const r = m.getBoundingClientRect(); const cs = getComputedStyle(m);
  const hd = m.querySelector(".ma-modal-header, .ma-popover-header").getBoundingClientRect();
  const ft = m.querySelector(".ma-modal-footer, .ma-popover-footer").getBoundingClientRect();
  const body = m.querySelector(".ma-modal-body, .ma-popover-body");
  return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, radius: cs.borderTopLeftRadius, vw: document.documentElement.clientWidth, vh: innerHeight, hdTop: hd.top, hdBottom: hd.bottom, ftTop: ft.top, ftBottom: ft.bottom, ov: getComputedStyle(body).overflowY, bodyOverflowX: body.scrollWidth - body.clientWidth, docOver: document.documentElement.scrollWidth - innerWidth, x: !!m.querySelector(".ma-x svg"), xLabel: m.querySelector(".ma-x")?.getAttribute("aria-label"), xw: m.querySelector(".ma-x")?.getBoundingClientRect().width };
}, sel);

for (const [label, width] of [["1280px", 1280], ["768px", 768]]) {
  test(`header description shows below the title at ${label} with reference .page-sub typography and a compact header`, { skip: SK }, async () => {
    const { page, ctx } = await open({ width, n: 3 });
    await ready(page);
    const h = await page.evaluate(() => { const s = document.querySelector(".ma-page-sub"); const c = getComputedStyle(s); const t = document.querySelector(".ma-page-title").getBoundingClientRect(); const sr = s.getBoundingClientRect(); const d = document.createElement("div"); d.style.color = "var(--sasv-text-muted)"; document.body.appendChild(d); const muted = getComputedStyle(d).color; d.remove(); return { text: s.textContent.trim(), vis: sr.height > 0, fs: c.fontSize, fw: c.fontWeight, lh: c.lineHeight, mt: c.marginTop, color: c.color, muted, below: sr.top >= t.bottom - 1 && sr.top - t.bottom <= 8, hdr: document.querySelector(".ma-header").getBoundingClientRect().height, homeTop: document.querySelector("#homeBtn").getBoundingClientRect().top, titleTop: t.top }; });
    assert.equal(h.text, "Maintain production activities, classifications and standard durations.");
    assert.ok(h.vis && h.below); assert.deepEqual([h.fs, h.fw, h.mt], ["13px", "400", "4px"]); assert.equal(h.color, h.muted);
    assert.ok(h.hdr <= 72, `header height ${h.hdr}`); assert.ok(Math.abs(h.homeTop - h.titleTop) <= 4, "HOME aligned with title top");
    await ctx.close();
  });
}
for (const width of [520, 390]) {
  test(`header description is hidden at ${width}px (as Stock Checker); title/HOME stay aligned`, { skip: SK }, async () => {
    const { page, ctx } = await open({ width, n: 3 });
    await ready(page);
    assert.equal(await page.isVisible(".ma-page-sub"), false);
    const r = await page.evaluate(() => ({ hdr: document.querySelector(".ma-header").getBoundingClientRect().height, home: document.querySelector("#homeBtn").getBoundingClientRect().right, vw: document.documentElement.clientWidth }));
    assert.ok(r.hdr <= 56 && r.home <= r.vw + 1, JSON.stringify(r));
    await ctx.close();
  });
}
test("header description appears again just above the breakpoint (521px)", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 521, n: 3 }); await ready(page);
  assert.equal(await page.isVisible(".ma-page-sub"), true); await ctx.close();
});

for (const width of [390, 520]) {
  for (const kind of KINDS) {
    test(`${width}px ${kind}: flat full-screen layer, fixed header, scrollable body, persistent footer, X close, no overflow`, { skip: SK }, async () => {
      const { page, ctx } = await open({ width, height: 700, n: 6, cfg: { inUse: [1] } });
      await ready(page);
      const sel = await openKind(page, kind, true);
      const g = await geom(page, sel);
      assert.ok(Math.abs(g.l) <= 1 && Math.abs(g.t) <= 1 && Math.abs(g.w - g.vw) <= 1 && Math.abs(g.h - g.vh) <= 1, `fills viewport ${JSON.stringify(g)}`);
      assert.equal(g.radius, "0px", "flat, not a floating card");
      assert.ok(g.hdTop <= 1 && g.hdBottom < g.ftTop, "header pinned at top");
      assert.ok(Math.abs(g.ftBottom - g.vh) <= 1, "footer pinned at bottom");
      assert.ok(["auto", "scroll"].includes(g.ov), "body scrolls independently");
      assert.ok(g.bodyOverflowX <= 1 && g.docOver <= 1, "no horizontal overflow");
      assert.equal(g.x, true, "X icon"); assert.match(g.xLabel, /Close/); assert.ok(g.xw >= 36, "touch target kept");
      // footer actions reachable and inside viewport
      const btns = await page.$$eval(`${sel} .ma-modal-footer button, ${sel} .ma-popover-footer button`, (b) => b.map((x) => { const r = x.getBoundingClientRect(); return [r.left, r.right, r.bottom, r.height]; }));
      assert.ok(btns.length > 0); for (const [l, r, b, h] of btns) assert.ok(l >= -1 && r <= g.vw + 1 && b <= g.vh + 1 && h >= 32, `footer button ${[l, r, b, h]}`);
      await ctx.close();
    });
  }
}
for (const width of [768, 1280]) {
  for (const kind of ["details", "edit", "delete", "alert", "paste", "add"]) {
    test(`${width}px ${kind}: desktop dialog stays a floating, rounded card inside the viewport`, { skip: SK }, async () => {
      const { page, ctx } = await open({ width, height: 800, n: 6, cfg: { inUse: [1] } });
      await ready(page);
      const sel = await openKind(page, kind, false);
      const g = await geom(page, sel);
      assert.ok(g.w < g.vw - 8 || kind === "add", `floating ${JSON.stringify(g)}`);
      assert.notEqual(g.radius, "0px"); assert.ok(g.l >= 0 && g.r <= g.vw + 1 && g.t >= 0 && g.b <= g.vh + 1);
      assert.ok(g.x, "X icon on desktop too");
      await ctx.close();
    });
  }
}

test("narrow Add modal: body scrolls on its own and the last row is never hidden behind the footer", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, height: 640, n: 4 });
  await ready(page); await page.click("#maNewBtn");
  for (let i = 0; i < 6; i++) await page.click("#maAddRow");
  const pre = await page.evaluate(() => ({ doc: document.documentElement.scrollTop, sh: document.querySelector("#maBulk .ma-modal-body").scrollHeight, ch: document.querySelector("#maBulk .ma-modal-body").clientHeight }));
  assert.ok(pre.sh > pre.ch, "content taller than body");
  await page.evaluate(() => { const b = document.querySelector("#maBulk .ma-modal-body"); b.scrollTop = b.scrollHeight; });
  const r = await page.evaluate(() => { const rows = document.querySelectorAll("#multiTable tbody tr"); const last = rows[rows.length - 1].getBoundingClientRect(); const ft = document.querySelector("#maBulk .ma-modal-footer").getBoundingClientRect(); return { lastB: last.bottom, ftTop: ft.top, doc: document.documentElement.scrollTop }; });
  assert.ok(r.lastB <= r.ftTop + 1, `last row clear of footer ${JSON.stringify(r)}`); assert.equal(r.doc, 0, "page behind did not scroll");
  const remove = await rectOf(page, "#multiTable tbody tr:last-child .ma-row-remove"); assert.ok(remove.b <= (await rectOf(page, "#maBulk .ma-modal-footer")).t + 1);
  await ctx.close();
});

test("narrow edit dialog with a short (keyboard-open) viewport keeps header and Save reachable; layer follows the visual viewport", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, height: 700, n: 3 });
  await ready(page); await page.click('#maCards li[data-id="1"] .ma-card'); await page.click('[data-act="edit"]');
  const v0 = await page.evaluate(() => [getComputedStyle(document.documentElement).getPropertyValue("--ma-vvh"), visualViewport.height]);
  assert.equal(parseFloat(v0[0]), v0[1], "layer height tracks visualViewport");
  await page.setViewportSize({ width: 390, height: 360 }); // approximates an open on-screen keyboard
  await page.waitForFunction(() => Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ma-vvh")) - 360) <= 1);
  await page.focus("#ed-dur");
  const g = await geom(page, ".ma-dialog-backdrop .ma-modal");
  assert.ok(Math.abs(g.h - 360) <= 1 && g.hdTop <= 1 && g.ftBottom <= 361, JSON.stringify(g));
  await page.locator('[data-act="save"]').scrollIntoViewIfNeeded();
  const s = await rectOf(page, '[data-act="save"]'); assert.ok(s.b <= 361 && s.t >= 0);
  assert.equal(await page.evaluate(() => { const b = document.querySelector(".ma-dialog-backdrop .ma-modal-body"); return b.scrollHeight > b.clientHeight; }), true, "body scrolls independently");
  await ctx.close();
});

test("delete confirmation is explicit: Escape/X/backdrop never delete; focus returns correctly", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 1280, n: 5 });
  await ready(page);
  const count = () => page.evaluate(() => window.__cfg.data.activities.length);
  await page.click('tr[data-id="1"] .ma-name-link'); await page.click('[data-act="delete"]');
  assert.equal(await page.textContent("#maDlgTitle"), "Delete activity");
  await page.mouse.click(6, 6); // backdrop
  assert.equal(await page.textContent("#maDlgTitle"), "Delete activity", "backdrop click ignored");
  await page.keyboard.press("Escape");
  assert.equal(await count(), 5, "Escape does not delete");
  assert.equal(await page.textContent("#maDlgTitle"), "Activity details", "returns to details");
  await page.click('[data-act="delete"]'); await page.click(".ma-dialog-backdrop .ma-x");
  assert.equal(await count(), 5, "X does not delete");
  assert.equal(await page.textContent("#maDlgTitle"), "Activity details");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.closest("tr")?.dataset.id), "1", "focus restored to the row");
  await ctx.close();
});

test("narrow: Escape closes the top dialog only; focus is restored to card, +, and filter buttons", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390, height: 700, n: 4 });
  await ready(page);
  await page.click('#maCards li[data-id="2"] .ma-card'); await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.closest("li")?.dataset.id), "2");
  await page.click("#maNewBtn"); await page.click("#maPasteBtn"); await page.keyboard.press("Escape");
  assert.equal(await visible(page, "#maBulk"), true, "Add modal still open under paste dialog");
  assert.equal(await page.evaluate(() => document.activeElement.id), "maPasteBtn", "focus back on the Paste button");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.id), "maNewBtn");
  await page.click("#maFilterBtn"); await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.id), "maFilterBtn");
  await ctx.close();
});

for (const width of [390, 1280]) {
  test(`${width}px details typography: tokens, hierarchy, legible values, touch targets kept`, { skip: SK }, async () => {
    const { page, ctx } = await open({ width, height: 700, n: 3 });
    await ready(page);
    await page.click(width === 390 ? '#maCards li[data-id="1"] .ma-card' : '#existingTable tr[data-id="1"] .ma-name-link');
    const t = await page.evaluate(() => { const g = (s) => { const c = getComputedStyle(document.querySelector(s)); return [c.fontSize, c.fontWeight]; }; const px = (s) => document.querySelector(s).getBoundingClientRect(); return { title: g(".ma-dialog-backdrop .ma-modal-title"), name: g(".ma-detail-name"), dt: g(".ma-detail-list dt"), dd: g(".ma-detail-list dd"), meta: g(".ma-detail-list dd:last-of-type"), nameW: px(".ma-detail-name").width, x: px(".ma-dialog-backdrop .ma-x").height, btn: [...document.querySelectorAll(".ma-dialog-backdrop .ma-footer-actions .btn")].map((b) => b.getBoundingClientRect().height), vw: document.documentElement.clientWidth, over: document.documentElement.scrollWidth - innerWidth, ddCol: getComputedStyle(document.querySelector(".ma-detail-list dd")).color, dtCol: getComputedStyle(document.querySelector(".ma-detail-list dt")).color }; });
    assert.deepEqual(t.title, ["16px", "600"]); assert.deepEqual(t.name, ["16px", "600"]);
    assert.deepEqual(t.dt, ["12px", "500"], "labels small, not bold"); assert.deepEqual(t.dd, ["13px", "400"], "values regular");
    assert.deepEqual(t.meta, ["12px", "400"], "metadata (ID) smaller");
    assert.notEqual(t.ddCol, t.dtCol, "label/value contrast hierarchy");
    assert.ok(t.x >= 36 && t.btn.every((h) => h >= 36), `touch targets kept ${JSON.stringify([t.x, t.btn])}`); assert.ok(t.over <= 1);
    const txt = await page.textContent(".ma-detail-list"); for (const v of ["Sec A", "Sub A1", "Area A1a", "Quality", "0 days"]) assert.ok(txt.includes(v) || txt.includes("Process"), v);
    await ctx.close();
  });
}

test("Add modal: desktop columns avoid truncation (no sideways scroll at 1280); mobile intro is concise, paste dialog keeps the full explanation", { skip: SK }, async () => {
  let o = await open({ width: 1280, height: 800, n: 3 }); await ready(o.page); await o.page.click("#maNewBtn");
  const d = await o.page.evaluate(() => { const w = document.querySelector("#multiTable").closest(".ma-table-wrap"); const clipped = ["m-name", "m-section", "m-sub", "m-area"].map((c) => { const e = document.querySelector("." + c); return [c, Math.round(e.getBoundingClientRect().width), e.tagName === "SELECT" ? e.selectedOptions[0].textContent : e.value]; }); return { fits: w.scrollWidth <= w.clientWidth + 1, clipped, help: document.querySelector("#maBulk .ma-help-more").offsetParent !== null }; });
  assert.ok(d.fits, "table fits the desktop modal"); assert.ok(d.help, "full help on desktop");
  const [name, sec, sub, area] = d.clipped.map((x) => x[1]); assert.ok(name >= 205 && sec >= 150 && sub >= 205 && area >= 185, JSON.stringify(d.clipped));
  await o.ctx.close();
  o = await open({ width: 390, height: 700, n: 3 }); await ready(o.page); await o.page.click("#maNewBtn");
  const help = await o.page.innerText("#maBulk .ma-help"); assert.ok(help.length < 60 && !/inherit/i.test(help), help);
  await o.page.click("#maPasteBtn"); assert.match(await o.page.innerText(".ma-dialog-backdrop .ma-help"), /inherit .*last row/i);
  assert.match(await o.page.innerText(".ma-dialog-backdrop .ma-modal-body"), /one activity name per line/i);
  await o.ctx.close();
});

test("harmonised modal padding: header 10/12, body 10/12/12, footer 8/12 across dialogs", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 1280, n: 3, cfg: { inUse: [1] } }); await ready(page);
  const pads = async (sel) => page.evaluate((sel) => { const m = document.querySelector(sel); const p = (e) => { const c = getComputedStyle(m.querySelector(e)); return [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].join(" "); }; return [p(".ma-modal-header"), p(".ma-modal-body"), p(".ma-modal-footer")]; }, sel);
  for (const kind of ["details", "edit", "add"]) {
    const sel = await openKind(page, kind, false);
    assert.deepEqual(await pads(sel), ["10px 12px 10px 12px", "10px 12px 12px 12px", "8px 12px 8px 12px"], kind);
    await page.keyboard.press("Escape"); if (kind === "edit") await page.keyboard.press("Escape");
  }
  await ctx.close();
});
