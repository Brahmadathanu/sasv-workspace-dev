-- Executive MIS G7 — REVIEW-ONLY SQL PROPOSAL. NEVER APPLY TO PRODUCTION.
-- This is an illustrative read-only SELECT for a proposed contract; not executed on live DB.
-- Period report cutoffs are consistent for physical receipts and book FG transfers.
-- Ledger timestamptz dates are interpreted in Asia/Kolkata explicitly; Tally transfer_date is a date.
-- Conversion may inhibit a movement_date index, requiring an authorized EXPLAIN and suitable bound strategy before live deployment.
-- Do not run this query in the user-facing authenticated role: costing snapshots are
-- private and this is intentionally NOT a permission-gated RPC.
-- No DDL, grants, procedures, refresh or table mutations.
-- Reference: docs/executive-mis/MIS_G7_SERVER_CONTRACT_DRAFT.md
--
-- IMPORTANT: This preview intentionally provides COVERED SUBTOTALS ONLY.
-- RM materials-stores handling is attributed to bulk using the approved
-- RM/PM workload split; PM materials-stores handling remains a packing cost.
-- Full bulk COP still requires owner acceptance of model-stage attribution. It does not provide formal completion value or an
-- achievement percentage. Production installation requires separate approval.
WITH
params AS (
  SELECT
    date '2026-11-01' AS report_month,
    date '2026-11-20' AS inclusive_report_cutoff,
    143::bigint AS approved_cost_run_id
),
rm AS (
  SELECT product_id,
         min(rm_cost_per_base_unit) AS rm_rate,
         max(rm_cost_per_base_unit) AS max_rm_rate
  FROM costing.sku_material_cost_snapshot s JOIN params ON s.refresh_run_id = params.approved_cost_run_id
  GROUP BY product_id
),
manufacturing_labour AS (
  SELECT l.product_id,
         l.product_direct_labour_allocation /
           nullif(l.monthly_product_base_qty, 0) AS labour_rate
  FROM costing.product_direct_labour_workload_snapshot l
  JOIN params ON l.refresh_run_id = params.approved_cost_run_id
),
route_overhead AS (
  SELECT o.product_id,
         min(o.production_overhead_cost_per_base_uom) AS overhead_rate,
         max(o.production_overhead_cost_per_base_uom) AS max_overhead_rate
  FROM costing.sku_production_overhead_allocation_snapshot o
  JOIN params ON o.refresh_run_id = params.approved_cost_run_id
  GROUP BY o.product_id
),
quality_control AS (
  SELECT q.product_id, q.qc_cost_per_product_base_uom AS qc_rate
  FROM costing.product_qc_allocation_snapshot q
  JOIN params ON q.refresh_run_id = params.approved_cost_run_id
),
material_conversion AS (
  SELECT c.product_id,
         min(c.internal_conversion_cost_per_product_base_uom) AS conversion_rate,
         max(c.internal_conversion_cost_per_product_base_uom) AS max_conversion_rate
  FROM costing.sku_internal_material_conversion_snapshot c
  JOIN params ON c.refresh_run_id = params.approved_cost_run_id
  GROUP BY c.product_id
),
-- All product-rate components are unique by product. Do not join raw SKU rows
-- directly to physical events or production plans: that duplicates quantities.
materials_stores_rm AS (
  -- Preserve the approved SKU workload model, then collapse to ONE product rate.
  -- RM workload share is for bulk stage; PM share remains packing stage.
  -- This is model attribution (not measured actual material-issue activity).
  SELECT m.product_id,
         sum(m.monthly_sku_allocation_amount *
             w.rm_workload_units / nullif(w.unified_workload_units, 0))
           / nullif(sum(w.monthly_sku_base_qty), 0) AS rm_stores_rate,
         count(*) filter (
           where w.unified_workload_units <= 0
              or w.monthly_sku_base_qty is null
              or w.monthly_sku_base_qty <= 0
              or m.allocation_status <> 'READY'
              or w.allocation_status <> 'READY'
         ) AS invalid_stores_rows
  FROM costing.sku_materials_stores_allocation_snapshot m
  JOIN costing.sku_materials_stores_workload_snapshot w
    ON w.refresh_run_id=m.refresh_run_id AND w.sku_id=m.sku_id
  JOIN params ON m.refresh_run_id=params.approved_cost_run_id
  GROUP BY m.product_id
),
product_rates AS (
  SELECT p.id AS product_id,
         p.uom_base AS base_uom,
         CASE WHEN rm.rm_rate > 0
                   AND rm.rm_rate = rm.max_rm_rate
                   AND l.labour_rate >= 0
                   AND o.overhead_rate >= 0
                   AND o.overhead_rate = o.max_overhead_rate
                   AND q.qc_rate >= 0
                   AND c.conversion_rate >= 0
                   AND c.conversion_rate = c.max_conversion_rate
                   AND st.rm_stores_rate >= 0 AND st.invalid_stores_rows = 0
              THEN rm.rm_rate + l.labour_rate + o.overhead_rate +
                   q.qc_rate + c.conversion_rate + st.rm_stores_rate
              ELSE NULL END AS provisional_bulk_rate,
         CASE WHEN rm.rm_rate IS NULL OR rm.rm_rate <= 0 THEN 'NO_APPROVED_RATE'
              WHEN rm.rm_rate <> rm.max_rm_rate THEN 'RM_RATE_CONFLICT'
              WHEN l.labour_rate IS NULL OR l.labour_rate < 0 THEN 'INVALID_LABOUR'
              WHEN o.overhead_rate IS NULL OR o.overhead_rate < 0 OR o.overhead_rate <> o.max_overhead_rate THEN 'OVERHEAD_CONFLICT'
              WHEN q.qc_rate IS NULL OR q.qc_rate < 0 THEN 'INVALID_QC'
              WHEN c.conversion_rate IS NULL OR c.conversion_rate < 0 OR c.conversion_rate <> c.max_conversion_rate THEN 'CONVERSION_CONFLICT'
              WHEN st.rm_stores_rate IS NULL OR st.rm_stores_rate < 0 OR st.invalid_stores_rows <> 0 THEN 'STORES_RM_ALLOCATION_UNVERIFIED'
              ELSE 'PROVISIONAL_STAGE_SCOPE' END AS rate_status
  FROM public.products p
  LEFT JOIN rm ON rm.product_id=p.id
  LEFT JOIN manufacturing_labour l ON l.product_id=p.id
  LEFT JOIN route_overhead o ON o.product_id=p.id
  LEFT JOIN quality_control q ON q.product_id=p.id
  LEFT JOIN material_conversion c ON c.product_id=p.id
  LEFT JOIN materials_stores_rm st ON st.product_id=p.id
),
live_plan AS (
  SELECT p.product_id, p.final_make_qty AS quantity_base, pr.uom_base AS base_uom
  FROM public.v_product_bulk_consolidated_effective p
  JOIN public.products pr ON pr.id=p.product_id
  JOIN params ON params.report_month=p.month_start
  WHERE p.final_make_qty > 0
),
plan_lines AS (
  SELECT p.*,r.provisional_bulk_rate,
         CASE WHEN p.base_uom=r.base_uom AND r.provisional_bulk_rate IS NOT NULL
              THEN p.quantity_base*r.provisional_bulk_rate ELSE NULL END AS covered_value
  FROM live_plan p LEFT JOIN product_rates r USING(product_id)
),
-- A source ledger row is the event identity. Receipt date does not prove
-- formal completed_on. Do not interpret 'Done' rows as distinct completed batches.
receipt_events AS (
  SELECT l.id AS ledger_event_id,l.product_id,l.qty_base,l.uom,
         (l.movement_date AT TIME ZONE 'Asia/Kolkata')::date AS receipt_date
  FROM public.fg_bulk_stock_ledger l
  JOIN params ON (l.movement_date AT TIME ZONE 'Asia/Kolkata')::date >= params.report_month
             AND (l.movement_date AT TIME ZONE 'Asia/Kolkata')::date < least(params.inclusive_report_cutoff + 1, (params.report_month + interval '1 month')::date)
  WHERE l.source_table='daily_work_log'
    AND l.reason_code='FG bulk storage'
    AND l.qty_base>0
),
receipt_lines AS (
  SELECT e.*,r.provisional_bulk_rate,r.rate_status,
         CASE WHEN e.uom=r.base_uom AND r.provisional_bulk_rate IS NOT NULL
              THEN e.qty_base*r.provisional_bulk_rate ELSE NULL END AS covered_value
  FROM receipt_events e LEFT JOIN product_rates r USING(product_id)
),
transfer_lines AS (
  SELECT t.book_transfer_value,t.tally_total_amount,t.recon_status,t.valuation_status,t.exists_in_tally
  FROM public.v_fg_transfer_reconciliation t
  JOIN params ON t.transfer_date>=params.report_month
             AND t.transfer_date<least(params.inclusive_report_cutoff + 1, (params.report_month+interval '1 month')::date)
)
SELECT
  'LIVE_INDICATIVE_NOT_FROZEN'::text AS plan_status,
  'RM_STORES_MODEL_ATTRIBUTION_PROPOSED_NOT_APPROVED'::text AS monetary_status,
  (SELECT approved_cost_run_id FROM params) AS reference_cost_run_id,
  (SELECT inclusive_report_cutoff FROM params) AS report_cutoff,
  'COVERED_SUBTOTAL_ONLY'::text AS monetary_completeness,
  (SELECT count(*) FROM plan_lines) AS plan_product_count,
  (SELECT count(*) FROM plan_lines WHERE covered_value IS NULL) AS unvalued_plan_products,
  (SELECT sum(covered_value) FROM plan_lines) AS plan_covered_subtotal,
  (SELECT count(*) FROM receipt_lines) AS receipt_event_count,
  (SELECT count(*) FROM receipt_lines WHERE covered_value IS NULL) AS unvalued_receipts,
  (SELECT sum(covered_value) FROM receipt_lines) AS receipt_covered_subtotal,
  (SELECT count(*) FROM transfer_lines) AS transfer_event_count,
  (SELECT sum(book_transfer_value) FROM transfer_lines) AS tally_book_transfer_value,
  (SELECT count(*) FROM transfer_lines WHERE book_transfer_value IS NULL) AS transfer_unvalued_count,
  (SELECT count(*) FROM transfer_lines
    WHERE recon_status IS DISTINCT FROM 'MATCHED'
       OR valuation_status IS DISTINCT FROM 'OK'
       OR exists_in_tally IS DISTINCT FROM true) AS transfer_exception_count,
  NULL::numeric AS completed_reference_value,
  NULL::numeric AS achievement_pct,
  'NOT_COMPARABLE'::text AS achievement_status;
-- End SELECT-only proposal. No SQL was executed or applied by creating this file.
