-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- PREPARED (not applied): W2 governed period lifecycle. Local build/test only (19 Oct 2026).
-- Apply only after explicit user approval, unchanged, via Supabase MCP apply_migration.
-- Approved defaults (19 Oct 07:59 IST): open only the month after the latest period (and never beyond next calendar month), valuation date = day opened (editable, within the month);
-- editors (module:costing-control-center edit) open / lock / reopen; OWNER ONLY approve / authorise supersession / supersede / close;
-- approval refuses BLOCKED SKUs, allows REVIEW_REQUIRED with the count recorded; one APPROVED run per month (supersede instead);
-- close only after lock; never reopen after close; supersession authorisation valid 120 minutes. Every action audited.
-- Cost logic is not touched: no snapshot, refresh, pricing or view definition changes.

do $pre$
begin
  if md5(pg_get_functiondef('costing.rpc_designate_costing_run(bigint,text,text,text)'::regprocedure)) <> 'a59d2c7bdf76e908b0e35b69d6829cd3' then raise exception 'W2 precheck: rpc_designate_costing_run changed'; end if;
  if md5(pg_get_functiondef('costing.rpc_close_cost_period(date,text,text,text)'::regprocedure)) <> '120351430b7f9019034a5a3f0dfa17ef' then raise exception 'W2 precheck: rpc_close_cost_period changed'; end if;
  if md5(pg_get_functiondef('costing.rpc_authorize_period_refresh(date,text,text,integer)'::regprocedure)) <> '3caac4bf51f34b3001ca0623e86de042' then raise exception 'W2 precheck: rpc_authorize_period_refresh changed'; end if;
  if md5(pg_get_functiondef('costing.fn_default_cost_period_valuation_date(date)'::regprocedure)) <> 'fa503215283deda19d9517335d4aa940' then raise exception 'W2 precheck: fn_default_cost_period_valuation_date changed'; end if;
  if md5(pg_get_functiondef('costing.fn_verify_run_fingerprint(bigint)'::regprocedure)) <> '28df0f2e8b145e3c700df72c58765758' then raise exception 'W2 precheck: fn_verify_run_fingerprint (W5) changed'; end if;
  if md5(pg_get_functiondef('public.require_permission(text,boolean)'::regprocedure)) <> 'd4921dbcd3029e00eef14c4bfd159e22' then raise exception 'W2 precheck: require_permission changed'; end if;
  if md5(pg_get_viewdef('costing.v_current_successful_costing_refresh_run'::regclass)) <> '5cc25791985abf5d336fb9311da3d6f1' then raise exception 'W2 precheck: pointer view changed'; end if;
  if md5(pg_get_viewdef('costing.v_costing_run_effective_designation'::regclass)) <> 'b324068d66aef0c14bc6d47a921c6d56' then raise exception 'W2 precheck: effective designation view changed'; end if;
  if md5(pg_get_viewdef('costing.v_costing_period_run_status'::regclass)) <> 'd38be6e4c0c8bb9811f4872b78e72936' then raise exception 'W2 precheck: W1 run status view changed'; end if;
  -- guards: either the reviewed live version, or this package already installed (re-run)
  if md5(pg_get_functiondef('costing.fn_guard_designated_run_rows()'::regprocedure)) <> 'a3c4217fa914c798941652e4465c3822'
     and not exists (select 1 from pg_proc where proname = 'fn_w2_guard_single_approved') then raise exception 'W2 precheck: fn_guard_designated_run_rows changed'; end if;
  if md5(pg_get_functiondef('costing.fn_guard_designated_run_header()'::regprocedure)) <> '9091f26fb86022be55cd145353db3a18'
     and not exists (select 1 from pg_proc where proname = 'fn_w2_guard_single_approved') then raise exception 'W2 precheck: fn_guard_designated_run_header changed'; end if;
  if md5(pg_get_constraintdef((select oid from pg_constraint where conname = 'cost_period_governance_audit_event_type_chk'))) <> '0ad330aa340bfa1c8cfbf83f833e62f6'
     and not exists (select 1 from pg_proc where proname = 'fn_w2_guard_single_approved') then raise exception 'W2 precheck: audit event_type check changed'; end if;
  -- integrity of the approved months must hold before and after
  if exists (select 1 from costing.v_costing_run_effective_designation e where e.designation = 'APPROVED'
             group by e.period_start having count(*) > 1) then raise exception 'W2 precheck: a month already has two APPROVED runs'; end if;
end $pre$;

