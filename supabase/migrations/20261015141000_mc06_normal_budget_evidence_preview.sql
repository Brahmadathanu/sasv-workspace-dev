-- MC06 independent normal-budget evidence: no changes to historical provision selection.
-- Annual full-FY reference versus selected existing provision, with transparent provenance.
create or replace function costing.fn_preview_mc06_normal_budget_evidence(p_period_start date)
returns table (
 expense_group text,head_name text,allocation_pool text,
 prior_full_fy_monthly numeric,prior_full_fy_snapshot_date date,
 existing_selected_monthly numeric,existing_selected_fy_start date,
 existing_selected_fy_value numeric,
 selected_to_prior_ratio numeric,budget_review_status text
)
language sql stable set search_path=costing,public,pg_temp as $mc06$
with v as (
 select x.expense_group,x.head_name,x.allocation_pool,
 x.standard_monthly_provision,x.selected_financial_year_start,
 x.selected_fy_value,x.comparison_details
 from costing.v_expense_head_monthly_provision x
 where x.period_start=p_period_start and x.allocation_pool='PRODUCTION_OVERHEAD'
), ref as (
 select v.*,j.value as detail
 from v cross join lateral jsonb_array_elements(v.comparison_details) j(value)
 where j.value->>'snapshot_basis'='COMPLETED_FINANCIAL_YEAR'
 and (j.value->>'snapshot_as_of_date')::date < p_period_start
), ranked as (
 select ref.*,row_number() over(partition by ref.expense_group,ref.head_name
 order by (detail->>'snapshot_as_of_date')::date desc) seq from ref
)
select v.expense_group,v.head_name,v.allocation_pool,
 (r.detail->>'monthly_equivalent_value')::numeric,
 (r.detail->>'snapshot_as_of_date')::date,
 v.standard_monthly_provision,v.selected_financial_year_start,
 v.selected_fy_value,
 case when (r.detail->>'monthly_equivalent_value')::numeric>0
 then v.standard_monthly_provision/(r.detail->>'monthly_equivalent_value')::numeric end,
 case when r.detail is null then 'REVIEW_MISSING_COMPLETED_FY'
 when (r.detail->>'monthly_equivalent_value')::numeric <=0 then 'REVIEW_NONPOSITIVE_FY_BASELINE'
 else 'EVIDENCE_ONLY_UNAPPROVED_NORMAL_BUDGET' end
from v left join ranked r on r.expense_group=v.expense_group
 and r.head_name=v.head_name and r.seq=1;
$mc06$;
comment on function costing.fn_preview_mc06_normal_budget_evidence(date)
is 'MC06 read-only completed-FY benchmark versus existing max-selected provisions. Not an approved normal budget or cost refresh input.';
