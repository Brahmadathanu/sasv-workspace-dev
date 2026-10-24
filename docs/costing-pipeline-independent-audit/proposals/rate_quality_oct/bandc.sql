with u as (select sku_id, monthly_allocation_units mu from costing.sku_sales_allocation_basis_snapshot where refresh_run_id=124),
cop as (select sku_id, manufacturing_cop_per_sku c from costing.sku_manufacturing_cop_snapshot where refresh_run_id=124),
l as (
 select 'RM' area, coalesce(purchase_stock_item_id,consume_stock_item_id) item, coalesce(purchase_stock_item_name,consume_stock_item_name) name, sku_id, rate_warning_code code, selected_rate, rate_source, rate_date, selected_manual_rate_id mid, selected_purchase_fact_id pid, selected_stock_valuation_source svs, rm_cost_per_sku_line v from costing.sku_rm_material_cost_line_snapshot where refresh_run_id=124 and coalesce(rate_warning_flag,false)
 union all
 select 'PM', stock_item_id, stock_item_name, sku_id, rate_warning_code, selected_rate, rate_source, rate_date, selected_manual_rate_id, selected_purchase_fact_id, selected_stock_valuation_source, pm_cost_per_sku_line from costing.sku_pm_material_cost_line_snapshot where refresh_run_id=124 and coalesce(rate_warning_flag,false)),
i as (select area,item,max(name) name,code,max(selected_rate) rate,max(rate_source) src,max(rate_date) rdate,max(mid) mid,max(pid) pid,max(svs) svs,count(*) lines,count(distinct l.sku_id) skus,
  sum(v*coalesce(mu,0)) monthly_value, max(v) max_pack_value, max(v/nullif(c,0)) max_share
  from l left join u using(sku_id) left join cop using(sku_id) group by 1,2,4),
s as (select stock_item_id item, upper(material_area) area, source_selected_rate r, source_rate_source src, source_rate_date d, source_selected_manual_rate_id mid, source_selected_purchase_fact_id pid, source_selected_stock_valuation_source svs from costing.material_review_acceptance_register where acceptance_status='ACTIVE' and period_start='2026-09-01'),
x as (select i.*, exists(select 1 from s where s.item=i.item and s.area=i.area) sep_acc,
  exists(select 1 from s where s.item=i.item and s.area=i.area and s.r is not distinct from i.rate and s.src is not distinct from i.src and s.d is not distinct from i.rdate and s.mid is not distinct from i.mid and s.pid is not distinct from i.pid and s.svs is not distinct from i.svs) same_evidence,
  case when max_share<0.01 and monthly_value<1000 then 'A_IMMATERIAL' when max_share<0.05 and monthly_value<10000 then 'B_MODERATE' else 'C_MATERIAL' end band,
  (date '2026-10-16'-rdate) age_days from i),
sv as (select x.*, (select max(s.r) from s where s.item=x.item and s.area=x.area) sr from x),
cand as (select area, item from sv where band in ('A_IMMATERIAL','B_MODERATE') and (
   (code in ('STALE_PURCHASE_RATE','MANUAL_RATE_USED') and same_evidence)
   or (code='STOCK_VALUATION_FALLBACK' and sr is not null and abs(rate/nullif(sr,0)-1)<=0.05)))
,
acc as (select stock_item_id item, upper(material_area) area from costing.material_review_acceptance_register where period_start='2026-10-01' and acceptance_status='ACTIVE'),
rem as (select sv.* from sv where not exists (select 1 from acc where acc.item=sv.item and acc.area=sv.area)),
lp as (select distinct on (stock_item_id) stock_item_id, rate_value, voucher_date, purchase_qty, uom_id, supplier_name from public.v_proc_purchase_fact_with_vendor order by stock_item_id, voucher_date desc, purchase_fact_id desc),
topsku as (select l.area, l.item, string_agg(l.sku_id||' '||coalesce(p.product_name,'')||' '||coalesce(p.pack_size::text,'')||coalesce(p.pack_uom,'')||' Rs'||round(l.v,2)||' ('||round(100*l.v/nullif(cop.c,0))||'%)', '; ' order by l.v desc) s
  from (select area,item,sku_id,sum(v) v, row_number() over (partition by area,item order by sum(v) desc) rn from l group by 1,2,3) l
  left join cop using(sku_id) left join costing.sku_manufacturing_cop_snapshot p on p.refresh_run_id=124 and p.sku_id=l.sku_id where l.rn<=3 group by 1,2),
rmq as (select coalesce(purchase_stock_item_id,consume_stock_item_id) item, max(qty_purchase_form_per_base_unit) mq, max(purchase_uom_code) puom, bool_or(form_conversion_applied) fc from costing.sku_rm_material_cost_line_snapshot where refresh_run_id=124 group by 1)
select json_agg(z order by z.monthly_value desc nulls last) from (
 select rem.area, rem.item stock_item_id, rem.name stock_item_name, rem.code issue, rem.band, round(rem.rate,4) current_rate, rem.src current_source, rem.rdate current_rate_date, rem.age_days,
  round(lp.rate_value,4) latest_tally_purchase_rate, lp.voucher_date latest_tally_purchase_date, lp.supplier_name latest_supplier,
  round(rem.sr,4) sep_accepted_rate, rem.skus skus_affected, round(rem.monthly_value) monthly_value, round(rem.max_pack_value,2) max_pack_line_value, round(100*rem.max_share,1) max_pack_cost_share_pct,
  topsku.s top_skus, rmq.puom purchase_uom, round(rmq.mq,6) max_qty_per_base_unit,
  case when rem.max_share>=0.5 and rem.max_pack_value>=1000 then 'LIKELY_BOM_QTY_OR_UNIT_ERROR'
       when rem.max_share>=0.5 then 'CHECK_BOM_HIGH_SHARE'
       when lp.rate_value is not null and rem.rate>0 and (lp.rate_value/rem.rate>5 or lp.rate_value/rem.rate<0.2) then 'CHECK_UNIT_RATE_MISMATCH' else '' end bom_unit_flag,
  null::numeric user_new_rate, null::text user_note
 from rem left join lp on lp.stock_item_id=rem.item left join topsku on topsku.area=rem.area and topsku.item=rem.item left join rmq on rem.area='RM' and rmq.item=rem.item) z