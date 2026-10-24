-- AU-6Q READ-ONLY replay on live run 126: current QC vs batch-true QC (same pool, same Method-3 workload, same demand, run batch sizes).
with pool as (select total_pool_amount p from costing.cost_pool_monthly_snapshot where refresh_run_id=126 and allocation_pool='QUALITY_CONTROL_OVERHEAD'),
w as (select * from costing.product_qc_workload_snapshot where refresh_run_id=126),
tot as (select sum(workload_units) filter (where workload_status='READY') t from w),
d as (select * from costing.fn_total_manufacturing_product_demand_as_of('2026-10-01','2026-10-16',126)),
x as (select w.product_id, w.workload_units wu, d.total_manufacturing_base_qty qty, o.preferred_batch_size bs,
        case when w.workload_status='READY' then pool.p*w.workload_units/tot.t end old_amt,
        (w.workload_status='READY' and coalesce(d.total_manufacturing_base_qty,0)>0 and coalesce(o.preferred_batch_size,0)>0) bt
      from w join d using(product_id) cross join pool cross join tot
      left join costing.product_production_overhead_workload_snapshot o on o.refresh_run_id=126 and o.product_id=w.product_id),
k as (select (select p from pool)-coalesce(sum(old_amt) filter (where not bt),0) pool_bt, sum(wu*qty/bs) filter (where bt) wl from x),
n as (select x.*, case when bt then k.pool_bt/k.wl*wu*qty/bs else old_amt end new_amt, case when bt then k.pool_bt/k.wl*wu/bs end new_rate, k.pool_bt/k.wl rate from x, k),
q as (select a.product_id, a.qc_cost_per_product_base_uom old_rate, n.new_rate, n.new_amt, n.old_amt, n.bs, n.qty, n.wu, n.rate from costing.product_qc_allocation_snapshot a join n using(product_id) where a.refresh_run_id=126),
s as (select c.sku_id, c.product_name, c.pack_size||c.pack_uom pk, c.quality_control_overhead_cost_per_sku qc_old, c.manufacturing_cop_per_sku cop_old,
        coalesce(q.new_rate*b.sku_base_qty_per_unit, c.quality_control_overhead_cost_per_sku) qc_new
      from costing.sku_manufacturing_cop_snapshot c join costing.sku_qc_allocation_snapshot b on b.refresh_run_id=126 and b.sku_id=c.sku_id
      left join q on q.product_id=c.product_id where c.refresh_run_id=126)
select json_build_object(
 'absorb',(select json_build_object('pool',(select p from pool),'old_abs',sum(old_amt),'new_abs',sum(new_amt),'var',(select p from pool)-sum(new_amt),'bt',count(*) filter (where bt),'cur',count(*) filter (where not bt and old_amt is not null),'rate',max(rate)) from n),
 'keys',(select json_agg(json_build_object('sku',sku_id,'n',left(product_name,32),'pk',pk,'qc',round(qc_old,2)||'->'||round(qc_new,2),'cop',round(cop_old,2)||'->'||round(cop_old-qc_old+qc_new,2),'x',round((cop_old-qc_old+qc_new)/cop_old,3)) order by product_name) from s where sku_id in (1792,1769,1770,879,988,1797,937)),
 'dist',(select json_agg(z order by b) from (select case when r<0.9 then '1 <-10%' when r<0.98 then '2 -10..-2%' when r<=1.02 then '3 +-2%' when r<=1.10 then '4 +2..10%' when r<=1.25 then '5 +10..25%' else '6 >+25%' end b, count(*) n from (select (cop_old-qc_old+qc_new)/nullif(cop_old,0) r from s where cop_old>0) y group by 1) z),
 'stats',(select json_build_object('n',count(*),'med',round(percentile_cont(0.5) within group (order by r)::numeric,4),'min',round(min(r)::numeric,3),'max',round(max(r)::numeric,3),'qc_med_old',round(percentile_cont(0.5) within group (order by qc_old/nullif(cop_old,0))::numeric,4),'qc_med_new',round(percentile_cont(0.5) within group (order by qc_new/nullif(cop_old-qc_old+qc_new,0))::numeric,4)) from (select *, (cop_old-qc_old+qc_new)/nullif(cop_old,0) r from s where cop_old>0) y),
 'top_up',(select json_agg(z) from (select sku_id,left(product_name,30) n,pk,round(qc_old,2) qo,round(qc_new,2) qn,round((cop_old-qc_old+qc_new)/cop_old,3) x from s where cop_old>0 order by (cop_old-qc_old+qc_new)/cop_old desc limit 6) z),
 'top_dn',(select json_agg(z) from (select sku_id,left(product_name,30) n,pk,round(qc_old,2) qo,round(qc_new,2) qn,round((cop_old-qc_old+qc_new)/cop_old,3) x from s where cop_old>0 order by (cop_old-qc_old+qc_new)/cop_old limit 6) z),
 'prod_sample',(select json_agg(z) from (select product_id,round(old_rate,2) o,round(new_rate,2) nw,bs,round(qty,3) qty,wu from q where product_id in (54,760,1340) or product_id in (select product_id from costing.sku_manufacturing_cop_snapshot where refresh_run_id=126 and sku_id in (1770,879,988,1797))) z),
 'neg',(select json_build_object('old',count(*) filter (where c.ik_margin_amount_before_scheme<0 or c.ok_margin_amount_before_scheme<0),'new',count(*) filter (where c.ik_margin_amount_before_scheme-(s.qc_new-s.qc_old)<0 or c.ok_margin_amount_before_scheme-(s.qc_new-s.qc_old)<0)) from costing.sku_costing_control_status_snapshot c join s using(sku_id) where c.refresh_run_id=126),
 'qty_vs_poh',(select count(*) from x join costing.product_production_overhead_workload_snapshot o on o.refresh_run_id=126 and o.product_id=x.product_id where abs(coalesce(o.monthly_product_base_qty,0)-coalesce(x.qty,0))>1e-9)
) r
