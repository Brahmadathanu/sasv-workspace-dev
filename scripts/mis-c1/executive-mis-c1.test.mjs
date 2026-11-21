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
    "v_mis_finished_goods_tab_summary", "get_mis_finished_goods_sku_page", "v_mis_batch_pipeline",
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
  await tabClick(r.page, "production");
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
    // counts: six server counts, labelled as the live current state, no diagnostics/mixed-unit/plan strip
    assert.deepEqual(await page.$$eval(".production-summary-card .production-summary-title", (t) => t.map((x) => x.textContent)), ["Active Pipeline Batches", "Work in Process Batches", "Overdue WIP Batches", "FG Bulk Batches", "Bottled Stock Batches", "Total Canonical Batches"]);
    assert.deepEqual(await page.$$eval(".production-summary-card .production-summary-value", (t) => t.map((x) => x.textContent)), ["412", "100", "59", "7", "8", "2,581"]);
    assert.match(await countsText(page), /Live batch pipeline — current state/);
    assert.match(await countsText(page), /not tied to the report month/);
    const panel = await countsText(page);
    assert.equal(await page.$(".production-diagnostics"), null);
    assert.doesNotMatch(panel, /Achievement|mixed base units|Planning month|Source diagnostics|base quantity|Kg|Nos/);
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
    const days = await page.$$eval("#pvAsOf option", (o) => o.map((x) => x.value));
    assert.equal(days[0], ""); assert.equal(days[1], opts[2]);
    assert.ok(days.slice(1).every((d) => d.startsWith(opts[2].slice(0, 8))), "only days of the selected month");
    const day = opts[2].slice(0, 8) + "10";
    await page.selectOption("#pvAsOf", day);
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
    const before = (await calls(page, "v_mis_batch_pipeline")).length;
    await page.evaluate(() => { delete window.__mis.handlers.get_mis_production_value_summary; });
    await page.click(".pv-state .mis-retry-btn");
    await page.waitForSelector(".pv-kpi");
    assert.equal((await calls(page, "v_mis_batch_pipeline")).length, before, "value retry does not reload counts");
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

// ---- Production: independent sections (G7 audit correction)
// Opens Production with both sections under test control. mode: "default" | "defer".
async function openProductionDeferred({ width = 1280 } = {}) {
  const r = await open({ width, init: () => {
    window.__mis.handlers = window.__mis.handlers || {};
    window.__mis.mode = { counts: "defer", value: "defer" };
    window.__mis.q = { counts: [], value: [] };
    window.__mis.fixtureCounts = { data: { active_pipeline_batch_count: 412, work_in_process_batch_count: 100, overdue_work_in_process_batch_count: 59, finished_goods_bulk_batch_count: 7, bottled_stock_batch_count: 8, total_canonical_batch_count: 900 }, error: null };
    window.__mis.fixtureValue = (a) => ({ data: { report_month: a.p_report_month, as_of_date: "2026-11-20", approved_cost_run_id: 143, approved_cost_valuation_date: "2026-10-22", status: "BULK_RECEIPT_COVERED_REFERENCE", plan_status: "UNAVAILABLE_PENDING_FROZEN_PLAN", component_policy: "RM_STORES_PM_EXCLUDED", receipt_event_count: 80, receipt_unvalued_count: 2, receipt_correction_event_count: 0, receipt_reference_covered_value: 3204140.56, receipt_value_status: "PARTIAL_COVERAGE", tally_fg_transfer_book_value: 2500000, transfer_line_count: 41, tally_snapshot_as_of: "2026-11-20", transfer_reconciliation_status: "NOT_CHECKED_BY_BOOK_TOTAL", transfer_missing_amount_lines: 0, completed_reference_value: null, completed_status: "NOT_VERIFIED", plan_achievement_pct: null, comparability: "NOT_COMPARABLE" }, error: null });
    window.__mis.handlers.v_mis_batch_pipeline = () => {
      if (window.__mis.mode.counts === "default") return window.__mis.fixtureCounts;
      const d = window.__mis.defer(); window.__mis.q.counts.push({ d }); return d.promise;
    };
    window.__mis.handlers.get_mis_production_value_summary = (a) => {
      if (window.__mis.mode.value === "default") return window.__mis.fixtureValue(a);
      const d = window.__mis.defer(); window.__mis.q.value.push({ a, d }); return d.promise;
    };
  } });
  await tabClick(r.page, "production");
  await r.page.waitForFunction(() => window.__mis.q.counts.length === 1 && window.__mis.q.value.length === 1);
  return r;
}
const qLen = (page, k) => page.evaluate((x) => window.__mis.q[x].length, k);
const resolveQ = (page, k, i, v) => page.evaluate(([x, j, val]) => window.__mis.q[x][j].d.resolve(val), [k, i, v]);
const okCounts = { data: { active_pipeline_batch_count: 412, work_in_process_batch_count: 100, overdue_work_in_process_batch_count: 59, finished_goods_bulk_batch_count: 7, bottled_stock_batch_count: 8, total_canonical_batch_count: 900 }, error: null };
const okValue = (m, run = 143, v = 11) => ({ data: { report_month: m, as_of_date: m, approved_cost_run_id: run, approved_cost_valuation_date: "2026-10-22", status: "BULK_RECEIPT_COVERED_REFERENCE", plan_status: "UNAVAILABLE_PENDING_FROZEN_PLAN", receipt_event_count: 1, receipt_unvalued_count: 0, receipt_correction_event_count: 0, receipt_reference_covered_value: v, receipt_value_status: "COVERED_SUBTOTAL", completed_status: "NOT_VERIFIED", comparability: "NOT_COMPARABLE" }, error: null });
const countsText = (page) => page.textContent("#productionCounts");

