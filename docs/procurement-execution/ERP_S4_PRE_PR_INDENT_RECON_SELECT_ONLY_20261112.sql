-- PEC S4 pre-PR reconciliation evidence preview, SELECT ONLY.
-- Proof fixture: two items and one hypothetical Nov-2026..Jan-2027 horizon.
-- IMPORTANT: open-indent balance is not guaranteed inbound or eligible credit.
-- Positive old indent totals flag review; do not automatically subtract.
WITH items(stock_item_id) AS (
 VALUES (733::bigint),(1638::bigint)
), mrp AS (
 SELECT p.stock_item_id,p.uom_id,max(p.uom_code) uom_code,
        sum(p.procure_qty) mrp_net_qty
 FROM public.v_mrp_procurement_plan p JOIN items i USING(stock_item_id)
 WHERE p.month_start BETWEEN DATE '2026-11-01' AND DATE '2027-01-01'
 GROUP BY p.stock_item_id,p.uom_id
), open_indent AS (
 SELECT b.stock_item_id,b.uom_id,
        count(*) open_lines,count(DISTINCT b.indent_id) indent_count,
        sum(b.remaining_qty) open_indent_qty,
        min(b.approved_date) oldest_approved,
        max(b.approved_date) latest_approved,
        string_agg(DISTINCT b.indent_number,', ' ORDER BY b.indent_number) indent_refs
 FROM public.v_proc_indent_line_balance b
 JOIN items i USING(stock_item_id)
 WHERE b.remaining_qty>0
 GROUP BY b.stock_item_id,b.uom_id
)
SELECT i.stock_item_id,si.name,m.uom_id,m.uom_code,
       m.mrp_net_qty,coalesce(o.open_lines,0) open_lines,
       coalesce(o.open_indent_qty,0) outstanding_indent_qty,
       o.indent_refs,o.oldest_approved,o.latest_approved,
       -- A claim about actual delivery is NOT supported by an indent alone.
       NULL::numeric AS confirmed_eligible_old_indent_credit,
       CASE WHEN coalesce(o.open_lines,0)>0 THEN 'OUTSTANDING_INDENT_RECONCILIATION_REQUIRED'
            ELSE 'OTHER_COMMITMENTS_AND_STOCK_ANCHOR_REVIEW'
       END AS reconciliation_status,
       NULL::numeric AS approved_new_pr_qty
FROM items i JOIN public.inv_stock_item si ON si.id=i.stock_item_id
LEFT JOIN mrp m ON m.stock_item_id=i.stock_item_id
LEFT JOIN open_indent o ON o.stock_item_id=i.stock_item_id AND o.uom_id=m.uom_id
ORDER BY i.stock_item_id,m.uom_id;
