begin;

-- Single-source-of-truth upgrade:
-- RM receiving stock participates in RM gate evaluation and queue priority.
-- No fallback, no parallel logic branches.

-- 1) Extend RM status snapshot to carry ready vs receiving semantics.
alter table if exists public.rm_status_snapshot_current_month
  add column if not exists ready_stock_qty numeric,
  add column if not exists receiving_stock_qty numeric,
  add column if not exists effective_stock_qty numeric,
  add column if not exists shortage_after_ready_qty numeric,
  add column if not exists shortage_after_receiving_qty numeric;

-- 2) Extend PEQ snapshot with explicit RM supply-tier fields.
alter table if exists public.priority_queue_snapshot_current_month
  add column if not exists rm_supply_tier integer,
  add column if not exists rm_ready_shortage_qty numeric,
  add column if not exists rm_receiving_cover_qty numeric,
  add column if not exists rm_shortage_after_receiving_qty numeric;

-- 3) Recompute RM status snapshot using ready + receiving stock in one canonical pass.
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
    ready_stock_qty,
    receiving_stock_qty,
    effective_stock_qty,
    required_from_stock_qty,
    higher_priority_required_qty,
    available_before_reservation,
    reserved_qty,
    uncovered_qty,
    shortage_after_ready_qty,
    shortage_after_receiving_qty,
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
      max(coalesce(r.stock_qty_current, 0)) as ready_stock_qty,
      max(coalesce(r.required_from_stock_qty, 0)) as required_from_stock_qty,
      max(coalesce(r.higher_priority_required_qty, 0)) as higher_priority_required_qty,
      max(coalesce(r.available_before_reservation, 0)) as available_before_reservation,
      max(coalesce(r.reserved_qty, 0)) as reserved_qty,
      max(coalesce(r.uncovered_qty, 0)) as uncovered_qty
    from public.rm_reservation_snapshot_current_month r
    where r.month_start = v_month_start
    group by
      r.month_start,
      r.product_id,
      r.batch_number,
      r.rm_stock_item_id
  ),
  receiving_stock as (
    select
      s.inv_stock_item_id as rm_stock_item_id,
      sum(coalesce(s.qty_value, 0)) as receiving_stock_qty
    from public.v_rm_rms_stock_current s
    where coalesce(s.mapping_status, '') = 'mapped'
      and lower(coalesce(s.stock_stage, '')) = 'receiving'
      and coalesce(s.qty_value, 0) > 0
      and s.inv_stock_item_id is not null
    group by s.inv_stock_item_id
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
      r.issued_rm_qty,
      r.ready_stock_qty,
      coalesce(rs.receiving_stock_qty, 0) as receiving_stock_qty,
      r.required_from_stock_qty,
      r.higher_priority_required_qty,
      r.available_before_reservation,
      r.reserved_qty,
      r.uncovered_qty,
      false::boolean as is_optional_rm,
      'stock_required'::text as rm_procurement_mode,
      public.rm_issue_actionable_exists(
        r.month_start,
        r.product_id,
        r.batch_number,
        r.rm_stock_item_id
      ) as has_actionable_issue
    from reservation_dedup r
    left join receiving_stock rs
      on rs.rm_stock_item_id = r.rm_stock_item_id
  ),
  scored as (
    select
      b.*,
      (coalesce(b.ready_stock_qty, 0) + coalesce(b.receiving_stock_qty, 0)) as effective_stock_qty,
      greatest(coalesce(b.required_from_stock_qty, 0) - coalesce(b.ready_stock_qty, 0), 0) as shortage_after_ready_qty,
      greatest(coalesce(b.required_from_stock_qty, 0) - (coalesce(b.ready_stock_qty, 0) + coalesce(b.receiving_stock_qty, 0)), 0) as shortage_after_receiving_qty
    from base b
  )
  select
    s.month_start,
    s.product_id,
    s.batch_number,
    s.rm_stock_item_id,
    s.rm_name,
    s.rm_uom,
    s.planned_rm_qty,
    s.issued_rm_qty,
    s.ready_stock_qty as stock_qty,
    s.ready_stock_qty,
    s.receiving_stock_qty,
    s.effective_stock_qty,
    s.required_from_stock_qty,
    s.higher_priority_required_qty,
    s.available_before_reservation,
    s.reserved_qty,
    s.uncovered_qty,
    s.shortage_after_ready_qty,
    s.shortage_after_receiving_qty,
    s.is_optional_rm,
    s.rm_procurement_mode,
    s.has_actionable_issue as has_unassigned_issues,
    (s.has_actionable_issue or s.shortage_after_receiving_qty > 0) as is_blocking_line,
    case
      when s.has_actionable_issue then 'UNASSIGNED_ISSUE'
      when s.shortage_after_receiving_qty > 0 then 'BLOCKING_SHORTAGE'
      when s.shortage_after_ready_qty > 0 and s.shortage_after_receiving_qty = 0 then 'RECEIVING_BACKED'
      else 'SUFFICIENT_STOCK_REQUIRED'
    end as rm_status_class,
    case
      when s.has_actionable_issue then 'Actionable issue lines exist for this batch/RM item.'
      when s.shortage_after_receiving_qty > 0 then 'Blocked after considering ready + receiving stock.'
      when s.shortage_after_ready_qty > 0 and s.shortage_after_receiving_qty = 0 then 'Covered using receiving stock pending preprocessing.'
      else 'Covered by ready stock.'
    end as rm_status_reason,
    now() as refreshed_at
  from scored s
  on conflict (month_start, product_id, batch_number, rm_stock_item_id)
  do update set
    rm_name = excluded.rm_name,
    rm_uom = excluded.rm_uom,
    planned_rm_qty = excluded.planned_rm_qty,
    issued_rm_qty = excluded.issued_rm_qty,
    stock_qty = excluded.stock_qty,
    ready_stock_qty = excluded.ready_stock_qty,
    receiving_stock_qty = excluded.receiving_stock_qty,
    effective_stock_qty = excluded.effective_stock_qty,
    required_from_stock_qty = excluded.required_from_stock_qty,
    higher_priority_required_qty = excluded.higher_priority_required_qty,
    available_before_reservation = excluded.available_before_reservation,
    reserved_qty = excluded.reserved_qty,
    uncovered_qty = excluded.uncovered_qty,
    shortage_after_ready_qty = excluded.shortage_after_ready_qty,
    shortage_after_receiving_qty = excluded.shortage_after_receiving_qty,
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

