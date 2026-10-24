-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_guard_production_overhead_policy()
returns trigger
language plpgsql
set search_path=costing,public,pg_temp
as $$
begin
  if tg_op='DELETE' then
    raise exception 'Production Overhead workload policies are append-only and cannot be deleted';
  end if;
  if old.status='APPROVED' then
    if new is distinct from old then
      raise exception 'Approved Production Overhead workload policy is immutable; create a new version';
    end if;
  elsif old.status='REVIEW_REQUIRED' then
    if new.policy_code is distinct from old.policy_code
       or new.policy_version is distinct from old.policy_version
       or new.effective_from is distinct from old.effective_from
       or new.effective_to is distinct from old.effective_to
       or new.formula_type is distinct from old.formula_type
       or new.policy_note is distinct from old.policy_note
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Policy core fields are immutable while under review';
    end if;
  end if;
  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists trg_guard_production_overhead_policy on costing.production_overhead_workload_policy;
create trigger trg_guard_production_overhead_policy
before update or delete on costing.production_overhead_workload_policy
for each row execute function costing.fn_guard_production_overhead_policy();

create or replace function costing.fn_guard_production_overhead_factor()
returns trigger
language plpgsql
set search_path=costing,public,pg_temp
as $$
declare v_status text; v_policy_id bigint;
begin
  v_policy_id:=case when tg_op='DELETE' then old.policy_id else new.policy_id end;
  select status into v_status from costing.production_overhead_workload_policy where id=v_policy_id;
  if v_status is null then raise exception 'Production Overhead policy % not found',v_policy_id; end if;
  if v_status<>'DRAFT' then
    raise exception 'Production Overhead factors are mutable only while policy is DRAFT';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

do $$
begin
  if not exists(select 1 from pg_trigger where tgname='trg_guard_production_overhead_scope_factor') then
    create trigger trg_guard_production_overhead_scope_factor before insert or update or delete on costing.production_overhead_scope_factor for each row execute function costing.fn_guard_production_overhead_factor();
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_guard_production_overhead_behaviour_factor') then
    create trigger trg_guard_production_overhead_behaviour_factor before insert or update or delete on costing.production_overhead_behaviour_factor for each row execute function costing.fn_guard_production_overhead_factor();
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_guard_production_overhead_resource_factor') then
    create trigger trg_guard_production_overhead_resource_factor before insert or update or delete on costing.production_overhead_resource_factor for each row execute function costing.fn_guard_production_overhead_factor();
  end if;
end $$;

