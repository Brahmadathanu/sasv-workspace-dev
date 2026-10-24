-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table costing.cost_driver_policy_cutover_acceptance (
    id bigint generated always as identity primary key,
    cost_element_code text not null references costing.cost_element_driver_catalog(cost_element_code),
    policy_code text not null,
    policy_version integer not null check (policy_version > 0),
    envelope_id bigint null references costing.cost_driver_policy_envelope(id) on update restrict on delete restrict,
    specialised_policy_schema text null,
    specialised_policy_table text null,
    specialised_policy_id bigint null,
    accepted_refresh_run_id bigint not null references costing.costing_refresh_run(id) on update restrict on delete restrict,
    accepted_period_start date not null,
    accepted_valuation_date date not null,
    acceptance_status text not null default 'ACTIVE' check (acceptance_status in ('ACTIVE','RETIRED')),
    acceptance_reference text not null,
    acceptance_note text not null,
    accepted_at timestamptz not null default clock_timestamp(),
    created_at timestamptz not null default clock_timestamp(),
    constraint cost_driver_policy_cutover_identity_uq unique(cost_element_code,policy_code,policy_version,accepted_refresh_run_id),
    constraint cost_driver_policy_cutover_specialised_ref_chk check (
      (specialised_policy_schema is null and specialised_policy_table is null and specialised_policy_id is null)
      or
      (specialised_policy_schema is not null and specialised_policy_table is not null and specialised_policy_id is not null)
    )
);

create unique index uq_cost_driver_policy_cutover_active_element
on costing.cost_driver_policy_cutover_acceptance(cost_element_code)
where acceptance_status='ACTIVE';

create index idx_cost_driver_policy_cutover_run
on costing.cost_driver_policy_cutover_acceptance(accepted_refresh_run_id,cost_element_code);

revoke all on table costing.cost_driver_policy_cutover_acceptance from public, anon, authenticated;
grant select on table costing.cost_driver_policy_cutover_acceptance to service_role, postgres;

DO $gate$
declare
  v_run costing.costing_refresh_run%rowtype;
  v_count integer;
begin
  select count(*) into v_count
  from costing.costing_refresh_run r
  where r.period_start=date '2026-08-01'
    and r.valuation_date=date '2026-08-07'
    and r.overall_status='SUCCESS'
    and r.requested_scope='FULL_COSTING_REFRESH'
    and r.valuation_context_source='CAPTURED_AT_REQUEST';
  if v_count<>1 then raise exception 'Expected exactly one accepted exact run, found %',v_count; end if;

  select r.* into strict v_run
  from costing.costing_refresh_run r
  where r.period_start=date '2026-08-01'
    and r.valuation_date=date '2026-08-07'
    and r.overall_status='SUCCESS'
    and r.requested_scope='FULL_COSTING_REFRESH'
    and r.valuation_context_source='CAPTURED_AT_REQUEST';

  if (select count(*) from costing.cost_pool_monthly_snapshot s where s.refresh_run_id=v_run.id)<>7 then
    raise exception 'Accepted exact run % does not have seven frozen pools',v_run.id;
  end if;
  if (select count(*) from costing.costing_refresh_run_stage s where s.refresh_run_id=v_run.id and s.stage_status='SUCCESS')<>6 then
    raise exception 'Accepted exact run % does not have six successful stages',v_run.id;
  end if;
  if (select count(*) from costing.v_cost_driver_policy_registry r where r.lifecycle_status='APPROVED' and r.effective_from<=v_run.valuation_date and (r.effective_to is null or r.effective_to>=v_run.valuation_date))<>7 then
    raise exception 'Expected seven approved effective policies at accepted valuation date';
  end if;

  insert into costing.cost_driver_policy_cutover_acceptance(
    cost_element_code,policy_code,policy_version,envelope_id,
    specialised_policy_schema,specialised_policy_table,specialised_policy_id,
    accepted_refresh_run_id,accepted_period_start,accepted_valuation_date,
    acceptance_status,acceptance_reference,acceptance_note
  )
  select r.cost_element_code,r.policy_code,r.policy_version,r.envelope_id,
         r.specialised_policy_schema,r.specialised_policy_table,r.specialised_policy_id,
         v_run.id,v_run.period_start,v_run.valuation_date,
         'ACTIVE',
         'Gate 11Y.10E — seven-policy operational cutover after exact-run and browser acceptance, 2026-08-07',
         'Accepted after successful seven-pool exact-run execution, exact monetary reconciliation, Stage-04 exact-run immutability hardening, server Explain/DQ acceptance and browser Explain acceptance.'
  from costing.v_cost_driver_policy_registry r
  where r.lifecycle_status='APPROVED'
    and r.effective_from<=v_run.valuation_date
    and (r.effective_to is null or r.effective_to>=v_run.valuation_date);

  get diagnostics v_count=row_count;
  if v_count<>7 then raise exception 'Expected seven operational acceptance rows, inserted %',v_count; end if;
