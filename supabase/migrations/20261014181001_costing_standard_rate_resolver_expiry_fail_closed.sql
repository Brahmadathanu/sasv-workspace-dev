create unique index manufacturing_standard_rate_approved_start_unique
on costing.manufacturing_standard_rate_policy(allocation_pool,component_code,effective_from)
where status='APPROVED';
create or replace function costing.fn_resolve_manufacturing_standard_rate(
 p_allocation_pool text,p_component_code text,p_valuation_date date
) returns table(policy_id bigint,policy_version integer,standard_rate numeric,cost_behaviour text,
 normal_workload_units numeric,normal_budget_amount numeric,evidence_reference text)
language sql stable security invoker set search_path=costing,pg_temp as $$
 with selected as (
 select r.*
 from costing.manufacturing_standard_rate_policy r
 where r.allocation_pool=p_allocation_pool and r.component_code=p_component_code
  and r.status='APPROVED' and r.effective_from<=p_valuation_date
 order by r.effective_from desc,r.policy_version desc,r.id desc limit 1
 )
 select r.id,r.policy_version,r.normal_budget_amount/nullif(r.normal_workload_units,0),
 r.cost_behaviour,r.normal_workload_units,r.normal_budget_amount,r.evidence_reference
 from selected r where r.effective_to is null or r.effective_to>=p_valuation_date
$$;
revoke all on function costing.fn_resolve_manufacturing_standard_rate(text,text,date) from public,anon,authenticated;
comment on function costing.fn_resolve_manufacturing_standard_rate(text,text,date) is
'Non-activating approved as-of rate resolver; latest approved start governs. If that version has expired, fail closed instead of reverting to older open-ended version.';