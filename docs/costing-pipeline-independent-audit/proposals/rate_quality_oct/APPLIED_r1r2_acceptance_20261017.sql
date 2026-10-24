do $$
declare n int; e int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6','role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6', true);
  if auth.uid() is distinct from 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid then raise exception 'identity not set: %', auth.uid(); end if;
  create temp table _cand on commit drop as
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
  select area, item from cand;
  select count(*) into e from _cand;
  if e<>645 then raise exception 'candidate count % <> 645', e; end if;
  select count(*) into n from (
    select costing.rpc_accept_material_review_action(
      date '2026-10-01', q.stock_item_id, q.material_area, 'REVIEW_REQUIRED', q.recommended_ui_route,
      q.issue_codes, q.warning_codes, q.action_required_summary,
      'R1/R2 rule-based Oct carry, user approved 2026-10-17',
      'Run 124 evidence; valuation 2026-10-16; R1 = same evidence as Sep acceptance (band A/B), R2 = stock valuation within 5% of Sep accepted rate (band A/B)')
    from costing.material_costing_action_queue_snapshot q join _cand c on c.item=q.stock_item_id and c.area=upper(q.material_area)
    where q.period_start='2026-10-01' and q.action_severity='REVIEW_REQUIRED') z;
  if n<>645 then raise exception 'accepted % <> 645; rolling back', n; end if;
  select count(*) into n from costing.material_review_acceptance_register where period_start='2026-10-01' and acceptance_status='ACTIVE' and source_valuation_date='2026-10-16' and source_refresh_run_id=124;
  if n<>645 then raise exception 'register rows % <> 645; rolling back', n; end if;
end $$;