-- ---------------------------------------------------------------------------------------------
-- H1. Truncate guard for the W5 re-baseline log (parity gap)
drop trigger if exists trg_au2_append_only_truncate on costing.costing_run_fingerprint_rebaseline;
create trigger trg_au2_append_only_truncate before truncate on costing.costing_run_fingerprint_rebaseline
  for each statement execute function costing.fn_guard_append_only();

-- H2. Period governance audit becomes append-only (today only inserts are used)
drop trigger if exists trg_w2_audit_append_only on costing.cost_period_governance_audit;
create trigger trg_w2_audit_append_only before update or delete on costing.cost_period_governance_audit
  for each row execute function costing.fn_guard_append_only();
drop trigger if exists trg_w2_audit_append_only_truncate on costing.cost_period_governance_audit;
create trigger trg_w2_audit_append_only_truncate before truncate on costing.cost_period_governance_audit
  for each statement execute function costing.fn_guard_append_only();

-- H3. Audit event types for run governance
alter table costing.cost_period_governance_audit drop constraint if exists cost_period_governance_audit_event_type_chk;
alter table costing.cost_period_governance_audit add constraint cost_period_governance_audit_event_type_chk check (event_type = any (array[
  'MIGRATION_BACKFILL'::text, 'PERIOD_CREATED'::text, 'VALUATION_DATE_CHANGED'::text, 'PERIOD_LOCKED'::text, 'PERIOD_REOPENED'::text, 'PERIOD_CLOSED'::text,
  'RUN_APPROVED'::text, 'SUPERSESSION_AUTHORISED'::text, 'RUN_SUPERSEDED'::text]));

-- H4. Superseded (REVOKED) runs stay immutable like APPROVED/REFERENCE runs, so history is kept exactly
CREATE OR REPLACE FUNCTION costing.fn_guard_designated_run_rows()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare v_run bigint; v_des text;
begin
  v_run := case when tg_op='DELETE' then old.refresh_run_id else new.refresh_run_id end;
  if tg_op='UPDATE' and old.refresh_run_id is distinct from new.refresh_run_id then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id=old.refresh_run_id;
    if v_des in ('REFERENCE','APPROVED','REVOKED') then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; % on costing.% prohibited', old.refresh_run_id, v_des, tg_op, tg_table_name using errcode='P0001';
    end if;
  end if;
  if v_run is not null then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id=v_run;
    if v_des in ('REFERENCE','APPROVED','REVOKED') then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; % on costing.% prohibited', v_run, v_des, tg_op, tg_table_name using errcode='P0001';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $function$;

CREATE OR REPLACE FUNCTION costing.fn_guard_designated_run_header()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare v_des text; v_auth bigint; v_ref bigint;
begin
  if tg_op = 'INSERT' then
    select e.refresh_run_id into v_ref from costing.v_costing_run_effective_designation e
     where e.period_start = new.period_start and e.designation = 'APPROVED'
     order by e.designated_at desc limit 1;
    if v_ref is not null then
      select a.id into v_auth from costing.costing_period_refresh_authorization a
       where a.period_start = new.period_start and a.consumed_by_run_id is null and a.valid_until > now()
       order by a.authorised_at desc limit 1 for update;
      if v_auth is null then
        raise exception 'AU2_PERIOD_HOLDS_APPROVED_RUN: period % holds APPROVED run %; a recorded supersession authorisation is required', new.period_start, v_ref using errcode='P0001';
      end if;
      new.request_note := coalesce(new.request_note,'') || format(' [AU2 supersession authorisation %s]', v_auth);
      perform set_config('costing.au2_pending_authorization', v_auth::text, true);
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id = old.id;
    if v_des in ('REFERENCE','APPROVED','REVOKED') and (row(new.*) is distinct from row(old.*)) then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; header update prohibited', old.id, v_des using errcode='P0001';
    end if;
    return new;
  else
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id = old.id;
    if v_des is not null then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % has designation history; delete prohibited', old.id using errcode='P0001';
    end if;
    return old;
  end if;
end $function$;

-- H5. At most one APPROVED run per month (any path, including service_role designate)
create or replace function costing.fn_w2_guard_single_approved()
returns trigger language plpgsql security definer set search_path to 'costing','public','pg_temp' as $f$
declare v_other bigint;
begin
  if new.designation = 'APPROVED' then
    select e.refresh_run_id into v_other from costing.v_costing_run_effective_designation e
     where e.period_start = new.period_start and e.designation = 'APPROVED' and e.refresh_run_id <> new.refresh_run_id
     limit 1;
    if v_other is not null then
      raise exception 'W2_SECOND_APPROVED_RUN: period % already has APPROVED run %; supersede it instead', new.period_start, v_other using errcode = 'P0001';
    end if;
  end if;
  return new;
