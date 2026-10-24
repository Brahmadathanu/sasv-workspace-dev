-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table if not exists costing.cost_element_driver_catalog (
    cost_element_code text primary key,
    cost_element_label text not null,
    allocation_pool text,
    driver_domain text not null,
    specialised_policy_table text,
    requires_workload boolean not null default false,
    requires_route_coverage boolean not null default false,
    is_active boolean not null default true,
    sort_order integer not null,
    note text,
    created_at timestamptz not null default clock_timestamp(),
    constraint cost_element_driver_catalog_code_chk check (cost_element_code ~ '^[A-Z][A-Z0-9_]*$'),
    constraint cost_element_driver_catalog_pool_chk check (
      allocation_pool is null or allocation_pool in (
        'DIRECT_LABOUR','PRODUCTION_OVERHEAD','QUALITY_CONTROL_OVERHEAD',
        'MATERIALS_STORES_OVERHEAD','ADMIN_OVERHEAD',
        'FINANCE_ADMIN_OVERHEAD','MARKETING_EXPENSE'
      )
    ),
    constraint cost_element_driver_catalog_domain_chk check (
      driver_domain in ('DIRECT_COST','ROUTE_WORKLOAD','ANALYTICAL_WORKLOAD','MATERIAL_HANDLING_WORKLOAD','MONETARY_EVIDENCE','ADMINISTRATIVE_CAUSAL','FINANCE_CAUSAL','DERIVED')
    )
);

insert into costing.cost_element_driver_catalog(
  cost_element_code,cost_element_label,allocation_pool,driver_domain,
  specialised_policy_table,requires_workload,requires_route_coverage,sort_order,note
)
values
 ('DIRECT_LABOUR','Direct Labour','DIRECT_LABOUR','ROUTE_WORKLOAD',null,true,true,10,'Current operational sales-share writer is provisional; final route-based labour workload remains pending.'),
 ('PRODUCTION_OVERHEAD','Production Overhead','PRODUCTION_OVERHEAD','ROUTE_WORKLOAD','costing.production_overhead_workload_policy',true,true,20,'Specialised route workload policy exists; Policy ID 1 remains REVIEW_REQUIRED and monetary cutover is blocked.'),
 ('QUALITY_CONTROL_OVERHEAD','Quality Control Overhead','QUALITY_CONTROL_OVERHEAD','ANALYTICAL_WORKLOAD','costing.qc_workload_policy',true,false,30,'Method-based workload policy exists; final-versus-provisional designation remains subject to review.'),
 ('MATERIALS_STORES_OVERHEAD','Materials / Stores Overhead','MATERIALS_STORES_OVERHEAD','MATERIAL_HANDLING_WORKLOAD','costing.materials_stores_workload_policy',true,false,40,'Mature RM/PM workload allocation architecture.'),
 ('ADMIN_OVERHEAD','Administrative Overhead','ADMIN_OVERHEAD','ADMINISTRATIVE_CAUSAL',null,false,false,50,'Current sales-share allocation is provisional; canonical causal driver remains pending.'),
 ('FINANCE_ADMIN_OVERHEAD','Finance/Admin Overhead','FINANCE_ADMIN_OVERHEAD','FINANCE_CAUSAL',null,false,false,60,'Current sales-share allocation is provisional; separate causal driver remains pending.'),
 ('MARKETING_EXPENSE','Marketing Expense','MARKETING_EXPENSE','MONETARY_EVIDENCE',null,false,false,70,'Common and regional signed billed-value architecture is implemented; governance and frozen-pool cutover remain pending.')
on conflict (cost_element_code) do update set
  cost_element_label=excluded.cost_element_label,
  allocation_pool=excluded.allocation_pool,
  driver_domain=excluded.driver_domain,
  specialised_policy_table=excluded.specialised_policy_table,
  requires_workload=excluded.requires_workload,
  requires_route_coverage=excluded.requires_route_coverage,
  sort_order=excluded.sort_order,
  note=excluded.note;

