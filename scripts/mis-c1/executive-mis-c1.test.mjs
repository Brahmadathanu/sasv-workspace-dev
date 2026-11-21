// MIS-C1: Executive MIS Dashboard client polish + hardening tests.
//
//   node --test scripts/mis-c1/
//
// Static contract tests always run. Browser tests drive the real page against an in-page Supabase MOCK (see
// mis-harness.mjs); they are skipped (not failed) when Playwright/chromium is unavailable, or when
// MIS_C1_SKIP_BROWSER=1. This proves client behaviour only: it is NOT authenticated production acceptance and does
// not exercise server authorization, RLS, grants or real data.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WIDTHS, calls, launchBrowser, openDashboard, setHandler, startServer } from "./mis-harness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(root, "public/shared/executive-mis-dashboard.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public/shared/js/executive-mis-dashboard.js"), "utf8");

// ---------------------------------------------------------------- static contracts (always run)
test("server contracts are consumed unchanged (names and parameters)", () => {
  for (const obj of [
    "mv_mis_executive_summary", "v_mis_finance_tab_summary", "get_mis_finance_party_page", "v_mis_sales_tab_summary",
    "get_mis_sales_product_page", "v_mis_inventory_tab_summary", "get_mis_inventory_item_page",
    "v_mis_finished_goods_tab_summary", "get_mis_finished_goods_sku_page", "v_mis_production_tab_summary",
    "get_mis_production_value_summary",
  ]) assert.ok(js.includes(`"${obj}"`), obj);
  for (const p of ["p_group_filter", "p_search", "p_limit", "p_offset", "p_source_kind", "p_mos_filter"]) assert.ok(js.includes(p), p);
  // The FG filter value stays `shaded`; only the label is "Same IK/OK MRP".
  assert.match(js, /value="shaded"[^>]*\/> Same IK\/OK MRP/);
  assert.ok(!/Shaded</.test(js));
  assert.equal(/\.rpc\(\s*"get_mis_(?!finance_party_page|sales_product_page|inventory_item_page|finished_goods_sku_page|production_value_summary)/.test(js), false);
});

test("no polling or timers were added (only the existing 60 s freshness label tick)", () => {
  assert.equal((js.match(/setInterval\(/g) || []).length, 1);
  assert.match(js, /setInterval\(updateFreshnessIndicator, 60000\)/);
  assert.equal((js.match(/debounce\(\(value\) => \{[\s\S]*?\}, 250\)/g) || []).length, 4, "four 250 ms search debounces preserved");
});

test("production secondary cards use semantic tokens, not hard-coded palette values", () => {
  const start = html.indexOf(".production-summary-heading {");
  const end = html.indexOf(".production-section {");
  assert.ok(start > 0 && end > start);
  const block = html.slice(start, end);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(block, /rgba?\(/);
  assert.match(block, /var\(--mis-/);
});

test("production value is presentation-only: sole canonical RPC, no browser arithmetic or source queries", () => {
  const a = js.indexOf("const PV_STATUS_LABELS");
  const b = js.indexOf("function renderProductionTab");
  const code = js.slice(a, b) + js.slice(js.indexOf("async function loadProductionValue"), js.indexOf("const PV_STATUS_LABELS"));
  assert.doesNotMatch(code, /[\w)\]]\s+[*\/]\s+[\w(]/, "no multiplication/division in the value code");
  assert.doesNotMatch(code, /Number\([^)]*\)\s*[+\-]\s*Number\(/, "no summation of server figures");
  assert.doesNotMatch(js, /daily_work_log|fg_bulk_stock_ledger|tally_fg_transfer_voucher_lines|costing\./);
  assert.equal((js.match(/get_mis_production_value_summary/g) || []).length, 1);
  assert.doesNotMatch(js, /get_mis_production_value_summary_v\d|preview/i);
});

test("production value styles use semantic tokens only", () => {
  const a = html.indexOf(".pv {");
  const b = html.indexOf(".production-section {");
  assert.ok(a > 0 && b > a);
  const block = html.slice(a, b);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(block, /rgba?\(/);
});

// ---------------------------------------------------------------- browser tests
const SKIP = process.env.MIS_C1_SKIP_BROWSER === "1";
const chromium = launchBrowser();
const skip = SKIP || !chromium ? "Playwright/chromium unavailable or MIS_C1_SKIP_BROWSER=1" : false;
let browser;
let srv;

test.before(async () => {
  if (skip) return;
  browser = await chromium.launch();
  srv = await startServer();
});
test.after(async () => {
  await browser?.close();
  srv?.server.close();
});

const open = (opts) => openDashboard(browser, srv.base, opts);
const tabClick = (page, id) => page.evaluate((t) => {
  const select = document.querySelector("#detailTabSelect");
  if (getComputedStyle(select.closest(".tab-select-wrap")).display !== "none") {
    select.value = t; select.dispatchEvent(new Event("change", { bubbles: true }));
  } else document.querySelector(`[data-tab="${t}"]`).click();
}, id);
const settleTimers = (page, ms = 450) => page.waitForTimeout(ms); // > 250 ms search debounce
const maskVisible = (page, shell) => page.evaluate((s) => { const m = document.querySelector(`${s} .table-loading-mask`); return !!m && !m.hidden; }, shell);

test("tab navigation: six tabs, aria-selected, Alerts placeholder, no refetch on the active tab", { skip }, async () => {
  const { page, consoleErrors } = await open();
  try {
    assert.deepEqual(await page.$$eval("#detailTabs .pill", (b) => b.map((x) => x.textContent.trim())), ["Finance", "Sales", "Inventory", "Finished Goods", "Production", "Alerts"]);
    const before = (await calls(page, "get_mis_finance_party_page")).length;
    await page.click('[data-tab="finance"]'); // already active
    await settleTimers(page, 150);
    assert.equal((await calls(page, "get_mis_finance_party_page")).length, before, "re-selecting the active tab must not refetch");
    for (const [tab, sel] of [["sales", ".sales-table"], ["inventory", ".inventory-table"], ["finished-goods", ".fg-table"], ["production", ".production-summary-grid"]]) {
      await page.click(`[data-tab="${tab}"]`);
      await page.waitForSelector(`#tabPanel ${sel}`);
      assert.equal(await page.getAttribute(`[data-tab="${tab}"]`, "aria-selected"), "true");
    }
    await page.click('[data-tab="alerts"]');
    assert.match(await page.textContent("#tabPanel"), /This section will be added in the next phase/);
    assert.deepEqual(consoleErrors, []);
  } finally { await page.context().close(); }
});

test("Finance: filter, search, pagination, server totals, modal", { skip }, async () => {
  const { page } = await open();
  try {
    assert.deepEqual(await page.$$eval('input[name="financeFilter"]', (r) => r.map((x) => x.value)), ["payables", "receivables", "all"]);
    assert.deepEqual((await calls(page, "get_mis_finance_party_page"))[0].args, { p_group_filter: "payables", p_search: "", p_limit: 25, p_offset: 0 });
    assert.match(await page.textContent("#financePagination"), /Showing 1-25 of 60 parties/);
    // pagination
    await page.click("#financeNextPage");
    await page.waitForFunction(() => /Page 2 \/ 3/.test(document.querySelector("#financePagination").textContent));
    assert.equal((await calls(page, "get_mis_finance_party_page")).at(-1).args.p_offset, 25);
    assert.match(await page.textContent("#financePagination"), /Showing 26-50 of 60 parties/);
    // filter resets to page 1 and sends the unchanged filter value
    await page.click("#financeFilterBtn");
    await page.check('input[name="financeFilter"][value="receivables"]');
    await page.waitForFunction(() => /Page 1 \/ 3/.test(document.querySelector("#financePagination").textContent));
    const f = (await calls(page, "get_mis_finance_party_page")).at(-1).args;
    assert.equal(f.p_group_filter, "receivables"); assert.equal(f.p_offset, 0);
    assert.equal(await page.$eval("#financeFilterBtn", (b) => b.classList.contains("finance-filter-btn--active")), true);
    // search is server-side, debounced once, resets page, total comes from the server (3, not the page length)
    await page.click("#financeNextPage");
    await page.waitForFunction(() => /Page 2/.test(document.querySelector("#financePagination").textContent));
    const n = (await calls(page, "get_mis_finance_party_page")).length;
    await page.fill("#financeSearch", "asha");
    await settleTimers(page);
    const after = await calls(page, "get_mis_finance_party_page");
    assert.equal(after.length, n + 1, "one debounced request for one burst of input");
    assert.equal(after.at(-1).args.p_search, "asha"); assert.equal(after.at(-1).args.p_offset, 0);
    assert.match(await page.textContent("#financePagination"), /of 3 parties/);
    assert.equal(await page.$$eval("#financePartyTableWrap tbody tr", (r) => r.length), 3);
    // modal: opens, focus moves in, Escape closes and focus returns to the row
    const row = page.locator("#financePartyTableWrap tbody tr").first();
    await row.focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector("#financeModalContent .finance-table");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "financeModalClose");
    await page.keyboard.press("Escape");
    assert.equal(await page.$eval("#financeModalOverlay", (e) => e.classList.contains("hidden")), true);
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), "TR");
    // click-open and overlay-click close
    await row.click();
    await page.waitForSelector("#financeModalContent .finance-table");
    await page.click("#financeModalClose");
    assert.equal(await page.$eval("#financeModalOverlay", (e) => e.getAttribute("aria-hidden")), "true");
  } finally { await page.context().close(); }
});

test("Sales: request args, pagination, search", { skip }, async () => {
  const { page } = await open();
  try {
    await page.click('[data-tab="sales"]');
    await page.waitForSelector(".sales-table");
    assert.deepEqual((await calls(page, "get_mis_sales_product_page"))[0].args, { p_search: "", p_limit: 25, p_offset: 0 });
    await page.click("#salesNextPage");
    await page.waitForFunction(() => /Page 2 \/ 3/.test(document.querySelector("#salesPagination").textContent));
    assert.equal((await calls(page, "get_mis_sales_product_page")).at(-1).args.p_offset, 25);
    await page.fill("#salesSearch", "arishta");
    await settleTimers(page);
    const last = (await calls(page, "get_mis_sales_product_page")).at(-1).args;
    assert.deepEqual([last.p_search, last.p_offset], ["arishta", 0]);
    assert.match(await page.textContent("#salesPagination"), /of 4 products/);
  } finally { await page.context().close(); }
});

test("Inventory: filter values, search, pagination", { skip }, async () => {
  const { page } = await open();
  try {
    await page.click('[data-tab="inventory"]');
    await page.waitForSelector(".inventory-table");
    assert.deepEqual(await page.$$eval('input[name="inventoryFilter"]', (r) => r.map((x) => x.value)), ["all", "rm", "plm", "consumable", "fuel"]);
    await page.click("#inventoryNextPage");
    await page.waitForFunction(() => /Page 2/.test(document.querySelector("#inventoryPagination").textContent));
    await page.click("#inventoryFilterBtn");
    await page.check('input[name="inventoryFilter"][value="rm"]');
    await page.waitForFunction(() => /Page 1/.test(document.querySelector("#inventoryPagination").textContent));
    let a = (await calls(page, "get_mis_inventory_item_page")).at(-1).args;
    assert.deepEqual([a.p_source_kind, a.p_offset], ["rm", 0]);
    await page.fill("#inventorySearch", "oil");
    await settleTimers(page);
    a = (await calls(page, "get_mis_inventory_item_page")).at(-1).args;
    assert.deepEqual([a.p_source_kind, a.p_search, a.p_offset], ["rm", "oil", 0]);
    assert.match(await page.textContent("#inventoryPagination"), /of 5 items/);
  } finally { await page.context().close(); }
});

test("Finished Goods: filter values/labels and status labels (RPC value stays 'shaded')", { skip }, async () => {
  const { page } = await open();
  try {
    await page.click('[data-tab="finished-goods"]');
    await page.waitForSelector(".fg-table");
    const opts = await page.$$eval('input[name="fgFilter"]', (r) => r.map((x) => [x.value, x.parentElement.textContent.trim()]));
    assert.deepEqual(opts, [["all", "All"], ["zero_stock", "Zero Stock"], ["below_1_month", "Below 1 Month"], ["one_to_three_months", "1 to 3 Months"], ["above_6_months", "Above 6 Months"], ["normal", "Normal"], ["shaded", "Same IK/OK MRP"]]);
    const statuses = await page.$$eval(".fg-table tbody tr td:nth-child(7)", (c) => c.slice(0, 5).map((x) => x.textContent));
    assert.deepEqual(statuses, ["Zero Stock", "Below 1 Month", "1 to 3 Months", "Above 6 Months", "Normal"]);
    await page.click("#fgFilterBtn");
    await page.check('input[name="fgFilter"][value="shaded"]');
    await page.waitForFunction(() => document.querySelector("#fgPagination").textContent.includes("Page 1"));
    assert.equal((await calls(page, "get_mis_finished_goods_sku_page")).at(-1).args.p_mos_filter, "shaded");
  } finally { await page.context().close(); }
});

const pvText = (page) => page.textContent("#productionValueBody");
const pvCards = (page) => page.$$eval(".pv-kpi", (c) => c.map((x) => ({ title: x.querySelector(".pv-kpi-title").textContent, value: x.querySelector(".pv-kpi-value").textContent, badge: x.querySelector(".pv-kpi-badge")?.textContent || "", caption: x.querySelector(".pv-kpi-caption")?.textContent || "", book: x.classList.contains("book") })));
const openProduction = async (opts) => {
  const r = await open(opts);
  await r.page.click('[data-tab="production"]');
  await r.page.waitForSelector(".production-summary-grid");
  return r;
};
const pvOverride = (page, data) => setHandler(page, "get_mis_production_value_summary", new Function("a", `const base = ${JSON.stringify({})}; return { data: Object.assign({ report_month: a.p_report_month, as_of_date: "2026-11-20", approved_cost_run_id: 143, approved_cost_valuation_date: "2026-10-22", status: "BULK_RECEIPT_COVERED_REFERENCE", plan_status: "UNAVAILABLE_PENDING_FROZEN_PLAN", component_policy: "RM_STORES_PM_EXCLUDED", receipt_event_count: 10, receipt_unvalued_count: 0, receipt_correction_event_count: 0, receipt_reference_covered_value: 1000, receipt_value_status: "COVERED_SUBTOTAL", tally_fg_transfer_book_value: 500, transfer_line_count: 3, tally_snapshot_as_of: "2026-11-20", transfer_reconciliation_status: "NOT_CHECKED_BY_BOOK_TOTAL", transfer_missing_amount_lines: 0, completed_reference_value: null, completed_status: "NOT_VERIFIED", plan_achievement_pct: null, comparability: "NOT_COMPARABLE" }, ${JSON.stringify(data)}), error: null };`));
const refresh = async (page) => { await page.click("#pvMonth"); await page.selectOption("#pvMonth", { index: 1 }); await page.selectOption("#pvMonth", { index: 0 }); await page.waitForFunction(() => document.querySelector("#productionValueBody")?.getAttribute("aria-busy") === "false"); };

test("Production value: four cards, covered subtotal, unavailable plan/completion, Tally book basis kept separate", { skip }, async () => {
  const { page } = await openProduction();
  try {
    await page.waitForSelector(".pv-kpi");
    const cards = await pvCards(page);
    assert.deepEqual(cards.map((c) => c.title), ["Planned bulk value", "Bulk received - covered value", "Completed bulk value", "Transferred to FG - book value"]);
    assert.equal(cards[0].value, "Unavailable"); assert.match(cards[0].caption, /No approved frozen plan/);
    assert.match(cards[1].value, /₹32,04,140\.56/); assert.equal(cards[1].badge, "Partial coverage"); assert.match(cards[1].caption, /80 receipt event\(s\), 2 unvalued and excluded\. Not full cost/);
    assert.equal(cards[2].value, "N/A"); assert.equal(cards[2].badge, "Not verified");
    assert.match(cards[3].value, /₹25,00,000/); assert.equal(cards[3].badge, "Tally book basis"); assert.ok(cards[3].book && !cards.slice(0, 3).some((c) => c.book));
    assert.match(cards[3].caption, /Not reconciled to batch log/);
    const t = await pvText(page);
    assert.match(t, /Approved cost run #143/); assert.match(t, /valued 22 Oct 2026/); assert.match(t, /Events to 20 Nov 2026/);
    assert.match(t, /Plan achievement\s*N\/A/); assert.match(t, /Not comparable/);
    assert.doesNotMatch(t, /₹\s?0(\.00)?\b/, "no impossible zero");
    assert.doesNotMatch(t, /NaN|undefined|null/);
    // the explanation of exclusions is present
    await page.click(".pv-notes summary");
    assert.match(await page.textContent(".pv-notes"), /RM materials-stores share|RM and RM materials-stores/);
    assert.match(await page.textContent(".pv-notes"), /PM stores, packing labour and PM costs are excluded/);
    // the RPC is called once, with the first-of-month IST month and no as-of unless chosen
    const c = (await calls(page, "get_mis_production_value_summary"));
    assert.equal(c.length, 1); assert.match(c[0].args.p_report_month, /^\d{4}-\d{2}-01$/); assert.equal("p_as_of_date" in c[0].args, false);
    // counts remain; mixed-unit quantities are demoted into a labelled collapsed diagnostic with no % columns
    assert.deepEqual(await page.$$eval(".production-summary-card .production-summary-title", (t) => t.map((x) => x.textContent)), ["Active Pipeline Batches", "Work in Process Batches", "Overdue WIP Batches", "FG Bulk Batches", "Bottled Stock Batches", "Total Canonical Batches"]);
    assert.equal(await page.$eval(".production-diagnostics", (e) => e.open), false);
    assert.match(await page.textContent(".production-diagnostics > summary"), /mixed base units, not additive/);
    const diag = await page.textContent(".production-diagnostics");
    assert.doesNotMatch(diag, /Achievement|53\.77|43\.02/);
    assert.doesNotMatch(await page.textContent("#tabPanel"), /Bulk Achievement %|FG Transfer Achievement %/);
  } finally { await page.context().close(); }
});

test("Production value fixtures: no run, correction lineage, all unvalued, no receipts, zero transfers, comparable", { skip }, async () => {
  const { page } = await openProduction();
  try {
    await pvOverride(page, { status: "NO_PREVIOUS_MONTH_APPROVED_COST", plan_status: "LIVE_INDICATIVE", receipt_event_count: null, receipt_reference_covered_value: null, receipt_value_status: null, tally_fg_transfer_book_value: null, transfer_line_count: null, approved_cost_run_id: null, approved_cost_valuation_date: null });
    await refresh(page);
    let cards = await pvCards(page);
    assert.equal(cards[1].value, "Unavailable"); assert.equal(cards[1].badge, "No approved cost"); assert.equal(cards[3].value, "Unavailable");
    assert.doesNotMatch(await pvText(page), /Approved cost run|₹/);

    await pvOverride(page, { receipt_correction_event_count: 3, receipt_reference_covered_value: null, receipt_value_status: "BLOCKED_CORRECTION_LINEAGE" });
    await refresh(page);
    cards = await pvCards(page);
    assert.equal(cards[1].value, "Withheld"); assert.equal(cards[1].badge, "Correction lineage blocked"); assert.match(cards[1].caption, /3 correction event/);

    await pvOverride(page, { receipt_event_count: 2, receipt_unvalued_count: 2, receipt_reference_covered_value: null, receipt_value_status: "PARTIAL_COVERAGE" });
    await refresh(page);
    cards = await pvCards(page);
    assert.equal(cards[1].value, "Unvalued"); assert.match(cards[1].caption, /All 2 receipt event/);

    await pvOverride(page, { receipt_event_count: 0, receipt_unvalued_count: 0, receipt_reference_covered_value: null, tally_fg_transfer_book_value: null, transfer_line_count: 0 });
    await refresh(page);
    cards = await pvCards(page);
    assert.equal(cards[1].value, "No receipts"); assert.equal(cards[3].value, "No transfers");
    assert.doesNotMatch(await pvText(page), /₹/);

    await pvOverride(page, { tally_fg_transfer_book_value: 900, transfer_line_count: 4, transfer_missing_amount_lines: 1, transfer_reconciliation_status: "MISSING_LOG" });
    await refresh(page);
    cards = await pvCards(page);
    assert.match(cards[3].caption, /4 voucher line\(s\), 1 without amount/); assert.match(cards[3].caption, /missing log/);

    // clean positive, rates present: covered subtotal without partial caveat
    await pvOverride(page, {});
    await refresh(page);
    cards = await pvCards(page);
    assert.equal(cards[1].badge, "Covered subtotal"); assert.match(cards[1].value, /₹1,000/);

    // percentage only appears when the server says COMPARABLE and supplies it; planned value shown verbatim then
    await pvOverride(page, { comparability: "NOT_COMPARABLE", plan_achievement_pct: 88 });
    await refresh(page);
    assert.match(await pvText(page), /Plan achievement\s*N\/A/, "a stray pct without COMPARABLE is never shown");
    await pvOverride(page, { comparability: "COMPARABLE", plan_achievement_pct: 88, plan_status: "FROZEN", planned_reference_covered_value: 2000, planned_unvalued_count: 0 });
    await refresh(page);
    assert.match(await pvText(page), /Plan achievement\s*88%/);
    assert.match((await pvCards(page))[0].value, /₹2,000/);
  } finally { await page.context().close(); }
});

test("Production value: report month and cut-off are sent to the server; as-of is bounded", { skip }, async () => {
  const { page } = await openProduction();
  try {
    const opts = await page.$$eval("#pvMonth option", (o) => o.map((x) => x.value));
    assert.equal(opts.length, 12); assert.ok(opts.every((v) => /^\d{4}-\d{2}-01$/.test(v)));
    await page.selectOption("#pvMonth", opts[2]);
    await page.waitForFunction(() => document.querySelector("#productionValueBody")?.getAttribute("aria-busy") === "false");
    const bounds = await page.$eval("#pvAsOf", (e) => ({ min: e.min, max: e.max }));
    assert.equal(bounds.min, opts[2]); assert.ok(bounds.max >= bounds.min);
    const day = bounds.min.slice(0, 8) + "10";
    await page.fill("#pvAsOf", day);
    await page.dispatchEvent("#pvAsOf", "change");
    await page.waitForFunction(() => document.querySelector("#productionValueBody")?.getAttribute("aria-busy") === "false");
    const c = await calls(page, "get_mis_production_value_summary");
    assert.deepEqual(c.at(-1).args, { p_report_month: opts[2], p_as_of_date: day });
    assert.match(await pvText(page), /Events to 10 /);
    // changing the month clears an as-of that is now outside the month
    await page.selectOption("#pvMonth", opts[0]);
    await page.waitForFunction(() => document.querySelector("#productionValueBody")?.getAttribute("aria-busy") === "false");
    assert.equal(await page.inputValue("#pvAsOf"), "");
    assert.equal("p_as_of_date" in (await calls(page, "get_mis_production_value_summary")).at(-1).args, false);
  } finally { await page.context().close(); }
});

test("Production value: loading, denied (403/42501), 401, generic error + Retry; counts unaffected", { skip }, async () => {
  const { page } = await open({ init: () => { window.__mis.handlers = { get_mis_production_value_summary: () => (window.__mis.first = window.__mis.defer()).promise }; } });
  try {
    await page.click('[data-tab="production"]');
    await page.waitForFunction(() => !!window.__mis.first);
    await page.waitForSelector(".production-summary-grid");
    assert.match(await pvText(page), /Loading production values/);
    assert.equal(await page.getAttribute("#productionValueBody", "aria-busy"), "true");
    assert.doesNotMatch(await pvText(page), /₹|Unavailable|N\/A/, "no false values while loading");
    await page.evaluate(() => window.__mis.first.resolve({ data: null, error: { code: "42501", message: "MIS view permission required" } }));
    await page.waitForSelector(".pv-state.error");
    assert.match(await pvText(page), /do not have permission to view production values/);
    assert.equal(await page.$(".pv-state .mis-retry-btn"), null, "denied has no retry");
    assert.equal(await page.getAttribute(".pv-state.error", "role"), "alert");
    assert.ok((await page.textContent(".production-summary-grid")).includes("Active Pipeline Batches"), "counts still render");
    await setHandler(page, "get_mis_production_value_summary", () => ({ data: null, error: { status: 401, message: "JWT expired" } }));
    await page.selectOption("#pvMonth", { index: 1 });
    await page.waitForFunction(() => /session has expired/.test(document.querySelector("#productionValueBody").textContent));
    assert.ok(await page.$(".pv-state .mis-retry-btn"));
    await setHandler(page, "get_mis_production_value_summary", () => Promise.reject(new Error("network down")));
    await page.click(".pv-state .mis-retry-btn");
    await page.waitForFunction(() => /Failed to load production values\. network down/.test(document.querySelector("#productionValueBody").textContent));
    const before = (await calls(page, "v_mis_production_tab_summary")).length;
    await page.evaluate(() => { delete window.__mis.handlers.get_mis_production_value_summary; });
    await page.click(".pv-state .mis-retry-btn");
    await page.waitForSelector(".pv-kpi");
    assert.equal((await calls(page, "v_mis_production_tab_summary")).length, before, "value retry does not reload counts");
  } finally { await page.context().close(); }
});

test("Production value: latest response wins and a response after leaving the tab is dropped", { skip }, async () => {
  const { page } = await open({ init: () => { window.__mis.handlers = { get_mis_production_value_summary: (a) => { const d = window.__mis.defer(); (window.__mis.q = window.__mis.q || []).push({ a, d }); return d.promise; } }; } });
  try {
    await page.click('[data-tab="production"]');
    await page.waitForFunction(() => window.__mis.q?.length === 1);
    await page.selectOption("#pvMonth", { index: 1 });
    await page.waitForFunction(() => window.__mis.q.length === 2);
    const mk = (m, run) => ({ data: { report_month: m, as_of_date: m, approved_cost_run_id: run, approved_cost_valuation_date: "2026-01-01", status: "BULK_RECEIPT_COVERED_REFERENCE", plan_status: "UNAVAILABLE_PENDING_FROZEN_PLAN", receipt_event_count: 1, receipt_unvalued_count: 0, receipt_correction_event_count: 0, receipt_reference_covered_value: 7, receipt_value_status: "COVERED_SUBTOTAL", completed_status: "NOT_VERIFIED", comparability: "NOT_COMPARABLE" }, error: null });
    // newest resolves first, stale one later: stale must not overwrite
    await page.evaluate((r) => window.__mis.q[1].d.resolve(r), mk("2026-10-01", 222));
    await page.waitForFunction(() => /#222/.test(document.querySelector("#productionValueBody").textContent));
    await page.evaluate((r) => window.__mis.q[0].d.resolve(r), mk("2026-11-01", 111));
    await page.waitForTimeout(150);
    assert.match(await pvText(page), /#222/); assert.doesNotMatch(await pvText(page), /#111/);
    // leave the tab while a new request is pending: late arrival cannot repaint
    await page.selectOption("#pvMonth", { index: 0 });
    await page.waitForFunction(() => window.__mis.q.length === 3);
    await page.click('[data-tab="sales"]');
    await page.waitForSelector(".sales-table");
    await page.evaluate((r) => window.__mis.q[2].d.resolve(r), mk("2026-11-01", 333));
    await page.waitForTimeout(150);
    assert.doesNotMatch(await page.textContent("#tabPanel"), /#333|Production value/);
  } finally { await page.context().close(); }
});

// ---- Async request-state hardening
test("race: a stale search response never overwrites or unmasks the latest query", { skip }, async () => {
  const { page } = await open();
  try {
    await page.evaluate(() => {
      const m = window.__mis;
      m.slow = {};
      m.handlers.get_mis_finance_party_page = (a) => {
        if (!a.p_search) return { data: [{ party_name: "Base", mis_group_name: "G", bill_count: 1, outstanding_amount_mis_value: 1, signed_outstanding_tally_value: 1, total_rows: 1 }], error: null };
        const d = (m.slow[a.p_search] = m.defer());
        return d.promise;
      };
    });
    await page.fill("#financeSearch", "a"); await settleTimers(page);
    await page.fill("#financeSearch", "ab"); await settleTimers(page);
    assert.equal(await maskVisible(page, ".finance-table-shell"), true);
    // older query "a" completes late-first: must be ignored, mask must stay for "ab"
    await page.evaluate(() => window.__mis.slow["a"].resolve({ data: [{ party_name: "STALE-A", mis_group_name: "G", bill_count: 1, outstanding_amount_mis_value: 1, signed_outstanding_tally_value: 1, total_rows: 99 }], error: null }));
    await page.waitForTimeout(100);
    assert.doesNotMatch(await page.textContent("#financePartyTableWrap"), /STALE-A/);
    assert.equal(await maskVisible(page, ".finance-table-shell"), true, "stale completion must not remove the newer request's mask");
    assert.doesNotMatch(await page.textContent("#financePagination"), /99/);
    await page.evaluate(() => window.__mis.slow["ab"].resolve({ data: [{ party_name: "LATEST-AB", mis_group_name: "G", bill_count: 1, outstanding_amount_mis_value: 1, signed_outstanding_tally_value: 1, total_rows: 1 }], error: null }));
    await page.waitForFunction(() => document.querySelector("#financePartyTableWrap").textContent.includes("LATEST-AB"));
    assert.equal(await maskVisible(page, ".finance-table-shell"), false);
    // the reverse order (newest first, stale last) is also safe
    await page.fill("#financeSearch", "x"); await settleTimers(page);
    await page.fill("#financeSearch", "xy"); await settleTimers(page);
    await page.evaluate(() => window.__mis.slow["xy"].resolve({ data: [{ party_name: "LATEST-XY", mis_group_name: "G", bill_count: 1, outstanding_amount_mis_value: 1, signed_outstanding_tally_value: 1, total_rows: 1 }], error: null }));
    await page.waitForFunction(() => document.querySelector("#financePartyTableWrap").textContent.includes("LATEST-XY"));
    await page.evaluate(() => window.__mis.slow["x"].resolve({ data: [{ party_name: "STALE-X", total_rows: 7 }], error: null }));
    await page.waitForTimeout(100);
    assert.doesNotMatch(await page.textContent("#financePartyTableWrap"), /STALE-X/);
  } finally { await page.context().close(); }
});

test("race: stale pagination and filter responses are dropped (Sales, Inventory, FG)", { skip }, async () => {
  const { page } = await open();
  try {
    await page.evaluate(() => {
      const m = window.__mis; m.slow = {};
      const row = (n, tot) => ({ item: n, product_name: n, item_name: n, total_rows: tot });
      for (const name of ["get_mis_sales_product_page", "get_mis_inventory_item_page", "get_mis_finished_goods_sku_page"]) {
        m.handlers[name] = (a) => {
          const key = name + ":" + (a.p_offset || 0) + ":" + (a.p_source_kind || a.p_mos_filter || "");
          if (!(a.p_offset > 0) && !(a.p_source_kind && a.p_source_kind !== "all") && !(a.p_mos_filter && a.p_mos_filter !== "all")) return { data: [row("BASE", 60)], error: null };
          const d = (m.slow[key] = m.defer()); return d.promise;
        };
      }
    });
    // Sales: activate Next twice quickly -> pages 2 and 3 in flight; page-2 response arrives last and must be ignored.
    await page.click('[data-tab="sales"]');
    await page.waitForSelector(".sales-table");
    // (the loading mask blocks pointer input over the pager, so drive it by keyboard like a fast double activation)
    await page.focus("#salesNextPage"); await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
    await page.evaluate(() => { const s = window.__mis.slow; s["get_mis_sales_product_page:50:"].resolve({ data: [{ product_name: "P3", total_rows: 60 }], error: null }); });
    await page.waitForFunction(() => document.querySelector("#salesProductTableWrap").textContent.includes("P3"));
    await page.evaluate(() => { window.__mis.slow["get_mis_sales_product_page:25:"].resolve({ data: [{ product_name: "P2-STALE", total_rows: 60 }], error: null }); });
    await page.waitForTimeout(100);
    assert.doesNotMatch(await page.textContent("#salesProductTableWrap"), /P2-STALE/);
    assert.match(await page.textContent("#salesPagination"), /Page 3 \/ 3/);
    assert.equal(await maskVisible(page, ".sales-table-shell"), false);
    // Inventory: switch filter rm then fuel; rm (older) resolves last and is ignored.
    await page.click('[data-tab="inventory"]');
    await page.waitForSelector(".inventory-table");
    for (const v of ["rm", "fuel"]) { await page.click("#inventoryFilterBtn"); await page.check(`input[name="inventoryFilter"][value="${v}"]`); }
    await page.evaluate(() => window.__mis.slow["get_mis_inventory_item_page:0:fuel"].resolve({ data: [{ item_name: "FUEL-ROW", total_rows: 1 }], error: null }));
    await page.waitForFunction(() => document.querySelector("#inventoryItemTableWrap").textContent.includes("FUEL-ROW"));
    await page.evaluate(() => window.__mis.slow["get_mis_inventory_item_page:0:rm"].resolve({ data: [{ item_name: "RM-STALE", total_rows: 5 }], error: null }));
    await page.waitForTimeout(100);
    assert.doesNotMatch(await page.textContent("#inventoryItemTableWrap"), /RM-STALE/);
    assert.match(await page.textContent("#inventoryPagination"), /of 1 items/);
    // FG likewise
    await page.click('[data-tab="finished-goods"]');
    await page.waitForSelector(".fg-table");
    for (const v of ["zero_stock", "shaded"]) { await page.click("#fgFilterBtn"); await page.check(`input[name="fgFilter"][value="${v}"]`); }
    await page.evaluate(() => window.__mis.slow["get_mis_finished_goods_sku_page:0:shaded"].resolve({ data: [{ item: "SHADED-ROW", total_rows: 1 }], error: null }));
    await page.waitForFunction(() => document.querySelector("#fgSkuTableWrap").textContent.includes("SHADED-ROW"));
    await page.evaluate(() => window.__mis.slow["get_mis_finished_goods_sku_page:0:zero_stock"].resolve({ data: [{ item: "ZERO-STALE", total_rows: 9 }], error: null }));
    await page.waitForTimeout(100);
    assert.doesNotMatch(await page.textContent("#fgSkuTableWrap"), /ZERO-STALE/);
  } finally { await page.context().close(); }
});

test("race: a response for a tab the user left cannot repaint the current panel", { skip }, async () => {
  const { page } = await open();
  try {
    await page.evaluate(() => {
      const m = window.__mis;
      m.handlers.get_mis_inventory_item_page = () => (m.invDeferred = m.defer()).promise;
    });
    await page.click('[data-tab="inventory"]');
    await page.waitForFunction(() => !!window.__mis.invDeferred);
    await page.click('[data-tab="sales"]');
    await page.waitForSelector(".sales-table");
    await page.evaluate(() => window.__mis.invDeferred.resolve({ data: [{ item_name: "INV-STALE", total_rows: 1 }], error: null }));
    await page.waitForTimeout(150);
    assert.equal(await page.$(".inventory-table"), null);
    assert.ok(await page.$(".sales-table"));
    // leaving and returning to the SAME tab discards the first load in favour of the second
    await page.click('[data-tab="finance"]');
    await page.waitForSelector(".finance-table");
  } finally { await page.context().close(); }
});

test("a tab switch during the initial summary load does not trigger a duplicate tab load", { skip }, async () => {
  const { page } = await open({
    noWait: true,
    init: () => { window.__mis.handlers = { mv_mis_executive_summary: () => (window.__mis.mvDeferred = window.__mis.defer()).promise }; },
  });
  try {
    await page.waitForFunction(() => !!window.__mis.mvDeferred);
    await page.click('[data-tab="sales"]');
    await page.waitForSelector(".sales-table");
    const before = (await calls(page, "get_mis_sales_product_page")).length;
    await page.evaluate(() => window.__mis.mvDeferred.resolve({ data: { mis_summary_id: 1, mv_refreshed_at: new Date().toISOString() }, error: null }));
    await page.waitForSelector(".kpi-card");
    await page.waitForTimeout(300);
    assert.equal((await calls(page, "get_mis_sales_product_page")).length, before, "no duplicate page request");
    assert.equal((await calls(page, "v_mis_sales_tab_summary")).length, 1);
  } finally { await page.context().close(); }
});

test("top-level Refresh reloads the active tab exactly once", { skip }, async () => {
  const { page } = await open();
  try {
    const before = (await calls(page, "get_mis_finance_party_page")).length;
    await page.click("#refreshBtn");
    await page.waitForFunction((n) => window.__mis.calls.filter((c) => c.name === "get_mis_finance_party_page").length === n + 1, before);
    await page.waitForTimeout(300);
    assert.equal((await calls(page, "get_mis_finance_party_page")).length, before + 1);
  } finally { await page.context().close(); }
});

test("a pending debounced search typed before a tab switch never fires", { skip }, async () => {
  const { page } = await open();
  try {
    await page.fill("#financeSearch", "late");
    await page.click('[data-tab="sales"]'); // within the 250 ms window
    await settleTimers(page);
    assert.equal((await calls(page, "get_mis_finance_party_page")).some((c) => c.args.p_search === "late"), false);
  } finally { await page.context().close(); }
});

test("typing while a search is in flight keeps focus and every typed character", { skip }, async () => {
  const { page } = await open();
  try {
    await page.evaluate(() => { const m = window.__mis; m.handlers.get_mis_finance_party_page = (a) => a.p_search ? (m.d = m.defer()).promise : { data: [{ party_name: "B", total_rows: 1 }], error: null }; });
    await page.click("#financeSearch");
    await page.keyboard.type("ab"); await settleTimers(page);
    await page.keyboard.type("c"); // typed after the "ab" request left, before it returns
    await page.evaluate(() => window.__mis.d.resolve({ data: [{ party_name: "AB-ROW", total_rows: 1 }], error: null }));
    await page.waitForFunction(() => document.querySelector("#financePartyTableWrap").textContent.includes("AB-ROW"));
    assert.equal(await page.inputValue("#financeSearch"), "abc");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "financeSearch");
  } finally { await page.context().close(); }
});

test("loading, empty, error and populated states are distinct (with Retry)", { skip }, async () => {
  const { page } = await open({
    noWait: true,
    init: () => {
      window.__mis.handlers = { get_mis_finance_party_page: () => (window.__mis.first = window.__mis.defer()).promise };
    },
  });
  try {
    await page.waitForFunction(() => !!window.__mis.first);
    const wrap = "#financePartyTableWrap";
    // loading: no false "No parties" flash
    assert.match(await page.textContent(wrap), /Loading parties/);
    assert.doesNotMatch(await page.textContent(wrap), /No parties found/);
    // error
    await page.evaluate(() => window.__mis.first.resolve({ data: null, error: { message: "boom" } }));
    await page.waitForSelector(`${wrap} .finance-status.error`);
    assert.match(await page.textContent(wrap), /Failed to load finance parties\. boom/);
    assert.equal(await page.getAttribute(`${wrap} .finance-status.error`, "role"), "alert");
    // retry -> empty (server says zero rows)
    await page.evaluate(() => { window.__mis.handlers.get_mis_finance_party_page = () => ({ data: [], error: null }); });
    await page.click(`${wrap} .mis-retry-btn`);
    await page.waitForSelector(`${wrap} .finance-empty`);
    assert.match(await page.textContent(wrap), /No parties found/);
    assert.match(await page.textContent("#financePagination"), /Showing 0-0 of 0 parties/);
    // populated
    await page.evaluate(() => { delete window.__mis.handlers.get_mis_finance_party_page; });
    await page.click("#financeSearchClear").catch(() => {});
    await page.fill("#financeSearch", "q"); await settleTimers(page);
    await page.waitForSelector(`${wrap} .finance-table`);
    // a rejected (thrown) request also settles into the error state, never a stuck mask
    await setHandler(page, "get_mis_sales_product_page", () => Promise.reject(new Error("network down")));
    await page.click('[data-tab="sales"]');
    await page.waitForSelector(".sales-status.error");
    assert.match(await page.textContent("#salesProductTableWrap"), /network down/);
    assert.equal(await maskVisible(page, ".sales-table-shell"), false);
  } finally { await page.context().close(); }
});

test("Finance modal: a late bill-detail response cannot repopulate a closed modal", { skip }, async () => {
  const { page } = await open();
  try {
    await page.evaluate(() => { const m = window.__mis; m.handlers.v_mis_finance_outstanding_detail = () => (m.bills = m.defer()).promise; });
    await page.locator("#financePartyTableWrap tbody tr").first().click();
    await page.waitForFunction(() => !!window.__mis.bills);
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.__mis.bills.resolve({ data: [{ bill_ref: "LATE", bill_date_text: "x", outstanding_amount_tally_value: 1, outstanding_amount_abs_line_value: 1 }], error: null }));
    await page.waitForTimeout(100);
    assert.equal(await page.$eval("#financeModalContent", (e) => e.innerHTML), "");
    assert.equal(await page.$eval("#financeModalOverlay", (e) => e.classList.contains("hidden")), true);
  } finally { await page.context().close(); }
});

test("permission denied or unverifiable: module data is never loaded; message differs", { skip }, async () => {
  for (const [permission, text] of [["denied", /do not have permission/], ["error", /Could not verify your access/]]) {
    const { page } = await open({ permission, noWait: true });
    try {
      await page.waitForFunction(() => /permission|verify/.test(document.querySelector("#statusArea").textContent));
      assert.match(await page.textContent("#statusArea"), text);
      await page.waitForTimeout(200);
      const names = (await calls(page)).map((c) => c.name);
      assert.deepEqual([...new Set(names)], ["get_user_permissions"], "only the permission lookup may run");
      assert.equal(await page.$eval(".detail-section", (e) => getComputedStyle(e).display), "none");
      assert.equal(await page.$eval("#kpiGrid", (e) => getComputedStyle(e).display), "none");
    } finally { await page.context().close(); }
  }
});

// ---- Responsive + interaction acceptance (simulated; see header)
for (const width of WIDTHS) {
  test(`responsive @${width}px: no page overflow, tables scroll in-container, sticky headers, controls usable`, { skip }, async () => {
    const { page, consoleErrors } = await open({ width, height: width < 600 ? 740 : 800 });
    try {
      const vw = width;
      const overflow = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bsw: document.body.scrollWidth }));
      const rects = (sel) => page.$$eval(sel, (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, h: r.height }; }));
      const noPageOverflow = async (label) => { const o = await overflow(); assert.ok(o.sw <= o.cw && o.bsw <= o.cw, `${label}: page overflow ${JSON.stringify(o)}`); };

      for (const [tab, wrapSel, tableSel, pagSel] of [["finance", ".finance-table-wrap", ".finance-table", "#financePagination"], ["sales", ".sales-table-wrap", ".sales-table", "#salesPagination"], ["inventory", ".inventory-table-wrap", ".inventory-table", "#inventoryPagination"], ["finished-goods", ".fg-table-wrap", ".fg-table", "#fgPagination"]]) {
        await tabClick(page, tab);
        await page.waitForSelector(`#tabPanel ${tableSel}`);
        await noPageOverflow(tab);
        // the table's own container scrolls horizontally instead of the page
        const wrap = await page.$eval(wrapSel, (e) => ({ sw: e.scrollWidth, cw: e.clientWidth, ox: getComputedStyle(e).overflowX }));
        assert.match(wrap.ox, /auto|scroll/, `${tab} wrap must own horizontal scrolling`);
        if (width <= 520) assert.ok(wrap.sw > wrap.cw, `${tab} wide table should scroll inside its wrap at ${width}: ${JSON.stringify(wrap)}`);
        // usable height (regression: was 2px at 320 / 74px at 390)
        const shell = await page.$eval(wrapSel, (e) => e.getBoundingClientRect().height);
        assert.ok(shell >= 120, `${tab} table area too short at ${width}: ${shell}`);
        // pagination visible, inside the viewport horizontally, controls reachable
        await page.locator(pagSel).scrollIntoViewIfNeeded();
        const [pg] = await rects(pagSel);
        assert.ok(pg.l >= -0.5 && pg.r <= vw + 0.5 && pg.h > 20, `${tab} pagination clipped: ${JSON.stringify(pg)}`);
        for (const r of await rects(`${pagSel} button`)) assert.ok(r.r <= vw + 0.5 && r.w >= 28 && r.h >= 28, `${tab} pager button too small/clipped ${JSON.stringify(r)}`);
        // sticky header stays at the top of the scrolling container
        const sticky = await page.$eval(wrapSel, (w) => { w.scrollTop = 0; const before = w.querySelector("th").getBoundingClientRect().top - w.getBoundingClientRect().top; w.scrollTop = 120; const after = w.querySelector("th").getBoundingClientRect().top - w.getBoundingClientRect().top; return { before, after, pos: getComputedStyle(w.querySelector("th")).position }; });
        assert.equal(sticky.pos, "sticky"); assert.ok(Math.abs(sticky.after - sticky.before) < 1, `${tab} header moved ${JSON.stringify(sticky)}`);
        // search + filter usable (visible, inside viewport, real touch size on small screens)
        const searchId = { finance: "#financeSearch", sales: "#salesSearch", inventory: "#inventorySearch", "finished-goods": "#fgSearch" }[tab];
        const [s] = await rects(searchId);
        assert.ok(s.w >= 120 && s.l >= 0 && s.r <= vw + 0.5, `${tab} search ${JSON.stringify(s)}`);
        if (width <= 640) assert.ok(s.h >= 34, `${tab} search target height ${s.h}`);
      }

      // filter drawer: inside viewport, closes on Escape and on outside click, focus returns to its button
      await tabClick(page, "finance");
      await page.waitForSelector(".finance-table");
      await page.click("#financeFilterBtn");
      let [d] = await rects("#financeFilterDrawer");
      assert.ok(d.l >= 0 && d.r <= vw + 0.5, `filter drawer clipped ${JSON.stringify(d)}`);
      await page.focus('input[name="financeFilter"]');
      await page.keyboard.press("Escape");
      assert.equal(await page.$eval("#financeFilterDrawer", (e) => e.classList.contains("open")), false);
      assert.equal(await page.evaluate(() => document.activeElement?.id), "financeFilterBtn");
      await page.click("#financeFilterBtn");
      await page.mouse.click(2, vw > 600 ? 790 : 730);
      assert.equal(await page.$eval("#financeFilterDrawer", (e) => e.classList.contains("open")), false, "outside click closes drawer");

      // KPI popover stays inside the viewport and closes on Escape / outside click
      await page.evaluate(() => window.scrollTo(0, 0));
      for (const idx of [0, 9]) {
        const btn = page.locator(`.kpi-info-btn[data-kpi-index="${idx}"]`);
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        const [p] = await rects(".kpi-popover");
        const vh = await page.evaluate(() => window.innerHeight);
        const pr = await page.$eval(".kpi-popover", (e) => { const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom }; });
        assert.ok(p.l >= 0 && p.r <= vw + 0.5 && pr.t >= 0 && pr.b <= vh + 0.5, `popover clipped ${JSON.stringify({ p, pr, vh })}`);
        await page.keyboard.press("Escape");
        assert.equal(await page.$(".kpi-popover"), null);
      }

      // Finance modal fits the viewport, closes on Escape, restores focus
      await page.locator("#financePartyTableWrap tbody tr").first().click();
      await page.waitForSelector("#financeModalContent .finance-table");
      const [mw] = await rects(".modal-window");
      assert.ok(mw.l >= 0 && mw.r <= vw + 0.5, `modal clipped ${JSON.stringify(mw)}`);
      await page.keyboard.press("Escape");
      assert.equal(await page.$eval("#financeModalOverlay", (e) => e.classList.contains("hidden")), true);

      // HOME convention: label on desktop, SVG-only at <= 520px; accessible name preserved either way
      const home = await page.$eval("#homeBtn", (b) => ({ label: getComputedStyle(b.querySelector(".home-label")).display, aria: b.getAttribute("aria-label"), svg: !!b.querySelector("svg"), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width }));
      assert.equal(home.svg, true); assert.equal(home.aria, "Home");
      assert.equal(home.label === "none", width <= 520, `HOME label display at ${width}: ${home.label}`);
      if (width <= 640) assert.ok(home.h >= 34 && home.w >= 34, `HOME target ${home.h}x${home.w}`);
      await page.evaluate(() => window.scrollTo(0, 0));
      for (const r of await rects(".header-actions > *")) assert.ok(r.r <= vw + 0.5 && r.l >= 0, `header action clipped ${JSON.stringify(r)}`);

      // Production tab: no page overflow, secondary grid wraps, tables scroll in their own wrap
      await tabClick(page, "production");
      await page.waitForSelector(".production-summary-grid");
      await noPageOverflow("production");
      for (const r of await rects(".production-summary-card")) assert.ok(r.l >= 0 && r.r <= vw + 0.5, `production card clipped ${JSON.stringify(r)}`);
      await page.waitForSelector(".pv-kpi");
      for (const r of await rects(".pv-kpi, #pvMonth, #pvAsOf")) assert.ok(r.l >= 0 && r.r <= vw + 0.5 && r.w > 60, `production value control clipped ${JSON.stringify(r)}`);
      if (width <= 520) for (const r of await rects("#pvMonth, #pvAsOf")) assert.ok(r.h >= 34, `pv control touch target ${r.h}`);
      if (width <= 359) assert.equal(new Set(await page.$$eval(".pv-kpi", (c) => c.map((x) => Math.round(x.getBoundingClientRect().left)))).size, 1, "single column at 320");
      await page.click(".production-diagnostics > summary");
      if (width <= 520) assert.ok(await page.$eval(".production-diagnostics .production-table-wrap", (e) => e.scrollWidth > e.clientWidth), "production table scrolls inside its wrap");
      await noPageOverflow("production (diagnostics open)");
      // keyboard: month select reachable and focus ring defined
      await page.focus("#pvMonth");
      assert.equal(await page.evaluate(() => document.activeElement.id), "pvMonth");
      if (process.env.MIS_SCREENSHOT_DIR) {
        await page.evaluate(() => document.querySelector(".production-diagnostics").open = false);
        await page.evaluate(() => document.querySelector("#tabPanel").scrollTo(0, 0));
        await page.screenshot({ path: `${process.env.MIS_SCREENSHOT_DIR}/production-value-${width}.png`, fullPage: false });
      }
      assert.deepEqual(consoleErrors, []);
    } finally { await page.context().close(); }
  });
}
