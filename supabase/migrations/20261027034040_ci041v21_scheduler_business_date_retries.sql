-- =====================================================================================================
-- CI-041 v2.1  Scheduler: date from the India business date / month end (no moving month date); drafts continue
--            after approval; duplicate vs intentional recalculation; bounded retries; one month-end catch-up
-- PREPARED 26 Oct 2026 (IST), v2.1 corrections 26 Oct 2026. NOT APPLIED. Owner decisions 26 Oct 2026: D1 YES, D3 YES, additional reqs 1, 2, 4.
-- Requires CI-040 v2 (settings table, unified approval).
--
-- POLICY RECORD (named, wording changed from v1): COSTING-DRAFTS-AFTER-APPROVAL-POLICY-2026-10-26
--   Held as the COMMENT on costing.rpc_request_scheduled_costing_refresh_internal (no table row).
--   Text: the weekly job (Monday, India date) costs the current month at today's India date; the month-end job
--   (the 1st, India date) costs the month just ended at its last day. Each run keeps its own valuation date for
--   ever. The month's stored date (cost_periods.valuation_date) is no longer moved by the scheduler. Drafts continue
--   in months that hold an APPROVED run and are not for pricing until approved. A second scheduler request for the
--   same month and date reuses the existing run; an intentional recalculation on the same date is a separate,
--   manual request with a reason. A failed scheduled draft is retried automatically ONLY when its error is
--   on the transient allowlist (deadlock 40P01, serialization 40001, lock not available 55P03), at most
--   scheduler_max_retries times per original run (default 2), by a retry sweep that job 68 runs every 5 minutes
--   (retry latency: up to ~5 minutes after the failure, plus queue time). Unknown, governance and data failures are
--   never retried: they are reported by the health check and the next independently scheduled draft proceeds
--   (governance failures stay blocking). Every retry decision is recorded in cost_period_governance_audit. If the previous month-end draft is missing, the next weekly run adds at
--   most scheduler_catch_up_max_runs (default 1) catch-up draft for it.
--
-- OBJECTS TOUCHED
--   INSERT  2 rows into costing.costing_automation_setting: scheduler_max_retries=2, scheduler_catch_up_max_runs=1
--   REPLACE costing.fn_guard_designated_run_header()  INSERT branch as v1 (no AU2_PERIOD_HOLDS_APPROVED_RUN refusal;
--           note 'not for pricing'); UPDATE/DELETE branches unchanged
--   ALTER   constraint cost_period_governance_audit_event_type_chk WIDEN ONLY: + SCHEDULED_RETRY_REQUESTED,
--           SCHEDULED_RETRY_FAILED, SCHEDULED_RETRY_LIMIT_REACHED (durable retry record; no new table)
--   NEW     costing.fn_costing_failure_class(text)  IMMUTABLE: TRANSIENT / GOVERNANCE / DATA / UNKNOWN (positive allowlist)
--   NEW     costing.fn_costing_retry_sweep()        finds eligible failed scheduled runs, requests replacements
--   REPLACE public.rpc_process_pending_costing_refresh_stage()  (job 68's entry point; cron command unchanged) runs the
--           sweep first (isolated; errors only warn), then the identical call to fn_process_next_costing_refresh_stage_internal
--   (v2.1: fn_after_refresh_run_au2 is NOT touched any more; no retry inside a trigger)
--   NEW     costing.fn_request_costing_run_on_date(date,date,text,text,text,uuid,boolean)  creates a run at an
--           explicit date (same insert, stages and lock key as fn_request_costing_refresh_internal)
--   REPLACE costing.rpc_request_scheduled_costing_refresh_internal()  (jobs 66/67 call it; job rows unchanged)
--   NEW     public.rpc_costing_request_recalculation(date,text,date)  manual recalculation with reason (authenticated)
--   REPLACE public.rpc_costing_authorise_supersession(date,text,text)  returns {not_required:true}; writes nothing
-- NOT TOUCHED: cron.job rows 66/67/68 and their commands, fn_after_refresh_run_au2, fn_process_next_costing_refresh_stage_internal, fn_request_costing_refresh_internal and rpc_request_costing_refresh (the
--   existing UI button still uses the month's stored date - see open questions), rpc_set_cost_period_valuation_date,
--   designated-run immutability, fingerprints, price feed, runs 119/122/143. No business row inserted/updated.
-- =====================================================================================================
BEGIN;

INSERT INTO costing.costing_automation_setting VALUES
 ('scheduler_max_retries', 2, 'retries', 'Automatic retries of a failed scheduled draft (same month and date) before it is left for the health check', 'CI-041', now()),
 ('scheduler_catch_up_max_runs', 1, 'runs', 'Missed month-end drafts the weekly job may add (0 = off); only the previous month end is considered', 'CI-041', now())
 ON CONFLICT (setting_key) DO NOTHING;

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
      -- CI-041: drafts are allowed while a run is APPROVED; they are not for pricing until approved.
      new.request_note := coalesce(new.request_note,'') || format(' [draft created while run %s is APPROVED; not for pricing]', v_ref);
      select a.id into v_auth from costing.costing_period_refresh_authorization a
       where a.period_start = new.period_start and a.consumed_by_run_id is null and a.valid_until > now()
       order by a.authorised_at desc limit 1 for update;
      if v_auth is not null then   -- legacy authorisation still open: consume it exactly as before
        new.request_note := new.request_note || format(' [AU2 supersession authorisation %s]', v_auth);
        perform set_config('costing.au2_pending_authorization', v_auth::text, true);
      end if;
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

CREATE OR REPLACE FUNCTION costing.fn_request_costing_run_on_date(p_period_start date, p_valuation_date date, p_requested_scope text,
   p_source_trigger text, p_request_note text, p_requested_by uuid, p_reuse_same_date boolean)
 RETURNS TABLE(refresh_run_id bigint, action_result text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v_scope text := upper(btrim(coalesce(p_requested_scope,'FULL_COSTING_REFRESH'))); v_period costing.cost_periods%rowtype;
  v_active costing.costing_refresh_run%rowtype; v_existing bigint; v_new costing.costing_refresh_run%rowtype;
begin
  if p_period_start is null or p_valuation_date is null then raise exception 'CI041_DATE_REQUIRED: period and valuation date are required'; end if;
  if p_period_start <> date_trunc('month', p_period_start)::date then raise exception 'CI041_BAD_PERIOD: % is not a month start', p_period_start; end if;
  perform pg_advisory_xact_lock(hashtextextended('costing-refresh-request:' || p_period_start::text || ':' || v_scope, 0));
  select * into v_period from costing.cost_periods cp where cp.period_start = p_period_start for update;
  if not found then raise exception 'Costing period % does not exist.', p_period_start; end if;
  if v_period.status <> 'OPEN' or v_period.valuation_date_status <> 'DRAFT' then
    raise exception 'Ordinary costing refresh is allowed only for an OPEN period. Period % status is %', p_period_start, v_period.status;
  end if;
  if p_valuation_date < v_period.period_start or p_valuation_date > v_period.period_end then
    raise exception 'CI041_DATE_OUTSIDE_PERIOD: % is outside % to %', p_valuation_date, v_period.period_start, v_period.period_end;
  end if;
  if p_valuation_date > costing.fn_india_business_date() then
    raise exception 'CI041_FUTURE_DATE: % is after today (India date %)', p_valuation_date, costing.fn_india_business_date();
  end if;
  select * into v_active from costing.costing_refresh_run r
   where r.period_start = p_period_start and r.requested_scope = v_scope and r.overall_status in ('QUEUED','RUNNING')
   order by case r.overall_status when 'RUNNING' then 1 else 2 end, r.requested_at, r.id limit 1;
  if found then
    return query select v_active.id, case when v_active.valuation_date = p_valuation_date and coalesce(p_reuse_same_date,false)
                                          then 'EXISTING_ACTIVE_RUN_RETURNED' else 'ACTIVE_RUN_PRESENT' end;
    return;
  end if;
  if coalesce(p_reuse_same_date,false) then   -- scheduler duplicate: reuse a completed scheduled run at the same date
    select r.id into v_existing from costing.costing_refresh_run r
     where r.period_start = p_period_start and r.requested_scope = v_scope and r.valuation_date = p_valuation_date
       and r.source_trigger = 'CRON_SCHEDULED' and r.overall_status in ('SUCCESS','PARTIAL_SUCCESS')
     order by r.id desc limit 1;
    if v_existing is not null then return query select v_existing, 'EXISTING_RUN_REUSED'::text; return; end if;
  end if;
  insert into costing.costing_refresh_run(period_start, valuation_date, period_status_at_request, valuation_date_status_at_request,
      valuation_context_source, valuation_context_captured_at, requested_scope, source_trigger, request_note, requested_by, requested_at,
      overall_status, current_stage_code, latest_stage_order, created_at, updated_at)
  values (v_period.period_start, p_valuation_date, v_period.status, v_period.valuation_date_status,
      'CAPTURED_AT_REQUEST', statement_timestamp(), v_scope, coalesce(nullif(btrim(coalesce(p_source_trigger,'')),''),'MANUAL_UI'),
      nullif(btrim(coalesce(p_request_note,'')),''), p_requested_by, statement_timestamp(),
      'QUEUED', '01_ENSURE_PERIOD', 0, statement_timestamp(), statement_timestamp())
  returning * into v_new;
  insert into costing.costing_refresh_run_stage(refresh_run_id, period_start, valuation_date, stage_order, stage_code, stage_name, stage_status, created_at, updated_at)
  select v_new.id, v_new.period_start, v_new.valuation_date, d.stage_order, d.stage_code, d.stage_name, 'PENDING', statement_timestamp(), statement_timestamp()
    from costing.costing_refresh_stage_definition d where d.is_active = true order by d.stage_order;
  return query select v_new.id, 'NEW_REFRESH_RUN_CREATED'::text;
end $function$;

-- v2.1: the event-type constraint is widened (widen only) for the durable retry record
ALTER TABLE costing.cost_period_governance_audit DROP CONSTRAINT cost_period_governance_audit_event_type_chk;
ALTER TABLE costing.cost_period_governance_audit ADD CONSTRAINT cost_period_governance_audit_event_type_chk
  CHECK (event_type = ANY (ARRAY['MIGRATION_BACKFILL'::text,'PERIOD_CREATED'::text,'VALUATION_DATE_CHANGED'::text,'PERIOD_LOCKED'::text,
    'PERIOD_REOPENED'::text,'PERIOD_CLOSED'::text,'RUN_APPROVED'::text,'SUPERSESSION_AUTHORISED'::text,'RUN_SUPERSEDED'::text,
    'STALE_APPROVAL_ACKNOWLEDGED'::text,'SCHEDULED_RETRY_REQUESTED'::text,'SCHEDULED_RETRY_FAILED'::text,'SCHEDULED_RETRY_LIMIT_REACHED'::text]));

-- v2.1 POSITIVE ALLOWLIST. The stage processor (fn_process_next_costing_refresh_stage_internal, live) stores only
-- SQLERRM (no SQLSTATE) in costing_refresh_run.error_message; server messages are English (lc_messages en_US.UTF-8).
-- TRANSIENT = exactly the server texts of SQLSTATE 40P01, 40001 and 55P03. Statement timeout (57014) is NOT listed:
-- the processor's WHEN OTHERS cannot catch query_canceled, so a timeout aborts job 68's whole transaction and never
-- produces a FAILED row (the stage is simply picked up again). Everything else is UNKNOWN unless recognised as
-- GOVERNANCE or DATA; only TRANSIENT is ever retried.
CREATE OR REPLACE FUNCTION costing.fn_costing_failure_class(p_error_message text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when p_error_message is null or btrim(p_error_message) = '' then 'UNKNOWN'
    when p_error_message ~ '^(AU2_|W2_|AU-9 |CI012_|CI04[0-9]_)' or p_error_message ~* '(immutable|fingerprint|append-only)' then 'GOVERNANCE'
    when p_error_message ~ '^NO_EFFECTIVE_' then 'DATA'
    when p_error_message = 'deadlock detected'                                                     -- 40P01
      or p_error_message in ('could not serialize access due to concurrent update',                -- 40001
                             'could not serialize access due to concurrent delete',
                             'could not serialize access due to read/write dependencies among transactions')
      or p_error_message ~ '^could not obtain lock on (row in relation|relation) "[^"]+"$'          -- 55P03 (NOWAIT)
      or p_error_message = 'canceling statement due to lock timeout'                               -- 55P03 (lock_timeout)
      then 'TRANSIENT'
    else 'UNKNOWN' end
$function$;

-- v2.1 RETRY SWEEP (replaces v2's AFTER-trigger retry). Idempotent: a failed run is handled at most once, recorded
-- in cost_period_governance_audit (event_source CRON_SCHEDULED) with failed_run_id, origin_run_id and attempt.
-- The attempt chain follows only explicit SCHEDULED_RETRY_REQUESTED records; unrelated earlier failures never count.
CREATE OR REPLACE FUNCTION costing.fn_costing_retry_sweep()
 RETURNS TABLE(failed_run_id bigint, origin_run_id bigint, attempt integer, outcome text, new_run_id bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare f costing.costing_refresh_run%rowtype; v_max int; v_origin bigint; v_prev int; v_attempt int; v_req record; v_err text;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('costing-scheduled-retry-sweep', 0)) then return; end if;  -- another sweep is running
  select coalesce(max(int_value), 2) into v_max from costing.costing_automation_setting where setting_key = 'scheduler_max_retries';
  for f in
    select r.* from costing.costing_refresh_run r
     where r.source_trigger = 'CRON_SCHEDULED' and r.overall_status = 'FAILED'
       and coalesce(r.finished_at, r.updated_at, r.requested_at) >= now() - interval '7 days'
       and costing.fn_costing_failure_class(r.error_message) = 'TRANSIENT'
       and not exists (select 1 from costing.cost_period_governance_audit a
                        where a.event_type in ('SCHEDULED_RETRY_REQUESTED','SCHEDULED_RETRY_FAILED','SCHEDULED_RETRY_LIMIT_REACHED')
                          and a.evidence_json->>'failed_run_id' = r.id::text)
     order by r.id
  loop
    -- a later active or successful run of the same month at the same or a later date makes a retry unnecessary
    continue when exists (select 1 from costing.costing_refresh_run x where x.period_start = f.period_start and x.id > f.id
                            and x.valuation_date >= f.valuation_date and x.overall_status in ('QUEUED','RUNNING','SUCCESS','PARTIAL_SUCCESS'));
    select (a.evidence_json->>'origin_run_id')::bigint, (a.evidence_json->>'attempt')::int into v_origin, v_prev
      from costing.cost_period_governance_audit a
     where a.event_type = 'SCHEDULED_RETRY_REQUESTED' and a.evidence_json->>'new_run_id' = f.id::text order by a.audit_id desc limit 1;
    if not found then v_origin := f.id; v_prev := 0; end if;
    v_attempt := v_prev + 1;
    if v_attempt > v_max then
      insert into costing.cost_period_governance_audit(period_start, event_type, reason, event_source, evidence_json, occurred_at)
      values (f.period_start, 'SCHEDULED_RETRY_LIMIT_REACHED', format('Retry limit %s reached for scheduled run chain starting at run %s', v_max, v_origin), 'CRON_SCHEDULED',
              jsonb_build_object('ci','CI-041','failed_run_id',f.id,'origin_run_id',v_origin,'attempt',v_attempt,'max_retries',v_max,'error',left(f.error_message,300)), statement_timestamp());
      return query select f.id, v_origin, v_attempt, 'LIMIT_REACHED'::text, null::bigint; continue;
    end if;
    begin
      select * into v_req from costing.fn_request_costing_run_on_date(f.period_start, f.valuation_date, f.requested_scope, 'CRON_SCHEDULED',
        format('Scheduled working costing draft; automatic retry %s of %s (origin run %s, failed run %s, transient: %s)', v_attempt, v_max, v_origin, f.id, left(f.error_message,150)),
        null::uuid, false);
      if v_req.action_result in ('ACTIVE_RUN_PRESENT','EXISTING_ACTIVE_RUN_RETURNED') then
        return query select f.id, v_origin, v_attempt, 'WAITING_FOR_ACTIVE_RUN'::text, v_req.refresh_run_id; continue;  -- next sweep
      elsif v_req.action_result <> 'NEW_REFRESH_RUN_CREATED' then
        raise exception 'CI041_RETRY_NOT_CREATED: %', v_req.action_result;
      end if;
      insert into costing.cost_period_governance_audit(period_start, event_type, reason, event_source, evidence_json, occurred_at)
      values (f.period_start, 'SCHEDULED_RETRY_REQUESTED', format('Automatic retry %s of %s after transient failure of run %s', v_attempt, v_max, f.id), 'CRON_SCHEDULED',
              jsonb_build_object('ci','CI-041','failed_run_id',f.id,'origin_run_id',v_origin,'attempt',v_attempt,'max_retries',v_max,'new_run_id',v_req.refresh_run_id,'error',left(f.error_message,300)), statement_timestamp());
      return query select f.id, v_origin, v_attempt, 'RETRY_REQUESTED'::text, v_req.refresh_run_id;
    exception when others then
      v_err := sqlerrm;   -- the sub-transaction (any partial run insert) is rolled back; the failure itself is kept
      insert into costing.cost_period_governance_audit(period_start, event_type, reason, event_source, evidence_json, occurred_at)
      values (f.period_start, 'SCHEDULED_RETRY_FAILED', 'Automatic retry could not be created: ' || left(v_err,200), 'CRON_SCHEDULED',
              jsonb_build_object('ci','CI-041','failed_run_id',f.id,'origin_run_id',v_origin,'attempt',v_attempt,'max_retries',v_max,'retry_error',left(v_err,300),'error',left(f.error_message,300)), statement_timestamp());
      return query select f.id, v_origin, v_attempt, 'RETRY_CREATION_FAILED'::text, null::bigint;
    end;
  end loop;
end $function$;

-- v2.1 HOOK: job 68's command is unchanged (select public.rpc_process_pending_costing_refresh_stage();). The thin
-- wrapper now runs the sweep first in its own sub-transaction (an error only warns), then exactly the same call.
CREATE OR REPLACE FUNCTION public.rpc_process_pending_costing_refresh_stage()
 RETURNS TABLE(refresh_run_id bigint, period_start date, processed_stage_code text, processed_stage_name text, stage_status text, overall_status text, next_stage_code text, inserted_row_count bigint, blocked_count bigint, review_required_count bigint, ready_count bigint, action_result text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
begin
  begin
    perform costing.fn_costing_retry_sweep();
  exception when others then
    raise warning 'CI041_RETRY_SWEEP_ERROR: %', sqlerrm;
  end;
  return query select * from costing.fn_process_next_costing_refresh_stage_internal(null);
end $function$;


CREATE OR REPLACE FUNCTION costing.rpc_request_scheduled_costing_refresh_internal()
 RETURNS TABLE(out_period_start date, out_valuation_date date, out_run_id bigint, out_action text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
DECLARE
  v_today date := costing.fn_india_business_date();
  v_is_month_end boolean := extract(day from costing.fn_india_business_date()) = 1;
  v_is_weekly boolean := extract(isodow from costing.fn_india_business_date()) = 1;
  v_branch text; v_branches text[] := ARRAY[]::text[];
  v_period date; v_date date; v_row costing.cost_periods%ROWTYPE;
  v_approved_run bigint; v_approved_date date; v_existing bigint; v_req record; v_note text; v_last_failed costing.costing_refresh_run%ROWTYPE;
  v_catch_max int;
BEGIN
  BEGIN   -- v2.1: the scheduled entry points also run the retry sweep (isolated; an error only warns)
    PERFORM costing.fn_costing_retry_sweep();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'CI041_RETRY_SWEEP_ERROR: %', SQLERRM;
  END;
  IF NOT v_is_month_end AND NOT v_is_weekly THEN
    RETURN QUERY SELECT NULL::date,NULL::date,NULL::bigint,'NOT_SCHEDULED'::text; RETURN;
  END IF;
  IF v_is_month_end THEN v_branches := v_branches || 'MONTH_END'::text; END IF;   -- CI-039 kept: Monday the 1st runs both
  IF v_is_weekly    THEN v_branches := v_branches || 'WEEKLY'::text;    END IF;
  SELECT coalesce(max(int_value),1) INTO v_catch_max FROM costing.costing_automation_setting WHERE setting_key='scheduler_catch_up_max_runs';
  IF v_is_weekly AND NOT v_is_month_end AND v_catch_max > 0 THEN
    v_branches := ARRAY['CATCH_UP']::text[] || v_branches;   -- at most one: the previous month end only
  END IF;

  FOREACH v_branch IN ARRAY v_branches LOOP
    IF v_branch IN ('MONTH_END','CATCH_UP') THEN
      v_period := (date_trunc('month', v_today) - interval '1 month')::date;
      v_date := (date_trunc('month', v_today) - interval '1 day')::date;
    ELSE
      v_period := date_trunc('month', v_today)::date;
      v_date := v_today;
    END IF;
    v_approved_run := NULL; v_approved_date := NULL; v_existing := NULL;
    PERFORM pg_advisory_xact_lock(hashtextextended('cost-period-governance:'||v_period::text,0));
    IF v_branch = 'WEEKLY' THEN PERFORM * FROM costing.rpc_ensure_cost_period(v_period); END IF;
    SELECT * INTO v_row FROM costing.cost_periods WHERE period_start=v_period FOR UPDATE;
    IF NOT FOUND THEN
      IF v_branch <> 'CATCH_UP' THEN RETURN QUERY SELECT v_period,v_date,NULL::bigint,'PERIOD_NOT_GOVERNED'::text; END IF;
      CONTINUE;
    END IF;
    IF v_row.status <> 'OPEN' OR v_row.valuation_date_status <> 'DRAFT' THEN
      IF v_branch <> 'CATCH_UP' THEN RETURN QUERY SELECT v_period,v_date,NULL::bigint,'PERIOD_NOT_OPEN_DRAFT'::text; END IF;
      CONTINUE;
    END IF;
    IF v_branch = 'CATCH_UP' THEN
      -- only when nothing was ever requested by the scheduler for that month end and no successful run exists at that date
      IF EXISTS (SELECT 1 FROM costing.costing_refresh_run r WHERE r.period_start=v_period AND r.valuation_date=v_date
                  AND (r.source_trigger='CRON_SCHEDULED' OR r.overall_status IN ('SUCCESS','PARTIAL_SUCCESS','QUEUED','RUNNING'))) THEN
        CONTINUE;
      END IF;
    END IF;
    SELECT e.refresh_run_id, rr.valuation_date INTO v_approved_run, v_approved_date
      FROM costing.v_costing_run_effective_designation e JOIN costing.costing_refresh_run rr ON rr.id = e.refresh_run_id
     WHERE e.period_start = v_period AND e.designation = 'APPROVED' ORDER BY e.designated_at DESC LIMIT 1;
    IF v_approved_date IS NOT NULL AND v_date < v_approved_date THEN
      RETURN QUERY SELECT v_period,v_date,v_approved_run,'SKIPPED_BEFORE_APPROVED_DATE'::text; CONTINUE;
    END IF;
    -- governance failure of the latest scheduled run stays blocking (fail-closed) until a later successful run
    SELECT * INTO v_last_failed FROM costing.costing_refresh_run r
     WHERE r.period_start=v_period AND r.source_trigger='CRON_SCHEDULED' AND r.overall_status='FAILED'
       AND NOT EXISTS (SELECT 1 FROM costing.costing_refresh_run later WHERE later.period_start=v_period AND later.id>r.id AND later.overall_status='SUCCESS')
     ORDER BY r.id DESC LIMIT 1;
    IF FOUND AND costing.fn_costing_failure_class(v_last_failed.error_message) = 'GOVERNANCE' THEN
      RETURN QUERY SELECT v_period,v_date,v_last_failed.id,'GOVERNANCE_FAILURE_BLOCKS'::text; CONTINUE;
    END IF;
    v_note := CASE WHEN v_approved_run IS NULL THEN 'Scheduled working costing draft; approval and lock stay owner-governed.'
                   ELSE format('Scheduled working costing draft; not for pricing (run %s stays approved until a newer draft is approved).', v_approved_run) END
              || CASE v_branch WHEN 'CATCH_UP' THEN ' [catch-up of a missed month-end draft]' WHEN 'MONTH_END' THEN ' [month-end]' ELSE ' [weekly]' END
              || CASE WHEN v_last_failed.id IS NOT NULL THEN format(' [earlier scheduled run %s failed (%s); see health check]', v_last_failed.id, costing.fn_costing_failure_class(v_last_failed.error_message)) ELSE '' END;
    SELECT * INTO v_req FROM costing.fn_request_costing_run_on_date(v_period, v_date, 'FULL_COSTING_REFRESH', 'CRON_SCHEDULED', v_note, NULL::uuid, true);
    RETURN QUERY SELECT v_period, v_date, v_req.refresh_run_id,
      CASE WHEN v_req.action_result = 'EXISTING_RUN_REUSED' THEN 'EXISTING_RUN'
           WHEN v_req.action_result = 'NEW_REFRESH_RUN_CREATED' AND v_branch = 'CATCH_UP' THEN 'CATCH_UP_RUN_CREATED'
           ELSE v_req.action_result END;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_costing_request_recalculation(p_period_start date, p_reason text, p_valuation_date date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_period date := date_trunc('month', p_period_start)::date; v_date date; v_appr bigint; v_appr_date date; v_req record;
begin
  perform public.require_permission('module:costing-control-center', true);
  if v_uid is null then raise exception 'W2_AUTH_REQUIRED: an authenticated user is required' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_reason,''))) < 10 then raise exception 'W2_REASON_REQUIRED: reason must be at least 10 characters' using errcode = 'P0001'; end if;
  v_date := coalesce(p_valuation_date, least(costing.fn_india_business_date(), (v_period + interval '1 month - 1 day')::date));
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:'||v_period::text,0));
  select e.refresh_run_id, rr.valuation_date into v_appr, v_appr_date from costing.v_costing_run_effective_designation e
    join costing.costing_refresh_run rr on rr.id = e.refresh_run_id where e.period_start = v_period and e.designation = 'APPROVED' limit 1;
  if v_appr_date is not null and v_date < v_appr_date then
    raise exception 'W2_RUN_DATE_BEFORE_APPROVED: % is earlier than approved run % (%); such a run could never be approved', v_date, v_appr, v_appr_date using errcode = 'P0001';
  end if;
  select * into v_req from costing.fn_request_costing_run_on_date(v_period, v_date, 'FULL_COSTING_REFRESH', 'MANUAL_RECALCULATION',
      'Manual recalculation: ' || btrim(p_reason), v_uid, false);
  if v_req.action_result <> 'NEW_REFRESH_RUN_CREATED' then
    raise exception 'W2_ACTIVE_RUN: run % is queued/running for %; wait for it to finish', v_req.refresh_run_id, v_period using errcode = 'P0001';
  end if;
  return jsonb_build_object('refresh_run_id', v_req.refresh_run_id, 'period_start', v_period, 'valuation_date', v_date, 'action', v_req.action_result,
    'pricing_note', case when v_appr is not null then format('Not for pricing until approved; run %s stays approved.', v_appr) else 'Not for pricing until approved.' end);
end $function$;


CREATE OR REPLACE FUNCTION public.rpc_costing_authorise_supersession(p_period_start date, p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
begin
  -- CI-041: supersession no longer needs a prior authorisation. Kept for old callers; writes nothing.
  perform costing.fn_w2_owner_name();
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  return jsonb_build_object('not_required', true, 'authorisation_id', null, 'period_start', p_period_start,
    'notice', 'Supersession authorisation is no longer required (CI-041). Request a draft, open rpc_costing_preview_approval_impact and approve with rpc_costing_approve_run_with_preview (preview_ack_id).');
end $function$;

ALTER FUNCTION costing.fn_guard_designated_run_header() OWNER TO postgres;
ALTER FUNCTION costing.fn_request_costing_run_on_date(date,date,text,text,text,uuid,boolean) OWNER TO postgres;
ALTER FUNCTION costing.fn_costing_failure_class(text) OWNER TO postgres;
ALTER FUNCTION costing.fn_costing_retry_sweep() OWNER TO postgres;
ALTER FUNCTION public.rpc_process_pending_costing_refresh_stage() OWNER TO postgres;
ALTER FUNCTION costing.rpc_request_scheduled_costing_refresh_internal() OWNER TO postgres;
ALTER FUNCTION public.rpc_costing_request_recalculation(date,text,date) OWNER TO postgres;
ALTER FUNCTION public.rpc_costing_authorise_supersession(date,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.rpc_request_scheduled_costing_refresh_internal() FROM PUBLIC;
REVOKE ALL ON FUNCTION costing.fn_request_costing_run_on_date(date,date,text,text,text,uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION costing.fn_costing_retry_sweep() FROM PUBLIC;
REVOKE ALL ON FUNCTION costing.fn_costing_failure_class(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_process_pending_costing_refresh_stage() FROM PUBLIC;  -- live ACL is postgres only; kept
REVOKE ALL ON FUNCTION public.rpc_costing_request_recalculation(date,text,date) FROM PUBLIC;
DO $$ BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION costing.rpc_request_scheduled_costing_refresh_internal() FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON FUNCTION costing.fn_request_costing_run_on_date(date,date,text,text,text,uuid,boolean) FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON FUNCTION costing.fn_costing_retry_sweep() FROM anon, authenticated, service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION costing.fn_costing_failure_class(text) FROM anon, authenticated, service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_process_pending_costing_refresh_stage() FROM anon, authenticated, service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_costing_request_recalculation(date,text,date) FROM anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_costing_request_recalculation(date,text,date) TO authenticated, service_role';
END $$;

COMMENT ON FUNCTION costing.rpc_request_scheduled_costing_refresh_internal() IS
 'COSTING-DRAFTS-AFTER-APPROVAL-POLICY-2026-10-26 (CI-041 v2.1; D1, D3): weekly (Monday, India date) draft at today''s India date; month-end (1st) draft at the last day of the month just ended; Monday the 1st runs both. Never moves cost_periods.valuation_date. Drafts continue in months with an APPROVED run (not for pricing until approved). Same month+date from the scheduler reuses the existing run. Failed scheduled drafts (v2.1): only allowlisted transient failures (40P01/40001/55P03 texts, fn_costing_failure_class) are retried, at most scheduler_max_retries per original run, by fn_costing_retry_sweep (run from job 68 every 5 minutes and from this function); every decision is audited; unknown/data failures are never retried and do not block the next schedule; governance failures stay blocking. Weekly adds at most scheduler_catch_up_max_runs catch-up for a missing previous month-end draft.';
COMMENT ON FUNCTION public.rpc_costing_request_recalculation(date,text,date) IS
 'CI-041 v2: intentional manual recalculation with a reason; always a new run, even on a date that already has one; date defaults to today (India) capped at month end; refused before the approved run date or while a run is queued/running.';
COMMIT;