test("independence: both sections mount immediately; value shows while legacy counts HANG", { skip }, async () => {
  const { page } = await openProductionDeferred();
  try {
    await page.waitForSelector("#productionValueSection");
    await page.waitForSelector("#productionCounts");
    assert.match(await pvText(page), /Loading production values/);
    assert.match(await countsText(page), /Loading batch counts/);
    await page.evaluate(() => { window.__mis.mode.value = "default"; });
    await resolveQ(page, "value", 0, (await page.evaluate(() => window.__mis.fixtureValue({ p_report_month: "2026-11-01" }))));
    await page.waitForSelector(".pv-kpi");
    assert.match((await pvCards(page))[1].value, /₹32,04,140\.56/);
    await page.waitForTimeout(300); // counts still pending: no timeout/blank, value intact
    assert.match(await countsText(page), /Loading batch counts/);
    assert.equal(await page.$(".production-summary-card"), null);
    assert.match((await pvCards(page))[1].value, /₹32,04,140\.56/);
    // controls usable while counts hang
    await page.evaluate(() => { window.__mis.mode.value = "defer"; });
    await page.selectOption("#pvMonth", { index: 1 });
    await page.waitForFunction(() => window.__mis.q.value.length === 2);
    assert.equal(await page.getAttribute("#productionValueBody", "aria-busy"), "true");
    assert.equal(await qLen(page, "counts"), 1, "month change never re-requests counts");
    // late counts arrive later and render without touching the value section
    await resolveQ(page, "counts", 0, okCounts);
    await page.waitForSelector(".production-summary-card");
    assert.match(await countsText(page), /Active Pipeline Batches/);
    assert.ok(await page.$("#pvMonth"), "value controls survive counts render");
  } finally { await page.context().close(); }
});

test("independence: legacy counts FAIL while value succeeds; counts retry is counts-only", { skip }, async () => {
  const { page } = await openProductionDeferred();
  try {
    await page.evaluate(() => { window.__mis.mode.value = "default"; });
    await resolveQ(page, "counts", 0, { data: null, error: { message: "statement timeout" } });
    await resolveQ(page, "value", 0, await page.evaluate(() => window.__mis.fixtureValue({ p_report_month: "2026-11-01" })));
    await page.waitForSelector("#productionCounts .pv-state.error");
    assert.match(await countsText(page), /Failed to load production batch counts\. statement timeout/);
    assert.equal(await page.getAttribute("#productionCounts .pv-state.error", "role"), "alert");
    assert.equal((await pvCards(page)).length, 4, "value cards stay visible");
    assert.equal(await page.$("#productionValueBody .pv-state.error"), null);
    const valueCalls = (await calls(page, "get_mis_production_value_summary")).length;
    await page.click("#productionCounts .mis-retry-btn");
    await page.waitForFunction(() => window.__mis.q.counts.length === 2);
    assert.equal((await calls(page, "get_mis_production_value_summary")).length, valueCalls, "counts retry does not touch value RPC");
    assert.match(await countsText(page), /Loading batch counts/);
    assert.equal((await pvCards(page)).length, 4, "value untouched while counts retry");
    await resolveQ(page, "counts", 1, okCounts);
    await page.waitForSelector(".production-summary-card");
  } finally { await page.context().close(); }
});

