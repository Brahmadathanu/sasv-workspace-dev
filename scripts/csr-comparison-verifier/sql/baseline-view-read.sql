-- BASELINE path = exactly what the flag-OFF client reads: governed view, period filter, product/label order, cap.
-- psql variables: :period (text, first of month), :lim (integer). Single SELECT statement, no trailing semicolon needed.
SELECT * FROM costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed
WHERE snapshot_period_start = :'period'::date
ORDER BY product_name ASC, sku_column_label ASC
LIMIT :lim
