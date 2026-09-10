-- Cost Sheet Review — printable product summary, current governed run only.
-- Date: 2026-09-10
--
-- Purpose:
--   public.v_costing_pricing_printable_cost_sheet_product_summary previously
--   aggregated every historical snapshot run in a period. The Cost Sheet tab
--   therefore fetched duplicate product rows and could hit statement_timeout.
--   Restrict both source CTEs to costing.v_current_successful_costing_refresh_run,
--   matching the SKU Cost Details selector governance model.
--
-- Method:
--   CREATE OR REPLACE VIEW with the same output columns and outer SELECT.
--   JOIN the existing current-successful-run helper in product_base and
--   status_by_product. No table changes, no DROP CASCADE, no new indexes.
--
-- Out of scope:
--   v_costing_pricing_sku_selector, printable line view, snapshot tables,
--   statement_timeout, costing refresh RPCs.

create or replace view public.v_costing_pricing_printable_cost_sheet_product_summary as
with product_base as (
  select
    s_1.snapshot_period_start as period_start,
    s_1.valuation_date,
    s_1.refresh_run_id,
    s_1.product_id,
    s_1.product_name,
    max(s_1.category_name) as category_name,
    max(s_1.subcategory_name) as subcategory_name,
    max(s_1.group_name) as group_name,
    max(s_1.sub_group_name) as sub_group_name,
    max(s_1.product_hierarchy) as product_hierarchy,
    count(distinct s_1.sku_id) as sku_count,
    count(*) as line_count,
    string_agg(distinct s_1.sku_column_label, ', '::text order by s_1.sku_column_label) as sku_column_labels,
    max(s_1.refreshed_at) as refreshed_at,
    max(s_1.snapshot_refreshed_at) as snapshot_refreshed_at
  from costing.cost_sheet_line_monthly_snapshot s_1
  join costing.v_current_successful_costing_refresh_run r
    on r.period_start = s_1.snapshot_period_start
   and r.valuation_date = s_1.valuation_date
   and r.refresh_run_id = s_1.refresh_run_id
  group by
    s_1.snapshot_period_start,
    s_1.valuation_date,
    s_1.refresh_run_id,
    s_1.product_id,
    s_1.product_name
), status_by_product as (
  select
    s_1.snapshot_period_start as period_start,
    s_1.valuation_date,
    s_1.refresh_run_id,
    s_1.product_id,
    count(distinct s_1.sku_id) filter (
      where s_1.line_label = 'Cost Sheet Status'::text
        and s_1.value_text = 'BLOCKED'::text
    ) as blocked_line_count,
    count(distinct s_1.sku_id) filter (
      where s_1.line_label = 'Cost Sheet Status'::text
        and s_1.value_text = 'REVIEW_REQUIRED'::text
    ) as review_required_line_count,
    count(distinct s_1.sku_id) filter (
      where s_1.line_label = 'Cost Sheet Status'::text
        and s_1.value_text = 'READY'::text
    ) as ready_line_count,
    max(s_1.value_text) filter (
      where s_1.line_label = 'Cost Sheet Note'::text
    ) as sample_cost_sheet_note
  from costing.cost_sheet_line_monthly_snapshot s_1
  join costing.v_current_successful_costing_refresh_run r
    on r.period_start = s_1.snapshot_period_start
   and r.valuation_date = s_1.valuation_date
   and r.refresh_run_id = s_1.refresh_run_id
  where s_1.line_label = any (array['Cost Sheet Status'::text, 'Cost Sheet Note'::text])
  group by
    s_1.snapshot_period_start,
    s_1.valuation_date,
    s_1.refresh_run_id,
    s_1.product_id
)
select
  b.period_start,
  b.product_id,
  b.product_name,
  b.category_name,
  b.subcategory_name,
  b.group_name,
  b.sub_group_name,
  b.product_hierarchy,
  b.sku_count,
  b.line_count,
  coalesce(s.blocked_line_count, 0::bigint) as blocked_line_count,
  coalesce(s.review_required_line_count, 0::bigint) as review_required_line_count,
  coalesce(s.ready_line_count, 0::bigint) as ready_line_count,
  case
    when coalesce(s.blocked_line_count, 0::bigint) > 0 then 'BLOCKED'::text
    when coalesce(s.review_required_line_count, 0::bigint) > 0 then 'REVIEW_REQUIRED'::text
    when coalesce(s.ready_line_count, 0::bigint) = b.sku_count then 'READY'::text
    else null::text
  end as cost_sheet_status,
  case
    when coalesce(s.blocked_line_count, 0::bigint) > 0 then 'One or more SKU cost sheets are blocked.'::text
    when coalesce(s.review_required_line_count, 0::bigint) > 0 then 'One or more SKU cost sheets require review.'::text
    when coalesce(s.ready_line_count, 0::bigint) = b.sku_count then 'All SKU cost sheets are ready.'::text
    else s.sample_cost_sheet_note
  end as cost_sheet_note,
  b.sku_column_labels,
  b.refreshed_at,
  b.snapshot_refreshed_at,
  b.valuation_date,
  b.refresh_run_id
from product_base b
left join status_by_product s
  on s.period_start = b.period_start
 and not s.valuation_date is distinct from b.valuation_date
 and not s.refresh_run_id is distinct from b.refresh_run_id
 and s.product_id = b.product_id;

grant select on public.v_costing_pricing_printable_cost_sheet_product_summary to authenticated;
