BEGIN;
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
 SELECT s.tally_item_name,s.godown_label,s.voucher_date,1::bigint n,(s.billed_amount_value IS NULL)::integer::bigint missing,s.billed_amount_value amount
 FROM public.tally_sales_vreg_snapshot s WHERE s.voucher_date BETWEEN first_date AND a
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
 ), classified AS MATERIALIZED (
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
