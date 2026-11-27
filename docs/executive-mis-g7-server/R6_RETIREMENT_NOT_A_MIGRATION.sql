-- REVIEW CANDIDATE ONLY. Not an applied migration. Do not execute before owner-approved release/retirement gate.
-- Exact PostgreSQL 17.4 production fingerprints captured 2026-11-26. Run atomically in a single transaction.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
DO $guard$
DECLARE r record; actual text;
BEGIN
  IF (SELECT count(*) FROM public.app_module_clients WHERE module_key='sales-data-viewer' AND nav_enabled) <> 0 THEN RAISE EXCEPTION 'Legacy launcher still enabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_modules WHERE module_key='sales-data-viewer' AND NOT is_active AND NOT show_in_navigation) THEN RAISE EXCEPTION 'Legacy module not retired'; END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobid=17 AND active AND command='select public.refresh_sales_monthly();') THEN RAISE EXCEPTION 'Shared refresh changed'; END IF;
  FOR r IN SELECT * FROM (VALUES
    ('v_sdv_exc_zero_sellers_3m','6e2de867688ef0fddfb773226b0e0e5b'),
    ('v_sdv_freshness','62ad3c50c4a797465359f71e692c541d'),
    ('v_sdv_rollup_month_category','b4af386bcd76a0ff8c8a23a054cf04da'),
    ('v_sdv_rollup_month_godown_group','fe427424828226a9fea1fefc0da248af'),
    ('v_sdv_rollup_month_region','4ab890e1410838fade81d45ce61c685d'),
    ('v_sdv_rollup_month_sku','c91ecf291a6fb390b3e64a1405196907')
  ) AS x(name,fingerprint) LOOP
    SELECT md5(pg_get_viewdef(to_regclass('public.'||r.name),true)) INTO actual;
    IF actual IS DISTINCT FROM r.fingerprint THEN RAISE EXCEPTION 'View definition drift: %',r.name; END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('sdv_zero_revenue_abs','ff820d95943766431cbe5b0e86670fbe'),
    ('sdv_zero_sellers_abs','31cdcecf709971554d284d7d5980527d')
  ) AS x(name,fingerprint) LOOP
    SELECT md5(pg_get_functiondef(to_regprocedure('public.'||r.name||'(date,integer,integer,integer,boolean)'))) INTO actual;
    IF actual IS DISTINCT FROM r.fingerprint THEN RAISE EXCEPTION 'RPC definition drift: %',r.name; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND p.prokind IN ('f','p') AND p.proname NOT IN ('sdv_zero_revenue_abs','sdv_zero_sellers_abs') AND p.prosrc ~* '(v_sdv_freshness|v_sdv_exc_zero_sellers_3m|v_sdv_rollup_month_(category|godown_group|region|sku)|sdv_zero_(sellers|revenue)_abs)') THEN RAISE EXCEPTION 'Unexpected surviving function reference'; END IF;
END $guard$;
DROP FUNCTION public.sdv_zero_revenue_abs(date,integer,integer,integer,boolean) RESTRICT;
DROP FUNCTION public.sdv_zero_sellers_abs(date,integer,integer,integer,boolean) RESTRICT;
DROP VIEW public.v_sdv_exc_zero_sellers_3m RESTRICT;
DROP VIEW public.v_sdv_freshness RESTRICT;
DROP VIEW public.v_sdv_rollup_month_category RESTRICT;
DROP VIEW public.v_sdv_rollup_month_godown_group RESTRICT;
DROP VIEW public.v_sdv_rollup_month_region RESTRICT;
DROP VIEW public.v_sdv_rollup_month_sku RESTRICT;
COMMIT;
