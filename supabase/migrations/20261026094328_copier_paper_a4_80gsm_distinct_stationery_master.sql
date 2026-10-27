DO $$
DECLARE v_id bigint;
BEGIN
 SELECT id INTO v_id FROM public.inv_stock_item WHERE lower(name)='copier paper - a4 (80 gsm)';
 IF v_id IS NULL THEN
 INSERT INTO public.inv_stock_item(name,default_uom_id,notes)
 VALUES('Copier Paper - A4 (80 GSM)',8,'Distinct GSM-specified paper identity; do not merge with A4 Paper Bundle ID 2662 without physical/specification verification. Provisional Pkt UOM.')
 RETURNING id INTO v_id;
 END IF;
 INSERT INTO public.inv_stock_item_class_map(stock_item_id,category_id,subcategory_id)
 VALUES(v_id,5,21) ON CONFLICT(stock_item_id) DO UPDATE SET category_id=5,subcategory_id=21,group_id=NULL,subgroup_id=NULL;
 IF EXISTS (SELECT 1 FROM public.inv_stock_item_alias WHERE source_system='tally' AND source_kind='consumable' AND alias_key='copier paper - a4 (80 gsm)' AND inv_stock_item_id IS DISTINCT FROM v_id) THEN RAISE EXCEPTION 'Paper alias conflict'; END IF;
 INSERT INTO public.inv_stock_item_alias(tally_item_name,source_kind,source_system,alias_key,inv_stock_item_id,status,note)
 VALUES('Copier Paper - A4 (80 GSM)','consumable','tally','copier paper - a4 (80 gsm)',v_id,'mapped','Prospective name mapping; verify Tally source/UOM and distinguish A4 Paper Bundle.')
 ON CONFLICT(alias_key,source_system,source_kind) DO UPDATE SET inv_stock_item_id=excluded.inv_stock_item_id,status='mapped',last_updated_at=now();
END $$;