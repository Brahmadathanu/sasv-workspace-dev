-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_resolve_internal_material_rm_rates_as_of(p_as_of_date date)
returns table(
  lineage_id bigint,
  stock_item_id bigint,
  source_product_id bigint,
  source_product_name text,
  source_product_base_uom text,
  transfer_uom_id bigint,
  transfer_uom_code text,
  resolution_status text,
  selected_rate numeric,
  warning_flag boolean,
  warning_code text,
  warning_text text,
  blocking_line_count bigint,
  review_line_count bigint,
  evidence_json jsonb
)
language sql stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
with recursive
lineage as materialized (
  select distinct on (l.consume_stock_item_id)
    l.id,l.consume_stock_item_id,l.source_product_id,l.transfer_uom_id,
    p.item as source_product_name,p.status as source_product_status,u.code as transfer_uom_code
  from costing.internal_material_source_lineage l
  join public.products p on p.id=l.source_product_id
  join public.inv_uom u on u.id=l.transfer_uom_id
  where l.status='APPROVED'
    and l.effective_from<=p_as_of_date
    and (l.effective_to is null or l.effective_to>=p_as_of_date)
  order by l.consume_stock_item_id,l.effective_from desc,l.id desc
),
req as materialized (
  select * from costing.fn_build_product_rm_requirement_as_of(p_as_of_date)
),
ordinary_ids as materialized (
  select array_agg(distinct r.purchase_stock_item_id order by r.purchase_stock_item_id)
    filter(where r.purchase_stock_item_id is not null) as stock_item_ids
  from req r
  where not exists(select 1 from lineage l where l.consume_stock_item_id=r.purchase_stock_item_id)
),
rates as materialized (
  select rr.*
  from ordinary_ids i
  cross join lateral costing.fn_resolve_material_rates_as_of(coalesce(i.stock_item_ids,array[]::bigint[]),p_as_of_date) rr
),
walk as (
  select
    l.id as root_lineage_id,l.consume_stock_item_id as root_stock_item_id,l.source_product_id as root_source_product_id,
    l.source_product_id as current_product_id,1::numeric as qty_factor,
    array[l.source_product_id]::bigint[] as product_path,false as inherited_optional,false as cycle_detected
  from lineage l
  union all
  select
    w.root_lineage_id,w.root_stock_item_id,w.root_source_product_id,
    child.source_product_id,
    w.qty_factor*r.qty_purchase_form_per_base_unit,
    w.product_path||child.source_product_id,
    w.inherited_optional or coalesce(r.is_optional,false),
    child.source_product_id=any(w.product_path)
  from walk w
  join req r on r.product_id=w.current_product_id
  join lineage child on child.consume_stock_item_id=r.purchase_stock_item_id
  where not w.cycle_detected
    and r.qty_purchase_form_per_base_unit is not null
    and not coalesce(r.calculation_warning_flag,false)
    and not (child.source_product_id=any(w.product_path))
),
cycle_edges as (
  select w.root_lineage_id,count(*)::bigint as cycle_count
  from walk w
  join req r on r.product_id=w.current_product_id
  join lineage child on child.consume_stock_item_id=r.purchase_stock_item_id
  where child.source_product_id=any(w.product_path)
  group by w.root_lineage_id
),
missing_product_req as (
  select w.root_lineage_id,count(*)::bigint as missing_count
  from walk w
  where not exists(select 1 from req r where r.product_id=w.current_product_id)
  group by w.root_lineage_id
),
terminal as (
  select
    w.root_lineage_id,w.current_product_id,w.qty_factor,w.inherited_optional,
    r.purchase_stock_item_id,r.purchase_stock_item_name,r.qty_purchase_form_per_base_unit,r.is_optional,r.calculation_warning_flag,r.calculation_warning_code,
    rt.selected_rate,rt.rate_source,rt.resolution_status as ordinary_resolution_status,rt.warning_flag as ordinary_warning_flag,rt.warning_code as ordinary_warning_code,
    case
      when coalesce(r.calculation_warning_flag,false) then not (w.inherited_optional or coalesce(r.is_optional,false))
      when rt.resolution_status='AMBIGUOUS' then not (w.inherited_optional or coalesce(r.is_optional,false))
      when rt.selected_rate is null then not (w.inherited_optional or coalesce(r.is_optional,false))
      else false end as is_blocking,
    case
      when (w.inherited_optional or coalesce(r.is_optional,false)) and (coalesce(r.calculation_warning_flag,false) or rt.resolution_status='AMBIGUOUS' or rt.selected_rate is null) then true
      when not coalesce(r.calculation_warning_flag,false) and rt.resolution_status is distinct from 'AMBIGUOUS' and rt.selected_rate is not null and coalesce(rt.warning_flag,false) then true
      else false end as is_review,
    case when not coalesce(r.calculation_warning_flag,false) and rt.resolution_status is distinct from 'AMBIGUOUS' and rt.selected_rate is not null
         then w.qty_factor*r.qty_purchase_form_per_base_unit*rt.selected_rate else 0::numeric end as cost_contribution
  from walk w
  join req r on r.product_id=w.current_product_id
  left join rates rt on rt.stock_item_id=r.purchase_stock_item_id
  where not exists(select 1 from lineage child where child.consume_stock_item_id=r.purchase_stock_item_id)
),
agg as (
  select
    l.id as lineage_id,
    coalesce(sum(t.cost_contribution),0) as total_cost,
    coalesce(count(*) filter(where t.is_blocking),0)::bigint
      + coalesce(max(c.cycle_count),0)::bigint
      + coalesce(max(m.missing_count),0)::bigint as blocking_count,
    coalesce(count(*) filter(where t.is_review),0)::bigint as review_count,
    coalesce(jsonb_agg(jsonb_build_object(
      'current_product_id',t.current_product_id,'stock_item_id',t.purchase_stock_item_id,'qty_factor',t.qty_factor,
      'qty_per_base',t.qty_purchase_form_per_base_unit,'rate',t.selected_rate,'rate_source',t.rate_source,
      'resolution_status',t.ordinary_resolution_status,'warning_code',t.ordinary_warning_code,
      'inherited_optional',t.inherited_optional,'line_optional',t.is_optional,'calculation_warning_code',t.calculation_warning_code
    ) order by t.current_product_id,t.purchase_stock_item_id) filter(where t.purchase_stock_item_id is not null),'[]'::jsonb) as evidence
  from lineage l
  left join terminal t on t.root_lineage_id=l.id
  left join cycle_edges c on c.root_lineage_id=l.id
  left join missing_product_req m on m.root_lineage_id=l.id
  group by l.id
),
base_uom as (
  select l.id as lineage_id,max(r.product_base_uom) as source_product_base_uom
  from lineage l left join req r on r.product_id=l.source_product_id
  group by l.id
)
select
  l.id,l.consume_stock_item_id,l.source_product_id,l.source_product_name,b.source_product_base_uom,l.transfer_uom_id,l.transfer_uom_code,
  case
    when l.source_product_status is distinct from 'Active' then 'BLOCKED'
    when b.source_product_base_uom is null then 'BLOCKED'
    when lower(trim(b.source_product_base_uom)) is distinct from lower(trim(l.transfer_uom_code)) then 'BLOCKED'
    when a.blocking_count>0 then 'BLOCKED'
    when a.review_count>0 then 'REVIEW_REQUIRED'
    else 'RESOLVED' end,
  case
    when l.source_product_status='Active'
     and b.source_product_base_uom is not null
     and lower(trim(b.source_product_base_uom))=lower(trim(l.transfer_uom_code))
     and a.blocking_count=0 then a.total_cost else null::numeric end,
  case when a.blocking_count=0 and a.review_count>0 then true else false end,
  case
    when l.source_product_status is distinct from 'Active' then 'INTERNAL_SOURCE_PRODUCT_INACTIVE'
    when b.source_product_base_uom is null then 'INTERNAL_SOURCE_RM_REQUIREMENT_MISSING'
    when lower(trim(b.source_product_base_uom)) is distinct from lower(trim(l.transfer_uom_code)) then 'INTERNAL_TRANSFER_UOM_MISMATCH'
    when a.blocking_count>0 then 'INTERNAL_SOURCE_RM_BLOCKED'
    when a.review_count>0 then 'INTERNAL_SOURCE_REVIEW_REQUIRED'
    else null::text end,
  case
    when l.source_product_status is distinct from 'Active' then 'Internal source product is not Active.'
    when b.source_product_base_uom is null then 'No RM requirement foundation exists for internal source product.'
    when lower(trim(b.source_product_base_uom)) is distinct from lower(trim(l.transfer_uom_code)) then format('Source product base UOM %s does not match transfer UOM %s.',b.source_product_base_uom,l.transfer_uom_code)
    when a.blocking_count>0 then format('Internal source Product RM cost is blocked by %s required condition(s).',a.blocking_count)
    when a.review_count>0 then format('Internal source Product RM cost is resolved but %s line(s) require review.',a.review_count)
    else 'Internal source Product RM standard cost resolved.' end,
  a.blocking_count,a.review_count,a.evidence
