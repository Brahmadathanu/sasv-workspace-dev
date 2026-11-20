-- PEC ERP S4: bounded read-only comparison RM #733 / PLM #1638.
-- Historical usage: completed calendar Nov 2025 through Oct 2026.
-- Hypothetical 3-month PR: Nov 2026 through Jan 2027.
-- This is diagnostic only; existing MRP horizon stock anchor may differ from
-- latest Tally as-of date. Outstanding PR/indent/PO/receipts not reconciled.
WITH candidate_items AS (
 SELECT 733::bigint stock_item_id UNION ALL SELECT 1638::bigint
), params AS (
 SELECT date '2026-11-01' pr_start,date '2027-01-01' pr_end,
        date '2025-11-01' usage_start,date '2026-10-01' usage_end
), months AS (
 SELECT gs::date month_start FROM params p,
 generate_series(p.usage_start::timestamp,p.usage_end::timestamp,interval '1 month') gs
), consumption AS (
 SELECT i.stock_item_id,m.month_start,coalesce(sum(c.total_consumed_qty),0) consumed
 FROM candidate_items i cross join months m
 LEFT JOIN public.v_item_consumption_monthly_by_item c
    ON c.inv_stock_item_id=i.stock_item_id AND c.month_start_date=m.month_start
 GROUP BY i.stock_item_id,m.month_start
), rate AS (
 SELECT stock_item_id,sum(consumed) usage12,sum(consumed)/12 avg_monthly,
 count(*) filter(where consumed>0) nonzero_months
 FROM consumption GROUP BY stock_item_id
), stock AS (
 SELECT s.inv_stock_item_id stock_item_id,
        sum(s.qty_value) qty_on_hand,
        max(s.source_kind) source_kind
 FROM public.v_stock_current_by_item s
 JOIN candidate_items i ON i.stock_item_id=s.inv_stock_item_id
 WHERE s.source_kind in ('rm','plm')
 GROUP BY 1
), mrp AS (
 SELECT m.stock_item_id,m.uom_id,max(m.uom_code) uom_code,
        sum(m.gross_required_qty) gross_required_qty,
        sum(m.procure_qty) mrp_net_procure_qty
 FROM public.v_mrp_procurement_plan m
 JOIN candidate_items i on i.stock_item_id=m.stock_item_id
 CROSS JOIN params p
 WHERE m.month_start BETWEEN p.pr_start and p.pr_end
 GROUP BY 1,2
), policy AS (
 SELECT p.stock_item_id,p.uom_id,count(*) eligible_policy_count,max(p.moq_qty) moq
 FROM public.inv_stock_item_moq_policy p CROSS JOIN params d
 JOIN candidate_items i on i.stock_item_id=p.stock_item_id
 WHERE p.is_active and (p.effective_from is null or p.effective_from<=d.pr_start)
   and (p.effective_to is null or p.effective_to>=d.pr_start)
 GROUP BY 1,2
), combined AS (
 SELECT i.stock_item_id,si.name,m.uom_code,m.uom_id, r.usage12,
        r.avg_monthly,r.nonzero_months,
        s.source_kind,s.qty_on_hand,
        case when s.source_kind='rm' then (select max(as_of_date) from public.tally_rm_stock_snapshot)
             when s.source_kind='plm' then (select max(as_of_date) from public.tally_plm_stock_snapshot)
             else null end stock_source_as_of,
        m.gross_required_qty,m.mrp_net_procure_qty,
        coalesce(p.eligible_policy_count,0) eligible_moq_policies,p.moq
 FROM candidate_items i JOIN public.inv_stock_item si on si.id=i.stock_item_id
 LEFT JOIN rate r on r.stock_item_id=i.stock_item_id
 LEFT JOIN stock s on s.stock_item_id=i.stock_item_id
 LEFT JOIN mrp m on m.stock_item_id=i.stock_item_id
 LEFT JOIN policy p on p.stock_item_id=i.stock_item_id AND p.uom_id=m.uom_id
)
SELECT *, avg_monthly*3 AS unrounded_period_usage,
  greatest(0,avg_monthly*3-qty_on_hand) AS illustrative_net_before_moq,
  case when qty_on_hand is null or uom_code is null then null
       when eligible_moq_policies>1 then null
       when moq>0 then ceil(greatest(0,avg_monthly*3-qty_on_hand)/moq)*moq
       when uom_code='Nos' then ceil(greatest(0,avg_monthly*3-qty_on_hand))
       else greatest(0,avg_monthly*3-qty_on_hand)
  end illustrative_round_once,
  'ANCHOR_AND_COMMITMENT_RECONCILIATION_REQUIRED'::text review_state,
  NULL::numeric AS approved_pr_increment
FROM combined ORDER BY stock_item_id;
