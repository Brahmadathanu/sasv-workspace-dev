-- PROPOSAL ONLY: NOT BUILT. User 18 Oct 2026 21:48 IST: "not yet". Do not apply without explicit approval.
-- Read-only feed for the Google Sheets price-revision plan. Strictly APPROVED runs; never falls back to "latest success".
-- Tested read-only (SELECT of the body) 18 Oct 21:45 IST: Sep run 122 = 634 SKUs (74 IK / 70 OK negative); Oct run 128 = 627 SKUs (9 / 9); latest approved period = Oct.
-- Security-invoker so existing costing permissions apply.
create or replace view costing.v_price_revision_feed_approved with (security_invoker = true) as
with appr as (
  select distinct on (e.period_start) e.period_start, e.refresh_run_id, e.designated_at, e.designated_by, e.designation_id
  from costing.v_costing_run_effective_designation e
  join costing.costing_refresh_run r on r.id = e.refresh_run_id and r.overall_status = 'SUCCESS'
  where e.designation = 'APPROVED'
  order by e.period_start, e.designated_at desc, e.designation_id desc)
select a.period_start, d.valuation_date, a.refresh_run_id, a.designated_at as approved_at, a.designated_by as approved_by,
       (a.period_start = max(a.period_start) over ()) as is_latest_approved_period,
       d.sku_id, d.product_id, d.product_name, d.pack_size, d.pack_uom,
       d.mrp_ik, d.mrp_ok, d.material_cost_per_sku, d.direct_labour_cost_per_sku, d.manufacturing_cop_per_sku,
       d.internal_loaded_cost_per_sku, d.pricing_cost_per_sku, d.ik_selling_price, d.ok_selling_price,
       d.ik_margin_amount_before_scheme, d.ik_margin_percent_before_scheme,
       d.ok_margin_amount_before_scheme, d.ok_margin_percent_before_scheme,
       (d.ik_margin_amount_before_scheme < 0) as ik_negative_margin,
       (d.ok_margin_amount_before_scheme < 0) as ok_negative_margin,
       d.cost_sheet_status, d.refreshed_at
from appr a
join costing.v_sku_detailed_cost_sheet d on d.refresh_run_id = a.refresh_run_id and d.period_start = a.period_start;
-- Sheets would read: select * from costing.v_price_revision_feed_approved where is_latest_approved_period;
