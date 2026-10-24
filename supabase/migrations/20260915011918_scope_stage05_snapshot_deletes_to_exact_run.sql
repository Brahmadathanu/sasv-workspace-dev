-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_oid oid;
  v_def text;
  v_old text := 'where period_start = v_period_start;';
  v_new text := 'where period_start = v_period_start
      and valuation_date = p_valuation_date
      and refresh_run_id = p_refresh_run_id;';
  v_count int;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_exact_material_action_review_snapshots'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_oid is null then
    raise exception 'Target Stage05 refresh function not found';
  end if;

  v_def := pg_get_functiondef(v_oid);
  v_count := (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old);
  if v_count <> 5 then
    raise exception 'Expected 5 period-wide delete predicates, found %', v_count;
  end if;

  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end $$;