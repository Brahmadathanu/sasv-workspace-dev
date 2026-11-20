\set ON_ERROR_STOP on
\timing on
\pset pager off
\echo '### fresh-stats (ANALYZE done) wall-clock, count(*) over full 63-col result, 3 runs each'
ANALYZE costing.cost_sheet_line_monthly_snapshot;
\echo 'ORIGINAL view, Nov'
SELECT count(*) FROM (SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start='2026-11-01' ORDER BY product_name, sku_column_label LIMIT 2000) x \watch c=3 i=0
\echo 'SCOPED, Nov'
SELECT count(*) FROM (SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000)) x \watch c=3 i=0
\echo 'ORIGINAL view, Oct'
SELECT count(*) FROM (SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start='2026-10-01' ORDER BY product_name, sku_column_label LIMIT 2000) x \watch c=3 i=0
\echo 'SCOPED, Oct'
SELECT count(*) FROM (SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-10-01',2000)) x \watch c=3 i=0
