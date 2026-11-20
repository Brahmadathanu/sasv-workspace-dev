-- REVIEW ONLY: DO NOT EXECUTE OR APPLY. MIS-G7 PHASE 1 / PROPOSAL.
-- Requires separate owner authorization, independent SQL syntax/EXPLAIN and role testing.
-- Additive preview only; no existing MIS objects or costing policy are modified.
-- This does NOT implement frozen plan or formal completed production.
--
-- A deliberately narrow public aggregate gateway is SECURITY DEFINER because
-- authenticated users have NO SELECT on costing snapshots. SECURITY INVOKER
-- cannot be used here without introducing a private read model + its own RLS.
-- On installation, owner and execute grants MUST be reviewed/verified.
BEGIN;
CREATE FUNCTION public.get_mis_production_preview_v1(
  p_report_month date,
  p_as_of_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  v_month date;
  v_cutoff date;
  v_run bigint;
  v_valuation date;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.app_has_permission('executive-mis-dashboard','view') THEN
    RAISE EXCEPTION 'MIS view permission required' USING ERRCODE = '42501';
  END IF;
  IF p_report_month IS NULL OR p_report_month <> date_trunc('month',p_report_month::timestamp)::date THEN
    RAISE EXCEPTION 'report month must be the first of the month' USING ERRCODE = '22023';
  END IF;
  v_month := p_report_month;
  v_cutoff := least(
    coalesce(p_as_of_date, (now() at time zone 'Asia/Kolkata')::date),
    (v_month + interval '1 month - 1 day')::date
  );
  IF v_cutoff < v_month THEN
    RAISE EXCEPTION 'as-of date before report month' USING ERRCODE = '22023';
  END IF;
  -- Adjacent previous month: do not accept a draft or arbitrary client run ID.
  SELECT s.approved_run_id,s.approved_run_valuation_date
    INTO v_run,v_valuation
  FROM costing.v_costing_period_run_status s
  WHERE s.period_start = (v_month - interval '1 month')::date
    AND s.approved_run_id IS NOT NULL;
  IF v_run IS NULL THEN
    RETURN jsonb_build_object(
      'report_month',v_month,'as_of_date',v_cutoff,
      'status','NO_PREVIOUS_MONTH_APPROVED_COST','plan_status','LIVE_INDICATIVE',
      'completed_reference_value',NULL,'plan_achievement_pct',NULL,
      'comparability','NOT_COMPARABLE'
    );
  END IF;

  WITH
  rm AS (
    SELECT product_id,min(rm_cost_per_base_unit) r,max(rm_cost_per_base_unit) max_r
    FROM costing.sku_material_cost_snapshot WHERE refresh_run_id=v_run GROUP BY product_id
  ),
  labour AS (
    SELECT product_id,
           product_direct_labour_allocation/nullif(monthly_product_base_qty,0) r
    FROM costing.product_direct_labour_workload_snapshot WHERE refresh_run_id=v_run
  ),
  production_oh AS (
    SELECT product_id,min(production_overhead_cost_per_base_uom) r,
           max(production_overhead_cost_per_base_uom) max_r
    FROM costing.sku_production_overhead_allocation_snapshot
    WHERE refresh_run_id=v_run GROUP BY product_id
  ),
  qc AS (
    SELECT product_id,qc_cost_per_product_base_uom r
    FROM costing.product_qc_allocation_snapshot WHERE refresh_run_id=v_run
  ),
  conv AS (
    SELECT product_id,min(internal_conversion_cost_per_product_base_uom) r,
           max(internal_conversion_cost_per_product_base_uom) max_r
    FROM costing.sku_internal_material_conversion_snapshot
    WHERE refresh_run_id=v_run GROUP BY product_id
  ),
  stores AS (
    SELECT a.product_id,
           sum(a.monthly_sku_allocation_amount*w.rm_workload_units /
                nullif(w.unified_workload_units,0)) /
             nullif(sum(w.monthly_sku_base_qty),0) r,
           count(*) filter (where a.allocation_status <> 'READY'
             or w.allocation_status <> 'READY' or w.monthly_sku_base_qty <= 0
             or w.unified_workload_units <= 0 or w.rm_workload_units < 0
             or w.pm_workload_units < 0
             or abs(w.rm_workload_units+w.pm_workload_units-w.unified_workload_units)>0.000001)
             invalid_count
    FROM costing.sku_materials_stores_allocation_snapshot a
    JOIN costing.sku_materials_stores_workload_snapshot w
      ON w.refresh_run_id=a.refresh_run_id AND w.sku_id=a.sku_id
    WHERE a.refresh_run_id=v_run
    GROUP BY a.product_id
  ),
  rate AS (
    SELECT p.id product_id,p.uom_base base_uom,
      CASE WHEN rm.r>0 AND rm.r=rm.max_r AND l.r>=0
         AND oh.r>=0 AND oh.r=oh.max_r AND q.r>=0
         AND c.r>=0 AND c.r=c.max_r AND s.r>=0 AND s.invalid_count=0
        THEN rm.r+l.r+oh.r+q.r+c.r+s.r ELSE NULL END per_base
    FROM public.products p
    LEFT JOIN rm ON rm.product_id=p.id
    LEFT JOIN labour l ON l.product_id=p.id
    LEFT JOIN production_oh oh ON oh.product_id=p.id
    LEFT JOIN qc q ON q.product_id=p.id
    LEFT JOIN conv c ON c.product_id=p.id
    LEFT JOIN stores s ON s.product_id=p.id
  ),
  plan AS (
    SELECT pl.product_id,pl.final_make_qty qty,p.uom_base uom
    FROM public.v_product_bulk_consolidated_effective pl
    JOIN public.products p ON p.id=pl.product_id
    WHERE pl.month_start=v_month AND pl.final_make_qty>0
  ),
  priced_plan AS (
    SELECT pl.*, CASE WHEN pl.uom=r.base_uom THEN pl.qty*r.per_base END value
    FROM plan pl LEFT JOIN rate r ON r.product_id=pl.product_id
  ),
  receipt AS (
    SELECT l.id,l.product_id,l.qty_base qty,l.uom
    FROM public.fg_bulk_stock_ledger l
    WHERE l.movement_date >= v_month::timestamp AT TIME ZONE 'Asia/Kolkata'
      AND l.movement_date < (v_cutoff+1)::timestamp AT TIME ZONE 'Asia/Kolkata'
      AND l.source_table='daily_work_log'
      AND l.reason_code='FG bulk storage' AND l.qty_base>0
  ),
  priced_receipt AS (
    SELECT rec.*, CASE WHEN rec.uom=r.base_uom THEN rec.qty*r.per_base END value
    FROM receipt rec LEFT JOIN rate r ON r.product_id=rec.product_id
  ),
  -- Historical corrections exist. If an update/delete is present during the
  -- report range, withhold receipt monetary subtotal pending event lineage parity.
  correction AS (
    SELECT count(*) n FROM public.fg_bulk_stock_ledger l
    WHERE l.movement_date >= v_month::timestamp AT TIME ZONE 'Asia/Kolkata'
      AND l.movement_date < (v_cutoff+1)::timestamp AT TIME ZONE 'Asia/Kolkata'
      AND l.source_table='daily_work_log'
      AND l.reason_code IN ('FG bulk storage (update)',
           'FG bulk storage (delete)','FG bulk storage (In Storage)')
  ),
  transfer AS (
    SELECT t.book_transfer_value,t.recon_status,t.valuation_status,t.exists_in_tally
    FROM public.v_fg_transfer_reconciliation t
    WHERE t.transfer_date>=v_month AND t.transfer_date<=v_cutoff
  )
  SELECT jsonb_build_object(
      'report_month',v_month,'as_of_date',v_cutoff,
      'approved_cost_run_id',v_run,'approved_cost_valuation_date',v_valuation,
      'status','PREVIEW_NOT_A_FROZEN_BASELINE','plan_status','LIVE_INDICATIVE',
      'component_policy','RM_STORES_V1_PM_EXCLUDED',
      'planned_product_count',(SELECT count(*) FROM priced_plan),
      'planned_unvalued_count',(SELECT count(*) FROM priced_plan WHERE value IS NULL),
      'planned_reference_covered_value',(SELECT sum(value) FROM priced_plan),
      'receipt_event_count',(SELECT count(*) FROM priced_receipt),
      'receipt_unvalued_count',(SELECT count(*) FROM priced_receipt WHERE value IS NULL),
      'receipt_correction_event_count',(SELECT n FROM correction),
      'receipt_reference_covered_value',
        CASE WHEN (SELECT n FROM correction)=0
             THEN (SELECT sum(value) FROM priced_receipt) ELSE NULL END,
      'receipt_value_status',
        CASE WHEN (SELECT n FROM correction)>0 THEN 'BLOCKED_CORRECTION_LINEAGE'
             WHEN (SELECT count(*) FROM priced_receipt WHERE value IS NULL)>0
             THEN 'PARTIAL_COVERAGE' ELSE 'COVERED_SUBTOTAL' END,
      'tally_fg_transfer_book_value',(SELECT sum(book_transfer_value) FROM transfer),
      'transfer_count',(SELECT count(*) FROM transfer),
      'transfer_exception_count',(SELECT count(*) FROM transfer
        WHERE recon_status IS DISTINCT FROM 'MATCHED'
          OR valuation_status IS DISTINCT FROM 'OK'
          OR exists_in_tally IS DISTINCT FROM true
          OR book_transfer_value IS NULL),
      'completed_reference_value',NULL,
      'completed_status','NOT_VERIFIED',
      'plan_achievement_pct',NULL,
      'comparability','NOT_COMPARABLE'
  ) INTO v_result;
  RETURN v_result;
END;
$function$;
-- PostgreSQL grants EXECUTE to PUBLIC by default. Revoke in same transaction.
REVOKE ALL ON FUNCTION public.get_mis_production_preview_v1(date,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mis_production_preview_v1(date,date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_mis_production_preview_v1(date,date) TO authenticated;
COMMIT;
-- Rollback after independent authorization/if never published:
-- BEGIN; REVOKE ALL ON FUNCTION public.get_mis_production_preview_v1(date,date)
-- FROM PUBLIC, anon, authenticated;
-- DROP FUNCTION IF EXISTS public.get_mis_production_preview_v1(date,date);
-- COMMIT;
-- Do not execute this proposal without owner-authorized change gate.
