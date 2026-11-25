-- R5: automated month-turnover retention planner + resumable tick. Apply after R4. PostgreSQL 17.
-- Installs functions/tables only. It does NOT create or alter any cron job. Scheduling is a separate, later, owner-gated step
-- (see ../DEPLOYMENT_SEQUENCE.md; proposed statement is documentation only). Default mode of every entry point is DRY_RUN.
-- Policy (owner decision, 25 Nov 2026): November 2026 is the first authoritative month. Retain detailed data for the current
-- calendar month (Asia/Kolkata) plus the previous THREE months at most. Final approved detail only for completed retained months.
-- Prior-month drafts are purged promptly after a valid final selection. No final approval for a completed in-window month, or an
-- active reference, is an explicit HOLD that expires when the month leaves the window (drafts are never retained forever).
-- Designated (approved/reference/revoked) runs are NEVER purged by this package: outside the window they are an explicit HOLD
-- needing a separate owner-approved guard extension.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE costing_retention.retention_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 first_authoritative_month date NOT NULL CHECK (first_authoritative_month=date_trunc('month',first_authoritative_month)::date),
 window_previous_months integer NOT NULL CHECK (window_previous_months BETWEEN 0 AND 3),
 time_zone text NOT NULL DEFAULT 'Asia/Kolkata' CHECK (time_zone='Asia/Kolkata'),
 max_runs_per_tick integer NOT NULL DEFAULT 1 CHECK (max_runs_per_tick BETWEEN 1 AND 5),
 step_batch_rows integer NOT NULL DEFAULT 20000 CHECK (step_batch_rows BETWEEN 1 AND 200000),
 purge_enabled boolean NOT NULL DEFAULT false,      -- master switch: nothing is deleted unless an owner sets this true
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO costing_retention.retention_policy(first_authoritative_month,window_previous_months) VALUES ('2026-11-01',3);
CREATE TABLE costing_retention.retention_job_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 today_ist date NOT NULL, mode text NOT NULL CHECK (mode IN ('DRY_RUN','EXECUTE')),
 outcome text NOT NULL CHECK (outcome IN ('PLANNED','PURGE_STEP','RUN_PURGED','NOTHING_ELIGIBLE','LOCKED','DISABLED','FAILED')),
 refresh_run_id bigint, detail jsonb NOT NULL DEFAULT '{}'::jsonb, session_user_name text NOT NULL DEFAULT session_user
);
CREATE TRIGGER retention_job_log_append_only BEFORE UPDATE OR DELETE ON costing_retention.retention_job_log FOR EACH ROW EXECUTE FUNCTION costing_retention.fn_reject_evidence_mutation();
CREATE TRIGGER retention_job_log_no_truncate BEFORE TRUNCATE ON costing_retention.retention_job_log FOR EACH STATEMENT EXECUTE FUNCTION costing_retention.fn_reject_evidence_mutation();
REVOKE ALL ON ALL TABLES IN SCHEMA costing_retention FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA costing_retention FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION costing_retention.fn_ist_date(p_ts timestamptz) RETURNS date LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS
$$ SELECT (p_ts AT TIME ZONE 'Asia/Kolkata')::date $$;

