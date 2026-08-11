-- Hotfix for duplicate-key upsert in refresh_rm_status_from_reservation_current_month
-- Error addressed:
-- ON CONFLICT DO UPDATE command cannot affect row a second time

create or replace function public.refresh_rm_status_from_reservation_current_month()
returns void
language plpgsql
as $function$
declare
  v_month_start date := date_trunc('month', current_date)::date;
begin
  insert into public.rm_status_snapshot_current_month (
    month_start,
    product_id,
    batch_number,
    rm_stock_item_id,
    rm_name,
    rm_uom,
    planned_rm_qty,
    issued_rm_qty,
    stock_qty,
    required_from_stock_qty,
    higher_priority_required_qty,
    available_before_reservation,
    reserved_qty,
    uncovered_qty,
    is_optional_rm,
    rm_procurement_mode,
    has_unassigned_issues,
    is_blocking_line,
    rm_status_class,
    rm_status_reason,
    refreshed_at
  )
  with reservation_dedup as (
    select
      r.month_start,
      r.product_id,
      r.batch_number,
      r.rm_stock_item_id,
      max(r.rm_name) as rm_name,
      max(r.rm_uom) as rm_uom,
      max(coalesce(r.planned_rm_qty, 0)) as planned_rm_qty,
      max(coalesce(r.issued_rm_qty, 0)) as issued_rm_qty,
      max(coalesce(r.stock_qty_current, 0)) as stock_qty,
      max(coalesce(r.required_from_stock_qty, 0)) as required_from_stock_qty,
      max(coalesce(r.higher_priority_required_qty, 0)) as higher_priority_required_qty,
      max(coalesce(r.available_before_reservation, 0)) as available_before_reservation,
      max(coalesce(r.reserved_qty, 0)) as reserved_qty,
      max(coalesce(r.uncovered_qty, 0)) as uncovered_qty,
      bool_or(coalesce(r.is_blocking_after_reservation, false)) as is_blocking_after_reservation
    from public.rm_reservation_snapshot_current_month r
    where r.month_start = v_month_start
    group by
      r.month_start,
      r.product_id,
      r.batch_number,
      r.rm_stock_item_id
  ),
  base as (
    select
      r.month_start,
      r.product_id,
      r.batch_number,
      r.rm_stock_item_id,
      r.rm_name,
      r.rm_uom,
      r.planned_rm_qty,
      coalesce(r.issued_rm_qty, 0) as issued_rm_qty,
      coalesce(r.stock_qty, 0) as stock_qty,
      coalesce(r.required_from_stock_qty, 0) as required_from_stock_qty,
      coalesce(r.higher_priority_required_qty, 0) as higher_priority_required_qty,
      coalesce(r.available_before_reservation, 0) as available_before_reservation,
      coalesce(r.reserved_qty, 0) as reserved_qty,
      coalesce(r.uncovered_qty, 0) as uncovered_qty,
      false::boolean as is_optional_rm,
      'stock_required'::text as rm_procurement_mode,
      coalesce(r.is_blocking_after_reservation, false) as is_blocking_after_reservation,
      public.rm_issue_actionable_exists(
        r.month_start,
        r.product_id,
        r.batch_number,
        r.rm_stock_item_id
      ) as has_actionable_issue
    from reservation_dedup r
  )
  select
    b.month_start,
    b.product_id,
    b.batch_number,
    b.rm_stock_item_id,
    b.rm_name,
    b.rm_uom,
    b.planned_rm_qty,
    b.issued_rm_qty,
    b.stock_qty,
    b.required_from_stock_qty,
    b.higher_priority_required_qty,
    b.available_before_reservation,
    b.reserved_qty,
    b.uncovered_qty,
    b.is_optional_rm,
    b.rm_procurement_mode,
    b.has_actionable_issue as has_unassigned_issues,
    (b.has_actionable_issue or b.is_blocking_after_reservation) as is_blocking_line,
    case
      when b.has_actionable_issue then 'UNASSIGNED_ISSUE'
      when b.is_blocking_after_reservation then 'BLOCKING_SHORTAGE'
      else 'SUFFICIENT_STOCK_REQUIRED'
    end as rm_status_class,
    case
      when b.has_actionable_issue then 'Actionable issue lines exist for this batch/RM item.'
      when b.is_blocking_after_reservation then 'Stock shortage after reservation.'
      else 'Not blocking.'
    end as rm_status_reason,
    now() as refreshed_at
  from base b
  on conflict (month_start, product_id, batch_number, rm_stock_item_id)
  do update set
    rm_name = excluded.rm_name,
    rm_uom = excluded.rm_uom,
    planned_rm_qty = excluded.planned_rm_qty,
    issued_rm_qty = excluded.issued_rm_qty,
    stock_qty = excluded.stock_qty,
    required_from_stock_qty = excluded.required_from_stock_qty,
    higher_priority_required_qty = excluded.higher_priority_required_qty,
    available_before_reservation = excluded.available_before_reservation,
    reserved_qty = excluded.reserved_qty,
    uncovered_qty = excluded.uncovered_qty,
    is_optional_rm = excluded.is_optional_rm,
    rm_procurement_mode = excluded.rm_procurement_mode,
    has_unassigned_issues = excluded.has_unassigned_issues,
    is_blocking_line = excluded.is_blocking_line,
    rm_status_class = excluded.rm_status_class,
    rm_status_reason = excluded.rm_status_reason,
    refreshed_at = excluded.refreshed_at;

  delete from public.rm_status_snapshot_current_month s
  where s.month_start = v_month_start
    and not exists (
      select 1
      from (
        select
          r.month_start,
          r.product_id,
          r.batch_number,
          r.rm_stock_item_id
        from public.rm_reservation_snapshot_current_month r
        where r.month_start = v_month_start
        group by
          r.month_start,
          r.product_id,
          r.batch_number,
          r.rm_stock_item_id
      ) r
      where r.month_start = s.month_start
        and r.product_id = s.product_id
        and r.batch_number = s.batch_number
        and r.rm_stock_item_id = s.rm_stock_item_id
    );
end;
$function$;

-- Then run:
-- select public.refresh_after_rm_allocation();