test("independence: value FAILS while counts succeed; value retry is value-only", { skip }, async () => {
  const { page } = await openProductionDeferred();
  try {
    await resolveQ(page, "counts", 0, okCounts);
    await resolveQ(page, "value", 0, { data: null, error: { message: "RPC down" } });
    await page.waitForSelector("#productionValueBody .pv-state.error");
    assert.match(await pvText(page), /Failed to load production values\. RPC down/);
    assert.match(await countsText(page), /Active Pipeline Batches/);
    assert.equal(await page.$("#productionCounts .pv-state.error"), null);
    const countCalls = (await page.evaluate(() => window.__mis.q.counts.length));
    await page.click("#productionValueBody .mis-retry-btn");
    await page.waitForFunction(() => window.__mis.q.value.length === 2);
    assert.equal(await qLen(page, "counts"), countCalls, "value retry does not refetch counts");
    assert.match(await countsText(page), /Active Pipeline Batches/, "counts stay rendered");
    await resolveQ(page, "value", 1, okValue("2026-11-01"));
    await page.waitForSelector(".pv-kpi");
    assert.doesNotMatch(await pvText(page), /₹\s?0(\.00)?\b|NaN|undefined/);
  } finally { await page.context().close(); }
});

test("independence: tab switch and Refresh with both requests in flight retire stale responses", { skip }, async () => {
  const { page } = await openProductionDeferred();
  try {
    // 1) leave the tab with both in flight; late answers must not repaint Sales
    await page.click('[data-tab="sales"]');
    await page.waitForSelector(".sales-table");
    await resolveQ(page, "counts", 0, okCounts);
    await resolveQ(page, "value", 0, okValue("2026-11-01", 111));
    await page.waitForTimeout(200);
    const panel = await page.textContent("#tabPanel");
    assert.doesNotMatch(panel, /#111|Production value|Active Pipeline Batches|Loading batch counts/);
    // 2) return: fresh requests are made, the new ones win over any stale answers
    await page.click('[data-tab="production"]');
    await page.waitForFunction(() => window.__mis.q.counts.length === 2 && window.__mis.q.value.length === 2);
    // 3) Refresh while in flight: yet another pair, older pair retired
    await page.click("#refreshBtn");
    await page.waitForFunction(() => window.__mis.q.counts.length === 3 && window.__mis.q.value.length === 3);
    await resolveQ(page, "counts", 2, { data: { ...okCounts.data, active_pipeline_batch_count: 333 }, error: null });
    await resolveQ(page, "value", 2, okValue("2026-11-01", 333));
    await page.waitForFunction(() => /#333/.test(document.querySelector("#productionValueBody").textContent));
    await resolveQ(page, "counts", 1, { data: { ...okCounts.data, active_pipeline_batch_count: 222 }, error: null });
    await resolveQ(page, "value", 1, okValue("2026-11-01", 222));
    await page.waitForTimeout(200);
    assert.match(await pvText(page), /#333/); assert.doesNotMatch(await pvText(page), /#222|#111/);
    assert.match(await countsText(page), /333/); assert.doesNotMatch(await countsText(page), /\b222\b/);
  } finally { await page.context().close(); }
});

test("unauthorized session: Production data and RPCs are never requested or shown", { skip }, async () => {
  for (const permission of ["denied", "error"]) {
    const { page } = await open({ permission, noWait: true });
    try {
      await page.waitForFunction(() => /permission|verify/.test(document.querySelector("#statusArea").textContent));
      await page.evaluate(() => { try { document.querySelector('[data-tab="production"]')?.click(); } catch {} });
      await page.waitForTimeout(250);
      const names = (await calls(page)).map((c) => c.name);
      assert.ok(!names.includes("get_mis_production_value_summary") && !names.includes("v_mis_batch_pipeline"), names.join());
      assert.equal(await page.$("#productionValueSection"), null);
      assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /₹32,04|Tally book|Production value/);
    } finally { await page.context().close(); }
  }
});

for (const width of [390, 1280]) {
  test(`independence layout @${width}px: hanging counts / failed counts / failed value stay usable`, { skip }, async () => {
    const { page } = await openProductionDeferred({ width });
    try {
      const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && document.body.scrollWidth <= document.documentElement.clientWidth);
      const inView = (sel) => page.$$eval(sel, (els) => els.map((e) => { const r = e.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.width > 40; }));
      // counts hanging, value loaded
      await page.evaluate(() => { window.__mis.mode.value = "default"; });
      await resolveQ(page, "value", 0, await page.evaluate(() => window.__mis.fixtureValue({ p_report_month: "2026-11-01" })));
      await page.waitForSelector(".pv-kpi");
      assert.ok(await noOverflow(), "hanging counts: overflow");
      assert.ok((await inView(".pv-kpi, #pvMonth, #pvAsOf, #productionCounts .pv-state")).every(Boolean));
      // counts error + retry button reachable and touch-sized on mobile
      await resolveQ(page, "counts", 0, { data: null, error: { message: "timeout" } });
      await page.waitForSelector("#productionCounts .mis-retry-btn");
      assert.ok(await noOverflow(), "counts error: overflow");
      const btn = await page.$eval("#productionCounts .mis-retry-btn", (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, h: r.height }; });
      assert.ok(btn.l >= 0 && btn.r <= width + 0.5 && btn.h >= 24, JSON.stringify(btn));
      // value error with counts ok
      await page.click("#productionCounts .mis-retry-btn");
      await resolveQ(page, "counts", 1, okCounts);
      await page.waitForSelector(".production-summary-card");
      await page.evaluate(() => { window.__mis.mode.value = "defer"; });
      await page.selectOption("#pvMonth", { index: 1 });
      await page.waitForFunction(() => window.__mis.q.value.length === 2);
      await resolveQ(page, "value", 1, { data: null, error: { message: "boom" } });
      await page.waitForSelector("#productionValueBody .mis-retry-btn");
      assert.ok(await noOverflow(), "value error: overflow");
      assert.ok((await inView(".production-summary-card, #productionValueBody .mis-retry-btn")).every(Boolean));
    } finally { await page.context().close(); }
  });
}

