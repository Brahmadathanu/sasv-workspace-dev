-- R8 Finance ageing: current outstanding snapshot, configurable bill age.
-- Scope-local sign normalization reproduces existing abs(net Tally) totals;
-- opposite net parties are offsets at group level, not additive absolute party totals.
-- Undated lines survive age ranges, including undated-only parties.
CREATE FUNCTION public.get_mis_finance_ageing_summary(p_as_of date DEFAULT NULL, p_basis text DEFAULT 'bill_date', p_bounds int[] DEFAULT '{30,60,90}', p_age_min int DEFAULT NULL, p_age_max int DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_as_of date; v_result jsonb;
BEGIN
IF p_basis IS DISTINCT FROM 'bill_date' OR p_bounds IS NULL OR array_ndims(p_bounds) IS DISTINCT FROM 1 OR cardinality(p_bounds) NOT BETWEEN 1 AND 5 OR EXISTS (SELECT 1 FROM unnest(p_bounds) WITH ORDINALITY x(v,i) WHERE v IS NULL OR v NOT BETWEEN 1 AND 3650 OR (i>1 AND v <= p_bounds[array_lower(p_bounds,1)+i::int-2])) OR coalesce(p_age_min,0)<0 OR coalesce(p_age_max,0)<0 OR p_age_min>p_age_max THEN RAISE EXCEPTION 'Invalid ageing basis, bounds or age range' USING ERRCODE='22023'; END IF;
IF NOT public.ei_can_read_executive() THEN RAISE EXCEPTION 'Executive Intelligence access required' USING ERRCODE='42501'; END IF;
SELECT coalesce(p_as_of,(SELECT financial_position_date FROM public.mv_mis_executive_summary LIMIT 1)) INTO v_as_of;
IF v_as_of IS NULL OR NOT isfinite(v_as_of) THEN RAISE EXCEPTION 'Invalid or unavailable financial position date' USING ERRCODE='22023'; END IF;
WITH raw AS MATERIALIZED (
 SELECT d.party_name AS pn,d.mis_group_name AS gn,d.outstanding_amount_tally_value AS amt,
 CASE WHEN nullif(btrim(d.bill_ref),'') IS NOT NULL AND btrim(d.bill_ref) !~* '^on[ -]?account$' THEN regexp_match(lower(btrim(d.bill_date_text)), '^([0-9]{1,2})-([a-z]{3})-([0-9]{2}|[0-9]{4})$') END AS m
 FROM public.v_mis_finance_outstanding_detail d
 
), parts AS (
 SELECT *, CASE WHEN length(m[3])=2 THEN 2000+m[3]::int ELSE m[3]::int END AS yr, array_position(ARRAY['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],m[2]) AS mo, m[1]::int AS dy FROM raw
), dates AS (
 SELECT *, CASE WHEN yr BETWEEN 1 AND 9999 AND mo BETWEEN 1 AND 12 AND dy BETWEEN 1 AND 31 THEN make_date(yr,mo,1)+dy-1 END AS candidate FROM parts
), aged AS (
 SELECT pn,gn,amt,CASE WHEN extract(month FROM candidate)=mo THEN v_as_of-candidate END AS age FROM dates
), filtered AS MATERIALIZED (
 SELECT *,CASE WHEN age IS NOT NULL THEN (SELECT count(*)::int FROM unnest(p_bounds) b WHERE age>b) END AS bi
 FROM aged WHERE age IS NULL OR ((p_age_min IS NULL OR age>=p_age_min) AND (p_age_max IS NULL OR age<=p_age_max))
), scoped AS MATERIALIZED (
 SELECT *, CASE WHEN sum(amt) OVER (PARTITION BY gn)<0 THEN -1 ELSE 1 END AS polarity FROM filtered
), totals AS (
 SELECT gn, count(*) AS bc,count(DISTINCT pn) AS pc,sum(amt) AS signed_total,sum(amt*polarity) AS total,
 max(age) AS oldest, sum(age::numeric*amt*polarity) FILTER(WHERE age IS NOT NULL AND amt*polarity>0)/nullif(sum(amt*polarity) FILTER(WHERE age IS NOT NULL AND amt*polarity>0),0) AS avg_age,
 coalesce(sum(amt*polarity) FILTER(WHERE age IS NULL),0) AS undated,count(*) FILTER(WHERE age IS NULL) AS uc
 FROM scoped GROUP BY gn
), buckets AS (
 SELECT gn,bi,sum(amt*polarity) AS amount,count(*)::int AS cnt FROM scoped WHERE bi IS NOT NULL GROUP BY gn,bi
), result_rows AS (
 SELECT t.*,ARRAY(SELECT coalesce(b.amount,0) FROM generate_series(0,cardinality(p_bounds)) i LEFT JOIN buckets b ON b.bi=i AND b.gn=t.gn  ORDER BY i) AS ba,
 ARRAY(SELECT coalesce(b.cnt,0) FROM generate_series(0,cardinality(p_bounds)) i LEFT JOIN buckets b ON b.bi=i AND b.gn=t.gn  ORDER BY i) AS bn
 FROM totals t
)
SELECT jsonb_build_object('as_of',v_as_of,'basis',p_basis,'bounds',p_bounds,'groups',jsonb_agg(jsonb_build_object(
'group',g.k,'label',g.label,'bucket_amounts',coalesce(r.ba,array_fill(0::numeric,ARRAY[cardinality(p_bounds)+1])),'bucket_bill_counts',coalesce(r.bn,array_fill(0::int,ARRAY[cardinality(p_bounds)+1])),
'total_amount',coalesce(r.total,0),'bill_count',coalesce(r.bc,0),'party_count',coalesce(r.pc,0),'oldest_age_days',r.oldest,'weighted_avg_age_days',r.avg_age,'undated_amount',coalesce(r.undated,0),'undated_bill_count',coalesce(r.uc,0)) ORDER BY g.k)) INTO v_result
FROM (VALUES ('payables','Payables — Sundry Creditors'),('receivables','Receivables — Sundry Debtors')) g(k,label) LEFT JOIN result_rows r ON r.gn=g.label;
RETURN v_result;
END $fn$;
CREATE FUNCTION public.get_mis_finance_ageing_party_page(p_group_filter text DEFAULT 'payables',p_search text DEFAULT '',p_as_of date DEFAULT NULL, p_basis text DEFAULT 'bill_date', p_bounds int[] DEFAULT '{30,60,90}', p_age_min int DEFAULT NULL, p_age_max int DEFAULT NULL,p_limit int DEFAULT 25,p_offset int DEFAULT 0)
RETURNS TABLE(party_name text,mis_group_name text,bill_count bigint,outstanding_amount_mis_value numeric,signed_outstanding_tally_value numeric,bucket_amounts numeric[],bucket_bill_counts int[],oldest_age_days int,weighted_avg_age_days numeric,undated_amount numeric,total_rows bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_as_of date;
BEGIN
IF p_basis IS DISTINCT FROM 'bill_date' OR p_bounds IS NULL OR array_ndims(p_bounds) IS DISTINCT FROM 1 OR cardinality(p_bounds) NOT BETWEEN 1 AND 5 OR EXISTS (SELECT 1 FROM unnest(p_bounds) WITH ORDINALITY x(v,i) WHERE v IS NULL OR v NOT BETWEEN 1 AND 3650 OR (i>1 AND v <= p_bounds[array_lower(p_bounds,1)+i::int-2])) OR coalesce(p_age_min,0)<0 OR coalesce(p_age_max,0)<0 OR p_age_min>p_age_max THEN RAISE EXCEPTION 'Invalid ageing basis, bounds or age range' USING ERRCODE='22023'; END IF;
IF NOT public.ei_can_read_executive() THEN RAISE EXCEPTION 'Executive Intelligence access required' USING ERRCODE='42501'; END IF;
SELECT coalesce(p_as_of,(SELECT financial_position_date FROM public.mv_mis_executive_summary LIMIT 1)) INTO v_as_of;
IF v_as_of IS NULL OR NOT isfinite(v_as_of) THEN RAISE EXCEPTION 'Invalid or unavailable financial position date' USING ERRCODE='22023'; END IF;
IF p_group_filter IS NULL OR p_group_filter NOT IN ('payables','receivables','all') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid group or pagination' USING ERRCODE='22023'; END IF;
RETURN QUERY
WITH raw AS MATERIALIZED (
 SELECT d.party_name AS pn,d.mis_group_name AS gn,d.outstanding_amount_tally_value AS amt,
 CASE WHEN nullif(btrim(d.bill_ref),'') IS NOT NULL AND btrim(d.bill_ref) !~* '^on[ -]?account$' THEN regexp_match(lower(btrim(d.bill_date_text)), '^([0-9]{1,2})-([a-z]{3})-([0-9]{2}|[0-9]{4})$') END AS m
 FROM public.v_mis_finance_outstanding_detail d
 WHERE (p_group_filter='all' OR (p_group_filter='payables' AND d.group_name='Sundry Creditors') OR (p_group_filter='receivables' AND d.group_name='Sundry Debtors')) AND (coalesce(btrim(p_search),'')='' OR d.party_name ILIKE '%'||btrim(p_search)||'%' OR d.mis_group_name ILIKE '%'||btrim(p_search)||'%')
), parts AS (
 SELECT *, CASE WHEN length(m[3])=2 THEN 2000+m[3]::int ELSE m[3]::int END AS yr, array_position(ARRAY['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],m[2]) AS mo, m[1]::int AS dy FROM raw
), dates AS (
 SELECT *, CASE WHEN yr BETWEEN 1 AND 9999 AND mo BETWEEN 1 AND 12 AND dy BETWEEN 1 AND 31 THEN make_date(yr,mo,1)+dy-1 END AS candidate FROM parts
), aged AS (
 SELECT pn,gn,amt,CASE WHEN extract(month FROM candidate)=mo THEN v_as_of-candidate END AS age FROM dates
), filtered AS MATERIALIZED (
 SELECT *,CASE WHEN age IS NOT NULL THEN (SELECT count(*)::int FROM unnest(p_bounds) b WHERE age>b) END AS bi
 FROM aged WHERE age IS NULL OR ((p_age_min IS NULL OR age>=p_age_min) AND (p_age_max IS NULL OR age<=p_age_max))
), scoped AS MATERIALIZED (
 SELECT *, CASE WHEN sum(amt) OVER (PARTITION BY gn,pn)<0 THEN -1 ELSE 1 END AS polarity FROM filtered
), totals AS (
 SELECT gn,pn, count(*) AS bc,count(DISTINCT pn) AS pc,sum(amt) AS signed_total,sum(amt*polarity) AS total,
 max(age) AS oldest, sum(age::numeric*amt*polarity) FILTER(WHERE age IS NOT NULL AND amt*polarity>0)/nullif(sum(amt*polarity) FILTER(WHERE age IS NOT NULL AND amt*polarity>0),0) AS avg_age,
 coalesce(sum(amt*polarity) FILTER(WHERE age IS NULL),0) AS undated,count(*) FILTER(WHERE age IS NULL) AS uc
 FROM scoped GROUP BY gn,pn
), buckets AS (
 SELECT gn,pn,bi,sum(amt*polarity) AS amount,count(*)::int AS cnt FROM scoped WHERE bi IS NOT NULL GROUP BY gn,pn,bi
), result_rows AS (
 SELECT t.*,ARRAY(SELECT coalesce(b.amount,0) FROM generate_series(0,cardinality(p_bounds)) i LEFT JOIN buckets b ON b.bi=i AND b.gn=t.gn AND b.pn IS NOT DISTINCT FROM t.pn ORDER BY i) AS ba,
 ARRAY(SELECT coalesce(b.cnt,0) FROM generate_series(0,cardinality(p_bounds)) i LEFT JOIN buckets b ON b.bi=i AND b.gn=t.gn AND b.pn IS NOT DISTINCT FROM t.pn ORDER BY i) AS bn
 FROM totals t
)
SELECT r.pn,r.gn,r.bc,r.total,r.signed_total,r.ba,r.bn,r.oldest,r.avg_age,r.undated,count(*) OVER() FROM result_rows r ORDER BY r.total DESC,r.pn,r.gn LIMIT p_limit OFFSET p_offset;
END $fn$;
REVOKE ALL ON FUNCTION public.get_mis_finance_ageing_summary(date,text,int[],int,int),public.get_mis_finance_ageing_party_page(text,text,date,text,int[],int,int,int,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_mis_finance_ageing_summary(date,text,int[],int,int),public.get_mis_finance_ageing_party_page(text,text,date,text,int[],int,int,int,int) TO authenticated,service_role;
COMMENT ON FUNCTION public.get_mis_finance_ageing_summary(date,text,int[],int,int) IS 'Age of latest outstanding snapshot; as_of changes age only, not historical balances. Signed net by group.';
COMMENT ON FUNCTION public.get_mis_finance_ageing_party_page(text,text,date,text,int[],int,int,int,int) IS 'Age of latest outstanding snapshot; signed net normalized independently per party. Undated retained.';

DO $check$
DECLARE j jsonb; g jsonb; s record; n bigint; mismatch bigint; pos numeric;
BEGIN
j:=public.get_mis_finance_ageing_summary();
SELECT * INTO s FROM public.v_mis_finance_tab_summary;
FOR g IN SELECT value FROM jsonb_array_elements(j->'groups') LOOP
SELECT coalesce(sum(value::numeric),0) INTO pos FROM jsonb_array_elements_text(g->'bucket_amounts');
IF pos+(g->>'undated_amount')::numeric IS DISTINCT FROM (g->>'total_amount')::numeric OR (g->>'total_amount')::numeric IS DISTINCT FROM (CASE WHEN g->>'group'='payables' THEN s.payables_sundry_creditors ELSE s.receivables_sundry_debtors END) THEN RAISE EXCEPTION 'Group reconciliation failed'; END IF;
END LOOP;
SELECT count(*) INTO mismatch FROM public.get_mis_finance_ageing_party_page('all', '',NULL,'bill_date','{30,60,90}',NULL,NULL,200,0) a JOIN public.v_mis_finance_outstanding_party_summary b USING(party_name,mis_group_name) WHERE a.outstanding_amount_mis_value IS DISTINCT FROM b.outstanding_amount_mis_value OR (SELECT sum(x) FROM unnest(a.bucket_amounts) x)+a.undated_amount IS DISTINCT FROM a.outstanding_amount_mis_value;
IF mismatch<>0 THEN RAISE EXCEPTION 'Party reconciliation failed'; END IF;
END $check$;