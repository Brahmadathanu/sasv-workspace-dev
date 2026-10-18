-- AU-6 COMBINED READ-ONLY replay on live run 126 (no writes):
--   AU-6A universal route batch scaling (SYMMETRIC, f x (bs/ref_family_median)^b)  +  AU-6Q QC per batch  +  kit/Kanji base qty = 1 Nos (865, 878).
-- Mirrors the prepared writers: same eligibility as run 126, full pool re-absorption, packing labour unchanged, QC not scaled.
with ex(rc,b) as (values ('TABLET_OR_CAPSULE_EQUIPMENT',0.9),('GRINDER',0.8),('MANUAL',0.7),('FILTRATION_SYSTEM',0.7),('MIXING_EQUIPMENT',0.6),
  ('PROCESSING_VESSEL',0.5),('EXTRACTION_SYSTEM',0.5),('DRYER_OR_OVEN',0.5),('FERMENTATION_VESSEL',0.4),('CALCINATION',0.3),('TRADITIONAL_FURNACE',0.3),
  ('STORAGE_OCCUPANCY',0.3),('GENERAL_AREA',0),('EXTERNAL_JOB_WORK',0)),
kk(product_id,k_old) as (values (685::bigint,275::numeric),(695::bigint,500::numeric)),
pw as (select w.*, coalesce(kk.k_old,1) kq from costing.product_production_overhead_workload_snapshot w left join kk using(product_id) where w.refresh_run_id=126),
ref as (select route_family_id, product_base_uom, (percentile_cont(0.5) within group (order by preferred_batch_size))::numeric ref_bs, count(*) n
        from pw where route_family_id is not null and preferred_batch_size>0 group by 1,2),
sc as (select pw.product_id, pw.preferred_batch_size bs, ref.ref_bs, ref.n fam_n from pw left join ref using(route_family_id, product_base_uom)),
ps as (select s.product_id, sum(s.step_factor*case when coalesce(e.b,0)=0 or sc.ref_bs is null or sc.bs is null or sc.bs<=0 then 1 else power(sc.bs/sc.ref_bs, e.b) end) rf_new
       from costing.product_production_overhead_step_snapshot s join sc using(product_id) left join ex e on e.rc=s.resource_class_code where s.refresh_run_id=126 group by 1),
p2 as (select pw.product_id, pw.workload_status st, pw.monthly_product_base_qty/pw.kq qty_n, pw.preferred_batch_size bs, pw.route_factor rf_old, coalesce(ps.rf_new, pw.route_factor) rf_new, pw.workload_units wl_old,
              case when pw.preferred_batch_size>0 and pw.monthly_product_base_qty>0 and pw.route_factor is not null then pw.monthly_product_base_qty/pw.kq/pw.preferred_batch_size*coalesce(ps.rf_new,pw.route_factor) end wl_new,
              pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') elig
       from pw left join ps using(product_id)),
ppool as (select total_pool_amount p from costing.cost_pool_monthly_snapshot where refresh_run_id=126 and allocation_pool='PRODUCTION_OVERHEAD'),
pr as (select (select p from ppool)/sum(wl_old) filter (where elig) r_old, (select p from ppool)/sum(wl_new) filter (where elig) r_new from p2),
pa as (select p2.*, case when elig then pr.r_old*wl_old end a_old, case when elig then pr.r_new*wl_new end a_new from p2, pr),
dw as (select d.*, coalesce(kk.k_old,1) kq, d.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and d.direct_labour_workload_units>0 elig from costing.product_direct_labour_workload_snapshot d left join kk using(product_id) where d.refresh_run_id=126),
ds as (select s.product_id, sum(s.step_labour_factor) f, sum(s.step_labour_factor*case when coalesce(e.b,0)=0 or sc.ref_bs is null or sc.bs is null or sc.bs<=0 then 1 else power(sc.bs/sc.ref_bs, e.b) end) fs
       from costing.product_direct_labour_step_snapshot s join sc using(product_id) left join ex e on e.rc=s.resource_class_code where s.refresh_run_id=126 group by 1),
