-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_stamp_validate_direct_labour_pool_lineage()
returns trigger
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_pool costing.cost_pool_monthly_snapshot%rowtype;
  v_policy_count bigint;
begin
  if new.refresh_run_id is null or new.valuation_date is null or new.period_start is null then
    raise exception 'Direct Labour exact-run lineage requires period_start, valuation_date and refresh_run_id.';
  end if;

  select count(*) into v_policy_count
  from costing.direct_labour_workload_policy p
  where p.id = new.policy_id
    and p.status = 'APPROVED'
    and p.effective_from <= new.valuation_date
    and (p.effective_to is null or p.effective_to >= new.valuation_date);

  if v_policy_count <> 1 then
    raise exception 'Direct Labour policy % is not uniquely approved/effective for valuation date %.', new.policy_id, new.valuation_date;
  end if;

  select * into v_pool
  from costing.cost_pool_monthly_snapshot s
  where s.refresh_run_id = new.refresh_run_id
    and s.period_start = new.period_start
    and s.valuation_date = new.valuation_date
    and s.allocation_pool = 'DIRECT_LABOUR';

  if not found then
    raise exception 'Frozen DIRECT_LABOUR pool is missing for refresh run %.', new.refresh_run_id;
  end if;

  if new.direct_labour_pool_amount is distinct from v_pool.total_pool_amount then
    raise exception 'Direct Labour calculated pool % differs from frozen pool % for refresh run %.', new.direct_labour_pool_amount, v_pool.total_pool_amount, new.refresh_run_id;
  end if;

  new.direct_labour_pool_snapshot_id := v_pool.id;
  return new;
end;
$function$;