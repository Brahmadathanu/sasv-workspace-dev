-- Recovery only. Do not apply as a forward migration.
-- Restores the pre-change (TB2) definition of public.v_costing_scheme_master_register, byte for byte the text of
--   supabase/migrations/20261019134900_tb2_costing_view_permission_gate.sql. Run only if 20261108132312_costing_scheme_master_register_viability_lateral.sql was applied and the view
--   then measures worse or behaves differently. CREATE OR REPLACE VIEW with identical columns keeps ACL, reloptions and dependants.
-- After running, md5(pg_get_viewdef('public.v_costing_scheme_master_register'::regclass, true)) must again equal a9f6a128427a704e9bea97fc01e7b5f3.
-- This file is deliberately single-statement (atomic under any runner).
create or replace view public.v_costing_scheme_master_register with (security_invoker=true) as
select q.* from (
SELECT id AS scheme_id,
    scheme_name,
    paid_qty,
    free_qty,
    (paid_qty + free_qty) AS total_qty,
        CASE
            WHEN (paid_qty > (0)::numeric) THEN (free_qty / paid_qty)
            ELSE NULL::numeric
        END AS free_per_paid_ratio,
        CASE
            WHEN ((paid_qty + free_qty) > (0)::numeric) THEN ((free_qty / (paid_qty + free_qty)) * (100)::numeric)
            ELSE NULL::numeric
        END AS effective_free_discount_percent,
    is_active,
    is_system_defined,
    remarks,
    approval_reference,
    ( SELECT count(*) AS count
           FROM costing.sku_scheme_policy p
          WHERE (p.scheme_id = sm.id)) AS direct_policy_count,
    ( SELECT count(*) AS count
           FROM costing.sku_scheme_policy p
          WHERE ((p.scheme_id = sm.id) AND (p.is_active = true))) AS active_direct_policy_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE (r.scheme_id = sm.id)) AS hierarchy_rule_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE ((r.scheme_id = sm.id) AND (r.is_active = true))) AS active_hierarchy_rule_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE (r.replace_from_scheme_id = sm.id)) AS replacement_reference_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE ((r.replace_from_scheme_id = sm.id) AND (r.is_active = true))) AS active_replacement_reference_count,
    ( SELECT count(*) AS count
           FROM costing.sku_scheme_viability_snapshot s
          WHERE (s.scheme_id = sm.id)) AS viability_snapshot_count,
    ( SELECT count(DISTINCT s.period_start) AS count
           FROM costing.sku_scheme_viability_snapshot s
          WHERE (s.scheme_id = sm.id)) AS viability_snapshot_period_count,
    ( SELECT max(s.period_start) AS max
           FROM costing.sku_scheme_viability_snapshot s
          WHERE (s.scheme_id = sm.id)) AS latest_viability_snapshot_period,
    (NOT is_system_defined) AS can_edit_metadata,
    (is_active AND (NOT is_system_defined) AND (NOT (EXISTS ( SELECT 1
           FROM costing.sku_scheme_policy p
          WHERE ((p.scheme_id = sm.id) AND (p.is_active = true))))) AND (NOT (EXISTS ( SELECT 1
           FROM costing.scheme_policy_rules r
          WHERE ((r.scheme_id = sm.id) AND (r.is_active = true))))) AND (NOT (EXISTS ( SELECT 1
           FROM costing.scheme_policy_rules r
          WHERE ((r.replace_from_scheme_id = sm.id) AND (r.is_active = true)))))) AS can_deactivate,
    ((NOT is_active) AND (NOT is_system_defined)) AS can_reactivate,
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
   FROM costing.scheme_master sm
) q
where (select public.fn_costing_view_allowed());
