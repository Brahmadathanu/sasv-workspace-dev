-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_oid oid;
  v_def text;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_sku_direct_labour_component_split_snapshot'
    and pg_get_function_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
  if v_oid is null then raise exception 'DL component writer not found'; end if;
  v_def:=pg_get_functiondef(v_oid);

  v_def:=replace(v_def,
$old$    and not exists (
        select 1
        from jsonb_array_elements(t.labour_step_evidence) e
        where coalesce(e->>'direct_labour_scope','') <> 'EXCLUDE_OTHER_POOL'
    );$old$,
$new$    and not exists (
        select 1
        from jsonb_array_elements(t.labour_step_evidence) e
        where coalesce(e->>'direct_labour_scope','') <> 'EXCLUDE_OTHER_POOL'
    )
    and not exists (
        select 1
        from costing.production_route_family rf
        where rf.id=t.route_family_id
          and rf.family_code='OUTSOURCED_SOFT_GEL_JOB_WORK'
    );$new$);

  if position($needle$family_code='OUTSOURCED_SOFT_GEL_JOB_WORK'$needle$ in v_def)=0 then
    raise exception 'External full-pack guard did not apply';
  end if;
  execute v_def;
end $$;