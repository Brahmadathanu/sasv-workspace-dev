-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view public.v_costing_pricing_sku_control_status_snapshot as
select s.period_start,s.snapshot_refreshed_at,s.sku_id,s.product_id,s.product_name,s.pack_size,s.pack_uom,
 s.material_costing_status,s.rm_costing_status,s.pm_costing_status,s.manufacturing_cop_status,s.internal_loaded_cost_status,
 s.pricing_bridge_status,s.selling_price_bridge_status,s.cost_sheet_status,s.first_control_status,s.control_severity,
 s.recommended_ui_route,s.control_note,s.rm_blocking_line_count,s.pm_blocking_line_count,s.rm_review_rate_line_count,
 s.pm_review_rate_line_count,s.rm_stale_purchase_rate_line_count,s.pm_stale_purchase_rate_line_count,
 s.rm_stock_valuation_fallback_line_count,s.pm_stock_valuation_fallback_line_count,s.rm_manual_rate_line_count,
 s.pm_manual_rate_line_count,s.material_cost_per_sku,s.mrp_ik,s.mrp_ok,s.ik_selling_price,s.ok_selling_price,
 s.ik_margin_amount_before_scheme,s.ik_margin_percent_before_scheme,s.ok_margin_amount_before_scheme,s.ok_margin_percent_before_scheme
from costing.sku_costing_control_status_snapshot s
join costing.v_current_successful_costing_refresh_run r
 on r.period_start=s.period_start and r.valuation_date=s.valuation_date and r.refresh_run_id=s.refresh_run_id;

do $do$
declare v_name text; v_def text;
begin
 foreach v_name in array array[
   'v_costing_pricing_control_dashboard_snapshot',
   'v_costing_pricing_material_action_queue_snapshot',
   'v_costing_pricing_material_action_drilldown_snapshot',
   'v_costing_pricing_review_workbench_summary_snapshot',
   'v_costing_pricing_review_top_action_items_snapshot',
   'v_costing_pricing_review_action_item_drilldown_snapshot',
   'v_costing_pricing_control_integrity_audit_snapshot'
 ] loop
   select regexp_replace(pg_get_viewdef(format('public.%I',v_name)::regclass,true),';\s*$','') into v_def;
   execute format(
     'create or replace view public.%I as select v.* from (%s) v join costing.v_current_successful_costing_refresh_run r on r.period_start=v.period_start and r.valuation_date=v.valuation_date and r.refresh_run_id=v.refresh_run_id',
     v_name,v_def
   );
 end loop;
end $do$;

create or replace view public.v_costing_pricing_control_integrity_audit as
select a.check_code,a.check_status,a.observed_count,a.expected_rule,a.diagnostic_note
from costing.costing_control_integrity_audit_snapshot a
join costing.v_current_successful_costing_refresh_run r
 on r.period_start=a.period_start and r.valuation_date=a.valuation_date and r.refresh_run_id=a.refresh_run_id;

create or replace view costing.v_material_review_acceptance_register as
select r.acceptance_id,r.period_start,r.stock_item_id,r.stock_item_code,r.stock_item_name,r.material_area,
 r.action_severity,r.recommended_ui_route,r.issue_codes,r.warning_codes,r.action_required_summary,r.action_note_summary,
 r.bom_sources,r.material_line_statuses,r.affected_line_count,r.affected_product_count,r.affected_sku_count,
 r.approval_blocking_line_count,r.approval_blocking_sku_count,r.review_line_count,r.review_sku_count,
 r.acceptance_scope,r.acceptance_status,r.accepted_by,u.email as accepted_by_email,r.accepted_at,r.effective_from,r.effective_to,
 r.source_snapshot_refreshed_at,r.acceptance_reason,r.acceptance_note,r.created_at,r.updated_at,
 q.snapshot_refreshed_at as current_queue_snapshot_refreshed_at,q.action_severity as current_queue_action_severity,
 q.affected_sku_count as current_queue_affected_sku_count,
 case when q.stock_item_id is null then false else true end as current_queue_row_exists,
 case when r.acceptance_status<>'ACTIVE' then 'CLOSED'
      when q.stock_item_id is null then 'STALE_ACCEPTANCE_NO_CURRENT_QUEUE_ROW'
      when q.action_severity<>'REVIEW_REQUIRED' then 'STALE_ACCEPTANCE_NOT_REVIEW_REQUIRED'
      else 'ACTIVE_MATCHED' end as acceptance_register_status
from costing.material_review_acceptance_register r
left join auth.users u on u.id=r.accepted_by
left join costing.v_current_successful_costing_refresh_run cr on cr.period_start=r.period_start
left join costing.material_costing_action_queue_snapshot q
 on q.period_start=r.period_start and q.valuation_date=cr.valuation_date and q.refresh_run_id=cr.refresh_run_id
 and q.stock_item_id=r.stock_item_id and upper(q.material_area)=upper(r.material_area)
 and upper(q.recommended_ui_route)=upper(r.recommended_ui_route)
 and coalesce(q.issue_codes,'')=coalesce(r.issue_codes,'')
 and coalesce(q.warning_codes,'')=coalesce(r.warning_codes,'')
 and coalesce(q.action_required_summary,'')=coalesce(r.action_required_summary,'');