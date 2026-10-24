-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_old text;
  v_rep text;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_exact_costing_control_integrity_audit'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_oid is null then raise exception 'Exact integrity audit function not found'; end if;
  v_def := pg_get_functiondef(v_oid);

  v_old := E'sku_tuple_bad as (\r\n        select count(*)::bigint as n\r\n        from costing.sku_costing_control_status_snapshot\r\n        where period_start = v_period_start\r\n          and (\r\n               valuation_date is distinct from p_valuation_date\r\n            or refresh_run_id is distinct from p_refresh_run_id\r\n          )\r\n    ),';
  v_rep := E'sku_tuple_bad as (\r\n        select count(*)::bigint as n\r\n        from costing.sku_costing_control_status_snapshot\r\n        where refresh_run_id = p_refresh_run_id\r\n          and (\r\n               period_start is distinct from v_period_start\r\n            or valuation_date is distinct from p_valuation_date\r\n          )\r\n    ),';
  v_new := replace(v_def,v_old,v_rep);
  if v_new = v_def then raise exception 'SKU tuple-scope patch did not match'; end if;

  v_old := E'queue_tuple_bad as (\r\n        select count(*)::bigint as n\r\n        from costing.material_costing_action_queue_snapshot\r\n        where period_start = v_period_start\r\n          and (\r\n               valuation_date is distinct from p_valuation_date\r\n            or refresh_run_id is distinct from p_refresh_run_id\r\n          )\r\n    ),';
  v_rep := E'queue_tuple_bad as (\r\n        select count(*)::bigint as n\r\n        from costing.material_costing_action_queue_snapshot\r\n        where refresh_run_id = p_refresh_run_id\r\n          and (\r\n               period_start is distinct from v_period_start\r\n            or valuation_date is distinct from p_valuation_date\r\n          )\r\n    ),';
  v_def := v_new;
  v_new := replace(v_def,v_old,v_rep);
  if v_new = v_def then raise exception 'Queue tuple-scope patch did not match'; end if;

  execute v_new;
end $$;