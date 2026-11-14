\timing on
\pset pager off
\echo 'ORIGINAL view, Nov, 6-column projection (client-side narrowing proxy), 3 runs'
SELECT count(*) FROM (SELECT product_name, sku_column_label, manufacturing_cop, previous_month_manufacturing_cop, internal_loaded_cost, profit_value_ik FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start='2026-11-01' ORDER BY product_name, sku_column_label LIMIT 2000) x \watch c=3 i=0
