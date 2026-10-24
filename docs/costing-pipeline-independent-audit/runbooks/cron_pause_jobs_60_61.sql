-- Guarded reversible pause of ONLY costing jobs 60/61. DO NOT EXECUTE without user approval. Other cron jobs untouched.
-- STEP 0 capture (store the output in evidence/; it is the restore source)
select jobid,jobname,schedule,command,active from cron.job where jobid in (60,61) order by jobid;
-- STEP 1 pre-check: must return 0 rows, else STOP
select id,overall_status,current_stage_code from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING','PENDING');
-- STEP 2 pause (one transaction; aborts if any in-flight run or job identity mismatch)
do $$ begin
  if exists(select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING','PENDING')) then raise exception 'IN_FLIGHT_RUN'; end if;
  if (select count(*) from cron.job where (jobid,jobname) in ((60,'costing_refresh_request_daily_0200_IST'),(61,'costing_refresh_stage_processor_every_5min')))<>2 then raise exception 'JOB_IDENTITY_MISMATCH'; end if;
  perform cron.alter_job(job_id:=60, active:=false);
  perform cron.alter_job(job_id:=61, active:=false);
end $$;
-- STEP 3 post-check: both false; count of other active jobs unchanged vs STEP 0 snapshot
select jobid,active from cron.job where jobid in (60,61);
select count(*) filter (where active) other_active from cron.job where jobid not in (60,61);
-- RESTORE: set active to the values captured in STEP 0 (both were true on 2026-10-16; schedules '30 20 * * *' and '*/5 * * * *' unchanged by pause)
-- do $$ begin perform cron.alter_job(job_id:=60, active:=<captured>); perform cron.alter_job(job_id:=61, active:=<captured>); end $$;
-- RESTORE post-check: schedule/command/active equal STEP 0 capture; next 02:00 IST run in cron.job_run_details.
