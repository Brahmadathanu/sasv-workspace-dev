// SYNTHETIC fixtures for the local loopback preview. Pure data, no imports, safe to serve to the browser.
// Rules (enforced by tests/synthetic-fixtures.test.mjs):
//   * every column used here must exist in the repository schema contract (types/supabase.ts or the migration
//     that defines the view); unlisted columns are left null/absent, never invented;
//   * every id is >= 900000 and every human label says SYNTHETIC;
//   * every number is a round fictional placeholder, NOT a costing result and NOT derived from production data;
//   * status vocabulary is limited to codes the client already renders (costing-status-labels.js, helpers/smokes).
// Scenario set: three fictional SKUs of two fictional products with READY / REVIEW_REQUIRED / BLOCKED outcomes,
// an approved October run (900001), a successful NOT APPROVED November draft (900004), and a later FAILED attempt (900005) that never supplies cost snapshots.
export const SYNTHETIC = "SYNTHETIC";
const P = "2026-11-01"; // governed (current) period
const PRIOR = "2026-10-01";
const VAL = "2026-11-02";
const TS = "2026-11-02T04:30:00Z";
const by = "synthetic-preview";

export const PRODUCTS = Object.freeze([
  { product_id: 900101, product_name: SYNTHETIC + " Sample Oil", category_name: SYNTHETIC + " Category A", subcategory_name: SYNTHETIC + " Subcategory A1", group_name: SYNTHETIC + " Group A", sub_group_name: SYNTHETIC + " Subgroup A1" },
  { product_id: 900102, product_name: SYNTHETIC + " Sample Powder", category_name: SYNTHETIC + " Category B", subcategory_name: SYNTHETIC + " Subcategory B1", group_name: SYNTHETIC + " Group B", sub_group_name: SYNTHETIC + " Subgroup B1" },
  { product_id: 900103, product_name: SYNTHETIC + " Sample Tablet", category_name: SYNTHETIC + " Category B", subcategory_name: SYNTHETIC + " Subcategory B1", group_name: SYNTHETIC + " Group B", sub_group_name: SYNTHETIC + " Subgroup B2" },
]);
// outcome: READY | REVIEW_REQUIRED | BLOCKED. Money-like values are round placeholders.
export const SKUS = Object.freeze([
  { sku_id: 900001, product_id: 900101, pack_size: 200, pack_uom: "mL", outcome: "READY", control: "READY", severity: "INFO", mat: "READY", mrp_ik: 200, mrp_ok: 220, cost: 100 },
  { sku_id: 900002, product_id: 900102, pack_size: 100, pack_uom: "g", outcome: "REVIEW_REQUIRED", control: "MATERIAL_REVIEW_REQUIRED", severity: "REVIEW", mat: "REVIEW_REQUIRED", mrp_ik: 300, mrp_ok: 330, cost: 150 },
  { sku_id: 900003, product_id: 900103, pack_size: 60, pack_uom: "nos", outcome: "BLOCKED", control: "MATERIAL_COST_BLOCKED", severity: "BLOCKER", mat: "BLOCKED", mrp_ik: 400, mrp_ok: 440, cost: 0 },
]);
const prod = (id) => PRODUCTS.find((p) => p.product_id === id);
const label = (s) => SYNTHETIC + " " + prod(s.product_id).product_name.replace(SYNTHETIC + " ", "") + " " + s.pack_size + s.pack_uom;
const bridge = (s) => (s.outcome === "READY" ? "READY" : s.outcome === "BLOCKED" ? "BLOCKED" : "REVIEW_REQUIRED");

// ---- control status per SKU (existing + typed snapshot views) ----
const skuStatusRow = (s) => ({
  period_start: P, refresh_run_id: 900004, valuation_date: VAL, sku_id: s.sku_id, product_id: s.product_id,
  product_name: prod(s.product_id).product_name, pack_size: s.pack_size, pack_uom: s.pack_uom,
  first_control_status: s.control, control_severity: s.severity, material_costing_status: s.mat,
  control_note: s.outcome === "READY" ? SYNTHETIC + " fixture: no blocker" : SYNTHETIC + " fixture: " + s.control.toLowerCase().replace(/_/g, " "),
  rm_costing_status: s.mat, pm_costing_status: s.outcome === "BLOCKED" ? "BLOCKED" : "READY",
  cost_sheet_status: bridge(s), internal_loaded_cost_status: bridge(s), manufacturing_cop_status: bridge(s),
  pricing_bridge_status: bridge(s), selling_price_bridge_status: bridge(s),
  recommended_ui_route: s.outcome === "READY" ? null : s.outcome === "BLOCKED" ? "MATERIAL_RATE_REVIEW" : "MATERIAL_REVIEW",
  mrp_ik: s.mrp_ik, mrp_ok: s.mrp_ok, material_cost_per_sku: s.cost,
  ik_selling_price: s.outcome === "BLOCKED" ? null : s.mrp_ik, ok_selling_price: s.outcome === "BLOCKED" ? null : s.mrp_ok,
  rm_blocking_line_count: s.outcome === "BLOCKED" ? 1 : 0, pm_blocking_line_count: 0,
  rm_manual_rate_line_count: s.outcome === "REVIEW_REQUIRED" ? 1 : 0, pm_manual_rate_line_count: 0,
  rm_review_rate_line_count: s.outcome === "REVIEW_REQUIRED" ? 1 : 0, pm_review_rate_line_count: 0,
  rm_stale_purchase_rate_line_count: 0, pm_stale_purchase_rate_line_count: 0,
  rm_stock_valuation_fallback_line_count: 0, pm_stock_valuation_fallback_line_count: 0,
  snapshot_refreshed_at: TS, synthetic: true,
});
export const SKU_STATUS_ROWS = SKUS.map(skuStatusRow);

// ---- governed period selection: Oct APPROVED, Nov successful draft (latest failed attempt separate) ----
const runBase = { newer_draft_run_id: null, active_run_id: null, active_run_status: null, latest_draft_run_id: null, latest_draft_valuation_date: null,
  newer_draft_count: 0, superseded_run_count: 0, pricing_use_label: SYNTHETIC + " fixture - not an official run" };
export const RUN_ROWS = [
  { ...runBase, period_start: PRIOR, display_state: "APPROVED", display_label: SYNTHETIC + " Approved run 900001", display_label_v2: SYNTHETIC + " Approved run 900001",
    displayed_run_id: 900001, approved_run_id: 900001, approved_at: "2026-10-31T10:00:00Z", approved_by: by, official_valuation_date: "2026-10-31", approved_run_valuation_date: "2026-10-31" },
  { ...runBase, period_start: P, display_state: "DRAFT", display_label: SYNTHETIC + " DRAFT run 900004 - not approved", display_label_v2: SYNTHETIC + " DRAFT run 900004 - not approved",
    displayed_run_id: 900004, approved_run_id: null, approved_at: null, approved_by: null, active_run_id: null, active_run_status: null,
    official_valuation_date: null, latest_draft_run_id: 900004, latest_draft_valuation_date: VAL, approved_run_valuation_date: null },
];

// Columns = the client's explicit select list in costing-approval-screen.js (no generated type exists).
const runDisplay = (id, period, val, overall, designation, display, inUse, label) => ({ refresh_run_id: id, period_start: period, valuation_date: val, overall_status: overall, source_trigger: "MANUAL",
  requested_at: TS, finished_at: TS, stored_designation: designation, display_status: display, in_use_for_pricing: inUse, pricing_use_label: SYNTHETIC + " fixture - not an official run",
  superseded_by_run_id: null, designated_at: designation ? TS : null, designated_by: designation ? by : null, designation_reason: designation ? SYNTHETIC + " fixture" : null, display_label: label });
