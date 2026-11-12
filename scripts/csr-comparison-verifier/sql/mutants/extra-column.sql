-- MUTANT (self-test only, must FAIL parity): extra column (not 63)
SELECT r.*, 1 AS extra FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(:'period'::date, :lim) r
