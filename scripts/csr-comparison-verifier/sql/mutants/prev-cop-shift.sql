-- MUTANT (self-test only, must FAIL parity): perturbs previous-month cop
SELECT (jsonb_populate_record(NULL::costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed, to_jsonb(r) || jsonb_build_object('previous_month_manufacturing_cop', r.previous_month_manufacturing_cop + 1))).* FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(:'period'::date, :lim) r
