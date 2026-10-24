DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.inv_stock_item WHERE id=2789 AND code='I000024N' AND name IN ('25 G PP Jar (Palpodi)','25 G PP Jar - Milky White (Tooth Powder)') AND default_uom_id=5) THEN RAISE EXCEPTION 'Unexpected PP jar inventory master'; END IF;
 IF EXISTS (SELECT 1 FROM public.inv_stock_item WHERE id<>2789 AND lower(name)='25 g pp jar - milky white (tooth powder)') THEN RAISE EXCEPTION 'Duplicate named inventory item'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.plm_bom_line WHERE id=40327 AND plm_bom_id=139 AND stock_item_id IN (1291,2789) AND qty_per_reference_output=1 AND uom_id=5) THEN RAISE EXCEPTION 'Unexpected tooth powder BOM target'; END IF;
 IF EXISTS (SELECT 1 FROM public.inv_stock_item_alias WHERE alias_key='25 g pp jar - milky white (tooth powder)' AND source_kind='plm' AND source_system='tally' AND inv_stock_item_id IS DISTINCT FROM 2789) THEN RAISE EXCEPTION 'New alias collision'; END IF;
 UPDATE public.inv_stock_item SET name='25 G PP Jar - Milky White (Tooth Powder)',last_updated_at=now() WHERE id=2789;
 INSERT INTO public.inv_stock_item_alias(tally_item_name,source_kind,source_system,alias_key,inv_stock_item_id,status,note)
 VALUES ('25 G PP Jar - Milky White (Tooth Powder)','plm','tally','25 g pp jar - milky white (tooth powder)',2789,'mapped','Renamed Tally item; prior PP Jar 25 Gm [Palpodi] alias retained.')
 ON CONFLICT (alias_key,source_system,source_kind) DO UPDATE SET inv_stock_item_id=2789,status='mapped',last_updated_at=now();
 UPDATE public.plm_bom_line SET stock_item_id=2789 WHERE id=40327 AND plm_bom_id=139;
END $$;