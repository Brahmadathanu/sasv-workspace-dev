-- PROPOSED (NOT APPLIED). AU-6S kit / unit-mismatch correction.
-- Keep this OUT of supabase/migrations until the user approves. Apply only via Supabase MCP apply_migration.
-- Scope: SKU 865 Kashaya Vasthi Kit (product 685) is activated.
--        SKU 878 Karkkidaka Kanji (product 695) is staged but NOT activated until its batch reference
--        (production_batch_size_ref 50,000 "Nos", flagged unverified) is confirmed. See K3.
-- Effect: the run writers honour the governed exception costing.sku_base_quantity_exception that was
--         approved on 2026-10-15 (865 -> 1 Nos, USER_CONFIRMED_KASHAYA_VASTHI_KIT_1_NOS_2026_10_15),
--         from period 2026-10-01. Sep run 122 and its period stay untouched (snapshots are immutable,
--         and the period gate excludes them).
-- Read-only test on live data (2026-10-18), ungated variant: of 3,774 view rows only 2 change, both in
--         period 2026-10-01 (865: k 275->1, 12-month base 35,475->129; 878: k 500->1). With this file's
--         gate, only 865 changes.

begin;

do $g$
begin
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then
    raise exception 'AU6S-K: a costing run is in progress';
  end if;
  if md5(pg_get_viewdef('costing.v_sku_sales_volume_allocation_basis'::regclass,true)) <> '1b3332c46400c1934fba6872a60e6a6a' then
    raise exception 'AU6S-K: allocation-basis view drifted from the reviewed definition';
  end if;
  if md5(pg_get_viewdef('public.v_sku_to_base_multiplier'::regclass,true)) <> '22cfc332dcebe754c90618259f149737' then
    raise exception 'AU6S-K: v_sku_to_base_multiplier drifted';
  end if;
  if (select count(*) from costing.sku_base_quantity_exception
       where (sku_id,product_id,sku_base_qty_per_unit,base_uom) in ((865,685,1,'Nos'),(878,695,1,'Nos'))) <> 2 then
    raise exception 'AU6S-K: governed exception rows are not as approved';
  end if;
end $g$;

-- K1a: activation date per exception. NULL means documented but not used by the costing writers.
alter table costing.sku_base_quantity_exception add column if not exists costing_effective_from date;
comment on column costing.sku_base_quantity_exception.costing_effective_from is
  'First costing period in which the run writers use sku_base_qty_per_unit. NULL = not active in runs.';
update costing.sku_base_quantity_exception set costing_effective_from = date '2026-10-01'
 where sku_id = 865 and product_id = 685 and costing_effective_from is null;
-- 878 is deliberately left NULL (see K3).

