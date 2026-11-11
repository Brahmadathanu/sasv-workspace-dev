\set ON_ERROR_STOP on
\echo '== SECURITY: negative identities, input validation, privilege surface, invoker alternative, hijack =='
DO $$ DECLARE f oid := 'public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(date,integer)'::regprocedure; src text;
BEGIN
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=f) THEN RAISE EXCEPTION 'TEST FAIL definer flag'; END IF;
  IF pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid=f)) <> 'postgres' THEN RAISE EXCEPTION 'TEST FAIL owner'; END IF;
  IF has_function_privilege('anon', f,'EXECUTE') OR has_function_privilege('public'::name, f,'EXECUTE') THEN RAISE EXCEPTION 'TEST FAIL anon/PUBLIC execute'; END IF;
  IF NOT has_function_privilege('authenticated', f,'EXECUTE') THEN RAISE EXCEPTION 'TEST FAIL authenticated execute'; END IF;
  IF (SELECT proconfig FROM pg_proc WHERE oid=f) IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp'] THEN RAISE EXCEPTION 'TEST FAIL search_path'; END IF;
  SELECT prosrc INTO src FROM pg_proc WHERE oid=f;
  IF src ~* '(insert\s+into|delete\s+from|truncate|alter\s+table|drop\s+|grant\s+|revoke\s+)' THEN RAISE EXCEPTION 'TEST FAIL body contains DML/DDL'; END IF;
  IF src ~* '\mEXECUTE\M' THEN RAISE EXCEPTION 'TEST FAIL body has dynamic SQL'; END IF;
  RAISE NOTICE 'PASS  static posture: SECURITY DEFINER, owner postgres, pinned search_path, EXECUTE only authenticated, read-only body, no dynamic SQL';
END $$;
SELECT test.expect('T01 anon cannot execute', 'anon', '', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',2000)', '42501');
SELECT test.expect('T02 authenticated with NO signed-in uid', 'authenticated', '', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',2000)', 'P0001', 'Not authenticated');
SELECT test.expect('T03 ID-N style: signed in, no permission row', 'authenticated', '00000000-0000-0000-0000-0000000000ff', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',2000)', '42501');
SELECT test.expect('T04 other-module permission only', 'authenticated', '00000000-0000-0000-0000-0000000000a2', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',2000)', '42501');
SELECT test.expect('T05 can_edit without can_view', 'authenticated', '00000000-0000-0000-0000-0000000000a3', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',2000)', '42501');
SELECT test.expect('T06 explicit no permission', 'authenticated', '00000000-0000-0000-0000-0000000000a4', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',2000)', '42501');
SELECT test.expect('T07 ID-V view-only succeeds (630 rows)', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',2000)', NULL, NULL, 630);
SELECT test.expect('T08 ID-V Oct succeeds', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-10-01'',2000)', NULL, NULL, 630);
SELECT test.expect('T09 ID-V absent period returns zero rows, no error', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2025-11-01'',2000)', NULL, NULL, 0);
SELECT test.expect('T10 service_role has no uid => denied (stricter than wrapper)', 'service_role', '', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',2000)', '42501');
SELECT test.expect('T11 mid-month period rejected', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-15'',2000)', 'P0001', 'Period must be first day of month');
SELECT test.expect('T12 NULL period rejected', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(NULL,2000)', 'P0001', 'Period must be first day of month');
SELECT test.expect('T13 limit 0 rejected', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',0)', 'P0001', 'Invalid limit');
SELECT test.expect('T14 limit 2001 rejected (cap)', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',2001)', 'P0001', 'Invalid limit');
SELECT test.expect('T15 NULL limit rejected', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',NULL)', 'P0001', 'Invalid limit');
SELECT test.expect('T16 limit 5 honoured', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',5)', NULL, NULL, 5);
SELECT test.expect('T17 authenticated cannot read internal costing view', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed', '42501');
SELECT test.expect('T18 authenticated cannot read snapshot table', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM costing.cost_sheet_line_monthly_snapshot', '42501');
SELECT test.expect('T19 anon cannot read public wrapper', 'anon', '', 'SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed', '42501');
DROP FUNCTION IF EXISTS test.invoker_alt(date);
CREATE FUNCTION test.invoker_alt(p date) RETURNS SETOF costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
  SELECT * FROM costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start = p $$;
GRANT USAGE ON SCHEMA test TO authenticated; GRANT EXECUTE ON FUNCTION test.invoker_alt(date) TO authenticated;
SELECT test.expect('T20 SECURITY INVOKER variant denied for ID-V (needs USAGE on costing + SELECT on internal view)', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM test.invoker_alt(''2026-11-01'')', '42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
CREATE TEMP TABLE baseline AS SELECT md5(string_agg(t::text, '|' ORDER BY t.sku_id)) h FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000) t;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$ DECLARE h1 text; h2 text; BEGIN
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
  SELECT h INTO h1 FROM pg_temp.baseline;
  SET LOCAL ROLE authenticated;
  CREATE TEMP TABLE cost_sheet_line_monthly_snapshot (snapshot_period_start date, refresh_run_id bigint, sku_id int);
  CREATE TEMP TABLE v_current_successful_costing_refresh_run (period_start date, refresh_run_id bigint, selection_basis text);
  CREATE FUNCTION pg_temp.max(numeric) RETURNS numeric LANGUAGE sql AS $f$ SELECT 0::numeric $f$;
  SELECT md5(string_agg(t::text, '|' ORDER BY t.sku_id)) INTO h2 FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000) t;
  RESET ROLE;
  IF h1 IS DISTINCT FROM h2 THEN RAISE EXCEPTION 'TEST FAIL T21 shadow temp objects changed the result'; END IF;
  RAISE NOTICE 'PASS  T21 shadow temp tables/functions cannot alter RPC result';
END $$;
BEGIN READ ONLY;
SELECT test.expect('T22 callable inside READ ONLY transaction', 'authenticated', '00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(''2026-11-01'',2000)', NULL, NULL, 630);
COMMIT;
\echo 'SECURITY TESTS PASSED'
