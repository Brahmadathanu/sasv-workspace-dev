-- MUTANT (self-test only, must FAIL parity): nulls rm_cost
SELECT (jsonb_populate_record(NULL::costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed, to_jsonb(r) || jsonb_build_object('rm_cost', NULL))).* FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(:'period'::date, :lim) r
