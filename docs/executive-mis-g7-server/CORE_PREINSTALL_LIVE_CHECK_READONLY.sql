-- READ ONLY pre-migration verification of the governed legacy DWL editor (run against production before any core migration review).
-- Every row must be true. The core is NOT modified by PR #522; its SHA is the identity an owner sign-off is later bound to.
BEGIN READ ONLY;
SELECT 'core sha256 matches reviewed value' AS check_name,
       encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') = 'df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec' AS ok,
       encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') AS detail
  FROM pg_proc p WHERE p.proname = 'rpc_update_daily_work_log_with_packaging__core' AND p.pronamespace = 'public'::regnamespace
UNION ALL SELECT 'exactly one core overload', (SELECT count(*) FROM pg_proc WHERE proname = 'rpc_update_daily_work_log_with_packaging__core' AND pronamespace = 'public'::regnamespace) = 1, NULL
UNION ALL SELECT 'core is SECURITY DEFINER and not executable by authenticated/anon', p.prosecdef AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE') AND NOT has_function_privilege('anon', p.oid, 'EXECUTE'), NULL
  FROM pg_proc p WHERE p.proname = 'rpc_update_daily_work_log_with_packaging__core' AND p.pronamespace = 'public'::regnamespace
UNION ALL SELECT 'wrapper is SECURITY DEFINER, authenticated-callable, requires module:edit-log-entry', p.prosecdef AND has_function_privilege('authenticated', p.oid, 'EXECUTE') AND p.prosrc ILIKE '%module:edit-log-entry%', encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex')
  FROM pg_proc p WHERE p.proname = 'rpc_update_daily_work_log_with_packaging' AND p.pronamespace = 'public'::regnamespace
UNION ALL SELECT 'core deletes event_skus and packaging_events (delete/recreate workflow present)', p.prosrc ILIKE '%delete%event_skus%' AND p.prosrc ILIKE '%delete%packaging_events%', NULL
  FROM pg_proc p WHERE p.proname = 'rpc_update_daily_work_log_with_packaging__core' AND p.pronamespace = 'public'::regnamespace
UNION ALL SELECT 'core not yet migrated (no S5 primitive calls)', p.prosrc NOT ILIKE '%mis_g7_chain_replace%', NULL
  FROM pg_proc p WHERE p.proname = 'rpc_update_daily_work_log_with_packaging__core' AND p.pronamespace = 'public'::regnamespace;
-- Capture (outside this file): full pg_get_functiondef of the wrapper and core, ACLs, owner, and the sku_breakdown format actually parsed.
COMMIT;