create table if not exists costing.cost_driver_policy_envelope (
    id bigint generated always as identity primary key,
    cost_element_code text not null references costing.cost_element_driver_catalog(cost_element_code),
    policy_code text not null,
    policy_version integer not null,
    lifecycle_status text not null default 'DRAFT',
    maturity_status text not null default 'ARCHITECTURE_PENDING',
    cutover_status text not null default 'NOT_READY',
    client_status text not null default 'CLIENT_PENDING',
    data_quality_status text not null default 'DATA_QUALITY_PENDING',
    formula_type text not null,
    effective_from date not null,
    effective_to date,
    specialised_policy_schema text,
    specialised_policy_table text,
    specialised_policy_id bigint,
    supersedes_envelope_id bigint references costing.cost_driver_policy_envelope(id),
    approval_reference text,
    policy_note text not null,
    validation_note text,
    created_by uuid,
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp(),
    submitted_by uuid,
    submitted_at timestamptz,
    approved_by uuid,
    approved_at timestamptz,
    superseded_by uuid,
    superseded_at timestamptz,
    constraint cost_driver_policy_envelope_code_chk check (policy_code ~ '^[A-Z][A-Z0-9_]*$'),
    constraint cost_driver_policy_envelope_version_chk check (policy_version > 0),
    constraint cost_driver_policy_envelope_dates_chk check (effective_to is null or effective_to >= effective_from),
    constraint cost_driver_policy_envelope_lifecycle_chk check (lifecycle_status in ('DRAFT','REVIEW_REQUIRED','APPROVED','SUPERSEDED','INACTIVE')),
    constraint cost_driver_policy_envelope_maturity_chk check (maturity_status in ('ARCHITECTURE_PENDING','PROVISIONAL_OPERATIONAL','FINAL_SERVER_PENDING_CUTOVER','FINAL_OPERATIONAL')),
    constraint cost_driver_policy_envelope_cutover_chk check (cutover_status in ('NOT_READY','PREVIEW_ONLY','SHADOW_READY','CUTOVER_READY','CUTOVER_ACTIVE','RETIRED')),
    constraint cost_driver_policy_envelope_client_chk check (client_status in ('CLIENT_PENDING','CLIENT_READY')),
    constraint cost_driver_policy_envelope_dq_chk check (data_quality_status in ('DATA_QUALITY_PENDING','DATA_QUALITY_READY','NOT_APPLICABLE')),
    constraint cost_driver_policy_envelope_specialised_ref_chk check (
      (specialised_policy_schema is null and specialised_policy_table is null and specialised_policy_id is null)
      or
      (specialised_policy_schema is not null and specialised_policy_table is not null and specialised_policy_id is not null)
    ),
    constraint cost_driver_policy_envelope_approval_chk check (
      lifecycle_status not in ('APPROVED','SUPERSEDED')
      or (approval_reference is not null and approved_at is not null)
    ),
    unique(cost_element_code,policy_code,policy_version)
);

create index if not exists cost_driver_policy_envelope_element_status_idx
on costing.cost_driver_policy_envelope(cost_element_code,lifecycle_status,effective_from,effective_to);

create unique index if not exists cost_driver_policy_envelope_approved_overlap_guard
on costing.cost_driver_policy_envelope(cost_element_code,effective_from,coalesce(effective_to,'infinity'::date),id)
where lifecycle_status='APPROVED';

