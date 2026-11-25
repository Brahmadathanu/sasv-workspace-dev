-- Review candidate, not installed. Apply after R3_FACILITY_SALES_SCOPE.sql.
-- Dedicated permission target: module:sales-item-classification. No implicit editor grants.
BEGIN;
CREATE TABLE public.sales_item_scope (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 alias_text text NOT NULL CHECK(length(trim(alias_text)) BETWEEN 1 AND 300),
 alias_key text GENERATED ALWAYS AS (public.normalize_key(alias_text)) STORED,
 effective_from date NOT NULL CHECK(effective_from>=date '1900-01-01'),
 scope text NOT NULL CHECK(scope IN ('OTHER_MANUFACTURING_UNIT','RAW_MATERIAL','PACKING_MATERIAL','OTHER_MERCHANDISE','SASV_HISTORICAL_PACK','SASV_SAMPLE','EXCLUDE_PRODUCT_ANALYTICS','UNCLASSIFIED')),
 inventory_item_id bigint REFERENCES public.inv_stock_item(id),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 2000),
 approved_by uuid,
 approval_source text NOT NULL CHECK(approval_source IN ('OWNER_RECEIPT','AUTHORIZED_EDITOR')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(alias_key IS NOT NULL AND alias_key<>''),
 CHECK(approval_source='OWNER_RECEIPT' OR approved_by IS NOT NULL),
 CHECK((scope IN ('RAW_MATERIAL','PACKING_MATERIAL') AND inventory_item_id IS NOT NULL) OR (scope NOT IN ('RAW_MATERIAL','PACKING_MATERIAL') AND inventory_item_id IS NULL))
);
-- Immutable decision events; latest effective date then latest event wins.
-- Effective end is derived, not stored; revisions never overlap in the resolved timeline.
CREATE INDEX sales_item_scope_resolution_idx ON public.sales_item_scope(alias_key,effective_from DESC,id DESC);
ALTER TABLE public.sales_item_scope ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_item_scope FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.sales_item_scope TO authenticated;
CREATE POLICY sales_item_scope_read ON public.sales_item_scope FOR SELECT TO authenticated USING (
 auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'is_anonymous','false')<>'true' AND
 (coalesce(public.app_has_permission('module:sales-item-classification','view'),false) OR coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) OR coalesce(public.app_has_permission('module:sales-data-viewer','view'),false)));
