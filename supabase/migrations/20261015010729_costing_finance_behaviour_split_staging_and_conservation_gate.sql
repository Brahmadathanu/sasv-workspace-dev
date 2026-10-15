
create table costing.manufacturing_cost_behaviour_split (
 id bigint generated always as identity primary key,
 reference_refresh_run_id bigint not null references costing.costing_refresh_run(id),
 source_component_code text not null,
 split_code text not null,
 cost_behaviour text not null check(cost_behaviour in ('FIXED','VARIABLE','DIRECT_ATTRIBUTABLE')),
 source_reference_amount numeric(22,8) not null check(source_reference_amount>=0),
 evidence_reference text not null check(length(btrim(evidence_reference))>0),
 approval_reference text,
 approval_by uuid,
 approved_at timestamptz,
 status text not null default 'DRAFT' check(status in ('DRAFT','REVIEW_REQUIRED','APPROVED')),
 created_at timestamptz not null default now(),
 unique(reference_refresh_run_id,source_component_code,split_code),
 constraint behaviour_split_approved_evidence check(status<>'APPROVED' or
 (nullif(btrim(approval_reference),'') is not null and approval_by is not null and approved_at is not null))
);
revoke all on costing.manufacturing_cost_behaviour_split from public,anon,authenticated;
create function costing.fn_preview_manufacturing_behaviour_split_conservation(p_refresh_run_id bigint)
returns table(source_component_code text,source_amount numeric,classified_amount numeric,
unclassified_amount numeric,approved_amount numeric,split_count bigint,conservation_status text)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
with sources as(
 select component_code,source_amount
 from costing.fn_preview_manufacturing_rate_approval_inputs(p_refresh_run_id)
), splits as(
 select source_component_code,sum(source_reference_amount) classified,
 sum(source_reference_amount) filter(where status='APPROVED') approved,
 count(*) split_count
 from costing.manufacturing_cost_behaviour_split
 where reference_refresh_run_id=p_refresh_run_id
 group by source_component_code
)
select s.component_code,s.source_amount,coalesce(t.classified,0),
s.source_amount-coalesce(t.classified,0),coalesce(t.approved,0),coalesce(t.split_count,0),
case when coalesce(t.classified,0)>s.source_amount+0.000001 then 'BLOCKED_OVERCLASSIFIED'
when coalesce(t.classified,0)<s.source_amount-0.000001 then 'REVIEW_REQUIRED_UNCLASSIFIED'
when coalesce(t.approved,0)<s.source_amount-0.000001 then 'REVIEW_REQUIRED_APPROVAL'
else 'SOURCE_SPLIT_APPROVED_AND_CONSERVED' end
from sources s left join splits t on t.source_component_code=s.component_code
$$;
revoke all on function costing.fn_preview_manufacturing_behaviour_split_conservation(bigint) from public,anon,authenticated;
comment on table costing.manufacturing_cost_behaviour_split is 'Non-activating audited classification of reference source amounts. Does not itself approve normal budgets or capacity and must not substitute for manufacturing_standard_rate_policy.';
