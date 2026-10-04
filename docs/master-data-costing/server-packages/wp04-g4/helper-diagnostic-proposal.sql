-- FROZEN PROPOSAL ONLY / NOT AUTHORIZED / NOT RUN.
-- Target qhmoqtxpeasamtlxaoak; main e421fe8df9b98b4956acdcd4cadeb36a3f9b923c.
-- Exactly one authorized execution would measure eight existing-reader query wrappers once each.
-- No candidate definitions, portfolio/canonical readiness calls, data/fixture/Auth writers or deployment.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
SET LOCAL idle_in_transaction_session_timeout='30s';
DO $environment$
BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')<>'170004'
  OR current_setting('transaction_read_only')<>'on' OR current_setting('transaction_isolation')<>'repeatable read' THEN
  RAISE EXCEPTION 'Diagnostic owner/version/read-only observation mismatch';
 END IF;
END $environment$;
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected apply owner'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=public, costing, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=costing, public, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')))) IS DISTINCT FROM '0e966c3c1ab15d56420b234f5c2cef1f' THEN RAISE EXCEPTION 'Source definition drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')))) IS DISTINCT FROM '65b40f9ac648ee077641c84eaee18497' THEN RAISE EXCEPTION 'Source definition drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)')))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_shared_issues(date)')))) IS DISTINCT FROM '7467604a4929b59412181c3c7481e0e8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_process_route_readiness(date)')))) IS DISTINCT FROM '29835ce9be925dfe0afdea8133d8217a' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)')))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_enrich_with_shared') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_enrich_with_shared'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_live_core') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_live_core'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_governed_periods') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_governed_periods'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_product_gaps') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_product_gaps'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_product_sku_readiness_portfolio') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_product_sku_readiness_portfolio'; END IF;
END $guard$;
DO $events$
BEGIN
 IF (SELECT md5(coalesce(jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'tags',e.evttags,'enabled',e.evtenabled,'definition_md5',md5(pg_get_functiondef(e.evtfoid))) ORDER BY e.evtname),'[]'::jsonb)::text) FROM pg_event_trigger e WHERE e.evtenabled<>'D') IS DISTINCT FROM '4e2c16f8333e51161dc11c5376fb3296' THEN RAISE EXCEPTION 'Reviewed DDL event-trigger state drifted'; END IF;
END $events$;
DO $dependencies$
DECLARE e record; a jsonb;
BEGIN
 FOR e IN SELECT * FROM (VALUES
 ('costing.fn_effective_product_process_route_steps(bigint)','0968054cfb097874f54239c1c2ce3ab5','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"}'::jsonb),
 ('costing.fn_product_process_route_readiness(date)','29835ce9be925dfe0afdea8133d8217a','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)','c29e8b289304e7ece6f7affcccb6ffd8','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_product_sku_readiness_shared_issues(date)','7467604a4929b59412181c3c7481e0e8','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_regional_marketing_evidence_fingerprint(bigint,bigint,text,date,text,numeric,numeric,bigint,bigint,text,text,numeric,numeric)','efb984d40c84f26e8c19f1a82200e1ec','{"volatility":"i","security_definer":false,"owner":"postgres","settings":null,"acl":null}'::jsonb),
 ('costing.fn_regional_marketing_review_status(bigint)','a71c4c83b458d6a715afcb6852f5cb86','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":null}'::jsonb),
 ('costing.fn_resolve_direct_labour_workload_policy(date)','d48eac98fe033115d5735b37adbfa8d4','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_effective_product_process_route(integer,date)','3c5a292804748daf679605382e1691fb','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_effective_route_family_route(integer,date)','39f8f62fc99b856ee2e8be443e735be7','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_marketing_allocation_policy(date)','989aa9b16d7381cd035390b78a1c7e95','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_materials_stores_workload_policy(date)','f1f989960e838141786db38b018eb51c','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_production_overhead_workload_policy(date)','2b0773e1e686a5a6a4eacfe3c14da56d','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_qc_workload_policy(date)','a276ecef7b4cd99002fd886abbe63141','{"volatility":"v","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_route_family_for_product(integer,date)','641fd0f7eb7438eed53c1c6170deb0ec','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_sales_allocation_default_policy_as_of(text,date)','425596466bb9da9dadfc391f96350566','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)','68bd9325062299eb8af1291bf4d9393b','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_sku_sales_assumption_as_of(date,bigint,date)','b216b4dfdf3fbe3e7b837ceb3ee550f4','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"}'::jsonb),
 ('costing.fn_validate_effective_product_process_route(integer,date)','a9396f97a23cba5bbaceada07bc6448a','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_validate_product_process_route(bigint)','cc6cef1fac171ce812c9dd6702e4efbc','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"}'::jsonb),
 ('costing.fn_validate_route_family_route(bigint)','09cd3572e36000095b8b1eb1833491c8','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"}'::jsonb)
 ) q(signature,definition_md5,attributes) LOOP
  SELECT pg_catalog.jsonb_build_object('volatility',f.provolatile::text,'security_definer',f.prosecdef,
   'owner',pg_catalog.pg_get_userbyid(f.proowner),'settings',f.proconfig,'acl',f.proacl::text)
  INTO a FROM pg_catalog.pg_proc f WHERE f.oid=pg_catalog.to_regprocedure(e.signature);
  IF a IS DISTINCT FROM e.attributes OR pg_catalog.md5(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(e.signature))) IS DISTINCT FROM e.definition_md5 THEN
   RAISE EXCEPTION 'Diagnostic source/attributes drift: %',e.signature;
  END IF;
 END LOOP;
 FOR e IN SELECT * FROM (VALUES
 ('costing.v_cost_driver_policy_registry','89167868eefda59b7c3d03b63936ac0a','null'::jsonb),
 ('costing.v_regional_marketing_evidence_review_queue','8b08018061e8b800f1ea4843acad4b46','null'::jsonb),
 ('costing.v_sku_commercial_sales_basis','1327ae5236481295aff6aa27d311f440','null'::jsonb)
 ) q(relation_name,definition_md5,options) LOOP
  IF pg_catalog.md5(pg_catalog.pg_get_viewdef(pg_catalog.to_regclass(e.relation_name),true)) IS DISTINCT FROM e.definition_md5
   OR (SELECT pg_catalog.to_jsonb(c.reloptions) FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass(e.relation_name)) IS DISTINCT FROM NULLIF(e.options,'null'::jsonb) THEN
   RAISE EXCEPTION 'Diagnostic view drift: %',e.relation_name;
  END IF;
 END LOOP;
