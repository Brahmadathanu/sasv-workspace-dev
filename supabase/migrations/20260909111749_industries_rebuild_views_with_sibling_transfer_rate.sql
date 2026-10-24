-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop view if exists public.v_industries_monthly_product_group;
drop view if exists public.v_industries_monthly_product;
drop view if exists public.v_industries_monthly_sku_valued;
drop view if exists public.v_industries_unresolved_sku_rates;
drop view if exists public.v_industries_sku_canonical_rate;

create view public.v_industries_sku_canonical_rate as
with direct_sku as (
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
        min(t.book_line_value / nullif(t.qty_in_uom_base,0)) as min_observed_rate_per_base,
        max(t.book_line_value / nullif(t.qty_in_uom_base,0)) as max_observed_rate_per_base,
        'DIRECT_SKU_TRANSFER'::text as rate_basis,
        null::bigint as sibling_source_sku_count
    from public.v_tally_fg_transfer_normalized_valued t
    where t.transfer_date >= date '2025-04-01'
      and t.transfer_date < date '2026-09-01'
      and t.sku_id is not null
      and t.product_id is not null
      and t.qty_in_uom_base is not null
      and t.qty_in_uom_base <> 0
      and t.book_line_value is not null
    group by t.sku_id,t.product_id
), product_transfer as (
    select
        t.product_id,
        min(t.transfer_date) as evidence_from,
        max(t.transfer_date) as evidence_to,
        count(*) as transfer_line_count,
        count(distinct t.sku_id)::bigint as sibling_source_sku_count,
        sum(t.qty_in_uom_base) as evidence_quantity_base,
        sum(t.book_line_value) as evidence_book_value,
        sum(t.book_line_value) / nullif(sum(t.qty_in_uom_base),0) as weighted_rate_per_base,
        min(t.book_line_value / nullif(t.qty_in_uom_base,0)) as min_observed_rate_per_base,
        max(t.book_line_value / nullif(t.qty_in_uom_base,0)) as max_observed_rate_per_base
    from public.v_tally_fg_transfer_normalized_valued t
    where t.transfer_date >= date '2025-04-01'
      and t.transfer_date < date '2026-09-01'
      and t.sku_id is not null
      and t.product_id is not null
      and t.qty_in_uom_base is not null
      and t.qty_in_uom_base <> 0
      and t.book_line_value is not null
    group by t.product_id
), basis_skus as (
    select distinct b.sku_id,b.product_id,b.uom_base
    from public.industries_monthly_sku_basis b
), sibling_fallback as (
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
        p.weighted_rate_per_base as canonical_rate_per_base,
        case when m.base_qty_per_sku_unit is not null
             then p.weighted_rate_per_base * m.base_qty_per_sku_unit
             else null::numeric
        end as canonical_rate_per_sku,
        p.min_observed_rate_per_base,
        p.max_observed_rate_per_base,
        'SIBLING_SKU_TRANSFER_SCALED'::text as rate_basis,
        p.sibling_source_sku_count
    from basis_skus b
    join product_transfer p on p.product_id=b.product_id
    join public.v_product_details d on d.product_id=b.product_id
    left join public.product_skus ps on ps.id=b.sku_id
    left join public.v_sku_to_base_multiplier m on m.sku_id=b.sku_id
    left join direct_sku ds on ds.sku_id=b.sku_id and ds.product_id=b.product_id
    where ds.sku_id is null
)
select * from direct_sku
union all
select * from sibling_fallback;

create view public.v_industries_monthly_sku_valued as
select
    b.month_start,
    b.sku_id,
    b.product_id,
    b.quantity_base,
    b.uom_base,
    b.quantity_source,
    b.source_detail,
    r.canonical_rate_per_base,
    r.canonical_rate_per_sku,
    case when r.canonical_rate_per_base is not null
         then b.quantity_base * r.canonical_rate_per_base
         else null::numeric
    end as production_value,
    case when r.canonical_rate_per_base is null
         then 'INCOMPLETE_RATE_COVERAGE'::text
         when r.rate_basis='DIRECT_SKU_TRANSFER'
         then 'COMPLETE'::text
         else 'COMPLETE_WITH_SIBLING_TRANSFER_RATE'::text
    end as valuation_status,
    r.evidence_from as rate_evidence_from,
    r.evidence_to as rate_evidence_to,
    r.rate_basis
from public.industries_monthly_sku_basis b
left join public.v_industries_sku_canonical_rate r
  on r.sku_id=b.sku_id and r.product_id=b.product_id;

create view public.v_industries_monthly_product as
select
    s.month_start,
    s.product_id,
    d.product_name,
    d.group_name as product_group,
    s.uom_base,
    sum(s.quantity_base) as aggregated_quantity,
    case when count(*) filter (where s.canonical_rate_per_base is null)=0
         then sum(s.production_value)
         else null::numeric
    end as aggregated_value,
    count(distinct s.sku_id) as sku_count,
    count(distinct s.sku_id) filter (where s.canonical_rate_per_base is null) as unresolved_sku_count,
    count(distinct s.sku_id) filter (where s.rate_basis='SIBLING_SKU_TRANSFER_SCALED') as sibling_rate_sku_count,
    case when count(*) filter (where s.canonical_rate_per_base is null)>0
         then 'INCOMPLETE_RATE_COVERAGE'::text
         when count(*) filter (where s.rate_basis='SIBLING_SKU_TRANSFER_SCALED')>0
         then 'COMPLETE_WITH_SIBLING_TRANSFER_RATE'::text
         else 'COMPLETE'::text
    end as valuation_status
from public.v_industries_monthly_sku_valued s
join public.v_product_details d on d.product_id=s.product_id
group by s.month_start,s.product_id,d.product_name,d.group_name,s.uom_base;

create view public.v_industries_monthly_product_group as
select
    p.month_start,
    p.product_group,
    p.uom_base,
    sum(p.aggregated_quantity) as aggregated_quantity,
    case when count(*) filter (where p.valuation_status='INCOMPLETE_RATE_COVERAGE')=0
         then sum(p.aggregated_value)
         else null::numeric
    end as aggregated_value,
    count(distinct p.product_id) as product_count,
    sum(p.sku_count) as sku_count,
    sum(p.unresolved_sku_count) as unresolved_sku_count,
    sum(p.sibling_rate_sku_count) as sibling_rate_sku_count,
    case when count(*) filter (where p.valuation_status='INCOMPLETE_RATE_COVERAGE')>0
         then 'INCOMPLETE_RATE_COVERAGE'::text
         when count(*) filter (where p.valuation_status='COMPLETE_WITH_SIBLING_TRANSFER_RATE')>0
         then 'COMPLETE_WITH_SIBLING_TRANSFER_RATE'::text
         else 'COMPLETE'::text
    end as valuation_status
from public.v_industries_monthly_product p
group by p.month_start,p.product_group,p.uom_base;

create view public.v_industries_unresolved_sku_rates as
select
    b.sku_id,
    b.product_id,
    d.product_name,
    d.group_name as product_group,
    b.uom_base,
    min(b.month_start) as first_month,
    max(b.month_start) as last_month,
    sum(b.quantity_base) as total_quantity_base,
    count(distinct b.month_start) as month_count,
    string_agg(distinct b.quantity_source, ', ' order by b.quantity_source) as quantity_sources
from public.industries_monthly_sku_basis b
join public.v_product_details d on d.product_id=b.product_id
left join public.v_industries_sku_canonical_rate r
  on r.sku_id=b.sku_id and r.product_id=b.product_id
where r.sku_id is null
group by b.sku_id,b.product_id,d.product_name,d.group_name,b.uom_base;