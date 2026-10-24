-- backfilled from live schema_migrations on 2026-10-24, CI-016
CREATE OR REPLACE VIEW public.v_costing_pricing_business_kpi_summary AS
WITH cur AS (
         -- Current successful run per period, gated exactly like the retired
         -- public.v_costing_pricing_dashboard_summary.
         SELECT r.period_start, r.valuation_date, r.refresh_run_id
           FROM costing.v_current_successful_costing_refresh_run r
          WHERE ((CURRENT_USER = ANY (ARRAY['service_role'::name, 'postgres'::name])) OR public.app_has_permission('module:costing-control-center'::text, 'view'::text))
        ), frozen_tuples AS (
         SELECT s.period_start, s.valuation_date, s.refresh_run_id FROM costing.sku_pricing_bridge_snapshot s
           JOIN cur c ON c.period_start = s.period_start AND c.valuation_date = s.valuation_date AND c.refresh_run_id = s.refresh_run_id
        UNION
         SELECT s.period_start, s.valuation_date, s.refresh_run_id FROM costing.sku_selling_price_bridge_snapshot s
           JOIN cur c ON c.period_start = s.period_start AND c.valuation_date = s.valuation_date AND c.refresh_run_id = s.refresh_run_id
        UNION
         SELECT s.period_start, s.valuation_date, s.refresh_run_id FROM costing.sku_scheme_viability_snapshot s
           JOIN cur c ON c.period_start = s.period_start AND c.valuation_date = s.valuation_date AND c.refresh_run_id = s.refresh_run_id
        ), period_contexts AS (
         SELECT cp.period_start, ft.valuation_date, ft.refresh_run_id
           FROM costing.cost_periods cp
           JOIN frozen_tuples ft ON ft.period_start = cp.period_start
        ), pricing_summary AS (
         SELECT s.period_start, s.valuation_date, s.refresh_run_id,
            count(*) AS total_skus,
            count(*) FILTER (WHERE s.pricing_bridge_status = 'BLOCKED'::text) AS blocked_count,
            count(*) FILTER (WHERE s.pricing_bridge_status = 'REVIEW_REQUIRED'::text) AS review_required_count
           FROM costing.sku_pricing_bridge_snapshot s
           JOIN cur c ON c.period_start = s.period_start AND c.valuation_date = s.valuation_date AND c.refresh_run_id = s.refresh_run_id
          GROUP BY s.period_start, s.valuation_date, s.refresh_run_id
        ), selling_summary AS (
         SELECT s.period_start, s.valuation_date, s.refresh_run_id,
            count(*) AS selling_price_sku_count
           FROM costing.sku_selling_price_bridge_snapshot s
           JOIN cur c ON c.period_start = s.period_start AND c.valuation_date = s.valuation_date AND c.refresh_run_id = s.refresh_run_id
          GROUP BY s.period_start, s.valuation_date, s.refresh_run_id
        ), scheme_summary AS (
         SELECT s.period_start, s.valuation_date, s.refresh_run_id,
            count(*) AS scheme_row_count,
            count(*) FILTER (WHERE s.scheme_viability_status = 'BLOCKED'::text) AS scheme_blocked_count,
            count(*) FILTER (WHERE s.scheme_viability_status = 'REVIEW_REQUIRED'::text) AS scheme_review_required_count
           FROM costing.sku_scheme_viability_snapshot s
           JOIN cur c ON c.period_start = s.period_start AND c.valuation_date = s.valuation_date AND c.refresh_run_id = s.refresh_run_id
          GROUP BY s.period_start, s.valuation_date, s.refresh_run_id
        ), dashboard AS (
         SELECT pc.period_start,
            COALESCE(pb.total_skus, 0::bigint) AS pricing_bridge_sku_count,
            COALESCE(pb.blocked_count, 0::bigint) AS pricing_bridge_blocked_count,
            COALESCE(pb.review_required_count, 0::bigint) AS pricing_bridge_review_required_count,
            COALESCE(sp.selling_price_sku_count, 0::bigint) AS selling_price_sku_count,
            COALESCE(sv.scheme_row_count, 0::bigint) AS scheme_viability_row_count,
            COALESCE(sv.scheme_blocked_count, 0::bigint) AS scheme_blocked_count,
            COALESCE(sv.scheme_review_required_count, 0::bigint) AS scheme_review_required_count,
            r.finished_at AS latest_refresh_finished_at,
            r.overall_status AS latest_refresh_status,
            r.requested_scope AS latest_refresh_scope
           FROM period_contexts pc
             LEFT JOIN pricing_summary pb ON pb.period_start = pc.period_start AND pb.valuation_date = pc.valuation_date AND pb.refresh_run_id = pc.refresh_run_id
             LEFT JOIN selling_summary sp ON sp.period_start = pc.period_start AND sp.valuation_date = pc.valuation_date AND sp.refresh_run_id = pc.refresh_run_id
             LEFT JOIN scheme_summary sv ON sv.period_start = pc.period_start AND sv.valuation_date = pc.valuation_date AND sv.refresh_run_id = pc.refresh_run_id
             LEFT JOIN costing.costing_refresh_run r ON r.id = pc.refresh_run_id AND r.period_start = pc.period_start AND r.valuation_date = pc.valuation_date
        ), workbench AS (
         SELECT v_costing_pricing_review_workbench_summary_snapshot.period_start,
            (COALESCE(sum(v_costing_pricing_review_workbench_summary_snapshot.affected_stock_item_count) FILTER (WHERE (v_costing_pricing_review_workbench_summary_snapshot.material_line_status = 'BLOCKED'::text)), (0)::numeric))::bigint AS workbench_blocked_item_count,
            (COALESCE(sum(v_costing_pricing_review_workbench_summary_snapshot.affected_stock_item_count) FILTER (WHERE (v_costing_pricing_review_workbench_summary_snapshot.material_line_status = 'REVIEW_REQUIRED'::text)), (0)::numeric))::bigint AS workbench_review_item_count,
            (COALESCE(sum(v_costing_pricing_review_workbench_summary_snapshot.issue_line_count), (0)::numeric))::bigint AS workbench_issue_line_count
           FROM public.v_costing_pricing_review_workbench_summary_snapshot
          GROUP BY v_costing_pricing_review_workbench_summary_snapshot.period_start
        ), policy AS (
         SELECT count(*) AS policy_sku_count,
            count(*) FILTER (WHERE (v_costing_policy_manager_sku_overview.selling_price_policy_id IS NOT NULL)) AS selling_policy_complete_count,
            count(*) FILTER (WHERE (v_costing_policy_manager_sku_overview.selling_price_policy_id IS NULL)) AS selling_policy_missing_count,
            count(*) FILTER (WHERE ((v_costing_policy_manager_sku_overview.ik_selected_scheme_id IS NOT NULL) AND (v_costing_policy_manager_sku_overview.ok_selected_scheme_id IS NOT NULL))) AS scheme_policy_complete_count,
            count(*) FILTER (WHERE ((v_costing_policy_manager_sku_overview.ik_selected_scheme_id IS NULL) OR (v_costing_policy_manager_sku_overview.ok_selected_scheme_id IS NULL))) AS scheme_policy_missing_count
           FROM public.v_costing_policy_manager_sku_overview
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