-- K1b: the allocation-basis view feeds sku_sales_allocation_basis_snapshot, which drives monthly base qty,
--      DL/POH/QC workload, pricing and the negative-margin set. Column list and order are unchanged.
create or replace view costing.v_sku_sales_volume_allocation_basis as
WITH periods AS (
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
            COALESCE(ps.pack_size, 0::numeric) * COALESCE(p_1.conversion_to_base, 1::numeric) AS sku_base_qty_per_unit,
            x.sku_base_qty_per_unit AS exception_base_qty,
            x.costing_effective_from AS exception_costing_from
           FROM product_skus ps
             JOIN products p_1 ON p_1.id = ps.product_id
             LEFT JOIN costing.sku_base_quantity_exception x ON x.sku_id = ps.id AND x.product_id = ps.product_id AND x.base_uom = p_1.uom_base
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
            CASE WHEN s_1.exception_base_qty IS NOT NULL AND s_1.exception_costing_from IS NOT NULL AND pr.period_start >= s_1.exception_costing_from THEN s_1.exception_base_qty ELSE s_1.sku_base_qty_per_unit END AS sku_base_qty_per_unit,
            COALESCE(sum(COALESCE(v.qty_clean, 0::numeric)), 0::numeric) AS sales_units_12m,
            COALESCE(sum(COALESCE(v.qty_clean, 0::numeric)), 0::numeric) * COALESCE(CASE WHEN s_1.exception_base_qty IS NOT NULL AND s_1.exception_costing_from IS NOT NULL AND pr.period_start >= s_1.exception_costing_from THEN s_1.exception_base_qty ELSE s_1.sku_base_qty_per_unit END, 0::numeric) AS sales_base_qty_12m
           FROM periods pr
             CROSS JOIN active_skus s_1
             LEFT JOIN v_sales_monthly_clean v ON v.sku_id = s_1.sku_id AND v.month_start >= (pr.period_start - '1 year'::interval) AND v.month_start < pr.period_start
          GROUP BY pr.period_start, s_1.sku_id, s_1.product_id, s_1.product_name, s_1.product_base_uom, s_1.conversion_to_base, s_1.pack_size, s_1.pack_uom, s_1.sku_base_qty_per_unit, s_1.exception_base_qty, s_1.exception_costing_from
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

do $c$
declare n int;
begin
  select count(*) into n from costing.v_sku_sales_volume_allocation_basis
   where period_start >= date '2026-10-01' and sku_id = 865 and sku_base_qty_per_unit = 1;
  if n < 1 then raise exception 'AU6S-K: 865 not resolved to 1 Nos'; end if;
  select count(*) into n from costing.v_sku_sales_volume_allocation_basis
   where (period_start < date '2026-10-01' and sku_id = 865 and sku_base_qty_per_unit <> 275)
      or (sku_id = 878 and sku_base_qty_per_unit <> 500);
  if n > 0 then raise exception 'AU6S-K: pre-October periods or 878 changed'; end if;
end $c$;

-- K4: inventory/MRP base view. There is no g->Nos UOM conversion, so 865 and 878 return NULL today.
--     Honour the exception here. This view describes the physical pack, so it is not period-gated.
--     Dependents: v_fg_stock_latest_product_region_base and v_industries_sku_canonical_rate.
--     The column list is unchanged.
create or replace view public.v_sku_to_base_multiplier as
 WITH uom_map AS (
         SELECT inv_uom.id, inv_uom.code FROM inv_uom
        ), sku_uom AS (
         SELECT ps.id AS sku_id, ps.product_id, ps.pack_size, ps.uom AS sku_uom_code, u.id AS sku_uom_id
           FROM product_skus ps JOIN uom_map u ON u.code = ps.uom
        ), prod_uom AS (
         SELECT p_1.id AS product_id, p_1.uom_base AS prod_uom_code, u.id AS prod_uom_id,
            COALESCE(p_1.conversion_to_base, 1::numeric) AS prod_conv_to_base
           FROM products p_1 JOIN uom_map u ON u.code = p_1.uom_base
        )
 SELECT s.sku_id, s.product_id, p.prod_uom_code AS product_base_uom, s.pack_size, s.sku_uom_code AS sku_uom,
    COALESCE(CASE WHEN s.sku_uom_id = p.prod_uom_id THEN 1::numeric ELSE NULL::numeric END, c.factor,
             x.sku_base_qty_per_unit / NULLIF(s.pack_size, 0))::numeric(18,6) AS uom_factor,
    COALESCE(x.sku_base_qty_per_unit,
             s.pack_size * COALESCE(CASE WHEN s.sku_uom_id = p.prod_uom_id THEN 1::numeric ELSE NULL::numeric END, c.factor) * p.prod_conv_to_base
            )::numeric(18,6) AS base_qty_per_sku_unit
   FROM sku_uom s
     JOIN prod_uom p ON p.product_id = s.product_id
     LEFT JOIN inv_uom_conversion c ON c.from_uom_id = s.sku_uom_id AND c.to_uom_id = p.prod_uom_id
     LEFT JOIN costing.sku_base_quantity_exception x
            ON x.sku_id = s.sku_id AND x.product_id = s.product_id AND x.base_uom = p.prod_uom_code;

rollback;  -- switch to COMMIT only after explicit user approval and after Jarvis is notified

-- ==========================================================================================
-- K2 (OPTIONAL consistency clean-up; material-cost neutral). Needs its own approval.
-- The BOM says "287 Nos" output with 4% loss for 685, and "500 Nos" for 695. The lines are actually the
-- grams of ONE kit/pack, entered in Kg. Material comes out right today only because two errors cancel:
-- lines / (287 x 0.96) per "Nos" x 275 "Nos" = 0.998 x lines.
-- K1 does not touch the material writers, which still use pack_size x conversion_to_base (275), so
-- material stays correct after K1.
-- Apply K2 ONLY together with switching fn_build_sku_material_cost_as_of(date,date,bigint) and
-- rpc_refresh_rm_material_cost_line_snapshots to the exception-aware base qty.
-- The BOM screen has the Apply/Save bug, so make this change by SQL only (AU-2c pattern).
-- begin;
-- update public.rm_bom_header set reference_output_qty = 1, process_loss_pct = 0, last_updated_at = now(),
--        notes = coalesce(notes||' | ','')||'AU6S-K2: 1 kit = 1 Nos; lines are gross per kit'
--  where id = 2627 and product_id = 685 and reference_output_qty = 287 and reference_output_uom_id = 5 and process_loss_pct = 0.04;
-- update public.rm_bom_header set reference_output_qty = 1, last_updated_at = now(),
--        notes = coalesce(notes||' | ','')||'AU6S-K2: 1 pack (500 g) = 1 Nos'
--  where id = 2686 and product_id = 695 and reference_output_qty = 500 and reference_output_uom_id = 5 and process_loss_pct = 0;
-- -- Expect 1 row each. Kit material +0.19% (loss removed because the lines are gross per kit); Kanji exact.
-- rollback;

-- K3 (PREREQUISITE before activating 878): confirm the Karkkidaka Kanji batch.
-- Current production_batch_size_ref = 50,000 "Nos" (min 30,000), flagged unverified.
-- If the batch is really 50 kg = 100 packs of 500 g, supersede the ref with 100 Nos effective 2026-10-01
-- (APPLIED_abhraka_batch50 pattern) and set costing_effective_from = '2026-10-01' for 878 in the same
-- transaction. Activating 878 with 50,000 Nos would wrongly collapse its conversion cost (COP 141 -> 84).
