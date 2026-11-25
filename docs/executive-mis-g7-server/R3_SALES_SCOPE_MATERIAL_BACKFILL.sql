-- Review candidate; apply after scope master and unified catalog. No production writes yet.
BEGIN;
DROP FUNCTION public.sales_item_scope_approve(text,text,date,text,bigint);
CREATE FUNCTION public.sales_item_scope_approve(p_alias text,p_scope text,p_effective_from date,p_reason text,p_expected_latest_id bigint DEFAULT NULL,p_inventory_item_id bigint DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE k text; current_id bigint; new_id bigint;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR NOT coalesce(public.app_has_permission('module:sales-item-classification','edit'),false) THEN RAISE EXCEPTION 'Classification edit denied' USING ERRCODE='42501'; END IF;
 k:=public.normalize_key(p_alias);
 IF k IS NULL OR k='' OR p_scope IS NULL  THEN RAISE EXCEPTION 'Invalid or material-specific classification requires verified material authority' USING ERRCODE='22023'; END IF;
 IF p_scope IN ('RAW_MATERIAL','PACKING_MATERIAL') THEN
 IF p_inventory_item_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.v_inv_stock_item_with_class c WHERE c.stock_item_id=p_inventory_item_id AND c.category_code=CASE WHEN p_scope='RAW_MATERIAL' THEN 'RM' ELSE 'PM' END) THEN RAISE EXCEPTION 'Inventory class does not match sales scope' USING ERRCODE='23514'; END IF;
 ELSIF p_inventory_item_id IS NOT NULL THEN RAISE EXCEPTION 'Unexpected inventory reference' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(k,7332));
 SELECT id INTO current_id FROM public.sales_item_scope WHERE alias_key=k ORDER BY id DESC LIMIT 1;
 IF current_id IS DISTINCT FROM p_expected_latest_id THEN RAISE EXCEPTION 'Classification changed; reload' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.sku_aliases a WHERE public.normalize_key(a.alias_text)=k) THEN RAISE EXCEPTION 'Canonical SKU alias already exists; reconcile in master administration' USING ERRCODE='23514'; END IF;
 INSERT INTO public.sales_item_scope(alias_text,effective_from,scope,reason,approval_source,approved_by,inventory_item_id) VALUES(p_alias,p_effective_from,p_scope,p_reason,'AUTHORIZED_EDITOR',auth.uid(),p_inventory_item_id) RETURNING id INTO new_id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.sales_item_scope_approve(text,text,date,text,bigint,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_item_scope_approve(text,text,date,text,bigint,bigint) TO authenticated;
-- Owner approved verified RM/PM classification. Exact observed labels, unique existing mapped inventory alias, matching category.
-- Fail closed on drift; no master alias or stock item creation.
DO $$
DECLARE inserted_count integer;
BEGIN
WITH expected(label,item_id) AS (VALUES
 ('CHENNINAYAKAM (S)',207),('CHUKKU (S)',241),('JATHIKKA PARIPPU (S)',331),('JATHIPATHRI (S)',332),('JEERAKAM (S)',333),('KARUVAPPATTA - NAADAN (S)',422),('KATAL NURA (S)',430),('KOLARAKKU (S)',475),('KURUMULAKU (S)',527),('KUTA MANJAL (S)',534),('NAKAM (S)',643),('PASUVIN NEYYU (S)',750),('PAVIZHA PUTTU (S)',759),('THAKKOLAM (S)',893),('YAVAM (S)',1049)
), verified AS (
 SELECT e.* FROM expected e WHERE EXISTS(SELECT 1 FROM public.tally_sales_vreg_snapshot s WHERE s.tally_item_name=e.label)
 AND NOT EXISTS(SELECT 1 FROM public.sku_aliases a WHERE public.normalize_key(a.alias_text)=public.normalize_key(e.label))
 AND NOT EXISTS(SELECT 1 FROM public.sales_item_scope c WHERE c.alias_key=public.normalize_key(e.label))
 AND (SELECT count(DISTINCT a.inv_stock_item_id) FROM public.inv_stock_item_alias a WHERE a.status='mapped' AND a.source_system='tally' AND public.normalize_key(a.tally_item_name)=public.normalize_key(regexp_replace(e.label,'[[:space:]]*[(]S[)]$','','i')))=1
 AND EXISTS(SELECT 1 FROM public.inv_stock_item_alias a JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=a.inv_stock_item_id WHERE a.inv_stock_item_id=e.item_id AND a.status='mapped' AND a.source_system='tally' AND a.source_kind='rm' AND c.category_code='RM' AND public.normalize_key(a.tally_item_name)=public.normalize_key(regexp_replace(e.label,'[[:space:]]*[(]S[)]$','','i')))
)
INSERT INTO public.sales_item_scope(alias_text,effective_from,scope,inventory_item_id,reason,approval_source)
SELECT label,date '1900-01-01','RAW_MATERIAL',item_id,'Owner approved verified material scope; unique mapped inventory alias and RM category, historical (S) suffix removed','OWNER_RECEIPT' FROM verified;
GET DIAGNOSTICS inserted_count=ROW_COUNT;
IF inserted_count<>15 THEN RAISE EXCEPTION 'Material seed drift: expected 15, got %',inserted_count; END IF;
END $$;
COMMIT;