test("top-level Transferred-to-FG KPI is labelled as the executive-summary source, distinct from the Tally book card", { skip }, async () => {
  const { page } = await openProduction();
  try {
    const src = await page.evaluate(() => [...document.querySelectorAll(".kpi-card")].map((c) => c.textContent).find((t) => /Transferred to Finished Goods Value/.test(t)) || "");
    assert.ok(src, "KPI present");
    await page.click(".pv-notes summary");
    assert.match(await page.textContent(".pv-notes"), /top-of-page "Transferred to Finished Goods Value" card comes from the executive summary snapshot/);
    assert.match((await pvCards(page))[3].badge, /Tally book basis/);
    // the KPI popover/detail text names its source
    const js_ = await page.evaluate(async () => (await (await fetch("/shared/js/executive-mis-dashboard.js")).text()));
    assert.match(js_, /A separate source from the Production tab's Tally book figure/);
  } finally { await page.context().close(); }
});

// ---- Production counts source (timeout correction)
test("counts source: explicit six-field projection from v_mis_batch_pipeline; legacy view and diagnostics removed", () => {
  assert.doesNotMatch(js, /\.from\(\s*"v_mis_production_tab_summary"/);
  const m = js.match(/const PRODUCTION_COUNT_FIELDS = Object\.freeze\(\[([\s\S]*?)\]\)/);
  assert.ok(m);
  assert.deepEqual([...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]), ["active_pipeline_batch_count", "work_in_process_batch_count", "overdue_work_in_process_batch_count", "finished_goods_bulk_batch_count", "bottled_stock_batch_count", "total_canonical_batch_count"]);
  assert.match(js, /supabase\.from\("v_mis_batch_pipeline"\)\.select\(PRODUCTION_COUNT_FIELDS\.join\(","\)\)\.single\(\)/);
  assert.doesNotMatch(js, /production-diagnostics|Source diagnostics|planned_production_base_qty|bulk_produced_base_qty|_base_qty|bulk_production_achievement_pct/);
  assert.doesNotMatch(js, /v_mis_production_position|v_product_bulk_consolidated_effective|v_fg_transfer_reconciliation/);
});

test("counts source at runtime: one pipeline query, six fields only, no legacy/other tables; month change touches only the money RPC", { skip }, async () => {
  const { page } = await openProduction();
  try {
    await page.waitForSelector(".pv-kpi");
    const names = (await calls(page)).filter((c) => /production|pipeline/.test(c.name)).map((c) => c.name);
    assert.deepEqual(names.sort(), ["get_mis_production_value_summary", "v_mis_batch_pipeline"]);
    const q = (await calls(page, "v_mis_batch_pipeline"))[0];
    const sel = q.chain.find((st) => st[0] === "select");
    assert.equal(sel[1], "active_pipeline_batch_count,work_in_process_batch_count,overdue_work_in_process_batch_count,finished_goods_bulk_batch_count,bottled_stock_batch_count,total_canonical_batch_count");
    assert.ok(!(await calls(page)).some((c) => c.name === "v_mis_production_tab_summary"));
    await page.selectOption("#pvMonth", { index: 3 });
    await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "get_mis_production_value_summary").length === 2);
    await page.waitForFunction(() => document.querySelector("#productionValueBody").getAttribute("aria-busy") === "false");
    assert.equal((await calls(page, "v_mis_batch_pipeline")).length, 1, "month selection never re-queries counts");
    assert.deepEqual(await page.$$eval(".production-summary-card .production-summary-value", (t) => t.map((x) => x.textContent)), ["412", "100", "59", "7", "8", "2,581"], "counts unchanged by month");
    assert.match(await countsText(page), /current state/);
  } finally { await page.context().close(); }
});

