-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $do$
declare
  r record;
begin
  for r in
    select p.oid, p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and not p.prosecdef
      and has_function_privilege('anon',p.oid,'EXECUTE')
      and p.proname ~* '^(rpc_|api_)'
      and p.proname !~* '(etl|tally|enqueue|job|daybook|snapshot|refresh|recovery|recover|health|worker|sync)'
  loop
    execute format('revoke execute on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated, service_role', r.fn);
  end loop;
end
$do$;