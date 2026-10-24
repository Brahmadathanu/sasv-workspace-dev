-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_total_manufacturing_product_demand_as_of(
 p_period_start date,p_valuation_date date,p_refresh_run_id bigint
)
returns table(
 product_id bigint,product_name text,product_base_uom text,
 commercial_base_qty numeric,internal_base_qty numeric,total_manufacturing_base_qty numeric,
 monthly_driver_status text,commercial_recipient_sku_count integer,
 demand_source text,demand_note text,internal_evidence_json jsonb
)
language sql stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
with commercial as materialized (
 select b.product_id,max(b.product_name)::text product_name,max(b.product_base_uom)::text product_base_uom,
        max(b.monthly_product_allocation_base_qty)::numeric commercial_base_qty,
        case when bool_or(b.monthly_driver_status='BLOCKED') then 'BLOCKED'
             when bool_or(b.monthly_driver_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED' else 'READY' end commercial_status,
        count(*)::integer sku_count
 from costing.sku_sales_allocation_basis_snapshot b
 where b.period_start=date_trunc('month',p_period_start)::date and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id
 group by b.product_id
), internal as materialized (
 select * from costing.fn_internal_source_product_demand_as_of(p_period_start,p_valuation_date,p_refresh_run_id)
), ids as (
 select product_id from commercial union select source_product_id from internal
)
select ids.product_id,
       coalesce(c.product_name,i.source_product_name,p.item)::text,
       coalesce(c.product_base_uom,i.source_product_base_uom)::text,
       coalesce(c.commercial_base_qty,0)::numeric,
       coalesce(i.monthly_internal_demand_base_qty,0)::numeric,
       (coalesce(c.commercial_base_qty,0)+coalesce(i.monthly_internal_demand_base_qty,0))::numeric,
       case when coalesce(c.commercial_status,'READY')='BLOCKED' or coalesce(i.monthly_driver_status,'READY')='BLOCKED' then 'BLOCKED'
            when coalesce(c.commercial_status,'READY')='REVIEW_REQUIRED' or coalesce(i.monthly_driver_status,'READY')='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
            else 'READY' end,
       coalesce(c.sku_count,0)::integer,
       case when c.product_id is not null and i.source_product_id is not null then 'COMMERCIAL_PLUS_INTERNAL_DEMAND'
            when i.source_product_id is not null then 'INTERNAL_MATERIAL_DEMAND'
            else 'COMMERCIAL_DEMAND' end,
       case when c.product_id is not null and i.source_product_id is not null then 'Total manufacturing demand combines frozen commercial demand with recursively resolved downstream internal-material demand.'
            when i.source_product_id is not null then 'Manufacturing-only demand is recursively resolved from downstream frozen internal-material consumption.'
            else 'Manufacturing demand is the frozen commercial Product quantity.' end,
       coalesce(i.evidence_json,'[]'::jsonb)
from ids join public.products p on p.id=ids.product_id
left join commercial c on c.product_id=ids.product_id
left join internal i on i.source_product_id=ids.product_id
where p.status='Active';
$function$;