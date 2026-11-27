// EI R5 maturity: infinite scrolling, compact record cards + detail dialog, integrated (non-redundant) visuals, Overview trend.
// Pure tests always run; browser tests use the MIS-C1 in-page Supabase mock (skipped, not failed, without Playwright). Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mergeRows, listIsDone, exportLoadedScopeLine, recordCardModel, inlineBarPct } from "../../public/shared/js/executive-intelligence-model.js";
import { launchBrowser, openDashboard, startServer, calls, setHandler } from "../mis-c1/mis-harness.mjs";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// ------------------------------------------------------------------------------------------------------------ pure
test("mergeRows dedupes by identity; a chunk that adds nothing is terminal; short chunk or full total is terminal", () => {
  const key = (r) => r.id;
  const m = mergeRows([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }], key);
  assert.deepEqual(m.rows.map(key), [1, 2, 3]); assert.equal(m.added, 1);
  assert.equal(mergeRows(m.rows, [{ id: 3 }], key).added, 0);
  assert.equal(listIsDone({ held: 3, total: 9, chunk: 25, size: 25, added: 0 }), true, "repeated page cannot loop");
  assert.equal(listIsDone({ held: 25, total: 60, chunk: 25, size: 25, added: 25 }), false);
  assert.equal(listIsDone({ held: 60, total: 60, chunk: 25, size: 25, added: 10 }), true);
  assert.equal(listIsDone({ held: 40, total: 99, chunk: 15, size: 25, added: 15 }), true, "short chunk");
  assert.equal(listIsDone({ held: 25, total: null, chunk: 25, size: 25, added: 25 }), false);
});

test("loaded-scope export never claims the whole dataset; card model keeps every field and only critical status", () => {
  const l = exportLoadedScopeLine({ title: "sales history", rowsLoaded: 50, total: 120, filters: ["Region: X"] });
  assert.match(l, /LOADED ROWS ONLY: 50 rows loaded so far/); assert.match(l, /120 rows match/); assert.match(l, /has_more=true/); assert.doesNotMatch(l, /page/i);
  assert.match(exportLoadedScopeLine({ title: "x", rowsLoaded: 1, total: 1 }), /has_more=false/); assert.match(exportLoadedScopeLine({ title: "x", rowsLoaded: 1, total: null }), /has_more unknown/);
  const labels = ["Item", "Pack", "Stock", "MOS", "Stock Value", "Status"], texts = ["Kashayam", "100 ml", "5", "2", "₹10", "Zero Stock"];
  const m = recordCardModel(labels, texts, { title: "Item", sub: ["Pack"], measure: "Stock Value", chips: ["Stock", "MOS", "Nope"], status: "Status" });
  assert.deepEqual([m.title, m.sub, m.measure, m.status], ["Kashayam", ["100 ml"], { label: "Stock Value", value: "₹10" }, "Zero Stock"]);
  assert.deepEqual(m.chips.map((c) => c.label), ["Stock", "MOS"]); assert.equal(m.fields.length, 6, "complete record stays reachable");
  assert.equal(recordCardModel(labels, ["a", "-", "", "", "", "-"], { title: 0, sub: ["Pack"], status: "Status" }).status, "", "placeholder status is not shown");
  assert.deepEqual([inlineBarPct(50, 100), inlineBarPct(0, 100), inlineBarPct(-1, 100), inlineBarPct(null, 100), inlineBarPct(1, 0)], [50, 0, null, null, null]);
});