create or replace function costing.fn_validate_cost_driver_policy_envelope(p_envelope_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path=costing,public,pg_temp
as $$
declare
  v costing.cost_driver_policy_envelope%rowtype;
  v_catalog costing.cost_element_driver_catalog%rowtype;
  v_errors jsonb := '[]'::jsonb;
  v_overlap_count bigint;
begin
  select * into v from costing.cost_driver_policy_envelope where id=p_envelope_id;
  if not found then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('Driver policy envelope not found'));
  end if;

  select * into v_catalog from costing.cost_element_driver_catalog where cost_element_code=v.cost_element_code;

  if nullif(btrim(v.policy_note),'') is null then
    v_errors:=v_errors||jsonb_build_array('A meaningful policy note is required');
  end if;
  if nullif(btrim(v.formula_type),'') is null then
    v_errors:=v_errors||jsonb_build_array('Formula type is required');
  end if;
  if v.lifecycle_status in ('REVIEW_REQUIRED','APPROVED') and v.maturity_status='ARCHITECTURE_PENDING' then
    v_errors:=v_errors||jsonb_build_array('Architecture-pending policy cannot be submitted or approved');
  end if;
  if v.lifecycle_status='APPROVED' and v.cutover_status='CUTOVER_ACTIVE' and v.maturity_status<>'FINAL_OPERATIONAL' then
    v_errors:=v_errors||jsonb_build_array('Active cutover requires FINAL_OPERATIONAL maturity');
  end if;
  if v.cutover_status in ('CUTOVER_READY','CUTOVER_ACTIVE') and v.client_status<>'CLIENT_READY' then
    v_errors:=v_errors||jsonb_build_array('Cutover-ready or active policy requires CLIENT_READY');
  end if;
  if v_catalog.requires_route_coverage and v.cutover_status in ('CUTOVER_READY','CUTOVER_ACTIVE') then
    v_errors:=v_errors||jsonb_build_array('Route-coverage acceptance must be separately verified before route-dependent cutover');
  end if;

  select count(*) into v_overlap_count
  from costing.cost_driver_policy_envelope x
  where x.id<>v.id
    and x.cost_element_code=v.cost_element_code
    and x.lifecycle_status='APPROVED'
    and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]')
        && daterange(v.effective_from,coalesce(v.effective_to,'infinity'::date),'[]');
  if v.lifecycle_status='APPROVED' and v_overlap_count>0 then
    v_errors:=v_errors||jsonb_build_array('Approved effective period overlaps another approved envelope');
  end if;

  return jsonb_build_object(
    'valid',jsonb_array_length(v_errors)=0,
    'errors',v_errors,
    'envelope_id',v.id,
    'cost_element_code',v.cost_element_code,
    'lifecycle_status',v.lifecycle_status,
    'maturity_status',v.maturity_status,
    'cutover_status',v.cutover_status,
    'client_status',v.client_status,
    'data_quality_status',v.data_quality_status,
    'requires_workload',v_catalog.requires_workload,
    'requires_route_coverage',v_catalog.requires_route_coverage,
    'stage03_cutover_authorised',false
  );
end;
$$;

create or replace function costing.fn_guard_cost_driver_policy_envelope()
returns trigger
language plpgsql
set search_path=costing,public,pg_temp
as $$
begin
  if tg_op='DELETE' then
    raise exception 'Cost driver policy envelopes are immutable and cannot be deleted';
  end if;

  if old.lifecycle_status in ('APPROVED','SUPERSEDED','INACTIVE') then
    if new is distinct from old then
      raise exception 'Approved, superseded or inactive driver policy envelopes are immutable';
    end if;
  end if;

  if old.lifecycle_status='REVIEW_REQUIRED' and (
      new.cost_element_code is distinct from old.cost_element_code
      or new.policy_code is distinct from old.policy_code
      or new.policy_version is distinct from old.policy_version
      or new.formula_type is distinct from old.formula_type
      or new.effective_from is distinct from old.effective_from
      or new.effective_to is distinct from old.effective_to
      or new.specialised_policy_schema is distinct from old.specialised_policy_schema
      or new.specialised_policy_table is distinct from old.specialised_policy_table
      or new.specialised_policy_id is distinct from old.specialised_policy_id
      or new.supersedes_envelope_id is distinct from old.supersedes_envelope_id
      or new.policy_note is distinct from old.policy_note
  ) then
    raise exception 'Submitted driver policy architecture is immutable; return to draft through a new version';
  end if;

  new.updated_at:=clock_timestamp();
  return new;