export const RUN_DISPLAY_ROWS = [
  runDisplay(900001, PRIOR, "2026-10-31", "SUCCESS", "APPROVED", "APPROVED", true, SYNTHETIC + " Approved run 900001"),
  runDisplay(900004, P, VAL, "SUCCESS", null, "DRAFT", false, SYNTHETIC + " DRAFT run 900004 - not approved"),
  runDisplay(900005, P, VAL, "FAILED", null, "FAILED", false, SYNTHETIC + " Run 900005 FAILED - not approved"),
];

// ---- dashboard / KPI / integrity ----
const dash = (period, run, status, ready, review, blocked, valuation) => ({
  period_start: period, refresh_run_id: run, valuation_date: valuation, overall_control_status: status,
  overall_control_note: SYNTHETIC + " fixture - fictional counts, not official costing",
  ready_sku_count: ready, review_required_sku_count: review, blocked_sku_count: blocked, total_sku_count: ready + review + blocked,
  generated_at: period + "T00:00:00Z", snapshot_refreshed_at: period + "T00:00:00Z",
  material_cost_blocked_sku_count: blocked, material_review_required_sku_count: review,
  rm_blocker_item_count: blocked, rm_review_item_count: review, pm_blocker_item_count: 0, pm_review_item_count: 0,
  rm_blocker_affected_sku_count: blocked, rm_review_affected_sku_count: review, pm_blocker_affected_sku_count: 0, pm_review_affected_sku_count: 0,
  top_rm_blocker_stock_item_name: blocked ? SYNTHETIC + " Sample Herb Extract" : null, top_rm_blocker_stock_item_code: blocked ? "SYN-RM-900001" : null, top_rm_blocker_stock_item_id: blocked ? 900001 : null,
  top_rm_review_stock_item_name: review ? SYNTHETIC + " Sample Excipient" : null, top_rm_review_stock_item_code: review ? "SYN-RM-900002" : null, top_rm_review_stock_item_id: review ? 900002 : null,
});
export const DASHBOARD_ROWS = [dash(P, 900004, "BLOCKED", 1, 1, 1, VAL), dash(PRIOR, 900001, "READY", 3, 0, 0, "2026-10-31")];
export const KPI_ROWS = [
  { period_start: P, costing_ready_sku_count: 1, costing_review_sku_count: 1, costing_blocked_sku_count: 1, latest_refresh_status: "FAILED", latest_refresh_scope: SYNTHETIC + " fixture",
    latest_refresh_finished_at: TS, total_pricing_sku_count: 3, selling_policy_complete_count: 2, selling_policy_missing_count: 1, scheme_policy_complete_count: 1, scheme_policy_missing_count: 2,
    scheme_blocked_row_count: 0, scheme_review_row_count: 1, scheme_calculation_row_count: 3, selling_price_row_count: 2, workbench_blocked_item_count: 1, workbench_review_item_count: 1, workbench_issue_line_count: 2 },
  { period_start: PRIOR, costing_ready_sku_count: 3, costing_review_sku_count: 0, costing_blocked_sku_count: 0, latest_refresh_status: "SUCCESS", latest_refresh_scope: SYNTHETIC + " fixture",
    latest_refresh_finished_at: "2026-10-31T00:00:00Z", total_pricing_sku_count: 3, selling_policy_complete_count: 3, selling_policy_missing_count: 0, scheme_policy_complete_count: 3, scheme_policy_missing_count: 0,
    scheme_blocked_row_count: 0, scheme_review_row_count: 0, scheme_calculation_row_count: 3, selling_price_row_count: 3, workbench_blocked_item_count: 0, workbench_review_item_count: 0, workbench_issue_line_count: 0 },
];
export const INTEGRITY_ROWS = [
  { period_start: P, refresh_run_id: 900004, valuation_date: VAL, check_code: "SYNTHETIC_SKU_COUNT_MATCH", check_status: "PASS", observed_count: 3, expected_rule: SYNTHETIC + " fixture rule", diagnostic_note: SYNTHETIC + " fixture check", snapshot_refreshed_at: TS },
  { period_start: P, refresh_run_id: 900004, valuation_date: VAL, check_code: "SYNTHETIC_MATERIAL_RATES_PRESENT", check_status: "FAIL", observed_count: 1, expected_rule: SYNTHETIC + " fixture rule", diagnostic_note: SYNTHETIC + " fixture: one blocked material", snapshot_refreshed_at: TS },
];

// ---- material review ----
export const MATERIAL_ACTION_ROWS = [
  { period_start: P, refresh_run_id: 900004, valuation_date: VAL, material_area: "RM", stock_item_id: 900001, stock_item_code: "SYN-RM-900001", stock_item_name: SYNTHETIC + " Sample Herb Extract",
    action_severity: "BLOCKER", action_required_summary: SYNTHETIC + " fixture: selected rate missing", action_note_summary: SYNTHETIC + " fixture", issue_codes: "MISSING_MATERIAL_RATE", warning_codes: null,
    affected_sku_count: 1, affected_product_count: 1, affected_line_count: 1, approval_blocking_sku_count: 1, approval_blocking_line_count: 1, review_sku_count: 0, review_line_count: 0,
    has_missing_selected_rate: true, has_missing_rate_source: true, has_optional_lines: false, material_line_statuses: "BLOCKED", bom_sources: "RM_BOM",
    recommended_ui_route: "MATERIAL_RATE_REVIEW", sample_product_name: prod(900103).product_name, sample_sku_id: 900003, snapshot_refreshed_at: TS, latest_rate_date: null, oldest_rate_date: null },
  { period_start: P, refresh_run_id: 900004, valuation_date: VAL, material_area: "PM", stock_item_id: 900002, stock_item_code: "SYN-PM-900002", stock_item_name: SYNTHETIC + " Sample Bottle",
    action_severity: "REVIEW", action_required_summary: SYNTHETIC + " fixture: manual rate in use", action_note_summary: SYNTHETIC + " fixture", issue_codes: "MANUAL_RATE_USED", warning_codes: null,
    affected_sku_count: 1, affected_product_count: 1, affected_line_count: 1, approval_blocking_sku_count: 0, approval_blocking_line_count: 0, review_sku_count: 1, review_line_count: 1,
    has_missing_selected_rate: false, has_missing_rate_source: false, has_optional_lines: false, material_line_statuses: "REVIEW_REQUIRED", bom_sources: "PM_BOM",
    recommended_ui_route: "MATERIAL_REVIEW", sample_product_name: prod(900102).product_name, sample_sku_id: 900002, snapshot_refreshed_at: TS, latest_rate_date: "2026-10-15", oldest_rate_date: "2026-10-15" },
];
export const ACCEPTANCE_ROWS = [
  { acceptance_id: 900001, period_start: P, material_area: "PM", stock_item_id: 900002, stock_item_code: "SYN-PM-900002", stock_item_name: SYNTHETIC + " Sample Bottle",
    acceptance_status: "ACTIVE", acceptance_register_status: "ACTIVE_MATCHED", acceptance_scope: "PERIOD", acceptance_reason: SYNTHETIC + " fixture reason", acceptance_note: SYNTHETIC + " fixture note",
    accepted_by: by, accepted_by_email: "synthetic-preview@example.invalid", accepted_at: TS, created_at: TS, updated_at: TS, action_severity: "REVIEW", current_queue_action_severity: "REVIEW",
    affected_sku_count: 1, affected_product_count: 1, affected_line_count: 1, review_sku_count: 1, review_line_count: 1, approval_blocking_sku_count: 0, approval_blocking_line_count: 0,
    current_queue_row_exists: true, current_queue_affected_sku_count: 1, issue_codes: "MANUAL_RATE_USED", material_line_statuses: "REVIEW_REQUIRED", bom_sources: "PM_BOM" },
];
export const MANUAL_RATE_QUEUE_ROWS = [
  { period_start: P, stock_item_id: 900001, stock_item_code: "SYN-RM-900001", stock_item_name: SYNTHETIC + " Sample Herb Extract", manager_action_code: "ADD_MANUAL_RATE", action_source: "COSTING_QUEUE",
    material_issue_code: "MISSING_MATERIAL_RATE", material_line_status: "BLOCKED", bom_source: "RM_BOM", affected_sku_count: 1, affected_product_count: 1, affected_line_count: 1, priority_sort: 1,
    recommended_action: SYNTHETIC + " fixture: record an approved rate", selected_rate: null, rate_source: null, rate_date: null, latest_purchase_rate: null, latest_purchase_date: null,
    manual_rate_id: null, manual_rate_status: null, manual_rate_value: null, newer_purchase_rate_available: false, manual_rate_overrides_purchase_rate: false, snapshot_refreshed_at: TS },
  { period_start: P, stock_item_id: 900002, stock_item_code: "SYN-PM-900002", stock_item_name: SYNTHETIC + " Sample Bottle", manager_action_code: "REVIEW_MANUAL_RATE", action_source: "COSTING_QUEUE",
    material_issue_code: "MANUAL_RATE_USED", material_line_status: "REVIEW_REQUIRED", bom_source: "PM_BOM", affected_sku_count: 1, affected_product_count: 1, affected_line_count: 1, priority_sort: 2,
    recommended_action: SYNTHETIC + " fixture: confirm the manual rate", selected_rate: 50, rate_source: "MANUAL", rate_date: "2026-10-15", latest_purchase_rate: null, latest_purchase_date: null,
    manual_rate_id: 900001, manual_rate_status: "ACTIVE", manual_rate_value: 50, newer_purchase_rate_available: false, manual_rate_overrides_purchase_rate: false, snapshot_refreshed_at: TS },
];

