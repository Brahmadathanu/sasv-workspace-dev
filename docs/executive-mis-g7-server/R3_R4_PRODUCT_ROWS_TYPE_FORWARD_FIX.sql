BEGIN;
DO $guard$
BEGIN
 IF EXISTS(SELECT 1 FROM public.product_skus WHERE id NOT BETWEEN -2147483648 AND 2147483647) THEN RAISE EXCEPTION 'SKU exceeds normalized reporting integer contract'; END IF;
 IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261126102211' AND name='executive_intelligence_r3_r4_reporting_parity') THEN RAISE EXCEPTION 'Required migration absent'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.ei_sales_product_rows(p_from date,p_to date)
RETURNS TABLE(sales_date date,sku_id integer,product_id bigint,godown_id integer,region_id integer,
 qty_units numeric,qty_billed numeric,billed_amount numeric,source_key text,inserted_at timestamptz,raw_row_id bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.ei_can_read_sales() THEN RETURN; END IF;
 IF p_from IS NULL AND p_to IS NULL THEN RETURN; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from<date '1900-01-01' OR p_to<p_from OR p_to>p_from+366 THEN
  RAISE EXCEPTION 'Invalid bounded product sales period' USING ERRCODE='22023'; END IF;
 RETURN QUERY
 WITH raw AS MATERIALIZED (
  SELECT s.id,s.voucher_date,s.tally_item_name,s.godown_label,s.act_qty_value,s.bill_qty_value,s.billed_amount_value,s.source_key,s.inserted_at
  FROM public.tally_sales_vreg_snapshot s WHERE s.voucher_date BETWEEN p_from AND p_to
 ), labels AS MATERIALIZED (
  SELECT l.tally_item_name,public.normalize_key(l.tally_item_name) AS key FROM (SELECT DISTINCT r.tally_item_name FROM raw r) l
 ), locations AS MATERIALIZED (
  SELECT l.godown_label,public.normalize_key(l.godown_label) AS key FROM (SELECT DISTINCT r.godown_label FROM raw r) l
 ), sku_keys AS MATERIALIZED (
  SELECT public.normalize_key(a.alias_text) AS key,min(k.id) AS sku_id,min(k.product_id)::bigint AS product_id,count(*) AS matches
  FROM public.sku_aliases a JOIN public.product_skus k ON k.id=a.sku_id GROUP BY 1
 ), godown_keys AS MATERIALIZED (
  SELECT public.normalize_key(a.alias_text) AS key,min(g.id) AS godown_id,min(g.region_id) AS region_id,count(*) AS matches
  FROM public.godown_aliases a JOIN public.godowns g ON g.id=a.godown_id GROUP BY 1
 ), items AS MATERIALIZED (
  SELECT l.tally_item_name,l.key,k.sku_id,k.product_id FROM labels l JOIN sku_keys k ON k.key=l.key AND k.matches=1
 ), depots AS MATERIALIZED (
  SELECT l.godown_label,g.godown_id,g.region_id FROM locations l JOIN godown_keys g ON g.key=l.key AND g.matches=1
 ), scope_events AS MATERIALIZED (
  SELECT DISTINCT ON(c.alias_key,c.effective_from) c.alias_key,c.effective_from,c.scope
  FROM public.sales_item_scope c WHERE c.effective_from<=p_to ORDER BY c.alias_key,c.effective_from,c.id DESC
 ), scope_periods AS MATERIALIZED (
  SELECT e.alias_key,e.effective_from,lead(e.effective_from) OVER(PARTITION BY e.alias_key ORDER BY e.effective_from) AS next_effective_from,e.scope
  FROM scope_events e
 )
 SELECT s.voucher_date,k.sku_id::integer,k.product_id,g.godown_id,g.region_id,s.act_qty_value,s.bill_qty_value,s.billed_amount_value,s.source_key,s.inserted_at,s.id
 FROM raw s JOIN items k ON k.tally_item_name=s.tally_item_name JOIN depots g ON g.godown_label=s.godown_label
 LEFT JOIN scope_periods c ON c.alias_key=k.key AND c.effective_from<=s.voucher_date AND (c.next_effective_from IS NULL OR s.voucher_date<c.next_effective_from)
 WHERE c.scope IS NULL OR c.scope IN ('UNCLASSIFIED','SASV_HISTORICAL_PACK','SASV_SAMPLE');
END $$;
COMMIT;
