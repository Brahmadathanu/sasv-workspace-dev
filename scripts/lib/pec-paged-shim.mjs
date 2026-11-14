/**
 * Browser-side emulation of the live PEC paged read contracts (draft server
 * PR #323) for synthetic-fixture tests. Mirrors the SQL: server-side filters
 * BEFORE paging, deterministic order, `[{row_data,total_count}]`, `[]` for an
 * empty page, bounds 1..200 / 0..100000. Interpolate into a stub module.
 * NOT the real backend - fixture parity only.
 */
export const PAGED_SHIM = `
const __lc = (v) => String(v == null ? "" : v).toLowerCase();
const __has = (h, n) => !n || __lc(h).includes(__lc(n));
const __cls = (c) => { const u = String(c == null ? "" : c).trim().toUpperCase(); return u === "PLM" ? "PM" : u; };
const __opv = (r) => (r.vendor_bucket_type === "LOCAL_PURCHASE" || r.vendor_bucket_key === "LOCAL_PURCHASE") ? "bucket:LOCAL_PURCHASE"
  : (r.vendor_bucket_type === "UNASSIGNED" || r.vendor_bucket_key === "UNASSIGNED") ? "bucket:UNASSIGNED"
  : (r.vendor_id > 0 ? "vendor:" + r.vendor_id : "bucket:UNASSIGNED");
const __up = (rows, p) => rows.filter((r) => (p.p_material_class_id == null || r.material_class_id === p.p_material_class_id)
  && (!p.p_q || __has(r.stock_item_name, p.p_q)) && (!p.p_rate_status || r.rate_status === p.p_rate_status));
function __pagedRpc(name, p, src) {
  const paged = (rows) => {
    if (!(p.p_limit >= 1 && p.p_limit <= 200 && p.p_offset >= 0 && p.p_offset <= 100000)) return { __error: "PEC paging requires limit 1..200 and offset 0..100000" };
    return rows.slice(p.p_offset, p.p_offset + p.p_limit).map((r) => ({ row_data: r, total_count: rows.length }));
  };
  switch (name) {
    case "proc_pec_pr_headers_filtered_paged":
      return paged((src.prs || []).filter((r) => (!p.p_status || r.status === p.p_status) && (p.p_material_class_id == null || r.material_class_id === p.p_material_class_id) && __has(r.pr_number, p.p_q)).sort((a, b) => b.pr_id - a.pr_id));
    case "proc_pec_indent_headers_filtered_paged":
      return paged((src.indents || []).filter((r) => (!p.p_status || r.status === p.p_status) && (p.p_material_class_id == null || r.material_class_id === p.p_material_class_id) && __has(r.indent_number, p.p_q)).sort((a, b) => b.indent_id - a.indent_id));
    case "proc_pec_purchase_excess_filtered_paged":
      return paged((src.excess || []).filter((r) => __has(r.stock_item_name, p.p_q)
        && (!p.p_material_class_code || __cls(r.material_class_code) === __cls(p.p_material_class_code))
        && (!p.p_date_from || r.voucher_date >= p.p_date_from) && (!p.p_date_to || r.voucher_date <= p.p_date_to)
        && (!(p.p_min_qty > 0) || Number(r.net_unallocated_qty || 0) >= p.p_min_qty)
        && __has(r.vendor_display_name, p.p_vendor_q)
        && (!p.p_item_q || __has(r.stock_item_name, p.p_item_q) || __has(r.stock_item_code, p.p_item_q))
        && (!p.p_unmapped_only || !r.vendor_display_name))
        .sort((a, b) => (Number(b.net_unallocated_qty || 0) - Number(a.net_unallocated_qty || 0)) || String(b.voucher_date).localeCompare(String(a.voucher_date)) || (b.purchase_fact_id - a.purchase_fact_id)));
    case "proc_pec_excess_acceptance_audit_paged":
      return paged([...(src.audit || [])].sort((a, b) => String(b.accepted_at).localeCompare(String(a.accepted_at))));
    case "proc_vendorwise_buylist_operational_paged": {
      const f = __up(src.vwl || [], p).filter((r) => !p.p_operational_filter || __opv(r) === p.p_operational_filter);
      f.sort((a, b) => ((a.vendor_bucket_key === "UNASSIGNED") - (b.vendor_bucket_key === "UNASSIGNED")) || String(a.vendor_bucket_name).localeCompare(String(b.vendor_bucket_name)) || String(a.stock_item_name).localeCompare(String(b.stock_item_name)) || String(a.uom_code).localeCompare(String(b.uom_code)));
      return paged(f);
    }
    case "proc_vendorwise_buylist_operational_options": {
      const g = new Map();
      for (const r of __up(src.vwl || [], p)) { const v = __opv(r); const e = g.get(v) || { filter_value: v, filter_label: r.vendor_bucket_name, filter_type: v === "bucket:LOCAL_PURCHASE" ? "LOCAL_PURCHASE" : v === "bucket:UNASSIGNED" ? "UNASSIGNED" : "ACTUAL_VENDOR", group_count: 0 }; e.group_count++; g.set(v, e); }
      return [...g.values()];
    }
    case "proc_vendorwise_buylist_filtered":
      return __up(src.vwl || [], p);
    case "proc_pec_indent_headers":
      return [...(src.indents || [])].sort((a, b) => b.indent_id - a.indent_id);
    default:
      return undefined;
  }
}
`;
