-- S4 generalized RM/PM cohort diagnostic; SELECT-only, read-only.
-- Dates pinned for controlled Nov2026-Jan2027 example; historical completed
-- months Nov2025-Oct2026. Does NOT update PR or use Tally purchase orders.
-- Exposes aggregate evidence flags, NOT an approved buying quantity.
WITH mrp AS (
 SELECT material_class_id,stock_item_id,uom_id,sum(procure_qty) net_qty
 FROM public.v_mrp_procurement_plan
 WHERE material_class_id IN (1,2) AND month_start BETWEEN date '2026-11-01' AND date '2027-01-01'
 GROUP BY 1,2,3
), consumed AS (
 SELECT inv_stock_item_id stock_item_id,sum(total_consumed_qty) qty12,
        count(distinct month_start_date) nonzero_source_months
 FROM public.v_item_consumption_monthly_by_item
 WHERE month_start_date BETWEEN date '2025-11-01' AND date '2026-10-01'
 GROUP BY 1 HAVING sum(total_consumed_qty)>0
), canonical AS (
 SELECT si.stock_item_id,si.name,si.category_code,si.default_uom_id
 FROM public.v_inv_stock_item_with_class si
 WHERE si.active AND si.category_code IN ('RM','PM')
), candidate AS (
 SELECT m.material_class_id,m.stock_item_id,m.uom_id,true in_mrp
 FROM mrp m JOIN canonical c USING(stock_item_id)
 UNION ALL
 SELECT CASE WHEN c.category_code='RM' THEN 1 ELSE 2 END,
 c.stock_item_id,c.default_uom_id,false
 FROM canonical c JOIN consumed x USING(stock_item_id)
 WHERE c.default_uom_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM mrp m WHERE m.stock_item_id=c.stock_item_id)
), stock AS (
 SELECT inv_stock_item_id stock_item_id,source_kind,
        sum(qty_value) stock_qty
 FROM public.v_stock_current_by_item
 WHERE source_kind IN ('rm','plm') GROUP BY 1,2
), indent AS (
 SELECT material_class_id,stock_item_id,uom_id,
        sum(remaining_qty) outstanding, count(*) open_lines
 FROM public.v_proc_indent_line_balance
 WHERE remaining_qty>0 AND material_class_id IN (1,2)
 GROUP BY 1,2,3
), eligible AS (
 SELECT c.*,s.category_code,s.default_uom_id, m.net_qty,
        u.qty12,u.nonzero_source_months,
        st.stock_qty,ind.outstanding,ind.open_lines,
        CASE WHEN c.uom_id IS DISTINCT FROM s.default_uom_id THEN 'MRP_UOM_DIFFERS_FROM_DEFAULT'
             WHEN st.stock_qty IS NULL THEN 'STOCK_SOURCE_ABSENT'
             WHEN u.qty12 IS NULL THEN 'NO_CONSUMPTION_HISTORY'
             ELSE 'CALCULATION_EVIDENCE_PRESENT'
        END diagnostic_flag
 FROM candidate c JOIN canonical s USING(stock_item_id)
 LEFT JOIN mrp m ON m.material_class_id=c.material_class_id AND m.stock_item_id=c.stock_item_id AND m.uom_id=c.uom_id
 LEFT JOIN consumed u USING(stock_item_id)
 LEFT JOIN stock st ON st.stock_item_id=c.stock_item_id
 AND st.source_kind=CASE WHEN s.category_code='RM' THEN 'rm' ELSE 'plm' END
 LEFT JOIN indent ind ON ind.material_class_id=c.material_class_id AND ind.stock_item_id=c.stock_item_id AND ind.uom_id=c.uom_id
)
SELECT category_code,in_mrp,diagnostic_flag,count(*) candidate_tuples,
 count(*) FILTER(WHERE coalesce(outstanding,0)>0) with_open_indent,
 count(*) FILTER(WHERE coalesce(outstanding,0)=0 AND qty12>0) with_usage_without_open_indent,
 count(*) FILTER(WHERE qty12>0) with_usage,
 count(*) FILTER(WHERE stock_qty IS NULL) missing_stock_rows
FROM eligible GROUP BY 1,2,3 ORDER BY 1,2,3;
