-- PEC G0 acceptance: read-only verification of live UOM fix, PR/indent
-- classification gate, preserved historical backlog and MRP planning drift.
-- Run with SELECT privilege. No Tally purchase order use; no DML/DDL.
WITH current_driver AS (
 SELECT month_start,product_id,final_make_qty
 FROM public.v_product_bulk_consolidated_effective
 WHERE month_start BETWEEN DATE '2026-11-01' AND DATE '2027-01-01'
   AND final_make_qty>0
), old_driver AS (
 SELECT DISTINCT month_start,top_product_id,plan_good_output_qty
 FROM public.mrp_rm_plan_detail
 WHERE month_start BETWEEN DATE '2026-11-01' AND DATE '2027-01-01'
), driver_audit AS (
 SELECT o.month_start, count(*) old_products,
        count(*) FILTER(WHERE c.product_id IS NULL) old_products_absent_now,
        count(*) FILTER(WHERE c.product_id IS NOT NULL AND abs(c.final_make_qty-o.plan_good_output_qty)>0.000001) old_products_qty_changed,
        count(*) FILTER(WHERE c.product_id IS NOT NULL AND abs(c.final_make_qty-o.plan_good_output_qty)<=0.000001) old_products_qty_same
 FROM old_driver o LEFT JOIN current_driver c
 ON c.month_start=o.month_start AND c.product_id=o.top_product_id
 GROUP BY 1
), present AS (
 SELECT month_start,count(DISTINCT product_id) current_positive_products
 FROM current_driver GROUP BY 1
)
SELECT d.month_start,d.old_products,coalesce(p.current_positive_products,0) current_positive_products,
 d.old_products_absent_now,d.old_products_qty_changed,d.old_products_qty_same
FROM driver_audit d LEFT JOIN present p USING(month_start)
ORDER BY month_start;

-- UOM and class safeguard checks.
SELECT 'gram_standard_bom_wrong_unit' test,count(*)::numeric failures
FROM public.rm_bom_line WHERE stock_item_id IN (64,291,424,517) AND uom_id<>2
UNION ALL
SELECT 'ordinary_rm_mrp_mismatch',count(*)::numeric
FROM public.v_mrp_procurement_plan m
JOIN public.v_inv_stock_item_with_class x ON x.stock_item_id=m.stock_item_id
WHERE m.month_start BETWEEN DATE '2026-11-01' AND DATE '2027-01-01'
 AND m.material_class_id=1
 AND x.subcategory_code NOT IN ('finished_bulk_material','semifinished_goods')
 AND m.uom_id<>x.default_uom_id
UNION ALL
SELECT 'source_gross_null',count(*)::numeric
FROM public.v_mrp_material_gross_requirement_rm WHERE gross_required_qty IS NULL;

-- Show the excluded population, which is intentionally retained in internal MRP.
SELECT count(*) FILTER (WHERE p.procure_qty>0) all_positive_period_rows,
 count(*) FILTER (WHERE p.procure_qty>0 AND p.material_class_id=1
   AND x.subcategory_code IN ('finished_bulk_material','semifinished_goods'))
   internal_category_positive_period_rows,
 count(*) FILTER (WHERE p.procure_qty>0 AND x.active
   AND (p.material_class_id<>1 OR x.subcategory_code NOT IN ('finished_bulk_material','semifinished_goods')))
   eligible_external_positive_period_rows
FROM public.v_mrp_procurement_plan p
JOIN public.v_inv_stock_item_with_class x ON x.stock_item_id=p.stock_item_id
WHERE p.month_start BETWEEN DATE '2026-11-01' AND DATE '2027-01-01';

-- Historical commitments must be reported, NOT automatically cancelled.
SELECT b.indent_number,b.indent_line_id,b.stock_item_id,s.name,x.subcategory_code,
       u.code uom,b.remaining_qty
FROM public.v_proc_indent_line_balance b
JOIN public.inv_stock_item s ON s.id=b.stock_item_id
JOIN public.v_inv_stock_item_with_class x ON x.stock_item_id=b.stock_item_id
JOIN public.inv_uom u ON u.id=b.uom_id
WHERE x.subcategory_code IN ('finished_bulk_material','semifinished_goods')
  AND b.remaining_qty>0
ORDER BY b.indent_number,b.stock_item_id;

-- Static no-mutation validation of deployed writer and empty-indent gates.
SELECT proname,
 position('finished_bulk_material' IN pg_get_functiondef(oid))>0 AS has_internal_exclusion,
 position('No eligible positive external-procurement PR lines' IN pg_get_functiondef(oid))>0 AS has_empty_indent_guard
FROM pg_proc
WHERE proname IN ('create_pr_from_mrp_plan_pec_internal','proc_pr_rebuild_from_mrp_pec_internal',
'proc_indent_create_from_pr_pec_internal','proc_indent_resync_from_pr_pec_internal')
ORDER BY proname;
