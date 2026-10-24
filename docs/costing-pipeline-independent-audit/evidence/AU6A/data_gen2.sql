select json_build_object(
 'costing_refresh_run',(select json_agg(row_to_json(x)) from costing.costing_refresh_run x where id=126),
 'costing_refresh_run_stage',(select json_agg(row_to_json(x)) from costing.costing_refresh_run_stage x where refresh_run_id=126),
 'cost_pool_monthly_snapshot',(select json_agg(row_to_json(x)) from costing.cost_pool_monthly_snapshot x where refresh_run_id=126),
 'direct_labour_component_pool_snapshot',(select json_agg(row_to_json(x)) from costing.direct_labour_component_pool_snapshot x where refresh_run_id=126),
 'batch_true_standard_switch',(select json_agg(row_to_json(x)) from costing.batch_true_standard_switch x),
 'production_overhead_workload_policy',(select json_agg(row_to_json(x)) from costing.production_overhead_workload_policy x),
 'production_overhead_scope_factor',(select json_agg(row_to_json(x)) from costing.production_overhead_scope_factor x),
 'production_overhead_behaviour_factor',(select json_agg(row_to_json(x)) from costing.production_overhead_behaviour_factor x),
 'production_overhead_resource_factor',(select json_agg(row_to_json(x)) from costing.production_overhead_resource_factor x),
 'direct_labour_workload_policy',(select json_agg(row_to_json(x)) from costing.direct_labour_workload_policy x),
 'sales_allocation_default_policy',(select json_agg(row_to_json(x)) from costing.sales_allocation_default_policy x),
 'production_route_family',(select json_agg(row_to_json(x)) from costing.production_route_family x),
 'production_batch_size_ref',(select json_agg(row_to_json(x)) from public.production_batch_size_ref x),
 'packresp',(select json_agg(json_build_object('route_family_id',f.route_family_id,'rule_id',pr.rule_id,'responsibility_code',pr.responsibility_code,'resolution_source',pr.resolution_source,'rationale',pr.rationale))
             from (select distinct route_family_id from costing.product_direct_labour_workload_snapshot where refresh_run_id=126) f cross join lateral costing.fn_resolve_packing_labour_responsibility(f.route_family_id, date '2026-10-16') pr),
 'arstatus',(select json_agg(json_build_object('id',b.id,'r',to_jsonb(ar))) from costing.sku_sales_allocation_basis_snapshot b cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) ar where b.refresh_run_id=126),
 'policy_fns',(select json_agg(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='costing' and p.proname in ('fn_resolve_production_overhead_workload_policy','fn_resolve_direct_labour_workload_policy','fn_default_volume_cap','fn_batch_true_effective','fn_enforce_mutable_refresh_run_snapshot','fn_guard_designated_run_rows','fn_guard_snapshot_truncate','fn_immutable_production_overhead_snapshot','fn_stamp_validate_direct_labour_pool_lineage')),
 'sigs',(select json_agg(json_build_object('f',p.proname,'args',pg_get_function_arguments(p.oid),'ret',pg_get_function_result(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='costing' and p.proname in ('fn_resolve_packing_labour_responsibility','fn_sales_allocation_quantity_driver_review_status','fn_total_manufacturing_product_demand_as_of')),
 'triggers',(select json_agg(pg_get_triggerdef(t.oid)) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname='costing' and c.relname in ('product_production_overhead_workload_snapshot','product_production_overhead_step_snapshot','sku_production_overhead_allocation_snapshot','product_direct_labour_workload_snapshot','product_direct_labour_step_snapshot','sku_packing_labour_workload_snapshot','sku_direct_labour_allocation_snapshot','product_qc_allocation_snapshot','sku_qc_allocation_snapshot','batch_true_absorption_variance'))
)
