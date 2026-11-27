// MIS-C1 browser harness for the Executive MIS Dashboard.
// Serves /public from disk and replaces the Supabase ESM import with an in-page mock whose responses the test
// controls (deferred/slow/failing). No network, no real Supabase, no writes. A pass here is a *simulation*
// result; it is not authenticated production acceptance.
//
// Requires Playwright (chromium) on NODE_PATH; callers should skip (not fail) when launchBrowser() returns null.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PAGE_PATH = "/shared/executive-mis-dashboard.html";
export const WIDTHS = [320, 375, 390, 430, 520, 768, 1280, 1440];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };

// In-page Supabase mock. Fixtures are keyed by RPC / table name; tests override via window.__mis.handlers[name].
export const SUPABASE_STUB = `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "mis-test@example.invalid" };
const session = { access_token: "stub", user };
const mis = (window.__mis = window.__mis || {});
mis.calls = [];
mis.handlers = mis.handlers || {};
mis.permission = mis.permission || "granted"; // granted | denied | error | sales-only
mis.defer = () => { let resolve; const promise = new Promise((r) => (resolve = r)); return { promise, resolve }; };
const names = (n, make) => Array.from({ length: n }, (_, i) => make(i));
const page = (total, args, make) => {
  const off = args.p_offset || 0, lim = args.p_limit || 25;
  return { data: names(Math.max(0, Math.min(lim, total - off)), (i) => ({ ...make(off + i), total_rows: total })), error: null };
};
const searchTotal = (args, all, hit) => (args.p_search ? hit : all);
// R1 pinned canonical fields (fixture of the candidate DDL; real figures from the R1 live receipt).
const CANONICAL_INVENTORY = { canonical_rm_known_value: 31248056.94768, canonical_rm_item_count: 828, canonical_rm_valuation_gap_count: 0, canonical_pm_known_value: 8051832.75491, canonical_pm_item_count: 877, canonical_pm_valuation_gap_count: 0, canonical_ind_known_value: 1052734.636, canonical_ind_item_count: 68, canonical_ind_valuation_gap_count: 0, inventory_known_value: 40352624.33859, unclassified_known_value: null, unclassified_item_count: 0, valuation_gap_item_count: 0, zero_quantity_item_count: 329, duplicate_item_row_count: 0, missing_item_id_count: 0, canonical_inventory_scope_note: "Manufacturing inventory: RM Raw Material, PM Packing Material, IND Indirect Materials & Utilities" };
mis.CANONICAL_INVENTORY = CANONICAL_INVENTORY;
const fixtures = {
  get_user_permissions: () => mis.permission === "error"
    ? { data: null, error: { message: "permission lookup failed" } }
    : mis.permission === "sales-only"
      ? { data: [{ target: "module:sales-data-viewer", can_view: true, can_edit: false }], error: null }
      : { data: [{ target: "module:executive-mis-dashboard", can_view: mis.permission === "granted", can_edit: false }], error: null },
  // R3 capability discovery (pinned contract: R3_R4_SERVER_CANDIDATE.sql). Fixture adapters only; shapes are the SQL result keys.
  ei_sales_access: () => mis.permission === "granted" ? { data: { executive: true, sales: true }, error: null }
    : mis.permission === "sales-only" ? { data: { executive: false, sales: true }, error: null }
    : { data: null, error: { code: "42501", message: "Sales access denied" } },
  ei_sales_dimensions: () => ({ data: { regions: [{ id: 1, code: "IK", name: "Inside Kerala" }, { id: 2, code: "OK", name: "Outside Kerala" }], godowns: [{ id: 10, code: "G1", name: "Kozhikode", region_id: 1 }, { id: 20, code: "G2", name: "Chennai", region_id: 2 }], categories: [{ id: 1, name: "Medicines" }, { id: 2, name: "Cosmetics" }], subcategories: [{ id: 11, category_id: 1, name: "Kashayam" }, { id: 12, category_id: 1, name: "Arishtam" }, { id: 21, category_id: 2, name: "Oils" }], groups: [{ id: 111, subcategory_id: 11, name: "Group A" }, { id: 121, subcategory_id: 12, name: "Group B" }, { id: 211, subcategory_id: 21, name: "Group C" }], subgroups: [{ id: 1111, group_id: 111, name: "Sub X" }, { id: 1112, group_id: 111, name: "Sub Y" }, { id: 2111, group_id: 211, name: "Sub Z" }], first_mapped_date: "2024-01-01", last_mapped_date: "2026-11-24" }, error: null }),
  ei_sales_comparison: (a) => ({ data: { anchor: a.p_anchor || "2026-11-24", latest_mapped_date: "2026-11-24", comparison_basis: "MATCHED_CALENDAR_DAY_CAPPED_AT_MONTH_END", quantity_basis: "NET_PACKAGE_COUNTS_NOT_PHYSICAL_QUANTITY", periods: [
      { label: "CURRENT", start_date: "2026-11-01", end_date: "2026-11-24", row_count: 900, observed_dates: 21, sales_value: 11324986.78, actual_packages: 116179, billed_packages: 108098, positive_rows: 800, negative_rows: 250, asp_actual_package: 97.48, asp_billed_package: 104.77, coverage: "OBSERVED_NOT_CERTIFIED" },
      { label: "PREVIOUS_MONTH", start_date: "2026-10-01", end_date: "2026-10-24", row_count: 950, observed_dates: 21, sales_value: 13264134.13, actual_packages: 120000, billed_packages: 110000, positive_rows: 850, negative_rows: 41, asp_actual_package: 110.53, asp_billed_package: 120.58, coverage: "OBSERVED_NOT_CERTIFIED" },
      { label: "PREVIOUS_YEAR", start_date: "2025-11-01", end_date: "2025-11-24", row_count: 0, observed_dates: 0, sales_value: null, actual_packages: null, billed_packages: null, positive_rows: 0, negative_rows: 0, asp_actual_package: null, asp_billed_package: null, coverage: "NO_RECORDED_ROWS" }],
    mom_pct: -14.61, yoy_pct: null, import_completeness: "NOT_CERTIFIED", active_filter_basis: "CURRENT_MASTER" }, error: null }),
  ei_sales_window_totals: () => ({ data: { anchor: "2026-11-24", basis: "PRECEDING_COMPLETE_CALENDAR_MONTHS_EXCLUDING_ANCHOR_MONTH", import_completeness: "NOT_CERTIFIED", windows: [
      { n: 3, start_date: "2026-08-01", end_date: "2026-10-31", observed_months: 3, ambiguous_amount_groups: 0, source_reported_amount: 36000000, actual_packages: 360000, billed_packages: 330000, sales_value: 36000000, average_monthly_sales: 12000000, asp_actual_package: 100, asp_billed_package: 109.09 },
      { n: 12, start_date: "2025-11-01", end_date: "2026-10-31", observed_months: 11, ambiguous_amount_groups: 34, source_reported_amount: 150000000, actual_packages: null, billed_packages: 1200000, sales_value: null, average_monthly_sales: null, asp_actual_package: null, asp_billed_package: null }] }, error: null }),
  ei_sales_history: (a) => { const monthly = a.p_group === "month" || String(a.p_group).endsWith("_month"); const total = 60; const off = a.p_offset || 0, lim = a.p_limit || 50;
    const mk = (i) => ({ dimension_id: a.p_group === "month" ? "ALL" : String(100 + (monthly ? Math.floor(i / 2) : i)), dimension_name: a.p_group === "month" ? "All sales" : "Item " + (monthly ? Math.floor(i / 2) + 1 : i + 1), month: monthly ? (a.p_group === "month" ? "2026-" + String((i % 12) + 1).padStart(2, "0") + "-01" : "2026-" + String((i % 2) + 9).padStart(2, "0") + "-01") : null, source_groups: 2, historical_groups: 1, ambiguous_amount_groups: i === 1 ? 2 : 0, sales_value: i === 1 ? null : 1000 - i, source_reported_amount: 1000 - i + (i === 1 ? 0 : 0), actual_packages: 10, billed_packages: 9, asp_actual_package: i === 1 ? null : 100, asp_billed_package: i === 1 ? null : 111, coverage: i === 1 ? "MISSING_OR_AMBIGUOUS_MEASURES" : "OBSERVED_NOT_CERTIFIED" });
    return { data: { anchor: a.p_anchor || "2026-11-24", start_date: "2025-12-01", latest_mapped_date: "2026-11-24", total: a.p_search ? 3 : total, limit: lim, offset: off, quantity_basis: "NET_PACKAGE_COUNTS_NOT_PHYSICAL_QUANTITY", import_completeness: "NOT_CERTIFIED", rows: Array.from({ length: Math.max(0, Math.min(lim, (a.p_search ? 3 : total) - off)) }, (_, i) => mk(off + i)) }, error: null }; },
  ei_sales_exceptions: (a) => ({ data: { anchor: "2026-11-24", start_date: "2026-11-01", import_completeness: "NOT_CERTIFIED", eligibility_basis: "CURRENT_MASTER_ONLY", total: a.p_search ? 1 : 3, limit: a.p_limit, offset: a.p_offset, rows: [
      { sku_id: 1, product_id: 1, product_name: "Alpha", pack_size: 100, uom: "ml", is_active: true, eligibility: "CURRENT_ELIGIBLE", activity_state: "NO_RECORDED_SALES_COVERAGE_UNCERTIFIED", recorded_rows: null, net_billed: null, positive_rows: null, return_rows: null, missing_rows: null },
      { sku_id: 2, product_id: 1, product_name: "Alpha", pack_size: 200, uom: "ml", is_active: true, eligibility: "CURRENT_ELIGIBLE", activity_state: "BILLED_SALES_OFFSET_BY_RETURNS", recorded_rows: 2, net_billed: 0, positive_rows: 1, return_rows: 1, missing_rows: 0 },
      { sku_id: 3, product_id: 2, product_name: "Beta", pack_size: 1, uom: "L", is_active: false, eligibility: "INACTIVE_CURRENT_MASTER", activity_state: "MISSING_MEASURES", recorded_rows: 1, net_billed: 5, positive_rows: 1, return_rows: 0, missing_rows: 1 }].slice(0, a.p_search ? 1 : 3) }, error: null }),
  ei_sales_coverage: () => ({ data: { anchor: "2026-11-24", latest_mapped_date: "2026-11-24", latest_raw_date: "2026-11-24", observed_raw_dates: 2, observed_mapped_dates: 2, import_completeness: "NOT_CERTIFIED", days: [
      { transaction_date: "2026-11-23", raw_rows: 100, mapped_rows: 100, distinct_source_keys: 100, missing_amount_rows: 0, latest_job_status: "SUCCEEDED", latest_job_finished_at: "2026-11-23T20:00:00Z", state: "OBSERVED_NOT_CERTIFIED" },
      { transaction_date: "2026-11-24", raw_rows: 120, mapped_rows: 118, distinct_source_keys: 118, missing_amount_rows: 0, latest_job_status: null, latest_job_finished_at: null, state: "MAPPING_COUNT_MISMATCH" }] }, error: null }),
  ei_sales_refresh_status: () => ({ data: { monthly_latest_month: "2026-10-01", monthly_source_max_inserted_at: "2026-11-24T01:00:00Z", daily_source_max_inserted_at: "2026-11-24T20:00:00Z", daily_last_date_in_month: "2026-10-31", monthly_reported_amount: 100, daily_reported_amount: 98, amount_difference: -2, coverage: "NOT_CERTIFIED", refresh_job_status: "succeeded", refresh_job: { status: "succeeded", active: true, last_started_at: "2026-11-25T21:45:00Z", last_finished_at: "2026-11-25T21:45:30Z" } }, error: null }),
  // Facility classification (installed contract ei_facility_sales_scope). Synthetic figures, shape = SQL result keys.
  ei_facility_sales_scope: (a) => ({ data: { anchor: a.p_anchor || "2026-11-25", start_date: "2025-12-01", latest_raw_date: "2026-11-25", facility: { recorded_rows: 1000, missing_amount_rows: 0, source_reported_amount: 5000000, billed_value: 5000000, godown_unresolved_rows: 20 }, rows: [
      { scope: "OTHER_MANUFACTURING_UNIT", recorded_rows: 30, missing_amount_rows: 0, source_reported_amount: 50000, billed_value: 50000, godown_unresolved_rows: 0 },
      { scope: "SASV_CANONICAL_PRODUCT", recorded_rows: 940, missing_amount_rows: 0, source_reported_amount: 4900000, billed_value: 4900000, godown_unresolved_rows: 18 },
      { scope: "SASV_SAMPLE", recorded_rows: 10, missing_amount_rows: 2, source_reported_amount: 1000, billed_value: null, godown_unresolved_rows: 0 },
      { scope: "UNCLASSIFIED", recorded_rows: 15, missing_amount_rows: 0, source_reported_amount: 40000, billed_value: 40000, godown_unresolved_rows: 2 },
      { scope: "CLASSIFICATION_CONFLICT", recorded_rows: 5, missing_amount_rows: 0, source_reported_amount: 9000, billed_value: 9000, godown_unresolved_rows: 0 }], import_completeness: "NOT_CERTIFIED", ownership_classification: "CANONICAL_MASTER_AND_OWNER_APPROVED_SCOPE", scope_note: "Scope note from server." }, error: null }),
  ei_management_alerts: () => ({ data: { catalogue: "INVENTORY_WIP_FG_INTEGRITY", coverage: "PARTIAL_CATALOGUE", rows: [
      { key: "fg.missing_log", label: "FG transfer groups missing production log", evidence_date: "2026-11-24", findings: null, state: "UNAVAILABLE", severity: "REVIEW_ONLY" },
      { key: "inventory.duplicate_identity", label: "Duplicate inventory identities", evidence_date: "2026-11-25", findings: 0, state: "CLEAR", severity: "REVIEW_ONLY" },
      { key: "inventory.valuation_gap", label: "Inventory valuation gaps", evidence_date: "2026-11-25", findings: 4, state: "REVIEW", severity: "REVIEW_ONLY" },
      { key: "production.overdue_wip", label: "Overdue work in process", evidence_date: "2026-11-25", findings: 59, state: "REVIEW", severity: "REVIEW_ONLY" }] }, error: null }),
  mv_mis_executive_summary: () => ({ data: { mis_summary_id: 1, mv_refreshed_at: new Date().toISOString(), financial_position_date: "2026-11-24", sales_position_date: "2026-11-24", report_generated_date: "2026-11-25", production_report_month_start: "2026-11-01", payables_sundry_creditors: -100, receivables_sundry_debtors: 200, net_sundry_position: 100, sales_value_month_to_date: 5000, manufacturing_inventory_value: 7000, fg_inventory_value_overall: 9000, active_pipeline_batch_count: 412, work_in_process_batch_count: 100, overdue_work_in_process_batch_count: 59, transferred_to_finished_goods_value: 123456, planning_period_status: "CURRENT_MONTH_PLAN_AVAILABLE" }, error: null }),
  v_mis_finance_tab_summary: () => ({ data: { finance_scope_note: "Finance scope note" }, error: null }),
  v_mis_sales_tab_summary: () => ({ data: { report_date: "2026-05-31", month_start: "2026-05-01", month_upto_date: "2026-05-31", latest_day_sales_value: 396645.05, latest_day_sales_units: 4019, latest_day_billed_units: 3710, month_to_date_sales_value: 11324986.78, month_to_date_sales_units: 116179, month_to_date_billed_units: 108098, sales_days_available_in_month: 21, products_sold_month_to_date: 409, skus_sold_month_to_date: 518, average_daily_sales_value: 539285.084761904762, sales_scope_note: "Sales note" }, error: null }),
  v_mis_inventory_tab_summary: () => ({ data: { total_inventory_item_count: 1773, raw_material_item_count: 826, packing_material_item_count: 877, consumables_item_count: 62, fuel_item_count: 6, inventory_scope_note: "Inventory note", ...CANONICAL_INVENTORY }, error: null }),
  v_mis_finished_goods_tab_summary: () => ({ data: { sku_count: 622, stock_value_overall: 100, zero_stock_sku_count: 54, below_1_month_cover_count: 104, above_6_month_cover_count: 101, finished_goods_scope_note: "FG note" }, error: null }),
  v_mis_batch_pipeline: () => ({ data: { active_pipeline_batch_count: 412, work_in_process_batch_count: 100, overdue_work_in_process_batch_count: 59, finished_goods_bulk_batch_count: 7, bottled_stock_batch_count: 8, total_canonical_batch_count: 2581 }, error: null }),
  get_mis_production_value_summary: (a) => ({ data: { report_month: a.p_report_month, as_of_date: a.p_as_of_date || "2026-11-20", approved_cost_run_id: 143, approved_cost_valuation_date: "2026-10-22", status: "BULK_RECEIPT_COVERED_REFERENCE", plan_status: "UNAVAILABLE_PENDING_FROZEN_PLAN", component_policy: "RM_STORES_PM_EXCLUDED", planned_product_count: null, planned_unvalued_count: null, planned_reference_covered_value: null, receipt_event_count: 80, receipt_unvalued_count: 2, receipt_correction_event_count: 0, receipt_reference_covered_value: 3204140.56, receipt_value_status: "PARTIAL_COVERAGE", tally_fg_transfer_book_value: 2500000, transfer_line_count: 41, tally_snapshot_as_of: "2026-11-20", transfer_reconciliation_status: "NOT_CHECKED_BY_BOOK_TOTAL", transfer_missing_amount_lines: 0, completed_reference_value: null, completed_status: "NOT_VERIFIED", plan_achievement_pct: null, comparability: "NOT_COMPARABLE" }, error: null }),
  v_mis_finance_outstanding_detail: () => ({ data: [{ bill_date_text: "1-Apr-26", bill_ref: "B-1", outstanding_amount_tally_value: -50, outstanding_amount_abs_line_value: 50 }], error: null }),
  get_mis_finance_party_page: (a) => page(searchTotal(a, 60, 3), a, (i) => ({ party_name: (a.p_search ? "Match " : "Party ") + (i + 1), mis_group_name: a.p_group_filter === "receivables" ? "Sundry Debtors" : "Sundry Creditors", bill_count: 2, outstanding_amount_mis_value: 100, signed_outstanding_tally_value: -100 })),
  get_mis_sales_product_page: (a) => page(searchTotal(a, 60, 4), a, (i) => ({ product_name: (a.p_search ? "Sprod " : "Product ") + (i + 1), sku_count: 2, sales_value: 10, sales_units: 3, latest_day_sales_value: 1, average_daily_sales_value: 1 })),
  get_mis_inventory_item_page: (a) => page(searchTotal(a, 60, 5), a, (i) => ({ code: "C" + i, item_name: (a.p_search ? "Iitem " : "Item ") + (i + 1), source_label: a.p_source_kind, qty_value: 1, avg_rate_value: 1, stock_value: 1, category_label: "Cat", subcategory_label: "Sub" })),
  get_mis_finished_goods_sku_page: (a) => page(searchTotal(a, 60, 2), a, (i) => ({ item: (a.p_search ? "Fitem " : "SKU ") + (i + 1), pack_size: 100, uom: "ml", stock_overall: 1, forecast_overall: 1, mos_overall: 1, stock_value_overall: 1, mos_status: ["ZERO_STOCK", "BELOW_1_MONTH", "ONE_TO_THREE_MONTHS", "ABOVE_6_MONTHS", "NORMAL"][i % 5], classification: "Cls" })),
};
// Finance ageing (R8.17): synthetic, shape = docs/executive-intelligence-r2/FINANCE_AGEING_SERVER_SPEC.md. Not production figures.
const ageSplit = (n, w) => { const t = w.reduce((a, b) => a + b, 0); return w.map((x) => Math.round((n * x) / t * 100) / 100); };
fixtures.get_mis_finance_ageing_summary = (a) => {
  const b = a.p_bounds || [30, 60, 90];
  const mk = (group, label, total, w, bills, parties) => ({ group, label, total_amount: total, bucket_amounts: ageSplit(total, w.slice(0, b.length + 1)), bucket_bill_counts: w.slice(0, b.length + 1).map((x) => x * 3), bill_count: bills, party_count: parties, oldest_age_days: 412, weighted_avg_age_days: 71, undated_amount: 0 });
  return { data: { as_of: a.p_as_of || "2026-11-27", basis: "bill_date", bounds: b, groups: [mk("payables", "Payables — Sundry Creditors", 42408063.89, [30, 24, 18, 12, 9, 7], 410, 120), mk("receivables", "Receivables — Sundry Debtors", 22304842.1, [20, 22, 25, 18, 10, 5], 260, 74)] }, error: null };
};
fixtures.get_mis_finance_ageing_party_page = (a) => {
  const b = a.p_bounds || [30, 60, 90];
  return page(searchTotal(a, 60, 3), a, (i) => { const tot = 500000 - i * 6000; return { party_name: (a.p_search ? "Match " : "Party ") + (i + 1), mis_group_name: a.p_group_filter === "receivables" ? "Sundry Debtors" : "Sundry Creditors", bill_count: 5 + (i % 7), outstanding_amount_mis_value: tot, signed_outstanding_tally_value: tot, bucket_amounts: ageSplit(tot, [5, 4, 3, 2, 1, 1].slice(0, b.length + 1)), bucket_bill_counts: [2, 1, 1, 1, 0, 0].slice(0, b.length + 1), oldest_age_days: 40 + i * 5, weighted_avg_age_days: 25 + i }; });
};
fixtures.v_ei_sales_mtd_summary = fixtures.v_mis_sales_tab_summary;
fixtures.ei_sales_mtd_product_page = fixtures.get_mis_sales_product_page;
function respond(kind, name, args, chain) {
  mis.calls.push({ kind, name, args: args || null, chain: chain || null, at: Date.now() });
  const handler = mis.handlers[name] || fixtures[name];
  return Promise.resolve(handler ? handler(args || {}, chain || []) : { data: null, error: null });
}
function chain(table) {
  const steps = [];
  const proxy = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (res, rej) => respond("from", table, null, steps).then(res, rej);
      if (prop === "catch" || prop === "finally") return () => proxy;
      return (...a) => { steps.push([prop, ...a]); return proxy; };
    },
  });
  return proxy;
}
export function createClient() {
  const client = {
    auth: { getSession: async () => ({ data: { session }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from: (t) => chain(t),
    rpc: (name, args) => respond("rpc", name, args),
    schema: () => client,
  };
  return client;
}
`;

