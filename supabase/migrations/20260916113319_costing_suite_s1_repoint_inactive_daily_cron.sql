do $$
begin
  if not exists (select 1 from cron.job where jobid=60 and active=false) then
    raise exception 'S1 precondition failed: job60 must exist and remain inactive before repointing';
  end if;
  if exists (select 1 from cron.job where jobid=61 and active) then
    raise exception 'S1 precondition failed: job61 must remain inactive during hardening';
  end if;
end $$;

select cron.alter_job(
  60,
  command := 'select * from costing.rpc_request_daily_costing_refresh_internal();'
);