end
$gate$;

create or replace view costing.v_cost_driver_policy_registry as
with latest_envelope as (
  select distinct on (e.cost_element_code) e.*
  from costing.cost_driver_policy_envelope e
  order by e.cost_element_code,
    case e.lifecycle_status when 'APPROVED' then 1 when 'REVIEW_REQUIRED' then 2 when 'DRAFT' then 3 else 4 end,
    e.policy_version desc,e.id desc
), latest_dl as (
  select p.* from costing.direct_labour_workload_policy p order by p.policy_version desc,p.id desc limit 1
), latest_poh as (
  select p.* from costing.production_overhead_workload_policy p order by p.policy_version desc,p.id desc limit 1
), active_cutover as (
  select a.* from costing.cost_driver_policy_cutover_acceptance a where a.acceptance_status='ACTIVE'
), b as (
  select
    c.cost_element_code,c.cost_element_label,c.allocation_pool,c.driver_domain,
    c.specialised_policy_table as catalog_specialised_policy_table,c.requires_workload,c.requires_route_coverage,c.sort_order,
    case when c.cost_element_code in ('DIRECT_LABOUR','PRODUCTION_OVERHEAD') then null::bigint else e.id end as envelope_id,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.policy_code when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.policy_code else e.policy_code end as policy_code,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.policy_version when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.policy_version else e.policy_version end as policy_version,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.status when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.status else e.lifecycle_status end as lifecycle_status,
    case when a.id is not null then 'FINAL_OPERATIONAL'
         when c.cost_element_code in ('DIRECT_LABOUR','PRODUCTION_OVERHEAD') then 'FINAL_SERVER_PENDING_CUTOVER'
         else e.maturity_status end as maturity_status,
    case when a.id is not null then 'CUTOVER_ACTIVE'
         when c.cost_element_code in ('DIRECT_LABOUR','PRODUCTION_OVERHEAD') then 'SHADOW_READY'
         else e.cutover_status end as cutover_status,
    case when a.id is not null then 'CLIENT_READY'
         when c.cost_element_code in ('DIRECT_LABOUR','PRODUCTION_OVERHEAD') then 'CLIENT_PENDING'
         else e.client_status end as client_status,
    case when c.cost_element_code in ('DIRECT_LABOUR','PRODUCTION_OVERHEAD') then 'DATA_QUALITY_READY' else e.data_quality_status end as data_quality_status,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.formula_type when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.formula_type else e.formula_type end as formula_type,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.effective_from when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.effective_from else e.effective_from end as effective_from,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.effective_to when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.effective_to else e.effective_to end as effective_to,
    case when c.cost_element_code='DIRECT_LABOUR' then 'costing'::text when c.cost_element_code='PRODUCTION_OVERHEAD' then 'costing'::text else e.specialised_policy_schema end as specialised_policy_schema,
    case when c.cost_element_code='DIRECT_LABOUR' then 'direct_labour_workload_policy'::text when c.cost_element_code='PRODUCTION_OVERHEAD' then 'production_overhead_workload_policy'::text else e.specialised_policy_table end as specialised_policy_table,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.id when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.id else e.specialised_policy_id end as specialised_policy_id,
    e.supersedes_envelope_id,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.approval_reference when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.approval_reference else e.approval_reference end as approval_reference,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.policy_note when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.policy_note else e.policy_note end as policy_note,
    e.validation_note,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.created_at when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.created_at else e.created_at end as created_at,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.updated_at when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.updated_at else e.updated_at end as updated_at,
    case when c.cost_element_code='DIRECT_LABOUR' and dl.status in ('REVIEW_REQUIRED','APPROVED') then dl.updated_at
         when c.cost_element_code='PRODUCTION_OVERHEAD' and poh.status in ('REVIEW_REQUIRED','APPROVED') then poh.updated_at
         else e.submitted_at end as submitted_at,
    case when c.cost_element_code='DIRECT_LABOUR' then dl.approved_at when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.approved_at else e.approved_at end as approved_at,
    a.id as cutover_acceptance_id,a.accepted_refresh_run_id,a.accepted_period_start,a.accepted_valuation_date,
    a.acceptance_reference as cutover_acceptance_reference,a.accepted_at as cutover_accepted_at
  from costing.cost_element_driver_catalog c
  left join latest_envelope e on e.cost_element_code=c.cost_element_code
  left join latest_dl dl on c.cost_element_code='DIRECT_LABOUR'
  left join latest_poh poh on c.cost_element_code='PRODUCTION_OVERHEAD'
  left join active_cutover a on a.cost_element_code=c.cost_element_code
    and a.policy_code=(case when c.cost_element_code='DIRECT_LABOUR' then dl.policy_code when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.policy_code else e.policy_code end)
    and a.policy_version=(case when c.cost_element_code='DIRECT_LABOUR' then dl.policy_version when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.policy_version else e.policy_version end)
  where c.is_active
)
select
  cost_element_code,cost_element_label,allocation_pool,driver_domain,catalog_specialised_policy_table,
  requires_workload,requires_route_coverage,sort_order,envelope_id,policy_code,policy_version,lifecycle_status,
  maturity_status,cutover_status,client_status,data_quality_status,formula_type,effective_from,effective_to,
  specialised_policy_schema,specialised_policy_table,specialised_policy_id,supersedes_envelope_id,approval_reference,
  policy_note,validation_note,created_at,updated_at,submitted_at,approved_at,
  case when lifecycle_status='APPROVED' and cutover_acceptance_id is not null then 'ACTIVE_FINAL_POLICY'
       when policy_code is null then 'UNREGISTERED'
       when lifecycle_status='APPROVED' then 'APPROVED_NOT_CUT_OVER'
       when lifecycle_status='REVIEW_REQUIRED' then 'POLICY_REVIEW_REQUIRED'
       when lifecycle_status='DRAFT' then 'POLICY_DRAFT'
       else lifecycle_status end as registry_status,
  (lifecycle_status='APPROVED' and cutover_acceptance_id is not null) as stage03_cutover_authorised,
  cutover_acceptance_id,accepted_refresh_run_id,accepted_period_start,accepted_valuation_date,
  cutover_acceptance_reference,cutover_accepted_at