end;
$$;

drop trigger if exists trg_guard_cost_driver_policy_envelope on costing.cost_driver_policy_envelope;
create trigger trg_guard_cost_driver_policy_envelope
before update or delete on costing.cost_driver_policy_envelope
for each row execute function costing.fn_guard_cost_driver_policy_envelope();

create or replace view costing.v_cost_driver_policy_registry
with (security_invoker=true)
as
select
  c.cost_element_code,
  c.cost_element_label,
  c.allocation_pool,
  c.driver_domain,
  c.specialised_policy_table as catalog_specialised_policy_table,
  c.requires_workload,
  c.requires_route_coverage,
  c.sort_order,
  e.id as envelope_id,
  e.policy_code,
  e.policy_version,
  e.lifecycle_status,
  e.maturity_status,
  e.cutover_status,
  e.client_status,
  e.data_quality_status,
  e.formula_type,
  e.effective_from,
  e.effective_to,
  e.specialised_policy_schema,
  e.specialised_policy_table,
  e.specialised_policy_id,
  e.supersedes_envelope_id,
  e.approval_reference,
  e.policy_note,
  e.validation_note,
  e.created_at,
  e.updated_at,
  e.submitted_at,
  e.approved_at,
  case
    when e.id is null then 'UNREGISTERED'
    when e.lifecycle_status='APPROVED' and e.cutover_status='CUTOVER_ACTIVE' then 'ACTIVE_FINAL_POLICY'
    when e.lifecycle_status='APPROVED' then 'APPROVED_NOT_CUT_OVER'
    when e.lifecycle_status='REVIEW_REQUIRED' then 'POLICY_REVIEW_REQUIRED'
    when e.lifecycle_status='DRAFT' then 'POLICY_DRAFT'
    else e.lifecycle_status
  end as registry_status,
  false as stage03_cutover_authorised
from costing.cost_element_driver_catalog c
left join lateral (
  select x.*
  from costing.cost_driver_policy_envelope x
  where x.cost_element_code=c.cost_element_code
  order by
    case x.lifecycle_status when 'APPROVED' then 1 when 'REVIEW_REQUIRED' then 2 when 'DRAFT' then 3 else 4 end,
    x.policy_version desc,
    x.id desc
  limit 1
) e on true
where c.is_active;