create or replace function public.rpc_submit_production_overhead_workload_policy_for_review(p_policy_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=public,costing,pg_temp
as $$
declare v_validation jsonb; v_row costing.production_overhead_workload_policy%rowtype;
begin
  perform public.require_permission('module:production-route-manager',true);
  select * into v_row from costing.production_overhead_workload_policy where id=p_policy_id for update;
  if not found then raise exception 'Production Overhead policy % not found',p_policy_id; end if;
  if v_row.status<>'DRAFT' then raise exception 'Only DRAFT Production Overhead policies may be submitted for review'; end if;
  v_validation:=costing.fn_validate_production_overhead_workload_policy(p_policy_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then
    raise exception 'Production Overhead policy % is invalid: %',p_policy_id,v_validation->'errors';
  end if;
  update costing.production_overhead_workload_policy set status='REVIEW_REQUIRED' where id=p_policy_id;
  return jsonb_build_object('policy_id',p_policy_id,'status','REVIEW_REQUIRED','validation',v_validation);
end;
$$;

create or replace function public.rpc_approve_production_overhead_workload_policy(p_policy_id bigint,p_approval_reference text)
returns jsonb
language plpgsql
security definer
set search_path=public,costing,pg_temp
as $$
declare v_validation jsonb; v_row costing.production_overhead_workload_policy%rowtype;
begin
  perform public.require_permission('module:production-route-manager',true);
  if nullif(btrim(p_approval_reference),'') is null then raise exception 'approval_reference is required'; end if;
  select * into v_row from costing.production_overhead_workload_policy where id=p_policy_id for update;
  if not found then raise exception 'Production Overhead policy % not found',p_policy_id; end if;
  if v_row.status<>'REVIEW_REQUIRED' then raise exception 'Only REVIEW_REQUIRED Production Overhead policies may be approved'; end if;
  v_validation:=costing.fn_validate_production_overhead_workload_policy(p_policy_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then
    raise exception 'Production Overhead policy % is invalid: %',p_policy_id,v_validation->'errors';
  end if;
  if exists(
    select 1 from costing.production_overhead_workload_policy p
    where p.id<>p_policy_id and p.status='APPROVED'
      and daterange(p.effective_from,coalesce(p.effective_to,'infinity'::date),'[]') && daterange(v_row.effective_from,coalesce(v_row.effective_to,'infinity'::date),'[]')
  ) then raise exception 'Approved Production Overhead policy effective dates overlap an existing approved policy'; end if;
  update costing.production_overhead_workload_policy
  set status='APPROVED',approval_reference=btrim(p_approval_reference),approved_by=auth.uid(),approved_at=clock_timestamp()
  where id=p_policy_id;
  return jsonb_build_object('policy_id',p_policy_id,'status','APPROVED','approval_reference',btrim(p_approval_reference),'validation',v_validation);
end;
$$;

revoke all on function public.rpc_submit_production_overhead_workload_policy_for_review(bigint) from public,anon;
revoke all on function public.rpc_approve_production_overhead_workload_policy(bigint,text) from public,anon;
grant execute on function public.rpc_submit_production_overhead_workload_policy_for_review(bigint) to authenticated;
grant execute on function public.rpc_approve_production_overhead_workload_policy(bigint,text) to authenticated;

create table if not exists costing.product_production_overhead_workload_snapshot(
  id bigint generated always as identity primary key,
  period_start date not null,
  valuation_date date not null,
  refresh_run_id bigint not null references costing.costing_refresh_run(id),
  policy_id bigint not null references costing.production_overhead_workload_policy(id),
  product_id bigint not null references public.products(id),
  product_name text not null,
  product_base_uom text,
  route_family_id bigint,
  family_route_id bigint,
  product_route_id bigint,
  effective_route_source text,
  batch_size_ref_id bigint references public.production_batch_size_ref(id),
  preferred_batch_size numeric,
  monthly_product_base_qty numeric,
  monthly_driver_status text,
  monthly_batch_equivalents numeric,
  effective_step_count integer not null default 0,
  included_step_count integer not null default 0,
  passive_step_count integer not null default 0,
  excluded_step_count integer not null default 0,
  route_factor numeric,
  workload_units numeric,
  workload_status text not null,
  workload_reason_code text not null,
  workload_note text not null,
  recipient_product_count integer not null,
  ready_product_count integer not null,
  blocked_product_count integer not null,
  workload_coverage_ratio numeric not null,
  company_ready_workload_units numeric,
  captured_at timestamptz not null default clock_timestamp(),
  unique(refresh_run_id,product_id)
);

create table if not exists costing.product_production_overhead_step_snapshot(
  id bigint generated always as identity primary key,
  period_start date not null,
  valuation_date date not null,
  refresh_run_id bigint not null references costing.costing_refresh_run(id),
  policy_id bigint not null references costing.production_overhead_workload_policy(id),
  product_workload_snapshot_id bigint not null references costing.product_production_overhead_workload_snapshot(id),
  product_id bigint not null references public.products(id),
  sequence_no integer not null,
  effective_step_key text not null,
  source_type text not null,
  base_step_id bigint,
  override_id bigint,
  production_overhead_scope text not null,
  scope_factor numeric not null,
  behaviour_code text not null,
  behaviour_factor numeric not null,
  resource_class_code text not null,
  resource_factor numeric not null,
  expected_occurrence_count numeric not null,
  standard_cycle_count numeric not null,
  step_factor numeric not null,
  captured_at timestamptz not null default clock_timestamp(),
  unique(refresh_run_id,product_id,sequence_no,effective_step_key)
);

create table if not exists costing.sku_production_overhead_allocation_snapshot(
  id bigint generated always as identity primary key,
  period_start date not null,
  valuation_date date not null,
  refresh_run_id bigint not null references costing.costing_refresh_run(id),
  policy_id bigint not null references costing.production_overhead_workload_policy(id),
  product_workload_snapshot_id bigint not null references costing.product_production_overhead_workload_snapshot(id),
  sku_id bigint not null,
  product_id bigint not null references public.products(id),
  product_name text not null,
  pack_size numeric,
  pack_uom text,
  sku_base_qty_per_unit numeric,
  monthly_sku_base_qty numeric,
  monthly_product_base_qty numeric,
  sku_within_product_share numeric,
  production_overhead_pool_amount numeric,
  product_workload_share numeric,
  product_production_overhead_allocation numeric,
  production_overhead_cost_per_base_uom numeric,
  production_overhead_cost_per_sku numeric,
  allocation_status text not null,
  allocation_reason_code text not null,
  allocation_note text not null,
  captured_at timestamptz not null default clock_timestamp(),
  unique(refresh_run_id,sku_id)
);

create or replace function costing.fn_immutable_production_overhead_snapshot()
returns trigger
language plpgsql
set search_path=costing,public,pg_temp
as $$ begin raise exception 'Production Overhead snapshots are immutable'; end; $$;

do $$
begin
  if not exists(select 1 from pg_trigger where tgname='trg_immutable_product_production_overhead_workload_snapshot') then
    create trigger trg_immutable_product_production_overhead_workload_snapshot before update or delete on costing.product_production_overhead_workload_snapshot for each row execute function costing.fn_immutable_production_overhead_snapshot();
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_immutable_product_production_overhead_step_snapshot') then
    create trigger trg_immutable_product_production_overhead_step_snapshot before update or delete on costing.product_production_overhead_step_snapshot for each row execute function costing.fn_immutable_production_overhead_snapshot();
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_immutable_sku_production_overhead_allocation_snapshot') then
    create trigger trg_immutable_sku_production_overhead_allocation_snapshot before update or delete on costing.sku_production_overhead_allocation_snapshot for each row execute function costing.fn_immutable_production_overhead_snapshot();
  end if;
end $$;

create or replace function costing.rpc_refresh_production_overhead_workload_snapshot(p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=costing,public,pg_temp
as $$
declare
  v_period_start date:=date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_policy costing.production_overhead_workload_policy%rowtype;
  v_pool numeric;
  v_recipient_count integer;
  v_ready_count integer;
  v_blocked_count integer;
  v_coverage numeric;
  v_company_workload numeric;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then raise exception 'period_start, valuation_date and refresh_run_id are required'; end if;
  select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start or v_run.valuation_date is distinct from p_valuation_date or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then raise exception 'Production Overhead snapshot context does not match refresh run %',p_refresh_run_id; end if;
  if v_run.overall_status<>'SUCCESS' then raise exception 'Production Overhead snapshots may be built only for a successful refresh run'; end if;
  if exists(select 1 from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.product_production_overhead_step_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id) then
    raise exception 'Production Overhead snapshots already exist for refresh run % and are immutable',p_refresh_run_id;
  end if;
  select * into v_policy from costing.fn_resolve_production_overhead_workload_policy(p_valuation_date);
  select total_pool_amount into v_pool from costing.v_cost_pool_monthly_combined where period_start=v_period_start and allocation_pool='PRODUCTION_OVERHEAD';
  if v_pool is null then raise exception 'Production Overhead pool is missing for period %',v_period_start; end if;

  create temporary table tmp_po_product on commit drop as
  with recipients as (
    select b.product_id,max(b.product_name) product_name,max(b.product_base_uom) product_base_uom,
           max(b.monthly_product_allocation_base_qty) monthly_product_base_qty,max(b.monthly_driver_status) monthly_driver_status
    from costing.sku_sales_allocation_basis_snapshot b
    where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id
    group by b.product_id
  ), br as (
    select distinct on (x.product_id) x.product_id,x.id batch_size_ref_id,x.preferred_batch_size
    from public.production_batch_size_ref x
    where x.is_active and x.effective_from<=p_valuation_date
    order by x.product_id,x.effective_from desc,x.id desc
  ), route as (
    select r.product_id,
           costing.fn_resolve_route_family_for_product(r.product_id,p_valuation_date) route_family_id,
           costing.fn_resolve_effective_route_family_route(r.product_id,p_valuation_date) family_route_id,
           (costing.fn_validate_effective_product_process_route(r.product_id,p_valuation_date)->>'product_route_id')::bigint product_route_id,
           costing.fn_validate_effective_product_process_route(r.product_id,p_valuation_date)->>'route_source' effective_route_source
    from recipients r
  ), sf as (
    select r.product_id,count(*) effective_step_count,
           count(*) filter(where e.production_overhead_scope='INCLUDE') included_step_count,
           count(*) filter(where e.production_overhead_scope='PASSIVE') passive_step_count,
           count(*) filter(where e.production_overhead_scope='EXCLUDE_OTHER_POOL') excluded_step_count,
           sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count) route_factor
    from recipients r
    left join lateral costing.fn_effective_product_process_steps(r.product_id,p_valuation_date) e on true
    left join costing.production_overhead_scope_factor sc on sc.policy_id=v_policy.id and sc.scope_code=e.production_overhead_scope
    left join costing.production_overhead_behaviour_factor bh on bh.policy_id=v_policy.id and bh.behaviour_code=e.behaviour_code
    left join costing.production_overhead_resource_factor rs on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
    group by r.product_id
  )
  select r.*,rt.route_family_id,rt.family_route_id,rt.product_route_id,rt.effective_route_source,
         br.batch_size_ref_id,br.preferred_batch_size,
         sf.effective_step_count,sf.included_step_count,sf.passive_step_count,sf.excluded_step_count,sf.route_factor,
         case when br.preferred_batch_size>0 then r.monthly_product_base_qty/br.preferred_batch_size end monthly_batch_equivalents,
         case when br.preferred_batch_size>0 then (r.monthly_product_base_qty/br.preferred_batch_size)*sf.route_factor end workload_units,
         case
           when rt.family_route_id is null then 'BLOCKED_NO_APPROVED_EFFECTIVE_ROUTE'
           when sf.route_factor is null or sf.route_factor<=0 then 'BLOCKED_NO_POSITIVE_ROUTE_FACTOR'
           when br.batch_size_ref_id is null or br.preferred_batch_size<=0 then 'BLOCKED_NO_ACTIVE_BATCH_SIZE'
           when r.monthly_product_base_qty is null or r.monthly_product_base_qty<=0 then 'BLOCKED_NO_MONTHLY_PRODUCT_BASE_QTY'
           when r.monthly_driver_status='BLOCKED' then 'BLOCKED_MONTHLY_DRIVER'
           when r.monthly_driver_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_MONTHLY_DRIVER'
           else 'READY' end workload_status
  from recipients r
  left join route rt on rt.product_id=r.product_id
  left join br on br.product_id=r.product_id
  left join sf on sf.product_id=r.product_id;

  select count(*),count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER')),
         count(*) filter(where workload_status like 'BLOCKED%'),
         count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER'))::numeric/nullif(count(*),0),
         sum(workload_units) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER'))
  into v_recipient_count,v_ready_count,v_blocked_count,v_coverage,v_company_workload
  from tmp_po_product;

  insert into costing.product_production_overhead_workload_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_id,product_name,product_base_uom,
    route_family_id,family_route_id,product_route_id,effective_route_source,batch_size_ref_id,preferred_batch_size,
    monthly_product_base_qty,monthly_driver_status,monthly_batch_equivalents,effective_step_count,included_step_count,
    passive_step_count,excluded_step_count,route_factor,workload_units,workload_status,workload_reason_code,workload_note,
    recipient_product_count,ready_product_count,blocked_product_count,workload_coverage_ratio,company_ready_workload_units)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,t.product_id,t.product_name,t.product_base_uom,
         t.route_family_id,t.family_route_id,t.product_route_id,t.effective_route_source,t.batch_size_ref_id,t.preferred_batch_size,
         t.monthly_product_base_qty,t.monthly_driver_status,t.monthly_batch_equivalents,coalesce(t.effective_step_count,0),
         coalesce(t.included_step_count,0),coalesce(t.passive_step_count,0),coalesce(t.excluded_step_count,0),t.route_factor,t.workload_units,
         t.workload_status,t.workload_status,
         case when t.workload_status='READY' then 'Production Overhead route workload is ready.'
              when t.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'Production Overhead route workload uses a governed monthly quantity that requires review.'
              else 'Production Overhead route workload is blocked: '||t.workload_status end,
         v_recipient_count,v_ready_count,v_blocked_count,v_coverage,v_company_workload
  from tmp_po_product t;

  insert into costing.product_production_overhead_step_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_workload_snapshot_id,product_id,sequence_no,effective_step_key,
    source_type,base_step_id,override_id,production_overhead_scope,scope_factor,behaviour_code,behaviour_factor,
    resource_class_code,resource_factor,expected_occurrence_count,standard_cycle_count,step_factor)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,s.id,s.product_id,e.sequence_no,e.effective_step_key,
         e.source_type,e.base_step_id,e.override_id,e.production_overhead_scope,sc.factor,e.behaviour_code,bh.factor,
         e.resource_class_code,rs.factor,e.expected_occurrence_count,e.standard_cycle_count,
         sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count
  from costing.product_production_overhead_workload_snapshot s
  cross join lateral costing.fn_effective_product_process_steps(s.product_id,p_valuation_date) e
  join costing.production_overhead_scope_factor sc on sc.policy_id=v_policy.id and sc.scope_code=e.production_overhead_scope
  join costing.production_overhead_behaviour_factor bh on bh.policy_id=v_policy.id and bh.behaviour_code=e.behaviour_code
  join costing.production_overhead_resource_factor rs on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
  where s.refresh_run_id=p_refresh_run_id and s.family_route_id is not null;

  insert into costing.sku_production_overhead_allocation_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_workload_snapshot_id,sku_id,product_id,product_name,
    pack_size,pack_uom,sku_base_qty_per_unit,monthly_sku_base_qty,monthly_product_base_qty,sku_within_product_share,
    production_overhead_pool_amount,product_workload_share,product_production_overhead_allocation,
    production_overhead_cost_per_base_uom,production_overhead_cost_per_sku,allocation_status,allocation_reason_code,allocation_note)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,pw.id,b.sku_id,b.product_id,b.product_name,
         b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,b.monthly_allocation_base_qty,b.monthly_product_allocation_base_qty,
         case when b.monthly_product_allocation_base_qty>0 then b.monthly_allocation_base_qty/b.monthly_product_allocation_base_qty end,
         v_pool,
         case when v_coverage=1 and pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER') and v_company_workload>0 then pw.workload_units/v_company_workload end,
         case when v_coverage=1 and pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER') and v_company_workload>0 then v_pool*pw.workload_units/v_company_workload end,
         case when v_coverage=1 and pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER') and v_company_workload>0 and b.monthly_product_allocation_base_qty>0 then (v_pool*pw.workload_units/v_company_workload)/b.monthly_product_allocation_base_qty end,
         case when v_coverage=1 and pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER') and v_company_workload>0 and b.monthly_product_allocation_base_qty>0 then ((v_pool*pw.workload_units/v_company_workload)/b.monthly_product_allocation_base_qty)*b.sku_base_qty_per_unit end,
         case when v_coverage<1 then 'BLOCKED_INCOMPLETE_COMPANY_ROUTE_COVERAGE'
              when pw.workload_status like 'BLOCKED%' then pw.workload_status
              when pw.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'REVIEW_REQUIRED'
              else 'READY' end,
         case when v_coverage<1 then 'BLOCKED_INCOMPLETE_COMPANY_ROUTE_COVERAGE' else pw.workload_status end,
         case when v_coverage<1 then format('Company Production Overhead allocation is blocked because workload coverage is %s of %s recipient Products.',v_ready_count,v_recipient_count)
              when pw.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'Allocation uses a governed monthly quantity requiring review.'
              else 'Production Overhead allocation is ready.' end
  from costing.sku_sales_allocation_basis_snapshot b
  join costing.product_production_overhead_workload_snapshot pw on pw.refresh_run_id=b.refresh_run_id and pw.product_id=b.product_id
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  return jsonb_build_object('period_start',v_period_start,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,
    'policy_id',v_policy.id,'recipient_product_count',v_recipient_count,'ready_product_count',v_ready_count,
    'blocked_product_count',v_blocked_count,'workload_coverage_ratio',v_coverage,'company_ready_workload_units',v_company_workload,
    'pool_amount',v_pool,'monetary_allocation_enabled',v_coverage=1,
    'product_snapshot_count',(select count(*) from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id),
    'step_snapshot_count',(select count(*) from costing.product_production_overhead_step_snapshot where refresh_run_id=p_refresh_run_id),
    'sku_snapshot_count',(select count(*) from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id));
