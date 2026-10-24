-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view public.v_industries_sku_canonical_rate as
with direct as (
    select
        t.sku_id::bigint as sku_id,
        t.product_id,
        max(t.product_name) as product_name,
        max(t.sku_label) as sku_label,
        max(t.pack_size) as pack_size,
        max(t.sku_pack_uom) as pack_uom,
        max(t.qty_in_uom_base_unit) as uom_base,
        min(t.transfer_date) as evidence_from,
        max(t.transfer_date) as evidence_to,
        count(*) as transfer_line_count,
        sum(t.qty_in_uom_base) as evidence_quantity_base,
        sum(t.book_line_value) as evidence_book_value,
        sum(t.book_line_value) / nullif(sum(t.qty_in_uom_base),0) as canonical_rate_per_base,
        sum(t.book_line_value) / nullif(sum(t.transferred_pack_count),0) as canonical_rate_per_sku,
        'DIRECT_SKU_TRANSFER'::text as rate_basis
    from public.v_tally_fg_transfer_normalized_valued t
    where t.sku_id is not null
      and t.product_id is not null
      and t.qty_in_uom_base is not null
      and t.qty_in_uom_base <> 0
      and t.book_line_value is not null
      and t.transfer_date >= date '2025-04-01'
    group by t.sku_id, t.product_id
),
product_transfer as (
    select
        product_id,
        min(evidence_from) as evidence_from,
        max(evidence_to) as evidence_to,
        sum(transfer_line_count) as transfer_line_count,
        sum(evidence_quantity_base) as evidence_quantity_base,
        sum(evidence_book_value) as evidence_book_value,
        sum(evidence_book_value) / nullif(sum(evidence_quantity_base),0) as product_rate_per_base
    from direct
    group by product_id
),
hist_factor as (
    select sku_id::bigint as sku_id,
           sum(qty_base) / nullif(sum(qty_units),0) as base_qty_per_sku_unit
    from public.v_sdv_sales_enriched
    where qty_units is not null and qty_units <> 0 and qty_base is not null
    group by sku_id
),
basis_skus as (
    select distinct b.sku_id,b.product_id,b.uom_base
    from public.industries_monthly_sku_basis b
),
sibling as (
    select
        b.sku_id,
        b.product_id,
        d.product_name,
        null::text as sku_label,
        ps.pack_size,
        ps.uom as pack_uom,
        b.uom_base,
        p.evidence_from,
        p.evidence_to,
        p.transfer_line_count,
        p.evidence_quantity_base,
        p.evidence_book_value,
        p.product_rate_per_base as canonical_rate_per_base,
        p.product_rate_per_base * coalesce(m.base_qty_per_sku_unit,h.base_qty_per_sku_unit) as canonical_rate_per_sku,
        'SIBLING_SKU_TRANSFER_SCALED'::text as rate_basis
    from basis_skus b
    join product_transfer p on p.product_id=b.product_id
    join public.product_skus ps on ps.id=b.sku_id
    join public.v_product_details d on d.product_id=b.product_id
    left join public.v_sku_to_base_multiplier m on m.sku_id=b.sku_id
    left join hist_factor h on h.sku_id=b.sku_id
    left join direct r on r.sku_id=b.sku_id and r.product_id=b.product_id
    where r.sku_id is null
      and coalesce(m.base_qty_per_sku_unit,h.base_qty_per_sku_unit) is not null
      and coalesce(m.base_qty_per_sku_unit,h.base_qty_per_sku_unit) <> 0
),
latest_loaded as (
    select distinct on (s.sku_id)
        s.sku_id,
        s.product_id,
        s.product_name,
        s.pack_size,
        s.pack_uom,
        s.period_start,
        s.internal_loaded_cost_per_sku,
        s.internal_loaded_cost_status
    from costing.sku_internal_loaded_cost_snapshot s
    where s.period_start = date '2026-09-01'
      and s.internal_loaded_cost_per_sku is not null
      and s.internal_loaded_cost_status = 'REVIEW_REQUIRED'
    order by s.sku_id,s.refreshed_at desc,s.id desc
),
loaded as (
    select
        b.sku_id,
        b.product_id,
        l.product_name,
        null::text as sku_label,
        l.pack_size,
        l.pack_uom,
        b.uom_base,
        l.period_start as evidence_from,
        l.period_start as evidence_to,
        0::bigint as transfer_line_count,
        null::numeric as evidence_quantity_base,
        null::numeric as evidence_book_value,
        l.internal_loaded_cost_per_sku / nullif(coalesce(m.base_qty_per_sku_unit,h.base_qty_per_sku_unit),0) as canonical_rate_per_base,
        l.internal_loaded_cost_per_sku as canonical_rate_per_sku,
        'INTERNAL_LOADED_COST_REVIEW_REQUIRED'::text as rate_basis
    from basis_skus b
    join latest_loaded l on l.sku_id=b.sku_id and l.product_id=b.product_id
    left join public.v_sku_to_base_multiplier m on m.sku_id=b.sku_id
    left join hist_factor h on h.sku_id=b.sku_id
    left join direct d on d.sku_id=b.sku_id and d.product_id=b.product_id
    left join sibling s on s.sku_id=b.sku_id and s.product_id=b.product_id
    where d.sku_id is null
      and s.sku_id is null
      and coalesce(m.base_qty_per_sku_unit,h.base_qty_per_sku_unit) is not null
      and coalesce(m.base_qty_per_sku_unit,h.base_qty_per_sku_unit) <> 0
)
select * from direct
union all
select * from sibling
union all
select * from loaded;