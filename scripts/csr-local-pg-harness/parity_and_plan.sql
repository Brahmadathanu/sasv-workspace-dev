\set ON_ERROR_STOP on
\pset pager off
\echo '== 1. PARITY: original public view vs scoped RPC, all 63 columns, both EXCEPT directions =='
DO $$
DECLARE p date; a bigint; b bigint; d1 bigint; d2 bigint;
BEGIN
  FOREACH p IN ARRAY ARRAY[date '2026-09-01', date '2026-10-01', date '2026-11-01', date '2025-11-01', date '2026-12-01', date '2024-01-01'] LOOP
    SELECT count(*) INTO a FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start = p;
    SELECT count(*) INTO b FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(p, 2000);
    EXECUTE format('SELECT count(*) FROM (SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start=%L EXCEPT SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(%L,2000)) x', p, p) INTO d1;
    EXECUTE format('SELECT count(*) FROM (SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(%L,2000) EXCEPT SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start=%L) x', p, p) INTO d2;
    RAISE NOTICE 'period % : view rows=% rpc rows=% only_in_view=% only_in_rpc=% -> %', p, a, b, d1, d2, CASE WHEN a=b AND d1=0 AND d2=0 THEN 'PARITY' ELSE 'MISMATCH' END;
    IF NOT (a=b AND d1=0 AND d2=0) THEN RAISE EXCEPTION 'PARITY FAILURE for period %', p; END IF;
  END LOOP;
END $$;
\echo '== 1b. Ordering parity (client order product_name, sku_column_label; RPC adds sku_id tie-break) =='
SELECT count(*) AS order_mismatch_rows FROM (
  SELECT row_number() OVER (ORDER BY product_name, sku_column_label, sku_id) rn, sku_id FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start='2026-11-01') v
JOIN (SELECT row_number() OVER () rn, sku_id FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000)) r USING (rn) WHERE v.sku_id<>r.sku_id;
\echo '== 1c. Governed-run isolation: superseded Nov run 148 must not leak; prev month = approved run 143, no Nov-2025 =='
SELECT snapshot_refresh_run_id, snapshot_selection_basis, previous_month_refresh_run_id, previous_month_selection_basis, previous_year_refresh_run_id, count(*) FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000) GROUP BY 1,2,3,4,5;
\echo '== 2. PLAN/TIMING (LOCAL SYNTHETIC; relative only, NOT production latency) =='
\echo '-- original, STALE stats (Nov absent from pg_stats)'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON) SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start='2026-11-01' ORDER BY product_name, sku_column_label LIMIT 2000;
\echo '-- scoped RPC body, STALE stats'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON) SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000);
