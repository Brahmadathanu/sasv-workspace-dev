-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view costing.v_material_rate_effective as
with active_items as materialized (
  select id, code, name, default_uom_id
  from public.inv_stock_item
  where active = true
), requested as materialized (
  select coalesce(array_agg(id order by id), array[]::bigint[]) as ids
  from active_items
), resolved as materialized (
  select r.*
  from requested q
  cross join lateral costing.fn_resolve_material_rates_as_of(q.ids, current_date) r
)
select
  i.id as stock_item_id,
  i.code as stock_item_code,
  i.name as stock_item_name,
  i.default_uom_id,
  r.selected_rate,
  r.rate_date,
  case
    when r.rate_source = 'LAST_PURCHASE' then 'LATEST_PURCHASE_RATE'
    when r.rate_source = 'STOCK_VALUATION' then coalesce(r.selected_stock_valuation_source, 'STOCK_VALUATION')
    else r.rate_source
  end as rate_source,
  case
    when r.rate_source = 'GOVERNED_ZERO_COST' then 0
    when r.rate_source = 'MANUAL_RATE' then 1
    when r.rate_source = 'LAST_PURCHASE' then 2
    when r.rate_source = 'STOCK_VALUATION' then 3
    else null::integer
  end as source_priority,
  r.warning_flag,
  case
    when r.warning_code = 'MISSING_MATERIAL_RATE' then 'MISSING_RATE'
    else r.warning_code
  end as warning_code,
  r.warning_text
from active_items i
left join resolved r on r.stock_item_id = i.id;