d2 as (select dw.product_id, dw.elig, dw.direct_labour_workload_units wl_old, dw.direct_labour_route_intensity dli_old,
              case when ds.f>0 then dw.direct_labour_route_intensity*ds.fs/ds.f else dw.direct_labour_route_intensity end dli_new,
              case when sc.bs>0 and dw.monthly_product_base_qty>0 and dw.direct_labour_workload_units>0
                   then (case when ds.f>0 then dw.direct_labour_route_intensity*ds.fs/ds.f else dw.direct_labour_route_intensity end)*dw.monthly_product_base_qty/dw.kq/sc.bs
                   else dw.direct_labour_workload_units end wl_new
       from dw left join ds using(product_id) left join sc using(product_id)),
mpool as (select component_pool_amount p from costing.direct_labour_component_pool_snapshot where refresh_run_id=126 and component_code='MANUFACTURING_LABOUR'),
dr as (select (select p from mpool)/sum(wl_old) filter (where elig) r_old, (select p from mpool)/sum(wl_new) filter (where elig) r_new from d2),
da as (select d2.*, case when elig then dr.r_old*wl_old else 0 end a_old, case when elig then dr.r_new*wl_new else 0 end a_new from d2, dr),
-- AU-6Q QC per batch (pool, Method-3 workload, demand unchanged; kit demand / k)
qpool as (select total_pool_amount p from costing.cost_pool_monthly_snapshot where refresh_run_id=126 and allocation_pool='QUALITY_CONTROL_OVERHEAD'),
qw as (select * from costing.product_qc_workload_snapshot where refresh_run_id=126),
qtot as (select sum(workload_units) filter (where workload_status='READY') t from qw),
dem as (select d.product_id, d.total_manufacturing_base_qty/coalesce(kk.k_old,1) qty from costing.fn_total_manufacturing_product_demand_as_of('2026-10-01','2026-10-16',126) d left join kk using(product_id)),
qx as (select qw.product_id, qw.workload_units wu, dem.qty, sc.bs,
        case when qw.workload_status='READY' then qpool.p*qw.workload_units/qtot.t end old_amt,
        (qw.workload_status='READY' and coalesce(dem.qty,0)>0 and coalesce(sc.bs,0)>0) bt
       from qw join dem using(product_id) join sc using(product_id) cross join qpool cross join qtot),
qk as (select (select p from qpool)-coalesce(sum(old_amt) filter (where not bt),0) pool_bt, sum(wu*qty/bs) filter (where bt) wl from qx),
qn as (select qx.product_id, case when bt then qk.pool_bt/qk.wl*wu/bs end rate_base, qk.pool_bt/qk.wl qrate from qx, qk),
-- SKU level
s as (select c.sku_id, c.product_id, c.product_name, c.pack_size||c.pack_uom pk, c.manufacturing_cop_per_sku cop_old,
        c.direct_labour_cost_per_sku dl_old, c.production_overhead_cost_per_sku poh_old, c.quality_control_overhead_cost_per_sku qc_old, c.materials_stores_overhead_cost_per_sku st_old,
        dl.manufacturing_direct_labour_cost_per_sku mfg_old, dl.packing_labour_cost_per_sku pack, b.sku_base_qty_per_unit k_old,
        case when c.sku_id in (865,878) then 1 else b.sku_base_qty_per_unit end k_new,
        coalesce(dl.manufacturing_direct_labour_cost_per_sku*da.a_new/nullif(da.a_old,0),0) mfg_new,
        coalesce(c.production_overhead_cost_per_sku*pa.a_new/nullif(pa.a_old,0),0) poh_new,
        coalesce(qn.rate_base*case when c.sku_id in (865,878) then 1 else b.sku_base_qty_per_unit end, c.quality_control_overhead_cost_per_sku) qc_new,
        pa.bs, sc.ref_bs, sc.fam_n
      from costing.sku_manufacturing_cop_snapshot c
      join costing.sku_sales_allocation_basis_snapshot b on b.refresh_run_id=126 and b.sku_id=c.sku_id
      join costing.sku_direct_labour_allocation_snapshot dl on dl.refresh_run_id=126 and dl.sku_id=c.sku_id
      left join da on da.product_id=c.product_id left join pa on pa.product_id=c.product_id left join qn on qn.product_id=c.product_id left join sc on sc.product_id=c.product_id
      where c.refresh_run_id=126),
