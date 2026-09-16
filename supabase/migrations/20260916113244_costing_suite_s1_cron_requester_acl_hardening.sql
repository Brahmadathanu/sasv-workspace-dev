do $$
begin
  if exists (select 1 from cron.job where jobid in (60,61) and active) then
    raise exception 'S1 precondition failed: costing cron jobs 60/61 must remain inactive during hardening';
  end if;
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then
    raise exception 'S1 precondition failed: no costing refresh run may be QUEUED/RUNNING during hardening';
  end if;
  if not exists (
    select 1 from costing.costing_refresh_run
    where id=108
      and overall_status='SUCCESS'
      and final_blocked_count=0
      and final_review_required_count=0
      and final_ready_count=672
      and valuation_date=date '2026-09-10'
      and valuation_context_source='CAPTURED_AT_REQUEST'
  ) then
    raise exception 'S1 precondition failed: immutable Run108 baseline is not in the expected state';
  end if;
end $$;

create or replace function costing.fn_request_costing_refresh_internal(
  p_period_start date,
  p_requested_scope text,
  p_source_trigger text,
  p_request_note text,
  p_requested_by uuid,
  p_allow_period_autocreate boolean default false
)
returns table(
  refresh_run_id bigint,
  period_start date,
  requested_scope text,
  overall_status text,
  current_stage_code text,
  requested_at timestamptz,
  action_result text
)
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $$
declare
  v_period_start date;
  v_requested_scope text;
  v_period costing.cost_periods%rowtype;
  v_existing_run costing.costing_refresh_run%rowtype;
  v_new_run costing.costing_refresh_run%rowtype;
begin
  v_period_start := date_trunc(
    'month',
    coalesce(p_period_start, costing.fn_india_business_date())::timestamp
  )::date;

  v_requested_scope := upper(btrim(coalesce(p_requested_scope,'FULL_COSTING_REFRESH')));
  if v_requested_scope = '' then
    raise exception 'Requested costing refresh scope is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'costing-refresh-request:' || v_period_start::text || ':' || v_requested_scope,
      0
    )
  );

  if coalesce(p_allow_period_autocreate,false) then
    perform * from costing.rpc_ensure_cost_period(v_period_start);
  end if;

  select *
  into v_period
  from costing.cost_periods cp
  where cp.period_start=v_period_start
  for update;

  if not found then
    raise exception 'Costing period % does not exist. Create/govern the period before an automated refresh is allowed.',v_period_start;
  end if;
  if v_period.status <> 'OPEN' then
    raise exception 'Ordinary costing refresh is allowed only for an OPEN period. Period % status is %',v_period_start,v_period.status;
  end if;
  if v_period.valuation_date_status <> 'DRAFT' then
    raise exception 'OPEN costing period % must have DRAFT valuation-date status. Current status: %',v_period_start,v_period.valuation_date_status;
  end if;
  if v_period.valuation_date is null then
    raise exception 'Costing period % does not have a valuation date',v_period_start;
  end if;

  select *
  into v_existing_run
  from costing.costing_refresh_run r
  where r.period_start=v_period_start
    and r.requested_scope=v_requested_scope
    and r.overall_status in ('QUEUED','RUNNING')
  order by case r.overall_status when 'RUNNING' then 1 else 2 end,r.requested_at,r.id
  limit 1;

  if found then
    if v_existing_run.valuation_date is distinct from v_period.valuation_date then
      raise exception 'Active refresh run % uses valuation date %, but period % currently uses %. Resolve the active run before requesting another refresh.',
        v_existing_run.id,v_existing_run.valuation_date,v_period_start,v_period.valuation_date;
    end if;

    return query select
      v_existing_run.id,
      v_existing_run.period_start,
      v_existing_run.requested_scope,
      v_existing_run.overall_status,
      v_existing_run.current_stage_code,
      v_existing_run.requested_at,
      'EXISTING_ACTIVE_RUN_RETURNED'::text;
    return;
  end if;

  insert into costing.costing_refresh_run(
    period_start,valuation_date,
    period_status_at_request,valuation_date_status_at_request,
    valuation_context_source,valuation_context_captured_at,
    requested_scope,source_trigger,request_note,
    requested_by,requested_at,
    overall_status,current_stage_code,latest_stage_order,
    created_at,updated_at
  ) values (
    v_period.period_start,v_period.valuation_date,
    v_period.status,v_period.valuation_date_status,
    'CAPTURED_AT_REQUEST',statement_timestamp(),
    v_requested_scope,
    coalesce(nullif(btrim(coalesce(p_source_trigger,'')),''),'MANUAL_UI'),
    nullif(btrim(coalesce(p_request_note,'')),''),
    p_requested_by,statement_timestamp(),
    'QUEUED','01_ENSURE_PERIOD',0,
    statement_timestamp(),statement_timestamp()
  ) returning * into v_new_run;

  insert into costing.costing_refresh_run_stage(
    refresh_run_id,period_start,valuation_date,
    stage_order,stage_code,stage_name,stage_status,
    created_at,updated_at
  )
  select
    v_new_run.id,v_new_run.period_start,v_new_run.valuation_date,
    d.stage_order,d.stage_code,d.stage_name,'PENDING',
    statement_timestamp(),statement_timestamp()
  from costing.costing_refresh_stage_definition d
  where d.is_active=true
  order by d.stage_order;

  return query select
    v_new_run.id,
    v_new_run.period_start,
    v_new_run.requested_scope,
    v_new_run.overall_status,
    v_new_run.current_stage_code,
    v_new_run.requested_at,
    'NEW_REFRESH_RUN_CREATED'::text;