export function launchBrowser() {
  try {
    const require = createRequire(import.meta.url);
    return require("playwright").chromium;
  } catch {
    return null;
  }
}

export function startServer() {
  const pub = path.join(root, "public");
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = path.join(pub, url);
    if (!file.startsWith(pub) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end("not found"); return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

// Opens the dashboard with the mock installed on a lens (default Finance, via the URL hash). Resolves once that lens has first rendered unless opts.noWait.
export async function openDashboard(browser, base, { width = 1280, height = 800, permission = "granted", init, noWait = false, lens = "finance", deviceScaleFactor = 1 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, timezoneId: "UTC" }); // fixed zone: formatted timestamps do not depend on the machine running the test
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    if (u.includes("esm.sh/@supabase/supabase-js")) return route.fulfill({ status: 200, contentType: "text/javascript", body: SUPABASE_STUB });
    return route.abort();
  });
  await page.addInitScript((p) => { window.__mis = { permission: p }; }, permission);
  if (init) await page.addInitScript(init);
  await page.goto(base + PAGE_PATH + (lens ? `#${lens}` : ""));
  const ready = { finance: "#financePartyTableWrap .finance-table, #financePartyTableWrap .ei-rc", overview: ".ei-overview .kpi-card" }[lens];
  if (!noWait && permission === "granted" && ready) await page.waitForSelector(ready, { timeout: 8000 });
  return { context, page, consoleErrors };
}

export const calls = (page, name) => page.evaluate((n) => window.__mis.calls.filter((c) => !n || c.name === n).map((c) => ({ name: c.name, args: c.args, chain: c.chain })), name);
export const setHandler = (page, name, fn) => page.evaluate(([n, src]) => { window.__mis.handlers[n] = (0, eval)("(" + src + ")"); }, [name, fn.toString()]);
