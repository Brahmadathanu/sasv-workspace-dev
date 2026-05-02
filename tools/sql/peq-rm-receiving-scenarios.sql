-- PEQ RM Receiving — Scenario Verification Queries
-- Run in Supabase SQL editor after migration 20260501094500

-- ═══════════════════════════════════════════════════════════════════
-- SCENARIO 1: Batches that became RM_OK because receiving stock
--             fully covered all ready-stock shortages.
--             Gate: RM_RECEIVING  |  Tier: 1  |  Lane: 1 (not blocked)
-- ═══════════════════════════════════════════════════════════════════

-- 1a. Queue-level: count and list RM_RECEIVING batches
select
  q.priority_rank_v4,
  q.product_id,
  q.product_name,
  q.batch_number,
  q.primary_state,
  q.rm_gate_status,
  q.rm_supply_tier,
  round(q.rm_ready_shortage_qty::numeric,   3) as ready_shortage_qty,
  round(q.rm_receiving_cover_qty::numeric,  3) as receiving_cover_qty,
  round(q.rm_shortage_after_receiving_qty::numeric, 3) as shortage_after_receiving
from public.priority_queue_snapshot_current_month q
where q.month_start = date_trunc('month', current_date)::date
  and q.rm_gate_status = 'RM_RECEIVING'
order by q.priority_rank_v4;

-- 1b. Line-level: show the RECEIVING_BACKED lines for those batches
--     (these are the specific RM items where receiving stock closed the gap)
select
  s.product_id,
  q.product_name,
  s.batch_number,
  s.rm_name,
  s.rm_uom,
  round(s.planned_rm_qty::numeric,             3) as planned_qty,
  round(s.ready_stock_qty::numeric,            3) as ready_stock,
  round(s.receiving_stock_qty::numeric,        3) as receiving_stock,
  round(s.effective_stock_qty::numeric,        3) as effective_stock,
  round(s.shortage_after_ready_qty::numeric,   3) as shortage_after_ready,
  round(s.shortage_after_receiving_qty::numeric,3) as shortage_after_receiving,
  s.rm_status_class
from public.rm_status_snapshot_current_month s
join public.priority_queue_snapshot_current_month q
  on  q.product_id   = s.product_id
  and q.batch_number = s.batch_number
  and q.month_start  = s.month_start
where s.month_start   = date_trunc('month', current_date)::date
  and q.rm_gate_status = 'RM_RECEIVING'
  and s.rm_status_class = 'RECEIVING_BACKED'
order by q.product_name, s.batch_number, s.rm_name;


-- ═══════════════════════════════════════════════════════════════════
-- SCENARIO 2: Batches still RM_BLOCKED but partially helped by
--             receiving stock (rm_receiving_cover_qty > 0 yet
--             rm_shortage_after_receiving_qty > 0 too).
-- ═══════════════════════════════════════════════════════════════════

-- 2a. Queue-level: RM_BLOCKED batches with partial receiving cover
select
  q.priority_rank_v4,
  q.product_id,
  q.product_name,
  q.batch_number,
  q.primary_state,
  q.rm_gate_status,
  round(q.rm_ready_shortage_qty::numeric,         3) as ready_shortage_qty,
  round(q.rm_receiving_cover_qty::numeric,        3) as receiving_cover_qty,
  round(q.rm_shortage_after_receiving_qty::numeric,3) as remaining_shortage
from public.priority_queue_snapshot_current_month q
where q.month_start = date_trunc('month', current_date)::date
  and q.rm_gate_status = 'RM_BLOCKED'
  and q.rm_receiving_cover_qty > 0
order by q.rm_receiving_cover_qty desc, q.priority_rank_v4;

