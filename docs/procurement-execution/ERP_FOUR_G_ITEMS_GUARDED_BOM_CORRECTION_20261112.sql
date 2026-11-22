-- Owner-approved SASV UOM correction: unit-preserving 13 RM BOM rows Kg -> g.
-- Intended for one-time controlled live execution. Preconditions FAIL CLOSED.
-- Existing g rows (including Gomatha Javvadu) remain unchanged.
-- No PR, indent or historical MRP mutation; rerun would fail preconditions.
DO $correction$
DECLARE
  actual_count integer;
  update_count integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.inv_uom WHERE id=1 AND code='Kg' AND dimension_id=1)
    OR NOT EXISTS(SELECT 1 FROM public.inv_uom WHERE id=2 AND code='g' AND dimension_id=1)
    OR NOT EXISTS(SELECT 1 FROM public.inv_uom_conversion WHERE from_uom_id=1 AND to_uom_id=2 AND factor=1000 AND dimension_id=1)
  THEN RAISE EXCEPTION 'Kg to g conversion policy not verified'; END IF;

  SELECT count(*) INTO actual_count
  FROM public.rm_bom_line l
  JOIN (VALUES
    (5394::bigint,64::bigint,0.010000::numeric),
    (9717,424,0.075000),
    (3769,517,0.050000),
    (5405,517,0.025000),
    (5714,517,0.150000),
    (6586,517,0.050000),
    (7048,517,0.100000),
    (7777,517,0.240000),
    (8104,517,0.010000),
    (9183,517,0.001000),
    (9718,517,0.075000),
    (10000,517,0.100000),
    (10749,517,0.005000)
  ) expected(id,stock_item_id,old_qty)
  ON l.id=expected.id AND l.stock_item_id=expected.stock_item_id
  AND l.qty_per_reference_output=expected.old_qty AND l.uom_id=1;
  IF actual_count <> 13 THEN RAISE EXCEPTION 'Expected 13 exact Kg BOM lines, matched %',actual_count; END IF;

  IF (SELECT count(*) FROM public.rm_bom_line WHERE stock_item_id IN (64,291,424,517) AND uom_id=1)<>13
  THEN RAISE EXCEPTION 'Unexpected additional Kg BOM lines for four governed stock items'; END IF;

  UPDATE public.rm_bom_line l
  SET uom_id=2,qty_per_reference_output=l.qty_per_reference_output*1000
  FROM (VALUES (5394::bigint),(9717),(3769),(5405),(5714),(6586),(7048),(7777),(8104),(9183),(9718),(10000),(10749)) e(id)
  WHERE l.id=e.id AND l.uom_id=1;
  GET DIAGNOSTICS update_count=ROW_COUNT;
  IF update_count<>13 THEN RAISE EXCEPTION 'Updated only % of 13 planned BOM lines',update_count; END IF;

  IF EXISTS(
    SELECT 1 FROM public.rm_bom_line l
    JOIN public.inv_stock_item i ON i.id=l.stock_item_id
    WHERE l.stock_item_id IN (64,291,424,517)
      AND (l.uom_id<>2 OR i.default_uom_id<>2)
  )
  THEN RAISE EXCEPTION 'Postcondition: one or more BOM/default UOM not grams'; END IF;
END
$correction$;
