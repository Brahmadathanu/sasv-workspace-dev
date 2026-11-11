-- MUTANT (self-test only, must FAIL parity): duplicates the first row
(SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(:'period'::date, :lim)) UNION ALL (SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(:'period'::date, :lim) LIMIT 1)
