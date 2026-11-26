-- Recovery only after separately authorized retirement. Captured original definitions and exact effective grants.
BEGIN;
CREATE VIEW public.v_sdv_exc_zero_sellers_3m WITH (security_invoker=true) AS
 WITH anchor AS (
         SELECT date_trunc('month'::text, now())::date AS anchor_month
        ), month_window AS (
         SELECT (( SELECT anchor.anchor_month
                   FROM anchor)) - '2 mons'::interval AS start_month,
            ( SELECT anchor.anchor_month
                   FROM anchor) AS end_month
        ), last_3m AS (
         SELECT se.sku_id,
            se.product_id,
            se.product_name,
            sum(se.qty_billed) AS qty_billed_3m
           FROM v_sdv_sales_enriched se
             JOIN month_window w ON se.month_start >= w.start_month AND se.month_start <= w.end_month
          GROUP BY se.sku_id, se.product_id, se.product_name
        ), all_skus AS (
         SELECT DISTINCT v_sdv_sales_enriched.sku_id,
            v_sdv_sales_enriched.product_id,
            v_sdv_sales_enriched.product_name
           FROM v_sdv_sales_enriched
        )
 SELECT a.sku_id,
    a.product_id,
    a.product_name
   FROM all_skus a
     LEFT JOIN last_3m z USING (sku_id, product_id, product_name)
  WHERE COALESCE(z.qty_billed_3m, 0::numeric) = 0::numeric
  ORDER BY a.product_name;;
ALTER VIEW public.v_sdv_exc_zero_sellers_3m OWNER TO postgres;
REVOKE ALL ON public.v_sdv_exc_zero_sellers_3m FROM PUBLIC,anon,authenticated,service_role;
GRANT MAINTAIN ON public.v_sdv_exc_zero_sellers_3m TO anon;
GRANT SELECT, MAINTAIN ON public.v_sdv_exc_zero_sellers_3m TO authenticated;
GRANT ALL ON public.v_sdv_exc_zero_sellers_3m TO service_role;

CREATE VIEW public.v_sdv_freshness WITH (security_invoker=true) AS
 SELECT max(source_max_inserted_at) AS max_source_at,
        CASE
            WHEN max(source_max_inserted_at) >= (now() - '2 days'::interval) THEN 'green'::text
            WHEN max(source_max_inserted_at) >= (now() - '7 days'::interval) THEN 'amber'::text
            ELSE 'red'::text
        END AS freshness_status
   FROM v_sdv_sales_enriched;;
ALTER VIEW public.v_sdv_freshness OWNER TO postgres;
REVOKE ALL ON public.v_sdv_freshness FROM PUBLIC,anon,authenticated,service_role;
GRANT MAINTAIN ON public.v_sdv_freshness TO anon;
GRANT SELECT, MAINTAIN ON public.v_sdv_freshness TO authenticated;
GRANT ALL ON public.v_sdv_freshness TO service_role;

CREATE VIEW public.v_sdv_rollup_month_category WITH (security_invoker=true) AS
 SELECT month_start,
    calendar_year,
    calendar_month_no,
    category_id,
    category_name,
    subcategory_id,
    subcategory_name,
    sum(qty_billed) AS qty_billed,
    sum(qty_units) AS qty_units,
    sum(qty_base) AS qty_base,
    sum(billed_amount) AS billed_amount
   FROM v_sdv_sales_enriched
  GROUP BY month_start, calendar_year, calendar_month_no, category_id, category_name, subcategory_id, subcategory_name
  ORDER BY month_start, category_name, subcategory_name;;
ALTER VIEW public.v_sdv_rollup_month_category OWNER TO postgres;
REVOKE ALL ON public.v_sdv_rollup_month_category FROM PUBLIC,anon,authenticated,service_role;
GRANT MAINTAIN ON public.v_sdv_rollup_month_category TO anon;
GRANT SELECT, MAINTAIN ON public.v_sdv_rollup_month_category TO authenticated;
GRANT ALL ON public.v_sdv_rollup_month_category TO service_role;

CREATE VIEW public.v_sdv_rollup_month_godown_group WITH (security_invoker=true) AS
 SELECT month_start,
    calendar_year,
    calendar_month_no,
    godown_id,
    godown_name,
    product_group_id,
    group_name,
    sum(qty_billed) AS qty_billed,
    sum(qty_units) AS qty_units,
    sum(qty_base) AS qty_base,
    sum(billed_amount) AS billed_amount
   FROM v_sdv_sales_enriched
  GROUP BY month_start, calendar_year, calendar_month_no, godown_id, godown_name, product_group_id, group_name
  ORDER BY month_start, godown_name, group_name;;
ALTER VIEW public.v_sdv_rollup_month_godown_group OWNER TO postgres;
REVOKE ALL ON public.v_sdv_rollup_month_godown_group FROM PUBLIC,anon,authenticated,service_role;
GRANT MAINTAIN ON public.v_sdv_rollup_month_godown_group TO anon;
GRANT SELECT, MAINTAIN ON public.v_sdv_rollup_month_godown_group TO authenticated;
GRANT ALL ON public.v_sdv_rollup_month_godown_group TO service_role;

