-- LOCAL DISPOSABLE MODEL of the Supabase role/grant posture and permission helpers. Not production.
-- Models (does not copy): auth.uid() from JWT claim; public.require_permission(text,boolean) as SECURITY DEFINER owned by postgres
-- checking user_permissions_canonical.can_view (and can_edit only when requested), per CSR_THREE_PERIOD_PLANNER_VARIANCE note 5 Nov.
\set ON_ERROR_STOP on
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('CREATE ROLE %I NOLOGIN', r); END IF;
  END LOOP; END $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS public.user_permissions_canonical (user_id uuid, module_key text, can_view boolean, can_edit boolean);
TRUNCATE public.user_permissions_canonical;
INSERT INTO public.user_permissions_canonical VALUES
 ('00000000-0000-0000-0000-0000000000a1','module:costing-control-center',true,false),   -- ID-V view-only
 ('00000000-0000-0000-0000-0000000000a2','module:some-other-module',true,true),          -- other module only
 ('00000000-0000-0000-0000-0000000000a3','module:costing-control-center',false,true),    -- edit flag without view
 ('00000000-0000-0000-0000-0000000000a4','module:costing-control-center',false,false);   -- explicit none
CREATE OR REPLACE FUNCTION public.require_permission(p_module text, p_edit boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_permissions_canonical u WHERE u.user_id = auth.uid() AND u.module_key = p_module
                 AND u.can_view AND (NOT p_edit OR u.can_edit)) THEN RAISE EXCEPTION 'permission denied for module %', p_module USING ERRCODE = '42501'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.app_has_permission(p_module text, p_action text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_permissions_canonical u WHERE u.user_id = auth.uid() AND u.module_key = p_module AND u.can_view) $$;
GRANT EXECUTE ON FUNCTION public.require_permission(text,boolean), public.app_has_permission(text,text) TO authenticated, service_role;
-- Live posture per W1 migration: internal costing view service_role only; public wrapper to authenticated + service_role, not anon.
REVOKE ALL ON ALL TABLES IN SCHEMA costing FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA costing FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA costing TO service_role;
GRANT SELECT ON costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed TO service_role;
REVOKE ALL ON public.v_cost_sheet_snapshot_sku_monthly_comparison_governed FROM PUBLIC, anon;
GRANT SELECT ON public.v_cost_sheet_snapshot_sku_monthly_comparison_governed TO authenticated, service_role;
CREATE SCHEMA IF NOT EXISTS test;
-- Helper: run SQL as role/uid, require a specific outcome. Raises on any unexpected result so the runner exits non-zero.
CREATE OR REPLACE FUNCTION test.expect(p_name text, p_role text, p_uid text, p_sql text, p_sqlstate text DEFAULT NULL, p_msg_like text DEFAULT NULL, p_rows bigint DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE n bigint; st text; msg text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_uid, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    EXECUTE 'SELECT count(*) FROM (' || p_sql || ') q' INTO n;
    RESET ROLE;
    IF p_sqlstate IS NOT NULL THEN RAISE EXCEPTION 'TEST FAIL %: expected error %, got % rows', p_name, p_sqlstate, n; END IF;
    IF p_rows IS NOT NULL AND n <> p_rows THEN RAISE EXCEPTION 'TEST FAIL %: expected % rows, got %', p_name, p_rows, n; END IF;
    RAISE NOTICE 'PASS  % (% rows)', p_name, n;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS st = RETURNED_SQLSTATE, msg = MESSAGE_TEXT;
    RESET ROLE;
    IF st = 'P0001' AND msg LIKE 'TEST FAIL%' THEN RAISE; END IF;
    IF p_sqlstate IS NULL THEN RAISE EXCEPTION 'TEST FAIL %: unexpected error % %', p_name, st, msg; END IF;
    IF st <> p_sqlstate THEN RAISE EXCEPTION 'TEST FAIL %: expected SQLSTATE % got % (%)', p_name, p_sqlstate, st, msg; END IF;
    IF p_msg_like IS NOT NULL AND msg NOT LIKE p_msg_like THEN RAISE EXCEPTION 'TEST FAIL %: message % not like %', p_name, msg, p_msg_like; END IF;
    RAISE NOTICE 'PASS  % (denied %: %)', p_name, st, msg;
  END;
END $$;