test("counts: missing/null server counts render a dash, never an invented zero", { skip }, async () => {
  const { page } = await open({ init: () => { window.__mis.handlers = { v_mis_batch_pipeline: () => ({ data: { active_pipeline_batch_count: 5, work_in_process_batch_count: null, overdue_work_in_process_batch_count: 0, finished_goods_bulk_batch_count: null, bottled_stock_batch_count: null, total_canonical_batch_count: 9 }, error: null }) }; } });
  try {
    await tabClick(page, "production");
    await page.waitForSelector(".production-summary-card");
    assert.deepEqual(await page.$$eval(".production-summary-card .production-summary-value", (t) => t.map((x) => x.textContent)), ["5", "-", "0", "-", "-", "9"]);
  } finally { await page.context().close(); }
});

// ---- As-of cutoff: month-scoped day selector (replaces the native date input, which iOS lets users scroll
// outside min/max). Chromium + 390px emulation; real iOS Safari still needs owner approval.
const idle = (page) => page.waitForFunction(() => document.querySelector("#productionValueBody")?.getAttribute("aria-busy") === "false");
const valueArgs = (page) => calls(page, "get_mis_production_value_summary").then((c) => c.map((x) => x.args));
async function openAsOf(width = 390) {
  const r = await openProduction({ width, height: 800 });
  await r.page.waitForSelector(".pv-kpi");
  const opts = await r.page.$$eval("#pvMonth option", (o) => o.map((x) => x.value));
  return { ...r, opts, month: opts[1], day: opts[1].slice(0, 8) + "15" };
}
const dayValues = (page) => page.$$eval("#pvAsOf option", (o) => o.map((x) => x.value));

