create table costing.manufacturing_standard_rate_policy (
  id bigint generated always as identity primary key,
  policy_code text not null default 'PRODUCTION_DRIVEN_STANDARD_WORKLOAD_RATE',
  policy_version integer not null check (policy_version > 0),
  allocation_pool text not null check (allocation_pool in ('MANUFACTURING_LABOUR','PRODUCTION_OVERHEAD')),
  component_code text not null,
  cost_behaviour text check (cost_behaviour in ('FIXED','VARIABLE')),
  effective_from date not null,
  effective_to date,
  normal_workload_units numeric(24,8) check (normal_workload_units > 0),
  normal_budget_amount numeric(24,8) check (normal_budget_amount >= 0),
  workload_unit_code text not null default 'GOVERNED_ROUTE_WORKLOAD_UNIT',
  evidence_reference text,
  approval_reference text,
  status text not null default 'DRAFT' check (status in ('DRAFT','REVIEW_REQUIRED','APPROVED','SUPERSEDED')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint standard_rate_effective_dates check (effective_to is null or effective_to >= effective_from),
  constraint standard_rate_component_nonempty check (length(btrim(component_code))>0),
  constraint standard_rate_approval_complete check (
    status <> 'APPROVED' or (
      cost_behaviour is not null and normal_workload_units is not null
      and normal_budget_amount is not null
      and nullif(btrim(evidence_reference),'') is not null
      and nullif(btrim(approval_reference),'') is not null
      and approved_by is not null and approved_at is not null
    )
  ),
  unique(allocation_pool,component_code,policy_version)
);
create index manufacturing_standard_rate_policy_effective_idx
 on costing.manufacturing_standard_rate_policy(allocation_pool,component_code,effective_from,effective_to,status);
create function costing.fn_guard_manufacturing_standard_rate_policy()
returns trigger language plpgsql set search_path=costing,pg_temp as $$
begin
 if tg_op = 'DELETE' then
   raise exception 'Manufacturing standard-rate policy records cannot be deleted';
 end if;
 if tg_op='UPDATE' then
   if old.status in ('APPROVED','SUPERSEDED') then
     raise exception 'Approved/superseded standard-rate records are immutable; use a new version';
   end if;
   new.updated_at:=clock_timestamp();
 end if;
 if new.status='APPROVED' and exists (
   select 1 from costing.manufacturing_standard_rate_policy p
    where p.id<>new.id and p.status='APPROVED'
      and p.allocation_pool=new.allocation_pool and p.component_code=new.component_code
      and daterange(p.effective_from,coalesce(p.effective_to,'infinity'::date),'[]')
          && daterange(new.effective_from,coalesce(new.effective_to,'infinity'::date),'[]')
 ) then
   raise exception 'Overlapping approved standard-rate policy for pool/component';
 end if;
 return new;
end $$;
create trigger guard_manufacturing_standard_rate_policy
before insert or update or delete on costing.manufacturing_standard_rate_policy
for each row execute function costing.fn_guard_manufacturing_standard_rate_policy();
create function costing.fn_resolve_manufacturing_standard_rate(
 p_allocation_pool text,p_component_code text,p_valuation_date date
) returns table(policy_id bigint,policy_version integer,standard_rate numeric,cost_behaviour text,
 normal_workload_units numeric,normal_budget_amount numeric,evidence_reference text)
language sql stable security invoker set search_path=costing,pg_temp as $$
 select r.id,r.policy_version,
        r.normal_budget_amount/nullif(r.normal_workload_units,0),
        r.cost_behaviour,r.normal_workload_units,r.normal_budget_amount,r.evidence_reference
 from costing.manufacturing_standard_rate_policy r
 where r.allocation_pool=p_allocation_pool and r.component_code=p_component_code
   and r.status='APPROVED' and r.effective_from<=p_valuation_date
   and (r.effective_to is null or r.effective_to>=p_valuation_date)
 order by r.effective_from desc,r.policy_version desc,r.id desc
 limit 1
$$;
revoke all on costing.manufacturing_standard_rate_policy from public,anon,authenticated;
revoke all on function costing.fn_resolve_manufacturing_standard_rate(text,text,date) from public,anon,authenticated;
revoke all on function costing.fn_guard_manufacturing_standard_rate_policy() from public,anon,authenticated;
comment on table costing.manufacturing_standard_rate_policy is 'Non-activating effective-dated governance register. Existing costing refresh does not consume this table. Requires separate approved cutover.';