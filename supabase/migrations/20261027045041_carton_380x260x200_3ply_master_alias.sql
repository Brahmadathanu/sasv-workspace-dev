DO $$
DECLARE v_id bigint;
BEGIN
 SELECT id INTO v_id FROM public.inv_stock_item WHERE lower(btrim(name))=lower('Carton - 380 X 260 X 200 mm 3 Ply Carton');
 IF v_id IS NULL THEN
  INSERT INTO public.inv_stock_item(name,default_uom_id,notes)
  VALUES('Carton - 380 X 260 X 200 mm 3 Ply Carton',5,'New packing material; distinct 200 mm carton height from existing 220 mm item 1252. UOM Nos.')
  RETURNING id INTO v_id;
 END IF;
 IF EXISTS (SELECT 1 FROM public.inv_stock_item_alias WHERE source_system='tally' AND source_kind='plm' AND alias_key='carton - 380 x 260 x 200 mm 3 ply carton' AND inv_stock_item_id IS DISTINCT FROM v_id)
 THEN RAISE EXCEPTION 'Conflicting Tally alias'; END IF;
 INSERT INTO public.inv_stock_item_class_map(stock_item_id,category_id,subcategory_id)
 VALUES(v_id,2,7)
 ON CONFLICT(stock_item_id) DO UPDATE SET category_id=2,subcategory_id=7,group_id=NULL,subgroup_id=NULL;
 INSERT INTO public.inv_stock_item_alias(tally_item_name,source_kind,source_system,alias_key,inv_stock_item_id,status,note)
 VALUES('Carton - 380 X 260 X 200 mm 3 Ply Carton','plm','tally','carton - 380 x 260 x 200 mm 3 ply carton',v_id,'mapped','Prospective exact-name Tally PLM mapping; confirm on next snapshot.')
 ON CONFLICT(alias_key,source_system,source_kind) DO UPDATE SET inv_stock_item_id=excluded.inv_stock_item_id,status='mapped',last_updated_at=now();
END $$;