// Pure helpers, extracted from the module source and evaluated in isolation.
const helpers = new Function(`${js.slice(js.indexOf("function asOfBoundsFor"), js.indexOf("function productionValueAsOfBounds"))}; return { asOfBoundsFor, asOfDayOptionsFor };`)();

test("as-of helper: allowed days per month (Oct 2026=31, Nov 2026 capped at today, Feb 2026=28, Feb 2024=29, Apr=30)", () => {
  const days = (m, today) => helpers.asOfDayOptionsFor(helpers.asOfBoundsFor(m, today));
  assert.equal(days("2026-10-01", "2026-11-21").length, 31);
  assert.equal(days("2026-10-01", "2026-11-21").at(-1).value, "2026-10-31");
  assert.equal(days("2026-11-01", "2026-11-21").length, 21);
  assert.equal(days("2026-11-01", "2026-11-21").at(-1).value, "2026-11-21", "current month stops at today IST");
  assert.equal(days("2026-11-01", "2026-11-01").length, 1, "first day of the current month");
  assert.equal(days("2026-02-01", "2026-11-21").length, 28);
  assert.equal(days("2024-02-01", "2026-11-21").length, 29);
  assert.equal(days("2024-02-01", "2026-11-21").at(-1).value, "2024-02-29");
  assert.equal(days("2026-04-01", "2026-11-21").length, 30);
  assert.equal(days("2026-12-01", "2026-12-31").length, 31);
  const first = days("2026-10-01", "2026-11-21")[0];
  assert.equal(first.value, "2026-10-01"); assert.equal(first.label, "Thu 01 Oct 2026");
  assert.ok(days("2026-10-01", "2026-11-21").every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.value)));
  assert.deepEqual(helpers.asOfBoundsFor("2026-10-01", "2026-11-21"), { min: "2026-10-01", max: "2026-10-31" });
});

test("as-of: the control is a select offering Default plus only the selected month's allowed days (no native date input)", { skip }, async () => {
  const { page, opts, month } = await openAsOf();
  try {
    assert.equal(await page.$eval("#pvAsOf", (e) => e.tagName), "SELECT");
    assert.equal(await page.$('input[type="date"]'), null);
    assert.equal(await page.$eval("#pvAsOf", (e) => e.labels?.[0]?.textContent.trim().startsWith("As of")), true, "accessible label");
    // current (default) month: 1..today IST, nothing in the future
    let d = await dayValues(page);
    assert.equal(d[0], ""); assert.equal(d[1], opts[0]);
    const today = await page.evaluate(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()));
    assert.equal(d.at(-1), today, "current month capped at today IST");
    assert.equal(d.length - 1, Number(today.slice(8, 10)));
    // a past month offers every day of that month
    await page.selectOption("#pvMonth", month); await idle(page);
    d = await dayValues(page);
    const [y, m] = month.split("-").map(Number);
    assert.equal(d.length - 1, new Date(Date.UTC(y, m, 0)).getUTCDate());
    assert.equal(d.at(-1), `${month.slice(0, 8)}${String(d.length - 1).padStart(2, "0")}`);
    assert.ok(d.slice(1).every((v) => v.startsWith(month.slice(0, 8))), "no day of another month is offered");
    assert.equal(await page.inputValue("#pvAsOf"), "", "defaults to the default cutoff");
    assert.match(await page.textContent("#pvAsOfStatus"), /Cutoff:\s*default/);
  } finally { await page.context().close(); }
});

