select json_build_object(
 'pools',(select json_object_agg(allocation_pool,t) from (select allocation_pool, round(sum(standard_monthly_provision),2) t from costing.v_expense_head_monthly_provision where period_start='2026-09-01' group by 1) z),
 'all_pools_total',(select round(sum(standard_monthly_provision),2) from costing.v_expense_head_monthly_provision where period_start='2026-09-01'),
 'interest_paid',(select round(standard_monthly_provision,2) from costing.v_expense_head_monthly_provision where period_start='2026-09-01' and head_name='Interest Paid'),
 'tally_rows_0807',(select count(*) from public.tally_expenses_snapshot where as_of_date='2026-08-07'),
 'tally_rows_0808',(select count(*) from public.tally_expenses_snapshot where as_of_date='2026-08-08'),
 'etl_from_token_0808',(select params->'tokens'->>'FROM' from public.etl_jobs where job_type='FETCH_XML' and params->>'save_key'='raw/2026-08-08/direct_expenses.xml' limit 1)) r;
