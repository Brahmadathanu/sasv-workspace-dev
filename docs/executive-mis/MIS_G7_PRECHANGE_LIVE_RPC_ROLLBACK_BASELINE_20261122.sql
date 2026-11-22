-- READ ONLY ARCHIVE: live pg_get_functiondef baseline captured 22 Nov 2026 IST.
-- DO NOT APPLY without separate owner authorization. Preserve as exact rollback body.
CREATE OR REPLACE FUNCTION public.get_mis_production_value_summary(p_report_month date, p_as_of_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_month date;
  v_cutoff date;
  v_run bigint;
  v_valuation date;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.app_has_permission('module:executive-mis-dashboard','view') THEN
    RAISE EXCEPTION 'MIS view permission required' USING ERRCODE = '42501';
  END IF;
  IF p_report_month IS NULL OR p_report_month <> date_trunc('month',p_report_month::timestamp)::date THEN
    RAISE EXCEPTION 'report month must be the first of the month' USING ERRCODE = '22023';
  END IF;
  v_month := p_report_month;
  v_cutoff := least(
    coalesce(p_as_of_date, (now() at time zone 'Asia/Kolkata')::date),
    (now() at time zone 'Asia/Kolkata')::date,
    (v_month + interval '1 month - 1 day')::date
  );
  IF v_cutoff < v_month THEN
    RAISE EXCEPTION 'as-of date before report month' USING ERRCODE = '22023';
  END IF;
  -- Canonical module permission target is module:executive-mis-dashboard
  -- (verified in public.user_permissions_canonical).
  -- Adjacent previous month: do not accept a draft or arbitrary client run ID.
  -- The bounded preview is not a frozen valuation snapshot: historical
  -- source adjustments after the cutoff are NOT automatically reconstructed.
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
  -- Live product planning view was measured >6s in read-only EXPLAIN ANALYZE
  -- under a bounded test; invoking it makes the authenticated 8s RPC time out.
  -- G7 does not yet have an approved frozen plan. Do NOT substitute a stale
  -- forecast or an ungoverned override sum. Therefore publish plan as NULL.
  -- When the governed sealed plan exists, use that immutable read model here.
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
  -- The full reconciliation view requires very expensive historical aggregation.
  -- Use the latest complete Tally voucher snapshot observed by requested as-of.
  -- This yields Tally book amount, NOT log-matching/valuation exception evidence.
  transfer_snapshot AS (
    SELECT max(t.as_of_date) as_of_date
    FROM public.tally_fg_transfer_voucher_lines t
    WHERE t.as_of_date<=v_cutoff
  ),
  transfer AS (
    SELECT t.transfer_amount book_transfer_value,t.voucher_date,
           t.as_of_date
    FROM public.tally_fg_transfer_voucher_lines t
    JOIN transfer_snapshot s ON t.as_of_date=s.as_of_date
    WHERE t.voucher_date>=v_month AND t.voucher_date<=v_cutoff
  )
  SELECT jsonb_build_object(
      'report_month',v_month,'as_of_date',v_cutoff,
      'approved_cost_run_id',v_run,'approved_cost_valuation_date',v_valuation,
      'status','BULK_RECEIPT_COVERED_REFERENCE','plan_status','UNAVAILABLE_PENDING_FROZEN_PLAN',
      'component_policy','RM_STORES_PM_EXCLUDED',
      'planned_product_count',NULL,
      'planned_unvalued_count',NULL,
      'planned_reference_covered_value',NULL,
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
      'transfer_line_count',(SELECT count(*) FROM transfer),
      'tally_snapshot_as_of',(SELECT as_of_date FROM transfer_snapshot),
      'transfer_reconciliation_status','NOT_CHECKED_BY_BOOK_TOTAL',
      'transfer_missing_amount_lines',(SELECT count(*) FROM transfer
        WHERE book_transfer_value IS NULL),
      'completed_reference_value',NULL,
      'completed_status','NOT_VERIFIED',
      'plan_achievement_pct',NULL,
      'comparability','NOT_COMPARABLE'
  ) INTO v_result;
  RETURN v_result;
END;
$function$
