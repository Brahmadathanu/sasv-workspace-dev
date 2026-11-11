-- STAGING ACCEPTANCE (#273): state fingerprint for the rollback drill. Read-only. Equal before apply, after apply, and after rollback
-- means the change touched no view, index, row count or statement_timeout setting (a function's presence is reported separately).
-- psql -v confirm_not_production=1 -At -h <staging> -f fingerprint.sql
\if :{?confirm_not_production}
\else
  \echo 'REFUSED: pass -v confirm_not_production=1'
  \quit
\endif
SELECT 'state_md5=' || md5(
  pg_get_viewdef('costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass) ||
  pg_get_viewdef('public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass) ||
  coalesce((SELECT string_agg(indexdef,'|' ORDER BY indexname) FROM pg_indexes WHERE schemaname='costing' AND tablename='cost_sheet_line_monthly_snapshot'),'') ||
  (SELECT count(*)::text FROM costing.cost_sheet_line_monthly_snapshot) ||
  coalesce((SELECT string_agg(rolname||'='||coalesce(rolconfig::text,''),'|' ORDER BY rolname) FROM pg_roles WHERE rolname IN ('anon','authenticated','authenticator','service_role')),''));
SELECT 'scoped_function_present=' || (count(*) > 0) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_get_cost_sheet_sku_monthly_comparison_scoped';
