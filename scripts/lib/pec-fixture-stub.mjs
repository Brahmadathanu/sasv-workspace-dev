/**
 * Synthetic PEC fixture stub (replaces js/supabaseClient.js in the browser).
 * Large deterministic fixtures + paged-contract emulation (pec-paged-shim) +
 * PostgREST max_rows(1000) emulation for UNPAGED results. Synthetic data only;
 * not a security/role oracle and never evidence of genuine sessions.
 */
import { PAGED_SHIM } from "./pec-paged-shim.mjs";

export const buildFixtureStub = (S) => `${PAGED_SHIM}
const S = ${JSON.stringify(S)};
const calls = (globalThis.__rpcCalls = []);
const mk = (d) => ({ data: d, error: null });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const daysAgo = (k) => { const d = new Date(); d.setDate(d.getDate() - k); return iso(d); };
let nIndents = 250, nPrs = 230;
globalThis.__setCounts = (a, b) => { nIndents = a; nPrs = b; };
const indents = () => Array.from({ length: nIndents }, (_, i) => ({ indent_id: i + 1, indent_number: "IND-26-" + String(i + 1).padStart(4, "0"), status: S.r2 ? ["draft", "approved", "issued", "closed", "draft", "approved", "issued", "closed"][i % 8] : (i + 1) % 3 === 0 ? "approved" : "draft", approved_date: null, indent_date: daysAgo(i % 90), material_class_id: 1 + (i % 2), material_class_code: i % 2 ? "PM" : "RM", line_count: 2, source_pr_id: S.r2 && i % 8 === 4 ? 55 : null, total_remaining_qty: 3 }));
const prs = () => Array.from({ length: nPrs }, (_, i) => ({ pr_id: i + 1, pr_number: "PR-" + String(i + 1).padStart(4, "0"), status: i % 4 === 0 ? "active" : "draft", effective_from_date: daysAgo(i % 60), material_class_id: 1 + (i % 2), line_count: 3 }));
const excess = Array.from({ length: 450 }, (_, i) => ({ purchase_fact_id: i + 1, voucher_number: "V-" + (i + 1), voucher_date: daysAgo(i % 120), stock_item_name: "Item " + (i + 1) + (i % 7 === 0 ? " Special" : ""), stock_item_code: "C" + (i + 1), material_class_code: i % 2 ? "PLM" : "RM", vendor_display_name: i % 5 === 0 ? null : "Vendor " + (i % 9), purchase_qty: 10, allocated_qty: 1, unallocated_qty: 9, accepted_qty: 0, net_unallocated_qty: 1 + (i % 11) }));
const audit = Array.from({ length: 250 }, (_, i) => ({ accepted_at: "2026-10-" + String(1 + (i % 28)).padStart(2, "0") + "T10:" + String(i % 60).padStart(2, "0"), stock_item_name: "Audit item " + i, accepted_qty: 1, reason: "r", accepted_by: "u" }));
const vendors = Array.from({ length: 60 }, (_, v) => ({ id: v + 1, name: v === 59 ? "ZZ Last Vendor" : "Vendor " + String(v + 1).padStart(2, "0") }));
const vwl = [];
for (let i = 0; i < ${S.hugeVwl ? 50001 : (S.vwlRows || 500)}; i++) {
  const k = i % 62;
  const unassigned = k === 60, local = k === 61;
  const v = vendors[k % 60];
  vwl.push({ vendor_id: unassigned ? null : local ? null : v.id, vendor_bucket_key: unassigned ? "UNASSIGNED" : local ? "LOCAL_PURCHASE" : "V" + v.id, vendor_bucket_type: unassigned ? "UNASSIGNED" : local ? "LOCAL_PURCHASE" : "ACTUAL_VENDOR",
    vendor_bucket_name: unassigned ? "UNASSIGNED" : local ? "Local Purchase" : v.name, vendor_name: unassigned ? null : local ? "Local Purchase" : v.name,
    material_class_id: 1, material_class_code: "RM", stock_item_id: 1000 + i, uom_id: 1, stock_item_name: "VItem " + String(i).padStart(4, "0"), uom_code: "KG",
    total_qty_to_buy: 5, rate_value: unassigned ? null : 10, line_amount: unassigned ? null : 50, rate_status: unassigned ? "not_applicable" : "with_rate", assignment_status: unassigned ? "unassigned" : "assigned",
    indent_breakdown: Array.from({ length: ${S.vwlBdLen || 1} }, (_, b) => ({ indent_number: "IND-26-" + (100 + ((i + b) % 90)), indent_line_sort_no: 1 + ((i + b) % 4), qty_to_buy: 5, uom_code: "KG" })) });
}
export const supabase = {
  auth: { getSession: async () => ({ data: { session: { user: { id: "f" } } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  rpc: (name, params) => {
    let p = params || {};
    const call = { name, params: p, t: Date.now() };
    calls.push(call);
    const run = async () => {
      // R2c deterministic race harness: per-RPC delay (S.delay[name], or S.delayQ[name][p_q]) and scripted failures
      // (S.fail[name] = { times, error:{message,code,name}, status, delay }) consumed in call order.
      const dq = S.delayQ && S.delayQ[name] && S.delayQ[name][p.p_q ?? ""];
      const d = dq !== undefined ? dq : S.delay && S.delay[name];
      if (d) await sleep(d);
      const fl = S.fail && S.fail[name];
      if (fl) {
        const used = (globalThis.__failUsed = globalThis.__failUsed || {});
        if ((used[name] || 0) < (fl.times ?? 1)) { used[name] = (used[name] || 0) + 1; if (fl.delay) await sleep(fl.delay); call.failed = true; return { data: null, error: fl.error || { message: "fixture failure" }, status: fl.status ?? 500 }; }
      }
      if (name === "get_user_permissions") return mk(S.role === "none" ? [] : [{ target: "module:procurement-execution-console", can_view: true, can_edit: S.role === "edit" }]);
      if (S.empty && name.endsWith("_paged")) return mk([]);
      if (S.failSecondPage && name.endsWith("_paged") && p.p_offset > 0 && (globalThis.__failedMore || 0) < Number(S.failSecondPage === true ? 1 : S.failSecondPage)) { globalThis.__failedMore = (globalThis.__failedMore || 0) + 1; return { data: null, error: { message: "fixture second-page failure" } }; }
      if (S.overlap && name === "proc_pec_pr_headers_filtered_paged" && p.p_offset > 0) p = { ...p, p_offset: p.p_offset - 2 };
      if (S.slowSearch && p.p_q === S.slowSearch) await sleep(900);
      if (S.failPaged && name.endsWith("_paged")) return { data: null, error: { message: "fixture paged failure" } };
      if (name === "proc_procurement_action_queue_paged" && S.aq) {
        const base = [[250, "IND-26-0250"], [200, "IND-26-0200"], [7, "IND-26-0007"], [9999, "IND-26-9999"], [200, "STALE-NUMBER"]];
        const rows = S.aqRows ? Array.from({ length: S.aqRows }, (_, k) => [1000 + k, "IND-26-" + (1000 + k)]) : base;
        return mk(rows.slice(p.p_offset || 0, (p.p_offset || 0) + (p.p_limit || 50)).map(([id, no], k0) => { const k = (p.p_offset || 0) + k0; return { total_count: rows.length, row_data: { indent_line_id: 5000 + k, indent_id: id, indent_number: no, stock_item_name: "AQ item " + k, remaining_qty: 1, priority_band_final: "P1", priority_score_system: 1, material_class_code: "RM", uom_code: "KG" } }; }));
      }
      let r = __pagedRpc(name, p, { indents: indents(), prs: prs(), excess, audit, vwl });
      if (r && r.__error) return { data: null, error: { message: r.__error } };
      // PostgREST max_rows (supabase/config.toml: 1000) silently caps UNPAGED set results
      if (Array.isArray(r) && !name.endsWith("_paged") && !name.endsWith("_options")) r = r.slice(0, 1000);
      if (r !== undefined) return mk(r);
      if (name === "proc_pec_indent_lines") return mk([1, 2, 3].map((n) => ({ indent_line_id: p.p_indent_id * 10 + n, indent_id: p.p_indent_id, indent_line_sort_no: n, stock_item_id: n, stock_item_name: "Synthetic item " + n, material_class_code: "RM", uom_id: 1, material_class_id: 1, uom_code: "KG", requested_qty: 10, allocated_qty: 0, remaining_qty: 10, recommended_vendor_id: null, recommended_vendor_name: null, recommended_rate: null, selected_vendor_id: null, selected_vendor_name: null, selected_rate: null, resolved_vendor_name: null, resolved_rate: null })));
      if (name === "proc_vendorwise_buylist_split_items") return mk([]);
      return mk([]);
    };
    const prom = run();
    // supabase-js query-builder shape. Abort is simulated: an aborted request resolves with an AbortError result.
    prom.abortSignal = (sig) => new Promise((res) => {
      const onAbort = () => { call.aborted = true; res({ data: null, error: { name: "AbortError", message: "AbortError: The operation was aborted." }, status: 0 }); };
      if (sig && sig.aborted) return onAbort();
      sig && sig.addEventListener("abort", onAbort, { once: true });
      prom.then(res);
    });
    return prom;
  },
  from: () => { const b = { select: () => b, eq: () => b, limit: () => b, order: () => b, in: () => b, ilike: () => b, then: (r) => r(mk([])) }; return b; },
  schema: () => ({ from: () => ({}) }),
};
export const labSupabase = supabase; export const hrSupabase = supabase; export const handleSupabaseError = (e) => e;
`;
