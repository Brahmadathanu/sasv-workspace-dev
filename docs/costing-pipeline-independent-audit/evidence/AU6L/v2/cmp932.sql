


drop table if exists public.cmp932;
create table public.cmp932 as
select b.*, case when b.sku_id in (865,878) then 1 else b.k end k_new,
  d.direct_labour_cost_per_sku dl_n, o.production_overhead_cost_per_sku poh_n, q.quality_control_overhead_cost_per_sku qc_n,
  b.st*(case when b.sku_id in (865,878) then 1 else b.k end)/b.k st_n,
  w.preferred_batch_size bs, w.product_base_uom uom, ls.solid_charge_kg chg, (select max((e->>'loads')::numeric) from jsonb_array_elements(ls.step_detail) e) maxloads
from public.base126 b
join costing.sku_direct_labour_allocation_snapshot d on d.refresh_run_id=:run and d.sku_id=b.sku_id
join costing.sku_production_overhead_allocation_snapshot o on o.refresh_run_id=:run and o.sku_id=b.sku_id
join costing.sku_qc_allocation_snapshot q on q.refresh_run_id=:run and q.sku_id=b.sku_id
left join costing.product_production_overhead_workload_snapshot w on w.refresh_run_id=:run and w.product_id=b.product_id
left join costing.route_load_scaling_snapshot ls on ls.refresh_run_id=:run and ls.product_id=b.product_id and ls.allocation_pool='PRODUCTION_OVERHEAD';
alter table public.cmp932 add cop_n numeric;
update public.cmp932 set cop_n = cop-dl-poh-qc-st + dl_n+poh_n+qc_n+st_n;
