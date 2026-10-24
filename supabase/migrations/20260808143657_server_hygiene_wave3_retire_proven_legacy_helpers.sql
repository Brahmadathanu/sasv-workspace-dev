-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop function public.etl_recover_template_path_incident_internal(timestamp with time zone);
drop function public.force_unlink_plan_batch(bigint, text);
drop table public._view_backups;