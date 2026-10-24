-- backfilled from live schema_migrations on 2026-10-24, CI-016
REVOKE ALL ON FUNCTION public.rpc_get_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, integer, integer, date, bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_get_material_rate_rm_cost_trace_filter_options(date, bigint, date, bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_export_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, date, bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_get_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, integer, integer, date, bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_get_material_rate_pm_cost_trace_filter_options(date, bigint, date, bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_export_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, date, bigint) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, integer, integer, date, bigint) TO authenticated, postgres;
GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_rm_cost_trace_filter_options(date, bigint, date, bigint) TO authenticated, postgres;
GRANT EXECUTE ON FUNCTION public.rpc_export_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, date, bigint) TO authenticated, postgres;
GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, integer, integer, date, bigint) TO authenticated, postgres, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_pm_cost_trace_filter_options(date, bigint, date, bigint) TO authenticated, postgres, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_export_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, date, bigint) TO authenticated, postgres, service_role;

NOTIFY pgrst, 'reload schema';