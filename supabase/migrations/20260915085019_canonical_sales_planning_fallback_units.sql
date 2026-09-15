-- SOURCE-CONTROL PARITY for live ledger version 20260915085019
-- name: canonical_sales_planning_fallback_units
-- Captured from supabase_migrations.schema_migrations.statements (live).
-- DO NOT reapply to production (already applied).

create table if not exists costing.sales_planning_fallback_unit_policy (
  id bigserial primary key,
  default_sales_units numeric not null check (default_sales_units > 0),
  effective_from date not null,
  status text not null default 'APPROVED' check (status in ('APPROVED','CANCELLED')),
  reason text not null,
  approval_reference text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default clock_timestamp()
);

create unique index if not exists uq_sales_planning_fallback_effective_approved
on costing.sales_planning_fallback_unit_policy(effective_from)
where status='APPROVED';

create or replace function costing.fn_guard_sales_planning_fallback_unit_policy()
returns trigger
language plpgsql
set search_path=costing,public,pg_temp
as $$
begin
  if tg_op='DELETE' then
    raise exception 'Sales Planning Fallback Unit policies are append-only and cannot be deleted';
  end if;
  if tg_op='UPDATE' and new is distinct from old then
    raise exception 'Sales Planning Fallback Unit policies are immutable; create a successor version';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_sales_planning_fallback_unit_policy on costing.sales_planning_fallback_unit_policy;
create trigger trg_guard_sales_planning_fallback_unit_policy
before update or delete on costing.sales_planning_fallback_unit_policy
for each row execute function costing.fn_guard_sales_planning_fallback_unit_policy();

insert into costing.sales_planning_fallback_unit_policy(default_sales_units,effective_from,status,reason,approval_reference,created_by)
select 10,'2026-09-10'::date,'APPROVED',
       'Canonical governed planning fallback quantity shared by new-SKU, new-product/no-history, regional no-history/no-positive-history and non-positive-net-actual-history costing scenarios. Formalises the existing 10-unit business rule as one maintained value.',
       'GATE6C-SEP2026-CANONICAL-SALES-PLANNING-FALLBACK-10',
       'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid
where not exists (
  select 1 from costing.sales_planning_fallback_unit_policy where effective_from='2026-09-10'::date and status='APPROVED'
);

create or replace function costing.fn_resolve_sales_planning_fallback_units_as_of(p_valuation_date date)
returns table(policy_id bigint,default_sales_units numeric,effective_from date,resolution_status text,qualifying_policy_count bigint,resolution_note text)
language sql stable security definer
set search_path=costing,public,pg_temp
as $$
with eligible as (
  select p.*
  from costing.sales_planning_fallback_unit_policy p
  where p.status='APPROVED' and p.effective_from<=p_valuation_date
), latest_date as (
  select max(effective_from) effective_from from eligible
), candidates as (
  select e.* from eligible e join latest_date l on l.effective_from=e.effective_from
), s as (select count(*)::bigint n from candidates)
select case when s.n=1 then c.id end,
       case when s.n=1 then c.default_sales_units end,
       case when s.n=1 then c.effective_from end,
       case when p_valuation_date is null then 'INVALID_CONTEXT'
            when s.n=0 then 'MISSING'
            when s.n>1 then 'AMBIGUOUS'
            else 'RESOLVED' end,
       s.n,
       case when p_valuation_date is null then 'Valuation date is required.'
            when s.n=0 then 'No canonical Sales Planning Fallback Unit policy is effective on the valuation date.'
            when s.n>1 then 'Multiple canonical Sales Planning Fallback Unit policies share the latest effective date.'
            else format('Canonical Sales Planning Fallback Unit policy %s resolves %s units.',c.id,c.default_sales_units) end
from s left join candidates c on s.n=1;
$$;

