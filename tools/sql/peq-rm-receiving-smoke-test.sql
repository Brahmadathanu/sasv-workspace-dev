-- PEQ RM Receiving Smoke Test
-- Run after applying migration 20260501094500_rm_receiving_single_source_priority.sql

-- 0) Refresh canonical chain
select public.refresh_after_rm_allocation();

-- 1) Verify schema extensions exist
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'rm_status_snapshot_current_month' and column_name in (
      'ready_stock_qty','receiving_stock_qty','effective_stock_qty','shortage_after_ready_qty','shortage_after_receiving_qty'
    ))
    or
    (table_name = 'priority_queue_snapshot_current_month' and column_name in (
      'rm_supply_tier','rm_ready_shortage_qty','rm_receiving_cover_qty','rm_shortage_after_receiving_qty'
    ))
  )
order by table_name, column_name;

-- 2) Current-month status distribution
with m as (
  select date_trunc('month', current_date)::date as month_start
)
select
  s.rm_status_class,
  count(*) as line_count,
  sum(coalesce(s.shortage_after_ready_qty,0)) as sum_shortage_after_ready,
  sum(coalesce(s.shortage_after_receiving_qty,0)) as sum_shortage_after_receiving
from public.rm_status_snapshot_current_month s
join m on m.month_start = s.month_start
group by s.rm_status_class
order by 1;

-- 3) Invariant checks (must all be zero rows)
-- 3a. RECEIVING_BACKED lines must not be blocking
select *
from public.rm_status_snapshot_current_month
where month_start = date_trunc('month', current_date)::date
  and rm_status_class = 'RECEIVING_BACKED'
  and is_blocking_line = true
limit 20;

-- 3b. BLOCKING_SHORTAGE must have shortage_after_receiving_qty > 0
select *
from public.rm_status_snapshot_current_month
where month_start = date_trunc('month', current_date)::date
  and rm_status_class = 'BLOCKING_SHORTAGE'
  and coalesce(shortage_after_receiving_qty,0) <= 0
limit 20;

-- 3c. SUFFICIENT_STOCK_REQUIRED should have no post-receiving shortage
select *
from public.rm_status_snapshot_current_month
where month_start = date_trunc('month', current_date)::date
  and rm_status_class = 'SUFFICIENT_STOCK_REQUIRED'
  and coalesce(shortage_after_receiving_qty,0) > 0
limit 20;

-- 4) Queue-level RM gate and tier sanity
select
  q.rm_gate_status,
  q.rm_gate_status_display,
  q.rm_supply_tier,
  count(*) as batch_count
from public.priority_queue_snapshot_current_month q
where q.month_start = date_trunc('month', current_date)::date
group by q.rm_gate_status, q.rm_gate_status_display, q.rm_supply_tier
order by q.rm_supply_tier, q.rm_gate_status;

-- 5) Queue consistency checks (must be zero rows)
-- 5a. RM_BLOCKED must be tier 2
select *
from public.priority_queue_snapshot_current_month q
where q.month_start = date_trunc('month', current_date)::date
  and q.rm_gate_status = 'RM_BLOCKED'
  and q.rm_supply_tier <> 2
limit 20;

-- 5b. RM_RECEIVING must be tier 1
select *
from public.priority_queue_snapshot_current_month q
where q.month_start = date_trunc('month', current_date)::date
  and q.rm_gate_status = 'RM_RECEIVING'
  and q.rm_supply_tier <> 1
limit 20;

-- 5c. RM_OK must be tier 0 (except N/A stage also maps to 0)
select *
from public.priority_queue_snapshot_current_month q
where q.month_start = date_trunc('month', current_date)::date
  and q.rm_gate_status = 'RM_OK'
  and q.rm_supply_tier <> 0
limit 20;

-- 6) Sample rows for manual validation
select
  q.priority_rank_v4,
  q.queue_lane,
  q.product_id,
  q.product_name,
  q.batch_number,
  q.primary_state,
  q.rm_gate_status,
  q.rm_supply_tier,
  q.rm_ready_shortage_qty,
  q.rm_receiving_cover_qty,
  q.rm_shortage_after_receiving_qty
from public.priority_queue_snapshot_current_month q
where q.month_start = date_trunc('month', current_date)::date
order by q.priority_rank_v4 asc
limit 100;