t as (select s.*, mfg_new+pack dl_new, st_old*k_new/k_old st_new,
             cop_old - dl_old - poh_old - qc_old - st_old + (mfg_new+pack) + poh_new + qc_new + st_old*k_new/k_old cop_new from s),
m as (select t.*, cs.ik_margin_amount_before_scheme ikm, cs.ok_margin_amount_before_scheme okm from t left join costing.sku_costing_control_status_snapshot cs on cs.refresh_run_id=126 and cs.sku_id=t.sku_id)
select json_build_object(
 'rates',json_build_object('poh',(select json_build_object('old',round(r_old,3),'new',round(r_new,3)) from pr),'dl_mfg',(select json_build_object('old',round(r_old,3),'new',round(r_new,3)) from dr),
                           'qc_per_unit_batch',(select round(max(qrate),4) from qn),
                           'absorbed',json_build_object('poh',(select round(sum(a_new),2) from pa),'dl',(select round(sum(a_new),2) from da),'qc_sku_x_units',null)),
 'keys',(select json_agg(json_build_object('sku',sku_id,'n',left(product_name,30),'pk',pk,'bs',bs,'ref',round(ref_bs,2),
          'dl',round(dl_old,2)||'->'||round(dl_new,2),'poh',round(poh_old,2)||'->'||round(poh_new,2),'qc',round(qc_old,2)||'->'||round(qc_new,2),
          'cop',round(cop_old,2)||'->'||round(cop_new,2),'x',round(cop_new/nullif(cop_old,0),3)) order by sku_id) from t
          where sku_id in (865,878,1769,1770,1792,1797) or product_name ~* '(mehasamani|thampira|dahasanthi)'),
 'top_up',(select json_agg(z) from (select sku_id,left(product_name,28) n,pk,bs,round(ref_bs,1) ref,round(cop_old,2) o,round(cop_new,2) nw,round(cop_new/cop_old,3) x from t where cop_old>0 order by cop_new/cop_old desc limit 15) z),
 'top_dn',(select json_agg(z) from (select sku_id,left(product_name,28) n,pk,bs,round(ref_bs,1) ref,round(cop_old,2) o,round(cop_new,2) nw,round(cop_new/cop_old,3) x from t where cop_old>0 order by cop_new/cop_old limit 15) z),
 'dist',(select json_agg(z order by b) from (select case when r<0.75 then '1 <-25%' when r<0.95 then '2 -25..-5%' when r<=1.05 then '3 +-5%' when r<=1.25 then '4 +5..25%' else '5 >+25%' end b, count(*) n from (select cop_new/cop_old r from t where cop_old>0) y group by 1) z),
 'stats',(select json_build_object('n',count(*),'med',round(percentile_cont(0.5) within group (order by cop_new/cop_old)::numeric,4),'tot_cop_old',round(sum(cop_old),0),'tot_cop_new',round(sum(cop_new),0)) from t where cop_old>0),
 'neg',(select json_build_object('old',count(*) filter (where ikm<0 or okm<0),'new',count(*) filter (where ikm-(cop_new-cop_old)<0 or okm-(cop_new-cop_old)<0)) from m),
 'per_sku',(select json_agg(json_build_object('s',sku_id,'dl',dl_new,'poh',poh_new,'qc',qc_new)) from t)
) r
