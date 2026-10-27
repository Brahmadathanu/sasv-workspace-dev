-- =====================================================================================================
-- CI-043 v2.2  Read-only costing health check: fingerprints, freshness, scheduler failures/retries, jobs,
--            stuck runs, approvals and quarter-lock reminders. Severity ERROR / WARN / INFO.
-- PREPARED 26 Oct 2026 (IST), v2.1 corrections 26 Oct 2026. NOT APPLIED. Owner decisions 26 Oct 2026 (D3; open questions 3 and 4 of v1).
-- No cron job is created (scheduling a daily run of it is a separate, later decision). No alert table/subsystem:
-- the live database has no costing alert mechanism (public.etl_health_log last written 4 Sep 2025, ETL only),
-- so the output of this function IS the alert surface for the app / a later daily job.
-- IT REPORTS ONLY. IT SENDS NO ALERT (no e-mail, message, notification or log write): an ERROR row is seen only when
-- someone or something calls rpc_costing_health_check.
-- v2.1: retry items read CI-041 v2.1's classifier and audited retry decisions; QUEUED runs distinguish an inactive /
-- not-executing processor (job 68) from a run waiting behind a legitimately RUNNING run; unused expired preview
-- acknowledgements are reported beyond a threshold (never deleted automatically).
-- Requires CI-040 v2 (settings table) and CI-041 v2 (retry setting). No policy record.
--
-- OBJECTS TOUCHED
--   INSERT  9 rows into costing.costing_automation_setting (health_* thresholds, adjustable, range-checked by CI-040 v2.1);
--           v2.2: abort with CI043_SETTING_CONFLICT if a key exists with a different value (identical = idempotent)
--   NEW     function costing.fn_costing_health_check(date)   internal, STABLE, read-only
--   NEW     function public.rpc_costing_health_check()       read-only RPC (authenticated)
-- =====================================================================================================
BEGIN;

