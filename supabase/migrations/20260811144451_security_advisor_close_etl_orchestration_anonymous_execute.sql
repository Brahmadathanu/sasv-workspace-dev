-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  r record;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and lower(p.proname) like any(array[
        'enqueue_%','preflight_%','requeue_%','rerun_%','cleanup_%','check_daily_etl_health','log_daily_etl_health',
        'config_text','compute_idempotency_key','fg_transfer_%','finalize_fg_transfer_snapshot'
      ])
  loop
    execute format('revoke execute on function %s from public', r.oid::regprocedure);
    execute format('revoke execute on function %s from anon', r.oid::regprocedure);
    execute format('grant execute on function %s to authenticated', r.oid::regprocedure);
    execute format('grant execute on function %s to service_role', r.oid::regprocedure);
  end loop;
end
$$;