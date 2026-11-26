-- Review candidate. Install after R3_SALES_ITEM_SCOPE_MASTER.sql.
BEGIN;
-- One row per canonical SKU (including never-sold), plus products lacking SKU and latest scope-only identities.
-- Catalog is current master, not a historical transaction classification.
CREATE VIEW public.v_sales_item_classification WITH (security_invoker=true,security_barrier=true) AS
WITH authorized AS (
 SELECT auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'is_anonymous','false')<>'true' AND (
 coalesce(public.app_has_permission('module:sales-item-classification','view'),false) OR
 coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) OR
 coalesce(public.app_has_permission('module:sales-data-viewer','view'),false)) AS allowed
), aliases AS (
 SELECT sku_id,count(*) alias_count,jsonb_agg(alias_text ORDER BY alias_text) aliases FROM public.sku_aliases GROUP BY sku_id
), current_scope AS (
 SELECT DISTINCT ON(alias_key) * FROM public.sales_item_scope WHERE effective_from<=current_date ORDER BY alias_key,effective_from DESC,id DESC
)
SELECT 'SKU:'||k.id AS identity_key,'CANONICAL_SKU'::text AS identity_type,p.id AS product_id,k.id AS sku_id,p.item AS item_name,k.pack_size::text AS pack_size,k.uom::text AS pack_uom,k.is_active,k.is_sample,
 CASE WHEN k.is_sample IS TRUE THEN 'SASV_SAMPLE' ELSE 'SASV_CANONICAL_PRODUCT' END AS scope,
 coalesce(a.alias_count,0) AS alias_count,coalesce(a.aliases,'[]'::jsonb) AS aliases,NULL::bigint AS classification_id,NULL::bigint AS inventory_item_id,
 CASE WHEN a.alias_count IS NULL THEN 'NO_TALLY_ALIAS' WHEN EXISTS(SELECT 1 FROM public.sku_aliases sa JOIN current_scope c ON c.alias_key=public.normalize_key(sa.alias_text) WHERE sa.sku_id=k.id AND c.scope NOT IN ('UNCLASSIFIED','SASV_HISTORICAL_PACK','SASV_SAMPLE')) THEN 'CLASSIFICATION_CONFLICT' ELSE 'MAPPED' END AS mapping_state
FROM public.product_skus k JOIN public.products p ON p.id=k.product_id LEFT JOIN aliases a ON a.sku_id=k.id CROSS JOIN authorized z WHERE z.allowed
UNION ALL
SELECT 'PRODUCT:'||p.id,'PRODUCT_WITHOUT_SKU',p.id,NULL::integer,p.item,NULL,NULL,NULL::boolean,NULL::boolean,'SASV_CANONICAL_PRODUCT',0,'[]'::jsonb,NULL::bigint,NULL::bigint,'NO_SKU'
FROM public.products p CROSS JOIN authorized z WHERE z.allowed AND NOT EXISTS(SELECT 1 FROM public.product_skus k WHERE k.product_id=p.id)
UNION ALL
SELECT 'SCOPE:'||c.alias_key,'SCOPE_ONLY',NULL::integer,NULL::integer,c.alias_text,NULL,NULL,NULL::boolean,NULL::boolean,c.scope,0,jsonb_build_array(c.alias_text),c.id,c.inventory_item_id,
 CASE WHEN EXISTS(SELECT 1 FROM public.sku_aliases a WHERE public.normalize_key(a.alias_text)=c.alias_key) THEN 'RECONCILE_WITH_SKU' WHEN c.scope IN ('SASV_HISTORICAL_PACK','SASV_SAMPLE') THEN 'SKU_PENDING' WHEN c.scope='UNCLASSIFIED' THEN 'REVIEW' ELSE 'CLASSIFIED' END