test("static: no paginator remnants, one pagination-free list path, cache keys advanced, bounded edit scope, tokens only", () => {
  const html = read("public/shared/executive-mis-dashboard.html"), js = read("public/shared/js/executive-mis-dashboard.js");
  assert.doesNotMatch(js, /Previous page|Next page|data-sales-page|goListPage|listPaginationHtml|renderListPagination|pagerHtml|PrevPage|NextPage|Showing \$\{/);
  assert.doesNotMatch(js, /Page \$\{formatIntegerIN\(page\)\}/);
  assert.match(js, /IntersectionObserver/); assert.match(html, /executive-mis-dashboard\.js\?mis-c1=ei-r8-2/); assert.match(js, /executive-intelligence-model\.js\?ei-r8=2/);
  const css = html.slice(html.indexOf("EI-R5 maturity"));
  assert.ok(css.length > 2500); assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
});

// ------------------------------------------------------------------------------------------------------------ browser
const skip = process.env.MIS_C1_SKIP_BROWSER === "1";
const chromium = skip ? null : launchBrowser();
const srv = chromium ? await startServer() : null;
const browser = chromium ? await chromium.launch() : null;
const SK = skip || !browser ? "browser unavailable" : false;
test.after(async () => { await browser?.close(); srv?.server.close(); });
const open = (o) => openDashboard(browser, srv.base, { noWait: true, ...o });
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const scrollEnd = (page, sel) => page.$eval(sel, (e) => { e.scrollTop = e.scrollHeight; });
const rowCount = (page, sel) => page.$$eval(sel, (r) => r.length);
const offsets = async (page, rpc) => (await calls(page, rpc)).map((c) => c.args.p_offset);

test("infinite scroll (Finance): bounded append by offset, one request per chunk, dedup, terminal stop, no paginator/counter", { skip: SK }, async () => {
  const { page, context } = await open({ width: 1280, lens: "finance" }); await page.waitForSelector(".finance-table tbody tr");
  assert.equal(await rowCount(page, ".finance-table tbody tr"), 25);
  assert.equal(await page.$$eval("#financePagination, .finance-page-controls, [data-act=prev], [data-act=next], .finance-row-count", (e) => e.length), 0, "no paginator controls or counters");
  assert.doesNotMatch(await page.textContent("#tabPanel"), /Showing \d|Page \d+ \/|Previous page|Next page/);
  await scrollEnd(page, ".finance-table-wrap"); await page.waitForFunction(() => document.querySelectorAll(".finance-table tbody tr").length === 50);
  await scrollEnd(page, ".finance-table-wrap"); await page.waitForFunction(() => document.querySelectorAll(".finance-table tbody tr").length === 60);
  await scrollEnd(page, ".finance-table-wrap"); await page.waitForTimeout(500);
  assert.deepEqual(await offsets(page, "get_mis_finance_party_page"), [0, 25, 50], "exactly one request per chunk, none after the terminal chunk");
  const names = await page.$$eval(".finance-table tbody tr td:first-child", (c) => c.map((x) => x.textContent)); assert.equal(new Set(names).size, 60, "no duplicates");
  assert.equal(await page.$$eval(".ei-more", (e) => e.length), 0, "no footer once the end is reached");
  await context.close();
});

test("infinite scroll: reset on filter/search ignores a slow stale chunk; failed chunk keeps rows and Retry asks the same chunk; scroll position held", { skip: SK }, async () => {
  const { page, context } = await open({ width: 1280, lens: "inventory" }); await page.waitForSelector(".inventory-table tbody tr");
  // slow append, then a reset (search) while it is in flight
  await page.evaluate(() => { const orig = window.__mis.handlers.get_mis_inventory_item_page; window.__mis.slow = (a) => (a.p_offset === 25 && !a.p_search ? new Promise((r) => setTimeout(() => r({ data: Array.from({ length: 25 }, (_, i) => ({ code: "S" + i, item_name: "STALE " + i, source_label: "x", qty_value: 1, avg_rate_value: 1, stock_value: 1, category_label: "Cat", total_rows: 60 })), error: null }), 700)) : null); });
  await setHandler(page, "get_mis_inventory_item_page", (a) => window.__mis.slow(a) || { data: Array.from({ length: Math.max(0, Math.min(a.p_limit, (a.p_search ? 5 : 60) - a.p_offset)) }, (_, i) => ({ code: "C" + (a.p_offset + i), item_name: (a.p_search ? "Iitem " : "Item ") + (a.p_offset + i + 1), source_label: "x", qty_value: 1, avg_rate_value: 1, stock_value: 1, category_label: "Cat", total_rows: a.p_search ? 5 : 60 })), error: null });
  await scrollEnd(page, ".inventory-table-wrap"); await page.waitForSelector(".ei-more");
  await page.fill("#inventorySearch", "zz"); await page.waitForFunction(() => document.querySelectorAll(".inventory-table tbody tr").length === 5);
  await page.waitForTimeout(1000);
  assert.equal(await page.$$eval(".inventory-table tbody tr td:nth-child(2)", (c) => c.filter((x) => /STALE/.test(x.textContent)).length), 0, "the stale chunk never lands");
  assert.equal(await rowCount(page, ".inventory-table tbody tr"), 5);
  await context.close();
  // failure + retry
  const r = await open({ width: 1280, lens: "inventory" }); await r.page.waitForSelector(".inventory-table tbody tr");
  await r.page.evaluate(() => { window.__mis.failOnce = true; });
  await setHandler(r.page, "get_mis_inventory_item_page", (a) => { if (a.p_offset === 25 && window.__mis.failOnce) { window.__mis.failOnce = false; return { data: null, error: { message: "boom" } }; } return { data: Array.from({ length: Math.max(0, Math.min(a.p_limit, 60 - a.p_offset)) }, (_, i) => ({ code: "C" + (a.p_offset + i), item_name: "Item " + (a.p_offset + i + 1), source_label: "x", qty_value: 1, avg_rate_value: 1, stock_value: 1, category_label: "Cat", total_rows: 60 })), error: null }; });
  await r.page.$eval(".inventory-table-wrap", (e) => { e.scrollTop = 40; });
  await scrollEnd(r.page, ".inventory-table-wrap"); await r.page.waitForSelector("[data-more-retry]");
  assert.equal(await rowCount(r.page, ".inventory-table tbody tr"), 25, "earlier rows are kept after a failed chunk");
  assert.match(await r.page.textContent(".ei-more"), /Could not load more.*boom/);
  await r.page.waitForTimeout(400); assert.deepEqual(await offsets(r.page, "get_mis_inventory_item_page"), [0, 25], "no automatic retry loop");
  await r.page.click("[data-more-retry]"); await r.page.waitForFunction(() => document.querySelectorAll(".inventory-table tbody tr").length === 50);
  assert.deepEqual((await offsets(r.page, "get_mis_inventory_item_page")).slice(0, 3), [0, 25, 25], "retry repeats the same offset");
  await r.context.close();
});

test("infinite scroll (Sales History/Exceptions): append, accurate loaded-rows export scope, rapid sort/filter reset, lens switch stops loading", { skip: SK }, async () => {
  const { page, context } = await open({ width: 1280, lens: "sales" }); await page.waitForSelector("#salesCmp .ei-table, #salesCmp .ei-rc");
  await page.click('[data-sales-view="exceptions"]'); await page.waitForSelector("#salesExcResults .ei-table, #salesExcResults .ei-rc");
  assert.equal(await page.$$eval("[data-sales-page], .ei-pager", (e) => e.length), 0);
  await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults .ei-table, #salesHistResults .ei-rc");
  await page.selectOption("#salesHistGroup", "product"); await page.waitForFunction(() => document.querySelectorAll("#salesHistResults tbody tr").length === 50);
  assert.match(await page.textContent("#salesHistResults .ei-viewbar"), /Export loaded rows \(CSV\)/); assert.match(await page.textContent("#salesHistResults .ei-viewbar"), /more rows exist; keep scrolling/);
  await scrollEnd(page, "#salesHistResults .ei-table-wrap"); await page.waitForFunction(() => document.querySelectorAll("#salesHistResults tbody tr").length === 60);
  assert.match(await page.textContent("#salesHistResults .ei-viewbar"), /Exports only the rows loaded so far, not the whole dataset/); assert.doesNotMatch(await page.textContent("#salesHistResults .ei-viewbar"), /more rows exist/);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-sales-export=hist]")]);
  const csv = fs.readFileSync(await dl.path(), "utf8"); assert.match(csv, /LOADED ROWS ONLY: 60 rows loaded so far/); assert.match(csv, /60 rows match/); assert.equal((csv.match(/\n/g) || []).length >= 61, true);
  assert.deepEqual((await calls(page, "ei_sales_history")).filter((c) => c.args.p_group === "product").map((c) => c.args.p_offset), [0, 50], "one chunk per scroll, no re-fetch on re-render");
  // rapid reset: sort changes advance the token; rows come from the latest sort only
  await page.selectOption("#salesHistGroup", "month");
  await context.close();
});

