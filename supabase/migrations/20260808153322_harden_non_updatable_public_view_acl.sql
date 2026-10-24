-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  r record;
begin
  for r in
    select c.relname as view_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and pg_relation_is_updatable(c.oid, true) = 0
      and exists (
        select 1
        from information_schema.role_table_grants g
        where g.table_schema = 'public'
          and g.table_name = c.relname
          and g.grantee in ('anon','authenticated')
          and g.privilege_type <> 'SELECT'
      )
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated',
      r.view_name
    );
  end loop;
end
$$;