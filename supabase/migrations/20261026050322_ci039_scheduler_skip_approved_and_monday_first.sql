-- Applied live on 2026-10-26 via Supabase MCP apply_migration; recorded here for the repo
-- APPLIED live via Supabase MCP apply_migration, version 20261026050322 (26 Oct 2026 ~10:33 IST), name ci039_scheduler_skip_approved_and_monday_first. Body identical to 20261026120000_ci039_scheduler_skip_approved_and_monday_first.sql. Verified: fn md5 e3d4dce4d3773e238009c2a6dbf22f31; fingerprints 119/122/143 unchanged (combined 3e5515ed97189b747ea3a8d18c3f4411); job 67 resumed after verification.
-- CI-039  Scheduled costing refresh: stopgap fix (PREPARED, NOT APPLIED)
-- 1) allow event_source CRON_SCHEDULED in cost_period_governance_audit (all existing values kept)
-- 2) scheduler returns SKIPPED_APPROVED_PERIOD (no date change, no audit row) when the target
--    month holds an APPROVED run and no valid unconsumed supersession authorisation exists
--    (same test as trigger fn_guard_designated_run_header / AU2_PERIOD_HOLDS_APPROVED_RUN)
-- 3) when the 1st of a month is a Monday, run BOTH the month-end branch (previous month)
--    and the weekly branch (new month), one result row each.
-- Signature, return type, SECURITY DEFINER, search_path, owner (postgres) and ACL
-- ({postgres=X/postgres}) are unchanged by CREATE OR REPLACE; re-asserted below.
-- Stopgap only. The later redesign (valuation date per run, drafts after approval) is NOT here.
BEGIN;

ALTER TABLE costing.cost_period_governance_audit
  DROP CONSTRAINT cost_period_governance_audit_event_source_chk;
ALTER TABLE costing.cost_period_governance_audit
  ADD CONSTRAINT cost_period_governance_audit_event_source_chk
  CHECK (event_source = ANY (ARRAY['MIGRATION'::text,'SYSTEM'::text,'GOVERNED_RPC'::text,'CRON_SCHEDULED'::text]));

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
REVOKE ALL ON FUNCTION costing.rpc_request_scheduled_costing_refresh_internal() FROM PUBLIC;
DO $$ BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION costing.rpc_request_scheduled_costing_refresh_internal() FROM anon, authenticated';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

COMMENT ON FUNCTION costing.rpc_request_scheduled_costing_refresh_internal() IS
 'CI-039 stopgap: weekly (Mon) / month-end (1st) scheduled draft request. Skips with SKIPPED_APPROVED_PERIOD when the month holds an APPROVED run and no supersession authorisation; runs both steps when the 1st is a Monday.';
COMMIT;
