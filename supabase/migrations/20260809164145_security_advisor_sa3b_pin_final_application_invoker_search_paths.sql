-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter function public.fn_fg_reconcile_batch(integer, text, numeric) set search_path = pg_catalog, public, pg_temp;
alter function public.rebuild_batch_plan(bigint) set search_path = pg_catalog, public, pg_temp;
alter function public.refresh_material_status_snapshots_current_month() set search_path = pg_catalog, public, pg_temp;
alter function public.trg_fg_ledger_reconcile_del_stmt() set search_path = pg_catalog, public, pg_temp;
alter function public.trg_fg_ledger_reconcile_ins_stmt() set search_path = pg_catalog, public, pg_temp;
alter function public.trg_fg_ledger_reconcile_upd_stmt() set search_path = pg_catalog, public, pg_temp;