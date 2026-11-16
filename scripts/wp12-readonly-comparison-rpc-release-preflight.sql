-- WP12 Cost Comparison: catalog-only readiness. SELECT-only; no business view/RPC execution.
WITH rpc AS (
 SELECT p.oid,p.prosecdef,p.proconfig
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
   AND p.proname='rpc_get_cost_sheet_sku_monthly_comparison_scoped'
   AND pg_get_function_identity_arguments(p.oid)='p_period_start date, p_limit integer'
)
SELECT CASE WHEN count(*)=1
    AND bool_and(prosecdef)
    AND bool_and('search_path=pg_catalog, pg_temp'=ANY(proconfig))
    AND bool_and(has_function_privilege('authenticated',oid,'EXECUTE'))
    AND bool_and(NOT has_function_privilege('anon',oid,'EXECUTE'))
    THEN 'PASS' ELSE 'BLOCKED' END AS scoped_comparison_rpc_catalog,
  count(*) AS matching_signatures,
  coalesce(bool_and(has_function_privilege('authenticated',oid,'EXECUTE')),false) AS authenticated_execute,
  coalesce(bool_and(NOT has_function_privilege('anon',oid,'EXECUTE')),false) AS anonymous_denied
FROM rpc;