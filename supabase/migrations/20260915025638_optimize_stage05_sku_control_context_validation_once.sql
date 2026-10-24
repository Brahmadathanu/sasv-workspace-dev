-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_guard_stage05_exact_snapshot_write()
returns trigger
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_run_id bigint;
  v_valuation_date date;
  v_period_start date;
  v_validated text;
begin
  begin
    v_run_id := nullif(current_setting('costing.control_snapshot_refresh_run_id',true),'')::bigint;
    v_valuation_date := nullif(current_setting('costing.control_snapshot_valuation_date',true),'')::date;
    v_period_start := nullif(current_setting('costing.control_snapshot_period_start',true),'')::date;
    v_validated := nullif(current_setting('costing.control_snapshot_stage05_validated',true),'');
  exception when others then
    v_run_id := null;
    v_valuation_date := null;
    v_period_start := null;
    v_validated := null;
  end;

  if v_validated is distinct from '1'
     or v_run_id is null
     or v_valuation_date is null
     or v_period_start is null then
    raise exception 'Stage-05 exact snapshot write requires writer-validated refresh context';
  end if;

  if tg_op='DELETE' then
    if old.refresh_run_id is distinct from v_run_id
       or old.valuation_date is distinct from v_valuation_date
       or old.period_start is distinct from v_period_start then
      return null;
    end if;
    return old;
  end if;

  if new.refresh_run_id is distinct from v_run_id
     or new.valuation_date is distinct from v_valuation_date
     or new.period_start is distinct from v_period_start then
    raise exception 'Stage-05 exact snapshot row identity does not match writer-validated refresh context for run %',v_run_id;
  end if;

  if tg_op='UPDATE' and (
       old.refresh_run_id is distinct from new.refresh_run_id
    or old.valuation_date is distinct from new.valuation_date
    or old.period_start is distinct from new.period_start
  ) then
    raise exception 'Stage-05 exact-run identity is immutable';
  end if;

  return new;
end;
$function$;

create or replace function costing.fn_apply_control_snapshot_refresh_context()
returns trigger
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_run_id bigint;
  v_valuation_date date;
  v_period_start date;
  v_validated text;
begin
  begin
    v_run_id := nullif(current_setting('costing.control_snapshot_refresh_run_id',true),'')::bigint;
    v_valuation_date := nullif(current_setting('costing.control_snapshot_valuation_date',true),'')::date;
    v_period_start := nullif(current_setting('costing.control_snapshot_period_start',true),'')::date;
    v_validated := nullif(current_setting('costing.control_snapshot_stage05_validated',true),'');
  exception when others then
    v_run_id := null;
    v_valuation_date := null;
    v_period_start := null;
    v_validated := null;
  end;

  if v_validated is distinct from '1'
     or v_run_id is null
     or v_valuation_date is null
     or v_period_start is null then
    raise exception 'Explicit writer-validated Stage-05 context is required for control snapshot writes';
  end if;

  if new.period_start is distinct from v_period_start then
    raise exception 'Control snapshot period does not match writer-validated refresh context for run %',v_run_id;
  end if;

  if new.refresh_run_id is not null and new.refresh_run_id is distinct from v_run_id then
    raise exception 'Control snapshot refresh_run_id does not match writer-validated refresh context';
  end if;

  if new.valuation_date is not null and new.valuation_date is distinct from v_valuation_date then
    raise exception 'Control snapshot valuation_date does not match writer-validated refresh context';
  end if;

  new.valuation_date := v_valuation_date;
  new.refresh_run_id := v_run_id;
  return new;
end;
$function$;

do $migration$
declare
  v_def text;
  v_newdef text;
  v_matches int;
  v_pattern text := 'perform set_config\(\s*''costing\.control_snapshot_refresh_run_id'',\s*p_refresh_run_id::text,\s*true\s*\);\s*perform set_config\(\s*''costing\.control_snapshot_valuation_date'',\s*p_valuation_date::text,\s*true\s*\);';
  v_replacement text := $replacement$
    if v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Refresh run % is not based on captured-at-request valuation context', p_refresh_run_id;
    end if;

    if v_run.overall_status is distinct from 'RUNNING'
       or v_run.current_stage_code is distinct from '05_CONTROL_MAINTENANCE' then
        raise exception 'Refresh run % is not in active Stage 05 context', p_refresh_run_id;
    end if;

    if not exists (
        select 1
        from costing.costing_refresh_run_stage s
        where s.refresh_run_id = p_refresh_run_id
          and s.stage_code = '05_CONTROL_MAINTENANCE'
          and s.stage_status = 'RUNNING'
    ) then
        raise exception 'Stage 05 is not RUNNING for refresh run %', p_refresh_run_id;
    end if;

    perform set_config('costing.control_snapshot_refresh_run_id',p_refresh_run_id::text,true);
    perform set_config('costing.control_snapshot_valuation_date',p_valuation_date::text,true);
    perform set_config('costing.control_snapshot_period_start',v_period_start::text,true);
    perform set_config('costing.control_snapshot_stage05_validated','1',true);
$replacement$;
begin
  select pg_get_functiondef(p.oid)
  into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_exact_sku_control_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_def is null then raise exception 'Target exact SKU-control writer not found'; end if;

  select count(*) into v_matches
  from regexp_matches(v_def,v_pattern,'g');

  if v_matches <> 1 then
    raise exception 'Expected exactly one Stage05 context-setting block; found %',v_matches;
  end if;

  v_newdef := regexp_replace(v_def,v_pattern,v_replacement,'g');
  execute v_newdef;
end;
$migration$;