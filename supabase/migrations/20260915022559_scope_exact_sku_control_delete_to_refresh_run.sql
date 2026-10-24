-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
begin
  select p.oid, pg_get_functiondef(p.oid)
    into v_oid, v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_exact_sku_control_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_oid is null then raise exception 'Target function not found'; end if;

  v_new := replace(
    v_def,
    E'delete\r\n    from costing.sku_costing_control_status_snapshot s\r\n    where s.period_start = v_period_start;',
    E'delete\r\n    from costing.sku_costing_control_status_snapshot s\r\n    where s.period_start = v_period_start\r\n      and s.valuation_date = p_valuation_date\r\n      and s.refresh_run_id = p_refresh_run_id;'
  );

  if v_new = v_def then
    v_new := regexp_replace(
      v_def,
      'delete\s+from costing\.sku_costing_control_status_snapshot s\s+where s\.period_start = v_period_start;',
      E'delete\n    from costing.sku_costing_control_status_snapshot s\n    where s.period_start = v_period_start\n      and s.valuation_date = p_valuation_date\n      and s.refresh_run_id = p_refresh_run_id;'
    );
  end if;

  if v_new = v_def then raise exception 'Exact SKU-control delete predicate was not replaced'; end if;
  execute v_new;
end $$;