-- 2b. Line-level breakdown for those partially-covered blocked batches:
--     shows which RM items are RECEIVING_BACKED (partially helped) vs
--     which are still BLOCKING_SHORTAGE (still hard-blocking)
select
  s.product_id,
  q.product_name,
  s.batch_number,
  s.rm_name,
  s.rm_uom,
  round(s.planned_rm_qty::numeric,              3) as planned_qty,
  round(s.ready_stock_qty::numeric,             3) as ready_stock,
  round(s.receiving_stock_qty::numeric,         3) as receiving_stock,
  round(s.effective_stock_qty::numeric,         3) as effective_stock,
  round(s.shortage_after_ready_qty::numeric,    3) as shortage_after_ready,
  round(s.shortage_after_receiving_qty::numeric, 3) as shortage_after_receiving,
  s.rm_status_class,
  s.is_blocking_line
from public.rm_status_snapshot_current_month s
join public.priority_queue_snapshot_current_month q
  on  q.product_id   = s.product_id
  and q.batch_number = s.batch_number
  and q.month_start  = s.month_start
where s.month_start   = date_trunc('month', current_date)::date
  and q.rm_gate_status = 'RM_BLOCKED'
  and q.rm_receiving_cover_qty > 0
  -- only lines that are relevant to receiving (either helped or still blocking)
  and s.rm_status_class in ('RECEIVING_BACKED', 'BLOCKING_SHORTAGE')
order by q.product_name, s.batch_number,
         s.is_blocking_line desc,   -- blocking lines first
         s.rm_name;


-- ═══════════════════════════════════════════════════════════════════
-- SCENARIO 3: Chukku deep-dive diagnostics
-- Goal:
--   1) Confirm whether Chukku exists in receiving stage (not rms stage)
--   2) List batches where Chukku is blocking
--   3) Show ready vs receiving contribution on those lines
-- ═══════════════════════════════════════════════════════════════════

-- 3a. Resolve Chukku stock item IDs seen in stock snapshots
select distinct
  e.inv_stock_item_id,
  e.code,
  e.name,
  e.mapping_status
from public.v_rm_rms_stock_snapshot_enriched e
where e.mapping_status = 'mapped'
  and lower(e.name) like '%chukku%'
order by e.inv_stock_item_id;

-- 3b. Stage-wise Chukku stock in the canonical receiving source view.
-- NOTE: For RM_RECEIVING logic, only stock_stage='receiving' is counted.
select
  c.inv_stock_item_id,
  c.name,
  s.stock_stage,
  s.godown_name,
  round(sum(coalesce(s.qty_value,0))::numeric, 3) as qty_total
from public.v_rm_rms_stock_snapshot_enriched s
join (
  select distinct inv_stock_item_id, name
  from public.v_rm_rms_stock_snapshot_enriched
  where mapping_status = 'mapped'
    and lower(name) like '%chukku%'
) c on c.inv_stock_item_id = s.inv_stock_item_id
where s.mapping_status = 'mapped'
group by c.inv_stock_item_id, c.name, s.stock_stage, s.godown_name
order by c.inv_stock_item_id, s.stock_stage, s.godown_name;

-- 3c. Batches where Chukku is currently a blocking RM line
select
  q.priority_rank_v4,
  q.product_id,
  q.product_name,
  s.batch_number,
  s.rm_stock_item_id,
  s.rm_name,
  round(s.planned_rm_qty::numeric, 3) as planned_qty,
  round(s.issued_rm_qty::numeric, 3) as issued_qty,
  round(s.ready_stock_qty::numeric, 3) as ready_stock_qty,
  round(s.receiving_stock_qty::numeric, 3) as receiving_stock_qty,
  round(s.shortage_after_ready_qty::numeric, 3) as shortage_after_ready,
  round(s.shortage_after_receiving_qty::numeric, 3) as shortage_after_receiving,
  s.rm_status_class,
  s.is_blocking_line,
  q.rm_gate_status,
  q.rm_supply_tier
