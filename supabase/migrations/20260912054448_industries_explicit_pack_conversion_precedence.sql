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
        sum(t.book_line_value) / nullif(sum(t.qty_in_uom_base), 0::numeric) as canonical_rate_per_base,
        sum(t.book_line_value) / nullif(sum(t.transferred_pack_count), 0::numeric) as canonical_rate_per_sku,
        'DIRECT_SKU_TRANSFER'::text as rate_basis
    from public.v_tally_fg_transfer_normalized_valued t
    where t.sku_id is not null
      and t.product_id is not null
      and t.qty_in_uom_base is not null
      and t.qty_in_uom_base <> 0::numeric
      and t.book_line_value is not null
      and t.transfer_date >= date '2025-04-01'
    group by t.sku_id, t.product_id
), product_transfer as (
    select
        direct.product_id,
        min(direct.evidence_from) as evidence_from,
        max(direct.evidence_to) as evidence_to,
        sum(direct.transfer_line_count) as transfer_line_count,
        sum(direct.evidence_quantity_base) as evidence_quantity_base,
        sum(direct.evidence_book_value) as evidence_book_value,
        sum(direct.evidence_book_value) / nullif(sum(direct.evidence_quantity_base), 0::numeric) as product_rate_per_base
    from direct
    group by direct.product_id
), hist_factor as (
    select
        s.sku_id::bigint as sku_id,
        ps.product_id,
        lower(ps.uom) as sku_uom,
        ps.pack_size,
        sum(s.qty_base) / nullif(sum(s.qty_units), 0::numeric) as base_qty_per_sku_unit
    from public.v_sdv_sales_enriched s
    join public.product_skus ps on ps.id = s.sku_id
    where s.qty_units is not null
      and s.qty_units <> 0::numeric
      and s.qty_base is not null
    group by s.sku_id, ps.product_id, lower(ps.uom), ps.pack_size
), product_uom_factor as (
    select
        hist_factor.product_id,
        hist_factor.sku_uom,
        avg(hist_factor.base_qty_per_sku_unit / nullif(hist_factor.pack_size, 0::numeric)) as base_per_packsize_unit
    from hist_factor
    where hist_factor.base_qty_per_sku_unit is not null
      and hist_factor.pack_size is not null
      and hist_factor.pack_size <> 0::numeric
    group by hist_factor.product_id, hist_factor.sku_uom
), basis_skus as (
    select distinct b.sku_id, b.product_id, b.uom_base
    from public.industries_monthly_sku_basis b
), sibling as (
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
        p.product_rate_per_base * coalesce(h.base_qty_per_sku_unit, m.base_qty_per_sku_unit) as canonical_rate_per_sku,
        'SIBLING_SKU_TRANSFER_SCALED'::text as rate_basis
    from basis_skus b
    join product_transfer p on p.product_id = b.product_id
    join public.product_skus ps on ps.id = b.sku_id
    join public.v_product_details d on d.product_id = b.product_id
    left join public.v_sku_to_base_multiplier m on m.sku_id = b.sku_id
    left join hist_factor h on h.sku_id = b.sku_id
    left join direct r on r.sku_id = b.sku_id and r.product_id = b.product_id
    where r.sku_id is null
      and coalesce(h.base_qty_per_sku_unit, m.base_qty_per_sku_unit) is not null
      and coalesce(h.base_qty_per_sku_unit, m.base_qty_per_sku_unit) <> 0::numeric
), latest_loaded as (
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
      and s.internal_loaded_cost_status = 'REVIEW_REQUIRED'::text
    order by s.sku_id, s.refreshed_at desc, s.id desc
), loaded as (
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
        l.internal_loaded_cost_per_sku / nullif(coalesce(h.base_qty_per_sku_unit, m.base_qty_per_sku_unit), 0::numeric) as canonical_rate_per_base,
        l.internal_loaded_cost_per_sku as canonical_rate_per_sku,
        'INTERNAL_LOADED_COST_REVIEW_REQUIRED'::text as rate_basis
    from basis_skus b
    join latest_loaded l on l.sku_id = b.sku_id and l.product_id = b.product_id
    left join public.v_sku_to_base_multiplier m on m.sku_id = b.sku_id
    left join hist_factor h on h.sku_id = b.sku_id
    left join direct d on d.sku_id = b.sku_id and d.product_id = b.product_id
    left join sibling s on s.sku_id = b.sku_id and s.product_id = b.product_id
    where d.sku_id is null
      and s.sku_id is null
      and coalesce(h.base_qty_per_sku_unit, m.base_qty_per_sku_unit) is not null
      and coalesce(h.base_qty_per_sku_unit, m.base_qty_per_sku_unit) <> 0::numeric
), google_fallback as (
    select
        b.sku_id,
        b.product_id,
        d.product_name,
        null::text as sku_label,
        ps.pack_size,
        ps.uom as pack_uom,
        b.uom_base,
        null::date as evidence_from,
        null::date as evidence_to,
        0::bigint as transfer_line_count,
        null::numeric as evidence_quantity_base,
        null::numeric as evidence_book_value,
        f.rate_per_sku / nullif(
            coalesce(
                h.base_qty_per_sku_unit,
                case
                    when lower(ps.uom) = 'g' and lower(d.uom_base) = 'kg' then ps.pack_size / 1000.0
                    when lower(ps.uom) = 'ml' and lower(d.uom_base) = 'l' then ps.pack_size / 1000.0
                    when lower(ps.uom) = 'nos' and lower(d.uom_base) = 'nos' then ps.pack_size
                    else null::numeric
                end,
                m.base_qty_per_sku_unit,
                puf.base_per_packsize_unit * ps.pack_size
            ),
            0::numeric
        ) as canonical_rate_per_base,
        f.rate_per_sku as canonical_rate_per_sku,
        f.rate_basis
    from basis_skus b
    join public.industries_sku_rate_fallback f on f.sku_id = b.sku_id
    join public.product_skus ps on ps.id = b.sku_id and ps.product_id = b.product_id
    join public.v_product_details d on d.product_id = b.product_id
    left join public.v_sku_to_base_multiplier m on m.sku_id = b.sku_id
    left join hist_factor h on h.sku_id = b.sku_id
    left join product_uom_factor puf on puf.product_id = b.product_id and puf.sku_uom = lower(ps.uom)
    left join direct dr on dr.sku_id = b.sku_id and dr.product_id = b.product_id
    left join sibling si on si.sku_id = b.sku_id and si.product_id = b.product_id
    left join loaded lo on lo.sku_id = b.sku_id and lo.product_id = b.product_id
    where dr.sku_id is null
      and si.sku_id is null
      and lo.sku_id is null
      and coalesce(
            h.base_qty_per_sku_unit,
            case
                when lower(ps.uom) = 'g' and lower(d.uom_base) = 'kg' then ps.pack_size / 1000.0
                when lower(ps.uom) = 'ml' and lower(d.uom_base) = 'l' then ps.pack_size / 1000.0
                when lower(ps.uom) = 'nos' and lower(d.uom_base) = 'nos' then ps.pack_size
                else null::numeric
            end,
            m.base_qty_per_sku_unit,
            puf.base_per_packsize_unit * ps.pack_size
          ) is not null
)
select * from direct
union all
select * from sibling
union all
select * from loaded
union all
select * from google_fallback;