END $dependencies$;
DO $context$
DECLARE n bigint; h text; latest_run bigint;
BEGIN
 IF (SELECT valuation_date FROM costing.cost_periods WHERE period_start='2026-09-01') IS DISTINCT FROM '2026-09-10'::date THEN
  RAISE EXCEPTION 'Diagnostic governed context drift';
 END IF;
 SELECT id INTO latest_run FROM costing.costing_refresh_run WHERE period_start='2026-09-01' AND valuation_date='2026-09-10' AND overall_status='SUCCESS'
 ORDER BY finished_at DESC NULLS LAST,id DESC LIMIT 1;
 IF latest_run IS DISTINCT FROM 115::bigint THEN RAISE EXCEPTION 'Diagnostic SUCCESS run drift'; END IF;
 SELECT count(*),md5(coalesce(jsonb_agg(jsonb_build_array(s.id,s.product_id) ORDER BY s.id),'[]'::jsonb)::text) INTO n,h
 FROM public.product_skus s JOIN public.products p ON p.id=s.product_id WHERE p.status='Active' AND s.is_active AND NOT coalesce(s.is_sample,false);
 IF n IS DISTINCT FROM 611::bigint OR h IS DISTINCT FROM 'eeba4bf20f54589fe5b037173a79ed82' THEN RAISE EXCEPTION 'Diagnostic operational membership drift'; END IF;
 IF (SELECT count(*) FROM (VALUES (1::bigint,1::bigint,true,false,'Active'::text),(11::bigint,14::bigint,true,false,'Active'::text),(1795::bigint,794::bigint,false,true,'Inactive'::text)) e(sku_id,product_id,is_active,is_sample,product_status)
 JOIN public.product_skus s ON s.id=e.sku_id JOIN public.products p ON p.id=s.product_id
 WHERE s.product_id IS NOT DISTINCT FROM e.product_id AND s.is_active IS NOT DISTINCT FROM e.is_active
 AND s.is_sample IS NOT DISTINCT FROM e.is_sample AND p.status IS NOT DISTINCT FROM e.product_status)<>3 THEN
  RAISE EXCEPTION 'Diagnostic sample membership/lifecycle drift';
 END IF;
