create or replace function costing.fn_internal_source_product_demand_as_of(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
returns table(source_product_id bigint, source_product_name text, source_product_base_uom text, monthly_internal_demand_base_qty numeric, monthly_driver_status text, source_path_count bigint, evidence_json jsonb)
language sql
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
with recursive
ctx as (
  select date_trunc('month',p_period_start)::date period_start
),
commercial as materialized (
  select b.product_id,
         max(b.monthly_product_allocation_base_qty) monthly_product_base_qty,
         case when bool_or(rs.effective_status='BLOCKED') then 'BLOCKED'
              when bool_or(rs.effective_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
              else 'READY' end monthly_driver_status
  from costing.sku_sales_allocation_basis_snapshot b
  cross join ctx
  cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) rs
  where b.period_start=ctx.period_start
    and b.valuation_date=p_valuation_date
    and b.refresh_run_id=p_refresh_run_id
  group by b.product_id
),
edges as materialized (
  select l.product_id consumer_product_id,
         il.source_product_id,
         sum(l.qty_purchase_form_per_base_unit) internal_qty_per_consumer_base
  from costing.product_rm_material_cost_line_snapshot l
  join costing.internal_material_source_lineage il
    on il.consume_stock_item_id=l.purchase_stock_item_id
   and il.status='APPROVED'
   and il.effective_from<=p_valuation_date
   and (il.effective_to is null or il.effective_to>=p_valuation_date)
  where l.refresh_run_id=p_refresh_run_id
    and l.period_start=date_trunc('month',p_period_start)::date
    and l.valuation_date=p_valuation_date
    and coalesce(l.is_optional,false)=false
    and l.qty_purchase_form_per_base_unit is not null
    and l.qty_purchase_form_per_base_unit>0
  group by l.product_id,il.source_product_id
),
walk as (
  select e.consumer_product_id root_product_id,
         e.consumer_product_id,
         e.source_product_id,
         c.monthly_product_base_qty*e.internal_qty_per_consumer_base monthly_source_qty,
         c.monthly_driver_status,
         array[e.consumer_product_id,e.source_product_id]::bigint[] path,
         1 depth
  from commercial c
  join edges e on e.consumer_product_id=c.product_id
  where c.monthly_product_base_qty>0
  union all
  select w.root_product_id,
         e.consumer_product_id,
         e.source_product_id,
         w.monthly_source_qty*e.internal_qty_per_consumer_base,
         w.monthly_driver_status,
         w.path||e.source_product_id,
         w.depth+1
  from walk w
  join edges e on e.consumer_product_id=w.source_product_id
  where w.depth<20
    and not (e.source_product_id=any(w.path))
),
base_uom as materialized (
  select l.product_id,max(l.product_base_uom) source_product_base_uom
  from costing.product_rm_material_cost_line_snapshot l
  where l.refresh_run_id=p_refresh_run_id
    and l.valuation_date=p_valuation_date
  group by l.product_id
)
select w.source_product_id,
       max(p.item)::text source_product_name,
       max(bu.source_product_base_uom)::text source_product_base_uom,
       sum(w.monthly_source_qty)::numeric monthly_internal_demand_base_qty,
       case when bool_or(w.monthly_driver_status='BLOCKED') then 'BLOCKED'
            when bool_or(w.monthly_driver_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
            else 'READY' end monthly_driver_status,
       count(*)::bigint source_path_count,
       jsonb_agg(jsonb_build_object(
         'root_consumer_product_id',w.root_product_id,
         'immediate_consumer_product_id',w.consumer_product_id,
         'source_product_id',w.source_product_id,
         'monthly_source_qty',w.monthly_source_qty,
         'driver_status',w.monthly_driver_status,
         'depth',w.depth,
         'path',w.path
       ) order by w.root_product_id,w.depth,w.consumer_product_id) evidence_json
from walk w
join public.products p on p.id=w.source_product_id
left join base_uom bu on bu.product_id=w.source_product_id
group by w.source_product_id;
$function$;