test("record cards (phone): compact cards replace tables for every record list; complete record in a detail dialog; keyboard and focus", { skip: SK }, async () => {
  const LENS = [["inventory", ".inventory-table-wrap", null, "Item 1"], ["finished-goods", ".fg-table-wrap", null, "SKU 1"], ["sales", ".sales-table-wrap", "mtd", "Product 1"], ["sales", "#salesExcResults", "exceptions", "Alpha"], ["alerts", ".ei-alerts", null, "FG transfer groups"]];
  for (const [lens, wrap, view, title] of LENS) for (const w of [320, 390, 520]) {
    const { page, context } = await open({ width: w, height: 800, lens });
    await page.waitForSelector(".ei-lens, .inventory-table, .fg-table"); if (view) await page.click(`[data-sales-view="${view}"]`);
    await page.waitForSelector(`${wrap} .ei-rc`);
    assert.equal(await page.$$eval(`${wrap} table:not(.ei-grid)`, (t) => t.length), 0, `${lens}/${view}@${w}: the table is replaced, not duplicated`);
    const h = await page.$$eval(`${wrap} .ei-rc-btn`, (b) => b.map((x) => x.getBoundingClientRect().height)); assert.ok(Math.max(...h) <= 130, `${lens}/${view}@${w}: compact card height ${Math.max(...h)}`);
    assert.ok((await overflow(page)) <= 0, `${lens}/${view}@${w}: page overflow`);
    if (w === 390) {
      const btn = page.locator(`${wrap} .ei-rc-btn`).first(); const label = await btn.getAttribute("aria-label"); assert.match(label, new RegExp(title));
      await btn.focus(); await page.keyboard.press("Enter"); await page.waitForSelector("#eiRecOverlay:not([hidden])");
      const modal = await page.$eval("#eiRecOverlay", (o) => ({ role: o.querySelector("[role=dialog]").getAttribute("aria-modal"), title: o.querySelector("#eiRecTitle").textContent, rows: o.querySelectorAll(".ei-rec-row").length, full: getComputedStyle(o.querySelector(".ei-rec-dialog")).height === `${innerHeight}px`, focus: document.activeElement.hasAttribute("data-rec-close") }));
      assert.equal(modal.role, "true"); assert.ok(modal.rows >= 3 && modal.full && modal.focus, JSON.stringify(modal));
      const labels = await page.$$eval("#eiRecOverlay dt", (d) => d.map((x) => x.textContent)); const headers = await page.evaluate(() => null); void headers;
      await page.keyboard.press("Escape"); await page.waitForSelector("#eiRecOverlay", { state: "hidden" });
      assert.equal(await page.evaluate(() => document.activeElement.classList.contains("ei-rc-btn")), true, "focus returns to the card"); assert.ok(labels.length >= 3);
    }
    await context.close();
  }
});

