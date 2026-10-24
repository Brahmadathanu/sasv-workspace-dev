-- backfilled from live schema_migrations on 2026-10-24, CI-016
REVOKE ALL ON FUNCTION costing.fn_resolve_material_trace_selected_run(date, date, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION costing.fn_resolve_material_trace_selected_run(date, date, bigint) FROM anon, authenticated, service_role;

COMMENT ON FUNCTION costing.fn_resolve_material_trace_selected_run(date, date, bigint) IS
  'Internal Material Trace selected-run resolver. Ordinary period reads use current-successful; explicit SUCCESS CAPTURED_AT_REQUEST tuples are required when both exact-run arguments are supplied. Not a public app API.';

DROP FUNCTION IF EXISTS public.rpc_get_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, integer, integer);
DROP FUNCTION IF EXISTS public.rpc_get_material_rate_rm_cost_trace_filter_options(date, bigint);
DROP FUNCTION IF EXISTS public.rpc_export_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text);
DROP FUNCTION IF EXISTS public.rpc_get_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.rpc_get_material_rate_pm_cost_trace_filter_options(date, bigint);
DROP FUNCTION IF EXISTS public.rpc_export_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text);