CREATE VIEW public.v_sdv_rollup_month_region WITH (security_invoker=true) AS
 SELECT month_start,
    calendar_year,
    calendar_month_no,
    region_id,
    region_code,
    region_name,
    sum(qty_billed) AS qty_billed,
    sum(qty_units) AS qty_units,
    sum(qty_base) AS qty_base,
    sum(billed_amount) AS billed_amount
   FROM v_sdv_sales_enriched
  GROUP BY month_start, calendar_year, calendar_month_no, region_id, region_code, region_name
  ORDER BY month_start, region_code;;
ALTER VIEW public.v_sdv_rollup_month_region OWNER TO postgres;
REVOKE ALL ON public.v_sdv_rollup_month_region FROM PUBLIC,anon,authenticated,service_role;
GRANT MAINTAIN ON public.v_sdv_rollup_month_region TO anon;
GRANT SELECT, MAINTAIN ON public.v_sdv_rollup_month_region TO authenticated;
GRANT ALL ON public.v_sdv_rollup_month_region TO service_role;

CREATE VIEW public.v_sdv_rollup_month_sku WITH (security_invoker=true) AS
 SELECT month_start,
    calendar_year,
    calendar_month_no,
    sku_id,
    product_id,
    product_name,
    sum(qty_billed) AS qty_billed,
    sum(qty_units) AS qty_units,
    sum(qty_base) AS qty_base,
    sum(billed_amount) AS billed_amount
   FROM v_sdv_sales_enriched
  GROUP BY month_start, calendar_year, calendar_month_no, sku_id, product_id, product_name
  ORDER BY month_start, product_name;;
ALTER VIEW public.v_sdv_rollup_month_sku OWNER TO postgres;
REVOKE ALL ON public.v_sdv_rollup_month_sku FROM PUBLIC,anon,authenticated,service_role;
GRANT MAINTAIN ON public.v_sdv_rollup_month_sku TO anon;
GRANT SELECT, MAINTAIN ON public.v_sdv_rollup_month_sku TO authenticated;
GRANT ALL ON public.v_sdv_rollup_month_sku TO service_role;
CREATE OR REPLACE FUNCTION public.sdv_zero_revenue_abs(p_anchor_date date, p_months integer, p_region_id integer DEFAULT NULL::integer, p_godown_id integer DEFAULT NULL::integer, p_active_only boolean DEFAULT true)
 RETURNS TABLE(sku_id integer, product_id integer, product_name text, is_active boolean)
 LANGUAGE sql
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
WITH months AS (
  SELECT generate_series(date_trunc('month', p_anchor_date)::date - (p_months - 1) * interval '1 month',
                         date_trunc('month', p_anchor_date)::date,
                         interval '1 month')::date AS month_start
),
sales AS (
  SELECT s.sku_id, s.product_id, s.month_start, s.billed_amount
  FROM v_sdv_sales_enriched s
  JOIN months m USING (month_start)
  WHERE (p_region_id IS NULL OR s.region_id = p_region_id)
    AND (p_godown_id IS NULL OR s.godown_id = p_godown_id)
),
base AS (
  SELECT ps.id AS sku_id, ps.product_id, p.item AS product_name, ps.is_active
  FROM product_skus ps JOIN products p ON p.id = ps.product_id
)
SELECT b.sku_id, b.product_id, b.product_name, b.is_active
FROM base b
LEFT JOIN sales x ON x.sku_id = b.sku_id
GROUP BY b.sku_id, b.product_id, b.product_name, b.is_active
HAVING COALESCE(SUM(x.billed_amount),0) = 0
   AND (NOT p_active_only OR b.is_active = TRUE)
ORDER BY b.product_name;
$function$;
ALTER FUNCTION public.sdv_zero_revenue_abs(date,integer,integer,integer,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sdv_zero_revenue_abs(date,integer,integer,integer,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sdv_zero_revenue_abs(date,integer,integer,integer,boolean) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.sdv_zero_sellers_abs(p_anchor_date date, p_months integer, p_region_id integer DEFAULT NULL::integer, p_godown_id integer DEFAULT NULL::integer, p_active_only boolean DEFAULT true)
 RETURNS TABLE(sku_id integer, product_id integer, product_name text, is_active boolean)
 LANGUAGE sql
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
with months as (
  select generate_series(
           date_trunc('month', p_anchor_date)::date - (p_months - 1) * interval '1 month',
           date_trunc('month', p_anchor_date)::date,
           interval '1 month'
         )::date as month_start
),
sales as (
  select s.sku_id, s.product_id, s.month_start, s.qty_billed
  from sales_monthly s
  join months m using (month_start)
  where (p_region_id is null or s.region_id = p_region_id)
    and (p_godown_id is null or s.godown_id = p_godown_id)
),
base as (
  select ps.id as sku_id, ps.product_id, p.item as product_name, ps.is_active
  from product_skus ps
  join products p on p.id = ps.product_id
  -- keep all SKUs; we'll filter to active if requested in the final select
)
select b.sku_id, b.product_id, b.product_name, b.is_active
from base b
left join sales x on x.sku_id = b.sku_id
group by b.sku_id, b.product_id, b.product_name, b.is_active
having coalesce(sum(x.qty_billed), 0) = 0
   and (not p_active_only or b.is_active = true)
order by b.product_name;
$function$;
ALTER FUNCTION public.sdv_zero_sellers_abs(date,integer,integer,integer,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sdv_zero_sellers_abs(date,integer,integer,integer,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sdv_zero_sellers_abs(date,integer,integer,integer,boolean) TO authenticated,service_role;
COMMIT;
