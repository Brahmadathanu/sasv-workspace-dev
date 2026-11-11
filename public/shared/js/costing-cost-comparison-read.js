// Cost Comparison read path (#273). Pure and dependency-injected so it is testable offline.
//
// Flag OFF (default): EXACTLY the original read -- governed public view, select("*"), snapshot_period_start filter,
//   product_name / sku_column_label order, limit 2000.
// Flag ON (COSTING_CSR_SCOPED_COMPARISON_RPC_V1 = "1", localStorage): the period-scoped read RPC, same 63 columns.
//
// Deliberate non-features: no retry, no automatic fallback to the view on error (a masked fallback would hide a broken
// server and double the query cost), no writer RPC, no change to periods, labels, run selection or column semantics.
// The server function is PREPARED and NOT APPLIED; this code must not be enabled until the owner approves application.

export const COMPARISON_VIEW = "v_cost_sheet_snapshot_sku_monthly_comparison_governed";
export const COMPARISON_SCOPED_RPC = "rpc_get_cost_sheet_sku_monthly_comparison_scoped";
export const COMPARISON_ROW_LIMIT = 2000;
export const COMPARISON_FLAG_NAME = "COSTING_CSR_SCOPED_COMPARISON_RPC_V1";

/** The 63 columns of the public governed view, in order (pinned against the W1 migration by tests). */
export const COMPARISON_COLUMNS = Object.freeze([
  "snapshot_period_start",
  "product_id",
  "product_name",
  "category_name",
  "subcategory_name",
  "group_name",
  "sub_group_name",
  "sku_id",
  "sku_column_label",
  "rm_cost",
  "pm_cost",
  "total_material_cost",
  "direct_labour_cost",
  "manufacturing_cop",
  "internal_loaded_cost",
  "mrp_ik",
  "mrp_ok",
  "selling_price_ik",
  "selling_price_ok",
  "sales_realisation_ik",
  "sales_realisation_ok",
  "profit_value_ik",
  "profit_value_ok",
  "profit_percent_ik",
  "profit_percent_ok",
  "cop_percent_mrp_ik",
  "cop_percent_mrp_ok",
  "cost_sheet_status",
  "cost_sheet_note",
  "snapshot_refreshed_at",
  "previous_month_period_start",
  "previous_month_manufacturing_cop",
  "previous_month_internal_loaded_cost",
  "previous_month_selling_price_ik",
  "previous_month_selling_price_ok",
  "previous_month_profit_value_ik",
  "previous_month_profit_value_ok",
  "previous_year_period_start",
  "previous_year_manufacturing_cop",
  "previous_year_internal_loaded_cost",
  "previous_year_selling_price_ik",
  "previous_year_selling_price_ok",
  "previous_year_profit_value_ik",
  "previous_year_profit_value_ok",
  "manufacturing_cop_mom_change",
  "manufacturing_cop_mom_change_percent",
  "internal_loaded_cost_mom_change",
  "internal_loaded_cost_mom_change_percent",
  "profit_value_ik_mom_change",
  "profit_value_ok_mom_change",
  "manufacturing_cop_yoy_change",
  "manufacturing_cop_yoy_change_percent",
  "internal_loaded_cost_yoy_change",
  "internal_loaded_cost_yoy_change_percent",
  "profit_value_ik_yoy_change",
  "profit_value_ok_yoy_change",
  "snapshot_refresh_run_id",
  "snapshot_selection_basis",
  "snapshot_run_label",
  "previous_month_refresh_run_id",
  "previous_month_selection_basis",
  "previous_year_refresh_run_id",
  "previous_year_selection_basis"
]);

const FIRST_OF_MONTH = /^\d{4}-\d{2}-01$/;

export function scopedComparisonError(err) {
  const code = String(err?.code || "");
  const raw = String(err?.message || err?.details || "");
  let message;
  if (code === "PGRST202" || code === "42883" || /could not find the function|does not exist/i.test(raw)) {
    message = `Scoped comparison read is not available on this server. Turn off the ${COMPARISON_FLAG_NAME} flag to use the original view.`;
  } else if (code === "42501" || /permission denied/i.test(raw)) {
    message = "You do not have permission to view the cost comparison.";
  } else if (code === "57014" || /statement timeout/i.test(raw)) {
    message = "The cost comparison query timed out on the server. Try again later; it was not retried automatically.";
  } else if (code === "P0001" && /Not authenticated/i.test(raw)) {
    message = "Your session is not signed in. Sign in again to view the cost comparison.";
  } else {
    message = raw || "Cost comparison could not be loaded.";
  }
  const out = new Error(message);
  out.code = code || undefined;
  out.cause = err;
  return out;
}

/** Original view read, unchanged in shape. Returns { rows, truncated:false?, source:"view" }. */
async function readViaView(supabase, periodStart) {
  let query = supabase.from(COMPARISON_VIEW).select("*");
  query = query.eq("snapshot_period_start", periodStart);
  query = query
    .order("product_name", { ascending: true })
    .order("sku_column_label", { ascending: true });
  const { data, error } = await query.limit(COMPARISON_ROW_LIMIT);
  if (error) throw error;
  return { rows: data || [], truncated: false, source: "view", refreshedAt: new Date() };
}

async function readViaScopedRpc(supabase, periodStart) {
  if (!FIRST_OF_MONTH.test(String(periodStart || ""))) {
    throw new Error("Cost comparison period must be the first day of a month (YYYY-MM-01).");
  }
  const { data, error } = await supabase.rpc(COMPARISON_SCOPED_RPC, {
    p_period_start: periodStart,
    p_limit: COMPARISON_ROW_LIMIT,
  });
  if (error) throw scopedComparisonError(error);
  if (data !== null && data !== undefined && !Array.isArray(data)) {
    throw new Error("Scoped comparison read returned an unexpected shape.");
  }
  const rows = data || [];
  if (rows.length > 0) {
    const have = new Set(Object.keys(rows[0]));
    const missing = COMPARISON_COLUMNS.filter((c) => !have.has(c));
    if (missing.length) {
      throw new Error(`Scoped comparison read is missing ${missing.length} expected column(s) (${missing.slice(0, 3).join(", ")}); not rendering partial data.`);
    }
  }
  return { rows, truncated: rows.length >= COMPARISON_ROW_LIMIT, source: "rpc", refreshedAt: new Date() };
}

/**
 * @param {{supabase:object, periodStart:string, scopedRpcEnabled:boolean}} args
 * @returns {Promise<{rows:object[], truncated:boolean, source:"view"|"rpc", refreshedAt:Date}>}
 */
export async function readCostComparisonRows({ supabase, periodStart, scopedRpcEnabled }) {
  return scopedRpcEnabled === true
    ? readViaScopedRpc(supabase, periodStart)
    : readViaView(supabase, periodStart);
}
