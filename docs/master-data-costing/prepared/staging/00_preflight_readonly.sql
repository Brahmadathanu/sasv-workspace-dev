-- STAGING ACCEPTANCE (#273) step 0: read-only preflight. Catalogue SELECTs only; run in the STAGING database, never production.
-- psql -v confirm_not_production=1 -h <staging> -f 00_preflight_readonly.sql
-- Compare each value with the production values recorded in WP05_R14 ("Live read-only gate results"); a difference is a finding.
\if :{?confirm_not_production}
\else
  \echo 'REFUSED: pass -v confirm_not_production=1 after confirming this is the STAGING database'
  \quit
\endif
\set ON_ERROR_STOP on
BEGIN READ ONLY;
\echo '== P1 view contract (production: internal 63adf7946b8d7f99a01a05e5e54d00be, public 3382dc88e1db5589d5855ba858478c31) =='
SELECT 'internal' AS view, md5(pg_get_viewdef('costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass)) AS md5
UNION ALL SELECT 'public', md5(pg_get_viewdef('public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass));
\echo '== P2 no scoped function yet (expect 0 rows before apply; exactly 1 row after apply) =='
SELECT p.oid::regprocedure, pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.provolatile, p.proconfig
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_get_cost_sheet_sku_monthly_comparison_scoped';
\echo '== P3 permission helpers (production: postgres-owned SECURITY DEFINER; gates auth.uid() + user_permissions_canonical.can_view) =='
SELECT p.oid::regprocedure, pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.proconfig FROM pg_proc p
 WHERE p.oid IN ('public.require_permission(text,boolean)'::regprocedure, 'auth.uid()'::regprocedure);
SELECT pg_get_functiondef('public.require_permission(text,boolean)'::regprocedure);
\echo '== P4 owners, ACLs, RLS (production: snapshot table postgres-owned, RLS on, not forced, 0 policies) =='
SELECT c.oid::regclass AS rel, pg_get_userbyid(c.relowner) AS owner, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relacl, c.reloptions
  FROM pg_class c WHERE c.oid IN ('costing.cost_sheet_line_monthly_snapshot'::regclass,'costing.v_current_successful_costing_refresh_run'::regclass,
       'costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass,'public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass);
SELECT count(*) AS snapshot_policies FROM pg_policies WHERE schemaname='costing' AND tablename='cost_sheet_line_monthly_snapshot';
\echo '== P5 63 columns on both views =='
SELECT 'internal' AS v, count(*) FROM pg_attribute WHERE attrelid='costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass AND attnum>0 AND NOT attisdropped
UNION ALL SELECT 'public', count(*) FROM pg_attribute WHERE attrelid='public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass AND attnum>0 AND NOT attisdropped;
\echo '== P6 role timeouts (production: authenticated 8s, authenticator 8s, anon 3s) =='
SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('anon','authenticated','authenticator','service_role') ORDER BY 1;
\echo '== P7 statistics and size (production: ~1.46M rows; autoanalyze 2026-10-24, analyze 2026-11-05). Staging data volume must be comparable or the performance step proves nothing =='
SELECT relname, n_live_tup, last_analyze, last_autoanalyze FROM pg_stat_all_tables WHERE schemaname='costing' AND relname='cost_sheet_line_monthly_snapshot';
SELECT snapshot_period_start, count(*) FROM costing.cost_sheet_line_monthly_snapshot WHERE snapshot_period_start >= date '2026-09-01' GROUP BY 1 ORDER BY 1;
\echo '== P8 governed tuples for the test periods =='
SELECT * FROM costing.v_current_successful_costing_refresh_run WHERE period_start IN ('2026-09-01','2026-10-01','2026-11-01','2025-11-01') ORDER BY period_start;
\echo '== P9 plain EXPLAIN (no ANALYZE): paste gen_explain_gates.mjs output here for Sep/Oct/Nov and record root Total Cost =='
ROLLBACK;
