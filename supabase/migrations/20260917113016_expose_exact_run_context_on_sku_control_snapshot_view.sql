-- SOURCE-CONTROL PARITY
-- Already applied live as:
--   20260917113016_expose_exact_run_context_on_sku_control_snapshot_view
-- DO NOT reapply to production.
--
-- Captured from supabase_migrations.schema_migrations.statements (live).
-- Appends valuation_date and refresh_run_id at the end of
-- public.v_costing_pricing_sku_control_status_snapshot.
-- Preserves security_invoker, current-successful-run join,
-- direct-labour route override semantics, and authenticated/service_role SELECT.

create or replace view public.v_costing_pricing_sku_control_status_snapshot
with (security_invoker = true)
as
select
    s.period_start,
    s.snapshot_refreshed_at,
    s.sku_id,
    s.product_id,
    s.product_name,
    s.pack_size,
    s.pack_uom,
    s.material_costing_status,
    s.rm_costing_status,
    s.pm_costing_status,
    s.manufacturing_cop_status,
    s.internal_loaded_cost_status,
    s.pricing_bridge_status,
    s.selling_price_bridge_status,
    s.cost_sheet_status,
    case
        when s.material_costing_status <> 'BLOCKED'
         and dl.direct_labour_allocation_status = 'BLOCKED'
         and dl.allocation_reason_code = 'BLOCKED_NO_VALID_EFFECTIVE_ROUTE'
            then 'DIRECT_LABOUR_ROUTE_BLOCKED'
        else s.first_control_status
    end as first_control_status,
    case
        when s.material_costing_status <> 'BLOCKED'
         and dl.direct_labour_allocation_status = 'BLOCKED'
         and dl.allocation_reason_code = 'BLOCKED_NO_VALID_EFFECTIVE_ROUTE'
            then 'BLOCKER'
        else s.control_severity
    end as control_severity,
    case
        when s.material_costing_status <> 'BLOCKED'
         and dl.direct_labour_allocation_status = 'BLOCKED'
         and dl.allocation_reason_code = 'BLOCKED_NO_VALID_EFFECTIVE_ROUTE'
            then 'PRODUCTION_ROUTE_MANAGER'
        else s.recommended_ui_route
    end as recommended_ui_route,
    case
        when s.material_costing_status <> 'BLOCKED'
         and dl.direct_labour_allocation_status = 'BLOCKED'
         and dl.allocation_reason_code = 'BLOCKED_NO_VALID_EFFECTIVE_ROUTE'
            then 'No valid effective Production Route is available for this Product.'
        else s.control_note
    end as control_note,
    s.rm_blocking_line_count,
    s.pm_blocking_line_count,
    s.rm_review_rate_line_count,
    s.pm_review_rate_line_count,
    s.rm_stale_purchase_rate_line_count,
    s.pm_stale_purchase_rate_line_count,
    s.rm_stock_valuation_fallback_line_count,
    s.pm_stock_valuation_fallback_line_count,
    s.rm_manual_rate_line_count,
    s.pm_manual_rate_line_count,
    s.material_cost_per_sku,
    s.mrp_ik,
    s.mrp_ok,
    s.ik_selling_price,
    s.ok_selling_price,
    s.ik_margin_amount_before_scheme,
    s.ik_margin_percent_before_scheme,
    s.ok_margin_amount_before_scheme,
    s.ok_margin_percent_before_scheme,
    s.valuation_date,
    s.refresh_run_id
from costing.sku_costing_control_status_snapshot s
join costing.v_current_successful_costing_refresh_run r
  on r.period_start = s.period_start
 and r.valuation_date = s.valuation_date
 and r.refresh_run_id = s.refresh_run_id
left join costing.sku_direct_labour_allocation_snapshot dl
  on dl.period_start = s.period_start
 and dl.valuation_date = s.valuation_date
 and dl.refresh_run_id = s.refresh_run_id
 and dl.sku_id = s.sku_id
where current_user = any(array['service_role'::name,'postgres'::name])
   or app_has_permission('module:costing-control-center','view');

grant select on public.v_costing_pricing_sku_control_status_snapshot to authenticated, service_role;
