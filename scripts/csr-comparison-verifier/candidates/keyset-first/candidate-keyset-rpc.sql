-- KEYSET-FIRST CANDIDATE read (offline fixture only). Requires --candidate-function-sql candidates/keyset-first/candidate-function.sql.
-- psql variables: :period, :lim.
SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped_keyset_v1(:'period'::date, :lim)
