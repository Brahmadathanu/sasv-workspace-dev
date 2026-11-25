-- REVIEW ONLY. Execute immediately before the exact candidate in the same atomic install transaction, only after owner approval.
-- Fail closed on catalog drift; no global settings.
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = public, extensions;
DO $r1_guard$
DECLARE mismatch text;
BEGIN
  WITH expected(kind, identity, sha) AS (VALUES
    ('function','public.get_mis_inventory_item_page(text,text,integer,integer)','3383c460f864d40eff648b1df7d1469d434685aa70fa095b9f55a108ac16aafc'),
    ('function','public.get_mis_sales_product_page(text,integer,integer)','fac5a2ca998a11ac69bb2407ab9e6adfe16e058546836d43649c02c726034ae3'),
    ('view','public.v_mis_inventory_tab_summary','f9832eb89c6f626ab2e6c5c62aa88dc85b4169d3d6f18abfdec53a148f97734e'),
    ('view','public.v_mis_sales_tab_summary','4e4735948445b2d49dd853a1cd42d7942f326e4edf318475bc22ee7d2b1bbcff')
  ), actual AS (
    SELECT *, encode(sha256(convert_to(CASE WHEN kind='function'
      THEN pg_get_functiondef(to_regprocedure(identity))
      ELSE pg_get_viewdef(to_regclass(identity),true) END,'UTF8')),'hex') actual_sha FROM expected
  ) SELECT string_agg(identity, ', ') INTO mismatch FROM actual WHERE actual_sha IS DISTINCT FROM sha;
  IF mismatch IS NOT NULL THEN RAISE EXCEPTION 'R1 baseline drift: %', mismatch; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid IN ('public.get_mis_inventory_item_page(text,text,integer,integer)'::regprocedure,'public.get_mis_sales_product_page(text,integer,integer)'::regprocedure)
    AND (p.prosecdef OR p.provolatile <> 's' OR pg_get_userbyid(p.proowner) <> 'postgres'
    OR has_function_privilege('anon',p.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR NOT has_function_privilege('service_role',p.oid,'EXECUTE')))
    THEN RAISE EXCEPTION 'R1 RPC security drift'; END IF;
  IF EXISTS (SELECT 1 FROM pg_class c WHERE c.oid IN ('public.v_mis_inventory_tab_summary'::regclass,'public.v_mis_sales_tab_summary'::regclass)
    AND (NOT coalesce(c.reloptions @> ARRAY['security_invoker=true'],false) OR pg_get_userbyid(c.relowner) <> 'postgres'
    OR has_table_privilege('anon',c.oid,'SELECT') OR NOT has_table_privilege('authenticated',c.oid,'SELECT') OR NOT has_table_privilege('service_role',c.oid,'SELECT')))
    THEN RAISE EXCEPTION 'R1 view security drift'; END IF;
END $r1_guard$;
