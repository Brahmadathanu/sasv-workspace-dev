-- RM / PEQ single-source-of-truth introspection
-- Run these on the live database and share the outputs before server patching.

-- 1. Refresh function currently used after RM allocation save.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'refresh_after_rm_allocation';

-- 2. Any function that directly references the RM status or PEQ snapshot tables.
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prokind,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and (
    pg_get_functiondef(p.oid) ilike '%rm_status_snapshot_current_month%'
    or pg_get_functiondef(p.oid) ilike '%priority_queue_snapshot_current_month%'
  )
order by p.proname;

-- 3. Any trigger attached to either snapshot table.
select
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid, true) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'rm_status_snapshot_current_month',
    'priority_queue_snapshot_current_month'
  )
  and not t.tgisinternal
order by c.relname, t.tgname;

-- 4. Views that likely feed RM status semantics.
select
  n.nspname as schema_name,
  c.relname as object_name,
  c.relkind,
  pg_get_viewdef(c.oid, true) as definition
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'v_batch_rm_readiness',
    'v_rm_blockers_priority_batches_current_month',
    'rm_blockers_snapshot_current_month',
    'rm_reservation_snapshot_current_month'
  )
order by c.relname;

-- 5. Functions or procedures that reference the batch RM readiness view.
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prokind,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ilike '%v_batch_rm_readiness%'
order by p.proname;

-- 6. Functions or procedures that reference the RM issue monthly views.
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prokind,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and (
    pg_get_functiondef(p.oid) ilike '%v_mrp_rm_issue_monthly_allocated%'
    or pg_get_functiondef(p.oid) ilike '%v_mrp_rm_issue_monthly_enriched%'
  )
order by p.proname;

-- 6b. Targeted writer routines from refresh_after_rm_allocation chain.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.proname in (
    'refresh_rm_reservation_snapshot_current_month',
    'refresh_rm_status_from_reservation_current_month',
    'refresh_mv_production_priority_queue_current_month',
    'refresh_priority_queue_snapshot',
    'refresh_blocker_snapshots_current_month'
  )
order by p.proname;

-- 6c. Core feeder views used by the snapshot writer routines.
select
  n.nspname as schema_name,
  c.relname as object_name,
  c.relkind,
  pg_get_viewdef(c.oid, true) as definition
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and c.relname in (
    'v_mrp_rm_by_batch',
    'v_production_priority_queue_current_month',
    'v_rm_blockers_priority_batches_current_month'
  )
order by c.relname;

-- 7. Sanity query: confirm whether any clean unmapped candidates exist for the target batch.
with target as (
  select
    date '2026-04-01' as horizon_start,
    694::bigint as product_id,
    'SP763'::text as batch_number,
    294::bigint as rm_stock_item_id
)
select
  count(*) filter (
    where l.product_id is null
      and coalesce(l.batch_number, '') = ''
      and coalesce(l.allocation_status, '') = 'unassigned'
  ) as clean_unassigned_line_count,
  coalesce(sum(l.qty_issued) filter (
    where l.product_id is null
      and coalesce(l.batch_number, '') = ''
      and coalesce(l.allocation_status, '') = 'unassigned'
  ), 0) as clean_unassigned_qty,
  count(*) filter (
    where l.product_id = (select product_id from target)
      and l.batch_number = (select batch_number from target)
  ) as exact_target_line_count,
  coalesce(sum(l.qty_issued) filter (
    where l.product_id = (select product_id from target)
      and l.batch_number = (select batch_number from target)
  ), 0) as exact_target_qty
from public.mrp_rm_issue_lines l
join target t on t.rm_stock_item_id = l.rm_stock_item_id
where date_trunc('month', l.issue_date)::date = t.horizon_start;