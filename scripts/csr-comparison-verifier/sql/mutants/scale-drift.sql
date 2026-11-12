-- MUTANT (self-test only, must FAIL parity): numerically equal but different scale (bag passes, strict text must fail)
SELECT (jsonb_populate_record(NULL::costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed, to_jsonb(r) || jsonb_build_object('manufacturing_cop', r.manufacturing_cop + 0.000))).* FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(:'period'::date, :lim) r
