-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $mig$
declare
  r record;
  v_def text;
  v_new text;
begin
  for r in
    select p.oid,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) in (
      ('costing','fn_process_next_costing_refresh_stage_internal','p_refresh_run_id bigint'),
      ('costing','rpc_refresh_manufacturing_cop_chain','p_period_start date, p_valuation_date date, p_refresh_run_id bigint')
    )
  loop
    v_def:=pg_get_functiondef(r.oid);
    v_new:=replace(v_def,'pg_try_advisory_lock','pg_try_advisory_xact_lock');
    v_new:=regexp_replace(v_new,E'\\n\\s*perform pg_advisory_unlock\\(v_lock_key\\);','', 'g');
    if v_new=v_def then
      raise exception 'No advisory-lock replacement made for %.%(%)',r.nspname,r.proname,r.args;
    end if;
    execute v_new;
  end loop;
end
$mig$;