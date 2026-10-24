-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop table if exists public.industries_historical_sales_2022_23_raw cascade;

create table public.industries_historical_sales_2022_23_raw (
  source_item_name text primary key,
  bridge_alias_text text,
  qty_apr numeric,
  qty_may numeric,
  qty_jun numeric,
  qty_jul numeric,
  qty_aug numeric,
  qty_sep numeric,
  qty_oct numeric,
  qty_nov numeric,
  qty_dec numeric,
  qty_jan numeric,
  qty_feb numeric,
  qty_mar numeric,
  source_name text not null default 'SASV - HISTORICAL SALES DATA / SALES SUMMARY 2022-23',
  created_at timestamptz not null default now()
);

alter table public.industries_historical_sales_2022_23_raw enable row level security;
alter table public.industries_monthly_production_basis enable row level security;
revoke all on public.industries_historical_sales_2022_23_raw from anon, authenticated;
revoke all on public.industries_monthly_production_basis from anon, authenticated;

create or replace view public.v_industries_historical_sales_2022_23_mapped
with (security_invoker = true) as
with unp as (
  select r.source_item_name, r.bridge_alias_text, v.month_start, v.qty_units
  from public.industries_historical_sales_2022_23_raw r
  cross join lateral (values
    (date '2022-04-01', r.qty_apr),
    (date '2022-05-01', r.qty_may),
    (date '2022-06-01', r.qty_jun),
    (date '2022-07-01', r.qty_jul),
    (date '2022-08-01', r.qty_aug),
    (date '2022-09-01', r.qty_sep),
    (date '2022-10-01', r.qty_oct),
    (date '2022-11-01', r.qty_nov),
    (date '2022-12-01', r.qty_dec),
    (date '2023-01-01', r.qty_jan),
    (date '2023-02-01', r.qty_feb),
    (date '2023-03-01', r.qty_mar)
  ) v(month_start, qty_units)
  where v.qty_units is not null and v.qty_units <> 0
), alias_matches as (
  select
    u.*,
    sa.sku_id,
    count(sa.sku_id) over (partition by u.source_item_name) as alias_match_count
  from unp u
  left join public.sku_aliases sa
    on normalize_key(sa.alias_text) = normalize_key(u.bridge_alias_text)
), mapped as (
  select
    a.month_start,
    a.source_item_name,
    a.bridge_alias_text,
    a.qty_units,
    a.sku_id,
    ps.product_id,
    p.uom_base,
    ps.pack_size,
    p.conversion_to_base,
    a.qty_units * coalesce(ps.pack_size,1) * coalesce(p.conversion_to_base,1) as quantity_base,
    case
      when a.bridge_alias_text is null then 'NO_BRIDGE_ALIAS'
      when a.alias_match_count = 0 then 'UNMAPPED_ALIAS'
      when a.alias_match_count > 1 then 'AMBIGUOUS_ALIAS'
      when ps.id is null then 'SKU_NOT_FOUND'
      when p.id is null then 'PRODUCT_NOT_FOUND'
      else 'MAPPED'
    end as mapping_status
  from alias_matches a
  left join public.product_skus ps on ps.id=a.sku_id
  left join public.products p on p.id=ps.product_id
)
select * from mapped;

create or replace view public.v_industries_historical_sales_2022_23_mapping_summary
with (security_invoker = true) as
select mapping_status,
       count(distinct source_item_name) as source_items,
       count(*) as monthly_rows,
       sum(qty_units) as pack_qty
from public.v_industries_historical_sales_2022_23_mapped
group by mapping_status;