END $context$;
DO $diagnostic$
DECLARE
 queries constant text[]:=ARRAY[
 'EXPLAIN (ANALYZE TRUE,BUFFERS TRUE,TIMING FALSE,SUMMARY TRUE,VERBOSE FALSE,FORMAT JSON) WITH route_rows AS MATERIALIZED (SELECT * FROM costing.fn_product_process_route_readiness(''2026-09-10''::date)) SELECT count(*),count(DISTINCT product_id),jsonb_object_agg(product_id::text,to_jsonb(r)) FROM route_rows r',
 'EXPLAIN (ANALYZE TRUE,BUFFERS TRUE,TIMING FALSE,SUMMARY TRUE,VERBOSE FALSE,FORMAT JSON) WITH evidence AS MATERIALIZED (SELECT costing.fn_product_sku_readiness_shared_issues(''2026-09-10''::date) AS payload) SELECT payload FROM evidence',
 'EXPLAIN (ANALYZE TRUE,BUFFERS TRUE,TIMING FALSE,SUMMARY TRUE,VERBOSE FALSE,FORMAT JSON) WITH evidence AS MATERIALIZED (SELECT costing.fn_product_sku_readiness_run_evidence(1::bigint,''2026-09-01''::date,''2026-09-10''::date,115::bigint) AS payload) SELECT payload FROM evidence',
 'EXPLAIN (ANALYZE TRUE,BUFFERS TRUE,TIMING FALSE,SUMMARY TRUE,VERBOSE FALSE,FORMAT JSON) SELECT * FROM costing.fn_resolve_sku_commercial_sales_basis_point(1::bigint,''2026-09-01''::date,''2026-09-10''::date) LIMIT 1',
 'EXPLAIN (ANALYZE TRUE,BUFFERS TRUE,TIMING FALSE,SUMMARY TRUE,VERBOSE FALSE,FORMAT JSON) WITH evidence AS MATERIALIZED (SELECT costing.fn_product_sku_readiness_run_evidence(11::bigint,''2026-09-01''::date,''2026-09-10''::date,115::bigint) AS payload) SELECT payload FROM evidence',
 'EXPLAIN (ANALYZE TRUE,BUFFERS TRUE,TIMING FALSE,SUMMARY TRUE,VERBOSE FALSE,FORMAT JSON) SELECT * FROM costing.fn_resolve_sku_commercial_sales_basis_point(11::bigint,''2026-09-01''::date,''2026-09-10''::date) LIMIT 1',
 'EXPLAIN (ANALYZE TRUE,BUFFERS TRUE,TIMING FALSE,SUMMARY TRUE,VERBOSE FALSE,FORMAT JSON) WITH evidence AS MATERIALIZED (SELECT costing.fn_product_sku_readiness_run_evidence(1795::bigint,''2026-09-01''::date,''2026-09-10''::date,115::bigint) AS payload) SELECT payload FROM evidence',
 'EXPLAIN (ANALYZE TRUE,BUFFERS TRUE,TIMING FALSE,SUMMARY TRUE,VERBOSE FALSE,FORMAT JSON) SELECT * FROM costing.fn_resolve_sku_commercial_sales_basis_point(1795::bigint,''2026-09-01''::date,''2026-09-10''::date) LIMIT 1'
]::text[];
 labels constant text[]:=ARRAY['ROUTE_FULL_MAP','SHARED_ISSUES','RUN_EVIDENCE','COMMERCIAL_POINT_LIMIT1','RUN_EVIDENCE','COMMERCIAL_POINT_LIMIT1','RUN_EVIDENCE','COMMERCIAL_POINT_LIMIT1']::text[];
 skus constant bigint[]:=ARRAY[NULL,NULL,1,1,11,11,1795,1795]::bigint[];
 i integer; explained json; doc jsonb; root jsonb; measurements jsonb:='[]'::jsonb;
 node_count bigint; scan_count bigint; scan_metadata jsonb; k text;
 numeric_fields constant text[]:=ARRAY['Actual Rows','Actual Loops','Shared Hit Blocks','Shared Read Blocks','Shared Dirtied Blocks','Shared Written Blocks','Local Hit Blocks','Local Read Blocks','Local Dirtied Blocks','Local Written Blocks','Temp Read Blocks','Temp Written Blocks']::text[];
 root_metrics jsonb;
