-- R7 server retirement CANDIDATE (stage 1 only). NOT APPLIED. PostgreSQL 17.
-- Retires ONLY the public API view of the redundant all-scheme x all-SKU lens: public.v_costing_pricing_sku_scheme_comparison.
-- It deliberately does NOT drop costing.v_sku_scheme_comparison(_current), costing.sku_scheme_viability_snapshot, the refresh RPC
-- costing.rpc_refresh_sku_scheme_viability_snapshot, or any selected-scheme IK/OK viability path (see R6_R7_PLAN.md: stage-03 refresh,
-- scheme-master register lateral, KPI view, governed pricing/profit views all read the shared snapshot).
-- Preconditions (human): the client that removes the lens (R7 client change) is released and the old deep link has been observed to land
-- on SKU Cost Details; no installed Electron/PWA client older than that release still queries the view (stale clients get a clear
-- "relation does not exist" error, never wrong data). Rollback = re-create the view from the saved definition in the receipt table.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE IF NOT EXISTS costing_retention.retired_object_receipt (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, object_name text NOT NULL, object_kind text NOT NULL, definition text NOT NULL,
 definition_md5 text NOT NULL, acl text, retired_at timestamptz NOT NULL DEFAULT clock_timestamp(), retired_by text NOT NULL DEFAULT session_user, reason text NOT NULL);
REVOKE ALL ON costing_retention.retired_object_receipt FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE v oid:=to_regclass('public.v_costing_pricing_sku_scheme_comparison'); n int; deps text;
BEGIN
 IF v IS NULL THEN RAISE NOTICE 'R7: view already retired'; RETURN; END IF;
 -- 1. no other view/rule depends on it
 SELECT string_agg(DISTINCT r.ev_class::regclass::text,', ') INTO deps FROM pg_depend d JOIN pg_rewrite r ON r.oid=d.objid WHERE d.refobjid=v AND r.ev_class<>v;
 IF deps IS NOT NULL THEN RAISE EXCEPTION 'R7 blocked: dependent view(s): %',deps; END IF;
 -- 2. no function (public/costing) names it (comment/lineage text counts: review before retiring)
 SELECT string_agg(n.nspname||'.'||p.proname,', ') INTO deps FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','costing') AND p.prokind='f' AND pg_get_functiondef(p.oid) ~ '\mv_costing_pricing_sku_scheme_comparison\M';
 IF deps IS NOT NULL THEN RAISE EXCEPTION 'R7 blocked: function(s) reference the view: %',deps; END IF;
 -- 3. no policy/trigger/publication dependency of any other kind
 SELECT count(*) INTO n FROM pg_depend d WHERE d.refobjid=v AND d.deptype='n' AND d.classid NOT IN ('pg_rewrite'::regclass);
 IF n>0 THEN RAISE EXCEPTION 'R7 blocked: % non-view dependency/dependencies on the view',n; END IF;
 INSERT INTO costing_retention.retired_object_receipt(object_name,object_kind,definition,definition_md5,acl,reason)
  SELECT 'public.v_costing_pricing_sku_scheme_comparison','view',pg_get_viewdef(v),md5(pg_get_viewdef(v)),(SELECT relacl::text FROM pg_class WHERE oid=v),
         'R7 stage 1: all-scheme comparison lens retired from the client; selected-scheme viability untouched';
 EXECUTE 'DROP VIEW public.v_costing_pricing_sku_scheme_comparison';   -- no CASCADE: any unexpected dependent aborts the transaction
END $$;
COMMIT;
-- STAGE 2 (separate approval, NOT in this file): costing.v_sku_scheme_comparison_current / v_sku_scheme_comparison may be dropped only if the live
-- dependency scan shows no dependents other than the retired view; cost-sheet traceability functions carry the text 'costing.v_sku_scheme_comparison' as a
-- SOURCE LABEL for IK/OK pricing lines, so those labels must be re-pointed first. WRITER NARROWING (stop generating all-scheme rows) needs, on live data:
-- row-for-row parity of every selected-scheme IK/OK column consumed by v_costing_scheme_master_register, the KPI view (20261013183522), the governed
-- pricing/profit views (20261019134900 lines ~1274, 2468) and stage-03 callers (20260801180046, 20260802092737), plus FK impact (none declared on this table).