-- Pure planner: one row per run with classification, decision and reason. Read-only.
CREATE FUNCTION costing_retention.fn_plan_retention(p_today date DEFAULT NULL)
RETURNS TABLE(refresh_run_id bigint,period_start date,run_classification text,retention_decision text,retention_reason text,blockers text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,costing,costing_retention AS $$
DECLARE pol costing_retention.retention_policy; v_today date:=coalesce(p_today,costing_retention.fn_today_ist()); cur date; win_start date;
BEGIN
 SELECT * INTO STRICT pol FROM costing_retention.retention_policy;
 cur:=date_trunc('month',v_today)::date; win_start:=(cur-make_interval(months=>pol.window_previous_months))::date;
 RETURN QUERY
 WITH base AS (
  SELECT l.refresh_run_id rid,l.period_start ps,l.valuation_month vm,l.detail_state st,r.overall_status status,
   s.approved_run_id appr,s.displayed_run_id disp,
   EXISTS(SELECT 1 FROM costing.costing_run_designation d WHERE d.refresh_run_id=l.refresh_run_id) designated,
   (SELECT e.designation FROM costing.v_costing_run_effective_designation e WHERE e.refresh_run_id=l.refresh_run_id) eff,
   (SELECT st2.detail_state FROM costing.costing_run_retention_ledger st2 WHERE st2.refresh_run_id=s.approved_run_id) appr_state
  FROM costing.costing_run_retention_ledger l JOIN costing.costing_refresh_run r ON r.id=l.refresh_run_id
  LEFT JOIN costing.v_costing_period_run_status s ON s.period_start=l.period_start),
 c AS (SELECT b.*,
   CASE WHEN b.status NOT IN ('SUCCESS','QUEUED','RUNNING') THEN 'FAILED'
        WHEN b.status IN ('QUEUED','RUNNING') THEN 'OTHER'
        WHEN b.rid=b.appr THEN 'FINAL_APPROVED'
        WHEN b.eff='APPROVED' THEN 'SUPERSEDED_APPROVED'
        WHEN b.eff='REFERENCE' THEN 'REFERENCE' WHEN b.eff='REVOKED' THEN 'REVOKED' ELSE 'DRAFT' END cls
   FROM base b),
 d AS (SELECT c.*,
   CASE
    WHEN c.st='DETAILS_PURGED' THEN ARRAY['RETAIN','details already purged; identity and governance preserved']
    WHEN c.status IN ('QUEUED','RUNNING') THEN ARRAY['HOLD','run is active']
    WHEN c.vm>=cur THEN ARRAY['RETAIN','current or future calendar month is protected']
    WHEN c.designated AND c.cls='FINAL_APPROVED' AND c.vm>=win_start THEN ARRAY['RETAIN','final approved run of a completed retained month']
    WHEN c.designated THEN ARRAY['HOLD','designated run: purge requires a separately approved guard exception (never purged by this package)']
    WHEN c.vm<win_start THEN ARRAY['ELIGIBLE','outside the retention window']
    WHEN c.appr IS NOT NULL AND c.appr_state IN ('DETAILS_AVAILABLE','DETAILS_UNVERIFIED') THEN ARRAY['ELIGIBLE','non-final run of a completed retained month with a valid final approved run '||c.appr]
    WHEN c.appr IS NOT NULL THEN ARRAY['HOLD','final approved run '||c.appr||' details are not available; refusing to remove the alternative']
    ELSE ARRAY['HOLD','completed in-window month has no valid final approval; holds until the month leaves the window']
   END dec
   FROM c)
 SELECT d.rid,d.ps,d.cls,
   CASE WHEN d.dec[1]='ELIGIBLE' AND EXISTS(SELECT 1 FROM costing_retention.fn_purge_run_blockers(d.rid) bb WHERE bb.blocker<>'ALREADY_PURGED') THEN 'HOLD' ELSE d.dec[1] END,
   CASE WHEN d.dec[1]='ELIGIBLE' AND EXISTS(SELECT 1 FROM costing_retention.fn_purge_run_blockers(d.rid) bb WHERE bb.blocker<>'ALREADY_PURGED')
        THEN 'technical blocker(s): '||(SELECT string_agg(bb.blocker,', ') FROM costing_retention.fn_purge_run_blockers(d.rid) bb WHERE bb.blocker<>'ALREADY_PURGED') ELSE d.dec[2] END,
   CASE WHEN d.dec[1]='ELIGIBLE' THEN ARRAY(SELECT bb.blocker||':'||bb.detail FROM costing_retention.fn_purge_run_blockers(d.rid) bb WHERE bb.blocker<>'ALREADY_PURGED') ELSE ARRAY[]::text[] END
 FROM d ORDER BY d.ps,d.rid;
END $$;

-- Persist the verdict into the ledger (dry-run safe: touches only classification/decision/diagnostic columns).
CREATE FUNCTION costing_retention.fn_refresh_retention_plan(p_today date DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,costing,costing_retention AS $$
DECLARE n integer;
BEGIN
 UPDATE costing.costing_run_retention_ledger l SET run_classification=p.run_classification,retention_decision=p.retention_decision,
   retention_reason=p.retention_reason,last_preflight_at=clock_timestamp(),last_blocker=array_to_string(p.blockers,'; '),
   original_designation_evidence=coalesce((SELECT jsonb_agg(jsonb_build_object('designation',d.designation,'designated_at',d.designated_at,'designation_id',d.id) ORDER BY d.id)
      FROM costing.costing_run_designation d WHERE d.refresh_run_id=l.refresh_run_id),'[]'::jsonb)
 FROM costing_retention.fn_plan_retention(p_today) p WHERE p.refresh_run_id=l.refresh_run_id AND l.detail_state<>'DETAILS_PURGED'
   AND (l.run_classification,l.retention_decision,l.retention_reason) IS DISTINCT FROM (p.run_classification,p.retention_decision,p.retention_reason);
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;

-- One scheduler tick = at most one purge step of one run. Safe to call repeatedly / concurrently. Default DRY_RUN.
CREATE FUNCTION costing_retention.retention_tick(p_mode text DEFAULT 'DRY_RUN') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,costing,costing_retention AS $$
DECLARE pol costing_retention.retention_policy; v_today date:=costing_retention.fn_today_ist(); v_run bigint; j jsonb; v_out text; v_counts jsonb;
BEGIN
 IF p_mode NOT IN ('DRY_RUN','EXECUTE') THEN RAISE EXCEPTION 'RETENTION_BAD_MODE'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('costing-retention-tick',0)) THEN
  INSERT INTO costing_retention.retention_job_log(today_ist,mode,outcome) VALUES(v_today,p_mode,'LOCKED'); RETURN jsonb_build_object('outcome','LOCKED'); END IF;
 SELECT * INTO STRICT pol FROM costing_retention.retention_policy;
 PERFORM costing_retention.fn_refresh_retention_plan(v_today);
 SELECT jsonb_object_agg(k,n) INTO v_counts FROM (SELECT retention_decision||'/'||detail_state k,count(*) n FROM costing.costing_run_retention_ledger GROUP BY 1) q;
 IF p_mode='DRY_RUN' THEN
  INSERT INTO costing_retention.retention_job_log(today_ist,mode,outcome,detail) VALUES(v_today,p_mode,'PLANNED',jsonb_build_object('counts',v_counts));
  RETURN jsonb_build_object('outcome','PLANNED','counts',v_counts); END IF;
 IF NOT pol.purge_enabled THEN
  INSERT INTO costing_retention.retention_job_log(today_ist,mode,outcome,detail) VALUES(v_today,p_mode,'DISABLED',jsonb_build_object('counts',v_counts));
  RETURN jsonb_build_object('outcome','DISABLED','counts',v_counts); END IF;
 -- resume an in-flight purge first, else the oldest eligible run
 SELECT l.refresh_run_id INTO v_run FROM costing.costing_run_retention_ledger l WHERE l.detail_state='PURGE_IN_PROGRESS' ORDER BY l.valuation_month,l.refresh_run_id LIMIT 1;
 IF v_run IS NULL THEN SELECT l.refresh_run_id INTO v_run FROM costing.costing_run_retention_ledger l WHERE l.retention_decision='ELIGIBLE' AND l.detail_state<>'DETAILS_PURGED' ORDER BY l.valuation_month,l.refresh_run_id LIMIT 1; END IF;
 IF v_run IS NULL THEN INSERT INTO costing_retention.retention_job_log(today_ist,mode,outcome) VALUES(v_today,p_mode,'NOTHING_ELIGIBLE'); RETURN jsonb_build_object('outcome','NOTHING_ELIGIBLE'); END IF;
 -- an in-flight run must still be eligible under TODAY's policy (e.g. a late approval changes the verdict) - otherwise stop and report
 IF NOT EXISTS (SELECT 1 FROM costing_retention.fn_plan_retention(v_today) p WHERE p.refresh_run_id=v_run AND p.retention_decision IN ('ELIGIBLE') ) THEN
  INSERT INTO costing_retention.retention_job_log(today_ist,mode,outcome,refresh_run_id,detail) VALUES(v_today,p_mode,'FAILED',v_run,jsonb_build_object('error','in-flight run no longer eligible under current policy; manual review'));
  RETURN jsonb_build_object('outcome','FAILED','run',v_run,'error','no longer eligible'); END IF;
 BEGIN
  j:=costing_retention.purge_run_step(v_run,pol.step_batch_rows);
  v_out:=CASE WHEN (j->>'done')::boolean THEN 'RUN_PURGED' ELSE 'PURGE_STEP' END;
  INSERT INTO costing_retention.retention_job_log(today_ist,mode,outcome,refresh_run_id,detail) VALUES(v_today,p_mode,v_out,v_run,j);
  RETURN jsonb_build_object('outcome',v_out,'run',v_run,'step',j);
 EXCEPTION WHEN OTHERS THEN   -- step rolled back to the savepoint; failure is recorded and the next tick retries
  INSERT INTO costing_retention.retention_job_log(today_ist,mode,outcome,refresh_run_id,detail) VALUES(v_today,p_mode,'FAILED',v_run,jsonb_build_object('error',SQLERRM,'sqlstate',SQLSTATE));
  RETURN jsonb_build_object('outcome','FAILED','run',v_run,'error',SQLERRM);
 END;
END $$;

-- Monitoring (permission-gated, read-only).
CREATE FUNCTION public.rpc_costing_retention_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,costing,costing_retention AS $$
BEGIN
 PERFORM public.require_permission('module:costing-control-center',false);
 RETURN jsonb_build_object(
  'today_ist',costing_retention.fn_today_ist(),
  'purge_enabled',(SELECT purge_enabled FROM costing_retention.retention_policy),
  'by_decision_state',(SELECT coalesce(jsonb_object_agg(k,n),'{}'::jsonb) FROM (SELECT retention_decision||'/'||detail_state k,count(*) n FROM costing.costing_run_retention_ledger GROUP BY 1) q),
  'stuck_in_progress',(SELECT coalesce(jsonb_agg(refresh_run_id),'[]'::jsonb) FROM costing.costing_run_retention_ledger WHERE detail_state='PURGE_IN_PROGRESS' AND updated_at<clock_timestamp()-interval '1 day'),
  'last_job',(SELECT to_jsonb(j)-'session_user_name' FROM (SELECT id,started_at,mode,outcome,refresh_run_id FROM costing_retention.retention_job_log ORDER BY id DESC LIMIT 1) j));
END $$;
REVOKE ALL ON FUNCTION public.rpc_costing_retention_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_costing_retention_status() TO authenticated;
REVOKE ALL ON FUNCTION costing_retention.fn_ist_date(timestamptz),costing_retention.fn_plan_retention(date),costing_retention.fn_refresh_retention_plan(date),costing_retention.retention_tick(text) FROM PUBLIC,anon,authenticated,service_role;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sasv_retention_executor') THEN
  GRANT EXECUTE ON FUNCTION costing_retention.fn_plan_retention(date),costing_retention.fn_refresh_retention_plan(date),costing_retention.retention_tick(text) TO sasv_retention_executor;
 END IF;
END $$;
COMMIT;
