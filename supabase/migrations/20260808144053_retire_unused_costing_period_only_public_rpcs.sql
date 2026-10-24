-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop function public.rpc_refresh_cost_sheet_line_monthly_snapshot(date);
drop function public.rpc_refresh_costing_control_integrity_audit_snapshot(date);
drop function public.rpc_refresh_costing_control_maintenance_chain(date);
drop function public.rpc_refresh_costing_control_summary_snapshots(date);
drop function public.rpc_refresh_material_action_snapshots_maintenance(date);