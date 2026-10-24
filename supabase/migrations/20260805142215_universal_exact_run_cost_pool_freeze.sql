-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.cost_pool_monthly_snapshot
  drop constraint if exists cost_pool_monthly_snapshot_pool_chk;

alter table costing.cost_pool_monthly_snapshot
  add constraint cost_pool_monthly_snapshot_pool_chk
  check (allocation_pool = any (array[
    'DIRECT_LABOUR'::text,
    'PRODUCTION_OVERHEAD'::text,
    'QUALITY_CONTROL_OVERHEAD'::text,
    'MATERIALS_STORES_OVERHEAD'::text,
    'ADMIN_OVERHEAD'::text,
    'FINANCE_ADMIN_OVERHEAD'::text,
    'MARKETING_EXPENSE'::text
  ]));

create or replace function costing.rpc_refresh_cost_pool_monthly_snapshot(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint
)
returns table(
  refreshed_period_start date,
  inserted_row_count bigint,
  blocked_count bigint,
  review_required_count bigint,
  ready_count bigint
)
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_period_start date := date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_expected_count constant integer := 7;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;

  select * into v_run
  from costing.costing_refresh_run r
  where r.id=p_refresh_run_id;

  if not found then
    raise exception 'Costing refresh run % does not exist',p_refresh_run_id;
  end if;

  if v_run.period_start is distinct from v_period_start
     or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Cost-pool snapshot context does not match refresh run %',p_refresh_run_id;
  end if;

  delete from costing.cost_pool_monthly_snapshot s
  where s.refresh_run_id=p_refresh_run_id;

  insert into costing.cost_pool_monthly_snapshot(
    period_start,valuation_date,refresh_run_id,allocation_pool,
    staff_pool_amount,expense_provision_amount,manual_provision_amount,
    total_pool_amount,source_basis,pool_status,pool_note,refreshed_at
  )
  select
    v_period_start,
    p_valuation_date,
    p_refresh_run_id,
    required.allocation_pool,
    coalesce(p.staff_pool_amount,0),
    coalesce(p.expense_provision_amount,0),
    coalesce(p.manual_provision_amount,0),
    coalesce(p.total_pool_amount,0),
    'MONTHLY_COMBINED_POOL',
    case
      when p.allocation_pool is null then 'BLOCKED'
      when coalesce(p.total_pool_amount,0)<0 then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when p.allocation_pool is null then
        'Required monthly cost pool is missing from the monthly combined source.'
      when coalesce(p.total_pool_amount,0)<0 then
        'Monthly cost pool is negative and requires governance review.'
      else
        'Monthly cost pool frozen for the exact refresh run.'
    end,
    clock_timestamp()
  from (values
    ('DIRECT_LABOUR'::text),
    ('PRODUCTION_OVERHEAD'::text),
    ('QUALITY_CONTROL_OVERHEAD'::text),
    ('MATERIALS_STORES_OVERHEAD'::text),
    ('ADMIN_OVERHEAD'::text),
    ('FINANCE_ADMIN_OVERHEAD'::text),
    ('MARKETING_EXPENSE'::text)
  ) required(allocation_pool)
  left join costing.v_cost_pool_monthly_combined p
    on p.period_start=v_period_start
   and p.allocation_pool=required.allocation_pool;

  if (select count(*) from costing.cost_pool_monthly_snapshot s where s.refresh_run_id=p_refresh_run_id)<>v_expected_count then
    raise exception 'Exact-run cost-pool snapshot must contain % rows for refresh run %',v_expected_count,p_refresh_run_id;
  end if;

  return query
  select
    v_period_start,
    count(*)::bigint,
    count(*) filter(where s.pool_status='BLOCKED')::bigint,
    count(*) filter(where s.pool_status='REVIEW_REQUIRED')::bigint,
    count(*) filter(where s.pool_status='READY')::bigint
  from costing.cost_pool_monthly_snapshot s
  where s.refresh_run_id=p_refresh_run_id;
end;
$function$;

