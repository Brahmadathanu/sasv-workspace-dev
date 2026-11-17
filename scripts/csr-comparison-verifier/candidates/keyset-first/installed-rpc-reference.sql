-- Installed scoped RPC as comparator (same as sql/candidate-installed-rpc.sql; kept here for explicit 3-way runs).
SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(:'period'::date, :lim)
