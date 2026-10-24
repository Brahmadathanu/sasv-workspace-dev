-- backfilled from live schema_migrations on 2026-10-24, CI-016
select cron.alter_job(
  job_id := 63,
  command := $$select public.proc_request_snapshot_refresh_pec_internal('cron_daily');$$
);