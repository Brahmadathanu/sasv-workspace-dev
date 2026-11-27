-- Executive Intelligence guarded summary refresh. Job 17 and other workloads unchanged.
CREATE FUNCTION app_private.ei_refresh_summary_guarded(p_force boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public,app_private AS $fn$
DECLARE v_snapshot timestamptz; v_import timestamptz; v_started timestamptz; v_result text;
BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Maintenance role required' USING ERRCODE='42501'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('sasv:ei:summary:refresh:v1',0)) THEN
  RAISE LOG 'EI summary refresh: SKIP_LOCKED'; RETURN 'SKIP_LOCKED';
 END IF;
 SELECT max(mv_refreshed_at) INTO v_snapshot FROM app_private.mv_mis_executive_summary;
 SELECT max(finished_at) INTO v_import FROM public.etl_jobs
 WHERE job_type='UPSERT_VREG_SALES' AND status='done' AND finished_at>coalesce(v_snapshot,'-infinity'::timestamptz);
 IF NOT coalesce(p_force,false) AND v_snapshot IS NOT NULL AND v_import IS NULL THEN
  RAISE LOG 'EI summary refresh: SKIP_CURRENT snapshot=%',v_snapshot; RETURN 'SKIP_CURRENT';
 END IF;
 IF NOT coalesce(p_force,false) AND v_import > clock_timestamp()-interval '2 minutes' THEN
  RAISE LOG 'EI summary refresh: SKIP_RECENT_IMPORT import=%',v_import; RETURN 'SKIP_RECENT_IMPORT';
 END IF;
 v_started:=clock_timestamp();
 RAISE LOG 'EI summary refresh: START force=% previous=% import=%',p_force,v_snapshot,v_import;
 REFRESH MATERIALIZED VIEW CONCURRENTLY app_private.mv_mis_executive_summary;
 v_result:=format('REFRESHED duration=%s',clock_timestamp()-v_started);
 RAISE LOG 'EI summary refresh: %',v_result;
 RETURN v_result;
END $fn$;
REVOKE ALL ON FUNCTION app_private.ei_refresh_summary_guarded(boolean) FROM PUBLIC,anon,authenticated,service_role;
DO $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobid=52 AND username='postgres' AND jobname='refresh_mv_mis_executive_summary_morning' AND schedule='0 3 * * *' AND active AND command='refresh materialized view concurrently app_private.mv_mis_executive_summary;') OR NOT EXISTS(SELECT 1 FROM cron.job WHERE jobid=53 AND username='postgres' AND jobname='refresh_mv_mis_executive_summary_night' AND schedule='0 22 * * *' AND active AND command='refresh materialized view concurrently app_private.mv_mis_executive_summary;') OR EXISTS(SELECT 1 FROM cron.job WHERE jobname='ei_executive_summary_sales_catchup') THEN
 RAISE EXCEPTION 'Unexpected cron baseline; stop';
 END IF;
 PERFORM cron.alter_job(52,command:='select app_private.ei_refresh_summary_guarded(true);');
 PERFORM cron.alter_job(53,schedule:='0 23 * * *',command:='select app_private.ei_refresh_summary_guarded(true);');
 PERFORM cron.schedule('ei_executive_summary_sales_catchup','12,42 0-1,4-20,23 * * *','select app_private.ei_refresh_summary_guarded(false);');
END $guard$;