end $f$;
drop trigger if exists trg_w2_single_approved on costing.costing_run_designation;
create trigger trg_w2_single_approved before insert on costing.costing_run_designation
  for each row execute function costing.fn_w2_guard_single_approved();

-- H6. A CLOSED period is final
create or replace function costing.fn_w2_guard_closed_period()
returns trigger language plpgsql set search_path to 'costing','public','pg_temp' as $f$
begin
  if old.status = 'CLOSED' then
    raise exception 'W2_CLOSED_PERIOD_FINAL: period % is CLOSED; % prohibited', old.period_start, tg_op using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $f$;
drop trigger if exists trg_w2_closed_period_final on costing.cost_periods;
create trigger trg_w2_closed_period_final before update or delete on costing.cost_periods
  for each row execute function costing.fn_w2_guard_closed_period();

-- ---------------------------------------------------------------------------------------------
-- Owner (single approver). Changing it needs a new governed migration (append-only).
create table if not exists costing.costing_governance_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null,
  display_name text not null check (length(btrim(display_name)) > 0),
  set_at timestamptz not null default now(),
  set_reason text not null);
drop trigger if exists trg_au2_append_only on costing.costing_governance_owner;
create trigger trg_au2_append_only before update or delete on costing.costing_governance_owner
  for each row execute function costing.fn_guard_append_only();
drop trigger if exists trg_au2_append_only_truncate on costing.costing_governance_owner;
create trigger trg_au2_append_only_truncate before truncate on costing.costing_governance_owner
  for each statement execute function costing.fn_guard_append_only();
revoke all on costing.costing_governance_owner from public, anon, authenticated;
insert into costing.costing_governance_owner(user_id, display_name, set_reason)
values ('dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'Dr. Brahmadathan U',
        'W2 owner-only approver (user approval 2026-10-19 07:59 IST); the only holder of module:costing-control-center')
on conflict (singleton) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Helpers
create or replace function costing.fn_w2_owner_name() returns text
language plpgsql stable security definer set search_path to 'costing','public','pg_temp' as $f$
declare v text;
begin
  select display_name into v from costing.costing_governance_owner where user_id = auth.uid();
  if v is null then raise exception 'W2_OWNER_ONLY: this action is reserved for the costing owner' using errcode = 'P0001'; end if;
  return v;
end $f$;

create or replace function costing.fn_w2_require_text(p_reason text, p_ref text) returns void
language plpgsql immutable as $f$
begin
  if coalesce(length(btrim(p_reason)), 0) < 10 then raise exception 'W2_REASON_REQUIRED: reason must be at least 10 characters' using errcode = 'P0001'; end if;
  if coalesce(length(btrim(p_ref)), 0) = 0 then raise exception 'W2_APPROVAL_REFERENCE_REQUIRED' using errcode = 'P0001'; end if;
end $f$;

create or replace function costing.fn_w2_audit(p_period date, p_event text, p_prev costing.cost_periods, p_new costing.cost_periods,
  p_reason text, p_ref text, p_evidence jsonb) returns bigint
language plpgsql security definer set search_path to 'costing','public','pg_temp' as $f$
declare v_id bigint;
begin
  insert into costing.cost_period_governance_audit(period_start, event_type, previous_status, new_status, previous_valuation_date, new_valuation_date,
    previous_valuation_date_status, new_valuation_date_status, reason, approval_reference, event_source, actor_user_id, evidence_json, occurred_at)
  values (p_period, p_event, p_prev.status, p_new.status, p_prev.valuation_date, p_new.valuation_date,
    p_prev.valuation_date_status, p_new.valuation_date_status, btrim(p_reason), btrim(p_ref), 'GOVERNED_RPC', auth.uid(),
    coalesce(p_evidence, '{}'::jsonb) || jsonb_build_object('w2', true), statement_timestamp())
  returning audit_id into v_id;
  return v_id;
end $f$;

-- Pre-approval checks (read-only). p_mode: APPROVE or SUPERSEDE.
create or replace function costing.fn_w2_run_checks(p_run bigint, p_mode text) returns jsonb
language plpgsql stable security definer set search_path to 'costing','public','pg_temp' as $f$
declare r costing.costing_refresh_run%rowtype; p costing.cost_periods%rowtype; v_des text; v_appr bigint; v_appr_fin timestamptz;
  v_active bigint; v_fp bigint; v_drift bigint; v_total bigint; v_blocked bigint; v_review bigint; v_ready bigint; v_auth bigint;
  c jsonb := '[]'::jsonb;
