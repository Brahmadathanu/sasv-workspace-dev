-- PEC G0 postmigration contract verifier. SELECT-only and error-asserting.
-- Run on populated SASV inventory DB; makes NO data changes.
DO $verify$
DECLARE
  failed integer;
  got text;
BEGIN
  IF public.mrp_uom_factor_strict(1,2)<>1000
     OR public.mrp_uom_factor_strict(2,1)<>0.001
     OR public.mrp_uom_factor_strict(5,5)<>1 THEN
    RAISE EXCEPTION 'G0 unit conversion direct/reciprocal/identity fail';
  END IF;
  BEGIN
    PERFORM public.mrp_uom_factor_strict(1,5);
    RAISE EXCEPTION 'G0 incompatible Kg/Nos conversion unexpectedly permitted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS got=MESSAGE_TEXT;
    IF got NOT LIKE 'MRP UOM: incompatible unit dimensions%' THEN
      RAISE EXCEPTION 'G0 unexpected factor guard: %',got;
    END IF;
  END;

  SELECT count(*) INTO failed FROM public.rm_bom_line l
  JOIN public.inv_stock_item s ON s.id=l.stock_item_id
  WHERE l.stock_item_id IN (64,291,424,517)
  AND (l.uom_id<>2 OR s.default_uom_id<>2);
  IF failed<>0 THEN RAISE EXCEPTION 'G0 gram BOM/default mismatches: %',failed; END IF;

  SELECT count(*) INTO failed
  FROM public.v_mrp_procurement_plan p
  JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=p.stock_item_id
  WHERE p.month_start BETWEEN DATE '2026-11-01' AND DATE '2027-01-01'
    AND p.material_class_id=1
    AND c.subcategory_code NOT IN ('finished_bulk_material','semifinished_goods')
    AND p.uom_id<>c.default_uom_id;
  IF failed<>0 THEN RAISE EXCEPTION 'G0 external RM planned UOM mismatches: %',failed; END IF;

  SELECT count(*) INTO failed
  FROM public.v_mrp_material_gross_requirement_rm
  WHERE month_start BETWEEN DATE '2026-11-01' AND DATE '2027-01-01'
    AND gross_required_qty IS NULL;
  IF failed<>0 THEN RAISE EXCEPTION 'G0 null gross requirements: %',failed; END IF;

  IF (SELECT count(*) FROM pg_proc
     WHERE pronamespace='public'::regnamespace
       AND proname IN ('create_pr_from_mrp_plan_pec_internal',
         'proc_pr_rebuild_from_mrp_pec_internal',
         'proc_indent_create_from_pr_pec_internal',
         'proc_indent_resync_from_pr_pec_internal',
         'proc_pr_create_revision_from_active_pec_internal',
         'proc_indent_add_line_pec_internal',
         'proc_pr_add_line_pec_internal',
         'proc_pr_set_manual_delta_pec_internal')
       AND position('finished_bulk_material' IN pg_get_functiondef(oid))>0)<>8
  THEN RAISE EXCEPTION 'G0 missing one or more of eight internal-material writer guards'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc
    WHERE proname='proc_indent_resync_from_pr_pec_internal'
      AND position('SAFE preserves deliberate manually added lines'
          IN pg_get_functiondef(oid))>0)
  THEN RAISE EXCEPTION 'G0 safe resync manual preservation absent'; END IF;
  RAISE NOTICE 'PEC G0 SELECT-only postmigration assertions passed';
END $verify$;
SELECT 'PEC_G0_POSTMIGRATION_PASS' AS result;

-- ACL and RLS consistency, including an actual authenticated role conversion.
DO $access$
BEGIN
 IF NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.mrp_uom_factor_strict(bigint,bigint)'::regprocedure)
 OR has_function_privilege('anon','public.mrp_uom_factor_strict(bigint,bigint)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.mrp_uom_factor_strict(bigint,bigint)','EXECUTE')
 OR has_table_privilege('authenticated','public.inv_uom_conversion','SELECT')
 THEN RAISE EXCEPTION 'PEC G0 UOM helper access boundary incorrect'; END IF;
END $access$;

BEGIN;
SET LOCAL ROLE authenticated;
DO $auth$
BEGIN
 IF public.mrp_uom_factor_strict(1,2)<>1000
 OR public.mrp_uom_factor_strict(2,1)<>0.001
 OR public.mrp_uom_factor_strict(5,5)<>1
 THEN RAISE EXCEPTION 'PEC G0 strict conversion fails in authenticated role'; END IF;
END $auth$;
ROLLBACK;
SELECT 'PEC_G0_AUTH_UOM_HELPER_PASS' AS result;
