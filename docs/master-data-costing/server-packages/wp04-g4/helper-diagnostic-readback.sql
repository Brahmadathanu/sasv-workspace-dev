-- READ ONLY separate diagnostic source/state reconciliation; no measured reader invocation.
WITH base AS (
WITH expected(signature,definition_md5) AS (VALUES
 ('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)','0e966c3c1ab15d56420b234f5c2cef1f'),
 ('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)','65b40f9ac648ee077641c84eaee18497'),
 ('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)','c29e8b289304e7ece6f7affcccb6ffd8'),
 ('costing.fn_product_sku_readiness_shared_issues(date)','7467604a4929b59412181c3c7481e0e8'),
 ('costing.fn_product_process_route_readiness(date)','29835ce9be925dfe0afdea8133d8217a'),
 ('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)','68bd9325062299eb8af1291bf4d9393b')),
 source_checks AS (
 SELECT signature,md5(pg_get_functiondef(to_regprocedure(signature))) IS NOT DISTINCT FROM definition_md5 AS definition_matches FROM expected),
 original_attributes AS (
 SELECT p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,p.provolatile AS volatility,p.prosecdef AS security_definer,p.prorettype::regtype::text AS return_type,p.proconfig AS settings FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'),to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')))
SELECT jsonb_build_object(
 'original_definition_checks',(SELECT jsonb_agg(to_jsonb(s) ORDER BY signature) FROM source_checks s),
 'all_six_definitions_match',(SELECT count(*)=6 AND bool_and(definition_matches) FROM source_checks),
 'original_attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY signature) FROM original_attributes a),
 'candidate_function_count',(SELECT count(*) FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace WHERE (n.nspname='costing' AND f.proname IN ('fn_product_sku_readiness_enrich_with_shared','fn_product_sku_readiness_live_core')) OR (n.nspname='public' AND f.proname IN ('rpc_get_readiness_governed_periods','rpc_get_readiness_product_gaps','rpc_get_product_sku_readiness_portfolio'))),
 'event_md5',(SELECT md5(coalesce(jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'tags',e.evttags,'enabled',e.evtenabled,'definition_md5',md5(pg_get_functiondef(e.evtfoid))) ORDER BY e.evtname),'[]'::jsonb)::text) FROM pg_event_trigger e WHERE e.evtenabled<>'D'),
 'idle_wp04_transactions',(SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND state LIKE 'idle in transaction%' AND query ILIKE '%wp04%')
) AS independent_restoration_readback
), expected_functions(signature,definition_md5,attributes) AS (VALUES
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
), function_checks AS (
 SELECT e.signature,
  pg_catalog.md5(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(e.signature))) IS NOT DISTINCT FROM e.definition_md5 AS definition_matches,
  (SELECT pg_catalog.jsonb_build_object('volatility',f.provolatile::text,'security_definer',f.prosecdef,'owner',pg_catalog.pg_get_userbyid(f.proowner),'settings',f.proconfig,'acl',f.proacl::text)
   FROM pg_catalog.pg_proc f WHERE f.oid=pg_catalog.to_regprocedure(e.signature)) IS NOT DISTINCT FROM e.attributes AS attributes_match
 FROM expected_functions e
), expected_views(relation_name,definition_md5,options) AS (VALUES
 ('costing.v_cost_driver_policy_registry','89167868eefda59b7c3d03b63936ac0a','null'::jsonb),
 ('costing.v_regional_marketing_evidence_review_queue','8b08018061e8b800f1ea4843acad4b46','null'::jsonb),
 ('costing.v_sku_commercial_sales_basis','1327ae5236481295aff6aa27d311f440','null'::jsonb)
), view_checks AS (
 SELECT e.relation_name,
  pg_catalog.md5(pg_catalog.pg_get_viewdef(pg_catalog.to_regclass(e.relation_name),true)) IS NOT DISTINCT FROM e.definition_md5 AS definition_matches,
  (SELECT pg_catalog.to_jsonb(c.reloptions) FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass(e.relation_name)) IS NOT DISTINCT FROM NULLIF(e.options,'null'::jsonb) AS options_match
 FROM expected_views e
)
SELECT pg_catalog.jsonb_build_object('original_state',base.independent_restoration_readback,
 'all_diagnostic_functions_match',(SELECT count(*)=20 AND bool_and(definition_matches AND attributes_match) FROM function_checks),
 'all_diagnostic_views_match',(SELECT count(*)=3 AND bool_and(definition_matches AND options_match) FROM view_checks),
 'diagnostic_function_checks',(SELECT jsonb_agg(to_jsonb(f) ORDER BY signature) FROM function_checks f),
 'diagnostic_view_checks',(SELECT jsonb_agg(to_jsonb(v) ORDER BY relation_name) FROM view_checks v)
) AS diagnostic_independent_readback FROM base;