// ---- cost sheet review ----
export const SKU_SELECTOR_ROWS = SKUS.map((s) => ({
  period_start: P, sku_id: s.sku_id, product_id: s.product_id, product_name: prod(s.product_id).product_name, sku_display_name: label(s), pack_size: s.pack_size, pack_uom: s.pack_uom,
  cost_sheet_status: bridge(s), cost_sheet_note: SYNTHETIC + " fixture", mrp_ik: s.mrp_ik, mrp_ok: s.mrp_ok,
  ik_selling_price: s.outcome === "BLOCKED" ? null : s.mrp_ik, ok_selling_price: s.outcome === "BLOCKED" ? null : s.mrp_ok,
  internal_loaded_cost_per_sku: s.outcome === "BLOCKED" ? null : s.cost + 30, pricing_cost_per_sku: s.outcome === "BLOCKED" ? null : s.cost + 30, refreshed_at: TS,
}));
export const DETAILED_COST_SHEET_ROWS = SKUS.map((s) => ({
  period_start: P, refresh_run_id: 900004, valuation_date: VAL, sku_id: s.sku_id, product_id: s.product_id, product_name: prod(s.product_id).product_name, pack_size: s.pack_size, pack_uom: s.pack_uom,
  cost_sheet_status: bridge(s), cost_sheet_note: SYNTHETIC + " fixture", pricing_bridge_status: bridge(s), selling_price_bridge_status: bridge(s), internal_loaded_cost_status: bridge(s),
  material_cost_per_sku: s.outcome === "BLOCKED" ? null : s.cost, direct_labour_cost_per_sku: s.outcome === "BLOCKED" ? null : 10, prime_cost_per_sku: s.outcome === "BLOCKED" ? null : s.cost + 10,
  manufacturing_cop_per_sku: s.outcome === "BLOCKED" ? null : s.cost + 20, internal_loaded_cost_per_sku: s.outcome === "BLOCKED" ? null : s.cost + 30, pricing_cost_per_sku: s.outcome === "BLOCKED" ? null : s.cost + 30,
  mrp_ik: s.mrp_ik, mrp_ok: s.mrp_ok, gst_percent: 5, contingency_percent: 2,
  ik_selling_price: s.outcome === "BLOCKED" ? null : s.mrp_ik, ok_selling_price: s.outcome === "BLOCKED" ? null : s.mrp_ok, refreshed_at: TS,
}));
export const PRINTABLE_SUMMARY_ROWS = PRODUCTS.map((p) => {
  const mine = SKUS.filter((s) => s.product_id === p.product_id);
  return { period_start: P, refresh_run_id: 900004, valuation_date: VAL, product_id: p.product_id, product_name: p.product_name, category_name: p.category_name, subcategory_name: p.subcategory_name,
    group_name: p.group_name, sub_group_name: p.sub_group_name, product_hierarchy: [p.category_name, p.group_name].join(" > "), sku_count: mine.length,
    sku_column_labels: mine.map(label).join(" | "), line_count: 20, ready_line_count: mine[0].outcome === "READY" ? 20 : mine[0].outcome === "BLOCKED" ? 12 : 18,
    review_required_line_count: mine[0].outcome === "REVIEW_REQUIRED" ? 2 : 0, blocked_line_count: mine[0].outcome === "BLOCKED" ? 8 : 0,
    cost_sheet_status: bridge(mine[0]), cost_sheet_note: SYNTHETIC + " fixture", refreshed_at: TS, snapshot_refreshed_at: TS };
});
// Defined by migration 20261019014458_w1_approved_run_feed_and_labels.sql (public wrapper column list).
const compare = (s) => {
  const blocked = s.outcome === "BLOCKED";
  const cop = blocked ? null : s.cost + 20, loaded = blocked ? null : s.cost + 30;
  return { snapshot_period_start: P, product_id: s.product_id, product_name: prod(s.product_id).product_name, category_name: prod(s.product_id).category_name,
    subcategory_name: prod(s.product_id).subcategory_name, group_name: prod(s.product_id).group_name, sub_group_name: prod(s.product_id).sub_group_name,
    sku_id: s.sku_id, sku_column_label: label(s), rm_cost: blocked ? null : s.cost - 20, pm_cost: blocked ? null : 20, total_material_cost: blocked ? null : s.cost,
    direct_labour_cost: blocked ? null : 10, manufacturing_cop: cop, internal_loaded_cost: loaded, mrp_ik: s.mrp_ik, mrp_ok: s.mrp_ok,
    selling_price_ik: blocked ? null : s.mrp_ik, selling_price_ok: blocked ? null : s.mrp_ok, cost_sheet_status: bridge(s), cost_sheet_note: SYNTHETIC + " fixture", snapshot_refreshed_at: TS,
    previous_month_period_start: PRIOR, previous_month_manufacturing_cop: blocked ? null : cop - 5, previous_month_internal_loaded_cost: blocked ? null : loaded - 5,
    manufacturing_cop_mom_change: blocked ? null : 5, internal_loaded_cost_mom_change: blocked ? null : 5,
    manufacturing_cop_mom_change_percent: blocked ? null : Math.round((5 / (cop - 5)) * 10000) / 100, internal_loaded_cost_mom_change_percent: blocked ? null : Math.round((5 / (loaded - 5)) * 10000) / 100,
    profit_value_ik: blocked ? null : s.mrp_ik - loaded, profit_value_ok: blocked ? null : s.mrp_ok - loaded,
    previous_month_selling_price_ik: blocked ? null : s.mrp_ik, previous_month_selling_price_ok: blocked ? null : s.mrp_ok,
    previous_month_profit_value_ik: blocked ? null : s.mrp_ik - loaded + 5, previous_month_profit_value_ok: blocked ? null : s.mrp_ok - loaded + 5, profit_value_ik_mom_change: blocked ? null : -5, profit_value_ok_mom_change: blocked ? null : -5,
    snapshot_refresh_run_id: 900004, snapshot_selection_basis: "LATEST_DRAFT", snapshot_run_label: SYNTHETIC + " DRAFT run 900004 - not approved",
    previous_month_refresh_run_id: 900001, previous_month_selection_basis: "APPROVED" };
};
export const COMPARISON_ROWS = SKUS.map(compare);
export const SCHEME_COMPARISON_ROWS = SKUS.map((s) => ({
  period_start: P, refresh_run_id: 900004, valuation_date: VAL, sku_id: s.sku_id, product_id: s.product_id, product_name: prod(s.product_id).product_name, sku_display_name: label(s),
  pack_size: s.pack_size, pack_uom: s.pack_uom, scheme_id: 900001, scheme_name: SYNTHETIC + " Buy 10 Get 1", paid_qty: 10, free_qty: 1, total_qty: 11,
  scheme_context_source: "DIRECT_POLICY", scheme_is_system_defined: false, scheme_viability_status: s.outcome === "READY" ? "READY" : s.outcome === "BLOCKED" ? "BLOCKED" : "REVIEW_REQUIRED",
  scheme_viability_note: SYNTHETIC + " fixture", ik_selling_price: s.outcome === "BLOCKED" ? null : s.mrp_ik, ok_selling_price: s.outcome === "BLOCKED" ? null : s.mrp_ok,
  internal_loaded_cost_per_sku: s.outcome === "BLOCKED" ? null : s.cost + 30, ik_scheme_margin_band: null, ok_scheme_margin_band: null, // no synthetic net-realisation/margin proof: never claim HEALTHY
  refreshed_at: TS,
}));

