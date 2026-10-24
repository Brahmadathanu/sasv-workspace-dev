-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop function public.rpc_refresh_costing_review_action_drilldown_snapshot(date,bigint,text,text);
drop function public.rpc_refresh_material_action_drilldown_snapshot(date,bigint,text,text,text);
drop function costing.rpc_refresh_material_action_drilldown_snapshot(date,bigint,text,text,text);