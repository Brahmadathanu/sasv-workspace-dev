select json_build_object(
 'product_production_overhead_workload_snapshot',(select json_agg(row_to_json(x)) from costing.product_production_overhead_workload_snapshot x where refresh_run_id=126),
 'product_production_overhead_step_snapshot',(select json_agg(row_to_json(x)) from costing.product_production_overhead_step_snapshot x where refresh_run_id=126),
 'sku_production_overhead_allocation_snapshot',(select json_agg(row_to_json(x)) from costing.sku_production_overhead_allocation_snapshot x where refresh_run_id=126),
 'product_direct_labour_workload_snapshot',(select json_agg(row_to_json(x)) from costing.product_direct_labour_workload_snapshot x where refresh_run_id=126),
 'product_direct_labour_step_snapshot',(select json_agg(row_to_json(x)) from costing.product_direct_labour_step_snapshot x where refresh_run_id=126),
 'sku_packing_labour_workload_snapshot',(select json_agg(row_to_json(x)) from costing.sku_packing_labour_workload_snapshot x where refresh_run_id=126),
 'sku_direct_labour_allocation_snapshot',(select json_agg(row_to_json(x)) from costing.sku_direct_labour_allocation_snapshot x where refresh_run_id=126),
 'batch_true_absorption_variance',(select json_agg(row_to_json(x)) from costing.batch_true_absorption_variance x where refresh_run_id=126),
 'sku_sales_allocation_basis_snapshot',(select json_agg(row_to_json(x)) from costing.sku_sales_allocation_basis_snapshot x where refresh_run_id=126)
)