from lineage l
join agg a on a.lineage_id=l.id
left join base_uom b on b.lineage_id=l.id;
$function$;

do $do$
declare v_def text;
begin
  select pg_get_functiondef('costing.fn_build_product_rm_cost_lines_as_of(date,date)'::regprocedure) into v_def;
  v_def := replace(v_def,
    'lineage as materialized (\n    select distinct on (l.consume_stock_item_id)\n      l.*\n    from costing.internal_material_source_lineage l\n    where l.status=''APPROVED''\n      and l.effective_from<=p_valuation_date\n      and (l.effective_to is null or l.effective_to>=p_valuation_date)\n    order by l.consume_stock_item_id,l.effective_from desc,l.id desc\n  )',
    'lineage as materialized (\n    select distinct on (l.consume_stock_item_id)\n      l.*\n    from costing.internal_material_source_lineage l\n    where l.status=''APPROVED''\n      and l.effective_from<=p_valuation_date\n      and (l.effective_to is null or l.effective_to>=p_valuation_date)\n    order by l.consume_stock_item_id,l.effective_from desc,l.id desc\n  ), internal_rates as materialized (\n    select * from costing.fn_resolve_internal_material_rm_rates_as_of(p_valuation_date)\n  )');
  v_def := replace(v_def,
    'left join lateral costing.fn_resolve_internal_material_rm_rate_as_of(\n    r.purchase_stock_item_id,p_valuation_date,array[r.product_id]::bigint[]\n  ) ir on lin.id is not null',
    'left join internal_rates ir on ir.stock_item_id=r.purchase_stock_item_id');
  execute v_def;
end
$do$;