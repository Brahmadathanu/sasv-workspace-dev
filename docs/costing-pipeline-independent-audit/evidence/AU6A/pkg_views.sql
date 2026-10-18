set search_path to costing, public;
create view costing.v_sku_sales_volume_allocation_basis as WITH periods AS (
         SELECT cost_periods.period_start
           FROM costing.cost_periods
          WHERE cost_periods.status = ANY (ARRAY['OPEN'::text, 'LOCKED'::text])
        ), active_skus AS (
         SELECT ps.id AS sku_id,
            ps.product_id,
            p_1.item AS product_name,
            p_1.uom_base AS product_base_uom,
            p_1.conversion_to_base,
            ps.pack_size,
            ps.uom AS pack_uom,
            COALESCE(ps.pack_size, 0::numeric) * COALESCE(p_1.conversion_to_base, 1::numeric) AS sku_base_qty_per_unit
           FROM product_skus ps
             JOIN products p_1 ON p_1.id = ps.product_id
          WHERE ps.is_active = true AND COALESCE(p_1.status, ''::text) ~~* 'active'::text
        ), sku_sales_12m AS (
         SELECT pr.period_start,
            s_1.sku_id,
            s_1.product_id,
            s_1.product_name,
            s_1.product_base_uom,
            s_1.conversion_to_base,
            s_1.pack_size,
            s_1.pack_uom,
            s_1.sku_base_qty_per_unit,
            COALESCE(sum(COALESCE(v.qty_clean, 0::numeric)), 0::numeric) AS sales_units_12m,
            COALESCE(sum(COALESCE(v.qty_clean, 0::numeric)), 0::numeric) * COALESCE(s_1.sku_base_qty_per_unit, 0::numeric) AS sales_base_qty_12m
           FROM periods pr
             CROSS JOIN active_skus s_1
             LEFT JOIN v_sales_monthly_clean v ON v.sku_id = s_1.sku_id AND v.month_start >= (pr.period_start - '1 year'::interval) AND v.month_start < pr.period_start
          GROUP BY pr.period_start, s_1.sku_id, s_1.product_id, s_1.product_name, s_1.product_base_uom, s_1.conversion_to_base, s_1.pack_size, s_1.pack_uom, s_1.sku_base_qty_per_unit
        ), product_sales_12m AS (
         SELECT sku_sales_12m.period_start,
            sku_sales_12m.product_id,
            sum(sku_sales_12m.sales_units_12m) AS product_sales_units_12m,
            sum(sku_sales_12m.sales_base_qty_12m) AS product_sales_base_qty_12m
           FROM sku_sales_12m
          GROUP BY sku_sales_12m.period_start, sku_sales_12m.product_id
        ), company_sales_12m AS (
         SELECT product_sales_12m.period_start,
            sum(product_sales_12m.product_sales_units_12m) AS company_sales_units_12m
           FROM product_sales_12m
          GROUP BY product_sales_12m.period_start
        )
 SELECT s.period_start,
    s.sku_id,
    s.product_id,
    s.product_name,
    s.product_base_uom,
    s.conversion_to_base,
    s.pack_size,
    s.pack_uom,
    s.sku_base_qty_per_unit,
    s.sales_units_12m,
    s.sales_base_qty_12m,
    p.product_sales_units_12m,
    p.product_sales_base_qty_12m,
    c.company_sales_units_12m,
        CASE
            WHEN c.company_sales_units_12m > 0::numeric THEN p.product_sales_units_12m / c.company_sales_units_12m
            ELSE 0::numeric
        END AS product_allocation_share,
        CASE
            WHEN c.company_sales_units_12m IS NULL OR c.company_sales_units_12m = 0::numeric THEN 'NO_TOTAL_SALES_BASIS'::text
            WHEN p.product_sales_units_12m = 0::numeric THEN 'NO_PRODUCT_SALES_IN_LOOKBACK'::text
            WHEN s.sales_units_12m = 0::numeric THEN 'NO_SKU_SALES_IN_LOOKBACK'::text
            WHEN p.product_sales_base_qty_12m = 0::numeric THEN 'NO_PRODUCT_BASE_QTY'::text
            ELSE 'OK'::text
        END AS allocation_basis_status,
    (s.period_start - '1 year'::interval)::date AS lookback_start,
    (s.period_start - '1 mon'::interval)::date AS lookback_end
   FROM sku_sales_12m s
     JOIN product_sales_12m p ON p.period_start = s.period_start AND p.product_id = s.product_id
     JOIN company_sales_12m c ON c.period_start = s.period_start;
set search_path to public;
create view public.v_sku_to_base_multiplier as
 WITH uom_map AS (
         SELECT inv_uom.id,
            inv_uom.code
           FROM inv_uom
        ), sku_uom AS (
         SELECT ps.id AS sku_id,
            ps.product_id,
            ps.pack_size,
            ps.uom AS sku_uom_code,
            u.id AS sku_uom_id
           FROM product_skus ps
             JOIN uom_map u ON u.code = ps.uom
        ), prod_uom AS (
         SELECT p_1.id AS product_id,
            p_1.uom_base AS prod_uom_code,
            u.id AS prod_uom_id,
            COALESCE(p_1.conversion_to_base, 1::numeric) AS prod_conv_to_base
           FROM products p_1
             JOIN uom_map u ON u.code = p_1.uom_base
        )
 SELECT s.sku_id,
    s.product_id,
    p.prod_uom_code AS product_base_uom,
    s.pack_size,
    s.sku_uom_code AS sku_uom,
    COALESCE(
        CASE
            WHEN s.sku_uom_id = p.prod_uom_id THEN 1::numeric
            ELSE NULL::numeric
        END, c.factor)::numeric(18,6) AS uom_factor,
    (s.pack_size * COALESCE(
        CASE
            WHEN s.sku_uom_id = p.prod_uom_id THEN 1::numeric
            ELSE NULL::numeric
        END, c.factor) * p.prod_conv_to_base)::numeric(18,6) AS base_qty_per_sku_unit
   FROM sku_uom s
     JOIN prod_uom p ON p.product_id = s.product_id
     LEFT JOIN inv_uom_conversion c ON c.from_uom_id = s.sku_uom_id AND c.to_uom_id = p.prod_uom_id;
reset search_path;