create or replace function costing.fn_resolve_sales_allocation_default_policy_as_of(p_scenario_code text,p_valuation_date date)
returns table(policy_id bigint,scenario_code text,default_sales_units numeric,effective_from date,effective_to date,resolution_status text,qualifying_policy_count bigint,resolution_note text)
language sql stable security definer
set search_path=costing,public,pg_temp
as $$
with n as (
 select upper(btrim(coalesce(p_scenario_code,''))) scenario_code,p_valuation_date valuation_date
), c as (
 select p.* from costing.sales_allocation_default_policy p cross join n
 where p.scenario_code=n.scenario_code and p.status in ('APPROVED','CLOSED')
   and p.effective_from<=n.valuation_date and (p.effective_to is null or p.effective_to>=n.valuation_date)
), s as (select count(*)::bigint n from c), f as (
 select * from costing.fn_resolve_sales_planning_fallback_units_as_of(p_valuation_date)
)
select case when s.n=1 and f.resolution_status='RESOLVED' then c.id end,
       n.scenario_code,
       case when s.n=1 and f.resolution_status='RESOLVED' then f.default_sales_units end,
       case when s.n=1 and f.resolution_status='RESOLVED' then greatest(c.effective_from,f.effective_from) end,
       case when s.n=1 and f.resolution_status='RESOLVED' then c.effective_to end,
       case when p_valuation_date is null then 'INVALID_CONTEXT'
            when n.scenario_code not in ('NEW_SKU_EXISTING_PRODUCT','NEW_PRODUCT_NO_HISTORY') then 'INVALID_SCENARIO'
            when s.n=0 then 'MISSING'
            when s.n>1 then 'AMBIGUOUS'
            when f.resolution_status<>'RESOLVED' then f.resolution_status
            else 'RESOLVED' end,
       s.n,
       case when p_valuation_date is null then 'Valuation date is required.'
            when n.scenario_code not in ('NEW_SKU_EXISTING_PRODUCT','NEW_PRODUCT_NO_HISTORY') then 'Sales-allocation default-policy scenario is invalid.'
            when s.n=0 then 'No governed scenario policy is effective on the valuation date.'
            when s.n>1 then 'Multiple governed scenario policies overlap on the valuation date.'
            when f.resolution_status<>'RESOLVED' then f.resolution_note
            else format('Scenario policy %s uses canonical Sales Planning Fallback Unit policy %s: %s units.',c.id,f.policy_id,f.default_sales_units) end
from n cross join s cross join f left join c on s.n=1;
$$;

create or replace function costing.fn_resolve_regional_sales_default_policy_as_of(p_scenario_code text,p_region_code text,p_valuation_date date)
returns table(policy_id bigint,scenario_code text,region_code text,default_sales_units numeric,effective_from date,effective_to date,resolution_status text,qualifying_policy_count bigint,resolution_note text)
language sql stable security definer
set search_path=costing,public,pg_temp
as $$
with n as (
 select upper(btrim(coalesce(p_scenario_code,''))) scenario_code,
        upper(btrim(coalesce(p_region_code,''))) region_code,p_valuation_date valuation_date
), c as (
 select p.* from costing.regional_sales_allocation_default_policy p cross join n
 where p.scenario_code=n.scenario_code and p.region_code=n.region_code
   and p.status in ('APPROVED','CLOSED') and p.effective_from<=n.valuation_date
   and (p.effective_to is null or p.effective_to>=n.valuation_date)
), s as (select count(*)::bigint n from c), f as (
 select * from costing.fn_resolve_sales_planning_fallback_units_as_of(p_valuation_date)
)
select case when s.n=1 and f.resolution_status='RESOLVED' then c.id end,
       n.scenario_code,n.region_code,
       case when s.n=1 and f.resolution_status='RESOLVED' then f.default_sales_units end,
       case when s.n=1 and f.resolution_status='RESOLVED' then greatest(c.effective_from,f.effective_from) end,
       case when s.n=1 and f.resolution_status='RESOLVED' then c.effective_to end,
       case when p_valuation_date is null then 'INVALID_CONTEXT'
            when n.scenario_code not in ('NO_ELIGIBLE_REGIONAL_HISTORY','NO_POSITIVE_REGIONAL_HISTORY','NON_POSITIVE_NET_ACTUAL_HISTORY') then 'INVALID_SCENARIO'
            when n.region_code not in ('IK','OK') then 'INVALID_REGION'
            when s.n=0 then 'MISSING'
            when s.n>1 then 'AMBIGUOUS'
            when f.resolution_status<>'RESOLVED' then f.resolution_status
            else 'RESOLVED' end,
       s.n,
       case when p_valuation_date is null then 'Valuation date is required.'
            when n.scenario_code not in ('NO_ELIGIBLE_REGIONAL_HISTORY','NO_POSITIVE_REGIONAL_HISTORY','NON_POSITIVE_NET_ACTUAL_HISTORY') then 'Regional sales-allocation default scenario is invalid.'
            when n.region_code not in ('IK','OK') then 'Region must be IK or OK.'
            when s.n=0 then 'No governed regional scenario policy is effective on the valuation date.'
            when s.n>1 then 'Multiple governed regional scenario policies overlap on the valuation date.'
            when f.resolution_status<>'RESOLVED' then f.resolution_note
            else format('Regional scenario policy %s uses canonical Sales Planning Fallback Unit policy %s: %s units.',c.id,f.policy_id,f.default_sales_units) end
