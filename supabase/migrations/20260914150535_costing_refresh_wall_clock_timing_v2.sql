-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.costing_refresh_log
  alter column refresh_started_at set default clock_timestamp();

do $mig$
declare
  v_oid oid;
  v_def text;
  v_new text;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing' and p.proname='fn_process_next_costing_refresh_stage_internal'
    and pg_get_function_identity_arguments(p.oid)='p_refresh_run_id bigint';
  v_def:=pg_get_functiondef(v_oid);
  v_new:=replace(v_def,'v_started_at timestamptz := now();','v_started_at timestamptz := clock_timestamp();');
  v_new:=replace(v_new,'v_finished_at := now();','v_finished_at := clock_timestamp();');
  execute v_new;

  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing' and p.proname='rpc_refresh_manufacturing_cop_chain'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
  v_def:=pg_get_functiondef(v_oid);
  v_new:=replace(v_def,'refresh_finished_at=now()','refresh_finished_at=clock_timestamp()');
  execute v_new;
end
$mig$;