-- MUTANT (self-test only, must FAIL parity): cap off by one
SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(:'period'::date, :lim) LIMIT 1999