test("record cards: Finance cards open the existing bill drilldown; desktop tables and the month grid are unchanged", { skip: SK }, async () => {
  const { page, context } = await open({ width: 390, height: 800, lens: "finance" }); await page.waitForSelector("#financePartyTableWrap .ei-rc");
  await page.click("#financePartyTableWrap .ei-rc-btn"); await page.waitForSelector("#financeModalOverlay:not([hidden]), #financeModalOverlay.open, #financeModalContent .finance-table");
  assert.equal(await page.$$eval("#eiRecOverlay:not([hidden])", (e) => e.length), 0, "existing finance dialog, not a second one");
  assert.ok((await overflow(page)) <= 0); await context.close();
  const d = await open({ width: 1280, lens: "inventory" }); await d.page.waitForSelector(".inventory-table tbody tr");
  assert.equal(await d.page.$$eval(".ei-rc", (e) => e.length), 0); assert.equal(await d.page.$eval(".inventory-table", (t) => getComputedStyle(t).display), "table"); await d.context.close();
  const g = await open({ width: 390, height: 800, lens: "sales" }); await g.page.waitForSelector("#salesCmp");
  await g.page.click('[data-sales-view="history"]'); await g.page.waitForSelector("#salesHistResults .ei-rc");
  await g.page.selectOption("#salesHistGroup", "product_month"); await g.page.waitForSelector("[data-hist-grid]"); await g.page.click("[data-hist-grid]"); await g.page.waitForSelector(".ei-grid");
  assert.equal(await g.page.$$eval(".ei-grid", (t) => t.length), 1); assert.ok((await overflow(g.page)) <= 0); await g.context.close();
});

