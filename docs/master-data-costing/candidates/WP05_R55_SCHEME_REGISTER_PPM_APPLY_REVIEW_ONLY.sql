-- REVIEW ONLY: proposed R55 Scheme Master Register PPM View-only gate.
-- Production execution requires separate owner approval. No GRANT, role, table, or shared function changes.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='45s';
DO $guard$
DECLARE v_oid oid := to_regclass('public.v_costing_scheme_master_register');
BEGIN
 IF v_oid IS NULL OR md5(pg_get_viewdef(v_oid,true)) <> '8fdc0306bd2f1efbe0638c7c13ba4dda'
 OR (SELECT count(*) FROM pg_attribute WHERE attrelid=v_oid AND attnum>0 AND NOT attisdropped)<>34
 OR (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=v_oid)<>'postgres'
 OR (SELECT relacl::text FROM pg_class WHERE oid=v_oid)<>'{postgres=arwdDxtm/postgres,authenticated=r/postgres}'
 OR (SELECT array_to_string(reloptions,',') FROM pg_class WHERE oid=v_oid)<>'security_invoker=true'
 OR NOT has_table_privilege('authenticated',v_oid,'SELECT')
 OR has_table_privilege('anon',v_oid,'SELECT')
 THEN RAISE EXCEPTION 'R55 scheme register fingerprint/columns/owner/grant/invoker drift'; END IF;
END $guard$;
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
  WHERE ( SELECT (CURRENT_USER = ANY (ARRAY['postgres'::name, 'service_role'::name])) OR public.app_has_permission('module:pricing-policy-manager'::text, 'view'::text));
DO $check$
DECLARE v_oid oid := 'public.v_costing_scheme_master_register'::regclass;
v_def text := pg_get_viewdef(v_oid,true);
BEGIN
 IF position('module:pricing-policy-manager' in v_def)=0
 OR position('fn_costing_view_allowed' in v_def)>0
 OR position('costing.scheme_master' in v_def)=0
 OR (SELECT count(*) FROM pg_attribute WHERE attrelid=v_oid AND attnum>0 AND NOT attisdropped)<>34
 OR (SELECT relacl::text FROM pg_class WHERE oid=v_oid)<>'{postgres=arwdDxtm/postgres,authenticated=r/postgres}'
 OR (SELECT array_to_string(reloptions,',') FROM pg_class WHERE oid=v_oid)<>'security_invoker=true'
 THEN RAISE EXCEPTION 'R55 scheme register postcondition drift'; END IF;
END $check$;
COMMIT;
