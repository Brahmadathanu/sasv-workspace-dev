-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $do$
declare
  r record;
  v_auth_exec boolean;
  v_service_exec boolean;
begin
  for r in
    select p.oid, p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('lab', 'hr')
    order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    v_auth_exec := has_function_privilege('authenticated', r.oid, 'EXECUTE');
    v_service_exec := has_function_privilege('service_role', r.oid, 'EXECUTE');

    execute format('revoke execute on function %s from public, anon', r.fn);

    if v_auth_exec then
      execute format('grant execute on function %s to authenticated', r.fn);
    end if;

    if v_service_exec then
      execute format('grant execute on function %s to service_role', r.fn);
    end if;
  end loop;
end
$do$;

alter function hr.fn_sync_staff_active_status_to_costing()
  set search_path = pg_catalog, hr, costing, public, pg_temp;