create or replace function costing.fn_exact_run_cost_pool_reconciliation(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_period_start date:=date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_result jsonb;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;

  select * into v_run
  from costing.costing_refresh_run r
  where r.id=p_refresh_run_id;

  if not found then
    raise exception 'Costing refresh run % does not exist',p_refresh_run_id;
  end if;

  if v_run.period_start is distinct from v_period_start
     or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Cost-pool reconciliation context does not match refresh run %',p_refresh_run_id;
  end if;

  with required(allocation_pool) as (
    values
      ('DIRECT_LABOUR'::text),
      ('PRODUCTION_OVERHEAD'::text),
      ('QUALITY_CONTROL_OVERHEAD'::text),
      ('MATERIALS_STORES_OVERHEAD'::text),
      ('ADMIN_OVERHEAD'::text),
      ('FINANCE_ADMIN_OVERHEAD'::text),
      ('MARKETING_EXPENSE'::text)
  ), rows as (
    select
      r.allocation_pool,
      s.id as pool_snapshot_id,
      s.pool_status,
      s.staff_pool_amount as frozen_staff_pool_amount,
      s.expense_provision_amount as frozen_expense_provision_amount,
      s.manual_provision_amount as frozen_manual_provision_amount,
      s.total_pool_amount as frozen_total_pool_amount,
      live.staff_pool_amount as live_staff_pool_amount,
      live.expense_provision_amount as live_expense_provision_amount,
      live.manual_provision_amount as live_manual_provision_amount,
      live.total_pool_amount as live_total_pool_amount,
      case
        when s.id is null then 'MISSING_FROZEN_POOL'
        when live.allocation_pool is null then 'LIVE_SOURCE_MISSING'
        when s.staff_pool_amount is distinct from live.staff_pool_amount
          or s.expense_provision_amount is distinct from live.expense_provision_amount
          or s.manual_provision_amount is distinct from live.manual_provision_amount
          or s.total_pool_amount is distinct from live.total_pool_amount then 'LIVE_SOURCE_CHANGED_AFTER_FREEZE'
        when s.pool_status='BLOCKED' then 'FROZEN_POOL_BLOCKED'
        when s.pool_status='REVIEW_REQUIRED' then 'FROZEN_POOL_REVIEW_REQUIRED'
        else 'RECONCILED'
      end as reconciliation_status
    from required r
    left join costing.cost_pool_monthly_snapshot s
      on s.refresh_run_id=p_refresh_run_id
     and s.period_start=v_period_start
     and s.valuation_date=p_valuation_date
     and s.allocation_pool=r.allocation_pool
    left join costing.v_cost_pool_monthly_combined live
      on live.period_start=v_period_start
     and live.allocation_pool=r.allocation_pool
  )
  select jsonb_build_object(
    'period_start',v_period_start,
    'valuation_date',p_valuation_date,
    'refresh_run_id',p_refresh_run_id,
    'run_overall_status',v_run.overall_status,
    'required_pool_count',7,
    'frozen_pool_count',count(*) filter(where pool_snapshot_id is not null),
    'missing_frozen_pool_count',count(*) filter(where pool_snapshot_id is null),
    'reconciled_count',count(*) filter(where reconciliation_status='RECONCILED'),
    'changed_after_freeze_count',count(*) filter(where reconciliation_status='LIVE_SOURCE_CHANGED_AFTER_FREEZE'),
    'blocked_count',count(*) filter(where reconciliation_status in ('LIVE_SOURCE_MISSING','FROZEN_POOL_BLOCKED')),
    'review_required_count',count(*) filter(where reconciliation_status in ('MISSING_FROZEN_POOL','LIVE_SOURCE_CHANGED_AFTER_FREEZE','FROZEN_POOL_REVIEW_REQUIRED')),
    'universal_freeze_status',case
      when count(*) filter(where pool_snapshot_id is null)>0 then 'INCOMPLETE_HISTORICAL_OR_CURRENT_FREEZE'
      when count(*) filter(where reconciliation_status in ('LIVE_SOURCE_MISSING','FROZEN_POOL_BLOCKED'))>0 then 'BLOCKED'
      when count(*) filter(where reconciliation_status in ('LIVE_SOURCE_CHANGED_AFTER_FREEZE','FROZEN_POOL_REVIEW_REQUIRED'))>0 then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    'stage03_cutover_status','NOT_AUTHORISED_BY_THIS_GATE',
    'rows',jsonb_agg(to_jsonb(rows) order by allocation_pool)
  ) into v_result
  from rows;

  return v_result;
end;
$function$;

create or replace function public.rpc_get_exact_run_cost_pool_reconciliation(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','costing','pg_temp'
as $function$
begin
  perform public.require_permission('module:cost-build-manager',false);
  return costing.fn_exact_run_cost_pool_reconciliation(p_period_start,p_valuation_date,p_refresh_run_id);
end;
$function$;

revoke all on function public.rpc_get_exact_run_cost_pool_reconciliation(date,date,bigint) from public,anon;
grant execute on function public.rpc_get_exact_run_cost_pool_reconciliation(date,date,bigint) to authenticated,service_role;

comment on function costing.rpc_refresh_cost_pool_monthly_snapshot(date,date,bigint) is
'Freezes all seven governed allocated cost pools for one exact refresh-run tuple. Does not determine or approve element-specific allocation drivers.';

comment on function costing.fn_exact_run_cost_pool_reconciliation(date,date,bigint) is
'Read-only comparison of the seven required exact-run frozen pools against the current monthly combined source. Historical successful runs are reported, never backfilled.';

comment on function public.rpc_get_exact_run_cost_pool_reconciliation(date,date,bigint) is
'Governed Cost Build Manager reconciliation for universal exact-run cost-pool freezing.';