-- v2.2 (review correction 1): no silent ON CONFLICT. Each health_* key is inserted if absent; if it already exists it must
-- carry exactly the intended default (idempotent re-apply), otherwise the whole migration aborts (CI043_SETTING_CONFLICT).
DO $$
DECLARE r record; v_cur int;
BEGIN
  FOR r IN SELECT * FROM (VALUES
 ('health_quarter_lock_warn_days', 45, 'days', 'WARN when an approved month of a quarter that ended this many days ago is still not locked', 'CI-043', now()),
 ('health_quarter_lock_info_days', 30, 'days', 'INFO reminder when a quarter ended this many days ago and its approved months are not locked', 'CI-043', now()),
 ('health_draft_freshness_days', 8, 'days', 'WARN when the current open month has no successful draft finished within this many days', 'CI-043', now()),
 ('health_draft_review_days', 14, 'days', 'INFO when a newer draft has waited this many days without review', 'CI-043', now()),
 ('health_queued_stuck_hours', 2, 'hours', 'WARN when a run is QUEUED longer than this', 'CI-043', now()),
 ('health_running_stuck_hours', 6, 'hours', 'WARN when a run is RUNNING longer than this', 'CI-043', now()),
 ('health_preview_ack_unused_warn_count', 50, 'rows', 'INFO when more unused, expired approval-preview acknowledgements than this have accumulated', 'CI-043', now()),
 ('health_preview_ack_unused_min_age_days', 30, 'days', 'Only unused acknowledgements opened at least this many days ago are counted', 'CI-043', now()),
 ('health_retry_overdue_minutes', 20, 'minutes', 'WARN when an allowlisted transient scheduled failure has no retry decision after this long', 'CI-043', now())
  ) AS t(setting_key, int_value, unit, description, introduced_by, updated_at) LOOP
    SELECT int_value INTO v_cur FROM costing.costing_automation_setting WHERE setting_key = r.setting_key;
    IF FOUND THEN
      IF v_cur IS DISTINCT FROM r.int_value THEN
        RAISE EXCEPTION 'CI043_SETTING_CONFLICT: setting % already exists with value % (intended default %); nothing installed - investigate before applying', r.setting_key, v_cur, r.int_value;
      END IF;
    ELSE
      INSERT INTO costing.costing_automation_setting(setting_key, int_value, unit, description, introduced_by, updated_at)
      VALUES (r.setting_key, r.int_value, r.unit, r.description, r.introduced_by, r.updated_at);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION costing.fn_costing_health_check(p_today date DEFAULT NULL)
 RETURNS TABLE(severity text, check_code text, period_start date, run_id bigint, detail text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare v_today date := coalesce(p_today, costing.fn_india_business_date());
  s_warn int; s_info int; s_fresh int; s_review int; s_q int; s_r int; s_retry int; d record; v_drift bigint; v_cur date;
  s_ack_n int; s_ack_age int; s_overdue int; v_j68_active boolean; v_j68_last timestamptz;
begin
  select coalesce(max(int_value) filter (where setting_key='health_quarter_lock_warn_days'),45),
         coalesce(max(int_value) filter (where setting_key='health_quarter_lock_info_days'),30),
         coalesce(max(int_value) filter (where setting_key='health_draft_freshness_days'),8),
         coalesce(max(int_value) filter (where setting_key='health_draft_review_days'),14),
         coalesce(max(int_value) filter (where setting_key='health_queued_stuck_hours'),2),
         coalesce(max(int_value) filter (where setting_key='health_running_stuck_hours'),6),
         coalesce(max(int_value) filter (where setting_key='scheduler_max_retries'),2),
         coalesce(max(int_value) filter (where setting_key='health_preview_ack_unused_warn_count'),50),
         coalesce(max(int_value) filter (where setting_key='health_preview_ack_unused_min_age_days'),30),
         coalesce(max(int_value) filter (where setting_key='health_retry_overdue_minutes'),20)
    into s_warn, s_info, s_fresh, s_review, s_q, s_r, s_retry, s_ack_n, s_ack_age, s_overdue from costing.costing_automation_setting;
  select coalesce(bool_or(c.active), false) into v_j68_active from cron.job c where c.jobid = 68;
  select max(x.start_time) into v_j68_last from cron.job_run_details x where x.jobid = 68 and x.status = 'succeeded';
  v_cur := date_trunc('month', v_today)::date;

  -- governance: approvals and fingerprints (fail-closed areas -> ERROR)
  return query select 'ERROR', 'MULTIPLE_APPROVED_RUNS', e.period_start, max(e.refresh_run_id), count(*) || ' APPROVED runs in one month'
    from costing.v_costing_run_effective_designation e where e.designation = 'APPROVED' group by e.period_start having count(*) > 1;
  for d in select e.refresh_run_id, e.period_start, e.designation from costing.v_costing_run_effective_designation e
            where e.designation in ('APPROVED','REFERENCE') order by e.refresh_run_id loop
    if not exists (select 1 from costing.costing_run_fingerprint f where f.refresh_run_id = d.refresh_run_id) then
      return query select case d.designation when 'APPROVED' then 'ERROR' else 'WARN' end, d.designation || '_FINGERPRINT_MISSING', d.period_start, d.refresh_run_id, 'No fingerprint captured';
      continue;
    end if;
    select count(*) into v_drift from costing.fn_verify_run_fingerprint(d.refresh_run_id) v where not v.matches;
    if v_drift > 0 then
      return query select case d.designation when 'APPROVED' then 'ERROR' else 'WARN' end, d.designation || '_FINGERPRINT_DRIFT', d.period_start, d.refresh_run_id,
        v_drift || ' table(s) differ from the captured fingerprint';
    end if;
  end loop;
  return query select 'ERROR', 'LOCKED_WITHOUT_APPROVED_RUN', p.period_start, null::bigint, p.status || ' month without an APPROVED run'
    from costing.cost_periods p where p.status in ('LOCKED','CLOSED')
     and not exists (select 1 from costing.v_costing_run_effective_designation e where e.period_start = p.period_start and e.designation = 'APPROVED');
  return query select 'WARN', 'LOCKED_STORED_DATE_AFTER_OFFICIAL', p.period_start, rr.id,
      format('Stored month date %s is after the official (approved run) date %s; the back-dating cut-off follows the later date', p.valuation_date, rr.valuation_date)
    from costing.cost_periods p join costing.v_costing_run_effective_designation e on e.period_start = p.period_start and e.designation = 'APPROVED'
    join costing.costing_refresh_run rr on rr.id = e.refresh_run_id
   where p.status in ('LOCKED','CLOSED') and p.valuation_date > rr.valuation_date;

  -- automation: jobs, stuck runs, scheduled failures, freshness
  return query select 'ERROR', 'JOB_MISSING', null::date, j.id::bigint, 'cron job ' || j.id || ' not found'
    from unnest(array[66,67,68]) j(id) where not exists (select 1 from cron.job c where c.jobid = j.id);
  return query select 'ERROR', 'JOB_INACTIVE', null::date, c.jobid, c.jobname || ' is inactive' from cron.job c where c.jobid in (66,67,68) and not c.active;
  return query select 'WARN', 'JOB_RECENT_FAILURE', null::date, x.jobid, count(*) || ' failed execution(s) in 7 days; last: ' || left(max(x.return_message), 200)
    from cron.job_run_details x where x.jobid in (66,67,68) and x.status = 'failed' and x.start_time > now() - interval '7 days' group by x.jobid;
  -- v2.1: why is a run still QUEUED? processor inactive / not executing (ERROR) vs waiting behind a RUNNING run (INFO)
  return query select
      case when not v_j68_active or v_j68_last is null or v_j68_last < now() - interval '30 minutes' then 'ERROR'
           when exists (select 1 from costing.costing_refresh_run o where o.overall_status = 'RUNNING' and o.id <> r.id
                          and coalesce(o.started_at, o.requested_at) >= now() - make_interval(hours => s_r)) then 'INFO' else 'WARN' end,
      case when not v_j68_active then 'QUEUED_PROCESSOR_INACTIVE'
           when v_j68_last is null or v_j68_last < now() - interval '30 minutes' then 'QUEUED_PROCESSOR_NOT_EXECUTING'
           when exists (select 1 from costing.costing_refresh_run o where o.overall_status = 'RUNNING' and o.id <> r.id
                          and coalesce(o.started_at, o.requested_at) >= now() - make_interval(hours => s_r)) then 'QUEUED_BEHIND_RUNNING_RUN'
           else 'STUCK_QUEUED_RUN' end,
      r.period_start, r.id,
      'QUEUED since ' || r.requested_at || '; job 68 ' || case when v_j68_active then 'active' else 'INACTIVE' end
        || ', last successful execution ' || coalesce(v_j68_last::text, 'none recorded')
    from costing.costing_refresh_run r where r.overall_status = 'QUEUED' and r.requested_at < now() - make_interval(hours => s_q);
  return query select 'WARN', 'STUCK_RUNNING_RUN', r.period_start, r.id, 'RUNNING since ' || coalesce(r.started_at, r.requested_at)
    from costing.costing_refresh_run r where r.overall_status = 'RUNNING' and coalesce(r.started_at, r.requested_at) < now() - make_interval(hours => s_r);
  -- v2.1: scheduled failures by class (CI-041 v2.1 allowlist) and audited retry decision; a failure that already got a
  -- retry (SCHEDULED_RETRY_REQUESTED) is not listed - the retry run carries the chain
  return query
    with f as (select r.id, r.period_start, r.valuation_date, coalesce(r.finished_at, r.updated_at, r.requested_at) failed_at,
                      costing.fn_costing_failure_class(r.error_message) cls, left(coalesce(r.error_message,''),160) msg,
                      (select a.event_type from costing.cost_period_governance_audit a where a.event_type like 'SCHEDULED_RETRY%'
                          and a.evidence_json->>'failed_run_id' = r.id::text order by a.audit_id desc limit 1) decided,
                      (select a.evidence_json->>'retry_error' from costing.cost_period_governance_audit a where a.event_type = 'SCHEDULED_RETRY_FAILED'
                          and a.evidence_json->>'failed_run_id' = r.id::text order by a.audit_id desc limit 1) retry_err
                 from costing.costing_refresh_run r
                where r.source_trigger = 'CRON_SCHEDULED' and r.overall_status = 'FAILED'
                  and not exists (select 1 from costing.costing_refresh_run ok where ok.period_start = r.period_start and ok.id > r.id and ok.overall_status = 'SUCCESS'))
    select case when f.cls = 'GOVERNANCE' or f.decided in ('SCHEDULED_RETRY_FAILED','SCHEDULED_RETRY_LIMIT_REACHED') then 'ERROR'
                when f.cls = 'TRANSIENT' and f.decided is null and f.failed_at >= now() - make_interval(mins => s_overdue) then 'INFO' else 'WARN' end,
           case when f.cls = 'GOVERNANCE' then 'SCHEDULED_RUN_GOVERNANCE_FAILURE'
                when f.cls = 'DATA' then 'SCHEDULED_RUN_DATA_GAP_NOT_RETRIED'
                when f.cls = 'UNKNOWN' then 'SCHEDULED_RUN_FAILED_NOT_RETRIED'
                when f.decided = 'SCHEDULED_RETRY_FAILED' then 'SCHEDULED_RETRY_CREATION_FAILED'
                when f.decided = 'SCHEDULED_RETRY_LIMIT_REACHED' then 'SCHEDULED_RETRIES_EXHAUSTED'
                when f.failed_at >= now() - make_interval(mins => s_overdue) then 'SCHEDULED_RETRY_PENDING'
                else 'SCHEDULED_RETRY_OVERDUE' end,
           f.period_start, f.id,
           format('Scheduled run dated %s failed (%s): %s', f.valuation_date, f.cls, f.msg)
             || coalesce('; retry could not be created: ' || f.retry_err, '')
             || case when f.cls in ('UNKNOWN','DATA') then '; not retried - the next scheduled draft proceeds' else '' end
      from f
     where f.decided is distinct from 'SCHEDULED_RETRY_REQUESTED';
  return query select 'WARN', 'DRAFT_FRESHNESS', p.period_start, null::bigint,
      coalesce('Latest successful draft finished ' || to_char((max(r.finished_at) at time zone 'Asia/Kolkata'), 'DD Mon YYYY HH24:MI') || ' IST', 'No successful draft yet') || format(' (threshold %s days)', s_fresh)
    from costing.cost_periods p left join costing.costing_refresh_run r on r.period_start = p.period_start and r.overall_status = 'SUCCESS'
   where p.period_start = v_cur and p.status = 'OPEN' and v_today - p.period_start >= s_fresh
   group by p.period_start having coalesce(max(r.finished_at), '-infinity') < (v_today - s_fresh)::timestamp at time zone 'Asia/Kolkata';
  return query select 'WARN', 'MONTH_END_DRAFT_MISSING', p.period_start, null::bigint, format('No successful run dated %s (month end)', p.period_end)
    from costing.cost_periods p where p.period_start = (v_cur - interval '1 month')::date and p.status = 'OPEN' and v_today - v_cur >= 3
     and not exists (select 1 from costing.costing_refresh_run r where r.period_start = p.period_start and r.valuation_date = p.period_end and r.overall_status in ('SUCCESS','QUEUED','RUNNING'));

  -- owner reminders
  return query
    with q as (select p.period_start, (date_trunc('quarter', p.period_start) + interval '3 months - 1 day')::date q_end
                 from costing.cost_periods p where p.status = 'OPEN'
                  and exists (select 1 from costing.v_costing_run_effective_designation e where e.period_start = p.period_start and e.designation = 'APPROVED'))
    select case when v_today - q.q_end >= s_warn then 'WARN' else 'INFO' end,
           case when v_today - q.q_end >= s_warn then 'QUARTER_LOCK_OVERDUE' else 'QUARTER_LOCK_DUE' end,
           q.period_start, null::bigint, format('Quarter ended %s (%s days ago); approved month still OPEN - lock before formal Close (reminder %s / warning %s days)', q.q_end, v_today - q.q_end, s_info, s_warn)
      from q where v_today - q.q_end >= s_info;
  return query select 'INFO', 'MONTH_ENDED_UNAPPROVED', p.period_start, null::bigint, 'Month ended ' || p.period_end || ', no APPROVED run'
    from costing.cost_periods p where p.status = 'OPEN' and p.period_end < v_today and p.period_start >= date '2026-09-01'
     and not exists (select 1 from costing.v_costing_run_effective_designation e where e.period_start = p.period_start and e.designation = 'APPROVED');
  return query
    with a as (select e.period_start, e.refresh_run_id, rr.valuation_date, rr.finished_at from costing.v_costing_run_effective_designation e
                 join costing.costing_refresh_run rr on rr.id = e.refresh_run_id where e.designation = 'APPROVED'),
         dr as (select r.* from costing.costing_refresh_run r left join costing.v_costing_run_effective_designation de on de.refresh_run_id = r.id
                 where r.overall_status = 'SUCCESS' and de.designation is null)
    select 'INFO', case when dr.valuation_date < a.valuation_date then 'DRAFT_DATED_BEFORE_APPROVED' else 'NEWER_DRAFT_UNREVIEWED' end, dr.period_start, dr.id,
           format('Draft %s dated %s finished %s; approved run %s dated %s', dr.id, dr.valuation_date, (dr.finished_at at time zone 'Asia/Kolkata')::date, a.refresh_run_id, a.valuation_date)
      from dr join a on a.period_start = dr.period_start
     where dr.finished_at > a.finished_at
       and (dr.valuation_date < a.valuation_date
            or (dr.id = (select max(d2.id) from dr d2 where d2.period_start = dr.period_start) and dr.finished_at < now() - make_interval(days => s_review)));
  -- v2.1: accumulated unused, expired approval-preview acknowledgements (reported only; never deleted automatically)
  return query select 'INFO', 'PREVIEW_ACK_UNUSED_ACCUMULATED', null::date, null::bigint,
      format('%s unused expired approval-preview acknowledgements opened more than %s days ago (threshold %s). Not deleted automatically; archiving is an owner decision.', x.n, s_ack_age, s_ack_n)
    from (select count(*) n from costing.costing_approval_preview_ack k
           where k.consumed_at is null and k.expires_at < now() and k.opened_at < now() - make_interval(days => s_ack_age)) x
   where x.n > s_ack_n;
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_costing_health_check()
 RETURNS TABLE(severity text, check_code text, period_start date, run_id bigint, detail text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
begin
  perform public.require_permission('module:costing-control-center', false);
  return query select h.* from costing.fn_costing_health_check(null) h
    order by case h.severity when 'ERROR' then 1 when 'WARN' then 2 else 3 end, h.period_start nulls first, h.check_code, h.run_id;
end $function$;

ALTER FUNCTION costing.fn_costing_health_check(date) OWNER TO postgres;
ALTER FUNCTION public.rpc_costing_health_check() OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_costing_health_check(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_costing_health_check() FROM PUBLIC;
DO $$ BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION costing.fn_costing_health_check(date) FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_costing_health_check() FROM anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_costing_health_check() TO authenticated, service_role';
END $$;
COMMENT ON FUNCTION public.rpc_costing_health_check() IS 'CI-043 v2.2 read-only (reports only; sends no alerts) costing health check (ERROR/WARN/INFO): approvals, fingerprints, locks, cron jobs 66/67/68, stuck runs, scheduled failures by class and audited retry decisions, queued runs (processor inactive vs waiting behind a running run), accumulated unused preview acknowledgements, draft freshness, missing month-end draft, quarter-lock reminders (30-day INFO, 45-day WARN; adjustable), unreviewed drafts. Writes nothing; no cron job.';
COMMIT;
