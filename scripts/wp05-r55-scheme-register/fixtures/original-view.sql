CREATE OR REPLACE VIEW public.v_costing_scheme_master_register WITH (security_invoker=true) AS
 SELECT scheme_id,
    scheme_name,
    paid_qty,
    free_qty,
    total_qty,
    free_per_paid_ratio,
    effective_free_discount_percent,
    is_active,
    is_system_defined,
    remarks,
    approval_reference,
    direct_policy_count,
    active_direct_policy_count,
    hierarchy_rule_count,
    active_hierarchy_rule_count,
    replacement_reference_count,
    active_replacement_reference_count,
    viability_snapshot_count,
    viability_snapshot_period_count,
    latest_viability_snapshot_period,
    can_edit_metadata,
    can_deactivate,
    can_reactivate,
    created_at,
    created_by,
    updated_at,
    updated_by,
    metadata_update_reason,
    deactivated_at,
    deactivated_by,
    deactivation_reason,
    reactivated_at,
    reactivated_by,
    reactivation_reason
   FROM ( SELECT sm.id AS scheme_id,
            sm.scheme_name,
            sm.paid_qty,
            sm.free_qty,
            sm.paid_qty + sm.free_qty AS total_qty,
                CASE
                    WHEN sm.paid_qty > 0::numeric THEN sm.free_qty / sm.paid_qty
                    ELSE NULL::numeric
                END AS free_per_paid_ratio,
                CASE
                    WHEN (sm.paid_qty + sm.free_qty) > 0::numeric THEN sm.free_qty / (sm.paid_qty + sm.free_qty) * 100::numeric
                    ELSE NULL::numeric
                END AS effective_free_discount_percent,
            sm.is_active,
            sm.is_system_defined,
            sm.remarks,
            sm.approval_reference,
            ( SELECT count(*) AS count
                   FROM costing.sku_scheme_policy p
                  WHERE p.scheme_id = sm.id) AS direct_policy_count,
            ( SELECT count(*) AS count
                   FROM costing.sku_scheme_policy p
                  WHERE p.scheme_id = sm.id AND p.is_active = true) AS active_direct_policy_count,
            ( SELECT count(*) AS count
                   FROM costing.scheme_policy_rules r
                  WHERE r.scheme_id = sm.id) AS hierarchy_rule_count,
            ( SELECT count(*) AS count
                   FROM costing.scheme_policy_rules r
                  WHERE r.scheme_id = sm.id AND r.is_active = true) AS active_hierarchy_rule_count,
            ( SELECT count(*) AS count
                   FROM costing.scheme_policy_rules r
                  WHERE r.replace_from_scheme_id = sm.id) AS replacement_reference_count,
            ( SELECT count(*) AS count
                   FROM costing.scheme_policy_rules r
                  WHERE r.replace_from_scheme_id = sm.id AND r.is_active = true) AS active_replacement_reference_count,
            viab.vs_snapshot_count AS viability_snapshot_count,
            viab.vs_period_count AS viability_snapshot_period_count,
            viab.vs_latest_period AS latest_viability_snapshot_period,
            NOT sm.is_system_defined AS can_edit_metadata,
            sm.is_active AND NOT sm.is_system_defined AND NOT (EXISTS ( SELECT 1
                   FROM costing.sku_scheme_policy p
                  WHERE p.scheme_id = sm.id AND p.is_active = true)) AND NOT (EXISTS ( SELECT 1
                   FROM costing.scheme_policy_rules r
                  WHERE r.scheme_id = sm.id AND r.is_active = true)) AND NOT (EXISTS ( SELECT 1
                   FROM costing.scheme_policy_rules r
                  WHERE r.replace_from_scheme_id = sm.id AND r.is_active = true)) AS can_deactivate,
            NOT sm.is_active AND NOT sm.is_system_defined AS can_reactivate,
            sm.created_at,
            sm.created_by,
            sm.updated_at,
            sm.updated_by,
            sm.metadata_update_reason,
            sm.deactivated_at,
            sm.deactivated_by,
            sm.deactivation_reason,
            sm.reactivated_at,
            sm.reactivated_by,
            sm.reactivation_reason
           FROM costing.scheme_master sm
             LEFT JOIN LATERAL ( SELECT count(*) AS vs_snapshot_count,
                    count(DISTINCT s.period_start) AS vs_period_count,
                    max(s.period_start) AS vs_latest_period
                   FROM costing.sku_scheme_viability_snapshot s
                  WHERE s.scheme_id = sm.id) viab ON true) q
  WHERE ( SELECT fn_costing_view_allowed() AS fn_costing_view_allowed);
GRANT SELECT ON public.v_costing_scheme_master_register TO authenticated;
