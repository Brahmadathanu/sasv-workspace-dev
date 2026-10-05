-- WP04-G4 independent readback completion. READ ONLY. NO V3 REPLAY.
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';

WITH expected_defs(signature,definition_md5) AS (
  VALUES
  ('costing.fn_effective_product_process_route_steps(bigint)','0968054cfb097874f54239c1c2ce3ab5'),
  ('costing.fn_product_process_route_readiness(date)','29835ce9be925dfe0afdea8133d8217a'),
  ('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)','65b40f9ac648ee077641c84eaee18497'),
  ('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)','c29e8b289304e7ece6f7affcccb6ffd8'),
  ('costing.fn_product_sku_readiness_shared_issues(date)','7467604a4929b59412181c3c7481e0e8'),
  ('costing.fn_regional_marketing_evidence_fingerprint(bigint,bigint,text,date,text,numeric,numeric,bigint,bigint,text,text,numeric,numeric)','efb984d40c84f26e8c19f1a82200e1ec'),
  ('costing.fn_regional_marketing_review_status(bigint)','a71c4c83b458d6a715afcb6852f5cb86'),
  ('costing.fn_resolve_direct_labour_workload_policy(date)','d48eac98fe033115d5735b37adbfa8d4'),
  ('costing.fn_resolve_effective_product_process_route(integer,date)','3c5a292804748daf679605382e1691fb'),
  ('costing.fn_resolve_effective_route_family_route(integer,date)','39f8f62fc99b856ee2e8be443e735be7'),
  ('costing.fn_resolve_marketing_allocation_policy(date)','989aa9b16d7381cd035390b78a1c7e95'),
  ('costing.fn_resolve_materials_stores_workload_policy(date)','f1f989960e838141786db38b018eb51c'),
  ('costing.fn_resolve_production_overhead_workload_policy(date)','2b0773e1e686a5a6a4eacfe3c14da56d'),
  ('costing.fn_resolve_qc_workload_policy(date)','a276ecef7b4cd99002fd886abbe63141'),
  ('costing.fn_resolve_route_family_for_product(integer,date)','641fd0f7eb7438eed53c1c6170deb0ec'),
  ('costing.fn_resolve_sales_allocation_default_policy_as_of(text,date)','425596466bb9da9dadfc391f96350566'),
  ('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)','68bd9325062299eb8af1291bf4d9393b'),
  ('costing.fn_resolve_sku_sales_assumption_as_of(date,bigint,date)','b216b4dfdf3fbe3e7b837ceb3ee550f4'),
  ('costing.fn_validate_effective_product_process_route(integer,date)','a9396f97a23cba5bbaceada07bc6448a'),
  ('costing.fn_validate_product_process_route(bigint)','cc6cef1fac171ce812c9dd6702e4efbc'),
  ('costing.fn_validate_route_family_route(bigint)','09cd3572e36000095b8b1eb1833491c8'),
  ('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)','0e966c3c1ab15d56420b234f5c2cef1f')
),
def_checks AS (
  SELECT signature,
         to_regprocedure(signature) IS NOT NULL
         AND md5(pg_get_functiondef(to_regprocedure(signature))) IS NOT DISTINCT FROM definition_md5 AS matches
  FROM expected_defs
),
candidates(schema_name,function_name) AS (
  VALUES
  ('costing','fn_wp04_c_run_assemble'),
  ('costing','fn_wp04_c_run_cohort'),
  ('costing','fn_wp04_c_enrich'),
  ('costing','fn_product_sku_readiness_enrich_with_shared'),
  ('costing','fn_wp04_c_live_core'),
  ('costing','fn_product_sku_readiness_live_core'),
  ('public','rpc_get_readiness_governed_periods'),
  ('public','rpc_get_readiness_product_gaps'),
  ('public','rpc_get_product_sku_readiness_portfolio')
),
attrs AS (
  SELECT p.oid::regprocedure::text signature,
         pg_get_userbyid(p.proowner) owner,
         p.proacl::text acl,
         p.proconfig settings
  FROM pg_proc p
  WHERE p.oid=ANY(ARRAY[
    to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'),
    to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'),
    to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)')
  ]::oid[])
),
checks AS (
  SELECT
    current_database()='postgres' AS database_ok,
    current_user='postgres' AS owner_context_ok,
    ((SELECT count(*) FROM def_checks)=22 AND (SELECT bool_and(matches) FROM def_checks)) AS all_22_definitions_match,
    NOT EXISTS(SELECT 1 FROM def_checks WHERE NOT matches) AS no_definition_mismatch,
    (
      SELECT count(*)=3
      AND bool_and(
        owner='postgres'
        AND (
          (signature='rpc_get_product_sku_readiness(bigint,date,text,bigint)'
            AND acl='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
            AND settings=ARRAY['search_path=public, costing, pg_temp'])
          OR
          (signature IN (
             'costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)',
             'costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)'
           )
            AND acl='{postgres=X/postgres,service_role=X/postgres}'
            AND settings=ARRAY['search_path=costing, public, pg_temp'])
        )
      )
      FROM attrs
    ) AS attributes_match,
    (
      SELECT count(*)=0
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      JOIN candidates c ON c.schema_name=n.nspname AND c.function_name=p.proname
    ) AS candidates_absent,
    (
      SELECT md5(coalesce(jsonb_agg(jsonb_build_object(
        'name',e.evtname,'event',e.evtevent,'tags',e.evttags,'enabled',e.evtenabled,
        'definition_md5',md5(pg_get_functiondef(e.evtfoid))
      ) ORDER BY e.evtname),'[]'::jsonb)::text)
      FROM pg_event_trigger e
      WHERE e.evtenabled<>'D'
    )='4e2c16f8333e51161dc11c5376fb3296' AS event_fingerprint_match,
    (
      SELECT md5(jsonb_agg(jsonb_build_object(
        'table',t.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),
        'not_null',a.attnotnull
      ) ORDER BY t.relname,a.attnum)::text)
      FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
      WHERE n.nspname='costing'
        AND t.relname=ANY(ARRAY[
          'sku_direct_labour_allocation_snapshot',
          'sku_production_overhead_allocation_snapshot',
          'sku_qc_allocation_snapshot',
          'sku_materials_stores_allocation_snapshot',
          'sku_admin_finance_overhead_allocation_snapshot',
          'sku_marketing_expense_allocation_snapshot'
        ]::text[])
    )='55ef5d9edd5c729b2f2fc0928afefe8e' AS columns_match,
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'signature',p.oid::regprocedure::text,
        'definition_md5',md5(pg_get_functiondef(p.oid))
      ) ORDER BY p.oid::regprocedure::text),'[]'::jsonb)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname IN ('public','costing')
        AND p.prokind='f'
        AND p.prosrc LIKE '%fn_product_sku_readiness_run_evidence%'
    )='[{"signature":"costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)","definition_md5":"65b40f9ac648ee077641c84eaee18497"}]'::jsonb AS textual_callers_match,
    (
      SELECT count(*)=0
      FROM pg_stat_activity
      WHERE pid<>pg_backend_pid()
        AND state LIKE 'idle in transaction%'
        AND query ILIKE '%wp04%'
    ) AS no_idle_wp04_transactions
)
SELECT jsonb_build_object(
  'readback_kind','WP04_G4_READBACK_ONLY_COMPLETION',
  'database_ok',database_ok,
  'owner_context_ok',owner_context_ok,
  'all_22_definitions_match',all_22_definitions_match,
  'no_definition_mismatch',no_definition_mismatch,
  'attributes_match',attributes_match,
  'candidates_absent',candidates_absent,
  'event_fingerprint_match',event_fingerprint_match,
  'columns_match',columns_match,
  'textual_callers_match',textual_callers_match,
  'no_idle_wp04_transactions',no_idle_wp04_transactions,
  'overall_pass',database_ok AND owner_context_ok AND all_22_definitions_match
    AND no_definition_mismatch AND attributes_match AND candidates_absent
    AND event_fingerprint_match AND columns_match AND textual_callers_match
    AND no_idle_wp04_transactions,
  'mutation_performed',false,
  'v3_replayed',false,
  'portfolio_invoked',false
) AS readback_completion
FROM checks;
ROLLBACK;
