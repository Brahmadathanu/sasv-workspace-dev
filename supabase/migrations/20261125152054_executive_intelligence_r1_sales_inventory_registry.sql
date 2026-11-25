-- REVIEW ONLY. Execute immediately before the exact candidate in the same atomic install transaction, only after owner approval.
-- Fail closed on catalog drift; no global settings.
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = public, extensions;
DO $r1_guard$
DECLARE mismatch text;
BEGIN
  WITH expected(kind, identity, sha) AS (VALUES
    ('function','public.get_mis_inventory_item_page(text,text,integer,integer)','3383c460f864d40eff648b1df7d1469d434685aa70fa095b9f55a108ac16aafc'),
    ('function','public.get_mis_sales_product_page(text,integer,integer)','fac5a2ca998a11ac69bb2407ab9e6adfe16e058546836d43649c02c726034ae3'),
    ('view','public.v_mis_inventory_tab_summary','f9832eb89c6f626ab2e6c5c62aa88dc85b4169d3d6f18abfdec53a148f97734e'),
    ('view','public.v_mis_sales_tab_summary','4e4735948445b2d49dd853a1cd42d7942f326e4edf318475bc22ee7d2b1bbcff')
  ), actual AS (
    SELECT *, encode(sha256(convert_to(CASE WHEN kind='function'
      THEN pg_get_functiondef(to_regprocedure(identity))
      ELSE pg_get_viewdef(to_regclass(identity),true) END,'UTF8')),'hex') actual_sha FROM expected
  ) SELECT string_agg(identity, ', ') INTO mismatch FROM actual WHERE actual_sha IS DISTINCT FROM sha;
  IF mismatch IS NOT NULL THEN RAISE EXCEPTION 'R1 baseline drift: %', mismatch; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid IN ('public.get_mis_inventory_item_page(text,text,integer,integer)'::regprocedure,'public.get_mis_sales_product_page(text,integer,integer)'::regprocedure)
    AND (p.prosecdef OR p.provolatile <> 's' OR pg_get_userbyid(p.proowner) <> 'postgres'
    OR has_function_privilege('anon',p.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR NOT has_function_privilege('service_role',p.oid,'EXECUTE')))
    THEN RAISE EXCEPTION 'R1 RPC security drift'; END IF;
  IF EXISTS (SELECT 1 FROM pg_class c WHERE c.oid IN ('public.v_mis_inventory_tab_summary'::regclass,'public.v_mis_sales_tab_summary'::regclass)
    AND (NOT coalesce(c.reloptions @> ARRAY['security_invoker=true'],false) OR pg_get_userbyid(c.relowner) <> 'postgres'
    OR has_table_privilege('anon',c.oid,'SELECT') OR NOT has_table_privilege('authenticated',c.oid,'SELECT') OR NOT has_table_privilege('service_role',c.oid,'SELECT')))
    THEN RAISE EXCEPTION 'R1 view security drift'; END IF;
END $r1_guard$;

-- R1 forward DDL body. REVIEW ONLY: do not execute in production until exact preflight, isolated PG acceptance and explicit owner authorization.
-- Existing API signatures, legacy summary columns, labels and filters remain. New canonical fields append to the same view.
CREATE OR REPLACE VIEW public.v_mis_sales_tab_summary WITH (security_invoker=true) AS
WITH latest_sales AS (
         SELECT (SELECT sales_date FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1) AS report_date
        ), periods AS (
         SELECT latest_sales.report_date,
            date_trunc('month'::text, latest_sales.report_date::timestamp with time zone)::date AS month_start,
            latest_sales.report_date AS month_upto_date
           FROM latest_sales
        ), sales_base AS (
         SELECT s_1.sales_date,
            s_1.sku_id,
            s_1.product_id,
            s_1.godown_id,
            s_1.region_id,
            s_1.qty_units,
            s_1.qty_billed,
            s_1.billed_amount,
            s_1.source_key,
            s_1.inserted_at
           FROM v_sales_daily_normalized s_1
             CROSS JOIN periods p_1
          WHERE s_1.sales_date >= p_1.month_start AND s_1.sales_date <= p_1.month_upto_date
        )
 SELECT p.report_date,
    p.month_start,
    p.month_upto_date,
    sum(s.billed_amount) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_sales_value,
    sum(s.qty_units) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_sales_units,
    sum(s.qty_billed) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_billed_units,
    sum(s.billed_amount) AS month_to_date_sales_value,
    sum(s.qty_units) AS month_to_date_sales_units,
    sum(s.qty_billed) AS month_to_date_billed_units,
    count(DISTINCT s.sales_date) AS sales_days_available_in_month,
    count(DISTINCT s.product_id) AS products_sold_month_to_date,
    count(DISTINCT s.sku_id) AS skus_sold_month_to_date,
        CASE
            WHEN count(DISTINCT s.sales_date) > 0 THEN sum(s.billed_amount) / count(DISTINCT s.sales_date)::numeric
            ELSE NULL::numeric
        END AS average_daily_sales_value,
    'Sales tab summary is based on the latest available sales month from v_sales_daily_normalized. Month-to-date values cover sales from month start up to the latest available sales date.'::text AS sales_scope_note
   FROM periods p
     LEFT JOIN sales_base s ON true
  GROUP BY p.report_date, p.month_start, p.month_upto_date;
