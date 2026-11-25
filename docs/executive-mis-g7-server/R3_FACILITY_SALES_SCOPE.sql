-- Review only; additive contract. No product, alias or transaction mutations.
BEGIN;
CREATE FUNCTION public.ei_facility_sales_scope(p_anchor date DEFAULT NULL,p_months integer DEFAULT 1)
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
 WITH classified AS (
 SELECT s.id,s.billed_amount_value,
 CASE WHEN NOT EXISTS(SELECT 1 FROM public.sku_aliases sa JOIN public.product_skus k ON k.id=sa.sku_id WHERE public.normalize_key(sa.alias_text)=public.normalize_key(s.tally_item_name))
 THEN 'SKU_MAPPING_UNRESOLVED'
 WHEN NOT EXISTS(SELECT 1 FROM public.godown_aliases ga JOIN public.godowns g ON g.id=ga.godown_id WHERE public.normalize_key(ga.alias_text)=public.normalize_key(s.godown_label))
 THEN 'GODOWN_MAPPING_UNRESOLVED'
 ELSE 'MAPPED_PRODUCT_SCOPE' END AS scope
 FROM public.tally_sales_vreg_snapshot s WHERE s.voucher_date BETWEEN first_date AND a
 ), grouped AS (
 SELECT scope,count(*) AS recorded_rows,count(*) FILTER(WHERE billed_amount_value IS NULL) AS missing_amount_rows,sum(billed_amount_value) AS source_reported_amount,
 CASE WHEN count(*) FILTER(WHERE billed_amount_value IS NULL)=0 THEN sum(billed_amount_value) END AS billed_value FROM classified GROUP BY scope
 ), totals AS (
 SELECT count(*) AS recorded_rows,count(*) FILTER(WHERE billed_amount_value IS NULL) AS missing_amount_rows,sum(billed_amount_value) AS source_reported_amount,
 CASE WHEN count(*) FILTER(WHERE billed_amount_value IS NULL)=0 THEN sum(billed_amount_value) END AS billed_value FROM classified
 )
 SELECT jsonb_build_object('anchor',a,'start_date',first_date,'latest_raw_date',latest,'facility',to_jsonb(totals),
 'rows',(SELECT coalesce(jsonb_agg(to_jsonb(grouped) ORDER BY scope),'[]'::jsonb) FROM grouped),
 'import_completeness','NOT_CERTIFIED','ownership_classification','NOT_AVAILABLE_IN_CANONICAL_MASTER','scope_note','Unresolved SKU mapping may represent other parent-organization manufacturing units or other transactions; not automatically a defect. Mapped product scope is not independently certified manufacturing ownership.')
 INTO result FROM totals;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ei_facility_sales_scope(date,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ei_facility_sales_scope(date,integer) TO authenticated;
COMMIT;