BEGIN
 IF cardinality(queries)<>8 OR cardinality(labels)<>8 OR cardinality(skus)<>8 THEN RAISE EXCEPTION 'Diagnostic frozen measurement coverage mismatch'; END IF;
 FOR i IN 1..8 LOOP
  -- Only these frozen EXPLAIN ANALYZE SELECT strings are executable; no input interpolation.
  EXECUTE queries[i] INTO explained;
  doc:=explained::jsonb;
  IF jsonb_typeof(doc) IS DISTINCT FROM 'array' OR jsonb_array_length(doc)<>1 THEN RAISE EXCEPTION 'Unexpected diagnostic plan shape'; END IF;
  doc:=doc->0; root:=doc->'Plan';
  IF jsonb_typeof(root) IS DISTINCT FROM 'object' OR jsonb_typeof(doc->'Execution Time') IS DISTINCT FROM 'number'
   OR jsonb_typeof(doc->'Planning Time') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Missing numeric diagnostic summary'; END IF;
  root_metrics:='{}'::jsonb;
  FOREACH k IN ARRAY numeric_fields LOOP
   IF root ? k THEN
    IF jsonb_typeof(root->k) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Non-numeric diagnostic counter'; END IF;
    root_metrics:=root_metrics||jsonb_build_object(k,root->k);
   END IF;
  END LOOP;
  WITH RECURSIVE nodes(node) AS (
   SELECT root UNION ALL
   SELECT c.value FROM nodes n CROSS JOIN LATERAL jsonb_array_elements(coalesce(n.node->'Plans','[]'::jsonb)) c(value)
  )
  SELECT count(*),count(*) FILTER(WHERE node->>'Node Type'='Function Scan'),
   coalesce(jsonb_agg(jsonb_build_object('actual_rows',node->'Actual Rows','actual_loops',node->'Actual Loops')) FILTER(WHERE node->>'Node Type'='Function Scan'),'[]'::jsonb)
  INTO node_count,scan_count,scan_metadata FROM nodes;
  measurements:=measurements||jsonb_build_array(jsonb_build_object(
   'measurement_id',i,'path',labels[i],'sku_id',skus[i],
   'execution_ms',doc->'Execution Time','planning_ms',doc->'Planning Time',
   'root_counters',root_metrics,'plan_node_count',node_count,'function_scan_count',scan_count,
   'function_scan_rows_loops',scan_metadata));
 END LOOP;
 IF jsonb_array_length(measurements)<>8 THEN RAISE EXCEPTION 'Incomplete diagnostic coverage'; END IF;
 -- Transaction-local result transport only; resets at ROLLBACK. No persistent configuration or business writer.
 PERFORM set_config('wp04.helper_diagnostic_result',jsonb_build_object(
  'operation','WP04_G4_EXISTING_HELPER_READ_ONLY_DIAGNOSTIC','measurement_count',8,
  'measurements',measurements,'portfolio_invocations',0,'canonical_readiness_invocations',0,
  'candidate_definitions',0,'native_api','NOT_RUN','full_g4','INCOMPLETE',
  'attribution_scope','REPRESENTATIVE_EXISTING_HELPER_WRAPPERS_NOT_PORTFOLIO_PHASES',
  'retry','NONE','deployment','NOT_AUTHORIZED')::text,true);
END $diagnostic$;
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected apply owner'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=public, costing, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=costing, public, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')))) IS DISTINCT FROM '0e966c3c1ab15d56420b234f5c2cef1f' THEN RAISE EXCEPTION 'Source definition drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')))) IS DISTINCT FROM '65b40f9ac648ee077641c84eaee18497' THEN RAISE EXCEPTION 'Source definition drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)')))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_shared_issues(date)')))) IS DISTINCT FROM '7467604a4929b59412181c3c7481e0e8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_process_route_readiness(date)')))) IS DISTINCT FROM '29835ce9be925dfe0afdea8133d8217a' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)')))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_enrich_with_shared') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_enrich_with_shared'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_live_core') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_live_core'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_governed_periods') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_governed_periods'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_product_gaps') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_product_gaps'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_product_sku_readiness_portfolio') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_product_sku_readiness_portfolio'; END IF;
END $guard$;
DO $events$
BEGIN
 IF (SELECT md5(coalesce(jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'tags',e.evttags,'enabled',e.evtenabled,'definition_md5',md5(pg_get_functiondef(e.evtfoid))) ORDER BY e.evtname),'[]'::jsonb)::text) FROM pg_event_trigger e WHERE e.evtenabled<>'D') IS DISTINCT FROM '4e2c16f8333e51161dc11c5376fb3296' THEN RAISE EXCEPTION 'Reviewed DDL event-trigger state drifted'; END IF;
