-- READ-ONLY simulation on run 126: batch-size-scaled route workload (per-step economy-of-scale exponent by resource class).
-- workload per batch = sum_steps f_s * (bs / ref_bs_family)^b_class ; ref_bs = median batch size of route family + base UOM.
-- Full pool re-absorbed (rate re-derived). QC per batch unchanged (tests per batch are genuinely fixed).
with b(rc,e) as (values ('GRINDER',0.8),('MANUAL',0.7),('FILTRATION_SYSTEM',0.7),('TABLET_OR_CAPSULE_EQUIPMENT',0.9),('MIXING_EQUIPMENT',0.6),
  ('PROCESSING_VESSEL',0.5),('EXTRACTION_SYSTEM',0.5),('DRYER_OR_OVEN',0.5),('FERMENTATION_VESSEL',0.4),('CALCINATION',0.3),('TRADITIONAL_FURNACE',0.3),
  ('STORAGE_OCCUPANCY',0.3),('GENERAL_AREA',0.0),('EXTERNAL_JOB_WORK',0.0)),
w as (select w.product_id, w.product_name, w.product_base_uom u, w.preferred_batch_size bs, w.monthly_product_base_qty qty, w.route_family_id rf, w.route_factor rfac,
        d.direct_labour_route_intensity dli from costing.product_production_overhead_workload_snapshot w
      join costing.product_direct_labour_workload_snapshot d on d.refresh_run_id=126 and d.product_id=w.product_id
      where w.refresh_run_id=126 and w.preferred_batch_size>0 and w.monthly_product_base_qty>0 and w.route_factor>0),
fam as (select rf,u,(percentile_cont(0.5) within group (order by bs))::numeric ref from w group by 1,2),
ps as (select s.product_id, sum(s.step_factor) f, sum(s.step_factor*least(1,power((w.bs/fam.ref),coalesce(b.e,0.5)))) fs
       from costing.product_production_overhead_step_snapshot s join w using(product_id) join fam using(rf,u) left join b on b.rc=s.resource_class_code
       where s.refresh_run_id=126 group by 1),
ds as (select s.product_id, sum(s.step_labour_factor) f, sum(s.step_labour_factor*least(1,power((w.bs/fam.ref),coalesce(b.e,0.5)))) fs
       from costing.product_direct_labour_step_snapshot s join w using(product_id) join fam using(rf,u) left join b on b.rc=s.resource_class_code
       where s.refresh_run_id=126 group by 1),
x as (select w.*, fam.ref, w.rfac*ps.fs/nullif(ps.f,0) rfac_new, w.dli*coalesce(ds.fs/nullif(ds.f,0),1) dli_new from w join fam using(rf,u) join ps using(product_id) left join ds using(product_id)),
pool as (select (select pool_amount from costing.batch_true_absorption_variance where refresh_run_id=126 and allocation_pool='PRODUCTION_OVERHEAD') poh,
                (select pool_amount from costing.batch_true_absorption_variance where refresh_run_id=126 and allocation_pool='MANUFACTURING_LABOUR') dl),
r as (select pool.poh/sum(x.rfac*x.qty/x.bs) poh_old, pool.poh/sum(x.rfac_new*x.qty/x.bs) poh_new,
             pool.dl/sum(x.dli*x.qty/x.bs) dl_old, pool.dl/sum(x.dli_new*x.qty/x.bs) dl_new from x, pool group by pool.poh, pool.dl),
y as (select x.*, (r.poh_old*rfac+r.dl_old*dli)/bs conv_old, (r.poh_new*rfac_new+r.dl_new*dli_new)/bs conv_new from x, r),
s as (select c.sku_id, c.product_id, left(c.product_name,30) n, c.pack_size||c.pack_uom pk, c.manufacturing_cop_per_sku cop, b2.sku_base_qty_per_unit k, y.conv_old, y.conv_new, y.bs, y.ref
      from costing.sku_manufacturing_cop_snapshot c join costing.sku_sales_allocation_basis_snapshot b2 on b2.refresh_run_id=126 and b2.sku_id=c.sku_id join y on y.product_id=c.product_id where c.refresh_run_id=126)
select json_build_object(
 'rates',(select row_to_json(r) from r),
 'kvatha_and_keys',(select json_agg(json_build_object('p',product_id,'n',left(product_name,28),'bs',bs,'ref',ref,'conv_kg',round(conv_old,2)||'->'||round(conv_new,2)) order by bs/ref) from y where product_id in (468,1340,1061,648,1040,664,1342,1043,694,696,54,824,931,932)),
 'sku_dist',(select json_agg(z order by bk) from (select case when q<0.75 then '1 <-25%' when q<0.95 then '2 -25..-5%' when q<=1.05 then '3 +-5%' when q<=1.25 then '4 +5..25%' else '5 >+25%' end bk, count(*) n from (select (cop-(conv_old-conv_new)*k)/cop q from s where cop>0) t group by 1) z),
 'sku_keys',(select json_agg(json_build_object('sku',sku_id,'n',n,'pk',pk,'cop',round(cop,2)||'->'||round(cop-(conv_old-conv_new)*k,2)) order by sku_id) from s where sku_id in (1769,1770,1792,879,988,1797,1365)),
 'abs',(select json_build_object('poh',round(sum(r.poh_new*rfac_new*qty/bs),2),'dl',round(sum(r.dl_new*dli_new*qty/bs),2)) from x, r),
 'top_up',(select json_agg(z) from (select sku_id,n,pk,bs,ref,round((cop-(conv_old-conv_new)*k)/cop,3) q from s where cop>0 order by (cop-(conv_old-conv_new)*k)/cop desc limit 6) z)
) res