from public.rm_status_snapshot_current_month s
join public.priority_queue_snapshot_current_month q
  on  q.product_id   = s.product_id
  and q.batch_number = s.batch_number
  and q.month_start  = s.month_start
where s.month_start = date_trunc('month', current_date)::date
  and s.is_blocking_line = true
  and s.rm_status_class = 'BLOCKING_SHORTAGE'
  and lower(s.rm_name) like '%chukku%'
order by q.priority_rank_v4, s.batch_number;

-- 3d. Same Chukku lines with a quick interpretation flag
-- EXPECTED outcomes:
--   - 'NO_RECEIVING_STOCK' -> receiving not present for Chukku
--   - 'PARTIAL_RECEIVING_COVER' -> receiving helps but does not fully close gap
--   - 'FULLY_COVERED_BY_RECEIVING' -> would usually shift line to RECEIVING_BACKED
select
  q.product_id,
  q.product_name,
  s.batch_number,
  s.rm_name,
  round(s.shortage_after_ready_qty::numeric, 3) as shortage_after_ready,
  round(s.receiving_stock_qty::numeric, 3) as receiving_stock_qty,
  round(s.shortage_after_receiving_qty::numeric, 3) as shortage_after_receiving,
  case
    when coalesce(s.receiving_stock_qty,0) <= 0 then 'NO_RECEIVING_STOCK'
    when coalesce(s.shortage_after_receiving_qty,0) > 0 then 'PARTIAL_RECEIVING_COVER'
    else 'FULLY_COVERED_BY_RECEIVING'
  end as receiving_effect
from public.rm_status_snapshot_current_month s
join public.priority_queue_snapshot_current_month q
  on  q.product_id   = s.product_id
  and q.batch_number = s.batch_number
  and q.month_start  = s.month_start
where s.month_start = date_trunc('month', current_date)::date
  and lower(s.rm_name) like '%chukku%'
order by q.product_name, s.batch_number;


-- ═══════════════════════════════════════════════════════════════════
-- SCENARIO 4: Reconcile "82 affected" vs "0 currently blocking"
-- Goal: identify which denominator/filter set the leverage snapshot is using.
-- ═══════════════════════════════════════════════════════════════════

-- 4a. Single-screen count decomposition for Chukku (rm_stock_item_id = 241)
with base as (
  select
    s.product_id,
    s.batch_number,
    s.rm_stock_item_id,
    s.rm_name,
    s.rm_procurement_mode,
    s.is_optional_rm,
    s.is_blocking_line,
    s.rm_status_class,
    coalesce(s.planned_rm_qty, 0) as planned_rm_qty,
    coalesce(s.issued_rm_qty, 0) as issued_rm_qty,
    coalesce(s.shortage_after_ready_qty, 0) as shortage_after_ready_qty,
    q.primary_state,
    q.rm_gate_status,
    q.rm_gate_status_display
  from public.rm_status_snapshot_current_month s
  join public.priority_queue_snapshot_current_month q
    on  q.product_id   = s.product_id
    and q.batch_number = s.batch_number
    and q.month_start  = s.month_start
  where s.month_start = date_trunc('month', current_date)::date
    and s.rm_stock_item_id = 241
)
select
  count(distinct (product_id, batch_number)) as total_batches_with_chukku,
  count(distinct (product_id, batch_number)) filter (
    where primary_state not in ('FG_BULK', 'BOTTLED')
  ) as gate_active_stage_batches,
  count(distinct (product_id, batch_number)) filter (
    where rm_procurement_mode = 'stock_required'
  ) as stock_required_batches,
  count(distinct (product_id, batch_number)) filter (
    where rm_procurement_mode = 'stock_required'
      and primary_state not in ('FG_BULK', 'BOTTLED')
  ) as stock_required_gate_active_batches,
  count(distinct (product_id, batch_number)) filter (
    where planned_rm_qty > issued_rm_qty
  ) as net_required_batches,
  count(distinct (product_id, batch_number)) filter (
    where rm_status_class = 'BLOCKING_SHORTAGE' and is_blocking_line = true
  ) as currently_blocking_batches
