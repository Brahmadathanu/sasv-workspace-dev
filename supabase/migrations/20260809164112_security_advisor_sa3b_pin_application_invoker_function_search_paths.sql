-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare r record;
begin
  for r in
    select p.oid,
           n.nspname as schema_name,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles ro on ro.oid = p.proowner
    left join pg_depend d
      on d.classid = 'pg_proc'::regclass
     and d.objid = p.oid
     and d.deptype = 'e'
    where n.nspname in ('public','costing','lab')
      and p.prokind in ('f','p')
      and not p.prosecdef
      and ro.rolname = 'postgres'
      and d.objid is null
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) x
        where x like 'search_path=%'
      )
      and not (pg_get_functiondef(p.oid) ~* '\m(set_config\s*\(|set\s+local\s+search_path|set\s+search_path)')
      and not (pg_get_functiondef(p.oid) ~* '\m(execute\s+format\s*\(|execute\s+[^;]+using|to_regclass\s*\(|regclass|current_schema\s*\(|current_schemas\s*\()')
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = pg_catalog, %I, public, pg_temp',
      r.schema_name, r.proname, r.args, r.schema_name
    );
  end loop;
end $$;