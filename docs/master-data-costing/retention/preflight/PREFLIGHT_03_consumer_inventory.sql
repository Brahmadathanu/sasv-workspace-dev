-- READ-ONLY preflight 03 (R3): every function that takes or reads a run id, flagged when it neither calls the availability
-- guard nor goes through the guarded pointer view. These are the exact consumers still to be wired (see R3_CONSUMER_AUDIT.md).
SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' fn,
  pg_get_function_identity_arguments(p.oid) ~ 'refresh_run_id|p_run\M' AS takes_run_id,
  pg_get_functiondef(p.oid) ~* 'fn_assert_run_details_available|fn_run_detail_availability' AS calls_guard,
  pg_get_functiondef(p.oid) ~* 'v_current_successful_costing_refresh_run' AS uses_pointer_view,
  pg_get_functiondef(p.oid) ~* '(costing\.)?[a-z_]*snapshot' AS reads_snapshots
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('costing','public') AND p.prokind='f' AND p.proname NOT LIKE 'fn_evidence_%'
  AND (pg_get_function_identity_arguments(p.oid) ~ 'refresh_run_id|p_run\M' AND pg_get_functiondef(p.oid) ~* 'snapshot')
ORDER BY calls_guard,uses_pointer_view,fn;
