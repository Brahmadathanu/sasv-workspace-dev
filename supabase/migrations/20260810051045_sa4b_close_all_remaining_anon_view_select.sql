-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare r record;
begin
  for r in
    select n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind='v'
      and has_table_privilege('anon', c.oid, 'SELECT')
  loop
    execute format('revoke select on %I.%I from anon', r.nspname, r.relname);
  end loop;
end $$;