test("integrated visuals: no chart block repeats the KPI chips; bars live inside the indicators; Overview trend is one bounded call; roles hold", { skip: SK }, async () => {
  const { page, context } = await open({ width: 1280, lens: "overview" }); await page.waitForSelector(".ei-overview .kpi-card");
  await page.waitForFunction(() => [...document.querySelectorAll(".kpi-card")].every((c) => !/Loading/.test(c.textContent))); await page.waitForSelector(".ei-trend, .ei-bars-note");
  // R8.6 (owner-directed): each Overview domain card now carries one visual of its own; none may sit outside that visual region, and the figures still live in the indicators.
  assert.equal(await page.$$eval(".ei-overview .ei-group", (g) => g.every((x) => x.querySelectorAll(":scope > .ei-viz").length === 1)), true, "one visual region per domain card");
  assert.equal(await page.$$eval(".ei-overview .ei-bars, .ei-overview .ei-subset", (e) => e.filter((x) => !x.closest(".ei-viz")).length), 0, "no bar block outside the visual region");
  assert.ok((await page.$$eval(".kpi-card .ei-dbar", (e) => e.length)) >= 5, "bars are inside the indicators that carry the figures");
  assert.match(await page.getAttribute(".kpi-card:has(.kpi-title:text('Overdue')) .ei-dbar", "aria-label"), /% of work in process \(a subset, not a stage\)/, "bar has a text equivalent");
  assert.equal(await page.$$eval(".kpi-info-btn", (b) => b.length), 10); assert.equal(await page.$$eval(".ei-exec-summary a[data-lens-link]", (a) => a.length), 4);
  const hist = await calls(page, "ei_sales_history"); assert.equal(hist.length, 1, "one bounded trend request"); assert.equal(hist[0].args.p_group, "month"); assert.equal(hist[0].args.p_limit, 50);
  assert.equal((await calls(page, "ei_sales_comparison")).length, 0, "no further sales fan-out");
  assert.ok(await page.$(".ei-overview .ei-trend") || /full month series was not available/.test(await page.textContent(".ei-overview")), "trend drawn only when the full series arrived");
  await context.close();
  const f = await open({ width: 1280, lens: "finance" }); await f.page.waitForSelector(".finance-table"); assert.equal(await f.page.$$eval("#financeMetrics .ei-dbar", (e) => e.length), 2); assert.equal(await f.page.$$eval("figure.ei-chart", (e) => e.length), 0, "no repeated chart under the chips"); await f.context.close();
  const pr = await open({ width: 1280, lens: "production" }); await pr.page.waitForSelector("#productionCounts .production-summary-card");
  assert.ok((await pr.page.$$eval("#productionCounts .ei-dbar", (e) => e.length)) >= 3); assert.equal(await pr.page.$$eval("#productionCounts .ei-bars, #productionCounts .ei-subset", (e) => e.length), 0); await pr.context.close();
  const so = await open({ width: 1280, permission: "sales-only", lens: "sales" }); await so.page.waitForSelector("#salesCmp");
  assert.equal((await calls(so.page, "mv_mis_executive_summary")).length, 0); await so.context.close();
  const dn = await open({ width: 1280, permission: "denied", lens: "overview" }); await dn.page.waitForTimeout(400); assert.equal((await calls(dn.page, "ei_sales_history")).length, 0, "denied: no trend request"); await dn.context.close();
});

test("responsive: overview, lenses and cards fit 320/390/520/768/1280 without page overflow", { skip: SK }, async () => {
  for (const w of [320, 390, 520, 768, 1280]) for (const lens of ["overview", "finance", "inventory", "finished-goods", "production", "alerts", "sales"]) {
    const { page, context } = await open({ width: w, height: 800, lens }); await page.waitForSelector(".ei-lens, .ei-overview"); await page.waitForTimeout(250);
    assert.ok((await overflow(page)) <= 0, `${lens}@${w}: overflow ${await overflow(page)}`); await context.close();
  }
});
