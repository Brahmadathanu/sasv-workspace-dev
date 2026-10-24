-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.proc_publish_snapshot_generation_on_run_success_internal()
returns trigger
language plpgsql
security definer
set search_path='public'
as $function$
begin
  if new.refresh_name = 'procurement_execution_snapshots'
     and new.status = 'SUCCESS'
     and old.status is distinct from new.status then
    perform public.proc_publish_snapshot_generation_internal(new.run_id);
  end if;
  return new;
end;
$function$;

revoke all on function public.proc_publish_snapshot_generation_on_run_success_internal() from public, anon, authenticated;
grant execute on function public.proc_publish_snapshot_generation_on_run_success_internal() to postgres, service_role;

drop trigger if exists trg_proc_publish_snapshot_generation_on_run_success on public.proc_snapshot_refresh_run;
create trigger trg_proc_publish_snapshot_generation_on_run_success
after update of status on public.proc_snapshot_refresh_run
for each row
when (new.status = 'SUCCESS' and old.status is distinct from new.status)
execute function public.proc_publish_snapshot_generation_on_run_success_internal();