from b;

create or replace function costing.fn_validate_cost_driver_policy_envelope(p_envelope_id bigint)
returns jsonb
language plpgsql stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v costing.cost_driver_policy_envelope%rowtype;
  v_catalog costing.cost_element_driver_catalog%rowtype;
  v_errors jsonb := '[]'::jsonb;
  v_overlap_count bigint;
  v_cutover boolean := false;
begin
  select * into v from costing.cost_driver_policy_envelope where id=p_envelope_id;
  if not found then return jsonb_build_object('valid',false,'errors',jsonb_build_array('Driver policy envelope not found')); end if;
  select * into v_catalog from costing.cost_element_driver_catalog where cost_element_code=v.cost_element_code;
  if nullif(btrim(v.policy_note),'') is null then v_errors:=v_errors||jsonb_build_array('A meaningful policy note is required'); end if;
  if nullif(btrim(v.formula_type),'') is null then v_errors:=v_errors||jsonb_build_array('Formula type is required'); end if;
  if v.lifecycle_status in ('REVIEW_REQUIRED','APPROVED') and v.maturity_status='ARCHITECTURE_PENDING' then v_errors:=v_errors||jsonb_build_array('Architecture-pending policy cannot be submitted or approved'); end if;
  if v.lifecycle_status='APPROVED' and v.cutover_status='CUTOVER_ACTIVE' and v.maturity_status<>'FINAL_OPERATIONAL' then v_errors:=v_errors||jsonb_build_array('Active cutover requires FINAL_OPERATIONAL maturity'); end if;
  if v.cutover_status in ('CUTOVER_READY','CUTOVER_ACTIVE') and v.client_status<>'CLIENT_READY' then v_errors:=v_errors||jsonb_build_array('Cutover-ready or active policy requires CLIENT_READY'); end if;
  if v_catalog.requires_route_coverage and v.cutover_status in ('CUTOVER_READY','CUTOVER_ACTIVE') then v_errors:=v_errors||jsonb_build_array('Route-coverage acceptance must be separately verified before route-dependent cutover'); end if;
  select count(*) into v_overlap_count from costing.cost_driver_policy_envelope x
  where x.id<>v.id and x.cost_element_code=v.cost_element_code and x.lifecycle_status='APPROVED'
    and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]') && daterange(v.effective_from,coalesce(v.effective_to,'infinity'::date),'[]');
  if v.lifecycle_status='APPROVED' and v_overlap_count>0 then v_errors:=v_errors||jsonb_build_array('Approved effective period overlaps another approved envelope'); end if;
  select exists(select 1 from costing.cost_driver_policy_cutover_acceptance a
    where a.acceptance_status='ACTIVE' and a.cost_element_code=v.cost_element_code and a.policy_code=v.policy_code and a.policy_version=v.policy_version)
  into v_cutover;
  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'envelope_id',v.id,'cost_element_code',v.cost_element_code,
    'lifecycle_status',v.lifecycle_status,'maturity_status',v.maturity_status,'cutover_status',v.cutover_status,'client_status',v.client_status,
    'data_quality_status',v.data_quality_status,'requires_workload',v_catalog.requires_workload,'requires_route_coverage',v_catalog.requires_route_coverage,
    'stage03_cutover_authorised',v_cutover);
