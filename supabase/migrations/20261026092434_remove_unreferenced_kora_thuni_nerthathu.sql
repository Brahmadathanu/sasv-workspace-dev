DO $$
DECLARE r record; n bigint;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.inv_stock_item WHERE id=1079 AND code='I00000T8' AND name='Kora Thuni - Nerthathu')
 THEN RAISE EXCEPTION 'Stock identity mismatch'; END IF;
 FOR r IN
  SELECT ns.nspname sch, cl.relname tbl, att.attname col
  FROM pg_constraint fk
  JOIN pg_class cl ON cl.oid=fk.conrelid
  JOIN pg_namespace ns ON ns.oid=cl.relnamespace
  JOIN pg_attribute att ON att.attrelid=cl.oid AND att.attnum=fk.conkey[1]
  WHERE fk.contype='f' AND fk.confrelid='public.inv_stock_item'::regclass
    AND NOT (ns.nspname='public' AND cl.relname IN ('inv_stock_item_class_map','inv_stock_item_season_profile'))
 LOOP
 EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I=1079',r.sch,r.tbl,r.col) INTO n;
 IF n<>0 THEN RAISE EXCEPTION 'Deletion blocked by %.%: % references',r.sch,r.tbl,n; END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM public.v_tally_stock_items_distinct WHERE tally_item_name='Kora Thuni - Nerthathu')
 THEN RAISE EXCEPTION 'Source stock history still contains item name'; END IF;
 DELETE FROM public.inv_stock_item WHERE id=1079;
END $$;