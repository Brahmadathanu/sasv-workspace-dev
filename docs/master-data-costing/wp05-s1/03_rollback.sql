-- WP05 S1 rollback — restores the exact pre-S1 definition captured live 2026-10-13.
-- ACL before S1: {postgres=arwdDxtm/postgres,anon=m/postgres,authenticated=rm/postgres,service_role=arwdDxtm/postgres}; owner postgres; no reloptions; no comment.
BEGIN;
CREATE OR REPLACE VIEW public.v_costing_pricing_business_kpi_summary AS
 WITH dashboard AS (
         SELECT v_costing_pricing_dashboard_summary.period_start,
            v_costing_pricing_dashboard_summary.pricing_bridge_sku_count,
            v_costing_pricing_dashboard_summary.pricing_bridge_blocked_count,
            v_costing_pricing_dashboard_summary.pricing_bridge_review_required_count,
            v_costing_pricing_dashboard_summary.pricing_bridge_ready_count,
            v_costing_pricing_dashboard_summary.selling_price_sku_count,
            v_costing_pricing_dashboard_summary.selling_price_blocked_count,
            v_costing_pricing_dashboard_summary.selling_price_review_required_count,
            v_costing_pricing_dashboard_summary.selling_price_ready_count,
            v_costing_pricing_dashboard_summary.scheme_viability_row_count,
            v_costing_pricing_dashboard_summary.scheme_blocked_count,
            v_costing_pricing_dashboard_summary.scheme_review_required_count,
            v_costing_pricing_dashboard_summary.scheme_ready_count,
            v_costing_pricing_dashboard_summary.latest_refresh_started_at,
            v_costing_pricing_dashboard_summary.latest_refresh_finished_at,
            v_costing_pricing_dashboard_summary.latest_refresh_status,
            v_costing_pricing_dashboard_summary.latest_refresh_scope,
            v_costing_pricing_dashboard_summary.latest_refresh_error
           FROM v_costing_pricing_dashboard_summary
        ), workbench AS (
         SELECT v_costing_pricing_review_workbench_summary_snapshot.period_start,
            (COALESCE(sum(v_costing_pricing_review_workbench_summary_snapshot.affected_stock_item_count) FILTER (WHERE (v_costing_pricing_review_workbench_summary_snapshot.material_line_status = 'BLOCKED'::text)), (0)::numeric))::bigint AS workbench_blocked_item_count,
            (COALESCE(sum(v_costing_pricing_review_workbench_summary_snapshot.affected_stock_item_count) FILTER (WHERE (v_costing_pricing_review_workbench_summary_snapshot.material_line_status = 'REVIEW_REQUIRED'::text)), (0)::numeric))::bigint AS workbench_review_item_count,
            (COALESCE(sum(v_costing_pricing_review_workbench_summary_snapshot.issue_line_count), (0)::numeric))::bigint AS workbench_issue_line_count
           FROM v_costing_pricing_review_workbench_summary_snapshot
          GROUP BY v_costing_pricing_review_workbench_summary_snapshot.period_start
        ), policy AS (
         SELECT count(*) AS policy_sku_count,
            count(*) FILTER (WHERE (v_costing_policy_manager_sku_overview.selling_price_policy_id IS NOT NULL)) AS selling_policy_complete_count,
            count(*) FILTER (WHERE (v_costing_policy_manager_sku_overview.selling_price_policy_id IS NULL)) AS selling_policy_missing_count,
            count(*) FILTER (WHERE ((v_costing_policy_manager_sku_overview.ik_selected_scheme_id IS NOT NULL) AND (v_costing_policy_manager_sku_overview.ok_selected_scheme_id IS NOT NULL))) AS scheme_policy_complete_count,
            count(*) FILTER (WHERE ((v_costing_policy_manager_sku_overview.ik_selected_scheme_id IS NULL) OR (v_costing_policy_manager_sku_overview.ok_selected_scheme_id IS NULL))) AS scheme_policy_missing_count
           FROM v_costing_policy_manager_sku_overview
        )
 SELECT d.period_start,
    d.pricing_bridge_sku_count AS total_pricing_sku_count,
    GREATEST(((d.pricing_bridge_sku_count - d.pricing_bridge_blocked_count) - d.pricing_bridge_review_required_count), (0)::bigint) AS costing_ready_sku_count,
    d.pricing_bridge_blocked_count AS costing_blocked_sku_count,
    d.pricing_bridge_review_required_count AS costing_review_sku_count,
    d.selling_price_sku_count AS selling_price_row_count,
    COALESCE(p.selling_policy_complete_count, (0)::bigint) AS selling_policy_complete_count,
    COALESCE(p.selling_policy_missing_count, (0)::bigint) AS selling_policy_missing_count,
    d.scheme_viability_row_count AS scheme_calculation_row_count,
    d.scheme_blocked_count AS scheme_blocked_row_count,
    d.scheme_review_required_count AS scheme_review_row_count,
    COALESCE(w.workbench_blocked_item_count, (0)::bigint) AS workbench_blocked_item_count,
    COALESCE(w.workbench_review_item_count, (0)::bigint) AS workbench_review_item_count,
    COALESCE(w.workbench_issue_line_count, (0)::bigint) AS workbench_issue_line_count,
    COALESCE(p.scheme_policy_complete_count, (0)::bigint) AS scheme_policy_complete_count,
    COALESCE(p.scheme_policy_missing_count, (0)::bigint) AS scheme_policy_missing_count,
    d.latest_refresh_status,
    d.latest_refresh_scope,
    d.latest_refresh_finished_at
   FROM ((dashboard d
     LEFT JOIN workbench w ON ((w.period_start = d.period_start)))
     CROSS JOIN policy p);
COMMIT;
