-- backfilled from live schema_migrations on 2026-10-24, CI-016
truncate table public.industries_monthly_sku_basis;

alter table public.industries_monthly_sku_basis
  drop constraint if exists industries_monthly_production_basis_pkey;
alter table public.industries_monthly_sku_basis
  drop constraint if exists industries_monthly_sku_basis_pkey;

with mapped as (
  select s.*,
         coalesce(a1.sku_id,a2.sku_id)::bigint as sku_id
  from public.industries_google_2022_23_stage s
  left join public.sku_aliases a1 on a1.alias_key=public.normalize_key(s.bridge_alias_text)
  left join public.sku_aliases a2 on a2.alias_key=public.normalize_key(s.source_item_name)
), unp as (
  select m.source_item_name,m.sku_id,x.month_start,x.qty_units
  from mapped m
  cross join lateral (values
    (date '2022-04-01',m.qty_apr),(date '2022-05-01',m.qty_may),(date '2022-06-01',m.qty_jun),
    (date '2022-07-01',m.qty_jul),(date '2022-08-01',m.qty_aug),(date '2022-09-01',m.qty_sep),
    (date '2022-10-01',m.qty_oct),(date '2022-11-01',m.qty_nov),(date '2022-12-01',m.qty_dec),
    (date '2023-01-01',m.qty_jan),(date '2023-02-01',m.qty_feb),(date '2023-03-01',m.qty_mar)
  ) x(month_start,qty_units)
  where m.sku_id is not null and coalesce(x.qty_units,0)<>0
), sf as (
  select s.sku_id,s.product_id,ps.pack_size,ps.uom,
         sum(s.qty_base)/nullif(sum(s.qty_units),0) as factor
  from public.v_sdv_sales_enriched s
  join public.product_skus ps on ps.id=s.sku_id
  where s.qty_base is not null and s.qty_units is not null and s.qty_units<>0
  group by s.sku_id,s.product_id,ps.pack_size,ps.uom
), pd as (
  select product_id,
         sum(factor)/nullif(sum(pack_size),0) as base_per_ml
  from sf
  where lower(uom)='ml' and pack_size>0
  group by product_id
), resolved as (
  select u.month_start,u.source_item_name,u.sku_id,ps.product_id,d.uom_base,
         u.qty_units,
         coalesce(
           sf.factor,
           case when lower(ps.uom)='g' and d.uom_base='Kg' then ps.pack_size/1000.0 end,
           case when lower(ps.uom)='ml' and d.uom_base='L' then ps.pack_size/1000.0 end,
           case when lower(ps.uom)='ml' and d.uom_base='Kg' and pd.base_per_ml is not null then ps.pack_size*pd.base_per_ml end,
           case when lower(ps.uom)='nos' and d.uom_base='Nos' then ps.pack_size end
         ) as base_per_sku
  from unp u
  join public.product_skus ps on ps.id=u.sku_id
  join public.v_product_details d on d.product_id=ps.product_id
  left join sf on sf.sku_id=u.sku_id
  left join pd on pd.product_id=ps.product_id
), g as (
  select month_start,sku_id,product_id,uom_base,
         sum(qty_units*base_per_sku) as quantity_base,
         string_agg(distinct source_item_name,' | ' order by source_item_name) as source_detail
  from resolved
  where base_per_sku is not null
  group by month_start,sku_id,product_id,uom_base
)
insert into public.industries_monthly_sku_basis
(month_start,product_id,sku_id,quantity_base,uom_base,quantity_source,source_detail)
select month_start,product_id,sku_id,quantity_base,uom_base,'SALES_PROXY_GOOGLE_2022_23',source_detail
from g;

insert into public.industries_monthly_sku_basis
(month_start,product_id,sku_id,quantity_base,uom_base,quantity_source,source_detail)
select s.month_start,s.product_id,s.sku_id,sum(s.qty_base),max(p.uom_base),
       'SALES_PROXY_SUPABASE','v_sdv_sales_enriched'
from public.v_sdv_sales_enriched s
join public.products p on p.id=s.product_id
where s.month_start>=date '2023-04-01' and s.month_start<date '2025-04-01'
  and s.sku_id is not null and s.product_id is not null and coalesce(s.qty_base,0)<>0
group by s.month_start,s.product_id,s.sku_id;

insert into public.industries_monthly_sku_basis
(month_start,product_id,sku_id,quantity_base,uom_base,quantity_source,source_detail)
select date_trunc('month',t.transfer_date)::date,t.product_id,t.sku_id,sum(t.qty_in_uom_base),
       max(t.qty_in_uom_base_unit),'FG_TRANSFER_ACTUAL','v_tally_fg_transfer_normalized_valued'
from public.v_tally_fg_transfer_normalized_valued t
where t.transfer_date>=date '2025-04-01' and t.transfer_date<date '2026-09-01'
  and t.sku_id is not null and t.product_id is not null and coalesce(t.qty_in_uom_base,0)<>0
group by date_trunc('month',t.transfer_date)::date,t.product_id,t.sku_id;

alter table public.industries_monthly_sku_basis alter column sku_id set not null;
alter table public.industries_monthly_sku_basis
  add constraint industries_monthly_sku_basis_pkey primary key(month_start,sku_id,quantity_source);

drop table public.industries_google_2022_23_stage;