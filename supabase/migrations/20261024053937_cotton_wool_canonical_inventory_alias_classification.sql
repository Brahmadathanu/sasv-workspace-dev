DO $$
DECLARE v_subcategory bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inv_stock_item WHERE id=2685 AND code='I000021T' AND active) THEN
    RAISE EXCEPTION 'Expected active cotton stock master 2685 missing or changed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.inv_stock_item WHERE lower(btrim(name))='absorbent cotton wool ip' AND id<>2685) THEN
    RAISE EXCEPTION 'Another canonical cotton stock item exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.inv_stock_item_alias
    WHERE source_system='tally' AND source_kind='consumable'
      AND alias_key IN ('absorbent cotton wool ip','absorbent surgical cotton')
      AND inv_stock_item_id IS DISTINCT FROM 2685
  ) THEN
    RAISE EXCEPTION 'Cotton aliases already mapped to a different stock item';
  END IF;
  INSERT INTO public.inv_class_subcategory(category_id,code,label,notes,sort_order)
  VALUES (5,'consumables','Consumables','Indirect non-utility consumable stock; distinguish from Utilities',20)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_subcategory FROM public.inv_class_subcategory
    WHERE category_id=5 AND code='consumables';
  IF v_subcategory IS NULL THEN RAISE EXCEPTION 'Consumables classification unavailable'; END IF;
  UPDATE public.inv_stock_item
    SET name='Absorbent Cotton Wool IP',
        notes=concat_ws(' | ',nullif(notes,''),'Canonical name harmonised with renamed Tally item; legacy cotton descriptions retained as aliases.'),
        last_updated_at=now()
    WHERE id=2685;
  UPDATE public.inv_stock_item_class_map
    SET category_id=5,subcategory_id=v_subcategory,group_id=NULL,subgroup_id=NULL
    WHERE stock_item_id=2685;
  IF NOT FOUND THEN RAISE EXCEPTION 'Existing classification map missing'; END IF;
  INSERT INTO public.inv_stock_item_alias
    (tally_item_name,source_kind,source_system,alias_key,inv_stock_item_id,status,note,first_seen,last_seen)
  VALUES
    ('Absorbent Surgical Cotton','consumable','tally','absorbent surgical cotton',2685,'mapped','Former Tally name renamed to Absorbent Cotton Wool IP; preserve historical snapshot linkage','2026-10-24','2026-10-24'),
    ('Absorbent Cotton Wool IP','consumable','tally','absorbent cotton wool ip',2685,'mapped','Current confirmed Tally name for canonical inventory stock item 2685',NULL,NULL)
  ON CONFLICT (alias_key,source_system,source_kind) DO UPDATE
  SET inv_stock_item_id=EXCLUDED.inv_stock_item_id,status='mapped',
      note=EXCLUDED.note,last_updated_at=now();
END $$;