begin
  if p_mode not in ('APPROVE','SUPERSEDE') then raise exception 'W2_BAD_MODE: %', p_mode; end if;
  select * into r from costing.costing_refresh_run where id = p_run;
  if not found then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'run', p_run, 'checks', jsonb_build_array(jsonb_build_object('code','RUN_EXISTS','pass',false,'detail','Run not found')));
  end if;
  select * into p from costing.cost_periods where period_start = r.period_start;
  select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id = p_run;
  select e.refresh_run_id, rr.finished_at into v_appr, v_appr_fin
    from costing.v_costing_run_effective_designation e join costing.costing_refresh_run rr on rr.id = e.refresh_run_id
   where e.period_start = r.period_start and e.designation = 'APPROVED' and e.refresh_run_id <> p_run
   order by e.designated_at desc limit 1;
  select count(*) into v_active from costing.costing_refresh_run where period_start = r.period_start and overall_status in ('QUEUED','RUNNING');
  select id into v_fp from costing.costing_run_fingerprint where refresh_run_id = p_run order by captured_at desc, id desc limit 1;
  if v_fp is not null then select count(*) into v_drift from costing.fn_verify_run_fingerprint(p_run) where not matches; end if;
  select count(*), count(*) filter (where cost_sheet_status = 'BLOCKED'), count(*) filter (where cost_sheet_status = 'REVIEW_REQUIRED'),
         count(*) filter (where cost_sheet_status = 'READY')
    into v_total, v_blocked, v_review, v_ready from costing.v_sku_detailed_cost_sheet where refresh_run_id = p_run;
  c := c || jsonb_build_object('code','RUN_SUCCESS','pass', r.overall_status = 'SUCCESS' and r.valuation_context_source = 'CAPTURED_AT_REQUEST',
                               'detail', r.overall_status || ' / ' || r.valuation_context_source)
         || jsonb_build_object('code','NOT_ALREADY_DESIGNATED','pass', v_des is null, 'detail', coalesce(v_des, 'none'))
         || jsonb_build_object('code','PERIOD_OPEN','pass', p.status = 'OPEN', 'detail', coalesce(p.status, 'no period'))
         || jsonb_build_object('code','VALUATION_DATE_MATCHES','pass', r.valuation_date = p.valuation_date,
                               'detail', format('run %s / period %s', r.valuation_date, p.valuation_date))
         || jsonb_build_object('code','NO_ACTIVE_RUN','pass', v_active = 0, 'detail', v_active || ' queued/running')
         || jsonb_build_object('code','FINGERPRINT_CAPTURED','pass', v_fp is not null, 'detail', coalesce('capture ' || v_fp, 'none'))
         || jsonb_build_object('code','FINGERPRINT_CLEAN','pass', v_fp is not null and v_drift = 0, 'detail', coalesce(v_drift || ' drifted tables', 'not verifiable'))
         || jsonb_build_object('code','HAS_COST_SHEET','pass', v_total > 0, 'detail', v_total || ' SKUs')
         || jsonb_build_object('code','NO_BLOCKED_SKUS','pass', v_blocked = 0, 'detail', v_blocked || ' BLOCKED')
         || jsonb_build_object('code','REVIEW_REQUIRED_RECORDED','pass', true, 'detail', v_review || ' REVIEW_REQUIRED (allowed, recorded)');
  if p_mode = 'APPROVE' then
    c := c || jsonb_build_object('code','NO_OTHER_APPROVED_RUN','pass', v_appr is null, 'detail', coalesce('approved run ' || v_appr || ' exists: use supersede', 'none'));
  else
    select a.id into v_auth from costing.costing_period_refresh_authorization a where a.period_start = r.period_start and a.consumed_by_run_id = p_run;
    c := c || jsonb_build_object('code','HAS_APPROVED_RUN_TO_SUPERSEDE','pass', v_appr is not null, 'detail', coalesce('run ' || v_appr, 'none'))
           || jsonb_build_object('code','NEWER_THAN_APPROVED','pass', v_appr is not null and r.finished_at > v_appr_fin,
                                 'detail', format('finished %s vs %s', r.finished_at, v_appr_fin))
           || jsonb_build_object('code','SUPERSESSION_AUTHORISATION_CONSUMED','pass', v_auth is not null, 'detail', coalesce('authorisation ' || v_auth, 'run was not created under a supersession authorisation'));
  end if;
  return jsonb_build_object('ok', not exists (select 1 from jsonb_array_elements(c) x where not (x->>'pass')::boolean),
    'mode', p_mode, 'run', p_run, 'period_start', r.period_start, 'approved_run', v_appr, 'fingerprint_id', v_fp, 'authorisation_id', v_auth,
    'counts', jsonb_build_object('total', v_total, 'ready', v_ready, 'review_required', v_review, 'blocked', v_blocked), 'checks', c);
