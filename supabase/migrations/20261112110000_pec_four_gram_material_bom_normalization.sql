-- PEC G0: exact four-item Gram standardization, safe on already-corrected live DB.
-- Fresh environments: apply strictly verified Kg->g (quantity x1000).
-- Production was corrected on 2026-11-12; this migration is idempotent ONLY
-- where every line is in the exact old or exact corrected state.
DO $g$
DECLARE
 v_kg bigint;
 v_g bigint;
 v_match integer;
 v_changed integer;
 v_master_changed integer;
BEGIN
 SELECT id INTO STRICT v_kg FROM public.inv_uom WHERE code='Kg' AND dimension_id=1;
 SELECT id INTO STRICT v_g FROM public.inv_uom WHERE code='g' AND dimension_id=1;
 IF NOT EXISTS (SELECT 1 FROM public.inv_uom_conversion
    WHERE from_uom_id=v_kg AND to_uom_id=v_g AND factor=1000 AND dimension_id=1)
 THEN RAISE EXCEPTION 'PEC g normalization: governed Kg→g factor absent'; END IF;

 CREATE TEMP TABLE _pec_g_expected(id bigint PRIMARY KEY,stock_item_id bigint,old_qty numeric)
 ON COMMIT DROP;
 INSERT INTO _pec_g_expected VALUES
 (5394,64,0.010),(9717,424,0.075),
 (3769,517,0.050),(5405,517,0.025),(5714,517,0.150),
 (6586,517,0.050),(7048,517,0.100),(7777,517,0.240),
 (8104,517,0.010),(9183,517,0.001),(9718,517,0.075),
 (10000,517,0.100),(10749,517,0.005);

 SELECT count(*) INTO v_match
 FROM _pec_g_expected e JOIN public.rm_bom_line l
 ON l.id=e.id AND l.stock_item_id=e.stock_item_id
 WHERE (l.uom_id=v_kg AND l.qty_per_reference_output=e.old_qty)
    OR (l.uom_id=v_g AND l.qty_per_reference_output=e.old_qty*1000);
 IF v_match<>13 THEN
  RAISE EXCEPTION 'PEC g normalization: 13 exact old/new BOM states expected, found %',v_match;
 END IF;

 -- Each of the four stock masters must be in precisely the old Kg state
 -- or already in the corrected g state. Reject missing/unexpected states.
 IF (SELECT count(*) FROM public.inv_stock_item i
     WHERE i.id IN (64,291,424,517)
       AND i.default_uom_id IN (v_kg,v_g)) <> 4
 THEN RAISE EXCEPTION 'PEC g normalization: four stock masters must be Kg or g'; END IF;

 UPDATE public.inv_stock_item i SET default_uom_id=v_g
 WHERE i.id IN (64,291,424,517) AND i.default_uom_id=v_kg;
 GET DIAGNOSTICS v_master_changed=ROW_COUNT;

 UPDATE public.rm_bom_line l SET
   qty_per_reference_output=e.old_qty*1000,uom_id=v_g
 FROM _pec_g_expected e
 WHERE l.id=e.id AND l.stock_item_id=e.stock_item_id
   AND l.uom_id=v_kg AND l.qty_per_reference_output=e.old_qty;
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF EXISTS (SELECT 1 FROM public.rm_bom_line l
    WHERE l.stock_item_id IN (64,291,424,517) AND l.uom_id<>v_g)
 OR EXISTS (SELECT 1 FROM public.inv_stock_item i
    WHERE i.id IN (64,291,424,517) AND i.default_uom_id<>v_g)
 THEN RAISE EXCEPTION 'PEC g normalization: remaining non-g master/BOM UOM'; END IF;
 RAISE NOTICE 'PEC four-item g correction: % masters and % old BOM lines transformed, all targets verified',v_master_changed,v_changed;
END $g$;
