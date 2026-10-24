-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_internal_source_product_demand_as_of(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint
)
returns table(
  source_product_id bigint,
  source_product_name text,
  source_product_base_uom text,
  monthly_internal_demand_base_qty numeric,
  monthly_driver_status text,
  source_path_count bigint,
  evidence_json jsonb
)
language sql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $function$
with recursive
ctx as (
  select date_trunc('month',p_period_start)::date period_start
),
commercial as materialized (
  select b.product_id,
         max(b.monthly_product_allocation_base_qty) monthly_product_base_qty,
         case when bool_or(b.monthly_driver_status='BLOCKED') then 'BLOCKED'
              when bool_or(b.monthly_driver_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
              else 'READY' end monthly_driver_status
  from costing.sku_sales_allocation_basis_snapshot b, ctx
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

create table if not exists costing.product_internal_source_materials_stores_allocation_snapshot (
  id bigserial primary key,
  period_start date not null,
  valuation_date date not null,
  refresh_run_id bigint not null references costing.costing_refresh_run(id),
  policy_id bigint,
  pool_snapshot_id bigint,
  product_rm_workload_snapshot_id bigint,
  source_product_id bigint not null,
  source_product_name text not null,
  source_product_base_uom text,
  monthly_internal_demand_base_qty numeric,
  rm_workload_units numeric,
  company_eligible_workload_units numeric,
  workload_share numeric,
  frozen_pool_amount numeric,
  allocation_amount numeric,
  materials_stores_cost_per_base_uom numeric,
  allocation_status text not null,
  allocation_reason_code text,
  allocation_note text,
  demand_evidence_json jsonb,
  captured_at timestamptz not null default clock_timestamp(),
  unique(refresh_run_id,source_product_id)
);
create index if not exists ix_internal_source_stores_tuple on costing.product_internal_source_materials_stores_allocation_snapshot(period_start,valuation_date,refresh_run_id);
create index if not exists ix_internal_source_stores_product on costing.product_internal_source_materials_stores_allocation_snapshot(refresh_run_id,source_product_id);