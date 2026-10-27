-- CI-041 v2.1 ROLLBACK. Self-contained SQL; pre-images inlined and identical to live on 26 Oct 2026 (production md5 of
-- pg_get_functiondef: fn_guard_designated_run_header 59a4ad34..., rpc_costing_authorise_supersession 0e2f69a0...,
-- (rpc_set_cost_period_valuation_date is not touched by v2), scheduler = CI-039
-- body 802f50e1..., rpc_process_pending_costing_refresh_stage 81bd56fe... (job 68 entry point); fn_after_refresh_run_au2 is not
-- touched by v2.1). Roll back CI-043 and CI-042 first.
--  A IMMEDIATE (no scheduled/manual-recalculation run and no draft in an approved month yet): exactly as before CI-041.
--  B AFTER USE: same statements. Runs created under CI-041 stay as ordinary drafts (not in the price feed unless
--    approved); nothing is deleted except the two CI-041 setting rows (configuration, not history). Retry audit rows
--    stay (append-only evidence) and then the widened event-type constraint stays too; with none, it returns to CI-040's. After rollback the
--    CI-039 scheduler again skips approved months, moves the month date, and blocks after a failed scheduled run.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.rpc_costing_lock_periods_for_close(date[],text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'CI041_ROLLBACK_ORDER: roll back CI-042 first'; END IF;
  IF to_regprocedure('costing.fn_costing_health_check(date)') IS NOT NULL THEN
    RAISE EXCEPTION 'CI041_ROLLBACK_ORDER: roll back CI-043 first'; END IF;
  RAISE NOTICE 'CI-041 v2.1 rollback mode %', CASE WHEN EXISTS (SELECT 1 FROM costing.costing_refresh_run WHERE request_note LIKE '%is APPROVED; not for pricing]%'
      OR source_trigger IN ('CRON_SCHEDULED','MANUAL_RECALCULATION'))
      OR EXISTS (SELECT 1 FROM costing.cost_period_governance_audit WHERE event_type LIKE 'SCHEDULED_RETRY%') THEN 'B (after use)' ELSE 'A (immediate)' END;
END $$;
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

CREATE OR REPLACE FUNCTION public.rpc_costing_authorise_supersession(p_period_start date, p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
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
end $function$;

-- (rpc_set_cost_period_valuation_date is not changed by CI-041 v2, so it is not restored here)

CREATE OR REPLACE FUNCTION costing.rpc_request_scheduled_costing_refresh_internal()
 RETURNS TABLE(out_period_start date, out_valuation_date date, out_run_id bigint, out_action text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
DECLARE
  v_today date := costing.fn_india_business_date();
  v_period date;
  v_cutoff date;
  v_period_row costing.cost_periods%ROWTYPE;
  v_existing bigint;
  v_requested record;
  v_old_date date;
  v_is_month_end boolean := extract(day from costing.fn_india_business_date()) = 1;
  v_is_weekly boolean := extract(isodow from costing.fn_india_business_date()) = 1;
  v_branch text;
  v_branches text[] := ARRAY[]::text[];
  v_approved_run bigint;
BEGIN
  IF NOT v_is_month_end AND NOT v_is_weekly THEN
    RETURN QUERY SELECT NULL::date,NULL::date,NULL::bigint,'NOT_SCHEDULED'::text;
    RETURN;
  END IF;
  -- CI-039: on a Monday that is also the 1st, do month-end first, then the new-month weekly step.
  IF v_is_month_end THEN v_branches := v_branches || 'MONTH_END'::text; END IF;
  IF v_is_weekly    THEN v_branches := v_branches || 'WEEKLY'::text;    END IF;

  FOREACH v_branch IN ARRAY v_branches LOOP
    IF v_branch = 'MONTH_END' THEN
      v_period := date_trunc('month',v_today - 1)::date;
      v_cutoff := v_today - 1;
    ELSE
      v_period := date_trunc('month',v_today)::date;
      v_cutoff := v_today;
    END IF;
    v_existing := NULL; v_approved_run := NULL; v_old_date := NULL;

    PERFORM pg_advisory_xact_lock(hashtextextended('cost-period-governance:'||v_period::text,0));
    -- Weekly step may initialise the new current-month period; month-end may not.
    IF v_branch = 'WEEKLY' THEN
      PERFORM * FROM costing.rpc_ensure_cost_period(v_period);
    END IF;
    SELECT * INTO v_period_row FROM costing.cost_periods
     WHERE period_start=v_period FOR UPDATE;
    IF NOT FOUND THEN
      RETURN QUERY SELECT v_period,v_cutoff,NULL::bigint,'PERIOD_NOT_GOVERNED'::text;
      CONTINUE;
    END IF;
    IF v_period_row.status <> 'OPEN'
       OR v_period_row.valuation_date_status <> 'DRAFT' THEN
      RETURN QUERY SELECT v_period,v_cutoff,NULL::bigint,'PERIOD_NOT_OPEN_DRAFT'::text;
      CONTINUE;
    END IF;

    -- CI-039: an APPROVED run without an unused, unexpired supersession authorisation
    -- would be rejected by trg_au2_designated_run_header. Skip cleanly instead of failing:
    -- no valuation-date change, no audit row, no run request.
    SELECT e.refresh_run_id INTO v_approved_run
      FROM costing.v_costing_run_effective_designation e
     WHERE e.period_start = v_period AND e.designation = 'APPROVED'
     ORDER BY e.designated_at DESC LIMIT 1;
    IF v_approved_run IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM costing.costing_period_refresh_authorization a
       WHERE a.period_start = v_period AND a.consumed_by_run_id IS NULL AND a.valid_until > now()
    ) THEN
      RAISE NOTICE 'SKIPPED_APPROVED_PERIOD: period % holds APPROVED run %; valuation date % kept; no draft requested',
        v_period, v_approved_run, v_period_row.valuation_date;
      RETURN QUERY SELECT v_period,v_period_row.valuation_date,v_approved_run,'SKIPPED_APPROVED_PERIOD'::text;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM costing.costing_refresh_run r
       WHERE r.period_start=v_period AND r.overall_status IN ('QUEUED','RUNNING')
    ) THEN
      RETURN QUERY SELECT v_period,v_cutoff,NULL::bigint,'ACTIVE_RUN_PRESENT'::text;
      CONTINUE;
    END IF;
    SELECT id INTO v_existing FROM costing.costing_refresh_run r
     WHERE r.period_start=v_period AND r.valuation_date=v_cutoff
       AND r.source_trigger='CRON_SCHEDULED'
     ORDER BY r.id DESC LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN QUERY SELECT v_period,v_cutoff,v_existing,'EXISTING_RUN'::text;
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM costing.costing_refresh_run r
      WHERE r.period_start=v_period AND r.source_trigger='CRON_SCHEDULED'
        AND r.overall_status='FAILED'
        AND NOT EXISTS (
          SELECT 1 FROM costing.costing_refresh_run later
          WHERE later.period_start=v_period AND later.id>r.id
            AND later.overall_status='SUCCESS'
        )
    ) THEN
      RETURN QUERY SELECT v_period,v_cutoff,NULL::bigint,'UNRESOLVED_AUTOMATION_FAILURE'::text;
      CONTINUE;
    END IF;
    IF v_cutoff < v_period_row.valuation_date THEN
      RETURN QUERY SELECT v_period,v_cutoff,NULL::bigint,'WOULD_BACKDATE_VALUATION'::text;
      CONTINUE;
    END IF;
    IF v_cutoff <> v_period_row.valuation_date THEN
      v_old_date := v_period_row.valuation_date;
      UPDATE costing.cost_periods cp
        SET valuation_date=v_cutoff,
            valuation_date_source='SYSTEM_DEFAULT',
            valuation_date_change_reason='Scheduled weekly/month-end draft valuation',
            valuation_date_set_at=statement_timestamp(),
            updated_at=statement_timestamp()
        WHERE cp.period_start=v_period;
      INSERT INTO costing.cost_period_governance_audit(
        period_start,event_type,previous_status,new_status,
        previous_valuation_date,new_valuation_date,
        previous_valuation_date_status,new_valuation_date_status,
        reason,approval_reference,event_source,actor_user_id,evidence_json,occurred_at
      ) VALUES (
        v_period,'VALUATION_DATE_CHANGED','OPEN','OPEN',
        v_old_date,v_cutoff,'DRAFT','DRAFT',
        'Scheduled preliminary costing valuation advance',
        NULL,'CRON_SCHEDULED',NULL,
        jsonb_build_object('scheduled_cutoff',v_cutoff,'policy','weekly_monthend','automatic_approval',false),
        statement_timestamp()
      );
    END IF;
    SELECT * INTO v_requested FROM costing.fn_request_costing_refresh_internal(
      v_period,'FULL_COSTING_REFRESH','CRON_SCHEDULED',
      'Scheduled working costing draft; approval and lock stay owner-governed.',
      NULL::uuid,false
    );
    RETURN QUERY SELECT v_period,v_cutoff,v_requested.refresh_run_id,v_requested.action_result;
  END LOOP;