END $events$;
DO $dependencies$
DECLARE e record; a jsonb;
BEGIN
 FOR e IN SELECT * FROM (VALUES
 ('costing.fn_effective_product_process_route_steps(bigint)','0968054cfb097874f54239c1c2ce3ab5','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"}'::jsonb),
 ('costing.fn_product_process_route_readiness(date)','29835ce9be925dfe0afdea8133d8217a','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)','c29e8b289304e7ece6f7affcccb6ffd8','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_product_sku_readiness_shared_issues(date)','7467604a4929b59412181c3c7481e0e8','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_regional_marketing_evidence_fingerprint(bigint,bigint,text,date,text,numeric,numeric,bigint,bigint,text,text,numeric,numeric)','efb984d40c84f26e8c19f1a82200e1ec','{"volatility":"i","security_definer":false,"owner":"postgres","settings":null,"acl":null}'::jsonb),
 ('costing.fn_regional_marketing_review_status(bigint)','a71c4c83b458d6a715afcb6852f5cb86','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":null}'::jsonb),
 ('costing.fn_resolve_direct_labour_workload_policy(date)','d48eac98fe033115d5735b37adbfa8d4','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_effective_product_process_route(integer,date)','3c5a292804748daf679605382e1691fb','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_effective_route_family_route(integer,date)','39f8f62fc99b856ee2e8be443e735be7','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_marketing_allocation_policy(date)','989aa9b16d7381cd035390b78a1c7e95','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_materials_stores_workload_policy(date)','f1f989960e838141786db38b018eb51c','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_production_overhead_workload_policy(date)','2b0773e1e686a5a6a4eacfe3c14da56d','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_qc_workload_policy(date)','a276ecef7b4cd99002fd886abbe63141','{"volatility":"v","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_route_family_for_product(integer,date)','641fd0f7eb7438eed53c1c6170deb0ec','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_sales_allocation_default_policy_as_of(text,date)','425596466bb9da9dadfc391f96350566','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)','68bd9325062299eb8af1291bf4d9393b','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres}"}'::jsonb),
 ('costing.fn_resolve_sku_sales_assumption_as_of(date,bigint,date)','b216b4dfdf3fbe3e7b837ceb3ee550f4','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"}'::jsonb),
 ('costing.fn_validate_effective_product_process_route(integer,date)','a9396f97a23cba5bbaceada07bc6448a','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres}"}'::jsonb),
 ('costing.fn_validate_product_process_route(bigint)','cc6cef1fac171ce812c9dd6702e4efbc','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"}'::jsonb),
 ('costing.fn_validate_route_family_route(bigint)','09cd3572e36000095b8b1eb1833491c8','{"volatility":"s","security_definer":true,"owner":"postgres","settings":["search_path=costing, public, pg_temp"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"}'::jsonb)
 ) q(signature,definition_md5,attributes) LOOP
  SELECT pg_catalog.jsonb_build_object('volatility',f.provolatile::text,'security_definer',f.prosecdef,
   'owner',pg_catalog.pg_get_userbyid(f.proowner),'settings',f.proconfig,'acl',f.proacl::text)
  INTO a FROM pg_catalog.pg_proc f WHERE f.oid=pg_catalog.to_regprocedure(e.signature);
  IF a IS DISTINCT FROM e.attributes OR pg_catalog.md5(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(e.signature))) IS DISTINCT FROM e.definition_md5 THEN
   RAISE EXCEPTION 'Diagnostic source/attributes drift: %',e.signature;
  END IF;
 END LOOP;
 FOR e IN SELECT * FROM (VALUES
 ('costing.v_cost_driver_policy_registry','89167868eefda59b7c3d03b63936ac0a','null'::jsonb),
 ('costing.v_regional_marketing_evidence_review_queue','8b08018061e8b800f1ea4843acad4b46','null'::jsonb),
 ('costing.v_sku_commercial_sales_basis','1327ae5236481295aff6aa27d311f440','null'::jsonb)
 ) q(relation_name,definition_md5,options) LOOP
  IF pg_catalog.md5(pg_catalog.pg_get_viewdef(pg_catalog.to_regclass(e.relation_name),true)) IS DISTINCT FROM e.definition_md5
   OR (SELECT pg_catalog.to_jsonb(c.reloptions) FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass(e.relation_name)) IS DISTINCT FROM NULLIF(e.options,'null'::jsonb) THEN
   RAISE EXCEPTION 'Diagnostic view drift: %',e.relation_name;
  END IF;
 END LOOP;
END $dependencies$;
SELECT current_setting('wp04.helper_diagnostic_result')::jsonb AS bounded_helper_diagnostic_result;
ROLLBACK;
