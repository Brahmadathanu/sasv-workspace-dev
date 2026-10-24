-- Canonical matcher for internal-source terminal RM review; no independent approval rule.
-- Retains exact approved source identity, quality codes and in-month effective period.
CREATE OR REPLACE FUNCTION costing.fn_resolve_internal_material_rm_rates_as_of(p_as_of_date date)
 RETURNS TABLE(lineage_id bigint, stock_item_id bigint, source_product_id bigint, source_product_name text, source_product_base_uom text, transfer_uom_id bigint, transfer_uom_code text, resolution_status text, selected_rate numeric, warning_flag boolean, warning_code text, warning_text text, blocking_line_count bigint, review_line_count bigint, evidence_json jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
with recursive
ctx as (
  select date_trunc('month',p_as_of_date)::date as period_start
),
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
terminal_base as (
  select
    w.root_lineage_id,w.current_product_id,w.qty_factor,w.inherited_optional,
    r.purchase_stock_item_id,r.purchase_stock_item_name,r.qty_purchase_form_per_base_unit,r.is_optional,
    r.calculation_warning_flag,r.calculation_warning_code,
    rt.selected_rate,rt.rate_source,rt.rate_date,rt.resolution_status as ordinary_resolution_status,
    rt.warning_flag as ordinary_warning_flag,rt.warning_code as ordinary_warning_code,
    rt.selected_manual_rate_id,rt.selected_purchase_fact_id,rt.selected_stock_valuation_source,
    case
      when rt.warning_code='STALE_PURCHASE_RATE' then 'STALE_RM_PURCHASE_RATE'
      when rt.warning_code='STOCK_VALUATION_FALLBACK' then 'RM_STOCK_VALUATION_FALLBACK'
      when rt.warning_code='MANUAL_RATE_USED' then 'RM_MANUAL_RATE_USED'
      when (w.inherited_optional or coalesce(r.is_optional,false)) and rt.selected_rate is null then 'OPTIONAL_RM_RATE_MISSING'
      when r.calculation_warning_code is not null then r.calculation_warning_code
      when rt.warning_code is not null then rt.warning_code
      else null::text
    end as acceptance_issue_codes,
    case when rt.warning_code is not null then rt.warning_code end as acceptance_warning_codes,
    case
      when (w.inherited_optional or coalesce(r.is_optional,false)) and rt.selected_rate is null then 'OPTIONAL_MISSING_RATE'
      when rt.warning_code in ('STALE_PURCHASE_RATE','STOCK_VALUATION_FALLBACK','MANUAL_RATE_USED') then 'REVIEW_RATE'
      else null::text
    end as acceptance_action_required_summary
  from walk w
  join req r on r.product_id=w.current_product_id
  left join rates rt on rt.stock_item_id=r.purchase_stock_item_id
  where not exists(select 1 from lineage child where child.consume_stock_item_id=r.purchase_stock_item_id)
),
terminal as (
  select
    tb.*,
    (ar.acceptance_id is not null) as review_acceptance_active,
    case
      when coalesce(tb.calculation_warning_flag,false) then not (tb.inherited_optional or coalesce(tb.is_optional,false))
      when tb.ordinary_resolution_status='AMBIGUOUS' then not (tb.inherited_optional or coalesce(tb.is_optional,false))
      when tb.selected_rate is null then not (tb.inherited_optional or coalesce(tb.is_optional,false))
      else false
    end as is_blocking,
    case
      when (tb.inherited_optional or coalesce(tb.is_optional,false))
           and (coalesce(tb.calculation_warning_flag,false) or tb.ordinary_resolution_status='AMBIGUOUS' or tb.selected_rate is null)
        then ar.acceptance_id is null
      when not coalesce(tb.calculation_warning_flag,false)
           and tb.ordinary_resolution_status is distinct from 'AMBIGUOUS'
           and tb.selected_rate is not null
           and coalesce(tb.ordinary_warning_flag,false)
        then ar.acceptance_id is null
      else false
    end as is_review,
    case
      when not coalesce(tb.calculation_warning_flag,false)
       and tb.ordinary_resolution_status is distinct from 'AMBIGUOUS'
       and tb.selected_rate is not null
      then tb.qty_factor*tb.qty_purchase_form_per_base_unit*tb.selected_rate
      else 0::numeric
    end as cost_contribution
  from terminal_base tb
  cross join ctx c
  left join lateral (
    select 1::bigint as acceptance_id
    where costing.fn_material_review_acceptance_matches(
      c.period_start,p_as_of_date,tb.purchase_stock_item_id,'RM',
      tb.acceptance_issue_codes,tb.acceptance_warning_codes,
      tb.acceptance_action_required_summary,tb.selected_rate,tb.rate_source,
      tb.rate_date,tb.selected_manual_rate_id,tb.selected_purchase_fact_id,
      tb.selected_stock_valuation_source)
  ) ar on true
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
      'current_product_id',t.current_product_id,
      'stock_item_id',t.purchase_stock_item_id,
      'qty_factor',t.qty_factor,
      'qty_per_base',t.qty_purchase_form_per_base_unit,
      'rate',t.selected_rate,
      'rate_source',t.rate_source,
      'rate_date',t.rate_date,
      'resolution_status',t.ordinary_resolution_status,
      'warning_code',t.ordinary_warning_code,
      'review_acceptance_active',t.review_acceptance_active,
      'inherited_optional',t.inherited_optional,
      'line_optional',t.is_optional,
      'calculation_warning_code',t.calculation_warning_code
    ) order by t.current_product_id,t.purchase_stock_item_id)
      filter(where t.purchase_stock_item_id is not null),'[]'::jsonb) as evidence
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
  l.id,l.consume_stock_item_id,l.source_product_id,l.source_product_name,b.source_product_base_uom,
  l.transfer_uom_id,l.transfer_uom_code,
  case
    when l.source_product_status is distinct from 'Active' then 'BLOCKED'
    when b.source_product_base_uom is null then 'BLOCKED'
    when lower(trim(b.source_product_base_uom)) is distinct from lower(trim(l.transfer_uom_code)) then 'BLOCKED'
    when a.blocking_count>0 then 'BLOCKED'
    when a.review_count>0 then 'REVIEW_REQUIRED'
    else 'RESOLVED'
  end,
  case
    when l.source_product_status='Active'
     and b.source_product_base_uom is not null
     and lower(trim(b.source_product_base_uom))=lower(trim(l.transfer_uom_code))
     and a.blocking_count=0 then a.total_cost
    else null::numeric
  end,
  case when a.blocking_count=0 and a.review_count>0 then true else false end,
  case
    when l.source_product_status is distinct from 'Active' then 'INTERNAL_SOURCE_PRODUCT_INACTIVE'
    when b.source_product_base_uom is null then 'INTERNAL_SOURCE_RM_REQUIREMENT_MISSING'
    when lower(trim(b.source_product_base_uom)) is distinct from lower(trim(l.transfer_uom_code)) then 'INTERNAL_TRANSFER_UOM_MISMATCH'
    when a.blocking_count>0 then 'INTERNAL_SOURCE_RM_BLOCKED'
    when a.review_count>0 then 'INTERNAL_SOURCE_REVIEW_REQUIRED'
    else null::text
  end,
  case
    when l.source_product_status is distinct from 'Active' then 'Internal source product is not Active.'
    when b.source_product_base_uom is null then 'No RM requirement foundation exists for internal source product.'
    when lower(trim(b.source_product_base_uom)) is distinct from lower(trim(l.transfer_uom_code)) then format('Source product base UOM %s does not match transfer UOM %s.',b.source_product_base_uom,l.transfer_uom_code)
    when a.blocking_count>0 then format('Internal source Product RM cost is blocked by %s required condition(s).',a.blocking_count)
    when a.review_count>0 then format('Internal source Product RM cost is resolved but %s unaccepted line(s) require review.',a.review_count)
    else 'Internal source Product RM standard cost resolved with evidence-bound review acceptances applied where applicable.'
  end,
  a.blocking_count,a.review_count,a.evidence
from lineage l
join agg a on a.lineage_id=l.id
left join base_uom b on b.lineage_id=l.id;
$function$
