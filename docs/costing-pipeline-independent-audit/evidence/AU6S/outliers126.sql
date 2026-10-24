-- READ-ONLY: small-batch outliers on run 126 (batch <= 25% of route-family median, family n>=3, same base UOM)
with w as (select w.product_id, w.product_name, w.product_base_uom u, w.preferred_batch_size bs, w.monthly_product_base_qty qty, w.route_family_id rf, w.route_factor rfac,
        d.direct_labour_route_intensity dli from costing.product_production_overhead_workload_snapshot w
      join costing.product_direct_labour_workload_snapshot d on d.refresh_run_id=126 and d.product_id=w.product_id
      where w.refresh_run_id=126 and w.preferred_batch_size>0 and w.route_factor>0),
fam as (select rf,u,count(*) n,(percentile_cont(0.5) within group (order by bs))::numeric ref from w group by 1,2),
q as (select product_id, sum(qc_amount_per_base_unit) qc from (select product_id, null::numeric qc_amount_per_base_unit from w) z group by 1)
select json_agg(json_build_object('p',w.product_id,'n',left(w.product_name,34),'u',w.u,'rf',w.rf,'bs',w.bs,'fam_med',fam.ref,'fam_n',fam.n,'ratio',round(w.bs/fam.ref,3),
  'rfac',w.rfac,'dli',w.dli,'qty_m',round(w.qty,2),'dl_poh_per_u',round((467.157*w.rfac+561.360*w.dli)/w.bs,2)) order by (467.157*w.rfac+561.360*w.dli)/w.bs desc)
from w join fam using(rf,u) where fam.n>=3 and w.bs<=0.25*fam.ref;
