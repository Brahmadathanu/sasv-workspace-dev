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

async function open({ view = true, edit = true, n = 60, cfg = {}, width = 1280 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("https://esm.sh/**", (r) => r.fulfill({ contentType: "text/javascript", body: `import { createFake } from "${base}/scripts/manage-activities/fake-supabase.mjs"; export const createClient = () => createFake(window.__cfg);` }));
  await page.route("**/fonts/**", (r) => r.abort());
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

test("listing shows all records paged (25 default), count and pager", { skip: SK }, async () => {
  const { page, ctx, errors } = await open();
  await page.waitForSelector("#existingTable tbody tr");
  assert.equal((await rowsText(page)).length, 25);
  assert.equal(await page.textContent("#maCount"), "60 activities");
  assert.match(await page.textContent("#maPagerInfo"), /Showing 1–25 of 60/);
  assert.equal(await page.isDisabled("#maPrev"), true);
  await page.click("#maNext"); await page.click("#maNext");
  await page.waitForFunction(() => document.querySelector("#maPageLabel").textContent === "Page 3 of 3");
  assert.equal((await rowsText(page)).length, 10);
  assert.equal(await page.isDisabled("#maNext"), true);
  await page.selectOption("#maPageSize", "100");
  await page.waitForFunction(() => document.querySelectorAll("#existingTable tbody tr").length === 60);
  assert.deepEqual(errors, []); await ctx.close();
});

test("filters: section→sub→area cascade, kind, search, clear, empty state", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.waitForSelector("#existingTable tbody tr");
  assert.equal(await page.isDisabled("#subFilter"), true);
  await page.selectOption("#sectionFilter", "2");
  await page.waitForFunction(() => document.querySelector("#maCount").textContent === "30 activities");
  assert.equal(await page.isDisabled("#subFilter"), false);
  await page.selectOption("#subFilter", "21"); await page.selectOption("#areaFilter", "211");
  await page.selectOption("#kindFilter", "k-2");
  await page.waitForFunction(() => document.querySelector("#maCount").textContent === "10 activities");
  await page.fill("#nameFilter", "zzz-none");
  await page.waitForFunction(() => document.querySelector("#maEmpty").textContent.includes("No activities match"));
  await page.click("#clearFilters");
  await page.waitForFunction(() => document.querySelector("#maCount").textContent === "60 activities");
  assert.equal(await page.isDisabled("#subFilter"), true);
  await ctx.close();
});

test("read-only user: no create/edit/delete controls; no-view user denied", { skip: SK }, async () => {
  let o = await open({ edit: false });
  await page_ready(o.page);
  assert.equal(await o.page.locator(".edit-btn, .delete-btn").count(), 0);
  assert.equal(await o.page.isVisible("#maBulk"), false);
  assert.equal(await o.page.isVisible("#maNewBtn"), false);
  assert.match(await o.page.textContent("#maStatus"), /View only/);
  await o.ctx.close();
  o = await open({ view: false });
  await o.page.waitForFunction(() => document.querySelector("#maStatus").textContent.includes("do not have access"));
  assert.equal(await o.page.isVisible("#maMain"), false);
  assert.equal(await o.page.evaluate(() => window.__cfg.log?.some((l) => l.table === "activities") ?? false), false, "no activity reads when denied");
  await o.ctx.close();
  o = await open({ cfg: { rpcError: true } });
  await o.page.waitForFunction(() => document.querySelector("#maStatus").textContent.includes("Could not verify"));
  assert.equal(await o.page.isVisible("#maMain"), false, "fails closed");
  await o.ctx.close();
});
const page_ready = (p) => p.waitForSelector("#existingTable tbody tr");

test("list request failure shows error + Retry, which recovers", { skip: SK }, async () => {
  const { page, ctx } = await open({ cfg: { fail: { activities: { select: { message: "Failed to fetch" } } } } });
  await page.waitForFunction(() => document.querySelector("#maStatus").textContent.includes("Could not load"));
  await page.evaluate(() => { delete window.__cfg.fail; });
  await page.click("#maStatus button");
  await page_ready(page);
  assert.equal((await rowsText(page)).length, 25);
  await ctx.close();
});

test("edit: validation keeps dialog open, success saves, failure preserves input, Esc cancels", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page_ready(page);
  await page.click('tr[data-id="1"] .edit-btn');
  assert.equal(await page.inputValue("#ed-name"), "Activity 001");
  await page.fill("#ed-name", ""); await page.click('[data-act="save"]');
  assert.match(await page.textContent('[data-err="ed-name"]'), /required/);
  assert.equal(await page.evaluate(() => window.__cfg.log.filter((l) => l.op === "update").length), 0);
  await page.fill("#ed-name", "Edited One");
  await page.evaluate(() => { window.__cfg.silent = { update: true }; });
  await page.click('[data-act="save"]');
  await page.waitForSelector("#ed-msg:not([hidden])");
  assert.equal(await page.inputValue("#ed-name"), "Edited One", "input preserved after failure");
  await page.evaluate(() => { window.__cfg.silent = {}; });
  await page.click('[data-act="save"]');
  await page.waitForSelector("#maDlgTitle", { state: "detached" });
  assert.ok((await rowsText(page)).includes("Edited One") || await page.evaluate(() => window.__cfg.data.activities[0].activity_name === "Edited One"));
  await page.click('tr[data-id="2"] .edit-btn');
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#maDlgTitle").count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains("edit-btn")), true, "focus restored");
  await ctx.close();
});