test("as-of: choosing a day shows it, sends ISO p_as_of_date once, leaves counts untouched, survives Refresh", { skip }, async () => {
  const { page, month, day } = await openAsOf();
  try {
    await page.selectOption("#pvMonth", month); await idle(page);
    const before = (await valueArgs(page)).length;
    await page.selectOption("#pvAsOf", day); await idle(page);
    assert.equal(await page.inputValue("#pvAsOf"), day);
    assert.match(await page.$eval("#pvAsOf", (e) => e.selectedOptions[0].textContent), /15/);
    assert.match(await page.textContent("#pvAsOfStatus"), /Cutoff:\s*15 /);
    assert.match(await page.textContent("#pvAsOfStatus"), /allowed 01 .* to 3[01]|allowed 01 .* to 2[89]/);
    assert.ok(await page.$("#pvAsOfStatus [data-pv-asof-clear]"));
    const args = await valueArgs(page);
    assert.equal(args.length, before + 1, "exactly one request for the selection");
    assert.deepEqual(args.at(-1), { p_report_month: month, p_as_of_date: day });
    assert.match(await pvText(page), /Events to 15 /);
    assert.equal((await calls(page, "v_mis_batch_pipeline")).length, 1, "live counts not re-fetched");
    assert.deepEqual(await page.$$eval(".production-summary-card .production-summary-value", (t) => t.map((x) => x.textContent)), ["412", "100", "59", "7", "8", "2,581"]);
    // re-selecting the same day sends nothing
    await page.selectOption("#pvAsOf", day); await page.waitForTimeout(200);
    assert.equal((await valueArgs(page)).length, before + 1, "same selection is not re-requested");
    await page.click("#refreshBtn");
    await page.waitForSelector("#pvAsOf"); await idle(page);
    assert.equal(await page.inputValue("#pvAsOf"), day);
    assert.equal((await valueArgs(page)).at(-1).p_as_of_date, day);
  } finally { await page.context().close(); }
});

test("as-of: changing month rebuilds the days and visibly reverts a now-invalid cutoff to the default", { skip }, async () => {
  const { page, opts, month, day } = await openAsOf();
  try {
    await page.selectOption("#pvMonth", month); await idle(page);
    await page.selectOption("#pvAsOf", day); await idle(page);
    const before = (await valueArgs(page)).length;
    await page.selectOption("#pvMonth", opts[2]); await idle(page);
    const d = await dayValues(page);
    assert.ok(d.slice(1).every((v) => v.startsWith(opts[2].slice(0, 8))), "options rebuilt for the new month");
    assert.equal(await page.inputValue("#pvAsOf"), "");
    const st = await page.textContent("#pvAsOfStatus");
    assert.match(st, /is outside the selected month, so the default cutoff is used/);
    assert.match(st, /Cutoff:\s*default/);
    const args = await valueArgs(page);
    assert.equal(args.length, before + 1, "one request for the month change");
    assert.deepEqual(args.at(-1), { p_report_month: opts[2] });
    assert.equal((await calls(page, "v_mis_batch_pipeline")).length, 1);
    // choosing a valid day replaces the notice
    await page.selectOption("#pvAsOf", opts[2].slice(0, 8) + "10"); await idle(page);
    assert.doesNotMatch(await page.textContent("#pvAsOfStatus"), /outside/);
    assert.equal((await valueArgs(page)).at(-1).p_as_of_date, opts[2].slice(0, 8) + "10");
  } finally { await page.context().close(); }
});

test("as-of: safety guard still rejects forged/out-of-range values; Use default and Default option work", { skip }, async () => {
  const { page, opts, month, day } = await openAsOf();
  try {
    await page.selectOption("#pvMonth", month); await idle(page);
    const force = (value) => page.evaluate((v) => { const i = document.querySelector("#pvAsOf"); const o = document.createElement("option"); o.value = v; o.textContent = "forged"; i.appendChild(o); i.value = v; i.dispatchEvent(new Event("change", { bubbles: true })); }, value);
    await force(opts[2].slice(0, 8) + "28"); await idle(page);
    assert.match(await page.textContent("#pvAsOfStatus"), /outside .* so the default cutoff is used/);
    assert.equal("p_as_of_date" in (await valueArgs(page)).at(-1), false);
    assert.equal(await page.inputValue("#pvAsOf"), "");
    await force("not-a-date"); await idle(page).catch(() => {}); await page.waitForTimeout(150);
    assert.equal("p_as_of_date" in (await valueArgs(page)).at(-1), false);
    assert.equal(await page.$$eval("#pvAsOf option", (o) => o.filter((x) => x.textContent === "forged").length), 0, "forged options are discarded on rebuild");
    await page.selectOption("#pvAsOf", day); await idle(page);
    await page.selectOption("#pvAsOf", ""); await idle(page);
    assert.equal("p_as_of_date" in (await valueArgs(page)).at(-1), false);
    assert.match(await page.textContent("#pvAsOfStatus"), /Cutoff:\s*default/);
    await page.selectOption("#pvAsOf", day); await idle(page);
    await page.click("#pvAsOfStatus [data-pv-asof-clear]"); await idle(page);
    assert.equal(await page.inputValue("#pvAsOf"), "");
    assert.equal("p_as_of_date" in (await valueArgs(page)).at(-1), false);
    assert.equal((await calls(page, "v_mis_batch_pipeline")).length, 1);
  } finally { await page.context().close(); }
});

