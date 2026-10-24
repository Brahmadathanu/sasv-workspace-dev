-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view public.v_proc_indent_line_buylist_base as
with published as (
  select c.published_run_id as run_id
  from public.proc_snapshot_refresh_control c
  where c.refresh_name = 'procurement_execution_snapshots'
),
base as (
  select
    g.indent_line_id,
    g.indent_id,
    h.indent_number,
    h.status as indent_status,
    h.indent_date,
    h.approved_date,
    h.issued_date,
    g.material_class_id,
    g.stock_item_id,
    coalesce(si.name, 'Item #' || g.stock_item_id::text) as stock_item_name,
    il.uom_id,
    u.code as uom_code,
    il.requested_qty,
    greatest(coalesce(il.requested_qty,0) - coalesce(g.remaining_qty,0),0) as allocated_qty,
    g.remaining_qty as qty_to_buy,
    d.recommended_vendor_id,
    d.recommended_rate,
    d.selected_vendor_id,
    d.selected_rate,
    coalesce(d.vendor_assignment_cleared,false) as vendor_assignment_cleared,
    c.code as material_class_code,
    c.label as material_class_label,
    h.generation_filters
  from published p
  join public.proc_indent_line_balance_generation g on g.run_id = p.run_id
  join public.proc_indent_header h on h.indent_id = g.indent_id
  join public.proc_indent_line il on il.indent_line_id = g.indent_line_id
  left join public.v_inv_stock_item_with_class si on si.stock_item_id = g.stock_item_id
  left join public.inv_uom u on u.id = il.uom_id
  left join public.proc_indent_line_sourcing_decision d on d.indent_line_id = g.indent_line_id
  left join public.inv_class_category c on c.id = g.material_class_id
  where g.remaining_qty > 0
    and h.status in ('approved','issued')
)
select
  b.indent_line_id,
  b.indent_id,
  b.indent_number,
  b.indent_status,
  b.indent_date,
  b.approved_date,
  b.issued_date,
  b.material_class_id,
  b.stock_item_id,
  b.stock_item_name,
  b.uom_id,
  b.uom_code,
  b.requested_qty,
  b.allocated_qty,
  b.qty_to_buy,
  case
    when b.vendor_assignment_cleared then null::bigint
    when b.selected_vendor_id is not null then b.selected_vendor_id
    when b.recommended_vendor_id is not null then b.recommended_vendor_id
    else null::bigint
  end as vendor_id,
  case
    when b.vendor_assignment_cleared then null::text
    else v.display_name
  end as vendor_name,
  (case
    when b.vendor_assignment_cleared then null::numeric
    when b.selected_vendor_id is not null then b.selected_rate
    when b.recommended_vendor_id is not null then b.recommended_rate
    else null::numeric
  end)::numeric(20,6) as rate_value,
  case
    when b.vendor_assignment_cleared then null::numeric
    when b.selected_vendor_id is not null and b.selected_rate is not null then b.qty_to_buy * b.selected_rate
    when b.selected_vendor_id is not null then null::numeric
    when b.recommended_vendor_id is not null and b.recommended_rate is not null then b.qty_to_buy * b.recommended_rate
    else null::numeric
  end as line_amount,
  b.material_class_code,
  b.material_class_label,
  case
    when b.material_class_code is not null and b.material_class_label is not null then b.material_class_code || ' - ' || b.material_class_label
    when b.material_class_code is not null then b.material_class_code
    when b.material_class_label is not null then b.material_class_label
    else null::text
  end as material_class_display,
  case
    when b.material_class_code = 'RM' then nullif(b.generation_filters ->> 'rm_scope','')
    else null::text
  end as rm_scope,
  case
    when b.material_class_code = 'RM' and (b.generation_filters ->> 'rm_scope') = 'normal' then 'Normal RM'
    when b.material_class_code = 'RM' and (b.generation_filters ->> 'rm_scope') = 'seasonal' then 'Seasonal RM'
    when b.material_class_code = 'RM' and nullif(b.generation_filters ->> 'rm_scope','') is not null then b.generation_filters ->> 'rm_scope'
    else null::text
  end as rm_scope_label,
  case
    when b.vendor_assignment_cleared then false
    when b.selected_vendor_id is not null then b.selected_rate is not null and b.selected_rate > 0
    when b.recommended_vendor_id is not null then b.recommended_rate is not null and b.recommended_rate > 0
    else false
  end as has_rate,
  case
    when b.vendor_assignment_cleared then 'not_applicable'
    when b.selected_vendor_id is not null and b.selected_rate is not null and b.selected_rate > 0 then 'with_rate'
    when b.selected_vendor_id is not null then 'rate_pending'
    when b.recommended_vendor_id is not null and b.recommended_rate is not null and b.recommended_rate > 0 then 'with_rate'
    when b.recommended_vendor_id is not null then 'rate_pending'
    else 'not_applicable'
  end as rate_status,
  case
    when b.vendor_assignment_cleared then false
    when b.selected_vendor_id is not null then true
    when b.recommended_vendor_id is not null then true
    else false
  end as has_vendor,
  case
    when b.vendor_assignment_cleared then 'unassigned'
    when b.selected_vendor_id is not null then 'assigned'
    when b.recommended_vendor_id is not null then 'assigned'
    else 'unassigned'
  end as assignment_status,
  case when v.vendor_id is null then null::text else v.vendor_type end as actual_vendor_type,
  case
    when v.vendor_id is null then 'UNASSIGNED'
    when v.vendor_type = 'LOCAL_VARIABLE_SUPPLIER' then 'LOCAL_PURCHASE'
    else 'VENDOR:' || v.vendor_id::text
  end as vendor_bucket_key,
  case
    when v.vendor_id is null then 'UNASSIGNED'
    when v.vendor_type = 'LOCAL_VARIABLE_SUPPLIER' then 'LOCAL PURCHASE'
    else v.display_name
  end as vendor_bucket_name,
  case
    when v.vendor_id is null then 'UNASSIGNED'
    when v.vendor_type = 'LOCAL_VARIABLE_SUPPLIER' then 'LOCAL_PURCHASE'
    else 'ACTUAL_VENDOR'
  end as vendor_bucket_type
from base b
left join public.proc_vendor v on v.vendor_id = case
  when b.vendor_assignment_cleared then null::bigint
  when b.selected_vendor_id is not null then b.selected_vendor_id
  when b.recommended_vendor_id is not null then b.recommended_vendor_id
  else null::bigint
end;