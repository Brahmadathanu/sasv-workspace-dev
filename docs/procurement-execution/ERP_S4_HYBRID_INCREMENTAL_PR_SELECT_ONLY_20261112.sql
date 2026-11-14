-- PEC ERP S4 hybrid pre-PR calculation candidate, SELECT ONLY.
-- Pinned hypothetical period: Nov 2026 to Jan 2027; source issue months
-- Nov 2025-Oct 2026. Two diagnostic items; NOT a callable production API.
-- No Tally PO dependency. No DML, new PR or indent created.
WITH
params AS (
 SELECT date '2026-11-01' horizon_start, date '2027-01-01' horizon_end,
        date '2025-11-01' consumption_from, date '2026-10-01' consumption_to,
        3::numeric horizon_months
),
items(stock_item_id) AS (VALUES (733::bigint),(1638::bigint)),
usage_calendar AS (
 SELECT i.stock_item_id, g.month_start::date month_start
 FROM items i CROSS JOIN params p CROSS JOIN LATERAL
 generate_series(p.consumption_from::timestamp,p.consumption_to::timestamp,interval '1 month') g(month_start)
),
usage_month AS (
 SELECT c.stock_item_id,c.month_start,
        coalesce(sum(h.total_consumed_qty),0::numeric) qty
 FROM usage_calendar c LEFT JOIN public.v_item_consumption_monthly_by_item h
 ON h.inv_stock_item_id=c.stock_item_id AND h.month_start_date=c.month_start
 GROUP BY c.stock_item_id,c.month_start
),
consumption AS (
 SELECT stock_item_id,count(*) months, count(*) FILTER(WHERE qty>0) nonzero_months,
        sum(qty) consumed_12m, avg(qty) monthly_average
 FROM usage_month GROUP BY stock_item_id
),
mrp AS (
 SELECT p.material_class_id,p.stock_item_id,p.uom_id,max(p.uom_code) uom_code,
        sum(p.gross_required_qty) mrp_gross_qty,
        sum(p.procure_qty) mrp_net_qty
 FROM public.v_mrp_procurement_plan p JOIN items i USING(stock_item_id)
 CROSS JOIN params w WHERE p.month_start BETWEEN w.horizon_start AND w.horizon_end
 GROUP BY 1,2,3
),
stock AS (
 SELECT s.inv_stock_item_id stock_item_id, s.source_kind,
        sum(s.qty_value) on_hand_reported
 FROM public.v_stock_current_by_item s JOIN items i
 ON s.inv_stock_item_id=i.stock_item_id
 WHERE s.source_kind IN ('rm','plm')
 GROUP BY 1,2
),
indent AS (
 SELECT b.material_class_id,b.stock_item_id,b.uom_id,
        count(*) prior_open_indent_lines, sum(b.remaining_qty) prior_open_indent_qty,
        string_agg(DISTINCT b.indent_number,', ' ORDER BY b.indent_number) prior_indent_numbers,
        min(b.approved_date) oldest_indent_approval
 FROM public.v_proc_indent_line_balance b JOIN items i USING(stock_item_id)
 WHERE b.remaining_qty>0
 GROUP BY 1,2,3
),
moq_policy AS (
 SELECT p.stock_item_id,p.uom_id,count(*) moq_policy_count,max(p.moq_qty) moq
 FROM public.inv_stock_item_moq_policy p CROSS JOIN params w
 JOIN items i ON i.stock_item_id=p.stock_item_id
 WHERE p.is_active AND (p.effective_from IS NULL OR p.effective_from<=w.horizon_start)
 AND (p.effective_to IS NULL OR p.effective_to>=w.horizon_start)
 GROUP BY 1,2
),
base AS (
 SELECT m.*,si.name stock_item_name,s.source_kind,s.on_hand_reported,
        x.consumed_12m,x.monthly_average,x.nonzero_months,
        w.horizon_months,
        coalesce(d.prior_open_indent_qty,0::numeric) previous_indent_balance,
        coalesce(d.prior_open_indent_lines,0::bigint) previous_indent_lines,
        d.prior_indent_numbers,d.oldest_indent_approval,
        coalesce(q.moq_policy_count,0::bigint) moq_policy_count,q.moq,
        greatest(0::numeric,x.monthly_average*w.horizon_months-coalesce(s.on_hand_reported,0)) consumption_net_before_indent
 FROM mrp m JOIN public.inv_stock_item si ON si.id=m.stock_item_id
 JOIN consumption x ON x.stock_item_id=m.stock_item_id
 LEFT JOIN stock s ON s.stock_item_id=m.stock_item_id
   AND s.source_kind=CASE WHEN m.material_class_id=1 THEN 'rm' WHEN m.material_class_id=2 THEN 'plm' END
 LEFT JOIN indent d ON d.material_class_id=m.material_class_id AND d.stock_item_id=m.stock_item_id AND d.uom_id=m.uom_id
 LEFT JOIN moq_policy q ON q.stock_item_id=m.stock_item_id AND q.uom_id=m.uom_id
 CROSS JOIN params w
),
net AS (
 SELECT b.*,
        greatest(mrp_net_qty,consumption_net_before_indent) hybrid_need_before_indent,
        greatest(0::numeric,greatest(mrp_net_qty,consumption_net_before_indent)-previous_indent_balance)
          additional_need_before_rounding
 FROM base b
)
SELECT stock_item_id,stock_item_name,material_class_id,uom_id,uom_code,
       consumed_12m,monthly_average,nonzero_months,horizon_months,
       on_hand_reported,mrp_gross_qty,mrp_net_qty,
       consumption_net_before_indent,hybrid_need_before_indent,
       previous_indent_lines,previous_indent_balance,prior_indent_numbers,oldest_indent_approval,
       additional_need_before_rounding,moq,moq_policy_count,
       CASE WHEN on_hand_reported IS NULL OR moq_policy_count>1 THEN NULL::numeric
            WHEN moq>0 THEN ceil(additional_need_before_rounding/moq)*moq
            WHEN uom_code='Nos' THEN ceil(additional_need_before_rounding)
            ELSE additional_need_before_rounding
       END AS illustrative_new_pr_qty,
       CASE WHEN on_hand_reported IS NULL THEN 'STOCK_MAPPING_REVIEW'
            WHEN moq_policy_count>1 THEN 'MULTIPLE_MOQ_POLICIES_REVIEW'
            WHEN previous_indent_lines>0 THEN 'INDENT_LIFECYCLE_AND_STOCK_ANCHOR_REVIEW'
            ELSE 'STOCK_ANCHOR_AND_USAGE_POLICY_REVIEW'
       END AS diagnostic_state,
       NULL::numeric AS approved_new_pr_qty
FROM net ORDER BY stock_item_id;
