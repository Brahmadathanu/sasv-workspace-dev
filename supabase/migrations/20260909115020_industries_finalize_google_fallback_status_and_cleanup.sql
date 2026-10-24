-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view public.v_industries_monthly_sku_valued
with (security_invoker=true) as
select b.month_start,b.sku_id,b.product_id,b.quantity_base,b.uom_base,b.quantity_source,b.source_detail,
       r.canonical_rate_per_base,r.canonical_rate_per_sku,r.rate_basis,
       case when r.canonical_rate_per_base is not null then b.quantity_base*r.canonical_rate_per_base else null::numeric end as production_value,
       case
         when r.canonical_rate_per_base is null then 'INCOMPLETE_RATE_COVERAGE'::text
         when r.rate_basis='DIRECT_SKU_TRANSFER' then 'COMPLETE'::text
         when r.rate_basis='SIBLING_SKU_TRANSFER_SCALED' then 'COMPLETE_WITH_SIBLING_TRANSFER_RATE'::text
         when r.rate_basis='INTERNAL_LOADED_COST_REVIEW_REQUIRED' then 'COMPLETE_WITH_INTERNAL_LOADED_COST'::text
         when r.rate_basis='GOOGLE_ALL_COST_SHEETS_COST_OF_PROD' then 'COMPLETE_WITH_GOOGLE_COST_OF_PROD'::text
         else 'COMPLETE_WITH_OTHER_RATE'::text
       end as valuation_status,
       r.evidence_from as rate_evidence_from,r.evidence_to as rate_evidence_to
from public.industries_monthly_sku_basis b
left join public.v_industries_sku_canonical_rate r on r.sku_id=b.sku_id and r.product_id=b.product_id;

create or replace view public.v_industries_monthly_product
with (security_invoker=true) as
select s.month_start,s.product_id,d.product_name,d.group_name as product_group,s.uom_base,
       sum(s.quantity_base) as aggregated_quantity,
       case when count(*) filter(where s.canonical_rate_per_base is null)=0 then sum(s.production_value) else null::numeric end as aggregated_value,
       count(distinct s.sku_id) as sku_count,
       count(distinct s.sku_id) filter(where s.canonical_rate_per_base is null) as unresolved_sku_count,
       case
         when count(*) filter(where s.canonical_rate_per_base is null)>0 then 'INCOMPLETE_RATE_COVERAGE'::text
         when count(*) filter(where s.rate_basis='GOOGLE_ALL_COST_SHEETS_COST_OF_PROD')>0 then 'COMPLETE_WITH_GOOGLE_COST_OF_PROD'::text
         when count(*) filter(where s.rate_basis='INTERNAL_LOADED_COST_REVIEW_REQUIRED')>0 then 'COMPLETE_WITH_INTERNAL_LOADED_COST'::text
         when count(*) filter(where s.rate_basis='SIBLING_SKU_TRANSFER_SCALED')>0 then 'COMPLETE_WITH_SIBLING_TRANSFER_RATE'::text
         else 'COMPLETE'::text
       end as valuation_status
from public.v_industries_monthly_sku_valued s
join public.v_product_details d on d.product_id=s.product_id
group by s.month_start,s.product_id,d.product_name,d.group_name,s.uom_base;

create or replace view public.v_industries_monthly_product_group
with (security_invoker=true) as
select month_start,product_group,uom_base,sum(aggregated_quantity) as aggregated_quantity,
       case when count(*) filter(where valuation_status='INCOMPLETE_RATE_COVERAGE')=0 then sum(aggregated_value) else null::numeric end as aggregated_value,
       count(distinct product_id) as product_count,sum(sku_count) as sku_count,sum(unresolved_sku_count) as unresolved_sku_count,
       case
         when count(*) filter(where valuation_status='INCOMPLETE_RATE_COVERAGE')>0 then 'INCOMPLETE_RATE_COVERAGE'::text
         when count(*) filter(where valuation_status='COMPLETE_WITH_GOOGLE_COST_OF_PROD')>0 then 'COMPLETE_WITH_GOOGLE_COST_OF_PROD'::text
         when count(*) filter(where valuation_status='COMPLETE_WITH_INTERNAL_LOADED_COST')>0 then 'COMPLETE_WITH_INTERNAL_LOADED_COST'::text
         when count(*) filter(where valuation_status='COMPLETE_WITH_SIBLING_TRANSFER_RATE')>0 then 'COMPLETE_WITH_SIBLING_TRANSFER_RATE'::text
         else 'COMPLETE'::text
       end as valuation_status
from public.v_industries_monthly_product
group by month_start,product_group,uom_base;

drop view if exists public.v_industries_unresolved_sku_rates;