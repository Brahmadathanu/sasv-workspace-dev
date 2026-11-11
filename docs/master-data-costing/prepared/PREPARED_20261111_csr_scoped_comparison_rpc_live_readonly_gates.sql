-- PREPARED (#273). G1-G6 and the G8 plain EXPLAIN pairs were EXECUTED READ-ONLY by the independent reviewer on 11 Nov 2026
-- (results recorded in WP05_R14); this file was not run by Claude. READ-ONLY production gates to run BEFORE any owner-approved application.
-- Catalogue reads and plain EXPLAIN only. NO "EXPLAIN ANALYZE", no function/view execution, no writes.
-- Run in a read-only session:  BEGIN READ ONLY; ...; ROLLBACK;
-- The three EXPLAIN pairs (Sep/Oct/Nov) come from:  node scripts/csr-scoped-rpc-server/gen_explain_gates.mjs
-- Also required, outside SQL: correlate the two 8.15 s requests to a PostgREST/API log line and record SQLSTATE + body
-- (HTTP 500 alone is not 57014), and record the role statement_timeout actually in force (read-only):
--   SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('anon','authenticated','authenticator','service_role');

-- G1 view contracts (expect 63adf7946b8d7f99a01a05e5e54d00be for the internal view; record the public wrapper hash)
SELECT 'internal' AS view, md5(pg_get_viewdef('costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass)) AS md5
UNION ALL SELECT 'public', md5(pg_get_viewdef('public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass));

-- G2 no pre-existing function of that name (expect 0 rows)
SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='rpc_get_cost_sheet_sku_monthly_comparison_scoped';

-- G3 permission helpers exist; capture their definitions for review (owner, SECURITY DEFINER, can_view semantics)
SELECT p.oid::regprocedure, pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.proconfig
  FROM pg_proc p WHERE p.oid IN ('public.require_permission(text,boolean)'::regprocedure, 'auth.uid()'::regprocedure);
SELECT pg_get_functiondef('public.require_permission(text,boolean)'::regprocedure);

-- G4 owners, grants and RLS on the objects the definer function will read (ownership must be postgres; record RLS state)
SELECT c.oid::regclass, pg_get_userbyid(c.relowner) AS owner, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relacl
  FROM pg_class c WHERE c.oid IN ('costing.cost_sheet_line_monthly_snapshot'::regclass,
       'costing.v_current_successful_costing_refresh_run'::regclass,
       'costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass,
       'public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass);
SELECT * FROM pg_policies WHERE schemaname='costing' AND tablename='cost_sheet_line_monthly_snapshot';

-- G4b view reloptions: is the public wrapper security_invoker? (inference in R14: it is a plain postgres-owned view)
SELECT c.oid::regclass, c.reloptions FROM pg_class c WHERE c.oid IN ('public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass,'costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass);

-- G5 column contract: exactly 63 columns on both views (expect 63, 63)
SELECT 'internal', count(*) FROM pg_attribute WHERE attrelid='costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass AND attnum>0 AND NOT attisdropped
UNION ALL SELECT 'public', count(*) FROM pg_attribute WHERE attrelid='public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass AND attnum>0 AND NOT attisdropped;

-- G6 statistics freshness (the Nov-2026 / Oct +1.7% estimate caveat): record last_autoanalyze and period MCVs
SELECT relname, last_autoanalyze, last_analyze, n_live_tup FROM pg_stat_all_tables WHERE schemaname='costing' AND relname='cost_sheet_line_monthly_snapshot';
SELECT most_common_vals FROM pg_stats WHERE schemaname='costing' AND tablename='cost_sheet_line_monthly_snapshot' AND attname='snapshot_period_start';

-- G7 governed tuples for the periods under test (small view; expect Nov run 149, Oct run 143, none for Nov 2025 at last observation)
SELECT * FROM costing.v_current_successful_costing_refresh_run WHERE period_start IN ('2026-09-01','2026-10-01','2026-11-01','2025-11-01') ORDER BY period_start;

-- G8 EXPLAIN (no ANALYZE) pairs for Sep/Oct/Nov: paste the output of gen_explain_gates.mjs here.