-- 4) Recompute PEQ snapshot from RM status single truth (including receiving-backed tier).
create or replace function public.refresh_priority_queue_snapshot()
returns void
language plpgsql
security definer
as $function$
declare
  v_month date := date_trunc('month', now())::date;
begin
  perform set_config('statement_timeout', '10min', true);

  delete from public.priority_queue_snapshot_current_month
  where month_start = v_month;

  insert into public.priority_queue_snapshot_current_month (
    month_start,
    product_id,
    product_name,
    batch_number,
    primary_state,
    expected_output_base_qty,
    transferred_out_base_qty,
    in_system_base_qty_est,
    pm_gate_status,
    pending_pm_lines,
    has_mandatory_pm_pending,
    has_label_or_override_pending,
    pm_issue_completion_ratio,
    rm_gate_status,
    rm_pending_lines,
    rm_issue_completion_ratio,
    has_unassigned_rm_issues,
    candidate_supply_base_qty,
    is_pm_ok,
    is_pm_blocked,
    is_rm_ok_for_stage,
    total_risk_reduction_units,
    top_region,
    top_sku_id,
    top_sku_label,
    top_risk_reduction_units,
    stage_rank,
    queue_lane,
    time_sensitivity_score,
    time_sensitivity_reason,
    supply_continuity_score,
    supply_continuity_reason,
    priority_rank_v3,
    priority_rank_v4,
    rm_gate_status_display,
    batch_size_declared,
    batch_uom,
    fg_bulk_on_hand_base_qty,
    bottled_on_hand_units,
    bottled_on_hand_base_qty,
    rm_supply_tier,
    rm_ready_shortage_qty,
    rm_receiving_cover_qty,
    rm_shortage_after_receiving_qty
  )
  with src as (
    select *
    from public.mv_production_priority_queue_current_month
    where month_start = v_month
  ),
  rm_agg as (
    select
      s.month_start,
      s.product_id,
      s.batch_number,
      count(*) filter (where s.is_blocking_line) as rm_pending_lines_norm,
      bool_or(s.is_blocking_line) as has_rm_blocker,
      bool_or(s.rm_status_class = 'RECEIVING_BACKED') as has_receiving_backed,
      bool_or(s.is_blocking_line and s.rm_status_class = 'UNASSIGNED_ISSUE') as has_unassigned_rm_issues_norm,
      sum(coalesce(s.shortage_after_ready_qty, 0)) as rm_ready_shortage_qty_norm,
      sum(greatest(coalesce(s.shortage_after_ready_qty, 0) - coalesce(s.shortage_after_receiving_qty, 0), 0)) as rm_receiving_cover_qty_norm,
      sum(coalesce(s.shortage_after_receiving_qty, 0)) as rm_shortage_after_receiving_qty_norm
    from public.rm_status_snapshot_current_month s
    where s.month_start = v_month
    group by s.month_start, s.product_id, s.batch_number
  )
  select
    s.month_start,
    s.product_id,
    s.product_name,
    s.batch_number,
    s.primary_state,
    s.expected_output_base_qty,
    s.transferred_out_base_qty,
    s.in_system_base_qty_est,
    s.pm_gate_status,
    s.pending_pm_lines,
    s.has_mandatory_pm_pending,
    s.has_label_or_override_pending,
    s.pm_issue_completion_ratio,
    case
      when s.primary_state in ('FG_BULK', 'BOTTLED') then 'RM_OK'
      when coalesce(a.has_rm_blocker, false) then 'RM_BLOCKED'
      when coalesce(a.has_receiving_backed, false) then 'RM_RECEIVING'
      else 'RM_OK'
    end as rm_gate_status,
    coalesce(a.rm_pending_lines_norm, 0)::integer as rm_pending_lines,
    s.rm_issue_completion_ratio,
    coalesce(a.has_unassigned_rm_issues_norm, false) as has_unassigned_rm_issues,
    s.candidate_supply_base_qty,
    s.is_pm_ok,
    s.is_pm_blocked,
    case
      when s.primary_state in ('FG_BULK', 'BOTTLED') then true
      else not coalesce(a.has_rm_blocker, false)
    end as is_rm_ok_for_stage,
    s.total_risk_reduction_units,
    s.top_region,
    s.top_sku_id,
    s.top_sku_label,
    s.top_risk_reduction_units,
    s.stage_rank,
    case
      when s.primary_state in ('FG_BULK', 'BOTTLED') then 1
      when coalesce(a.has_rm_blocker, false) then 3
      when coalesce(s.is_pm_blocked, false) then 2
      else 1
    end as queue_lane,
    s.time_sensitivity_score,
    s.time_sensitivity_reason,
    s.supply_continuity_score,
    s.supply_continuity_reason,
    s.priority_rank_v3,
    (
      (coalesce(s.priority_rank_v4, 999999)::numeric * 10)
      + case
          when s.primary_state in ('FG_BULK', 'BOTTLED') then 0
          when coalesce(a.has_rm_blocker, false) then 9
          when coalesce(a.has_receiving_backed, false) then 5
          else 0
        end
    ) as priority_rank_v4,
    case
      when s.primary_state in ('FG_BULK', 'BOTTLED') then 'N/A'
      when coalesce(a.has_rm_blocker, false) then 'RM_BLOCKED'
      when coalesce(a.has_receiving_backed, false) then 'RM_RECEIVING'
      else 'RM_OK'
    end as rm_gate_status_display,
    s.batch_size_declared,
    s.batch_uom,
    s.fg_bulk_on_hand_base_qty,
    s.bottled_on_hand_units,
    s.bottled_on_hand_base_qty,
    case
      when s.primary_state in ('FG_BULK', 'BOTTLED') then 0
      when coalesce(a.has_rm_blocker, false) then 2
      when coalesce(a.has_receiving_backed, false) then 1
      else 0
    end as rm_supply_tier,
    coalesce(a.rm_ready_shortage_qty_norm, 0) as rm_ready_shortage_qty,
    coalesce(a.rm_receiving_cover_qty_norm, 0) as rm_receiving_cover_qty,
    coalesce(a.rm_shortage_after_receiving_qty_norm, 0) as rm_shortage_after_receiving_qty
  from src s
  left join rm_agg a
    on a.month_start = s.month_start
   and a.product_id = s.product_id
   and a.batch_number = s.batch_number;
end;
$function$;

commit;
