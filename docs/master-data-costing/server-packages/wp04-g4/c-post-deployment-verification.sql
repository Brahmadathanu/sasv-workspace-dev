-- WP04-G4 committed C post-deployment independent verification. READ ONLY.
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';

DO $identity$
DECLARE e jsonb; a record; acl text[];
BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"signature":"costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot)","body_md5":"fdb75ff20ffd5d37e5103dec6b407f8c","argnames":["p_sku_id","p_period_start","p_valuation_date","p_refresh_run_id","p_dl","p_poh","p_qc","p_ms","p_af","p_mk"],"default_count":0,"defaults_expression":null,"owner":"postgres","return_type":"jsonb","language":"sql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint)","body_md5":"fd3953417095e6c1045c4c508cbab777","argnames":["p_sku_ids","p_period_start","p_valuation_date","p_refresh_run_id","sku_id","evidence_envelope"],"default_count":0,"defaults_expression":null,"owner":"postgres","return_type":"record","language":"sql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":true,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":1000,"support":0,"transforms":null,"argmodes":["i","i","i","i","t","t"],"allargtypes":["bigint[]","date","date","bigint","bigint","jsonb"]},{"signature":"costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)","body_md5":"24120402765a16d9705f8937b4ae3699","argnames":["p_sku_id","p_period_start","p_valuation_date","p_refresh_run_id"],"default_count":0,"defaults_expression":null,"owner":"postgres","return_type":"jsonb","language":"sql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false","service_role:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_wp04_c_enrich(jsonb,bigint,date,date,bigint,jsonb,jsonb)","body_md5":"5174d7a97de4302b40826d207f144cce","argnames":["p_base","p_sku_id","p_period_start","p_valuation_date","p_refresh_run_id","p_shared_issues","p_run_envelope"],"default_count":0,"defaults_expression":null,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)","body_md5":"3e06daca9e83c1d3c8a2ea0a432d88c2","argnames":["p_base","p_sku_id","p_period_start","p_valuation_date","p_refresh_run_id","p_shared_issues"],"defaults_expression":null,"default_count":0,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)","body_md5":"c1f37b9477f239cf87c44901ecd3ca6e","argnames":["p_base","p_sku_id","p_period_start","p_valuation_date","p_refresh_run_id"],"defaults_expression":null,"default_count":0,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false","service_role:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb)","body_md5":"41d34c8869f2153220170cd765880d52","argnames":["p_sku_id","p_period_start","p_valuation_date","p_evidence_run_id","p_route_evidence","p_shared_issues","p_run_envelope"],"default_count":0,"defaults_expression":null,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)","body_md5":"e00e399bace53b8bd906facc754d8584","argnames":["p_sku_id","p_period_start","p_valuation_date","p_evidence_run_id","p_route_evidence","p_shared_issues"],"defaults_expression":null,"default_count":0,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=costing, public, pg_temp","acl_entries":["postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"public.rpc_get_product_sku_readiness(bigint,date,text,bigint)","body_md5":"7c54b0edc159d08647e8df73d51fbe51","argnames":["p_sku_id","p_period_start","p_context_type","p_refresh_run_id"],"defaults_expression":"''LIVE_AS_OF''::text, NULL::bigint","default_count":2,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=public, costing, pg_temp","acl_entries":["authenticated:postgres:EXECUTE:false","postgres:postgres:EXECUTE:false","service_role:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"public.rpc_get_readiness_governed_periods(date,integer)","body_md5":"671e150396f388875735e68818dcb574","argnames":["p_before_period_start","p_limit"],"defaults_expression":"NULL::date, 24","default_count":2,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=public, costing, pg_temp","acl_entries":["authenticated:postgres:EXECUTE:false","postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)","body_md5":"4ae66ab181270cfd41e16d2969d20d58","argnames":["p_product_scope","p_gap_kind","p_search","p_after_product_id","p_limit"],"defaults_expression":"''ACTIVE_PRODUCTS''::text, ''NO_SKU''::text, NULL::text, NULL::bigint, 50","default_count":5,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=public, costing, pg_temp","acl_entries":["authenticated:postgres:EXECUTE:false","postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null},{"signature":"public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)","body_md5":"cf6f5703b9d5bf1bef2c28b31cc4fe24","argnames":["p_period_start","p_population_scope","p_overall_severities","p_dependency_codes","p_owner_modules","p_route_codes","p_search","p_after_sku_id","p_limit"],"defaults_expression":"''OPERATIONAL''::text, NULL::text[], NULL::text[], NULL::text[], NULL::text[], NULL::text, NULL::bigint, 50","default_count":8,"owner":"postgres","return_type":"jsonb","language":"plpgsql","volatility":"s","security_definer":true,"strict":false,"leakproof":false,"parallel":"u","kind":"f","set_returning":false,"search_path":"search_path=public, costing, pg_temp","acl_entries":["authenticated:postgres:EXECUTE:false","postgres:postgres:EXECUTE:false"],"cost":100,"rows":0,"support":0,"transforms":null}]'::jsonb) LOOP
  SELECT p.*,l.lanname,pg_get_userbyid(p.proowner) owner_name INTO a FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure(e->>'signature');
  IF NOT FOUND THEN RAISE EXCEPTION 'C candidate missing: %',e->>'signature'; END IF;
  SELECT array_agg(coalesce(r.rolname,'PUBLIC')||':'||g.rolname||':'||x.privilege_type||':'||x.is_grantable::text ORDER BY coalesce(r.rolname,'PUBLIC'),g.rolname,x.privilege_type,x.is_grantable) INTO acl
  FROM aclexplode(coalesce(a.proacl,acldefault('f',a.proowner))) x LEFT JOIN pg_roles r ON r.oid=x.grantee JOIN pg_roles g ON g.oid=x.grantor;
  IF md5(a.prosrc) IS DISTINCT FROM e->>'body_md5' OR a.owner_name IS DISTINCT FROM e->>'owner' OR a.lanname IS DISTINCT FROM e->>'language'
  OR a.prorettype IS DISTINCT FROM to_regtype(e->>'return_type') OR to_jsonb(a.proargnames) IS DISTINCT FROM e->'argnames'
  OR a.pronargdefaults IS DISTINCT FROM (e->>'default_count')::integer OR pg_get_expr(a.proargdefaults,0) IS DISTINCT FROM e->>'defaults_expression'
  OR coalesce(to_jsonb(a.proargmodes),'null'::jsonb) IS DISTINCT FROM coalesce(e->'argmodes','null'::jsonb)
  OR (e ? 'allargtypes' AND a.proallargtypes IS DISTINCT FROM ARRAY(SELECT to_regtype(value)::oid FROM jsonb_array_elements_text(e->'allargtypes')))
  OR (NOT e ? 'allargtypes' AND a.proallargtypes IS NOT NULL)
  OR a.provariadic<>0 OR a.proretset IS DISTINCT FROM (e->>'set_returning')::boolean OR a.prokind<>'f'
  OR a.procost<>100 OR a.prorows IS DISTINCT FROM (e->>'rows')::real OR a.prosupport<>0 OR a.protrftypes IS NOT NULL
  OR a.provolatile<>'s' OR NOT a.prosecdef OR a.proisstrict OR a.proleakproof OR a.proparallel<>'u'
  OR a.proconfig IS DISTINCT FROM ARRAY[e->>'search_path']::text[] OR to_jsonb(acl) IS DISTINCT FROM e->'acl_entries'
  THEN RAISE EXCEPTION 'C candidate identity mismatch: %',e->>'signature'; END IF;
 END LOOP;
END $identity$;

DO $smoke$
DECLARE
  periods jsonb;
  gaps jsonb;
  single_read jsonb;
  portfolio jsonb;
  sev bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6',true);
  IF auth.uid() IS DISTINCT FROM 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid
     OR NOT public.app_has_permission('module:costing-control-center','view')
  THEN RAISE EXCEPTION 'WP04 deployment verification actor permission missing'; END IF;

  periods:=public.rpc_get_readiness_governed_periods(NULL,2);
  IF jsonb_typeof(periods->'rows') IS DISTINCT FROM 'array'
     OR (periods->>'returned_count')::int < 1
  THEN RAISE EXCEPTION 'WP04 governed-period smoke failed'; END IF;

  gaps:=public.rpc_get_readiness_product_gaps('ACTIVE_PRODUCTS','NO_SKU',NULL,NULL,1);
  IF jsonb_typeof(gaps->'rows') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'WP04 product-gap smoke failed'; END IF;

  single_read:=public.rpc_get_product_sku_readiness(1,'2026-09-01','LIVE_AS_OF',NULL);
  IF single_read#>>'{context,period_start}' IS DISTINCT FROM '2026-09-01'
     OR single_read#>>'{context,valuation_date}' IS DISTINCT FROM '2026-09-10'
  THEN RAISE EXCEPTION 'WP04 canonical single-read smoke failed'; END IF;

  portfolio:=public.rpc_get_product_sku_readiness_portfolio('2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,1);
  SELECT sum(value::bigint) INTO sev FROM jsonb_each_text(portfolio#>'{statistics,overall_severity_counts}');
  IF (portfolio#>>'{statistics,population_sku_count}')::bigint IS DISTINCT FROM 611
     OR (portfolio->>'matched_count')::bigint IS DISTINCT FROM 611
     OR (portfolio->>'returned_count')::int IS DISTINCT FROM 1
     OR sev IS DISTINCT FROM 611
  THEN RAISE EXCEPTION 'WP04 portfolio smoke failed'; END IF;
END $smoke$;

SELECT jsonb_build_object(
  'verification','WP04_G4_COMMITTED_C_POST_DEPLOYMENT',
  'candidate_identity','PASS',
  'governed_period_reader','PASS',
  'product_gap_reader','PASS',
  'canonical_single_read','PASS',
  'portfolio_full611_smoke','PASS',
  'native_api','DEFERRED_TO_G7',
  'performance_goal','UNMET_NON_BLOCKING',
  'business_mutation',false
) AS wp04_deployment_verification;

ROLLBACK;
