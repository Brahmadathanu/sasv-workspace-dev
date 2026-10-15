-- A3 run119 batch/workload provenance for named products/SKUs + portfolio rounding distribution (SELECT-only)
with oh as (select * from costing.product_production_overhead_workload_snapshot where refresh_run_id=119),
dl as (select * from costing.product_direct_labour_workload_snapshot where refresh_run_id=119)
select json_build_object(
'products',(select json_agg(x) from (select oh.product_id, oh.product_name, oh.product_base_uom uom, oh.preferred_batch_size pbs, round(oh.monthly_product_base_qty,4) mqty, oh.monthly_driver_status drv, round(oh.monthly_batch_equivalents,4) mbe, oh.rounded_batch_count rbc, oh.route_factor, round(oh.workload_units,3) oh_wu, oh.workload_status oh_st, dl.standard_batch_count dl_sbc, dl.direct_labour_route_intensity dl_int, round(dl.direct_labour_workload_units,3) dl_wu, round(dl.product_direct_labour_allocation,2) dl_alloc, dl.workload_status dl_st, dl.workload_reason_code dl_rc, oh.workload_reason_code oh_rc from oh join dl using (product_id) where oh.product_id in (184,783,190,1350)) x),
'skus',(select json_agg(x) from (select c.sku_id, c.product_id, c.pack_size, c.pack_uom, round(c.material_cost_per_sku,4) mat, round(c.direct_labour_cost_per_sku,4) dl, round(c.production_overhead_cost_per_sku,4) poh, round(c.manufacturing_cop_per_sku,4) cop, c.manufacturing_cop_status st, round(p.monthly_sku_base_qty,4) sku_mqty, round(p.sku_within_product_share,4) share, p.allocation_reason_code rc from costing.sku_manufacturing_cop_snapshot c left join costing.sku_production_overhead_allocation_snapshot p on p.refresh_run_id=119 and p.sku_id=c.sku_id where c.refresh_run_id=119 and c.sku_id in (193,988,207,208,209,1798)) x),
'portfolio',(select json_build_object('products',count(*),'ready',count(*) filter (where workload_status='READY'),
  'rbc_gt_mbe_x10',count(*) filter (where rounded_batch_count>0 and monthly_batch_equivalents>0 and rounded_batch_count>=10*monthly_batch_equivalents),
  'rbc_gt_mbe_x2',count(*) filter (where rounded_batch_count>0 and monthly_batch_equivalents>0 and rounded_batch_count>=2*monthly_batch_equivalents),
  'sum_mbe',round(sum(monthly_batch_equivalents),2),'sum_rbc',sum(rounded_batch_count),
  'wu_total',round(sum(workload_units),2),
  'wu_in_x10_products',round(sum(workload_units) filter (where rounded_batch_count>0 and monthly_batch_equivalents>0 and rounded_batch_count>=10*monthly_batch_equivalents),2),
  'statuses',(select json_object_agg(workload_status,n) from (select workload_status,count(*) n from oh group by 1) s)) from oh),
'pools',(select json_build_object('dl_pool',max(direct_labour_pool_amount),'dl_alloc_sum',round(sum(product_direct_labour_allocation),2)) from dl),
'sku_cop_sums',(select json_build_object('skus',count(*),'poh_x_qty',round(sum(production_overhead_cost_per_sku*0),2)) from costing.sku_manufacturing_cop_snapshot where refresh_run_id=119)
);