test("as-of: latest response wins when the cutoff is changed twice quickly", { skip }, async () => {
  const { page, month } = await openAsOf();
  try {
    await page.selectOption("#pvMonth", month); await idle(page);
    await page.evaluate(() => { window.__mis.q = []; window.__mis.handlers.get_mis_production_value_summary = (a) => { const d = window.__mis.defer(); window.__mis.q.push({ a, d }); return d.promise; }; });
    await page.selectOption("#pvAsOf", month.slice(0, 8) + "05");
    await page.selectOption("#pvAsOf", month.slice(0, 8) + "20");
    await page.waitForFunction(() => window.__mis.q.length === 2);
    const mk = (run, d) => ({ data: { report_month: "x", as_of_date: d, approved_cost_run_id: run, approved_cost_valuation_date: "2026-01-01", status: "BULK_RECEIPT_COVERED_REFERENCE", plan_status: "UNAVAILABLE_PENDING_FROZEN_PLAN", receipt_event_count: 1, receipt_unvalued_count: 0, receipt_correction_event_count: 0, receipt_reference_covered_value: 7, receipt_value_status: "COVERED_SUBTOTAL", completed_status: "NOT_VERIFIED", comparability: "NOT_COMPARABLE" }, error: null });
    await page.evaluate((r) => window.__mis.q[1].d.resolve(r), mk(220, month.slice(0, 8) + "20"));
    await page.waitForFunction(() => /#220/.test(document.querySelector("#productionValueBody").textContent));
    await page.evaluate((r) => window.__mis.q[0].d.resolve(r), mk(105, month.slice(0, 8) + "05"));
    await page.waitForTimeout(150);
    assert.match(await pvText(page), /#220/); assert.doesNotMatch(await pvText(page), /#105/);
    assert.equal((await calls(page, "v_mis_batch_pipeline")).length, 1);
  } finally { await page.context().close(); }
});

test("as-of: 320/390/520 presentation keeps month, day selector and status inside the viewport at touch height", { skip }, async () => {
  for (const width of [320, 390, 520]) {
    const { page, month, day } = await openAsOf(width);
    try {
      await page.selectOption("#pvMonth", month); await idle(page);
      await page.selectOption("#pvAsOf", day); await idle(page);
      for (const sel of ["#pvAsOf", "#pvMonth", "#pvAsOfStatus"]) {
        const r = await page.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width, h: b.height }; });
        assert.ok(r.l >= 0 && r.r <= width + 0.5 && r.w > 100 && r.h >= 20, `${width} ${sel} ${JSON.stringify(r)}`);
      }
      assert.ok((await page.$eval("#pvAsOf", (e) => e.getBoundingClientRect().height)) >= 34, `touch height @${width}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `no overflow @${width}`);
      if (process.env.MIS_SCREENSHOT_DIR && width === 390) {
        await page.locator("#productionValueSection").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${process.env.MIS_SCREENSHOT_DIR}/asof-select-390.png` });
      }
    } finally { await page.context().close(); }
  }
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
      await noPageOverflow("production");
      // keyboard: month select reachable and focus ring defined
      await page.focus("#pvMonth");
      assert.equal(await page.evaluate(() => document.activeElement.id), "pvMonth");
      if (process.env.MIS_SCREENSHOT_DIR) {
        await page.evaluate(() => document.querySelector("#tabPanel").scrollTo(0, 0));
        await page.screenshot({ path: `${process.env.MIS_SCREENSHOT_DIR}/production-value-${width}.png`, fullPage: false });
      }
      assert.deepEqual(consoleErrors, []);
    } finally { await page.context().close(); }
  });
}
