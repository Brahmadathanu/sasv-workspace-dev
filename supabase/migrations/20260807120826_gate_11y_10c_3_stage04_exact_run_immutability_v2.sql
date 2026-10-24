-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Gate 11Y.10C.3 — Stage-04 exact-run snapshot immutability hardening

-- Replace period-only uniqueness with exact-run uniqueness.
alter table costing.cost_sheet_line_monthly_snapshot
  drop constraint if exists uq_cost_sheet_monthly_snapshot_line;
alter table costing.cost_sheet_line_monthly_snapshot
  add constraint uq_cost_sheet_monthly_snapshot_line
  unique (snapshot_period_start, valuation_date, refresh_run_id, sku_id, section_code, line_order, line_label);

alter table costing.cost_sheet_line_traceability_snapshot
  drop constraint if exists cost_sheet_line_traceability_snapshot_uq;
alter table costing.cost_sheet_line_traceability_snapshot
  add constraint cost_sheet_line_traceability_snapshot_uq
  unique (period_start, valuation_date, refresh_run_id, product_id, sku_id, section_code, line_order, line_label);

-- Patch exact-run delete/validation predicates in existing governed writers.
do $$
declare
  v_oid oid;
  v_def text;
begin
  -- Printable monthly snapshot writer.
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='refresh_cost_sheet_line_monthly_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
  if v_oid is null then raise exception 'Exact-run monthly cost-sheet writer not found'; end if;
  v_def := pg_get_functiondef(v_oid);
  v_def := regexp_replace(v_def,
    'where s\.snapshot_period_start = v_period_start;',
    E'where s.snapshot_period_start = v_period_start\n      and s.valuation_date = p_valuation_date\n      and s.refresh_run_id = p_refresh_run_id;',
    'g');
  v_def := regexp_replace(v_def,
    'where s\.snapshot_period_start = v_period_start\s+and \(',
    E'where s.snapshot_period_start = v_period_start\n      and s.valuation_date = p_valuation_date\n      and s.refresh_run_id = p_refresh_run_id\n      and (',
    'g');
  execute v_def;

  -- General cost-sheet line trace writer.
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_cost_sheet_line_traceability_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
  if v_oid is null then raise exception 'Exact-run cost-sheet trace writer not found'; end if;
  v_def := pg_get_functiondef(v_oid);
  v_def := regexp_replace(v_def,
    'where s\.period_start = v_period_start;',
    E'where s.period_start = v_period_start\n      and s.valuation_date = p_valuation_date\n      and s.refresh_run_id = p_refresh_run_id;',
    'g');
  v_def := regexp_replace(v_def,
    'where s\.period_start = v_period_start\s+and \(',
    E'where s.period_start = v_period_start\n      and s.valuation_date = p_valuation_date\n      and s.refresh_run_id = p_refresh_run_id\n      and (',
    'g');
  execute v_def;

  -- RM line trace writer.
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_cost_sheet_rm_line_traceability_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
  if v_oid is null then raise exception 'Exact-run RM cost-sheet trace writer not found'; end if;
  v_def := pg_get_functiondef(v_oid);
  v_def := regexp_replace(v_def,
    'where s\.period_start = v_period_start;',
    E'where s.period_start = v_period_start\n      and s.valuation_date = p_valuation_date\n      and s.refresh_run_id = p_refresh_run_id;',
    'g');
  execute v_def;
end
$$;