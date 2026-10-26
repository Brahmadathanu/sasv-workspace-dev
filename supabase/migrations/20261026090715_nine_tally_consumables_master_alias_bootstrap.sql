DO $$
DECLARE r record; v_id bigint;
BEGIN
 FOR r IN SELECT * FROM (VALUES ('Nylon Net Fabric (Fine)',6),
('Nylon Net Fabric (Coarse)',6),
('Marker (White Board)',5),
('Floor Cleaning Brush (Large)',5),
('Cleansing Lotion',3),
('Finger Cap',5),
('Toilet Cleaner',3),
('Floor Cleaner',3),
('Bleaching Powder',1)) AS x(item_name,uom_id) LOOP
   SELECT id INTO v_id FROM public.inv_stock_item WHERE lower(btrim(name))=lower(r.item_name);
   IF v_id IS NULL THEN
     INSERT INTO public.inv_stock_item(name,default_uom_id,notes)
     VALUES (r.item_name,r.uom_id,'Provisional UOM pending actual Tally unit confirmation; created for anticipated Tally consumables ETL.')
     RETURNING id INTO v_id;
   END IF;
   INSERT INTO public.inv_stock_item_class_map(stock_item_id,category_id,subcategory_id)
     VALUES(v_id,5,21)
     ON CONFLICT(stock_item_id) DO UPDATE SET category_id=5,subcategory_id=21,group_id=NULL,subgroup_id=NULL;
   IF EXISTS(SELECT 1 FROM public.inv_stock_item_alias WHERE source_system='tally' AND source_kind='consumable' AND alias_key=lower(r.item_name) AND inv_stock_item_id IS DISTINCT FROM v_id)
      THEN RAISE EXCEPTION 'Existing alias conflict: %',r.item_name; END IF;
   INSERT INTO public.inv_stock_item_alias(tally_item_name,source_kind,source_system,alias_key,inv_stock_item_id,status,note)
     VALUES (r.item_name,'consumable','tally',lower(r.item_name),v_id,'mapped','Prospective exact-name mapping; verify source_kind and UOM when Tally snapshot first arrives.')
     ON CONFLICT(alias_key,source_system,source_kind) DO UPDATE SET inv_stock_item_id=excluded.inv_stock_item_id,status='mapped',last_updated_at=now();
 END LOOP;
END $$;