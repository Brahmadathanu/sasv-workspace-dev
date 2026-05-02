-- Historical RM Issue Actionability Validation
-- Purpose: Confirm that rm_issue_actionable_exists() returns non-zero rows
--          for past months (e.g. April 2026), so that 0 rows in current
--          month is correct "no actionable cases" behavior and not a regression.
-- Run this on Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. Which months have ANY issue lines at all?
-- ---------------------------------------------------------------------------
select
  date_trunc('month', issue_date)::date as month_start,
  count(*)                               as total_lines,
  count(*) filter (
    where product_id is null
      and coalesce(batch_number, '') = ''
      and coalesce(allocation_status, 'unassigned') = 'unassigned'
  )                                      as clean_unassigned_lines,
  count(*) filter (
    where product_id is not null
      and coalesce(allocation_status, 'unassigned')
          in ('unassigned','by_batch','by_product','by_sku')
  )                                      as target_mapped_unresolved_lines
from public.mrp_rm_issue_lines
group by 1
order by 1 desc
limit 12;

-- ---------------------------------------------------------------------------
-- 2. For the most recent past month with data, count distinct
--    (product_id, batch_number, rm_stock_item_id) combos that would
--    trigger UNASSIGNED_ISSUE under the new predicate.
--    Adjust :hist_month to the month_start from query 1 that has data.
-- ---------------------------------------------------------------------------
with hist_month as (
  -- automatically pick the most recent month before current with data
  select max(date_trunc('month', issue_date)::date) as m
  from public.mrp_rm_issue_lines
  where date_trunc('month', issue_date)::date < date_trunc('month', current_date)::date
)
select
  h.m                                        as month_start,
  count(distinct (l.rm_stock_item_id))       as distinct_rm_items_with_actionable,
  count(*)                                   as actionable_lines
from hist_month h
join public.mrp_rm_issue_lines l
  on date_trunc('month', l.issue_date)::date = h.m
 and coalesce(l.qty_issued, 0) > 0
 and (
       (    l.product_id is not null
        and coalesce(l.allocation_status, 'unassigned')
            in ('unassigned','by_batch','by_product','by_sku')
       )
       or
       (    l.product_id is null
        and coalesce(l.batch_number, '') = ''
        and coalesce(l.allocation_status, 'unassigned') = 'unassigned'
       )
     )
cross join hist_month;

-- ---------------------------------------------------------------------------
-- 3. Spot-check: call the canonical predicate directly for a few known
--    (product_id, batch_number, rm_stock_item_id) combos from past month.
--    Replace the values below with actual IDs from query 2's results.
-- ---------------------------------------------------------------------------
/*
select
  public.rm_issue_actionable_exists(
    '2026-04-01'::date,   -- p_horizon_start
    <product_id>,          -- p_product_id
    '<batch_number>',      -- p_batch_number
    <rm_stock_item_id>     -- p_rm_stock_item_id
  ) as is_actionable;
*/

-- ---------------------------------------------------------------------------
-- 4. Sanity: current month clean-unassigned count (should be 0 or near 0
--    for the fix to be working correctly)
-- ---------------------------------------------------------------------------
select
  date_trunc('month', issue_date)::date as month_start,
  count(*) filter (
    where product_id is null
      and coalesce(batch_number, '') = ''
      and coalesce(allocation_status, 'unassigned') = 'unassigned'
      and coalesce(qty_issued, 0) > 0
  ) as clean_unassigned_with_qty,
  count(*) as total_lines
from public.mrp_rm_issue_lines
where date_trunc('month', issue_date)::date = date_trunc('month', current_date)::date
group by 1;