end $f$;

-- ---------------------------------------------------------------------------------------------
-- Client RPCs (public). All SECURITY DEFINER, advisory-locked per period, audited.
create or replace function public.rpc_costing_period_governance_context()
returns jsonb language plpgsql stable security definer set search_path to 'public','costing','pg_temp' as $f$
declare v_next date; v_max date;
begin
  select max(period_start) into v_max from costing.cost_periods;
  v_next := (v_max + interval '1 month')::date;
  return jsonb_build_object(
    'user_id', auth.uid(),
    'can_view', public.app_has_permission('module:costing-control-center', 'view'),
    'can_edit', public.app_has_permission('module:costing-control-center', 'edit'),
    'is_owner', exists (select 1 from costing.costing_governance_owner o where o.user_id = auth.uid()),
    'latest_period_start', v_max, 'next_period_start', v_next,
    'default_valuation_date', case when v_next is null then null else costing.fn_default_cost_period_valuation_date(v_next) end,
    'supersession_valid_minutes', 120);
end $f$;

create or replace function public.rpc_costing_preflight_run(p_refresh_run_id bigint, p_mode text default 'APPROVE')
returns jsonb language plpgsql stable security definer set search_path to 'public','costing','pg_temp' as $f$
begin
  perform public.require_permission('module:costing-control-center', false);
  return costing.fn_w2_run_checks(p_refresh_run_id, upper(coalesce(p_mode, 'APPROVE')));
end $f$;

create or replace function public.rpc_costing_open_next_period(p_reason text, p_approval_reference text, p_valuation_date date default null)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp' as $f$
declare v_next date; v_end date; v_vd date; v_src text; v_new costing.cost_periods; v_audit bigint;
begin
  perform public.require_permission('module:costing-control-center', true);
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:open-next', 0));
  select (max(period_start) + interval '1 month')::date into v_next from costing.cost_periods;
  if v_next is null then raise exception 'W2_NO_PERIODS: no existing period to follow'; end if;
  if v_next > (date_trunc('month', costing.fn_india_business_date()::timestamp) + interval '1 month')::date then
    raise exception 'W2_NEXT_MONTH_NOT_DUE: next period % is beyond next month (India date %)', v_next, costing.fn_india_business_date() using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:' || v_next::text, 0));
  v_end := (v_next + interval '1 month' - interval '1 day')::date;
  v_vd := coalesce(p_valuation_date, costing.fn_default_cost_period_valuation_date(v_next));
  v_src := case when p_valuation_date is null then 'SYSTEM_DEFAULT' else 'GOVERNED_MANUAL' end;
  if v_vd < v_next or v_vd > v_end then
    raise exception 'W2_VALUATION_DATE_OUTSIDE_MONTH: % is not within % to %', v_vd, v_next, v_end using errcode = 'P0001';
  end if;
  insert into costing.cost_periods(period_start, period_end, status, remarks, valuation_date, valuation_date_source, valuation_date_status,
    valuation_date_change_reason, valuation_date_approval_reference, valuation_date_set_at, valuation_date_set_by, created_at, updated_at)
  values (v_next, v_end, 'OPEN', 'Opened by W2 governed RPC', v_vd, v_src, 'DRAFT', btrim(p_reason), btrim(p_approval_reference),
    statement_timestamp(), auth.uid(), statement_timestamp(), statement_timestamp())
  returning * into v_new;
  v_audit := costing.fn_w2_audit(v_next, 'PERIOD_CREATED', null::costing.cost_periods, v_new, p_reason, p_approval_reference,
    jsonb_build_object('action','OPEN_NEXT_PERIOD','valuation_date_source', v_src));
  return jsonb_build_object('period_start', v_next, 'status', 'OPEN', 'valuation_date', v_vd, 'valuation_date_source', v_src, 'audit_id', v_audit);
end $f$;

