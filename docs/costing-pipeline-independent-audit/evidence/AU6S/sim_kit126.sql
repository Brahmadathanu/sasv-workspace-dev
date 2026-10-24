-- READ-ONLY: impact on run 126 of honouring sku_base_quantity_exception (kit 865, Kanji 878 = 1 Nos per pack).
-- A: Kanji batch stays 50,000 Nos; B: Kanji batch = 100 packs (if the 50,000 is really grams).
with w as (select w.product_id, w.monthly_product_base_qty qty, w.preferred_batch_size bs, w.route_factor rf, d.direct_labour_route_intensity dli
           from costing.product_production_overhead_workload_snapshot w join costing.product_direct_labour_workload_snapshot d on d.refresh_run_id=126 and d.product_id=w.product_id
           where w.refresh_run_id=126 and w.preferred_batch_size>0 and w.monthly_product_base_qty>0),
sc as (select s, case when s='A' then 50000 else 100 end kbs from (values ('A'),('B')) v(s)),
n as (select sc.s, case when w.product_id=685 then 36 when w.product_id=695 then 894 else w.qty end qn,
             case when w.product_id=695 then sc.kbs else bs end bn, w.* from w cross join sc),
pool as (select 670935.04 poh, 706203 dl),
r as (select s, (select poh from pool)/sum(rf*qty/bs) filter (where true) poh_o, (select poh from pool)/sum(rf*qn/bn) poh_n,
             (select dl from pool)/sum(dli*qty/bs) dl_o, (select dl from pool)/sum(dli*qn/bn) dl_n from n group by s),
y as (select n.s, n.product_id, (r.poh_o*rf+r.dl_o*dli)/bs conv_o, (r.poh_n*rf+r.dl_n*dli)/bn conv_n from n join r using(s)),
k as (select c.sku_id, c.product_id, c.manufacturing_cop_per_sku cop, b.sku_base_qty_per_unit kb from costing.sku_manufacturing_cop_snapshot c join costing.sku_sales_allocation_basis_snapshot b on b.refresh_run_id=126 and b.sku_id=c.sku_id where c.refresh_run_id=126),
z as (select y.s, k.sku_id, k.cop, k.cop - y.conv_o*k.kb + y.conv_n*(case when k.sku_id in (865,878) then 1 else k.kb end) cop_n from k join y using(product_id))
select json_build_object('rates',(select json_agg(row_to_json(r)) from r),
 'skus',(select json_agg(json_build_object('s',s,'sku',sku_id,'cop',round(cop,2)||'->'||round(cop_n,2)) order by s,sku_id) from z where sku_id in (865,878,879,988,1797,1792,1769)),
 'dist',(select json_agg(q) from (select s, count(*) filter (where cop_n>cop*1.05) up5, count(*) filter (where cop_n<cop*0.95) dn5, round(percentile_cont(0.5) within group (order by cop_n/cop)::numeric,4) med from z where cop>0 group by s) q),
 'neg',(select json_agg(q) from (select z.s, count(*) filter (where c.ik_margin_amount_before_scheme-(z.cop_n-z.cop)<0 or c.ok_margin_amount_before_scheme-(z.cop_n-z.cop)<0) neg from z join costing.sku_costing_control_status_snapshot c on c.refresh_run_id=126 and c.sku_id=z.sku_id group by z.s) q)) j
