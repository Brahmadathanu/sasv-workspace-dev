-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.sku_costing_control_status_snapshot drop constraint if exists sku_costing_control_status_snapshot_pk;
create unique index uq_sku_control_legacy on costing.sku_costing_control_status_snapshot(period_start, sku_id) where refresh_run_id is null;
create unique index uq_sku_control_exact on costing.sku_costing_control_status_snapshot(period_start, valuation_date, refresh_run_id, sku_id) where refresh_run_id is not null;

alter table costing.costing_control_dashboard_snapshot drop constraint if exists costing_control_dashboard_snapshot_period_uk;
create unique index uq_control_dashboard_legacy on costing.costing_control_dashboard_snapshot(period_start) where refresh_run_id is null;
create unique index uq_control_dashboard_exact on costing.costing_control_dashboard_snapshot(period_start, valuation_date, refresh_run_id) where refresh_run_id is not null;

alter table costing.material_costing_action_queue_snapshot drop constraint if exists material_costing_action_queue_snapshot_pk;
create unique index uq_material_action_queue_legacy on costing.material_costing_action_queue_snapshot(period_start, stock_item_id, material_area, action_severity, recommended_ui_route) where refresh_run_id is null;
create unique index uq_material_action_queue_exact on costing.material_costing_action_queue_snapshot(period_start, valuation_date, refresh_run_id, stock_item_id, material_area, action_severity, recommended_ui_route) where refresh_run_id is not null;

alter table costing.material_costing_action_drilldown_snapshot drop constraint if exists material_costing_action_drilldown_snapshot_pk;
create unique index uq_material_action_drilldown_legacy on costing.material_costing_action_drilldown_snapshot(period_start, source_line_key, sku_id) where refresh_run_id is null;
create unique index uq_material_action_drilldown_exact on costing.material_costing_action_drilldown_snapshot(period_start, valuation_date, refresh_run_id, source_line_key, sku_id) where refresh_run_id is not null;

alter table costing.costing_review_workbench_summary_snapshot drop constraint if exists costing_review_workbench_summary_snapshot_pkey;
create unique index uq_review_summary_legacy on costing.costing_review_workbench_summary_snapshot(period_start, material_line_status, material_issue_code, bom_source) where refresh_run_id is null;
create unique index uq_review_summary_exact on costing.costing_review_workbench_summary_snapshot(period_start, valuation_date, refresh_run_id, material_line_status, material_issue_code, bom_source) where refresh_run_id is not null;

alter table costing.costing_review_top_action_item_snapshot drop constraint if exists costing_review_top_action_item_snapshot_pkey;
create unique index uq_review_top_legacy on costing.costing_review_top_action_item_snapshot(period_start, material_issue_code, bom_source, stock_item_id) where refresh_run_id is null;
create unique index uq_review_top_exact on costing.costing_review_top_action_item_snapshot(period_start, valuation_date, refresh_run_id, material_issue_code, bom_source, stock_item_id) where refresh_run_id is not null;

alter table costing.costing_control_integrity_audit_snapshot drop constraint if exists costing_control_integrity_audit_snapshot_pk;
create unique index uq_control_audit_legacy on costing.costing_control_integrity_audit_snapshot(period_start, check_code) where refresh_run_id is null;
create unique index uq_control_audit_exact on costing.costing_control_integrity_audit_snapshot(period_start, valuation_date, refresh_run_id, check_code) where refresh_run_id is not null;

create unique index uq_review_drilldown_exact_rm on costing.costing_review_action_item_drilldown_snapshot(period_start, valuation_date, refresh_run_id, frozen_rm_line_snapshot_id) where refresh_run_id is not null and frozen_source_type='RM';
create unique index uq_review_drilldown_exact_pm on costing.costing_review_action_item_drilldown_snapshot(period_start, valuation_date, refresh_run_id, frozen_pm_line_snapshot_id) where refresh_run_id is not null and frozen_source_type='PM';