// ---- pricing policy workspaces ----
export const SKU_MRP_CURRENT_ROWS = SKUS.map((s, i) => ({ policy_id: 900001 + i, sku_id: s.sku_id, product_id: s.product_id, product_name: prod(s.product_id).product_name,
  pack_size: s.pack_size, pack_uom: s.pack_uom, mrp_ik: s.mrp_ik, mrp_ok: s.mrp_ok, ok_pct: 10, calc_mode: "MANUAL", effective_from: "2026-04-01", effective_to: null,
  source_type: "MANUAL", source_quality: "CONFIRMED", reason: SYNTHETIC + " fixture", approval_reference: "SYNTHETIC-REF-" + (900001 + i), created_at: TS, created_by: by, sku_is_active: true, previous_policy_id: null }));
export const SKU_OVERVIEW_ROWS = SKUS.map((s) => ({ sku_id: s.sku_id, product_id: s.product_id, product_name: prod(s.product_id).product_name, sku_display_name: label(s), sku_column_label: label(s),
  pack_size: s.pack_size, pack_uom: s.pack_uom, mrp_ik: s.mrp_ik, mrp_ok: s.mrp_ok, gst_percent: 5, contingency_percent: 2,
  selling_price_bridge_status: bridge(s), pricing_bridge_status: bridge(s), selling_price_policy_active: s.outcome !== "BLOCKED", selling_price_policy_id: s.outcome !== "BLOCKED" ? 900000 + s.sku_id % 100 : null,
  selling_price_effective_from: "2026-04-01", selling_price_bridge_note: SYNTHETIC + " fixture",
  ik_discount_percent: 10, ok_discount_percent: 5, ik_selected_scheme_id: s.outcome === "READY" ? 900001 : null, ik_selected_scheme_name: s.outcome === "READY" ? SYNTHETIC + " Buy 10 Get 1" : null,
  ik_scheme_policy_active: s.outcome === "READY", ik_policy_source: s.outcome === "READY" ? "DIRECT_SKU" : "NONE", ik_policy_source_label: s.outcome === "READY" ? SYNTHETIC + " SKU rule" : SYNTHETIC + " no scheme",
  ok_selected_scheme_id: null, ok_selected_scheme_name: null, ok_scheme_policy_active: false, ok_policy_source: "NONE", ok_policy_source_label: SYNTHETIC + " no scheme", refreshed_at: TS }));
export const DERIVATION_CURRENT_ROWS = [{ derivation_policy_id: 900001, product_id: 900101, product_name: prod(900101).product_name, product_status: "ACTIVE", product_base_uom: "mL",
  status: "ACTIVE", effective_from: "2026-04-01", effective_to: null, reference_sku_id: 900001, reference_pack_size: 200, reference_pack_uom: "mL", reference_mrp_ik: 200, reference_mrp_ok: 220,
  reference_ok_pct: 10, smaller_pack_adjustment_pct: 5, larger_pack_adjustment_pct: -5, ceiling_increment: 1, reference_selection_source: "MANUAL", source_type: "MANUAL", source_quality: "CONFIRMED",
  reason: SYNTHETIC + " fixture", approval_reference: "SYNTHETIC-REF-900001", created_at: TS, created_by: by, confirmed_at: TS, confirmed_by: by }];
export const REFERENCE_READINESS_ROWS = PRODUCTS.map((p, i) => ({ product_id: p.product_id, product_name: p.product_name, product_status: "ACTIVE", product_base_uom: ["mL", "g", "nos"][i],
  readiness_status: i === 0 ? "READY" : "BLOCKED", blocker_code: i === 0 ? null : "NO_REFERENCE_PACK", derivation_policy_status: i === 0 ? "ACTIVE" : null, current_derivation_policy_id: i === 0 ? 900001 : null,
  active_non_sample_sku_count: 1, priced_active_non_sample_sku_count: 1, reference_selection_source: "MANUAL", source_type: "MANUAL", source_quality: "CONFIRMED",
  current_reference_sku_id: SKUS[i].sku_id, current_reference_pack_size: SKUS[i].pack_size, current_reference_pack_uom: SKUS[i].pack_uom, current_reference_mrp_ik: SKUS[i].mrp_ik, current_reference_mrp_ok: SKUS[i].mrp_ok }));
const proposal = (id, status, n) => ({ proposal_id: id, proposal_number: "SYN-PROP-" + id, status, product_id: 900101, product_name: prod(900101).product_name, product_status: "ACTIVE", product_base_uom: "mL",
  proposed_effective_from: "2026-12-01", derivation_policy_id: 900001, reference_sku_id: 900001, reference_pack_size: 200, reference_pack_uom: "mL", reference_mrp_ik: 200, reference_mrp_ok: 220,
  total_line_count: n, eligible_line_count: n, pending_line_count: status === "SUBMITTED" ? n : 0, approved_line_count: status === "APPROVED" || status === "APPLIED" ? n : 0, rejected_line_count: 0,
  blocked_line_count: 0, warning_line_count: 0, changed_mrp_line_count: n, no_change_line_count: 0, manually_adjusted_line_count: 0, review_summary_status: status,
  created_at: TS, created_by: by, submitted_at: status === "DRAFT" ? null : TS, submitted_by: status === "DRAFT" ? null : by, approved_at: status === "APPROVED" || status === "APPLIED" ? TS : null,
  approved_by: status === "APPROVED" || status === "APPLIED" ? by : null, applied_at: status === "APPLIED" ? TS : null, applied_by: status === "APPLIED" ? by : null,
  reason: SYNTHETIC + " fixture", approval_reference: null });
