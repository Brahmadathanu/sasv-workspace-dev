select json_build_object(
 'foundation', costing.fn_preview_shared_standard_batch_route_foundation(date '2026-10-01', date '2026-10-16', 126, null),
 'dlprev', costing.fn_preview_direct_labour_shadow_workload((select policy_id from costing.product_direct_labour_workload_snapshot where refresh_run_id=126 limit 1), date '2026-10-01', date '2026-10-16', 126, null),
 'dlpolicy',(select policy_id from costing.product_direct_labour_workload_snapshot where refresh_run_id=126 limit 1)
)
