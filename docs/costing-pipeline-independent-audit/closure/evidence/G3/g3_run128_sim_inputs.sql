with b as (
  select sku_id, product_id, monthly_allocation_units u, monthly_driver_method m
  from costing.sku_sales_allocation_basis_snapshot where refresh_run_id=128),
sm as (
  select c.sku_id::bigint sku_id, c.month_start, sum(c.qty_clean) q
  from costing.fn_costing_sales_monthly_as_of('2026-10-16') c
  where c.month_start >= '2025-10-01' and c.month_start < '2026-10-01'
  group by 1,2),
mx as (select sku_id, max(q) filter (where q>0) maxq, sum(q) s12,
        (select sum(q3) from (select q q3 from sm s2 where s2.sku_id=sm.sku_id order by q desc limit 3) t) top3
       from sm group by sku_id),
i as (select sku_id, material_cost_per_sku mat, direct_labour_cost_per_sku dl, production_overhead_cost_per_sku po,
        quality_control_overhead_cost_per_sku qc, materials_stores_overhead_cost_per_sku ms, admin_overhead_cost_per_sku ad,
        finance_admin_overhead_cost_per_sku fa, internal_loaded_cost_per_sku ilc, prime_cost_per_sku prime
      from costing.sku_internal_loaded_cost_snapshot where refresh_run_id=128)
select jsonb_agg(jsonb_build_object('s',i.sku_id,'pr',b.product_id,'u',b.u,'m',left(b.m,4),'maxq',mx.maxq,'s12',mx.s12,'top3',mx.top3,
  'mat',i.mat,'dl',i.dl,'po',i.po,'qc',i.qc,'ms',i.ms,'ad',i.ad,'fa',i.fa,'ilc',i.ilc,'prime',i.prime,
  'seasonal_flag',(select is_seasonal from public.products pp where pp.id=b.product_id))) r
from i join b using (sku_id) left join mx using (sku_id)
