\set ON_ERROR_STOP 1
update costing.qc_batch_true_switch set is_enabled=false;
update costing.route_load_scaling_switch set is_enabled=false;
update costing.costing_sales_feed_switch set is_enabled=false;
update costing.sku_base_quantity_exception set costing_effective_from=null where sku_id in (865,878);
select costing.t_mkrun2(931);
select costing.t_chain(931) is not null ok;
select 'T1 basis vs live126' t, count(*) n, count(*) filter (where abs(coalesce(n.monthly_allocation_base_qty,-1)-coalesce(o.monthly_allocation_base_qty,-1))>1e-9 or n.monthly_driver_method is distinct from o.monthly_driver_method or n.allocation_resolution_status is distinct from o.allocation_resolution_status) diff
  from costing.sku_sales_allocation_basis_snapshot n join costing.sku_sales_allocation_basis_snapshot o on o.refresh_run_id=126 and o.sku_id=n.sku_id where n.refresh_run_id=931;
select 'T1 sku DL/POH/QC vs live126' t, count(*) n,
  max(abs(d.direct_labour_cost_per_sku-ld.direct_labour_cost_per_sku)) dl, max(abs(o.production_overhead_cost_per_sku-lo.production_overhead_cost_per_sku)) poh, max(abs(q.quality_control_overhead_cost_per_sku-lq.quality_control_overhead_cost_per_sku)) qc
 from costing.sku_direct_labour_allocation_snapshot d join costing.live_sku_direct_labour_allocation_snapshot ld using(sku_id)
 join costing.sku_production_overhead_allocation_snapshot o on o.refresh_run_id=d.refresh_run_id and o.sku_id=d.sku_id join costing.live_sku_production_overhead_allocation_snapshot lo on lo.sku_id=d.sku_id
 join costing.sku_qc_allocation_snapshot q on q.refresh_run_id=d.refresh_run_id and q.sku_id=d.sku_id join costing.live_sku_qc_allocation_snapshot lq on lq.sku_id=d.sku_id
 where d.refresh_run_id=931;
select 'T1 no AU-6L lineage' t, count(*) from costing.route_load_scaling_snapshot where refresh_run_id=931;