end;
$$;

revoke all on function costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint) from public,anon,authenticated;
grant execute on function costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint) to service_role;

create or replace view costing.v_product_production_overhead_workload_current as
select s.*,'PERSISTED_EXACT_RUN'::text as projection_source
from costing.product_production_overhead_workload_snapshot s
join costing.v_current_successful_costing_refresh_run r on r.refresh_run_id=s.refresh_run_id;

create or replace view costing.v_sku_production_overhead_allocation_current as
select s.*,'PERSISTED_EXACT_RUN'::text as projection_source
from costing.sku_production_overhead_allocation_snapshot s
join costing.v_current_successful_costing_refresh_run r on r.refresh_run_id=s.refresh_run_id;

revoke all on costing.product_production_overhead_workload_snapshot from public,anon,authenticated;
revoke all on costing.product_production_overhead_step_snapshot from public,anon,authenticated;
revoke all on costing.sku_production_overhead_allocation_snapshot from public,anon,authenticated;
revoke all on costing.v_product_production_overhead_workload_current from public,anon,authenticated;
revoke all on costing.v_sku_production_overhead_allocation_current from public,anon,authenticated;
grant select on costing.product_production_overhead_workload_snapshot,costing.product_production_overhead_step_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.v_product_production_overhead_workload_current,costing.v_sku_production_overhead_allocation_current to service_role;