export const PROPOSAL_REGISTER_ROWS = [proposal(900001, "DRAFT", 1), proposal(900002, "SUBMITTED", 1), proposal(900003, "APPROVED", 1), proposal(900004, "APPLIED", 1)];
export const SCHEME_MASTER_ROWS = [
  { scheme_id: 900001, scheme_name: SYNTHETIC + " Buy 10 Get 1", paid_qty: 10, free_qty: 1, total_qty: 11, free_per_paid_ratio: 0.1, is_active: true, is_system_defined: false, remarks: SYNTHETIC + " fixture",
    can_edit_metadata: false, can_deactivate: false, can_reactivate: false, direct_policy_count: 1, active_direct_policy_count: 1, hierarchy_rule_count: 1, active_hierarchy_rule_count: 1,
    replacement_reference_count: 0, active_replacement_reference_count: 0, viability_snapshot_count: 3, viability_snapshot_period_count: 1, latest_viability_snapshot_period: P, created_at: TS, created_by: by, updated_at: TS, updated_by: by },
  { scheme_id: 900002, scheme_name: SYNTHETIC + " Buy 20 Get 3 (inactive)", paid_qty: 20, free_qty: 3, total_qty: 23, free_per_paid_ratio: 0.15, is_active: false, is_system_defined: false, remarks: SYNTHETIC + " fixture",
    can_edit_metadata: false, can_deactivate: false, can_reactivate: false, direct_policy_count: 0, active_direct_policy_count: 0, hierarchy_rule_count: 0, active_hierarchy_rule_count: 0,
    replacement_reference_count: 0, active_replacement_reference_count: 0, viability_snapshot_count: 0, viability_snapshot_period_count: 0, created_at: TS, created_by: by, updated_at: TS, updated_by: by,
    deactivated_at: TS, deactivated_by: by, deactivation_reason: SYNTHETIC + " fixture" },
];
export const SCHEME_RULE_ROWS = [
  { policy_rule_id: 900001, policy_scope: "SKU", scope_id: 900001, scope_name: label(SKUS[0]), sku_id: 900001, product_id: 900101, product_name: prod(900101).product_name, pack_size: 200, pack_uom: "mL",
    region_code: "IK", scheme_id: 900001, scheme_name: SYNTHETIC + " Buy 10 Get 1", paid_qty: 10, free_qty: 1, apply_mode: "ADD_IF_MISSING", is_active: true, rule_status: "ACTIVE",
    effective_from: "2026-04-01", effective_to: null, remarks: SYNTHETIC + " fixture", created_at: TS, created_by: by },
  { policy_rule_id: 900002, policy_scope: "PRODUCT_GROUP", scope_id: 900001, scope_name: SYNTHETIC + " Group B", product_group_id: 900001, group_name: SYNTHETIC + " Group B", region_code: "OK",
    scheme_id: 900001, scheme_name: SYNTHETIC + " Buy 10 Get 1", paid_qty: 10, free_qty: 1, apply_mode: "ADD_IF_MISSING", is_active: false, rule_status: "CLOSED",
    effective_from: "2026-01-01", effective_to: "2026-03-31", remarks: SYNTHETIC + " fixture", created_at: TS, created_by: by },
];
export const COMMERCIAL_BASIS_ROWS = SKUS.map((s) => ({ period_start: P, sku_id: s.sku_id, product_id: s.product_id, product_name: prod(s.product_id).product_name, pack_size: s.pack_size, pack_uom: s.pack_uom,
  commercial_sales_basis: s.outcome === "READY" ? "ACTUAL_SALES" : "MANUAL_ASSUMPTION", commercial_sales_status: s.outcome === "BLOCKED" ? "REVIEW_REQUIRED" : "READY",
  commercial_sales_warning: s.outcome === "BLOCKED" ? SYNTHETIC + " fixture: no usable basis" : null, commercial_sales_units: s.outcome === "BLOCKED" ? null : 1000, commercial_sales_value: null,
  actual_sales_units_12m: s.outcome === "READY" ? 1000 : null, assumption_source: s.outcome === "READY" ? null : "MANUAL", manual_assumption_status: s.outcome === "READY" ? null : "ACTIVE",
  manual_assumed_sales_units: s.outcome === "READY" ? null : 1000, allocation_basis_status: s.outcome === "BLOCKED" ? "REVIEW_REQUIRED" : "READY", management_valuation_date: VAL }));

// ---- cost build ----
export const UNCLASSIFIED_STAFF_ROWS = [
  { staff_id: 900001, employee_code: "SYN-E900001", staff_display_name: SYNTHETIC + " Staff Member A", designation: SYNTHETIC + " Operator", staff_is_active: true, classification_status: "UNCLASSIFIED",
    costing_class: null, costing_class_label: null, allocation_pool: null, classification_is_active: null, total_salary_cost: null },
  { staff_id: 900002, employee_code: "SYN-E900002", staff_display_name: SYNTHETIC + " Staff Member B", designation: SYNTHETIC + " Supervisor", staff_is_active: true, classification_status: "UNCLASSIFIED",
    costing_class: null, costing_class_label: null, allocation_pool: null, classification_is_active: null, total_salary_cost: null },
];
export const PROVISION_POOL_OPTIONS = [
  { allocation_pool: "PRODUCTION_OVERHEAD", allocation_pool_label: "Production Overhead", sort_order: 1 },
  { allocation_pool: "QUALITY_CONTROL", allocation_pool_label: "Quality Control", sort_order: 2 },
];
export const PROVISION_TYPE_OPTIONS = [
  { provision_type: "MANUAL_PROVISION", provision_type_label: "Manual provision", provision_type_note: SYNTHETIC + " fixture", sort_order: 1 },
];

// ---- RPC fixtures (shapes proven by types/supabase.ts Returns) ----
export const VALUATION_CONTEXT = (period) => [{
  period_start: period, period_end: period === P ? "2026-11-30" : "2026-10-31", period_status: "OPEN", valuation_date: period === P ? VAL : "2026-10-31",
  valuation_date_status: period === P ? "DRAFT" : "APPROVED", valuation_date_source: "SYSTEM_DEFAULT", valuation_date_set_by: by, valuation_date_set_at: TS,
  valuation_date_change_reason: null, valuation_date_approval_reference: null, queued_or_running_refresh_count: 0, locked_at: null, lock_reason: null, closed_at: null, close_reason: null,
  remarks: SYNTHETIC + " fixture" }];
export const SALES_ALLOCATION_POLICIES = [{ policy_id: 900001, scenario_code: "BASE", default_sales_units: 1000, effective_from: "2026-04-01", effective_to: null, status: "ACTIVE",
  reason: SYNTHETIC + " fixture", approval_reference: null, created_at: TS, created_by: by, previous_policy_id: null }];

// ---- readiness (envelope shapes proven by scripts/wp04-readiness-client-contract-smoke.mjs validPortfolioPayload) ----
export const READINESS_PERIODS = { observed_at: TS, rows: [{ period_start: P, valuation_date: VAL }, { period_start: PRIOR, valuation_date: "2026-10-31" }],
  limit: 24, returned_count: 2, has_more: false, next_before_period_start: null };
const assessment = (s) => ({
  context: { context_type: "LIVE_AS_OF", sku_id: s.sku_id, product_id: s.product_id, period_start: P, valuation_date: VAL, refresh_run_id: null, context_integrity_status: "LIVE_GOVERNED_PERIOD" },
  lifecycle: { product_status: "Active", sku_is_active: true, sku_is_sample: false },
  identity: { product_name: prod(s.product_id).product_name, pack_size: s.pack_size, pack_uom: s.pack_uom },
  summary: { product_master_foundation_status: "RESOLVED", sku_master_foundation_status: "RESOLVED",
    costing_foundation_status: s.outcome === "BLOCKED" ? "UNRESOLVED" : "RESOLVED", evidence_quality_status: s.outcome === "READY" ? "RESOLVED" : "UNKNOWN",
    costing_outcome_status: s.outcome === "READY" ? "RESOLVED" : "UNKNOWN", overall_severity: s.outcome === "READY" ? "READY" : s.outcome === "BLOCKED" ? "BLOCKER" : "REVIEW_REQUIRED" },
  dependencies: [], shared_issues: [], downstream_control: null,
});
export const READINESS_PORTFOLIO = (args = {}) => ({
  context: { context_type: "LIVE_AS_OF", requested_period_start: args.p_period_start ?? P, period_start: args.p_period_start ?? P, valuation_date: VAL, refresh_run_id: null,
    evidence_refresh_run_id: 900004, context_integrity_status: "LIVE_GOVERNED_PERIOD" },
  observed_at: TS, population_scope: args.p_population_scope ?? "OPERATIONAL",
  filters: { overall_severities: null, dependency_codes: null, owner_modules: null, route_codes: null, search: args.p_search ?? null },
  filter_options: { overall_severities: ["READY", "REVIEW_REQUIRED", "BLOCKER", "UNKNOWN"], dependency_codes: [], owner_modules: [], route_codes: [] },
  after_sku_id: args.p_after_sku_id ?? null, limit: args.p_limit ?? 50,
  statistics: { population_sku_count: 3, overall_severity_counts: { READY: 1, REVIEW_REQUIRED: 1, BLOCKER: 1, UNKNOWN: 0 },
    unresolved_dependency_counts: [], unresolved_owner_counts: [], unresolved_route_counts: [], unresolved_shared_issue_counts: [], regional_marketing_counts: [] },
  matched_count: 3, returned_count: 3, rows: SKUS.map(assessment), has_more: false, next_after_sku_id: null,
});
export const READINESS_GAPS = (args = {}) => ({ assessment_kind: "PRODUCT_MEMBERSHIP_GAPS", observed_at: TS, product_scope: args.p_product_scope ?? "ACTIVE_PRODUCTS",
  gap_kind: args.p_gap_kind ?? "NO_SKU", rows: [], statistics: { product_count: 3, no_sku_count: 0, active_without_active_sku_count: 0 }, limit: 25, matched_count: 0,
  returned_count: 0, has_more: false, next_after_product_id: null });