create or replace function public.rpc_costing_approve_run(p_refresh_run_id bigint, p_reason text, p_approval_reference text)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp' as $f$
declare v_name text; v_chk jsonb; v_period date; v_des bigint; v_p costing.cost_periods; v_audit bigint;
begin
  v_name := costing.fn_w2_owner_name();
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  select period_start into v_period from costing.costing_refresh_run where id = p_refresh_run_id;
  if v_period is null then raise exception 'W2_RUN_NOT_FOUND: %', p_refresh_run_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:' || v_period::text, 0));
  v_chk := costing.fn_w2_run_checks(p_refresh_run_id, 'APPROVE');
  if not (v_chk->>'ok')::boolean then
    raise exception 'W2_APPROVAL_CHECKS_FAILED: run %: %', p_refresh_run_id,
      (select string_agg((x->>'code') || ' (' || (x->>'detail') || ')', '; ') from jsonb_array_elements(v_chk->'checks') x where not (x->>'pass')::boolean)
      using errcode = 'P0001';
  end if;
  v_des := costing.rpc_designate_costing_run(p_refresh_run_id, 'APPROVED', v_name, btrim(p_reason) || ' [' || btrim(p_approval_reference) || ']');
  select * into v_p from costing.cost_periods where period_start = v_period;
  v_audit := costing.fn_w2_audit(v_period, 'RUN_APPROVED', v_p, v_p, p_reason, p_approval_reference,
    jsonb_build_object('refresh_run_id', p_refresh_run_id, 'designation_id', v_des,
      'designation_fingerprint_id', (select fingerprint_id from costing.costing_run_designation where id = v_des),
      'counts', v_chk->'counts', 'checks', v_chk->'checks'));
  return jsonb_build_object('refresh_run_id', p_refresh_run_id, 'designation_id', v_des, 'audit_id', v_audit, 'counts', v_chk->'counts');
end $f$;

create or replace function public.rpc_costing_lock_period(p_period_start date, p_reason text, p_approval_reference text)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp' as $f$
declare v_old costing.cost_periods; v_new costing.cost_periods; v_run bigint; v_rvd date; v_drift bigint; v_audit bigint;
begin
  perform public.require_permission('module:costing-control-center', true);
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:' || p_period_start::text, 0));
  select * into v_old from costing.cost_periods where period_start = p_period_start for update;
  if not found then raise exception 'W2_PERIOD_NOT_FOUND: %', p_period_start; end if;
  if v_old.status <> 'OPEN' then raise exception 'W2_LOCK_REQUIRES_OPEN: period % is %', p_period_start, v_old.status using errcode = 'P0001'; end if;
  select refresh_run_id, valuation_date into v_run, v_rvd from costing.v_current_successful_costing_refresh_run
   where period_start = p_period_start and selection_basis = 'APPROVED';
  if v_run is null then raise exception 'W2_LOCK_REQUIRES_APPROVED_RUN: period % has no APPROVED run', p_period_start using errcode = 'P0001'; end if;
  if v_rvd is distinct from v_old.valuation_date then
    raise exception 'W2_LOCK_VALUATION_DATE_MISMATCH: approved run % uses %, period uses %; supersede first', v_run, v_rvd, v_old.valuation_date using errcode = 'P0001';
  end if;
  if exists (select 1 from costing.costing_refresh_run where period_start = p_period_start and overall_status in ('QUEUED','RUNNING')) then
    raise exception 'W2_ACTIVE_RUN: period % has a queued/running run', p_period_start using errcode = 'P0001';
  end if;
  select count(*) into v_drift from costing.fn_verify_run_fingerprint(v_run) where not matches;
  if v_drift > 0 then raise exception 'W2_FINGERPRINT_DRIFT: run % has % drifted tables', v_run, v_drift using errcode = 'P0001'; end if;
  update costing.cost_periods set status = 'LOCKED', valuation_date_status = 'LOCKED', locked_at = statement_timestamp(), locked_by = auth.uid(),
         lock_reason = btrim(p_reason), lock_approval_reference = btrim(p_approval_reference), updated_at = statement_timestamp()
   where period_start = p_period_start returning * into v_new;
  v_audit := costing.fn_w2_audit(p_period_start, 'PERIOD_LOCKED', v_old, v_new, p_reason, p_approval_reference,
    jsonb_build_object('action','LOCK','approved_run', v_run));
  return jsonb_build_object('period_start', p_period_start, 'status', 'LOCKED', 'approved_run', v_run, 'audit_id', v_audit);
end $f$;

