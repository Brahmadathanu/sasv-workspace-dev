-- MUTANT (self-test only, must FAIL parity): drops one row
SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(:'period'::date, :lim) OFFSET 1
