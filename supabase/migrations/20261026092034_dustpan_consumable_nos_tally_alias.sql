DO $$
DECLARE v_id bigint;
BEGIN
 SELECT id INTO v_id FROM public.inv_stock_item WHERE lower(btrim(name))='dustpan';
 IF v_id IS NULL THEN
  INSERT INTO public.inv_stock_item(name,default_uom_id,notes) VALUES('Dustpan',5,'Housekeeping consumable; UOM Nos confirmed by inventory owner.') RETURNING id INTO v_id;
 END IF;
 IF EXISTS(SELECT 1 FROM public.inv_stock_item_alias WHERE alias_key='dustpan' AND source_kind='consumable' AND source_system='tally' AND inv_stock_item_id IS DISTINCT FROM v_id) THEN RAISE EXCEPTION 'Dustpan alias conflict'; END IF;
 INSERT INTO public.inv_stock_item_class_map(stock_item_id,category_id,subcategory_id) VALUES(v_id,5,21)
 ON CONFLICT(stock_item_id) DO UPDATE SET category_id=5,subcategory_id=21,group_id=NULL,subgroup_id=NULL;
 INSERT INTO public.inv_stock_item_alias(tally_item_name,source_kind,source_system,alias_key,inv_stock_item_id,status,note)
 VALUES('Dustpan','consumable','tally','dustpan',v_id,'mapped','Prospective Tally mapping; verify source kind at next snapshot.')
 ON CONFLICT(alias_key,source_system,source_kind) DO UPDATE SET inv_stock_item_id=excluded.inv_stock_item_id,status='mapped',last_updated_at=now();
END $$;