create or replace function public.rpc_costing_reopen_period(p_period_start date, p_reason text, p_approval_reference text)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp' as $f$
declare v_old costing.cost_periods; v_new costing.cost_periods; v_audit bigint;
begin
  perform public.require_permission('module:costing-control-center', true);
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:' || p_period_start::text, 0));
  select * into v_old from costing.cost_periods where period_start = p_period_start for update;
  if not found then raise exception 'W2_PERIOD_NOT_FOUND: %', p_period_start; end if;
  if v_old.status = 'CLOSED' then raise exception 'W2_CLOSED_PERIOD_FINAL: period % is CLOSED and can never be reopened', p_period_start using errcode = 'P0001'; end if;
  if v_old.status <> 'LOCKED' then raise exception 'W2_REOPEN_REQUIRES_LOCKED: period % is %', p_period_start, v_old.status using errcode = 'P0001'; end if;
  update costing.cost_periods set status = 'OPEN', valuation_date_status = 'DRAFT', reopened_at = statement_timestamp(), reopened_by = auth.uid(),
         reopen_reason = btrim(p_reason), reopen_approval_reference = btrim(p_approval_reference), updated_at = statement_timestamp()
   where period_start = p_period_start returning * into v_new;
  v_audit := costing.fn_w2_audit(p_period_start, 'PERIOD_REOPENED', v_old, v_new, p_reason, p_approval_reference,
    jsonb_build_object('action','REOPEN','approved_run_kept', (select refresh_run_id from costing.v_current_successful_costing_refresh_run
                                                             where period_start = p_period_start and selection_basis = 'APPROVED')));
  return jsonb_build_object('period_start', p_period_start, 'status', 'OPEN', 'audit_id', v_audit);
end $f$;

create or replace function public.rpc_costing_authorise_supersession(p_period_start date, p_reason text, p_approval_reference text)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp' as $f$
declare v_name text; v_p costing.cost_periods; v_auth bigint; v_appr bigint; v_audit bigint;
begin
  v_name := costing.fn_w2_owner_name();
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:' || p_period_start::text, 0));
  select * into v_p from costing.cost_periods where period_start = p_period_start;
  if not found then raise exception 'W2_PERIOD_NOT_FOUND: %', p_period_start; end if;
  if v_p.status <> 'OPEN' then raise exception 'W2_AUTHORISE_REQUIRES_OPEN: period % is % (reopen first)', p_period_start, v_p.status using errcode = 'P0001'; end if;
  select refresh_run_id into v_appr from costing.v_costing_run_effective_designation where period_start = p_period_start and designation = 'APPROVED' limit 1;
  if v_appr is null then raise exception 'W2_NOTHING_TO_SUPERSEDE: period % has no APPROVED run', p_period_start using errcode = 'P0001'; end if;
  if exists (select 1 from costing.costing_refresh_run where period_start = p_period_start and overall_status in ('QUEUED','RUNNING')) then
    raise exception 'W2_ACTIVE_RUN: period % has a queued/running run', p_period_start using errcode = 'P0001'; end if;
  if exists (select 1 from costing.costing_period_refresh_authorization a where a.period_start = p_period_start and a.consumed_by_run_id is null and a.valid_until > now()) then
    raise exception 'W2_AUTHORISATION_ALREADY_OPEN: period % already has an unused, unexpired authorisation', p_period_start using errcode = 'P0001'; end if;
  v_auth := costing.rpc_authorize_period_refresh(p_period_start, v_name, btrim(p_reason) || ' [' || btrim(p_approval_reference) || ']', 120);
  v_audit := costing.fn_w2_audit(p_period_start, 'SUPERSESSION_AUTHORISED', v_p, v_p, p_reason, p_approval_reference,
    jsonb_build_object('authorisation_id', v_auth, 'approved_run', v_appr,
                       'valid_until', (select valid_until from costing.costing_period_refresh_authorization where id = v_auth)));
  return jsonb_build_object('authorisation_id', v_auth, 'period_start', p_period_start, 'valid_minutes', 120, 'audit_id', v_audit);
end $f$;