// ---- QC / Materials-Stores action queues: [{ row_data, total_count }] (types) with row fields read by the controllers ----
const queueEnvelope = (rows) => rows.map((row) => ({ row_data: row, total_count: rows.length }));
export const QC_QUEUE = queueEnvelope([
  { period_start: P, refresh_run_id: 900004, valuation_date: VAL, product_id: 900103, product_name: prod(900103).product_name, action_code: "BLOCKED_MISSING_FG_PROTOCOL_MAPPING",
    action_severity: "BLOCKER", recommended_action: SYNTHETIC + " fixture: map an FG protocol", action_note: SYNTHETIC + " fixture", allocation_status: "BLOCKED", snapshot_refreshed_at: TS },
  { period_start: P, refresh_run_id: 900004, valuation_date: VAL, product_id: 900102, product_name: prod(900102).product_name, action_code: "REVIEW_REQUIRED_QC_ABSORPTION_BASIS",
    action_severity: "REVIEW", recommended_action: SYNTHETIC + " fixture: review absorption basis", action_note: SYNTHETIC + " fixture", allocation_status: "REVIEW_REQUIRED", snapshot_refreshed_at: TS },
]);
export const MATERIALS_STORES_QUEUE = queueEnvelope([
  { period_start: P, refresh_run_id: 900004, valuation_date: VAL, sku_id: 900003, product_id: 900103, product_name: prod(900103).product_name, pack_size: 60, pack_uom: "nos",
    action_code: "BLOCKED_NO_RM_OR_PM_STANDARD_EVIDENCE", action_severity: "BLOCKER", recommended_action: SYNTHETIC + " fixture: add standard evidence", action_note: SYNTHETIC + " fixture",
    allocation_status: "BLOCKED", recommended_ui_route: "MATERIAL_RATE_REVIEW" },
  { period_start: P, refresh_run_id: 900004, valuation_date: VAL, sku_id: 900002, product_id: 900102, product_name: prod(900102).product_name, pack_size: 100, pack_uom: "g",
    action_code: "REVIEW_MONTHLY_ALLOCATION_BASIS", action_severity: "REVIEW", recommended_action: SYNTHETIC + " fixture: review allocation basis", action_note: SYNTHETIC + " fixture",
    allocation_status: "REVIEW_REQUIRED", recommended_ui_route: "COST_BUILD_REVIEW" },
]);

// ---- cost build ----
export const DRIVER_REGISTRY = [
  ["DIRECT_LABOUR", "Direct Labour", "REVIEW_REQUIRED"], ["PRODUCTION_OVERHEAD", "Production Overhead", "APPROVED"], ["QUALITY_CONTROL_OVERHEAD", "Quality Control Overhead", null],
  ["MATERIALS_STORES_OVERHEAD", "Materials / Stores Overhead", null], ["ADMIN_OVERHEAD", "Administrative Overhead", "REVIEW_REQUIRED"],
  ["FINANCE_ADMIN_OVERHEAD", "Finance/Admin Overhead", "REVIEW_REQUIRED"], ["MARKETING_EXPENSE", "Marketing Expense", null],
].map(([code, name, life], i) => ({ cost_element_code: code, cost_element_label: name, sort_order: i + 1, lifecycle_status: life, is_registered: life !== null }));
export const PROVISION_REGISTER_ROWS = [
  { provision_id: 900001, provision_key: "SYN-PROV-900001", provision_label: SYNTHETIC + " Sample provision", provision_type: "MANUAL_PROVISION", provision_type_label: "Manual provision",
    allocation_pool: "PRODUCTION_OVERHEAD", allocation_pool_label: "Production Overhead", period_start: P, provision_amount: 1000, provision_status: "ACTIVE", is_active: true,
    provision_note: SYNTHETIC + " fixture", remarks: SYNTHETIC + " fixture", source_reference: "SYNTHETIC-REF", created_at: TS, updated_at: TS },
];
export const POOL_SUMMARY_ROWS = [
  { period_start: P, allocation_pool: "PRODUCTION_OVERHEAD", allocation_pool_label: "Production Overhead", pool_status: "READY", pool_source_type: "MIXED",
    staff_pool_amount: 2000, expense_provision_amount: 500, manual_provision_amount: 1000, total_pool_amount: 3500 },
  { period_start: P, allocation_pool: "QUALITY_CONTROL", allocation_pool_label: "Quality Control", pool_status: "REVIEW_REQUIRED", pool_source_type: "STAFF",
    staff_pool_amount: 800, expense_provision_amount: 0, manual_provision_amount: 0, total_pool_amount: 800 },
];
export const REGIONAL_SALES_POLICIES = ["IK", "OK"].map((region, i) => ({ policy_id: 900101 + i, region_code: region, scenario_code: "BASE", default_sales_units: 500, effective_from: "2026-04-01",
  effective_to: null, status: "ACTIVE", reason: SYNTHETIC + " fixture", approval_reference: null, created_at: TS, created_by: by, previous_policy_id: null }));

// ---- production route manager (envelopes proven by costing-suite-production-route-helpers.js normalisers) ----
const FAMILIES = [{ route_family_id: 900001, route_family_code: "SYN-FAM-A", route_family_name: SYNTHETIC + " Route Family A", status: "APPROVED", is_active: true },
  { route_family_id: 900002, route_family_code: "SYN-FAM-B", route_family_name: SYNTHETIC + " Route Family B", status: "APPROVED", is_active: true }];
const GROUPS = [{ product_group_id: 900001, product_group_name: SYNTHETIC + " Group A", group_name: SYNTHETIC + " Group A" }, { product_group_id: 900002, product_group_name: SYNTHETIC + " Group B", group_name: SYNTHETIC + " Group B" }];
const SUBGROUPS = [{ product_subgroup_id: 900001, product_subgroup_name: SYNTHETIC + " Subgroup A1", product_group_id: 900001 }, { product_subgroup_id: 900002, product_subgroup_name: SYNTHETIC + " Subgroup B1", product_group_id: 900002 },
  { product_subgroup_id: 900003, product_subgroup_name: SYNTHETIC + " Subgroup B2", product_group_id: 900002 }];
export const PRM_COST_CENTRES = Array.from({ length: 3 }, (_, i) => ({ cost_centre_id: 900001 + i, code: "SYN-CC-" + (i + 1), cost_centre_name: SYNTHETIC + " Cost Centre " + (i + 1), status: "APPROVED",
  pool_scope: "SHARED_ROUTE", default_resource_class_code: "LABOUR", default_resource_class_label: "Labour" }));