end;
$$;

revoke all on function costing.fn_request_costing_refresh_internal(date,text,text,text,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function costing.fn_request_costing_refresh_internal(date,text,text,text,uuid,boolean) to postgres;
comment on function costing.fn_request_costing_refresh_internal(date,text,text,text,uuid,boolean) is
'Owner-only canonical costing refresh request core. Client wrappers must authenticate/authorize before calling. Automated callers cannot auto-create a costing period unless explicitly allowed by a trusted owner path.';

create or replace function public.rpc_request_costing_refresh(
  p_period_start date default date_trunc('month',costing.fn_india_business_date()::timestamp)::date,
  p_requested_scope text default 'FULL_COSTING_REFRESH',
  p_source_trigger text default 'MANUAL_UI',
  p_request_note text default null
)
returns table(
  refresh_run_id bigint,
  period_start date,
  requested_scope text,
  overall_status text,
  current_stage_code text,
  requested_at timestamptz,
  action_result text
)
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $$
declare
  v_actor uuid;
begin
  perform public.require_permission('module:costing-control-center',true);
  v_actor:=auth.uid();
  if v_actor is null then raise exception 'Authenticated user context is required'; end if;

  return query
  select *
  from costing.fn_request_costing_refresh_internal(
    p_period_start,
    p_requested_scope,
    p_source_trigger,
    p_request_note,
    v_actor,
    true
  );
end;
$$;

revoke all on function public.rpc_request_costing_refresh(date,text,text,text) from public,anon;
grant execute on function public.rpc_request_costing_refresh(date,text,text,text) to authenticated,service_role;

create or replace function costing.rpc_request_daily_costing_refresh_internal()
returns table(
  refresh_run_id bigint,
  period_start date,
  requested_scope text,
  overall_status text,
  current_stage_code text,
  requested_at timestamptz,
  action_result text
)
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $$
declare
  v_business_date date:=costing.fn_india_business_date();
  v_period_start date;
  v_period costing.cost_periods%rowtype;
  v_same_day costing.costing_refresh_run%rowtype;
  v_prior_cron costing.costing_refresh_run%rowtype;
begin
  v_period_start:=date_trunc('month',v_business_date::timestamp)::date;

  perform pg_advisory_xact_lock(
    hashtextextended('costing-daily-cron-request:'||v_business_date::text,0)
  );

  select * into v_period
  from costing.cost_periods cp
  where cp.period_start=v_period_start
  for update;

  if not found then
    return query select null::bigint,v_period_start,'FULL_COSTING_REFRESH'::text,'NOT_REQUESTED'::text,null::text,null::timestamptz,'CURRENT_PERIOD_NOT_GOVERNED'::text;
    return;
  end if;
  if v_period.status<>'OPEN' then
    return query select null::bigint,v_period_start,'FULL_COSTING_REFRESH'::text,'NOT_REQUESTED'::text,null::text,null::timestamptz,'CURRENT_PERIOD_NOT_OPEN'::text;
    return;
  end if;
  if v_period.valuation_date_status<>'DRAFT' or v_period.valuation_date is null then
    return query select null::bigint,v_period_start,'FULL_COSTING_REFRESH'::text,'NOT_REQUESTED'::text,null::text,null::timestamptz,'CURRENT_PERIOD_VALUATION_NOT_READY'::text;
    return;
  end if;

  select * into v_same_day
  from costing.costing_refresh_run r
  where r.period_start=v_period_start
    and r.requested_scope='FULL_COSTING_REFRESH'
    and r.source_trigger='CRON_DAILY'
    and (r.requested_at at time zone 'Asia/Kolkata')::date=v_business_date
  order by r.requested_at desc,r.id desc
  limit 1;

  if found then
    return query select
      v_same_day.id,v_same_day.period_start,v_same_day.requested_scope,
      v_same_day.overall_status,v_same_day.current_stage_code,v_same_day.requested_at,
      'EXISTING_DAILY_CRON_RUN_RETURNED'::text;
    return;
  end if;

  select * into v_prior_cron
  from costing.costing_refresh_run r
  where r.period_start=v_period_start
    and r.requested_scope='FULL_COSTING_REFRESH'
    and r.source_trigger='CRON_DAILY'
    and r.requested_at < (v_business_date::timestamp at time zone 'Asia/Kolkata')
  order by r.requested_at desc,r.id desc
  limit 1;

  if found and v_prior_cron.overall_status='FAILED' and not exists(
    select 1 from costing.costing_refresh_run later
    where later.period_start=v_period_start
      and later.requested_scope='FULL_COSTING_REFRESH'
      and later.requested_at>v_prior_cron.requested_at
      and later.overall_status='SUCCESS'
  ) then
    return query select
      v_prior_cron.id,v_prior_cron.period_start,v_prior_cron.requested_scope,
      v_prior_cron.overall_status,v_prior_cron.current_stage_code,v_prior_cron.requested_at,
      'PREVIOUS_CRON_FAILURE_REQUIRES_REVIEW'::text;
    return;
  end if;

  return query
  select *
  from costing.fn_request_costing_refresh_internal(
    v_period_start,
    'FULL_COSTING_REFRESH',
    'CRON_DAILY',
    'Daily server-owned costing refresh run.',
    null,
    false
  );
end;
$$;

revoke all on function costing.rpc_request_daily_costing_refresh_internal() from public,anon,authenticated,service_role;
grant execute on function costing.rpc_request_daily_costing_refresh_internal() to postgres;
comment on function costing.rpc_request_daily_costing_refresh_internal() is
'Owner-only pg_cron request contract. Never auto-creates a costing period, never advances valuation date, is idempotent per India business date, and fails closed after unresolved prior cron failure.';

create or replace function public.rpc_request_daily_costing_refresh()
returns table(
  refresh_run_id bigint,
  period_start date,
  requested_scope text,
  overall_status text,
  current_stage_code text,
  requested_at timestamptz,
  action_result text
)
language sql
security definer
set search_path to 'public','costing','pg_temp'
as $$
  select * from costing.rpc_request_daily_costing_refresh_internal();
$$;

revoke all on function public.rpc_request_daily_costing_refresh() from public,anon,authenticated,service_role;
grant execute on function public.rpc_request_daily_costing_refresh() to postgres;
comment on function public.rpc_request_daily_costing_refresh() is
'DEPRECATED OWNER-ONLY compatibility wrapper. pg_cron should call costing.rpc_request_daily_costing_refresh_internal().';

revoke all on function public.rpc_get_regional_sales_allocation_default_policies() from public,anon;
grant execute on function public.rpc_get_regional_sales_allocation_default_policies() to authenticated,service_role;

revoke all on function public.rpc_set_regional_sales_allocation_default_policy(text,text,numeric,date,text,text) from public,anon;
grant execute on function public.rpc_set_regional_sales_allocation_default_policy(text,text,numeric,date,text,text) to authenticated,service_role;

comment on function public.rpc_get_regional_sales_allocation_default_policies() is
'Legacy single-scope regional CSA read contract. Authenticated permission-controlled compatibility surface; PUBLIC/anon execute revoked. Prefer scoped CSA contracts.';
comment on function public.rpc_set_regional_sales_allocation_default_policy(text,text,numeric,date,text,text) is
'Legacy single-scope regional CSA write contract. Authenticated permission-controlled compatibility surface; PUBLIC/anon execute revoked. Prefer scoped CSA contracts.';
