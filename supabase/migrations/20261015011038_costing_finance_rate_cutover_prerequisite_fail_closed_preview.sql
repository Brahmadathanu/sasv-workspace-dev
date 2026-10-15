create function costing.fn_preview_manufacturing_rate_cutover_gate(p_refresh_run_id bigint)
returns table(refresh_run_id bigint,source_component_count bigint,source_amount numeric,classified_amount numeric,approved_classified_amount numeric,unclassified_amount numeric,classification_ready boolean,approved_rate_policy_count bigint,rate_cutover_status text)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
with coverage as (
 select count(*) n,sum(source_amount) source_total,sum(classified_amount) classified_total,
 sum(approved_amount) approved_total,sum(unclassified_amount) unclassified_total,
 bool_and(conservation_status='SOURCE_SPLIT_APPROVED_AND_CONSERVED') fully_approved
 from costing.fn_preview_manufacturing_behaviour_split_conservation(p_refresh_run_id)
), rates as (
 select count(*) approved_count from costing.manufacturing_standard_rate_policy p
 join costing.costing_refresh_run r on r.id=p_refresh_run_id
 where p.status='APPROVED' and p.effective_from<=r.valuation_date
 and (p.effective_to is null or p.effective_to>=r.valuation_date)
)
select p_refresh_run_id,c.n,c.source_total,c.classified_total,c.approved_total,c.unclassified_total,
coalesce(c.fully_approved,false),r.approved_count,
case when c.n<>10 then 'BLOCKED_SOURCE_COMPONENT_COVERAGE'
when not coalesce(c.fully_approved,false) then 'BLOCKED_CLASSIFICATION_APPROVAL'
when r.approved_count=0 then 'BLOCKED_APPROVED_STANDARD_RATES_MISSING'
else 'REVIEW_REQUIRED_RATE_SCOPE_AND_PERIOD_PARITY' end
from coverage c cross join rates r
$$;
revoke all on function costing.fn_preview_manufacturing_rate_cutover_gate(bigint) from public,anon,authenticated;
comment on function costing.fn_preview_manufacturing_rate_cutover_gate(bigint) is 'Fail-closed non-activating composite prerequisite for standard rate cutover. An approved rate count alone never makes cutover READY; component scope, period parity and conservation must be independently verified.';