from base;

-- 4b. Show leverage snapshot row beside status-derived aggregates for Chukku
with status_agg as (
  select
    count(distinct (s.product_id, s.batch_number)) as batches_in_status,
    count(distinct (s.product_id, s.batch_number)) filter (
      where q.primary_state not in ('FG_BULK', 'BOTTLED')
    ) as batches_gate_active,
    count(distinct (s.product_id, s.batch_number)) filter (
      where s.rm_procurement_mode = 'stock_required'
    ) as batches_stock_required,
    count(distinct (s.product_id, s.batch_number)) filter (
      where s.rm_procurement_mode = 'stock_required'
        and q.primary_state not in ('FG_BULK', 'BOTTLED')
    ) as batches_stock_required_gate_active,
    count(distinct (s.product_id, s.batch_number)) filter (
      where s.rm_status_class = 'BLOCKING_SHORTAGE' and s.is_blocking_line = true
    ) as batches_currently_blocking,
    sum(coalesce(s.planned_rm_qty,0)) as sum_planned,
    sum(coalesce(s.issued_rm_qty,0)) as sum_issued,
    sum(greatest(coalesce(s.planned_rm_qty,0) - coalesce(s.issued_rm_qty,0), 0)) as sum_net_required
  from public.rm_status_snapshot_current_month s
  join public.priority_queue_snapshot_current_month q
    on  q.product_id   = s.product_id
    and q.batch_number = s.batch_number
    and q.month_start  = s.month_start
  where s.month_start = date_trunc('month', current_date)::date
    and s.rm_stock_item_id = 241
)
select
  l.rm_stock_item_id,
  l.rm_name,
  l.blocked_batch_count as leverage_blocked_batch_count,
  round(l.total_required_qty::numeric, 3) as leverage_total_required_qty,
  round(l.stock_qty::numeric, 3) as leverage_stock_qty,
  round(l.shortage_qty::numeric, 3) as leverage_shortage_qty,
  round(l.coverage_ratio::numeric, 6) as leverage_coverage_ratio,
  l.leverage_category,
  s.batches_in_status,
  s.batches_gate_active,
  s.batches_stock_required,
  s.batches_stock_required_gate_active,
  s.batches_currently_blocking,
  round(s.sum_planned::numeric, 3) as status_sum_planned,
  round(s.sum_issued::numeric, 3) as status_sum_issued,
  round(s.sum_net_required::numeric, 3) as status_sum_net_required
from public.rm_leverage_snapshot_current_month l
cross join status_agg s
where l.month_start = date_trunc('month', current_date)::date
  and l.rm_stock_item_id = 241;

-- 4c. Batch list likely contributing to "affected" but not currently blocking
-- (useful for manual sanity when blocked_batch_count is high but blockers are zero)
select
  q.priority_rank_v4,
  s.product_id,
  q.product_name,
  s.batch_number,
  q.primary_state,
  s.rm_procurement_mode,
  s.rm_status_class,
  s.is_blocking_line,
  round((coalesce(s.planned_rm_qty,0) - coalesce(s.issued_rm_qty,0))::numeric, 3) as net_required_qty,
  round(s.shortage_after_ready_qty::numeric, 3) as shortage_after_ready,
  round(s.shortage_after_receiving_qty::numeric, 3) as shortage_after_receiving
from public.rm_status_snapshot_current_month s
join public.priority_queue_snapshot_current_month q
  on  q.product_id   = s.product_id
  and q.batch_number = s.batch_number
  and q.month_start  = s.month_start
where s.month_start = date_trunc('month', current_date)::date
  and s.rm_stock_item_id = 241
  and q.primary_state not in ('FG_BULK', 'BOTTLED')
order by q.priority_rank_v4, q.product_name, s.batch_number;
