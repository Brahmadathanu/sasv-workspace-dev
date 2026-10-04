-- READ ONLY independent post-operation readback; execute separately even after error/timeout.
-- Target qhmoqtxpeasamtlxaoak. No candidate call, role claim, DDL or business mutation.
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
) AS independent_restoration_readback;
