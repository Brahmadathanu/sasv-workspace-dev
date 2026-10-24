-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop function public.rpc_refresh_costing_review_workbench_snapshot_maintenance(date);
drop function costing.rpc_refresh_costing_review_workbench_snapshot_maintenance(date);
drop function costing.rpc_refresh_material_action_snapshots_maintenance(date);