-- PREPARED / NOT DEPLOYED — costing weekly + month-end automation.
-- Must review existing period governance, migration order and test in PostgreSQL before deployment.
-- Jobs 60 and 61 remain inactive. Do not enable until explicit acceptance.
--
-- Requested behaviour: Mondays 02:00 IST draft; 1st of month 02:00 IST
-- final prior-month draft with previous calendar month's last-day valuation.
-- No auto-approval, auto-lock, or destructive draft cleanup.
-- Existing manual refresh RPC and privileges retained.
--
-- Transactional governance audit now included; isolated SQL tests and release approval still mandatory.
-- Fail-closed orchestration for one schedule tick. Use the existing internal
-- refresh requester only after a period has passed every eligibility check.
CREATE OR REPLACE FUNCTION costing.rpc_request_scheduled_costing_refresh_internal()
RETURNS TABLE(
  out_period_start date,
  out_valuation_date date,
  out_run_id bigint,
  out_action text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'costing', 'public', 'pg_temp'
AS $body$
DECLARE
  v_today date := costing.fn_india_business_date();
  v_period date;
  v_cutoff date;
  v_period_row costing.cost_periods%ROWTYPE;
  v_prior_approved boolean;
  v_existing bigint;
  v_requested record;
  v_old_date date;
  v_is_month_end boolean := extract(day from costing.fn_india_business_date()) = 1;
  v_is_weekly boolean := extract(isodow from costing.fn_india_business_date()) = 1;
BEGIN
  IF NOT v_is_month_end AND NOT v_is_weekly THEN
    RETURN QUERY SELECT NULL::date,NULL::date,NULL::bigint,'NOT_SCHEDULED'::text;
    RETURN;
  END IF;
  IF v_is_month_end THEN
    v_period := date_trunc('month',v_today - 1)::date;
    v_cutoff := v_today - 1;
  ELSE
    v_period := date_trunc('month',v_today)::date;
    v_cutoff := v_today;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('cost-period-governance:'||v_period::text,0));
  SELECT * INTO v_period_row FROM costing.cost_periods
   WHERE period_start=v_period FOR UPDATE;
  IF NOT FOUND THEN
    -- Do not silently create an outdated final period: it needs governance.
    RETURN QUERY SELECT v_period,v_cutoff,NULL::bigint,'PERIOD_NOT_GOVERNED'::text;
    RETURN;
  END IF;
  IF v_period_row.status <> 'OPEN'
     OR v_period_row.valuation_date_status <> 'DRAFT' THEN
    RETURN QUERY SELECT v_period,v_cutoff,NULL::bigint,'PERIOD_NOT_OPEN_DRAFT'::text;
    RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM costing.v_costing_run_effective_designation d
      WHERE d.period_start=v_period AND d.designation='APPROVED'
  ) INTO v_prior_approved;
  IF v_prior_approved THEN
    RETURN QUERY SELECT v_period,v_cutoff,NULL::bigint,'APPROVED_RUN_PRESENT'::text;
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM costing.costing_refresh_run r
     WHERE r.period_start=v_period AND r.overall_status IN ('QUEUED','RUNNING')
  ) THEN
    RETURN QUERY SELECT v_period,v_cutoff,NULL::bigint,'ACTIVE_RUN_PRESENT'::text;
    RETURN;
  END IF;
  -- Idempotent per target cutoff, not merely calendar request date.
  SELECT id INTO v_existing FROM costing.costing_refresh_run r
   WHERE r.period_start=v_period AND r.valuation_date=v_cutoff
     AND r.source_trigger='CRON_SCHEDULED'
   ORDER BY r.id DESC LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_period,v_cutoff,v_existing,'EXISTING_RUN'::text;
    RETURN;
  END IF;
  IF v_cutoff < v_period_row.valuation_date THEN
    RETURN QUERY SELECT v_period,v_cutoff,NULL::bigint,'WOULD_BACKDATE_VALUATION'::text;
    RETURN;
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
END;
$body$;
-- IMPORTANT: No cron.schedule or cron.alter_job in this prepared file.
