\set ON_ERROR_STOP 1
update costing.qc_batch_true_switch set is_enabled=true;
update costing.route_load_scaling_switch set is_enabled=true;
update costing.sku_base_quantity_exception set costing_effective_from='2026-10-01' where sku_id in (865,878);
-- 932: AU-6Q + kit + loads, old sales feed
update costing.costing_sales_feed_switch set is_enabled=false;
select costing.t_mkrun2(932); select (costing.t_chain(932)->'poh')->>'route_load_scaling' rl;
-- 933: full package
update costing.costing_sales_feed_switch set is_enabled=true;
select costing.t_mkrun2(933); select (costing.t_chain(933)->'poh')->>'route_load_scaling' rl;
select refresh_run_id, allocation_pool, round(pool_amount,2) pool, round(absorbed_at_standard,2) absorbed, round(variance_amount,9) var, round(rate_used,4) rate
  from costing.batch_true_absorption_variance where refresh_run_id in (931,932,933) order by 1,2;
select refresh_run_id, allocation_pool, count(*) n, count(*) filter (where scaled_factor<>raw_factor) loaded, count(*) filter (where charge_source<>'BATCH_SIZE_REF_AND_RM_BOM') other_src
  from costing.route_load_scaling_snapshot where refresh_run_id in (932,933) group by 1,2 order by 1,2;
select 'charge mismatch DL vs POH', count(*) from costing.route_load_scaling_snapshot d join costing.route_load_scaling_snapshot p on p.refresh_run_id=d.refresh_run_id and p.product_id=d.product_id
 where d.refresh_run_id=933 and d.allocation_pool='MANUFACTURING_LABOUR' and p.allocation_pool='PRODUCTION_OVERHEAD' and (d.solid_charge_kg is distinct from p.solid_charge_kg or d.output_charge is distinct from p.output_charge);
select monthly_driver_method, count(*) from costing.sku_sales_allocation_basis_snapshot where refresh_run_id=933 group by 1 order by 1;
select allocation_resolution_status, count(*) from costing.sku_sales_allocation_basis_snapshot where refresh_run_id=933 group by 1;
