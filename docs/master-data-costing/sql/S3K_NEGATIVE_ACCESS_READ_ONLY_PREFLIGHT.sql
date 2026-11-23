-- S3K STATIC & READ-ONLY NEGATIVE-ACCESS GATE
-- This source can be run on production because it contains SELECT only.
-- Do NOT turn any FAIL into a GRANT, role change, or trigger disablement.
SELECT
 CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sasv_retention_executor')
 THEN 'STAGE_ROLE_PRESENT_REVIEW_REQUIRED'
 ELSE 'PRODUCTION_NO_EXECUTOR_ROLE_PASS' END AS executor_role_gate,
 CASE WHEN to_regnamespace('costing_retention') IS NULL
 THEN 'PRODUCTION_NO_PRIVATE_RETENTION_SCHEMA_PASS'
 ELSE 'PRIVATE_SCHEMA_PRESENT_REVIEW_REQUIRED' END AS retention_schema_gate;
SELECT n.nspname||'.'||c.relname AS relation,t.tgname,t.tgenabled,
       p.proname AS function_name,
       CASE WHEN t.tgenabled='O' THEN 'ENABLED' ELSE 'REVIEW_TRIGGER' END AS gate
FROM pg_trigger t
JOIN pg_proc p ON p.oid=t.tgfoid
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal
  AND t.tgrelid IN (
    'costing.marketing_regional_sales_evidence_snapshot'::regclass,
    'costing.marketing_signed_billed_sales_evidence_snapshot'::regclass
  )
  AND p.proname IN ('fn_enforce_mutable_refresh_run_snapshot',
                   'fn_guard_designated_run_rows')
ORDER BY relation,function_name;
SELECT p.proname,pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_exec,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='costing' AND p.proname IN
('fn_enforce_mutable_refresh_run_snapshot','fn_guard_designated_run_rows')
ORDER BY p.proname;

-- AFTER staging installation, verify as DBA:
-- SELECT n.nspname,p.proname,
--   has_function_privilege('anon',p.oid,'EXECUTE'),
--   has_function_privilege('authenticated',p.oid,'EXECUTE'),
--   has_function_privilege('service_role',p.oid,'EXECUTE'),
--   has_function_privilege('sasv_retention_executor',p.oid,'EXECUTE')
-- FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='costing_retention';
--
-- Only execute staged positive and negative writer cases from a separately
-- authenticated dedicated login on an ISOLATED fixture, with a sealed and
-- independently signed 87-only authorization.
-- Non-staging database, default unsealed grants, expired approvals, fake
-- authorization flags, cancelled/designated/current runs must fail.