end;
$function$;

create or replace function public.rpc_get_cost_driver_policy_registry(p_cost_element_code text default null)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp'
as $function$
declare v_total bigint; v_active bigint;
begin
  perform public.require_permission('module:cost-build-manager',false);
  select count(*),count(*) filter(where stage03_cutover_authorised) into v_total,v_active
  from costing.v_cost_driver_policy_registry r
  where p_cost_element_code is null or r.cost_element_code=upper(btrim(p_cost_element_code));
  return jsonb_build_object(
    'stage03_cutover_status',case when v_total>0 and v_active=v_total then 'AUTHORISED_ACTIVE' when v_active>0 then 'PARTIALLY_AUTHORISED' else 'NOT_AUTHORISED' end,
    'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.sort_order,r.cost_element_code)
      from costing.v_cost_driver_policy_registry r
      where p_cost_element_code is null or r.cost_element_code=upper(btrim(p_cost_element_code))),'[]'::jsonb));
end;
$function$;

DO $detail$
declare v_def text;
begin
  select pg_get_functiondef('public.rpc_get_cost_driver_governance_detail(text)'::regprocedure) into v_def;
  v_def:=replace(v_def,'''stage03_cutover_authorised'',false','''stage03_cutover_authorised'',coalesce((v_registry->>''stage03_cutover_authorised'')::boolean,false)');
  execute v_def;
end
$detail$;

DO $verify$
declare v_total bigint; v_active bigint;
begin
  select count(*),count(*) filter(where registry_status='ACTIVE_FINAL_POLICY' and stage03_cutover_authorised)
    into v_total,v_active from costing.v_cost_driver_policy_registry;
  if v_total<>7 or v_active<>7 then raise exception 'Cutover registry verification failed: total %, active %',v_total,v_active; end if;
  if (select count(distinct accepted_refresh_run_id) from costing.cost_driver_policy_cutover_acceptance where acceptance_status='ACTIVE')<>1 then
    raise exception 'Active cutover acceptance rows do not share one exact run';
  end if;
end
$verify$;