CREATE OR REPLACE FUNCTION public.get_mis_sales_product_page(p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(report_date date, month_start date, month_upto_date date, product_id bigint, product_name text, sku_count bigint, sales_value numeric, sales_units numeric, billed_units numeric, latest_day_sales_value numeric, latest_day_sales_units numeric, average_daily_sales_value numeric, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with latest_sales as (
    select (select sales_date from public.v_sales_daily_normalized where sales_date is not null order by sales_date desc limit 1) as report_date
  ),
  periods as (
    select
      report_date,
      date_trunc('month', report_date)::date as month_start,
      report_date as month_upto_date
    from latest_sales
  ),
  product_sales as (
    select
      p.report_date,
      p.month_start,
      p.month_upto_date,
      s.product_id,
      coalesce(pr.item, 'Product ID ' || s.product_id::text) as product_name,
      count(distinct s.sku_id) as sku_count,
      sum(s.billed_amount) as sales_value,
      sum(s.qty_units) as sales_units,
      sum(s.qty_billed) as billed_units,
      sum(s.billed_amount) filter (where s.sales_date = p.report_date) as latest_day_sales_value,
      sum(s.qty_units) filter (where s.sales_date = p.report_date) as latest_day_sales_units,
      case
        when count(distinct s.sales_date) > 0
        then sum(s.billed_amount) / count(distinct s.sales_date)
        else null
      end as average_daily_sales_value
    from public.v_sales_daily_normalized s
    cross join periods p
    left join public.products pr
      on pr.id = s.product_id
    where s.sales_date >= p.month_start
      and s.sales_date <= p.month_upto_date
    group by
      p.report_date,
      p.month_start,
      p.month_upto_date,
      s.product_id,
      pr.item
  ),
  filtered as (
    select *
    from product_sales
    where
      coalesce(trim(p_search), '') = ''
      or product_name ilike '%' || trim(p_search) || '%'
      or product_id::text ilike '%' || trim(p_search) || '%'
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.report_date,
    f.month_start,
    f.month_upto_date,
    f.product_id,
    f.product_name,
    f.sku_count,
    f.sales_value,
    f.sales_units,
    f.billed_units,
    f.latest_day_sales_value,
    f.latest_day_sales_units,
    f.average_daily_sales_value,
    c.total_rows
  from filtered f
  cross join counted c
  order by f.sales_value desc nulls last, f.product_name asc, f.product_id asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$
;
CREATE OR REPLACE VIEW public.v_mis_inventory_tab_summary WITH (security_invoker=true) AS
SELECT CURRENT_DATE AS report_date,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'rm'::text) AS raw_material_inventory_value,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'plm'::text) AS packing_material_inventory_value,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'consumable'::text) AS consumables_inventory_value,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'fuel'::text) AS fuel_inventory_value,
    sum(qty_value * avg_rate_value) AS manufacturing_inventory_value,
    count(*) FILTER (WHERE source_kind = 'rm'::text) AS raw_material_item_count,
    count(*) FILTER (WHERE source_kind = 'plm'::text) AS packing_material_item_count,
    count(*) FILTER (WHERE source_kind = 'consumable'::text) AS consumables_item_count,
    count(*) FILTER (WHERE source_kind = 'fuel'::text) AS fuel_item_count,
    count(*) AS total_inventory_item_count,
    'Inventory tab covers manufacturing inventory only: Raw Material, Packing Material, Consumables, and Fuel. Finished Goods inventory is handled separately in the Finished Goods tab.'::text AS inventory_scope_note,
    sum(CASE WHEN qty_value = 0 THEN 0::numeric WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0 THEN NULL::numeric ELSE qty_value * avg_rate_value END) FILTER (WHERE category_code = 'RM') AS canonical_rm_known_value,
    count(*) FILTER (WHERE category_code = 'RM') AS canonical_rm_item_count,
    count(*) FILTER (WHERE category_code = 'RM' AND (qty_value IS NULL OR (qty_value <> 0 AND (avg_rate_value IS NULL OR avg_rate_value <= 0)))) AS canonical_rm_valuation_gap_count,
    sum(CASE WHEN qty_value = 0 THEN 0::numeric WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0 THEN NULL::numeric ELSE qty_value * avg_rate_value END) FILTER (WHERE category_code = 'PM') AS canonical_pm_known_value,
    count(*) FILTER (WHERE category_code = 'PM') AS canonical_pm_item_count,
    count(*) FILTER (WHERE category_code = 'PM' AND (qty_value IS NULL OR (qty_value <> 0 AND (avg_rate_value IS NULL OR avg_rate_value <= 0)))) AS canonical_pm_valuation_gap_count,
    sum(CASE WHEN qty_value = 0 THEN 0::numeric WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0 THEN NULL::numeric ELSE qty_value * avg_rate_value END) FILTER (WHERE category_code = 'IND') AS canonical_ind_known_value,
    count(*) FILTER (WHERE category_code = 'IND') AS canonical_ind_item_count,
    count(*) FILTER (WHERE category_code = 'IND' AND (qty_value IS NULL OR (qty_value <> 0 AND (avg_rate_value IS NULL OR avg_rate_value <= 0)))) AS canonical_ind_valuation_gap_count,
    sum(CASE WHEN qty_value = 0 THEN 0::numeric WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0 THEN NULL::numeric ELSE qty_value * avg_rate_value END) AS inventory_known_value,
    sum(CASE WHEN qty_value = 0 THEN 0::numeric WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0 THEN NULL::numeric ELSE qty_value * avg_rate_value END) FILTER (WHERE category_code IS NULL OR category_code NOT IN ('RM','PM','IND')) AS unclassified_known_value,
    count(*) FILTER (WHERE category_code IS NULL OR category_code NOT IN ('RM','PM','IND')) AS unclassified_item_count,
    count(*) FILTER (WHERE qty_value IS NULL OR (qty_value <> 0 AND (avg_rate_value IS NULL OR avg_rate_value <= 0))) AS valuation_gap_item_count,
    count(*) FILTER (WHERE qty_value = 0) AS zero_quantity_item_count,
    count(inv_stock_item_id) - count(DISTINCT inv_stock_item_id) AS duplicate_item_row_count,
    count(*) FILTER (WHERE inv_stock_item_id IS NULL) AS missing_item_id_count,
    'Manufacturing inventory: RM Raw Material, PM Packing Material, IND Indirect Materials & Utilities; known values exclude valuation gaps; Finished Goods reported separately.'::text AS canonical_inventory_scope_note
 FROM public.v_stock_current_by_item;
