-- PEC-ERP-S4 PREVIEW EVIDENCE READBACK — SELECT ONLY, NOT AN RPC/MIGRATION.
-- Example fixed anchor: 12 completed calendar months through Oct 2026,
-- hypothetical fresh 3-month PR: Nov 2026-Jan 2027.
-- Change p_item_id to another item for a bounded, individually auditable read.
-- DO NOT call this a procurement proposal. Does not yet reconcile other firm
-- inbound, item eligibility, UOM, quality-hold, expiry or owner-approved rate.
WITH
parameters AS (
  SELECT 1638::bigint AS p_item_id,
         date '2026-11-01' AS pr_from,
         date '2027-01-01' AS pr_to,
         date '2026-10-01' AS last_complete_consumption_month,
         date '2026-11-11' AS expected_stock_watermark
),
months AS (
  SELECT (p.last_complete_consumption_month - (g.n || ' months')::interval)::date AS month_start
  FROM parameters p CROSS JOIN generate_series(0,11) g(n)
),
monthly AS (
  SELECT m.month_start, COALESCE(sum(c.total_consumed_qty),0::numeric) AS consumed_qty,
         count(c.month_start_date) AS matched_source_rows
  FROM months m CROSS JOIN parameters p
  LEFT JOIN public.v_item_consumption_monthly_by_item c
    ON c.month_start_date=m.month_start AND c.inv_stock_item_id=p.p_item_id
  GROUP BY m.month_start
),
usage AS (
  SELECT sum(consumed_qty) AS usage_12m,
         sum(consumed_qty) FILTER(WHERE month_start >= date '2026-08-01') AS usage_3m,
         count(*) AS calendar_months,
         count(*) FILTER(WHERE consumed_qty > 0) AS nonzero_months,
         round(avg(consumed_qty),3) AS avg_monthly_12m,
         round(avg(consumed_qty) FILTER(WHERE month_start >= date '2026-08-01'),3) AS avg_monthly_3m
  FROM monthly
),
stock AS (
  SELECT s.inv_stock_item_id AS stock_item_id,
         sum(s.qty_value) AS reported_on_hand,
         string_agg(DISTINCT s.source_kind, ', ' ORDER BY s.source_kind) AS source_kinds
  FROM public.v_stock_current_by_item s CROSS JOIN parameters p
  WHERE s.inv_stock_item_id=p.p_item_id AND s.source_kind IN ('rm','plm')
  GROUP BY s.inv_stock_item_id
),
source_watermark AS (
  SELECT max(as_of_date) AS snapshot_date FROM public.tally_plm_stock_snapshot
),
mrp AS (
  SELECT m.stock_item_id,m.uom_id, max(m.uom_code) AS uom_code,
         sum(m.gross_required_qty) AS mrp_gross_qty,
         sum(m.procure_qty) AS mrp_stock_netted_qty,
         count(*) AS mrp_month_rows
  FROM public.v_mrp_procurement_plan m CROSS JOIN parameters p
  WHERE m.stock_item_id=p.p_item_id AND m.month_start BETWEEN p.pr_from AND p.pr_to
  GROUP BY m.stock_item_id,m.uom_id
),
moq AS (
  SELECT m.stock_item_id,m.uom_id,count(*) AS effective_policy_rows,
         max(m.moq_qty) AS moq_qty
  FROM public.inv_stock_item_moq_policy m CROSS JOIN parameters p
  WHERE m.stock_item_id=p.p_item_id AND m.is_active
    AND (m.effective_from IS NULL OR m.effective_from<=p.pr_from)
    AND (m.effective_to IS NULL OR m.effective_to>=p.pr_from)
  GROUP BY m.stock_item_id,m.uom_id
)
SELECT i.id AS stock_item_id,i.name, p.pr_from,p.pr_to,
       u.calendar_months,u.nonzero_months,u.usage_12m,
       u.avg_monthly_12m,u.avg_monthly_3m,
       s.reported_on_hand,s.source_kinds,w.snapshot_date AS stock_source_as_of,
       m.uom_id,m.uom_code,m.mrp_gross_qty,m.mrp_stock_netted_qty,m.mrp_month_rows,
       q.moq_qty,q.effective_policy_rows,
       -- purely illustrative D=12m mean * inclusive 3 PR months;
       -- no stock/commitment/quality/UOM eligibility gate has yet been passed
       round(u.usage_12m / 12 * 3,3) AS illustrative_period_consumption,
       CASE WHEN s.stock_item_id IS NULL THEN 'NO_STOCK_MAPPING_REVIEW'
            WHEN w.snapshot_date IS DISTINCT FROM p.expected_stock_watermark
                 THEN 'STOCK_WATERMARK_REVIEW'
            WHEN m.stock_item_id IS NULL THEN 'MRP_ABSENT_REVIEW'
            WHEN coalesce(q.effective_policy_rows,0) <> 1
                 THEN 'MOQ_POLICY_REVIEW'
            ELSE 'INBOUND_AND_USABLE_STOCK_REVIEW'
       END AS evidence_gate,
       NULL::numeric AS approved_incremental_pr_qty
FROM parameters p
JOIN public.inv_stock_item i ON i.id=p.p_item_id
CROSS JOIN usage u
LEFT JOIN stock s ON s.stock_item_id=i.id
LEFT JOIN mrp m ON m.stock_item_id=i.id
LEFT JOIN moq q ON q.stock_item_id=i.id AND q.uom_id=m.uom_id
CROSS JOIN source_watermark w
ORDER BY m.uom_id;
