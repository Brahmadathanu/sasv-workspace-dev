-- MUTANT (self-test only, must FAIL parity): wrong order
SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(:'period'::date, :lim) ORDER BY product_name DESC, sku_column_label DESC