create or replace function costing.fn_guard_stage05_exact_snapshot_write()
returns trigger language plpgsql security definer
set search_path=costing,public,pg_temp
as $function$
declare v_run_id bigint; v_valuation_date date; v_stage_ok boolean := false;
begin
  if tg_op='DELETE' then
    begin
      v_run_id := nullif(current_setting('costing.control_snapshot_refresh_run_id',true),'')::bigint;
      v_valuation_date := nullif(current_setting('costing.control_snapshot_valuation_date',true),'')::date;
    exception when others then
      v_run_id := null; v_valuation_date := null;
    end;
    if v_run_id is null or v_valuation_date is null then
      raise exception 'Stage-05 snapshot delete requires exact refresh-run context';
    end if;
    select exists(
      select 1 from costing.costing_refresh_run r
      join costing.costing_refresh_run_stage s on s.refresh_run_id=r.id and s.stage_code='05_CONTROL_MAINTENANCE'
      where r.id=v_run_id and r.valuation_date=v_valuation_date and r.overall_status='RUNNING'
        and r.current_stage_code='05_CONTROL_MAINTENANCE' and s.stage_status='RUNNING'
    ) into v_stage_ok;
    if not v_stage_ok then raise exception 'Stage-05 snapshot delete is outside active Stage 05 context for run %',v_run_id; end if;
    if old.refresh_run_id is distinct from v_run_id or old.valuation_date is distinct from v_valuation_date then return null; end if;
    return old;
  end if;

  v_run_id:=new.refresh_run_id; v_valuation_date:=new.valuation_date;
  if v_run_id is null or v_valuation_date is null then raise exception 'New Stage-05 snapshot rows require valuation_date and refresh_run_id'; end if;
  select exists(
    select 1 from costing.costing_refresh_run r
    join costing.costing_refresh_run_stage s on s.refresh_run_id=r.id and s.stage_code='05_CONTROL_MAINTENANCE'
    where r.id=v_run_id and r.period_start=new.period_start and r.valuation_date=v_valuation_date
      and r.overall_status='RUNNING' and r.current_stage_code='05_CONTROL_MAINTENANCE' and s.stage_status='RUNNING'
  ) into v_stage_ok;
  if not v_stage_ok then raise exception 'Stage-05 snapshot write is outside active Stage 05 context for run %',v_run_id; end if;
  if tg_op='UPDATE' and (old.refresh_run_id is distinct from new.refresh_run_id or old.valuation_date is distinct from new.valuation_date or old.period_start is distinct from new.period_start) then
    raise exception 'Stage-05 exact-run identity is immutable';
  end if;
  return new;
end;
$function$;

create or replace function costing.fn_apply_sku_control_hard_blocker_priority()
returns trigger language plpgsql security definer
set search_path=costing,public,pg_temp
as $function$
declare v_dl_status text; v_dl_reason text;
begin
  if new.material_costing_status='BLOCKED' then return new; end if;
  select d.direct_labour_allocation_status,d.allocation_reason_code into v_dl_status,v_dl_reason
  from costing.sku_direct_labour_allocation_snapshot d
  where d.period_start=new.period_start and d.valuation_date=new.valuation_date and d.refresh_run_id=new.refresh_run_id and d.sku_id=new.sku_id;
  if v_dl_status='BLOCKED' and v_dl_reason='BLOCKED_NO_VALID_EFFECTIVE_ROUTE' then
    new.first_control_status:='DIRECT_LABOUR_ROUTE_BLOCKED';
    new.control_severity:='BLOCKER';
    new.recommended_ui_route:='PRODUCTION_ROUTE_MANAGER';
    new.control_note:='Direct Labour is blocked because no valid effective Production Route exists for the Product. Resolve the Product route in Production Route Manager. Any material review condition remains secondary evidence.';
  end if;
  return new;
end;
$function$;

do $do$ declare t text;
begin
 foreach t in array array['sku_costing_control_status_snapshot','costing_control_dashboard_snapshot','material_costing_action_queue_snapshot','material_costing_action_drilldown_snapshot','costing_review_workbench_summary_snapshot','costing_review_top_action_item_snapshot','costing_review_action_item_drilldown_snapshot','costing_control_integrity_audit_snapshot'] loop
   execute format('drop trigger if exists a_stage05_exact_write_guard on costing.%I',t);
   execute format('create trigger a_stage05_exact_write_guard before insert or update or delete on costing.%I for each row execute function costing.fn_guard_stage05_exact_snapshot_write()',t);
 end loop;
end $do$;

drop trigger if exists b_sku_control_hard_blocker_priority on costing.sku_costing_control_status_snapshot;
create trigger b_sku_control_hard_blocker_priority before insert or update on costing.sku_costing_control_status_snapshot for each row execute function costing.fn_apply_sku_control_hard_blocker_priority();

do $do$ declare v_oid oid; v_def text;
begin
 select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='costing' and p.proname='rpc_refresh_exact_costing_control_integrity_audit'
   and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
 v_def:=pg_get_functiondef(v_oid);
 if v_def not ilike '%PRODUCTION_ROUTE_MANAGER%' then
   v_def:=replace(v_def,'''DIAGNOSTIC_REVIEW''','''DIAGNOSTIC_REVIEW'', ''PRODUCTION_ROUTE_MANAGER''');
   execute v_def;
 end if;
end $do$;