create or replace function public.rpc_get_cost_driver_policy_registry(p_cost_element_code text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,costing,pg_temp
as $$
begin
  perform public.require_permission('module:cost-build-manager',false);
  return jsonb_build_object(
    'stage03_cutover_status','NOT_AUTHORISED_BY_THIS_GATE',
    'rows',coalesce((
      select jsonb_agg(to_jsonb(r) order by r.sort_order,r.cost_element_code)
      from costing.v_cost_driver_policy_registry r
      where p_cost_element_code is null or r.cost_element_code=upper(btrim(p_cost_element_code))
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.rpc_create_cost_driver_policy_envelope_draft(
  p_cost_element_code text,
  p_policy_code text,
  p_policy_version integer,
  p_formula_type text,
  p_effective_from date,
  p_effective_to date default null,
  p_maturity_status text default 'ARCHITECTURE_PENDING',
  p_cutover_status text default 'NOT_READY',
  p_client_status text default 'CLIENT_PENDING',
  p_data_quality_status text default 'DATA_QUALITY_PENDING',
  p_policy_note text default null,
  p_specialised_policy_schema text default null,
  p_specialised_policy_table text default null,
  p_specialised_policy_id bigint default null,
  p_supersedes_envelope_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,costing,pg_temp
as $$
declare v_id bigint;
begin
  perform public.require_permission('module:cost-build-manager',true);
  insert into costing.cost_driver_policy_envelope(
    cost_element_code,policy_code,policy_version,lifecycle_status,
    maturity_status,cutover_status,client_status,data_quality_status,
    formula_type,effective_from,effective_to,
    specialised_policy_schema,specialised_policy_table,specialised_policy_id,
    supersedes_envelope_id,policy_note,created_by
  ) values (
    upper(btrim(p_cost_element_code)),upper(btrim(p_policy_code)),p_policy_version,'DRAFT',
    upper(btrim(p_maturity_status)),upper(btrim(p_cutover_status)),upper(btrim(p_client_status)),upper(btrim(p_data_quality_status)),
    upper(btrim(p_formula_type)),p_effective_from,p_effective_to,
    nullif(btrim(p_specialised_policy_schema),''),nullif(btrim(p_specialised_policy_table),''),p_specialised_policy_id,
    p_supersedes_envelope_id,btrim(p_policy_note),auth.uid()
  ) returning id into v_id;

  return jsonb_build_object(
    'envelope_id',v_id,
    'status','DRAFT',
    'validation',costing.fn_validate_cost_driver_policy_envelope(v_id),
    'stage03_cutover_authorised',false
  );
end;
$$;

create or replace function public.rpc_submit_cost_driver_policy_envelope_for_review(p_envelope_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=public,costing,pg_temp
as $$
declare v_validation jsonb;
begin
  perform public.require_permission('module:cost-build-manager',true);
  v_validation:=costing.fn_validate_cost_driver_policy_envelope(p_envelope_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then
    raise exception 'Driver policy envelope % is invalid: %',p_envelope_id,v_validation->'errors';
  end if;
  update costing.cost_driver_policy_envelope
  set lifecycle_status='REVIEW_REQUIRED',submitted_by=auth.uid(),submitted_at=clock_timestamp()
  where id=p_envelope_id and lifecycle_status='DRAFT';
  if not found then raise exception 'Only a DRAFT envelope may be submitted'; end if;
  return jsonb_build_object('envelope_id',p_envelope_id,'status','REVIEW_REQUIRED','stage03_cutover_authorised',false);
end;
$$;

comment on table costing.cost_element_driver_catalog is
'Canonical catalog of allocated cost elements and their specialised driver domains. This catalog does not approve or activate any cost driver.';
comment on table costing.cost_driver_policy_envelope is
'Common governance envelope for versioned cost driver policies. Specialised formula parameters remain in element-specific policy tables. Envelope approval or cutover does not modify Stage 03 automatically.';
comment on view costing.v_cost_driver_policy_registry is
'Client-facing registry of cost elements and their latest governance envelope. UNREGISTERED means no canonical envelope has yet been created.';

revoke all on costing.cost_element_driver_catalog from public,anon,authenticated;
revoke all on costing.cost_driver_policy_envelope from public,anon,authenticated;
revoke all on costing.v_cost_driver_policy_registry from public,anon,authenticated;
revoke all on function costing.fn_validate_cost_driver_policy_envelope(bigint) from public,anon,authenticated;
revoke all on function public.rpc_get_cost_driver_policy_registry(text) from public,anon;
revoke all on function public.rpc_create_cost_driver_policy_envelope_draft(text,text,integer,text,date,date,text,text,text,text,text,text,text,bigint,bigint) from public,anon;
revoke all on function public.rpc_submit_cost_driver_policy_envelope_for_review(bigint) from public,anon;
grant execute on function public.rpc_get_cost_driver_policy_registry(text) to authenticated,service_role;
grant execute on function public.rpc_create_cost_driver_policy_envelope_draft(text,text,integer,text,date,date,text,text,text,text,text,text,text,bigint,bigint) to authenticated,service_role;
grant execute on function public.rpc_submit_cost_driver_policy_envelope_for_review(bigint) to authenticated,service_role;