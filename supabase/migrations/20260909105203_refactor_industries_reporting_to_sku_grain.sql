-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Remove exploratory/product-rate reporting objects first.
drop view if exists public.v_industries_monthly_production_group;
drop view if exists public.v_industries_rate_exception_review;
drop view if exists public.v_industries_product_effective_rate;
drop view if exists public.v_industries_product_canonical_rate;
drop view if exists public.v_industries_historical_sales_2022_23_mapping_summary;
drop view if exists public.v_industries_historical_sales_2022_23_mapped;

drop table if exists public.industries_product_rate_override;
drop table if exists public.industries_historical_sales_2022_23_raw;

-- Formalize the already unique month+SKU fact table.
alter table public.industries_monthly_production_basis
  rename to industries_monthly_sku_basis;

comment on table public.industries_monthly_sku_basis is
  'Canonical one-time Industries Department production basis at month + SKU grain. Historical sales are quantity proxies; actual FG transfers are used from Apr-2025 onward.';

-- Canonical SKU-level transfer-derived rate. Rate is normalized to each SKU''s product base UOM,
-- while retaining the corresponding per-pack rate where pack count is available.
create view public.v_industries_sku_canonical_rate
with (security_invoker = true)
as
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
    case
      when sum(t.qty_in_uom_base) <> 0
      then sum(t.book_line_value) / sum(t.qty_in_uom_base)
    end as canonical_rate_per_base,
    case
      when sum(t.transferred_pack_count) <> 0
      then sum(t.book_line_value) / sum(t.transferred_pack_count)
    end as canonical_rate_per_sku,
    min(case when t.qty_in_uom_base <> 0 then t.book_line_value / t.qty_in_uom_base end) as min_observed_rate_per_base,
    max(case when t.qty_in_uom_base <> 0 then t.book_line_value / t.qty_in_uom_base end) as max_observed_rate_per_base
from public.v_tally_fg_transfer_normalized_valued t
where t.sku_id is not null
  and t.product_id is not null
  and t.qty_in_uom_base is not null
  and t.qty_in_uom_base <> 0
  and t.book_line_value is not null
  and t.transfer_date >= date '2025-04-01'
group by t.sku_id, t.product_id;

-- Value each monthly SKU only after the SKU-specific rate is known.
create view public.v_industries_monthly_sku_valued
with (security_invoker = true)
as
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
    case
      when r.canonical_rate_per_base is not null
      then b.quantity_base * r.canonical_rate_per_base
    end as production_value,
    case
      when r.canonical_rate_per_base is null then 'INCOMPLETE_RATE_COVERAGE'
      else 'COMPLETE'
    end as valuation_status,
    r.evidence_from as rate_evidence_from,
    r.evidence_to as rate_evidence_to
from public.industries_monthly_sku_basis b
left join public.v_industries_sku_canonical_rate r
  on r.sku_id = b.sku_id
 and r.product_id = b.product_id;

-- Aggregate SKU values to product/month. Never report a partial product value as complete.
create view public.v_industries_monthly_product
with (security_invoker = true)
as
select
    s.month_start,
    s.product_id,
    d.product_name,
    d.group_name as product_group,
    s.uom_base,
    sum(s.quantity_base) as aggregated_quantity,
    case
      when count(*) filter (where s.canonical_rate_per_base is null) = 0
      then sum(s.production_value)
    end as aggregated_value,
    count(distinct s.sku_id) as sku_count,
    count(distinct s.sku_id) filter (where s.canonical_rate_per_base is null) as unresolved_sku_count,
    case
      when count(*) filter (where s.canonical_rate_per_base is null) = 0 then 'COMPLETE'
      else 'INCOMPLETE_RATE_COVERAGE'
    end as valuation_status
from public.v_industries_monthly_sku_valued s
join public.v_product_details d
  on d.product_id = s.product_id
group by s.month_start, s.product_id, d.product_name, d.group_name, s.uom_base;

-- Final statutory reporting grain: month + product group + base UOM.
create view public.v_industries_monthly_product_group
with (security_invoker = true)
as
select
    p.month_start,
    p.product_group,
    p.uom_base,
    sum(p.aggregated_quantity) as aggregated_quantity,
    case
      when count(*) filter (where p.valuation_status <> 'COMPLETE') = 0
      then sum(p.aggregated_value)
    end as aggregated_value,
    count(distinct p.product_id) as product_count,
    sum(p.sku_count) as sku_count,
    sum(p.unresolved_sku_count) as unresolved_sku_count,
    case
      when count(*) filter (where p.valuation_status <> 'COMPLETE') = 0 then 'COMPLETE'
      else 'INCOMPLETE_RATE_COVERAGE'
    end as valuation_status
from public.v_industries_monthly_product p
group by p.month_start, p.product_group, p.uom_base;

-- Dedicated review surface for only the remaining missing SKU rates.
create view public.v_industries_unresolved_sku_rates
with (security_invoker = true)
as
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
join public.v_product_details d
  on d.product_id = b.product_id
left join public.v_industries_sku_canonical_rate r
  on r.sku_id = b.sku_id
 and r.product_id = b.product_id
where r.sku_id is null
group by b.sku_id, b.product_id, d.product_name, d.group_name, b.uom_base;

-- Backend-only reporting artifacts: no client role access required.
revoke all on table public.industries_monthly_sku_basis from anon, authenticated;
revoke all on public.v_industries_sku_canonical_rate from anon, authenticated;
revoke all on public.v_industries_monthly_sku_valued from anon, authenticated;
revoke all on public.v_industries_monthly_product from anon, authenticated;
revoke all on public.v_industries_monthly_product_group from anon, authenticated;
revoke all on public.v_industries_unresolved_sku_rates from anon, authenticated;