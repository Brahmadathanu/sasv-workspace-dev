create function costing.fn_preview_overhead_provision_selection_rationale(p_refresh_run_id bigint)
returns table(head_name text,completed_fy_monthly numeric,running_fy_monthly numeric,selected_monthly numeric,selected_fy_start date,selection_reason text,conservative_uplift_vs_lower numeric)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
with e as (
select v.* from costing.costing_refresh_run r
join costing.v_expense_head_monthly_provision v on v.period_start=r.period_start
where r.id=p_refresh_run_id and v.allocation_pool='PRODUCTION_OVERHEAD'
), x as (
select e.*,
(select max((z->>'monthly_equivalent_value')::numeric) from jsonb_array_elements(e.comparison_details) z where z->>'snapshot_basis'='COMPLETED_FINANCIAL_YEAR') completed,
(select max((z->>'monthly_equivalent_value')::numeric) from jsonb_array_elements(e.comparison_details) z where z->>'snapshot_basis'='RUNNING_FINANCIAL_YEAR_MONTH_END') running
from e)
select x.head_name::text,x.completed,x.running,x.standard_monthly_provision,x.selected_financial_year_start,
case when x.completed is null or x.running is null then 'ONE_PERIOD_ONLY'
when x.completed>=x.running then 'HIGHER_COMPLETED_FY_MONTHLY_EQUIVALENT'
else 'HIGHER_RUNNING_FY_MONTHLY_EQUIVALENT' end,
case when x.completed is not null and x.running is not null then x.standard_monthly_provision-least(x.completed,x.running) else null::numeric end
from x
$$;
revoke all on function costing.fn_preview_overhead_provision_selection_rationale(bigint) from public,anon,authenticated;
comment on function costing.fn_preview_overhead_provision_selection_rationale(bigint) is 'Read-only audit of higher-of-year monthly equivalent selection for overhead. Selection is historical reference provisioning and does not constitute approved normal standard rate budget.';