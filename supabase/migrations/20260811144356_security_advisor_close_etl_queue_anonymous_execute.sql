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
      and (
        position('etl_jobs' in lower(pg_get_functiondef(p.oid))) > 0
        or position('etl_config' in lower(pg_get_functiondef(p.oid))) > 0
        or position('etl_health_log' in lower(pg_get_functiondef(p.oid))) > 0
        or position('storage_cleanup_queue' in lower(pg_get_functiondef(p.oid))) > 0
      )
  loop
    execute format('revoke execute on function %s from public', r.oid::regprocedure);
    execute format('revoke execute on function %s from anon', r.oid::regprocedure);
    execute format('grant execute on function %s to authenticated', r.oid::regprocedure);
    execute format('grant execute on function %s to service_role', r.oid::regprocedure);
  end loop;
end
$$;