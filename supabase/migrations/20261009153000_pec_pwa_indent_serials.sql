-- Procurement Execution Console: PWA navigation + governed indent serial metadata
-- Bounded change:
--   1) register the existing PEC page for PWA navigation;
--   2) expose the already-governed indent_line_sort_no inside indent_breakdown JSON.
-- No procurement quantities, vendor assignments, indent lines, or permissions are mutated.

set search_path = public;

insert into public.app_module_clients
  (module_key, client_key, route_path, nav_enabled, launch_mode)
values
  ('procurement-execution-console', 'pwa', '/shared/procurement-execution-console.html', true, 'direct')
on conflict (module_key, client_key) do update
set route_path = excluded.route_path,
    nav_enabled = excluded.nav_enabled,
    launch_mode = excluded.launch_mode,
    updated_at = now();

create or replace view public.v_proc_vendorwise_buylist as
 SELECT
        CASE
            WHEN count(DISTINCT vendor_id) FILTER (WHERE vendor_id IS NOT NULL) = 1 THEN max(vendor_id)
            ELSE NULL::bigint
        END AS vendor_id,
        CASE
            WHEN count(DISTINCT vendor_id) FILTER (WHERE vendor_id IS NOT NULL) = 1 THEN max(vendor_name)
            ELSE NULL::text
        END AS vendor_name,
    material_class_id,
    stock_item_id,
    stock_item_name,
    uom_id,
    uom_code,
    sum(qty_to_buy) AS total_qty_to_buy,
        CASE
            WHEN vendor_bucket_key = 'UNASSIGNED'::text THEN NULL::numeric
            WHEN count(*) FILTER (WHERE rate_value IS NULL OR rate_value <= 0::numeric) > 0 THEN NULL::numeric
            WHEN count(DISTINCT rate_value) = 1 THEN max(rate_value)
            ELSE NULL::numeric
        END AS rate_value,
        CASE
            WHEN vendor_bucket_key = 'UNASSIGNED'::text THEN NULL::numeric
            WHEN count(*) FILTER (WHERE rate_value IS NULL OR rate_value <= 0::numeric) > 0 THEN NULL::numeric
            ELSE sum(line_amount)
        END AS total_amount,
    jsonb_agg(jsonb_build_object('indent_number', indent_number, 'indent_id', indent_id, 'indent_line_id', indent_line_id, 'indent_line_sort_no', ( SELECT o.indent_line_sort_no
           FROM v_proc_indent_lines_console_ordered o
          WHERE o.indent_line_id = b.indent_line_id), 'qty_to_buy', qty_to_buy, 'uom_code', uom_code, 'actual_vendor_id', vendor_id, 'actual_vendor_name', vendor_name, 'actual_vendor_type', actual_vendor_type, 'vendor_bucket_key', vendor_bucket_key, 'vendor_bucket_name', vendor_bucket_name, 'vendor_bucket_type', vendor_bucket_type, 'rate_value', rate_value, 'line_amount', line_amount, 'rate_status', rate_status, 'assignment_status', assignment_status, 'rm_scope', rm_scope, 'rm_scope_label', rm_scope_label) ORDER BY indent_number, ( SELECT o.indent_line_sort_no
           FROM v_proc_indent_lines_console_ordered o
          WHERE o.indent_line_id = b.indent_line_id), indent_line_id) AS indent_breakdown,
    material_class_code,
    material_class_label,
    material_class_display,
        CASE
            WHEN count(DISTINCT rm_scope) FILTER (WHERE rm_scope IS NOT NULL) = 0 THEN NULL::text
            WHEN count(DISTINCT rm_scope) FILTER (WHERE rm_scope IS NOT NULL) = 1 THEN max(rm_scope) FILTER (WHERE rm_scope IS NOT NULL)
            ELSE 'mixed'::text
        END AS rm_scope,
        CASE
            WHEN count(DISTINCT rm_scope) FILTER (WHERE rm_scope IS NOT NULL) = 0 THEN NULL::text
            WHEN count(DISTINCT rm_scope) FILTER (WHERE rm_scope IS NOT NULL) = 1 THEN max(rm_scope_label) FILTER (WHERE rm_scope IS NOT NULL)
            ELSE 'Multiple RM scopes'::text
        END AS rm_scope_label,
        CASE
            WHEN vendor_bucket_key = 'UNASSIGNED'::text THEN false
            WHEN count(*) FILTER (WHERE rate_value IS NULL OR rate_value <= 0::numeric) > 0 THEN false
            ELSE true
        END AS has_rate,
        CASE
            WHEN vendor_bucket_key = 'UNASSIGNED'::text THEN 'not_applicable'::text
            WHEN count(*) FILTER (WHERE rate_value IS NULL OR rate_value <= 0::numeric) > 0 THEN 'rate_pending'::text
            WHEN count(DISTINCT rate_value) = 1 THEN 'with_rate'::text
            ELSE 'mixed_rate'::text
        END AS rate_status,
    vendor_bucket_key <> 'UNASSIGNED'::text AS has_vendor,
        CASE
            WHEN vendor_bucket_key = 'UNASSIGNED'::text THEN 'unassigned'::text
            ELSE 'assigned'::text
        END AS assignment_status,
    count(DISTINCT vendor_id) FILTER (WHERE vendor_id IS NOT NULL) AS actual_vendor_count,
    string_agg(DISTINCT vendor_name, ', '::text ORDER BY b.vendor_name) FILTER (WHERE vendor_id IS NOT NULL) AS actual_vendor_summary,
    vendor_bucket_key,
    vendor_bucket_name,
    vendor_bucket_type
   FROM v_proc_indent_line_buylist_base b
  GROUP BY vendor_bucket_key, vendor_bucket_name, vendor_bucket_type, material_class_id, material_class_code, material_class_label, material_class_display, stock_item_id, stock_item_name, uom_id, uom_code;
;
