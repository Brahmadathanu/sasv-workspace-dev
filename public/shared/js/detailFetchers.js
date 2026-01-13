import { supabase } from "./supabaseClient.js";

export async function fetchPMContributors({
  stock_item_id,
  month_start,
  rangeStart,
  rangeEnd,
} = {}) {
  try {
    let q = supabase.from("v_mrp_pm_contrib_detail").select("*");
    if (stock_item_id) q = q.eq("stock_item_id", stock_item_id);
    if (month_start) q = q.eq("month_start", month_start);
    if (rangeStart) q = q.gte("month_start", rangeStart);
    if (rangeEnd) q = q.lte("month_start", rangeEnd);
    const { data, error } = await q.limit(200);
    if (error) {
      console.debug("fetchPMContributors error", error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.debug("fetchPMContributors exception", e);
    return [];
  }
}

export async function fetchRMTrace({
  rm_stock_item_id,
  rangeStart,
  rangeEnd,
  hasPeriodOnly,
} = {}) {
  try {
    let q = supabase.from("v_mrp_rm_trace").select("*");
    if (rm_stock_item_id) q = q.eq("rm_stock_item_id", rm_stock_item_id);
    if (hasPeriodOnly) q = q.not("period_start", "is", null);
    // apply range filters only if the view has month/period column
    try {
      if (rangeStart) q = q.gte("period_start", rangeStart);
      if (rangeEnd) q = q.lte("period_start", rangeEnd);
    } catch {
      // some views may not accept these filters; ignore
    }
    const { data, error } = await q.limit(500);
    if (error) {
      console.debug("fetchRMTrace error", error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.debug("fetchRMTrace exception", e);
    return [];
  }
}
