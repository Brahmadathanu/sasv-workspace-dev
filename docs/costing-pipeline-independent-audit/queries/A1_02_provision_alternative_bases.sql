-- A1 alternative provision bases for period 2026-09-01 (SELECT-only)
with m as (select * from costing.expense_head_costing_map where is_active and include_in_costing and allocation_pool<>'EXCLUDED'),
e as (select e.as_of_date, m.allocation_pool, e.expense_group, e.head_name, e.net_cb_value
      from public.tally_expenses_snapshot e join m using (expense_group, head_name)
      where e.as_of_date < date '2026-09-01'),
sel as (select * from costing.v_expense_head_monthly_provision where period_start='2026-09-01'),
fy25 as (select allocation_pool, expense_group, head_name, net_cb_value v from e where as_of_date=date '2026-03-31'),
cur as (select allocation_pool, expense_group, head_name, net_cb_value v from e where as_of_date=date '2026-08-31'),
heads as (select s.allocation_pool, s.expense_group, s.head_name, s.standard_monthly_provision sel, s.selected_financial_year_start sel_fy,
   (select v from fy25 f where f.expense_group=s.expense_group and f.head_name=s.head_name)/12.0 fy25_avg,
   (select v from cur c where c.expense_group=s.expense_group and c.head_name=s.head_name)/5.0 fytd_avg,
   (select v from fy25 f where f.expense_group=s.expense_group and f.head_name=s.head_name) fy25_raw,
   (select v from cur c where c.expense_group=s.expense_group and c.head_name=s.head_name) cur_raw
  from sel s)
select json_build_object(
 'snapshot_dates_monthend',(select json_agg(distinct as_of_date order by as_of_date) from e where as_of_date=(date_trunc('month',as_of_date)+interval '1 month -1 day')::date),
 'pool_totals',(select json_agg(x) from (select allocation_pool, round(sum(sel),2) selected, round(sum(fy25_avg),2) fy2526_avg, round(sum(fytd_avg),2) fytd_apr_aug_avg, count(*) filter (where fy25_raw<0 or cur_raw<0) neg_heads from heads group by 1 order by 1) x),
 'poh_heads',(select json_agg(x) from (select head_name, round(sel,2) sel, sel_fy, round(fy25_avg,2) fy2526_avg, round(fytd_avg,2) fytd_avg from heads where allocation_pool='PRODUCTION_OVERHEAD' order by sel desc) x),
 'neg_detail',(select json_agg(x) from (select allocation_pool, head_name, fy25_raw, cur_raw, round(sel,2) sel from heads where fy25_raw<0 or cur_raw<0) x));
