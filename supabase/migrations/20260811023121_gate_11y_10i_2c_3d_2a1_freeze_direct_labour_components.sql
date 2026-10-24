-- backfilled from live schema_migrations on 2026-10-24, CI-016
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
  v_dl_pool_snapshot_id bigint;
  v_dl_staff_pool numeric;
  v_dl_expense_pool numeric;
  v_dl_manual_pool numeric;
  v_dl_total_pool numeric;
  v_component_sum numeric;
  v_component_count integer;
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

  delete from costing.direct_labour_component_pool_snapshot c
  where c.refresh_run_id=p_refresh_run_id;

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

  select id,staff_pool_amount,expense_provision_amount,manual_provision_amount,total_pool_amount
    into v_dl_pool_snapshot_id,v_dl_staff_pool,v_dl_expense_pool,v_dl_manual_pool,v_dl_total_pool
  from costing.cost_pool_monthly_snapshot
  where refresh_run_id=p_refresh_run_id
    and period_start=v_period_start
    and valuation_date=p_valuation_date
    and allocation_pool='DIRECT_LABOUR';

  if v_dl_pool_snapshot_id is null then
    raise exception 'Frozen Direct Labour pool is missing for refresh run %',p_refresh_run_id;
  end if;

  if coalesce(v_dl_expense_pool,0)<>0 or coalesce(v_dl_manual_pool,0)<>0 then
    raise exception 'Direct Labour component model currently requires zero expense/manual provisions; run % has expense %, manual %',
      p_refresh_run_id,coalesce(v_dl_expense_pool,0),coalesce(v_dl_manual_pool,0);
  end if;

  insert into costing.direct_labour_component_pool_snapshot(
    period_start,valuation_date,refresh_run_id,direct_labour_pool_snapshot_id,
    component_code,source_costing_class,staff_count,component_pool_amount,
    allocation_driver_code,source_basis,created_at
  )
  select
    v_period_start,p_valuation_date,p_refresh_run_id,v_dl_pool_snapshot_id,
    case s.costing_class
      when 'DIRECT_LABOUR' then 'MANUFACTURING_LABOUR'
      when 'PACKING_LABOUR' then 'PACKING_LABOUR'
    end,
    s.costing_class,
    s.staff_count,
    s.pool_amount,
    case s.costing_class
      when 'DIRECT_LABOUR' then 'ROUTE_ATTENDANCE_WORKLOAD'
      when 'PACKING_LABOUR' then 'EXPECTED_PACKAGE_UNITS'
    end,
    'FROZEN_FROM_V_STAFF_COST_POOL_MONTHLY',
    clock_timestamp()
  from costing.v_staff_cost_pool_monthly s
  where s.period_start=v_period_start
    and s.allocation_pool='DIRECT_LABOUR'
    and s.costing_class in ('DIRECT_LABOUR','PACKING_LABOUR');

  select count(*),coalesce(sum(component_pool_amount),0)
    into v_component_count,v_component_sum
  from costing.direct_labour_component_pool_snapshot
  where refresh_run_id=p_refresh_run_id;

  if v_component_count<>2 then
    raise exception 'Direct Labour component freeze must contain exactly 2 rows for run %, found %',p_refresh_run_id,v_component_count;
  end if;

  if v_component_sum is distinct from v_dl_staff_pool
     or v_component_sum is distinct from v_dl_total_pool then
    raise exception 'Direct Labour component pool mismatch for run %: component sum %, frozen staff %, frozen total %',
      p_refresh_run_id,v_component_sum,v_dl_staff_pool,v_dl_total_pool;
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