drop table if exists sim.cmp;
create table sim.cmp as
with v as (
 select d.refresh_run_id r, d.sku_id, d.direct_labour_cost_per_sku dl, o.production_overhead_cost_per_sku poh, q.quality_control_overhead_cost_per_sku qc
 from costing.sku_direct_labour_allocation_snapshot d join costing.sku_production_overhead_allocation_snapshot o using(refresh_run_id,sku_id) join costing.sku_qc_allocation_snapshot q using(refresh_run_id,sku_id)
 where d.refresh_run_id in (903,910))
select b.*, case when b.sku_id in (865,878) then 1 else b.k end k_new,
  b.cop-b.dl-b.poh-b.qc-b.st + b.st*(case when b.sku_id in (865,878) then 1 else b.k end)/b.k as rest_new,
  e.dl e_dl, e.poh e_poh, e.qc e_qc, x.dl b_dl, x.poh b_poh, x.qc b_qc, x.dl+coalesce(s.dl_delta,0) l_dl, x.poh+coalesce(s.poh_delta,0) l_poh, x.qc l_qc,
  bm.bs, bm.m_solid batch_mass, bm.m_out, bm.uom
from sim.base b join v e on e.r=903 and e.sku_id=b.sku_id join v x on x.r=910 and x.sku_id=b.sku_id left join sim.sku s on s.sku_id=b.sku_id left join sim.bm bm on bm.product_id=b.product_id;
alter table sim.cmp add e_cop numeric, add l_cop numeric, add b_cop numeric;
update sim.cmp set e_cop=rest_new+e_dl+e_poh+e_qc, l_cop=rest_new+l_dl+l_poh+l_qc, b_cop=rest_new+b_dl+b_poh+b_qc;