CREATE OR REPLACE FUNCTION public.get_mis_inventory_item_page(p_source_kind text DEFAULT 'all'::text, p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(source_kind text, source_label text, inv_stock_item_id bigint, code text, item_name text, qty_value numeric, avg_rate_value numeric, stock_value numeric, category_label text, subcategory_label text, group_label text, subgroup_label text, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with base as (
    select
      source_kind,
      category_code,
      case
        when source_kind = 'rm' then 'Raw Material'
        when source_kind = 'plm' then 'Packing Material'
        when source_kind = 'consumable' then 'Consumables'
        when source_kind = 'fuel' then 'Fuel'
        else source_kind
      end as source_label,
      inv_stock_item_id,
      code,
      name as item_name,
      qty_value,
      avg_rate_value,
      CASE WHEN qty_value = 0 THEN 0::numeric WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0 THEN NULL::numeric ELSE qty_value * avg_rate_value END as stock_value,
      category_label,
      subcategory_label,
      group_label,
      subgroup_label
    from public.v_stock_current_by_item
  ),
  filtered as (
    select *
    from base
    where
      (
        p_source_kind = 'all'
        or (p_source_kind IN ('RM','PM','IND') AND category_code = p_source_kind)
        or (p_source_kind NOT IN ('RM','PM','IND') AND source_kind = p_source_kind)
      )
      and (
        coalesce(trim(p_search), '') = ''
        or code ilike '%' || trim(p_search) || '%'
        or item_name ilike '%' || trim(p_search) || '%'
        or category_label ilike '%' || trim(p_search) || '%'
        or subcategory_label ilike '%' || trim(p_search) || '%'
        or group_label ilike '%' || trim(p_search) || '%'
        or subgroup_label ilike '%' || trim(p_search) || '%'
      )
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.source_kind,
    f.source_label,
    f.inv_stock_item_id,
    f.code,
    f.item_name,
    f.qty_value,
    f.avg_rate_value,
    f.stock_value,
    f.category_label,
    f.subcategory_label,
    f.group_label,
    f.subgroup_label,
    c.total_rows
  from filtered f
  cross join counted c
  order by f.stock_value desc nulls last, f.item_name asc, f.inv_stock_item_id asc, f.source_kind asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$
;

DO $identity$
DECLARE n integer;
BEGIN
UPDATE public.app_modules SET label='Executive Intelligence',description='Performance, position and management insights' WHERE module_key='executive-mis-dashboard' AND target_key='module:executive-mis-dashboard' AND label='Executive MIS Dashboard' AND description='Executive summary of finance, sales, inventory, and production position';
GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'module identity drift'; END IF;
UPDATE public.permission_targets SET label='Executive Intelligence' WHERE key='module:executive-mis-dashboard' AND kind='module' AND label='Executive MIS Dashboard';
GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'permission identity drift'; END IF;
END $identity$;
