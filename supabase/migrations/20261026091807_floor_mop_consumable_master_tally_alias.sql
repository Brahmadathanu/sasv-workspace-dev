DO $$
DECLARE v_id bigint;
BEGIN
 SELECT id INTO v_id FROM public.inv_stock_item WHERE lower(btrim(name))='floor mop';
 IF v_id IS NULL THEN
   INSERT INTO public.inv_stock_item(name,default_uom_id,notes)
   VALUES('Floor Mop',5,'Consumable housekeeping item; Nos unit assumed pending Tally confirmation.')
   RETURNING id INTO v_id;
 END IF;
 IF EXISTS(SELECT 1 FROM public.inv_stock_item_alias WHERE alias_key='floor mop' AND source_system='tally' AND source_kind='consumable' AND inv_stock_item_id IS DISTINCT FROM v_id) THEN
   RAISE EXCEPTION 'Floor Mop alias conflict';
 END IF;
 INSERT INTO public.inv_stock_item_class_map(stock_item_id,category_id,subcategory_id)
 VALUES(v_id,5,21)
 ON CONFLICT(stock_item_id) DO UPDATE SET category_id=5,subcategory_id=21,group_id=NULL,subgroup_id=NULL;
 INSERT INTO public.inv_stock_item_alias(tally_item_name,source_kind,source_system,alias_key,inv_stock_item_id,status,note)
 VALUES('Floor Mop','consumable','tally','floor mop',v_id,'mapped','Prospective Tally mapping: verify source and UOM at first snapshot.')
 ON CONFLICT(alias_key,source_system,source_kind) DO UPDATE SET inv_stock_item_id=excluded.inv_stock_item_id,status='mapped',last_updated_at=now();
END $$;