FROM current_scope c CROSS JOIN authorized z WHERE z.allowed;
REVOKE ALL ON public.v_sales_item_classification FROM PUBLIC,anon;
GRANT SELECT ON public.v_sales_item_classification TO authenticated;
-- Effective-dated facility reconciliation; one raw row contributes once, even with conflicting aliases.
CREATE OR REPLACE FUNCTION public.ei_facility_sales_scope(p_anchor date DEFAULT NULL,p_months integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE a date; latest date; first_date date; result jsonb;
BEGIN
 PERFORM public.ei_sales_access();
 IF p_months IS NULL OR p_months NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid months' USING ERRCODE='22023'; END IF;
 SELECT voucher_date INTO latest FROM public.tally_sales_vreg_snapshot WHERE voucher_date IS NOT NULL ORDER BY voucher_date DESC LIMIT 1;
 a:=coalesce(p_anchor,latest);
 IF a IS NULL THEN RETURN jsonb_build_object('coverage','NO_RAW_DATA','rows','[]'::jsonb); END IF;
 IF latest IS NULL OR a>latest OR a<date '1900-01-01' THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
 first_date:=(date_trunc('month',a)-make_interval(months=>p_months-1))::date;
 WITH raw AS MATERIALIZED (
 SELECT s.tally_item_name,s.godown_label,s.voucher_date,count(*) n,count(*) FILTER(WHERE s.billed_amount_value IS NULL) missing,sum(s.billed_amount_value) amount
 FROM public.tally_sales_vreg_snapshot s WHERE s.voucher_date BETWEEN first_date AND a GROUP BY 1,2,3
 ), labels AS MATERIALIZED (
 SELECT x.tally_item_name,public.normalize_key(x.tally_item_name) alias_key FROM (SELECT DISTINCT tally_item_name FROM raw) x
 ), scope_events AS MATERIALIZED (
 SELECT DISTINCT ON(s.alias_key,s.effective_from) s.alias_key,s.effective_from,s.id,s.scope
 FROM public.sales_item_scope s ORDER BY s.alias_key,s.effective_from,s.id DESC
 ), scope_periods AS MATERIALIZED (
 SELECT e.*,lead(e.effective_from) OVER(PARTITION BY e.alias_key ORDER BY e.effective_from) next_effective_from FROM scope_events e
 ), locations AS MATERIALIZED (
 SELECT x.godown_label,public.normalize_key(x.godown_label) alias_key FROM (SELECT DISTINCT godown_label FROM raw) x
 ), sku_map AS MATERIALIZED (
 SELECT public.normalize_key(sa.alias_text) AS alias_key,count(*) matches,bool_or(k.is_sample) sample
 FROM public.sku_aliases sa JOIN public.product_skus k ON k.id=sa.sku_id GROUP BY 1
 ), godown_map AS MATERIALIZED (
 SELECT public.normalize_key(ga.alias_text) AS alias_key,count(*) matches FROM public.godown_aliases ga JOIN public.godowns g ON g.id=ga.godown_id GROUP BY 1
 ), classified AS (
 SELECT r.*,CASE
 WHEN m.matches>1 THEN 'CLASSIFICATION_CONFLICT'
 WHEN m.matches=1 AND c.scope IS NOT NULL AND c.scope NOT IN ('UNCLASSIFIED','SASV_HISTORICAL_PACK','SASV_SAMPLE') THEN 'CLASSIFICATION_CONFLICT'
 WHEN m.matches=1 AND m.sample IS TRUE THEN 'SASV_SAMPLE'
 WHEN m.matches=1 THEN 'SASV_CANONICAL_PRODUCT'
 ELSE coalesce(c.scope,'UNCLASSIFIED') END AS scope,
 coalesce(g.matches,0)<>1 AS godown_unresolved
 FROM raw r JOIN labels l ON l.tally_item_name=r.tally_item_name JOIN locations d ON d.godown_label=r.godown_label
 LEFT JOIN sku_map m ON m.alias_key=l.alias_key
 LEFT JOIN godown_map g ON g.alias_key=d.alias_key
 LEFT JOIN scope_periods c ON c.alias_key=l.alias_key AND c.effective_from<=r.voucher_date AND (c.next_effective_from IS NULL OR r.voucher_date<c.next_effective_from)
 ), grouped AS (
 SELECT scope,sum(n) recorded_rows,sum(missing) missing_amount_rows,sum(amount) source_reported_amount,CASE WHEN sum(missing)=0 THEN sum(amount) END billed_value,
 coalesce(sum(n) FILTER(WHERE godown_unresolved),0) godown_unresolved_rows FROM classified GROUP BY scope
 ), totals AS (
 SELECT coalesce(sum(n),0) recorded_rows,coalesce(sum(missing),0) missing_amount_rows,sum(amount) source_reported_amount,CASE WHEN sum(missing)=0 THEN sum(amount) END billed_value,coalesce(sum(n) FILTER(WHERE godown_unresolved),0) godown_unresolved_rows FROM classified
 )
 SELECT jsonb_build_object('anchor',a,'start_date',first_date,'latest_raw_date',latest,'facility',to_jsonb(totals),
 'rows',(SELECT coalesce(jsonb_agg(to_jsonb(grouped) ORDER BY scope),'[]'::jsonb) FROM grouped),
 'import_completeness','NOT_CERTIFIED','ownership_classification','CANONICAL_MASTER_AND_OWNER_APPROVED_SCOPE','scope_note','Canonical catalog includes all existing SKUs; transaction values are classified once; missing godown mapping is an independent diagnostic; conflicts are excluded from certified product scope.')
 INTO result FROM totals;
 RETURN result;
END $$;
COMMIT;