from n cross join s cross join f left join c on s.n=1;
$$;

create or replace view costing.v_sales_planning_fallback_policy_current as
select f.policy_id,f.default_sales_units,f.effective_from,f.resolution_status,f.resolution_note,
       jsonb_build_array(
         'NEW_SKU_EXISTING_PRODUCT','NEW_PRODUCT_NO_HISTORY','NO_ELIGIBLE_REGIONAL_HISTORY',
         'NO_POSITIVE_REGIONAL_HISTORY','NON_POSITIVE_NET_ACTUAL_HISTORY'
       ) as affected_scenarios,
       'Changing this governed value affects all listed common/regional fallback scenarios in future exact runs; accepted evidence whose resolved quantity changes will require fresh acceptance.'::text as impact_note
from costing.fn_resolve_sales_planning_fallback_units_as_of(current_date) f;

create or replace function costing.rpc_create_sales_planning_fallback_unit_policy(p_default_sales_units numeric,p_effective_from date,p_reason text,p_approval_reference text default null)
returns table(policy_id bigint,default_sales_units numeric,effective_from date,affected_scenarios jsonb,impact_note text)
language plpgsql security definer
set search_path=costing,public,pg_temp
as $$
declare v_actor uuid:=auth.uid(); v_id bigint;
begin
  if v_actor is null then raise exception 'Authenticated actor is required'; end if;
  if not costing.fn_actor_has_permission(v_actor,'module:costing-control-center','edit') then raise exception 'Costing Control Center edit permission is required'; end if;
  if p_default_sales_units is null or p_default_sales_units<=0 then raise exception 'Positive default sales units are required'; end if;
  if p_effective_from is null then raise exception 'Effective-from date is required'; end if;
  if coalesce(btrim(p_reason),'')='' then raise exception 'Reason is required'; end if;
  if exists(select 1 from costing.sales_planning_fallback_unit_policy p where p.status='APPROVED' and p.effective_from=p_effective_from) then
    raise exception 'A canonical Sales Planning Fallback Unit policy already exists for effective date %',p_effective_from;
  end if;
  insert into costing.sales_planning_fallback_unit_policy(default_sales_units,effective_from,status,reason,approval_reference,created_by)
  values(p_default_sales_units,p_effective_from,'APPROVED',btrim(p_reason),nullif(btrim(p_approval_reference),''),v_actor)
  returning id into v_id;
  return query select v_id,p_default_sales_units,p_effective_from,
    jsonb_build_array('NEW_SKU_EXISTING_PRODUCT','NEW_PRODUCT_NO_HISTORY','NO_ELIGIBLE_REGIONAL_HISTORY','NO_POSITIVE_REGIONAL_HISTORY','NON_POSITIVE_NET_ACTUAL_HISTORY'),
    'This one governed change affects all linked sales-planning fallback scenarios in future exact runs. Any acceptance bound to a changed resolved quantity must be reviewed again.'::text;
end;
$$;