create or replace function public.rpc_costing_supersede_approved_run(p_new_refresh_run_id bigint, p_reason text, p_approval_reference text)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp' as $f$
declare v_name text; v_chk jsonb; v_period date; v_old bigint; v_rev bigint; v_des bigint; v_p costing.cost_periods; v_audit bigint;
begin
  v_name := costing.fn_w2_owner_name();
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  select period_start into v_period from costing.costing_refresh_run where id = p_new_refresh_run_id;
  if v_period is null then raise exception 'W2_RUN_NOT_FOUND: %', p_new_refresh_run_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:' || v_period::text, 0));
  v_chk := costing.fn_w2_run_checks(p_new_refresh_run_id, 'SUPERSEDE');
  if not (v_chk->>'ok')::boolean then
    raise exception 'W2_SUPERSEDE_CHECKS_FAILED: run %: %', p_new_refresh_run_id,
      (select string_agg((x->>'code') || ' (' || (x->>'detail') || ')', '; ') from jsonb_array_elements(v_chk->'checks') x where not (x->>'pass')::boolean)
      using errcode = 'P0001';
  end if;
  v_old := (v_chk->>'approved_run')::bigint;
  v_rev := costing.rpc_designate_costing_run(v_old, 'REVOKED', v_name,
             'Superseded by run ' || p_new_refresh_run_id || ': ' || btrim(p_reason) || ' [' || btrim(p_approval_reference) || ']');
  v_des := costing.rpc_designate_costing_run(p_new_refresh_run_id, 'APPROVED', v_name,
             'Supersedes run ' || v_old || ': ' || btrim(p_reason) || ' [' || btrim(p_approval_reference) || ']');
  select * into v_p from costing.cost_periods where period_start = v_period;
  v_audit := costing.fn_w2_audit(v_period, 'RUN_SUPERSEDED', v_p, v_p, p_reason, p_approval_reference,
    jsonb_build_object('old_run', v_old, 'new_run', p_new_refresh_run_id, 'revoke_designation_id', v_rev, 'approve_designation_id', v_des,
                       'authorisation_id', v_chk->'authorisation_id', 'counts', v_chk->'counts', 'checks', v_chk->'checks'));
  return jsonb_build_object('old_run', v_old, 'new_run', p_new_refresh_run_id, 'designation_id', v_des, 'audit_id', v_audit);
end $f$;

create or replace function public.rpc_costing_close_period(p_period_start date, p_reason text, p_approval_reference text)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp' as $f$
declare v_name text; v_old costing.cost_periods; v_new costing.cost_periods; v_msg text; v_audit bigint;
begin
  v_name := costing.fn_w2_owner_name();
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:' || p_period_start::text, 0));
  select * into v_old from costing.cost_periods where period_start = p_period_start;
  if not found then raise exception 'W2_PERIOD_NOT_FOUND: %', p_period_start; end if;
  if v_old.status <> 'LOCKED' then raise exception 'W2_CLOSE_REQUIRES_LOCKED: period % is %', p_period_start, v_old.status using errcode = 'P0001'; end if;
  v_msg := costing.rpc_close_cost_period(p_period_start, v_name, btrim(p_reason), btrim(p_approval_reference));
  select * into v_new from costing.cost_periods where period_start = p_period_start;
  v_audit := costing.fn_w2_audit(p_period_start, 'PERIOD_CLOSED', v_old, v_new, p_reason, p_approval_reference,
    jsonb_build_object('action','CLOSE','result', v_msg));
  return jsonb_build_object('period_start', p_period_start, 'status', v_new.status, 'result', v_msg, 'audit_id', v_audit);
end $f$;

-- Grants: client RPCs for logged-in users (each checks permission/owner inside); helpers internal only
do $g$
declare f text;
begin
  foreach f in array array['public.rpc_costing_period_governance_context()','public.rpc_costing_preflight_run(bigint,text)',
    'public.rpc_costing_open_next_period(text,text,date)','public.rpc_costing_approve_run(bigint,text,text)','public.rpc_costing_lock_period(date,text,text)',
    'public.rpc_costing_reopen_period(date,text,text)','public.rpc_costing_authorise_supersession(date,text,text)',
    'public.rpc_costing_supersede_approved_run(bigint,text,text)','public.rpc_costing_close_period(date,text,text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array['costing.fn_w2_owner_name()','costing.fn_w2_require_text(text,text)',
    'costing.fn_w2_audit(date,text,costing.cost_periods,costing.cost_periods,text,text,jsonb)','costing.fn_w2_run_checks(bigint,text)',
    'costing.fn_w2_guard_single_approved()','costing.fn_w2_guard_closed_period()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $g$;

do $post$
begin
  if (select count(*) from costing.costing_governance_owner) <> 1 then raise exception 'W2 postcheck: owner row missing'; end if;
  if exists (select 1 from costing.v_costing_run_effective_designation e where e.designation = 'APPROVED' group by e.period_start having count(*) > 1) then
    raise exception 'W2 postcheck: two APPROVED runs in a month'; end if;
  if exists (select 1 from costing.fn_verify_run_fingerprint(122) where not matches) or exists (select 1 from costing.fn_verify_run_fingerprint(128) where not matches) then
    raise exception 'W2 postcheck: approved-run fingerprint drift'; end if;
  if md5(pg_get_functiondef('costing.rpc_designate_costing_run(bigint,text,text,text)'::regprocedure)) <> 'a59d2c7bdf76e908b0e35b69d6829cd3'
     or md5(pg_get_functiondef('costing.rpc_close_cost_period(date,text,text,text)'::regprocedure)) <> '120351430b7f9019034a5a3f0dfa17ef' then
    raise exception 'W2 postcheck: designate/close changed'; end if;
end $post$;