-- Explicitly approved labels only. No prefix rules or guessed future variants.
INSERT INTO public.sales_item_scope(alias_text,effective_from,scope,reason,approval_source)
SELECT label,date '1900-01-01',scope,'Owner classification receipt 2026-11-25','OWNER_RECEIPT'
FROM (VALUES
 ('CHARMA MAHIMA 75 GM','OTHER_MANUFACTURING_UNIT'),('CHARMA MAHIMA 75 GM - ?35/-','OTHER_MANUFACTURING_UNIT'),('CHARMA MAHIMA 75 GM - ?33/-','OTHER_MANUFACTURING_UNIT'),('CHARMA MAHIMA 75 GM MRP ?68/-','OTHER_MANUFACTURING_UNIT'),('CHARMA MAHIMA 15 GM(Sample)','OTHER_MANUFACTURING_UNIT'),
 ('CHARMA SUDHI 75 GM','OTHER_MANUFACTURING_UNIT'),('CHARMA SUDHI 75 GM - ?35/-','OTHER_MANUFACTURING_UNIT'),('CHARMA SUDHI 75 GM - ?33/-','OTHER_MANUFACTURING_UNIT'),('CHARMA SUDHI 75 GM MRP ?68/-','OTHER_MANUFACTURING_UNIT'),('CHARMA SUDHI 15 GM(Sample)','OTHER_MANUFACTURING_UNIT'),
 ('KRIPA VIRGIN COCONUT OIL 100 ML','OTHER_MANUFACTURING_UNIT'),('NALLAMANGALAM-BLUE 150 GM','OTHER_MANUFACTURING_UNIT'),('HONEY 100 GM','OTHER_MANUFACTURING_UNIT'),('HONEY 250 GM','OTHER_MANUFACTURING_UNIT'),
 ('AGARBATHI - SANDAL WOOD 25 GM','OTHER_MANUFACTURING_UNIT'),('AGARBATHI - JASMIN 25 GM','OTHER_MANUFACTURING_UNIT'),('AGARBATHI - RAAT RANI 25 GM','OTHER_MANUFACTURING_UNIT'),('AGARBATHI - SANDAL 27 GM','OTHER_MANUFACTURING_UNIT'),('AGARBATHI - JASMIN 27 GM','OTHER_MANUFACTURING_UNIT'),('AGARBATHI - RAAT RANI 27 GM','OTHER_MANUFACTURING_UNIT'),('AGRI WASH 300 GM','OTHER_MANUFACTURING_UNIT'),('ASHTAGANDHA DHOOP 35 GM','OTHER_MANUFACTURING_UNIT'),
 ('SANTHIGIRI N99 MASK (ADULTS)','SASV_HISTORICAL_PACK'),('SANTHIGIRI N99 MASK (KIDS)','SASV_HISTORICAL_PACK'),('HRIDAYARENJINI LEPAM  250 GM','SASV_HISTORICAL_PACK'),('THRIPHALA CHOORNAM (S) 1 Kg','SASV_HISTORICAL_PACK'),('PADIKARACHENDOORAM 1 Kg','SASV_HISTORICAL_PACK'),('MARMANI ASAVENNA 100ML','SASV_HISTORICAL_PACK'),('VEMBADAPATTA THAILAM 100 ML','SASV_HISTORICAL_PACK'),('KSHEERABALA 021 AVARTHY 10 ML','SASV_HISTORICAL_PACK'),('KABASURA KUDINEER (SAMPLE)','SASV_SAMPLE'),
 ('REGAS (Loose)','EXCLUDE_PRODUCT_ANALYTICS'),('ARJUN FORTE (Loose)','EXCLUDE_PRODUCT_ANALYTICS'),('VATHAMARMAKAN CAP (Loose)','EXCLUDE_PRODUCT_ANALYTICS')
) v(label,scope);
-- Scope-only editor: no modification to SKU aliases. New mapping workflow remains in canonical master admin.
-- No material classification by this RPC until authoritative inventory class validation is wired.
CREATE FUNCTION public.sales_item_scope_approve(p_alias text,p_scope text,p_effective_from date,p_reason text,p_expected_latest_id bigint DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE k text; current_id bigint; new_id bigint;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR NOT coalesce(public.app_has_permission('module:sales-item-classification','edit'),false) THEN RAISE EXCEPTION 'Classification edit denied' USING ERRCODE='42501'; END IF;
 k:=public.normalize_key(p_alias);
 IF k IS NULL OR k='' OR p_scope IS NULL OR p_scope IN ('RAW_MATERIAL','PACKING_MATERIAL') THEN RAISE EXCEPTION 'Invalid or material-specific classification requires verified material authority' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(k,7332));
 SELECT id INTO current_id FROM public.sales_item_scope WHERE alias_key=k ORDER BY id DESC LIMIT 1;
 IF current_id IS DISTINCT FROM p_expected_latest_id THEN RAISE EXCEPTION 'Classification changed; reload' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.sku_aliases a WHERE public.normalize_key(a.alias_text)=k) THEN RAISE EXCEPTION 'Canonical SKU alias already exists; reconcile in master administration' USING ERRCODE='23514'; END IF;
 INSERT INTO public.sales_item_scope(alias_text,effective_from,scope,reason,approval_source,approved_by) VALUES(p_alias,p_effective_from,p_scope,p_reason,'AUTHORIZED_EDITOR',auth.uid()) RETURNING id INTO new_id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.sales_item_scope_approve(text,text,date,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_item_scope_approve(text,text,date,text,bigint) TO authenticated;
-- Bounded monthly source grouped before alias lookups. No unbounded queue scan.
CREATE FUNCTION public.sales_item_scope_review(p_from date,p_to date,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR NOT coalesce(public.app_has_permission('module:sales-item-classification','view'),false) THEN RAISE EXCEPTION 'Classification view denied' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to>p_from+365 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 20000 THEN RAISE EXCEPTION 'Invalid queue bounds' USING ERRCODE='22023'; END IF;
 WITH raw AS (
 SELECT s.tally_item_name,s.voucher_date,count(*) n,sum(s.billed_amount_value) value,count(*) FILTER(WHERE s.billed_amount_value IS NULL) missing
 FROM public.tally_sales_vreg_snapshot s WHERE s.voucher_date BETWEEN p_from AND p_to GROUP BY 1,2
 ), classified AS (
 SELECT r.*,a.sku_id,c.scope,c.id classification_id
 FROM raw r LEFT JOIN public.sku_aliases a ON a.alias_key=public.normalize_key(r.tally_item_name)
 LEFT JOIN LATERAL (SELECT id,scope FROM public.sales_item_scope c WHERE c.alias_key=public.normalize_key(r.tally_item_name) AND c.effective_from<=r.voucher_date ORDER BY effective_from DESC,id DESC LIMIT 1) c ON true
 ), grouped AS (
 SELECT tally_item_name,CASE WHEN sku_id IS NOT NULL AND classification_id IS NOT NULL AND scope<>'UNCLASSIFIED' THEN 'CLASSIFICATION_CONFLICT' WHEN sku_id IS NULL AND scope IS NULL THEN 'UNCLASSIFIED' ELSE scope END AS state,
 sum(n) recorded_rows,sum(value) source_reported_amount,sum(missing) missing_amount_rows,min(voucher_date) first_date,max(voucher_date) last_date
 FROM classified WHERE (sku_id IS NULL AND (scope IS NULL OR scope='UNCLASSIFIED' OR scope IN ('SASV_HISTORICAL_PACK','SASV_SAMPLE'))) OR (sku_id IS NOT NULL AND classification_id IS NOT NULL AND scope<>'UNCLASSIFIED')
 GROUP BY 1,2
 ), page AS (SELECT * FROM grouped ORDER BY abs(source_reported_amount) DESC NULLS LAST,tally_item_name,state OFFSET p_offset LIMIT p_limit)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM grouped),'limit',p_limit,'offset',p_offset,'rows',coalesce(jsonb_agg(to_jsonb(page) ORDER BY abs(source_reported_amount) DESC NULLS LAST,tally_item_name,state),'[]'::jsonb)) INTO result FROM page;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.sales_item_scope_review(date,date,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_item_scope_review(date,date,integer,integer) TO authenticated;
COMMIT;
