-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop table if exists public.plm_bom_tpl_line;
drop table if exists public.plm_bom_tpl_header;
drop table if exists public._archive_etl_jobs;
drop table if exists public._archive_storage_cleanup_queue;
drop table if exists public._ddl_backup_functions;
drop table if exists costing._backup_view_defs_20260702;