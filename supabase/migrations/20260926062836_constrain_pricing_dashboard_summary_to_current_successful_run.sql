-- backfilled from live schema_migrations on 2026-10-24, CI-016

create or replace view public.v_costing_pricing_dashboard_summary as
select
  d.period_start,
  d.pricing_bridge_sku_count,
  d.pricing_bridge_blocked_count,
  d.pricing_bridge_review_required_count,
  d.pricing_bridge_ready_count,
  d.selling_price_sku_count,
  d.selling_price_blocked_count,
  d.selling_price_review_required_count,
  d.selling_price_ready_count,
  d.scheme_viability_row_count,
  d.scheme_blocked_count,
  d.scheme_review_required_count,
  d.scheme_ready_count,
  d.latest_refresh_started_at,
  d.latest_refresh_finished_at,
  d.latest_refresh_status,
  d.latest_refresh_scope,
  d.latest_refresh_error,
  d.valuation_date,
  d.refresh_run_id
from costing.v_pricing_workflow_dashboard_summary d
join costing.v_current_successful_costing_refresh_run r
  on r.period_start = d.period_start
 and r.valuation_date = d.valuation_date
 and r.refresh_run_id = d.refresh_run_id;

revoke all on public.v_costing_pricing_dashboard_summary from public, anon;
grant select on public.v_costing_pricing_dashboard_summary to authenticated, service_role;
