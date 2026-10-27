DO $$
DECLARE changed_count integer;
BEGIN
 UPDATE public.inv_stock_item
 SET default_uom_id=5, last_updated_at=now(),
 notes=replace(coalesce(notes,''),'Provisional UOM pending actual Tally unit confirmation;','UOM confirmed as Nos by inventory owner;')
 WHERE (id,name) IN (
 (2798,'Nylon Net Fabric (Fine)'),
 (2799,'Nylon Net Fabric (Coarse)'),
 (2802,'Cleansing Lotion'),
 (2804,'Toilet Cleaner'),
 (2805,'Floor Cleaner')
 );
 GET DIAGNOSTICS changed_count = ROW_COUNT;
 IF changed_count <> 5 THEN RAISE EXCEPTION 'Expected 5 item updates, got %',changed_count; END IF;
END $$;