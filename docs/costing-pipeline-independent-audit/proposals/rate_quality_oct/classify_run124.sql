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
  (date '2026-10-16'-rdate) age_days from i)
select json_build_object(
 'by_code_band',(select json_agg(z) from (select code,band,count(*) items,sum(lines) lines,round(sum(monthly_value)) mval,count(*) filter(where same_evidence) carry_same,count(*) filter(where sep_acc and not same_evidence) sep_changed,count(*) filter(where not sep_acc) new_item from x group by 1,2 order by 1,2) z),
 'totals',(select json_build_object('items',count(*),'distinct_items',count(distinct (area,item)),'mval',round(sum(monthly_value)),'carry_same',count(*) filter(where same_evidence)) from x),
 'top',(select json_agg(z) from (select area,item,left(name,40) name,code,round(rate,2) rate,src,rdate,age_days,skus,round(monthly_value) mval,round(max_pack_value,2) max_pack,round(100*max_share,1) max_pct,same_evidence from x order by monthly_value desc nulls last limit 15) z))
