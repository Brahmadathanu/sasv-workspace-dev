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

async function open({ view = true, edit = true, n = 60, cfg = {}, width = 1280, noObserver = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
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
const SK = !chromium && "Playwright unavailable";

const ready = (p) => p.waitForSelector("#existingTable tbody tr");
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

test("filter drawer is usable at 390px and traps Tab", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390 });
  await ready(page);
  await page.click("#maFilterBtn");
  const box = await page.locator("#maDrawer").boundingBox();
  assert.ok(box.width <= 390 && box.x >= 0);
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => !!document.activeElement.closest("#maDrawer")), true, "focus stays in drawer");
  await page.click("#maDrawerDone");
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
  await page.waitForFunction(() => document.querySelector(".modal-body")?.textContent.includes("in use"));
  assert.equal(await page.evaluate(() => window.__cfg.data.activities.length), 4);
  await ctx.close();
});

test("bulk entry lives outside the catalogue; validation, row-level error preservation, Back keeps drafts", { skip: SK }, async () => {
  const { page, ctx } = await open({ n: 5 });
  await ready(page);
  assert.equal(await page.isHidden("#maBulk"), true, "not in default view");
  await page.click("#maNewBtn");
  assert.equal(await page.isHidden("#maCatalogue"), true);
  await page.click("#multiAddBtn");
  assert.equal((await reqs(page, "insert")).length, 0);
  const fill = async (i, name) => {
    const tr = page.locator("#multiTable tbody tr").nth(i);
    await tr.locator(".m-name").fill(name); await tr.locator(".m-section").selectOption("1");
    await tr.locator(".m-sub").selectOption("11"); await tr.locator(".m-area").selectOption("111");
    await tr.locator(".m-kind").selectOption("k-1"); await tr.locator(".m-dur").fill("2");
  };
  await fill(0, "Bulk One");
  await page.click("#maBackBtn"); await page.click("#maNewBtn");
  assert.equal(await page.inputValue("#multiTable .m-name"), "Bulk One", "drafts survive view switch");
  await page.click("#maAddRow"); await fill(1, "Activity 003");
  await page.click("#maAddRow"); await fill(2, "Bulk Three");
  await page.click("#multiAddBtn"); await page.click('[data-act="ok"]');
  await page.waitForFunction(() => document.querySelector("#maBulkSummary").textContent.startsWith("Added 2"));
  assert.equal(await page.locator("#multiTable tbody tr").count(), 1);
  assert.equal(await page.inputValue("#multiTable .m-name"), "Activity 003");
  assert.match(await page.textContent("#multiTable .ma-row-msg"), /already exists/);
  await page.click("#maBackBtn");
  await page.waitForFunction(() => document.querySelector("#maCount").textContent === "7 activities");
  await ctx.close();
});

for (const [label, width] of [["390px", 390], ["desktop 1280px", 1280]]) {
  test(`layout ${label}: no horizontal page overflow; keyboard order filter→search→table`, { skip: SK }, async () => {
    const { page, ctx } = await open({ width, n: 30 });
    await ready(page);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `overflow ${over}px`);
    await page.focus("#maFilterBtn"); await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "nameFilter");
    await page.click("#maFilterBtn"); await page.keyboard.press("Escape");
    await page.click("#maNewBtn");
    const over2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over2 <= 1, `bulk overflow ${over2}px`);
    await ctx.close();
  });
}
