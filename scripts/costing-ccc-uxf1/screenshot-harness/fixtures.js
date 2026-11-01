// Fixture rows shaped like the server views (counts mirror the owner's preflight; not live data).
window.__UXF1_FIXTURES = (() => {
  const OCT = "2026-10-01";
  const mk = (runId, mix) => {
    const rows = []; let sku = 1;
    for (const [n, c] of mix) for (let i = 0; i < n; i += 1) {
      rows.push({ period_start: OCT, snapshot_refreshed_at: "2026-11-01T02:30:00+05:30", sku_id: sku, product_id: 7000 + (sku % 300),
        product_name: `Product ${String(sku % 300).padStart(3, "0")}`, pack_size: 100, pack_uom: "ml",
        material_costing_status: c.control_severity === "BLOCKER" ? "BLOCKED" : "READY", rm_blocking_line_count: 0,
        pm_blocking_line_count: c.pm_blocking_line_count || 0, selling_price_bridge_status: "READY", pricing_bridge_status: "READY",
        valuation_date: "2026-10-31", refresh_run_id: runId, mrp_ik: 120 + (sku % 50), mrp_ok: 130 + (sku % 50), ...c });
      sku += 1;
    }
    return rows;
  };
  const READY = { control_severity: "READY", first_control_status: "READY", recommended_ui_route: null, control_note: null };
  const run143 = mk(143, [[627, READY]]);
  const run148 = mk(148, [
    [1, { control_severity: "BLOCKER", first_control_status: "MATERIAL_COST_BLOCKED", recommended_ui_route: "MATERIAL_RATE_MANAGER", control_note: "No effective rate for I000019D.", pm_blocking_line_count: 1 }],
    [110, { control_severity: "REVIEW_REQUIRED", first_control_status: "PRIME_COST_REVIEW_REQUIRED", recommended_ui_route: "COST_REVIEW_WORKBENCH", control_note: "Prime cost needs review: quantity basis." }],
    [2, { control_severity: "REVIEW_REQUIRED", first_control_status: "MATERIAL_REVIEW_REQUIRED", recommended_ui_route: "MATERIAL_RATE_REVIEW", control_note: "Material rate needs review." }],
    [1, { control_severity: "REVIEW_REQUIRED", first_control_status: "PRICING_BRIDGE_REVIEW_REQUIRED", recommended_ui_route: "COST_REVIEW_WORKBENCH", control_note: "Regional pricing bridge needs review." }],
    [514, READY],
  ]);
  const summary = { period_start: OCT, valuation_date: "2026-10-31", refresh_run_id: 143, snapshot_refreshed_at: "2026-10-22T10:00:00+05:30",
    total_sku_count: 627, ready_sku_count: 627, review_required_sku_count: 0, blocked_sku_count: 0,
    rm_blocker_item_count: 0, pm_blocker_item_count: 0, rm_review_item_count: 0, pm_review_item_count: 0, overall_control_status: "READY" };
  const business = { period_start: OCT, total_pricing_sku_count: 627, costing_ready_sku_count: 627, selling_policy_complete_count: 627,
    selling_policy_missing_count: 0, scheme_policy_complete_count: 600, scheme_policy_missing_count: 27, scheme_blocked_row_count: 0, scheme_review_row_count: 4 };
  const status = { period_start: OCT, display_state: "APPROVED_NEWER_DRAFT", display_label: "Approved run 143 (newer DRAFT run 148 - not approved)",
    displayed_run_id: 143, approved_run_id: 143, approved_at: "2026-10-22T10:00:00+05:30", approved_by: "owner",
    newer_draft_run_id: 148, active_run_id: null, active_run_status: null };
  return {
    permissions: [{ target: "module:costing-control-center", can_view: true, can_edit: false }],
    views: {
      v_costing_pricing_control_dashboard_snapshot: [summary],
      v_costing_pricing_business_kpi_summary: [business],
      v_costing_pricing_period_run_status: [status],
      v_costing_pricing_sku_control_status_snapshot: run143,
      v_costing_pricing_sku_control_status_by_run: (q) => {
        const run = q.eq.find(([k]) => k === "refresh_run_id")?.[1];
        return String(run) === "148" ? run148 : String(run) === "143" ? run143 : [];
      },
    },
  };
})();