test("delete: confirm cancel no-op; success; in-use failure surfaced", { skip: SK }, async () => {
  const { page, ctx } = await open({ cfg: { inUse: [2] } });
  await page_ready(page);
  await page.click('tr[data-id="1"] .delete-btn'); await page.click('[data-act="cancel"]');
  assert.equal(await page.evaluate(() => window.__cfg.data.activities.length), 60);
  await page.click('tr[data-id="1"] .delete-btn'); await page.click('[data-act="ok"]');
  await page.waitForFunction(() => document.querySelector("#maCount").textContent === "59 activities");
  await page.click('tr[data-id="2"] .delete-btn'); await page.click('[data-act="ok"]');
  await page.waitForFunction(() => document.querySelector(".modal-body")?.textContent.includes("in use"));
  assert.equal(await page.evaluate(() => window.__cfg.data.activities.length), 59);
  await ctx.close();
});

test("bulk: validation, row-level error preservation, success removes created rows", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page_ready(page);
  await page.click("#multiAddBtn");
  assert.equal(await page.evaluate(() => window.__cfg.log.filter((l) => l.op === "insert").length), 0);
  const fill = async (i, name) => {
    const tr = page.locator("#multiTable tbody tr").nth(i);
    await tr.locator(".m-name").fill(name); await tr.locator(".m-section").selectOption("1");
    await tr.locator(".m-sub").selectOption("11"); await tr.locator(".m-area").selectOption("111");
    await tr.locator(".m-kind").selectOption("k-1"); await tr.locator(".m-dur").fill("2");
  };
  await fill(0, "Bulk One");
  await page.click("#maAddRow"); await fill(1, "Activity 003"); // duplicate of existing
  await page.click("#maAddRow"); await fill(2, "Bulk Three");
  await page.click("#multiAddBtn"); await page.click('[data-act="ok"]');
  await page.waitForFunction(() => document.querySelector("#maBulkSummary").textContent.startsWith("Added 2"));
  assert.equal(await page.locator("#multiTable tbody tr").count(), 1, "only failed row kept");
  assert.equal(await page.inputValue("#multiTable .m-name"), "Activity 003");
  assert.equal(await page.inputValue("#multiTable .m-kind"), "k-1", "row values preserved");
  assert.match(await page.textContent("#multiTable .ma-row-msg"), /already exists/);
  await ctx.close();
});

test("keyboard + responsive: tab reaches controls; no horizontal page overflow at 390px", { skip: SK }, async () => {
  const { page, ctx } = await open({ width: 390 });
  await page_ready(page);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const culprit = over > 1 ? await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest(".ma-table-wrap")).slice(0, 5).map((e) => e.tagName + "#" + e.id + "." + e.className).concat(["wrap:" + document.querySelector(".ma-table-wrap").getBoundingClientRect().right, "shell:" + document.querySelector(".ma-shell").getBoundingClientRect().right])) : [];
  assert.ok(over <= 1, `page overflows by ${over}px: ${culprit.join(" | ")}`);
  await page.focus("#nameFilter"); await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "sectionFilter");
  assert.ok(await page.locator("#existingTable th[scope=col]").count() > 0);
  await ctx.close();
});
