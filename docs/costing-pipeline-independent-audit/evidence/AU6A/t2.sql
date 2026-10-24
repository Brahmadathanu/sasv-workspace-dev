\set ON_ERROR_STOP 1
select 'status diffs only REVIEW->READY' chk, count(*) filter (where not (l.workload_status like 'REVIEW%' and n.workload_status='READY')) bad
 from costing.product_production_overhead_workload_snapshot n join costing.live_product_production_overhead_workload_snapshot l using(product_id) where n.refresh_run_id=901 and n.workload_status is distinct from l.workload_status;
update costing.qc_batch_true_switch set is_enabled=true;
update costing.route_batch_scaling_switch set is_enabled=true;
select costing.t_mkrun(902,false);
select costing.t_chain(902)->'poh'->>'route_batch_scaling' mode;
select costing.t_mkrun(903,true);
select (costing.t_chain(903)->'poh')->>'allocated_pool_amount' poh_alloc;
select refresh_run_id, allocation_pool, round(pool_amount,2) pool, round(absorbed_at_standard,6) absorbed, round(variance_amount,9) var, round(rate_used,4) rate, products_batch_true, products_current_method
  from costing.batch_true_absorption_variance where refresh_run_id in (902,903) order by 1,2;
select refresh_run_id, allocation_pool, count(*) n, count(*) filter (where scaled_factor<>raw_factor) scaled, round(min(reference_batch_size),2) min_ref, round(max(reference_batch_size),2) max_ref
  from costing.route_batch_scaling_snapshot where refresh_run_id in (902,903) group by 1,2 order by 1,2;
-- DL vs POH reference consistency
select count(*) ref_mismatch from costing.route_batch_scaling_snapshot d join costing.route_batch_scaling_snapshot p on p.refresh_run_id=d.refresh_run_id and p.product_id=d.product_id
 where d.allocation_pool='MANUFACTURING_LABOUR' and p.allocation_pool='PRODUCTION_OVERHEAD' and d.reference_batch_size is distinct from p.reference_batch_size;
-- key products
select s.refresh_run_id r, s.product_id, left(w.product_name,26) n, w.preferred_batch_size bs, round(s.reference_batch_size,2) ref, s.raw_factor, round(s.scaled_factor,4) scaled,
       round(w.workload_units,4) wl
  from costing.route_batch_scaling_snapshot s join costing.product_production_overhead_workload_snapshot w on w.refresh_run_id=s.refresh_run_id and w.product_id=s.product_id
 where s.refresh_run_id=903 and s.allocation_pool='PRODUCTION_OVERHEAD' and s.product_id in (468,1340,54,685,695) order by 2;
-- SKU totals per run: conversion (DL + POH + QC) for key SKUs
with c as (select d.refresh_run_id r, d.sku_id, d.direct_labour_cost_per_sku dl, p.production_overhead_cost_per_sku poh, q.quality_control_overhead_cost_per_sku qc
  from costing.sku_direct_labour_allocation_snapshot d join costing.sku_production_overhead_allocation_snapshot p using(refresh_run_id,sku_id) join costing.sku_qc_allocation_snapshot q using(refresh_run_id,sku_id)
  where d.refresh_run_id in (901,902,903))
select sku_id, string_agg(r||':'||round(dl,2)||'/'||round(poh,2)||'/'||round(qc,2), '  ' order by r) dl_poh_qc from c where sku_id in (865,878,1769,1770,1792,879,988,1797) group by 1 order by 1;
