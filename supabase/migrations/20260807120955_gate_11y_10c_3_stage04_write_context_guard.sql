-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_assert_stage04_snapshot_write_context(
  p_refresh_run_id bigint,
  p_snapshot_kind text
) returns void
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $$
declare
  v_run costing.costing_refresh_run%rowtype;
begin
  select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;

  if v_run.overall_status <> 'RUNNING'
     or v_run.current_stage_code <> '04_COST_SHEET_SNAPSHOT'
     or not exists (
       select 1 from costing.costing_refresh_run_stage s
       where s.refresh_run_id=p_refresh_run_id
         and s.stage_code='04_COST_SHEET_SNAPSHOT'
         and s.stage_status='RUNNING'
     ) then
    raise exception 'Stage-04 snapshots may be written only in governed Stage 04 RUNNING context for refresh run %',p_refresh_run_id;
  end if;

  case p_snapshot_kind
    when 'MONTHLY' then
      if exists(select 1 from costing.cost_sheet_line_monthly_snapshot where refresh_run_id=p_refresh_run_id) then
        raise exception 'Monthly Cost Sheet snapshot already exists for refresh run % and is immutable',p_refresh_run_id;
      end if;
    when 'TRACE' then
      if exists(select 1 from costing.cost_sheet_line_traceability_snapshot where refresh_run_id=p_refresh_run_id) then
        raise exception 'Cost Sheet line trace snapshot already exists for refresh run % and is immutable',p_refresh_run_id;
      end if;
    when 'RM_TRACE' then
      if exists(select 1 from costing.cost_sheet_rm_line_traceability_snapshot where refresh_run_id=p_refresh_run_id) then
        raise exception 'RM Cost Sheet trace snapshot already exists for refresh run % and is immutable',p_refresh_run_id;
      end if;
    else
      raise exception 'Unknown Stage-04 snapshot kind %',p_snapshot_kind;
  end case;
end;
$$;

revoke all on function costing.fn_assert_stage04_snapshot_write_context(bigint,text) from public,anon,authenticated;
grant execute on function costing.fn_assert_stage04_snapshot_write_context(bigint,text) to service_role,postgres;

do $$
declare v_oid oid; v_def text;
begin
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing' and p.proname='refresh_cost_sheet_line_monthly_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
  v_def:=pg_get_functiondef(v_oid);
  v_def:=regexp_replace(v_def,
    '(\n\s*)if \(\s*\n\s*select count\(\*\)',
    E'\n    perform costing.fn_assert_stage04_snapshot_write_context(p_refresh_run_id, ''MONTHLY'');\n\n    if (\n        select count(*)',
    '');
  execute v_def;

  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing' and p.proname='rpc_refresh_cost_sheet_line_traceability_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
  v_def:=pg_get_functiondef(v_oid);
  v_def:=regexp_replace(v_def,
    '\n\s*delete\s*\n\s*from costing\.cost_sheet_line_traceability_snapshot',
    E'\n\n    perform costing.fn_assert_stage04_snapshot_write_context(p_refresh_run_id, ''TRACE'');\n\n    delete\n    from costing.cost_sheet_line_traceability_snapshot',
    '');
  execute v_def;

  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing' and p.proname='rpc_refresh_cost_sheet_rm_line_traceability_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
  v_def:=pg_get_functiondef(v_oid);
  v_def:=regexp_replace(v_def,
    '\n\s*if not exists \(',
    E'\n\n    perform costing.fn_assert_stage04_snapshot_write_context(p_refresh_run_id, ''RM_TRACE'');\n\n    if not exists (',
    '');
  execute v_def;
end
$$;