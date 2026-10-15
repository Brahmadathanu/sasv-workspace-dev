-- A3 sweep 2: evidence table for products with rounded_batch_count >= 10 x monthly_batch_equivalents (run 119). SELECT-only.
-- Window: 12 full months 2025-10-01..2026-09-30. Rates: rounded (as charged) 127.95 DL / 189.08 POH per WU;
-- unrounded-denominator rates 503.95 DL / 640.65 POH (A3 sweep 1, ANALYTICAL_ONLY).
with oh as (select * from costing.product_production_overhead_workload_snapshot where refresh_run_id=119),
dl as (select * from costing.product_direct_labour_workload_snapshot where refresh_run_id=119),
t as (select oh.product_id, oh.product_name, oh.product_base_uom uom, oh.preferred_batch_size pbs, oh.monthly_product_base_qty mq,
  oh.monthly_batch_equivalents mbe, oh.rounded_batch_count rbc, oh.route_factor rf, oh.workload_units oh_wu, dl.standard_batch_count sbc,
  dl.direct_labour_route_intensity di, dl.direct_labour_workload_units dl_wu
  from oh join dl using(product_id)
  where oh.rounded_batch_count>0 and oh.monthly_batch_equivalents>0 and oh.rounded_batch_count>=10*oh.monthly_batch_equivalents),
bmr as (select product_id, count(*) n12, count(distinct date_trunc('month',created_at)) months_with_batch,
  string_agg(to_char(created_at,'YYMM'),' ' order by created_at) bmonths, round(avg(batch_size),3) avg_bs, max(created_at)::date last_bmr,
  string_agg(distinct uom,'/') bmr_uom
  from public.bmr_details where created_at>='2025-10-01' and created_at<'2026-10-01' group by 1),
bmr_all as (select product_id, count(*) n_all, max(created_at)::date last_any from public.bmr_details group by 1),
fg as (select product_id, count(distinct batch_code) fg_batches, round(sum(qty_in_uom_base),3) fg_qty, count(distinct date_trunc('month',transfer_date)) fg_months
  from public.v_tally_fg_transfer_normalized where transfer_date>='2025-10-01' and transfer_date<'2026-10-01' group by 1),
sl as (select s.product_id, round(sum(s.qty_clean*ps.pack_size*coalesce(p.conversion_to_base,1)),3) sales_qty
  from public.v_sales_monthly_clean s join public.product_skus ps on ps.id=s.sku_id join public.products p on p.id=s.product_id
  where s.month_start>='2025-10-01' and s.month_start<'2026-10-01' group by 1),
sk as (select product_id, string_agg(id::text,',' order by id) skus from public.product_skus where is_active group by 1),
ref as (select distinct on (product_id) product_id, min_batch_size, max_batch_size from public.production_batch_size_ref where is_active order by product_id, effective_from desc)
select t.product_id, t.product_name, t.uom, sk.skus, t.pbs, ref.min_batch_size minbs, round(t.mq,4) mq, round(t.mbe,4) mbe, t.rbc, round(t.rf,3) rf, round(t.di,3) di,
 coalesce(bmr.n12,0) bmr12, bmr.months_with_batch, bmr.bmonths, bmr.avg_bs, bmr.bmr_uom, bmr_all.n_all, bmr_all.last_any,
 fg.fg_batches, fg.fg_qty, fg.fg_months, sl.sales_qty,
 round((t.dl_wu*127.95+t.oh_wu*189.08)/nullif(t.mq,0),2) old_conv_per_base,
 round((t.di*503.95+t.rf*640.65)/nullif(t.pbs,0),2) batchtrue_conv_per_base,
 round(t.dl_wu*127.95+t.oh_wu*189.08,2) old_conv_month
from t left join bmr using(product_id) left join bmr_all using(product_id) left join fg using(product_id) left join sl using(product_id)
left join sk using(product_id) left join ref using(product_id)
order by old_conv_month desc;
