-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_before int;
  v_after int;
begin
  select p.oid, pg_get_functiondef(p.oid)
    into v_oid, v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_exact_material_action_review_snapshots'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_oid is null then raise exception 'Target function not found'; end if;

  v_before := (length(v_def)-length(replace(v_def,'and valuation_date = p_valuation_date','')))/length('and valuation_date = p_valuation_date');
  if v_before < 5 then raise exception 'Expected at least 5 unqualified valuation_date predicates, found %', v_before; end if;

  v_new := v_def;
  v_new := regexp_replace(v_new,
    'delete from costing\.material_costing_action_drilldown_snapshot\s+where period_start = v_period_start\s+and valuation_date = p_valuation_date\s+and refresh_run_id = p_refresh_run_id;',
    E'delete from costing.material_costing_action_drilldown_snapshot d\n    where d.period_start = v_period_start\n      and d.valuation_date = p_valuation_date\n      and d.refresh_run_id = p_refresh_run_id;', 'g');
  v_new := regexp_replace(v_new,
    'delete from costing\.material_costing_action_queue_snapshot\s+where period_start = v_period_start\s+and valuation_date = p_valuation_date\s+and refresh_run_id = p_refresh_run_id;',
    E'delete from costing.material_costing_action_queue_snapshot q\n    where q.period_start = v_period_start\n      and q.valuation_date = p_valuation_date\n      and q.refresh_run_id = p_refresh_run_id;', 'g');
  v_new := regexp_replace(v_new,
    'delete from costing\.costing_review_action_item_drilldown_snapshot\s+where period_start = v_period_start\s+and valuation_date = p_valuation_date\s+and refresh_run_id = p_refresh_run_id;',
    E'delete from costing.costing_review_action_item_drilldown_snapshot d\n    where d.period_start = v_period_start\n      and d.valuation_date = p_valuation_date\n      and d.refresh_run_id = p_refresh_run_id;', 'g');
  v_new := regexp_replace(v_new,
    'delete from costing\.costing_review_top_action_item_snapshot\s+where period_start = v_period_start\s+and valuation_date = p_valuation_date\s+and refresh_run_id = p_refresh_run_id;',
    E'delete from costing.costing_review_top_action_item_snapshot t\n    where t.period_start = v_period_start\n      and t.valuation_date = p_valuation_date\n      and t.refresh_run_id = p_refresh_run_id;', 'g');
  v_new := regexp_replace(v_new,
    'delete from costing\.costing_review_workbench_summary_snapshot\s+where period_start = v_period_start\s+and valuation_date = p_valuation_date\s+and refresh_run_id = p_refresh_run_id;',
    E'delete from costing.costing_review_workbench_summary_snapshot s\n    where s.period_start = v_period_start\n      and s.valuation_date = p_valuation_date\n      and s.refresh_run_id = p_refresh_run_id;', 'g');

  if v_new = v_def then raise exception 'No DELETE predicates were rewritten'; end if;
  execute v_new;
end $$;