-- DEFAULT CANDIDATE = the installed scoped RPC (body taken verbatim from the #278-synchronised migration).
-- Replace with any SQL file returning the same 63 columns via --candidate-sql. psql variables: :period, :lim.
SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(:'period'::date, :lim)