export const PRM_MASTER_OPTIONS = { as_of_date: VAL, product_groups: GROUPS, product_subgroups: SUBGROUPS,
  products: PRODUCTS.map((p, i) => ({ product_id: p.product_id, product_name: p.product_name, product_group_id: GROUPS[i === 0 ? 0 : 1].product_group_id, product_subgroup_id: SUBGROUPS[i].product_subgroup_id })),
  route_families: FAMILIES, route_family_mappings: [], route_family_subgroup_mappings: [], approved_route_family_routes: [], batch_size_references: [], behaviours: [], resource_classes: [],
  cost_centres: PRM_COST_CENTRES, activities: [], sections: [], subsections: [], areas: [], plants: [] };
const readinessRow = (p, i) => ({ product_id: p.product_id, product_name: p.product_name, product_group_id: GROUPS[i === 0 ? 0 : 1].product_group_id, product_group_name: GROUPS[i === 0 ? 0 : 1].product_group_name,
  route_family_id: FAMILIES[i === 0 ? 0 : 1].route_family_id, route_family_name: FAMILIES[i === 0 ? 0 : 1].route_family_name, route_family_code: FAMILIES[i === 0 ? 0 : 1].route_family_code,
  readiness_status: ["READY", "REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER", "BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE"][i] });
export const PRM_READINESS = { rows: PRODUCTS.map(readinessRow), total_count: 3,
  status_counts: { READY: 1, REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER: 1, BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE: 1 }, as_of_date: VAL };
export const PRM_ASSIGNMENTS = { rows: [
  { assignment_id: 900001, status: "APPROVED", product_id: 900101, product_name: prod(900101).product_name, product_group_id: 900001, product_group_name: GROUPS[0].product_group_name,
    route_family_id: 900001, route_family_name: FAMILIES[0].route_family_name, route_family_code: FAMILIES[0].route_family_code, assignment_basis: "SYNTHETIC_FIXTURE", effective_from: "2026-04-01", approval_reference: "SYNTHETIC-REF-1" },
  { assignment_id: 900002, status: "DRAFT", product_id: 900102, product_name: prod(900102).product_name, product_group_id: 900002, product_group_name: GROUPS[1].product_group_name,
    route_family_id: 900002, route_family_name: FAMILIES[1].route_family_name, route_family_code: FAMILIES[1].route_family_code, assignment_basis: "SYNTHETIC_FIXTURE", effective_from: "2026-12-01" },
], total_count: 2, status_counts: { APPROVED: 1, DRAFT: 1 } };
export const PRM_SUBGROUP_MAPPINGS = { rows: SUBGROUPS.map((sg, i) => ({ mapping_id: 900001 + i, status: i < 2 ? "APPROVED" : "DRAFT", product_subgroup_id: sg.product_subgroup_id,
  product_subgroup_name: sg.product_subgroup_name, product_group_id: sg.product_group_id, product_group_name: GROUPS.find((g) => g.product_group_id === sg.product_group_id).product_group_name,
  route_family_id: FAMILIES[i === 0 ? 0 : 1].route_family_id, route_family_name: FAMILIES[i === 0 ? 0 : 1].route_family_name, route_family_code: FAMILIES[i === 0 ? 0 : 1].route_family_code,
  mapping_basis: "SYNTHETIC_FIXTURE", effective_from: "2026-04-01", approval_reference: i < 2 ? "SYNTHETIC-REF-" + (i + 1) : null })), total_count: 3, status_counts: { APPROVED: 2, DRAFT: 1 } };
export const PRM_ARCHIVED = { rows: [{ entity_type: "ROUTE_FAMILY", entity_id: 900009, name: SYNTHETIC + " Retired Route Family", code: "SYN-FAM-OLD", original_status: "APPROVED", status: "ARCHIVED",
  effective_from: "2025-04-01", effective_to: "2026-03-31", archived_at: TS, archived_by: by, archive_reason: SYNTHETIC + " fixture" }], total_count: 1 };
export const PRM_COST_CENTRE_LIST = { as_of_date: VAL, cost_centres: PRM_COST_CENTRES.map((c, i) => ({ ...c, cost_centre_code: c.code, cost_centre_type: ["EQUIPMENT_CENTRED", "PROCESS_AREA_CENTRED", "SERVICE_CENTRED"][i],
  effective_from: "2026-04-01", effective_to: null, description: SYNTHETIC + " fixture" })) };

// ---- cost governance / staff / manual-rate registers (columns per types/supabase.ts; vocab limited to values the client tests) ----
export const EXPENSE_POOL_OPTIONS = [
  { allocation_pool: "PRODUCTION_OVERHEAD", allocation_pool_label: "Production Overhead", include_in_costing_default: true, pool_note: SYNTHETIC + " fixture", sort_order: 1 },
  { allocation_pool: "QUALITY_CONTROL", allocation_pool_label: "Quality Control", include_in_costing_default: true, pool_note: SYNTHETIC + " fixture", sort_order: 2 },
  { allocation_pool: "MARKETING", allocation_pool_label: "Marketing", include_in_costing_default: true, pool_note: SYNTHETIC + " fixture", sort_order: 3 },
];
export const STAFF_CLASS_OPTIONS = [
  { costing_class: "DIRECT_LABOUR", costing_class_label: "Direct Labour", default_allocation_pool: "PRODUCTION_OVERHEAD", class_note: SYNTHETIC + " fixture", sort_order: 1 },
  { costing_class: "QUALITY_CONTROL", costing_class_label: "Quality Control", default_allocation_pool: "QUALITY_CONTROL", class_note: SYNTHETIC + " fixture", sort_order: 2 },
];
export const UNMAPPED_EXPENSE_HEADS = [1, 2, 3].map((n) => ({ head_name: SYNTHETIC + " Expense Head " + n, expense_group: SYNTHETIC + " Expense Group " + (n % 2 + 1),
  first_seen_date: "2026-09-01", latest_seen_date: P, snapshot_count: n, max_seen_value: 1000 * n, suggested_review_note: SYNTHETIC + " fixture" }));
export const EXPENSE_MAPPING_REGISTER = [1, 2].map((n) => ({ id: 900000 + n, head_name: SYNTHETIC + " Mapped Head " + n, expense_group: SYNTHETIC + " Expense Group " + n,
  allocation_pool: EXPENSE_POOL_OPTIONS[n - 1].allocation_pool, allocation_pool_label: EXPENSE_POOL_OPTIONS[n - 1].allocation_pool_label, include_in_costing: n === 1, is_active: true,
  mapping_status: "ACTIVE", first_seen_date: "2026-04-01", latest_seen_date: P, snapshot_count: 6, max_seen_value: 1000 * n, remarks: SYNTHETIC + " fixture", created_at: TS, updated_at: TS }));
EXPENSE_MAPPING_REGISTER.push({ id: 900003, head_name: SYNTHETIC + " Excluded Head 3", expense_group: SYNTHETIC + " Expense Group 3", allocation_pool: "EXCLUDED", allocation_pool_label: "Excluded",
  include_in_costing: false, is_active: true, mapping_status: "EXCLUDED", first_seen_date: "2026-04-01", latest_seen_date: P, snapshot_count: 2, max_seen_value: 100, remarks: SYNTHETIC + " fixture", created_at: TS, updated_at: TS });
export const STAFF_CLASSIFICATION_REGISTER = [{ classification_id: 900001, staff_id: 900003, employee_code: "SYN-E900003", staff_display_name: SYNTHETIC + " Staff Member C", designation: SYNTHETIC + " Technician",
  staff_is_active: true, costing_class: "DIRECT_LABOUR", costing_class_label: "Direct Labour", allocation_pool: "PRODUCTION_OVERHEAD", classification_status: "ACTIVE", classification_is_active: true,
  effective_from: "2026-04-01", effective_to: null, classification_note: SYNTHETIC + " fixture" }];
