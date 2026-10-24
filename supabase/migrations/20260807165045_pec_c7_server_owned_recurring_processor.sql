-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'procurement_snapshot_refresh_process_0136_IST_to_0145_IST'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  if not exists (
    select 1 from cron.job
    where jobname = 'procurement_snapshot_refresh_stage_processor_every_minute'
  ) then
    perform cron.schedule(
      'procurement_snapshot_refresh_stage_processor_every_minute',
      '* * * * *',
      $cron$select public.proc_process_snapshot_refresh_next_stage();$cron$
    );
  end if;
end $$;

comment on function public.proc_process_snapshot_refresh_next_stage() is
'Procurement staged refresh processor. Server-owned execution is scheduled every minute via pg_cron. Direct client execution remains temporarily available only for backward compatibility until the PEC client refresh loop is removed and ACL hardening is completed.';