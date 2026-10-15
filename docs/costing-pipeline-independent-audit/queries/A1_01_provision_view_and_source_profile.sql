-- A1: provisioning logic and Tally source profile (SELECT-only)
select pg_get_viewdef('costing.v_expense_head_monthly_provision'::regclass);
-- provision by pool for period 2026-09-01 vs run119 pool snapshot
select allocation_pool, count(*) heads, round(sum(standard_monthly_provision),2) prov from costing.v_expense_head_monthly_provision where period_start='2026-09-01' group by 1 order by 1;
select allocation_pool, staff_pool_amount, expense_provision_amount, total_pool_amount from costing.cost_pool_monthly_snapshot where refresh_run_id=119 order by 1;
-- daily total of source snapshots (shows FYTD -> month-to-date basis change on 2026-08-08)
select as_of_date, round(sum(net_cb_value)) tot, min(source_key), min(inserted_at) from public.tally_expenses_snapshot where as_of_date >= '2026-06-09' group by 1 order by 1;
-- POH head series
select e.head_name, e.as_of_date, e.net_cb_value from public.tally_expenses_snapshot e join costing.expense_head_costing_map m using (expense_group, head_name)
 where m.allocation_pool='PRODUCTION_OVERHEAD' and m.is_active and m.include_in_costing and e.as_of_date in ('2026-03-31','2026-06-30','2026-07-31','2026-08-31','2026-09-30') order by 1,2;