export const STAFF_POOL_SUMMARY = [{ period_start: P, allocation_pool: "PRODUCTION_OVERHEAD", costing_class: "DIRECT_LABOUR", costing_class_label: "Direct Labour", staff_count: 1, pool_amount: 2000, pool_status: "READY", staff_details: null }];
const manualRate = (n, item, code) => ({ manual_rate_id: 900000 + n, stock_item_id: 900000 + n, stock_item_code: code, stock_item_name: item, status: "ACTIVE", register_status: "ACTIVE_MATCHED", rate_origin: "MANUAL_ENTRY",
  rate_value: 50 * n, effective_from: "2026-10-01", effective_to: null, reason: SYNTHETIC + " fixture reason", created_at: TS, created_by: by, last_updated_at: TS, last_updated_by: by,
  manual_rate_overrides_purchase_rate: false, newer_purchase_rate_available: false, review_message: SYNTHETIC + " fixture" });
export const MANUAL_RATE_REGISTER = [manualRate(1, SYNTHETIC + " Sample Bottle", "SYN-PM-900002"), manualRate(2, SYNTHETIC + " Sample Excipient", "SYN-RM-900002")];
export const MANUAL_RATE_HISTORY = MANUAL_RATE_REGISTER.map(({ manual_rate_id, stock_item_id, stock_item_code, stock_item_name, status, rate_origin, rate_value, effective_from, effective_to, reason, created_at, created_by, last_updated_at, last_updated_by }) =>
  ({ manual_rate_id, stock_item_id, stock_item_code, stock_item_name, status, rate_origin, rate_value, effective_from, effective_to, reason, created_at, created_by, last_updated_at, last_updated_by }));
export const MANUAL_RATE_REVIEW = MANUAL_RATE_REGISTER.map((r) => ({ manual_rate_id: r.manual_rate_id, stock_item_id: r.stock_item_id, stock_item_code: r.stock_item_code, stock_item_name: r.stock_item_name,
  manual_rate_status: r.status, manual_rate_value: r.rate_value, manual_rate_effective_from: r.effective_from, manual_rate_effective_to: null, manual_rate_reason: r.reason,
  manual_rate_overrides_purchase_rate: false, newer_purchase_rate_available: false, review_message: r.review_message, manual_rate_created_at: TS, manual_rate_last_updated_at: TS }));


// Selected-SKU diagnosis drawer (shell fetch of v_costing_pricing_sku_status_diagnosis; columns per types/supabase.ts).
export const SKU_DIAGNOSIS_ROWS = SKUS.map((s) => ({ period_start: P, sku_id: s.sku_id, product_id: s.product_id, product_name: prod(s.product_id).product_name, sku_display_name: label(s),
  pack_size: s.pack_size, pack_uom: s.pack_uom, mrp_ik: s.mrp_ik, mrp_ok: s.mrp_ok, material_costing_status: s.mat, rm_costing_status: s.mat, pm_costing_status: s.outcome === "BLOCKED" ? "BLOCKED" : "READY",
  internal_loaded_cost_status: bridge(s), pricing_bridge_status: bridge(s), final_action_status: bridge(s), primary_diagnostic_code: s.control, primary_diagnostic_layer: "MATERIAL",
  primary_diagnostic_note: SYNTHETIC + " fixture: " + s.control.toLowerCase().replace(/_/g, " "), material_costing_note: SYNTHETIC + " fixture", recommended_action: s.outcome === "READY" ? null : SYNTHETIC + " fixture action",
  rm_blocking_line_count: s.outcome === "BLOCKED" ? 1 : 0, pm_blocking_line_count: 0, scheme_row_count: 1,
  internal_loaded_cost_per_sku: s.outcome === "BLOCKED" ? null : s.cost + 30, manufacturing_cop_per_sku: s.outcome === "BLOCKED" ? null : s.cost + 20 }));

// ---- table/view name -> rows served by the synthetic client (exact match only) ----
export const TABLE_FIXTURES = Object.freeze({
  v_costing_pricing_sku_control_status_snapshot: SKU_STATUS_ROWS,
  v_costing_pricing_sku_status_diagnosis: SKU_DIAGNOSIS_ROWS,
  v_costing_pricing_period_run_status: RUN_ROWS,
  v_costing_pricing_run_display_status: RUN_DISPLAY_ROWS,
  v_costing_pricing_control_dashboard_snapshot: DASHBOARD_ROWS,
  v_costing_pricing_business_kpi_summary: KPI_ROWS,
  v_costing_pricing_control_integrity_audit_snapshot: INTEGRITY_ROWS,
  v_costing_pricing_material_action_queue_snapshot: MATERIAL_ACTION_ROWS,
  v_costing_material_review_acceptance_register: ACCEPTANCE_ROWS,
  v_costing_manual_rate_manager_action_queue: MANUAL_RATE_QUEUE_ROWS,
  v_costing_pricing_sku_selector: SKU_SELECTOR_ROWS,
  v_costing_pricing_sku_detailed_cost_sheet: DETAILED_COST_SHEET_ROWS,
  v_costing_pricing_printable_cost_sheet_product_summary: PRINTABLE_SUMMARY_ROWS,
  v_cost_sheet_snapshot_sku_monthly_comparison_governed: COMPARISON_ROWS,
  v_costing_pricing_sku_scheme_comparison: SCHEME_COMPARISON_ROWS,
  v_sku_mrp_current: SKU_MRP_CURRENT_ROWS,
  v_costing_policy_manager_sku_overview: SKU_OVERVIEW_ROWS,
  v_product_mrp_derivation_current: DERIVATION_CURRENT_ROWS,
  v_product_mrp_reference_readiness: REFERENCE_READINESS_ROWS,
  v_product_mrp_proposal_register: PROPOSAL_REGISTER_ROWS,
  v_costing_scheme_master_register: SCHEME_MASTER_ROWS,
  v_costing_scheme_policy_rule_register: SCHEME_RULE_ROWS,
  v_costing_pricing_commercial_sales_basis: COMMERCIAL_BASIS_ROWS,
  v_costing_unclassified_staff_for_costing: UNCLASSIFIED_STAFF_ROWS,
  v_costing_manual_provision_pool_options: PROVISION_POOL_OPTIONS,
  v_costing_manual_provision_type_options: PROVISION_TYPE_OPTIONS,
  v_costing_manual_cost_pool_provision_register: PROVISION_REGISTER_ROWS,
  v_costing_cost_pool_monthly_summary: POOL_SUMMARY_ROWS,
  v_costing_policy_manager_scheme_options: SCHEME_MASTER_ROWS.filter((r) => r.is_active).map(({ scheme_id, scheme_name, paid_qty, free_qty, is_active, remarks }) => ({ scheme_id, scheme_name, paid_qty, free_qty, is_active, remarks })),
  v_costing_scheme_policy_scope_options: SKU_STATUS_ROWS.map((r) => ({ policy_scope: "SKU", scope_id: r.sku_id, scope_key: "SKU:" + r.sku_id, scope_name: r.product_name,
    display_name: r.product_name + " " + r.pack_size + r.pack_uom, sku_id: r.sku_id, product_id: r.product_id, product_name: r.product_name })),
  v_costing_expense_allocation_pool_options: EXPENSE_POOL_OPTIONS,
  v_costing_staff_costing_class_options: STAFF_CLASS_OPTIONS,
  v_costing_unmapped_expense_heads_for_mapping: UNMAPPED_EXPENSE_HEADS,
  v_costing_expense_head_mapping_register: EXPENSE_MAPPING_REGISTER,
  v_costing_staff_classification_register: STAFF_CLASSIFICATION_REGISTER,
  v_costing_staff_cost_pool_summary: STAFF_POOL_SUMMARY,
  v_costing_material_manual_rate_register: MANUAL_RATE_REGISTER,
  v_costing_material_manual_rate_history: MANUAL_RATE_HISTORY,
  v_costing_material_manual_rate_review: MANUAL_RATE_REVIEW,
});
