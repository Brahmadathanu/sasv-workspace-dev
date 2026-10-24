\set ON_ERROR_STOP 1
update costing.qc_batch_true_switch set is_enabled=false;
update costing.route_batch_scaling_switch set is_enabled=false;
select costing.t_mkrun(901,false);
select costing.t_chain(901);
-- numeric comparison vs live run 126
select 'POH_W' t, count(*) n, count(*) filter (where l.product_id is null) missing,
  max(abs(coalesce(n.workload_units,0)-coalesce(l.workload_units,0))) d_wl, max(abs(coalesce(n.route_factor,0)-coalesce(l.route_factor,0))) d_rf,
  count(*) filter (where n.workload_status is distinct from l.workload_status) st_diff
 from costing.product_production_overhead_workload_snapshot n left join costing.live_product_production_overhead_workload_snapshot l using(product_id) where n.refresh_run_id=901
union all
select 'POH_SKU', count(*), count(*) filter (where l.sku_id is null), max(abs(coalesce(n.production_overhead_cost_per_sku,0)-coalesce(l.production_overhead_cost_per_sku,0))), max(abs(coalesce(n.product_production_overhead_allocation,0)-coalesce(l.product_production_overhead_allocation,0))),
  count(*) filter (where n.allocation_status is distinct from l.allocation_status)
 from costing.sku_production_overhead_allocation_snapshot n left join costing.live_sku_production_overhead_allocation_snapshot l using(sku_id) where n.refresh_run_id=901
union all
select 'DL_W', count(*), count(*) filter (where l.product_id is null), max(abs(coalesce(n.direct_labour_workload_units,0)-coalesce(l.direct_labour_workload_units,0))), max(abs(coalesce(n.product_direct_labour_allocation,0)-coalesce(l.product_direct_labour_allocation,0))),
  count(*) filter (where n.workload_status is distinct from l.workload_status)
 from costing.product_direct_labour_workload_snapshot n left join costing.live_product_direct_labour_workload_snapshot l using(product_id) where n.refresh_run_id=901
union all
select 'DL_SKU', count(*), count(*) filter (where l.sku_id is null), max(abs(coalesce(n.direct_labour_cost_per_sku,0)-coalesce(l.direct_labour_cost_per_sku,0))), max(abs(coalesce(n.packing_labour_cost_per_sku,0)-coalesce(l.packing_labour_cost_per_sku,0))),
  count(*) filter (where n.direct_labour_allocation_status is distinct from l.direct_labour_allocation_status)
 from costing.sku_direct_labour_allocation_snapshot n left join costing.live_sku_direct_labour_allocation_snapshot l using(sku_id) where n.refresh_run_id=901
union all
select 'QC_SKU', count(*), count(*) filter (where l.sku_id is null), max(abs(coalesce(n.quality_control_overhead_cost_per_sku,0)-coalesce(l.quality_control_overhead_cost_per_sku,0))), null,
  count(*) filter (where n.allocation_status is distinct from l.allocation_status)
 from costing.sku_qc_allocation_snapshot n left join costing.live_sku_qc_allocation_snapshot l using(sku_id) where n.refresh_run_id=901
union all
select 'STEPS', (select count(*) from costing.product_production_overhead_step_snapshot where refresh_run_id=901), (select count(*) from costing.live_product_production_overhead_step_snapshot),
  (select count(*) from costing.product_direct_labour_step_snapshot where refresh_run_id=901), (select count(*) from costing.live_product_direct_labour_step_snapshot), (select count(*) from costing.route_batch_scaling_snapshot where refresh_run_id=901);
select allocation_pool, round(pool_amount,2), round(absorbed_at_standard,2), variance_amount, rate_used from costing.batch_true_absorption_variance where refresh_run_id in (901) order by 1;
select allocation_pool, rate_used from costing.live_batch_true_absorption_variance order by 1;