END;
$function$;

ALTER FUNCTION costing.rpc_request_scheduled_costing_refresh_internal() OWNER TO postgres;
COMMENT ON FUNCTION costing.rpc_request_scheduled_costing_refresh_internal() IS
 'CI-039 stopgap: weekly (Mon) / month-end (1st) scheduled draft request. Skips with SKIPPED_APPROVED_PERIOD when the month holds an APPROVED run and no supersession authorisation; runs both steps when the 1st is a Monday.';
DROP FUNCTION public.rpc_costing_request_recalculation(date,text,date);
-- job 68 entry point back to the live pre-image (byte-identical, CRLF body as live)
CREATE OR REPLACE FUNCTION public.rpc_process_pending_costing_refresh_stage()
 RETURNS TABLE(refresh_run_id bigint, period_start date, processed_stage_code text, processed_stage_name text, stage_status text, overall_status text, next_stage_code text, inserted_row_count bigint, blocked_count bigint, review_required_count bigint, ready_count bigint, action_result text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
    select *
    from costing.fn_process_next_costing_refresh_stage_internal(
        null
    );
$function$;
DROP FUNCTION costing.fn_costing_retry_sweep();
DROP FUNCTION costing.fn_costing_failure_class(text);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM costing.cost_period_governance_audit WHERE event_type IN ('SCHEDULED_RETRY_REQUESTED','SCHEDULED_RETRY_FAILED','SCHEDULED_RETRY_LIMIT_REACHED')) THEN
    RAISE NOTICE 'CI-041 v2.1 rollback: retry audit rows exist -> widened event-type constraint kept (evidence)';
  ELSE
    ALTER TABLE costing.cost_period_governance_audit DROP CONSTRAINT cost_period_governance_audit_event_type_chk;
    ALTER TABLE costing.cost_period_governance_audit ADD CONSTRAINT cost_period_governance_audit_event_type_chk
      CHECK (event_type = ANY (ARRAY['MIGRATION_BACKFILL'::text,'PERIOD_CREATED'::text,'VALUATION_DATE_CHANGED'::text,'PERIOD_LOCKED'::text,
        'PERIOD_REOPENED'::text,'PERIOD_CLOSED'::text,'RUN_APPROVED'::text,'SUPERSESSION_AUTHORISED'::text,'RUN_SUPERSEDED'::text,
        'STALE_APPROVAL_ACKNOWLEDGED'::text]));
  END IF;
END $$;
DROP FUNCTION costing.fn_request_costing_run_on_date(date,date,text,text,text,uuid,boolean);
DELETE FROM costing.costing_automation_setting WHERE introduced_by = 'CI-041';
COMMIT;
