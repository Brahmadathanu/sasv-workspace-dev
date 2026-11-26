\i 01_seed.sql
\i lib.sql
-- R7 stage-1 candidate against stand-in objects (live catalog is validated by the live dependency scan, not by this fixture).
CREATE SCHEMA IF NOT EXISTS costing_retention;
CREATE VIEW costing.v_sku_scheme_comparison_current AS SELECT 1 AS period_marker;
CREATE VIEW public.v_costing_pricing_sku_scheme_comparison AS SELECT * FROM costing.v_sku_scheme_comparison_current;
GRANT SELECT ON public.v_costing_pricing_sku_scheme_comparison TO authenticated;
-- blocked by a dependent view, rolled back completely
CREATE VIEW public.t_dep_view AS SELECT * FROM public.v_costing_pricing_sku_scheme_comparison;
\set ON_ERROR_STOP off
\i ../candidates/R7_retire_all_scheme_comparison_api.sql
\set ON_ERROR_STOP on
ROLLBACK;
DO $$ BEGIN ASSERT to_regclass('public.v_costing_pricing_sku_scheme_comparison') IS NOT NULL,'blocked by dependent view: nothing dropped'; END $$;
DROP VIEW public.t_dep_view;
-- blocked by a function naming it
CREATE FUNCTION public.t_uses_lens() RETURNS int LANGUAGE sql AS $$ SELECT count(*)::int FROM public.v_costing_pricing_sku_scheme_comparison $$;
\set ON_ERROR_STOP off
\i ../candidates/R7_retire_all_scheme_comparison_api.sql
\set ON_ERROR_STOP on
ROLLBACK;
DO $$ BEGIN ASSERT to_regclass('public.v_costing_pricing_sku_scheme_comparison') IS NOT NULL,'blocked by function dependency'; END $$;
DROP FUNCTION public.t_uses_lens();
-- clean: retired, definition saved, shared costing view and everything else untouched, idempotent re-run
\i ../candidates/R7_retire_all_scheme_comparison_api.sql
DO $$ BEGIN
 ASSERT to_regclass('public.v_costing_pricing_sku_scheme_comparison') IS NULL,'API view retired';
 ASSERT to_regclass('costing.v_sku_scheme_comparison_current') IS NOT NULL,'shared costing view kept';
 ASSERT (SELECT count(*) FROM costing_retention.retired_object_receipt WHERE object_name='public.v_costing_pricing_sku_scheme_comparison' AND definition LIKE '%v_sku_scheme_comparison_current%' AND acl LIKE '%authenticated%')=1,'definition and grants saved for rollback';
END $$;
\i ../candidates/R7_retire_all_scheme_comparison_api.sql
DO $$ BEGIN ASSERT (SELECT count(*) FROM costing_retention.retired_object_receipt)=1,'idempotent, no second receipt'; END $$;
SET ROLE authenticated;
DO $$ BEGIN PERFORM t.fails($q$SELECT * FROM costing_retention.retired_object_receipt$q$,'permission denied'); END $$;
RESET ROLE;
\echo PASS 15_r7_server_candidate
