-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare r record; sp text;
begin
  for r in
    select p.oid, n.nspname schema_name, p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind in ('f','p')
      and p.prosecdef
      and n.nspname in ('public','costing','lab')
      and not exists (select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) x where x like 'search_path=%')
  loop
    sp := case r.schema_name
      when 'public' then 'pg_catalog, public, pg_temp'
      when 'costing' then 'pg_catalog, costing, public, pg_temp'
      when 'lab' then 'pg_catalog, lab, public, pg_temp'
    end;
    execute format('alter function %I.%I(%s) set search_path to %s', r.schema_name, r.proname, r.args, sp);
  end loop;

  revoke execute on function lab.fn_pass_analysis_scrutiny(uuid,bigint) from public, anon;
  revoke execute on function lab.fn_reopen_analysis_after_approval(uuid,bigint,text) from public, anon;
  revoke execute on function lab.fn_return_analysis_for_correction(uuid,bigint,text) from public, anon;
  grant execute on function lab.fn_pass_analysis_scrutiny(uuid,bigint) to authenticated, service_role;
  grant execute on function lab.fn_reopen_analysis_after_approval(uuid,bigint,text) to authenticated, service_role;
  grant execute on function lab.fn_return_analysis_for_correction(uuid,bigint,text) to authenticated, service_role;
end $$;