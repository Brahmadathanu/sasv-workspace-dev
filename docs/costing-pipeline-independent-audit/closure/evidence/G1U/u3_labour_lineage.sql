-- G1 upstream lineage (route/machine -> direct labour): runs 122 and 128. Read-only.
with runs as (select unnest(array[122,128]::bigint[]) run_id),
cp as (select refresh_run_id, sum(component_pool_amount) filter(where component_code='MANUFACTURING_LABOUR') mfg, sum(component_pool_amount) filter(where component_code='PACKING_LABOUR') pack, sum(component_pool_amount) tot
       from costing.direct_labour_component_pool_snapshot where refresh_run_id in (122,128) group by 1),
pool as (select refresh_run_id, total_pool_amount from costing.cost_pool_monthly_snapshot where refresh_run_id in (122,128) and allocation_pool='DIRECT_LABOUR'),
pw as (select * from costing.product_direct_labour_workload_snapshot where refresh_run_id in (122,128)),
st as (select refresh_run_id, product_id, sum(step_labour_factor) f, count(*) steps, count(distinct resource_class_code) rcs from costing.product_direct_labour_step_snapshot where refresh_run_id in (122,128) group by 1,2),
rls as (select * from costing.route_load_scaling_snapshot where refresh_run_id in (122,128) and allocation_pool='MANUFACTURING_LABOUR'),
sku as (select * from costing.sku_direct_labour_allocation_snapshot where refresh_run_id in (122,128)),
pk as (select * from costing.sku_packing_labour_workload_snapshot where refresh_run_id in (122,128)),
b as (select refresh_run_id, sku_id, monthly_allocation_units u, monthly_allocation_base_qty bq from costing.sku_sales_allocation_basis_snapshot where refresh_run_id in (122,128)),
pchk as (
 select pw.refresh_run_id,
  count(*) products,
  count(*) filter(where pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.direct_labour_workload_units>0) eligible,
  count(*) filter(where pw.workload_status like 'BLOCKED%') blocked,
  count(*) filter(where pw.workload_status like '%ZERO%') zero_mfg_route,
  abs(sum(pw.product_direct_labour_allocation)-max(cp.mfg)) mfg_pool_gap,
  count(*) filter(where pw.product_direct_labour_allocation>0 and abs(pw.product_direct_labour_allocation-pw.direct_labour_pool_amount*pw.direct_labour_workload_units/pw.company_eligible_workload_units)>1e-6) alloc_formula_mismatch,
  count(*) filter(where rls.product_id is not null and abs(rls.scaled_factor-pw.direct_labour_route_intensity)>1e-9) intensity_vs_scaling_mismatch,
  count(*) filter(where rls.product_id is not null and st.f is not null and abs(rls.raw_factor-st.f)>1e-9) raw_intensity_vs_steps_mismatch,
  count(*) filter(where rls.product_id is not null and pw.monthly_product_base_qty>0 and abs(pw.direct_labour_workload_units-pw.direct_labour_route_intensity*pw.monthly_product_base_qty/rls.preferred_batch_size)>1e-9) workload_vs_batch_equiv_mismatch,
  count(*) filter(where pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.direct_labour_workload_units>0 and rls.product_id is null) eligible_without_scaling_row,
  round(sum(pw.monthly_product_base_qty) filter(where pw.workload_status like 'BLOCKED%'),3) blocked_monthly_base_qty
 from pw left join cp on cp.refresh_run_id=pw.refresh_run_id
 left join rls on rls.refresh_run_id=pw.refresh_run_id and rls.product_id=pw.product_id
 left join st on st.refresh_run_id=pw.refresh_run_id and st.product_id=pw.product_id
 group by 1),
skuchk as (
 select s.refresh_run_id, count(*) skus,
  count(*) filter(where abs(s.direct_labour_cost_per_sku-(s.manufacturing_direct_labour_cost_per_sku+s.packing_labour_cost_per_sku))>1e-9) dl_split_mismatch,
  count(*) filter(where b.u>0 and abs(s.manufacturing_direct_labour_cost_per_sku-s.manufacturing_direct_labour_allocation/b.u)>1e-9) mfg_per_unit_mismatch,
  count(*) filter(where b.u>0 and abs(s.packing_labour_cost_per_sku-s.packing_labour_allocation/b.u)>1e-9) pack_per_unit_mismatch,
  count(*) filter(where s.direct_labour_allocation_status='BLOCKED') blocked,
  count(*) filter(where s.direct_labour_allocation_status='REVIEW_REQUIRED') review,
  round(sum(s.manufacturing_direct_labour_allocation),2) sum_mfg_alloc,
  round(sum(s.packing_labour_allocation),2) sum_pack_alloc
 from sku s left join b on b.refresh_run_id=s.refresh_run_id and b.sku_id=s.sku_id group by 1),
prodsku as (
 select pw.refresh_run_id,
  count(*) filter(where pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and abs(pw.product_direct_labour_allocation-coalesce(x.s,0))>1e-6) product_to_sku_gap_products,
  round(sum(pw.product_direct_labour_allocation-coalesce(x.s,0)),4) product_to_sku_gap_rs
 from pw left join (select refresh_run_id, product_id, sum(manufacturing_direct_labour_allocation) s from sku group by 1,2) x on x.refresh_run_id=pw.refresh_run_id and x.product_id=pw.product_id
 group by 1),
packchk as (
 select pk.refresh_run_id, count(*) skus,
  count(*) filter(where pk.packing_responsibility_code='EXTERNAL_FULLY_PACKED') external_packed,
  count(*) filter(where pk.packing_labour_allocation>0 and abs(pk.packing_labour_allocation-pk.packing_labour_pool_amount*pk.expected_package_units/pk.company_expected_package_units)>1e-6) pack_formula_mismatch,
  abs(sum(pk.packing_labour_allocation)-max(cp.pack)) pack_pool_gap
 from pk join cp on cp.refresh_run_id=pk.refresh_run_id group by 1),
bt as (select * from costing.batch_true_absorption_variance where refresh_run_id in (122,128)),
rc as (select refresh_run_id, resource_class_code, count(distinct product_id) products, round(sum(step_labour_factor),4) factor_sum from costing.product_direct_labour_step_snapshot where refresh_run_id in (122,128) group by 1,2)
select jsonb_build_object(
 'pools',(select jsonb_agg(jsonb_build_object('run',cp.refresh_run_id,'mfg',cp.mfg,'pack',cp.pack,'components_total',cp.tot,'dl_pool',pool.total_pool_amount,'gap',cp.tot-pool.total_pool_amount)) from cp join pool using(refresh_run_id)),
 'product_checks',(select jsonb_agg(to_jsonb(x)) from pchk x),
 'product_to_sku',(select jsonb_agg(to_jsonb(x)) from prodsku x),
 'sku_checks',(select jsonb_agg(to_jsonb(x)) from skuchk x),
 'packing_checks',(select jsonb_agg(to_jsonb(x)) from packchk x),
 'batch_true_variance',(select jsonb_agg(to_jsonb(x)) from bt x),
 'blocked_products_128',(select jsonb_agg(jsonb_build_object('product_id',product_id,'name',product_name,'status',workload_status,'monthly_base_qty',monthly_product_base_qty,'route_source',effective_route_source)) from pw where refresh_run_id=128 and workload_status like 'BLOCKED%'),
 'resource_classes',(select jsonb_agg(to_jsonb(x) order by refresh_run_id, factor_sum desc) from rc x)
) r;
