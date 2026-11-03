DO $$
DECLARE r record; v_id bigint;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.inv_stock_item WHERE id=2681 AND name IN ('Stapler Pin No. 10','Stapler Pin No. 10 - 1M (Regular Size)')) THEN RAISE EXCEPTION 'Stapler master changed'; END IF;
 IF EXISTS (SELECT 1 FROM public.inv_stock_item WHERE lower(name)='stapler pin no. 10 - 1m (regular size)' AND id<>2681) THEN RAISE EXCEPTION 'Stapler duplicate'; END IF;
 UPDATE public.inv_stock_item SET name='Stapler Pin No. 10 - 1M (Regular Size)',last_updated_at=now() WHERE id=2681;
 UPDATE public.inv_stock_item_class_map SET subcategory_id=21 WHERE stock_item_id=2681 AND category_id=5;
 FOR r IN SELECT * FROM (VALUES
 ('Whitener Pen',5),('Highlighter Pen',5),('Carbon Paper',8),
 ('Marker (Permanent)',5)
 ) AS x(n,u) LOOP
 SELECT id INTO v_id FROM public.inv_stock_item WHERE lower(name)=lower(r.n);
 IF v_id IS NULL THEN INSERT INTO public.inv_stock_item(name,default_uom_id,notes) VALUES(r.n,r.u,'Stationery consumable; assigned UOM to be confirmed against Tally.') RETURNING id INTO v_id; END IF;
 INSERT INTO public.inv_stock_item_class_map(stock_item_id,category_id,subcategory_id) VALUES(v_id,5,21)
 ON CONFLICT(stock_item_id) DO UPDATE SET category_id=5,subcategory_id=21,group_id=NULL,subgroup_id=NULL;
 IF EXISTS (SELECT 1 FROM public.inv_stock_item_alias WHERE source_system='tally' AND source_kind='consumable' AND alias_key=lower(r.n) AND inv_stock_item_id IS DISTINCT FROM v_id) THEN RAISE EXCEPTION 'Alias conflict %',r.n; END IF;
 INSERT INTO public.inv_stock_item_alias(tally_item_name,source_kind,source_system,alias_key,inv_stock_item_id,status,note)
 VALUES(r.n,'consumable','tally',lower(r.n),v_id,'mapped','Prospective Tally mapping; validate source and UOM at ingestion.')
 ON CONFLICT(alias_key,source_system,source_kind) DO UPDATE SET inv_stock_item_id=excluded.inv_stock_item_id,status='mapped',last_updated_at=now();
 END LOOP;
 IF EXISTS (SELECT 1 FROM public.inv_stock_item_alias WHERE source_system='tally' AND source_kind='consumable' AND alias_key='stapler pin no. 10 - 1m (regular size)' AND inv_stock_item_id IS DISTINCT FROM 2681) THEN RAISE EXCEPTION 'Stapler alias conflict'; END IF;
 INSERT INTO public.inv_stock_item_alias(tally_item_name,source_kind,source_system,alias_key,inv_stock_item_id,status,note)
 VALUES('Stapler Pin No. 10 - 1M (Regular Size)','consumable','tally','stapler pin no. 10 - 1m (regular size)',2681,'mapped','New detailed name; historical Stapler Pin No. 10 alias retained.')
 ON CONFLICT(alias_key,source_system,source_kind) DO UPDATE SET inv_stock_item_id=2681,status='mapped',last_updated_at=now();
END $$;