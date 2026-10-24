-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare r record;
begin
  for r in
    select n.nspname schema_name, p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind in ('f','p') and p.prosecdef and n.nspname in ('costing','lab')
      and has_function_privilege('anon',p.oid,'EXECUTE')
  loop
    execute format('revoke execute on function %I.%I(%s) from public, anon', r.schema_name, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to authenticated, service_role', r.schema_name, r.proname, r.args);
  end loop;
end $$;