-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke execute on function public.proc_process_snapshot_refresh_next_stage() from authenticated;

grant execute on function public.proc_process_snapshot_refresh_next_stage() to service_role;