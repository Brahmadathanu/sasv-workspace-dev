-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop view if exists public.v_industries_unresolved_sku_rates cascade;
drop view if exists public.v_industries_monthly_product_group cascade;
drop view if exists public.v_industries_monthly_product cascade;
drop view if exists public.v_industries_monthly_sku_valued cascade;
drop view if exists public.v_industries_sku_canonical_rate cascade;

create view public.v_industries_sku_canonical_rate as
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
      and t.transfer_date < date '2026-09-01'
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

create view public.v_industries_monthly_sku_valued as
select
    b.month_start,b.sku_id,b.product_id,b.quantity_base,b.uom_base,b.quantity_source,b.source_detail,
    r.canonical_rate_per_base,r.canonical_rate_per_sku,r.rate_basis,
    case when r.canonical_rate_per_base is not null then b.quantity_base*r.canonical_rate_per_base end as production_value,
    case when r.canonical_rate_per_base is null then 'INCOMPLETE_RATE_COVERAGE'
         when r.rate_basis='DIRECT_SKU_TRANSFER' then 'COMPLETE'
         when r.rate_basis='SIBLING_SKU_TRANSFER_SCALED' then 'COMPLETE_WITH_SIBLING_TRANSFER_RATE'
         when r.rate_basis='INTERNAL_LOADED_COST_REVIEW_REQUIRED' then 'COMPLETE_WITH_INTERNAL_LOADED_COST'
    end as valuation_status,
    r.evidence_from as rate_evidence_from,r.evidence_to as rate_evidence_to
from public.industries_monthly_sku_basis b
left join public.v_industries_sku_canonical_rate r on r.sku_id=b.sku_id and r.product_id=b.product_id;

create view public.v_industries_monthly_product as
select s.month_start,s.product_id,d.product_name,d.group_name as product_group,s.uom_base,
       sum(s.quantity_base) as aggregated_quantity,
       case when count(*) filter(where s.canonical_rate_per_base is null)=0 then sum(s.production_value) end as aggregated_value,
       count(distinct s.sku_id) as sku_count,
       count(distinct s.sku_id) filter(where s.canonical_rate_per_base is null) as unresolved_sku_count,
       case when count(*) filter(where s.canonical_rate_per_base is null)>0 then 'INCOMPLETE_RATE_COVERAGE'
            when count(*) filter(where s.rate_basis='INTERNAL_LOADED_COST_REVIEW_REQUIRED')>0 then 'COMPLETE_WITH_INTERNAL_LOADED_COST'
            when count(*) filter(where s.rate_basis='SIBLING_SKU_TRANSFER_SCALED')>0 then 'COMPLETE_WITH_SIBLING_TRANSFER_RATE'
            else 'COMPLETE' end as valuation_status
from public.v_industries_monthly_sku_valued s
join public.v_product_details d on d.product_id=s.product_id
group by s.month_start,s.product_id,d.product_name,d.group_name,s.uom_base;

create view public.v_industries_monthly_product_group as
select month_start,product_group,uom_base,sum(aggregated_quantity) as aggregated_quantity,
       case when count(*) filter(where valuation_status='INCOMPLETE_RATE_COVERAGE')=0 then sum(aggregated_value) end as aggregated_value,
       count(distinct product_id) as product_count,sum(sku_count) as sku_count,sum(unresolved_sku_count) as unresolved_sku_count,
       case when count(*) filter(where valuation_status='INCOMPLETE_RATE_COVERAGE')>0 then 'INCOMPLETE_RATE_COVERAGE'
            when count(*) filter(where valuation_status='COMPLETE_WITH_INTERNAL_LOADED_COST')>0 then 'COMPLETE_WITH_INTERNAL_LOADED_COST'
            when count(*) filter(where valuation_status='COMPLETE_WITH_SIBLING_TRANSFER_RATE')>0 then 'COMPLETE_WITH_SIBLING_TRANSFER_RATE'
            else 'COMPLETE' end as valuation_status
from public.v_industries_monthly_product
group by month_start,product_group,uom_base;

create view public.v_industries_unresolved_sku_rates as
select b.sku_id,b.product_id,d.product_name,d.group_name as product_group,b.uom_base,
       min(b.month_start) as first_month,max(b.month_start) as last_month,
       sum(b.quantity_base) as total_quantity_base,count(distinct b.month_start) as month_count,
       string_agg(distinct b.quantity_source,', ' order by b.quantity_source) as quantity_sources
from public.industries_monthly_sku_basis b
join public.v_product_details d on d.product_id=b.product_id
left join public.v_industries_sku_canonical_rate r on r.sku_id=b.sku_id and r.product_id=b.product_id
where r.sku_id is null
group by b.sku_id,b.product_id,d.product_name,d.group_name,b.uom_base;