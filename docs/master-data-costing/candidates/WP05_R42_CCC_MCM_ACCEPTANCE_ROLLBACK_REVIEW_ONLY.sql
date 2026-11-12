-- REVIEW ONLY. Exact candidate fingerprint pinned from isolated PostgreSQL 17; still requires separate owner operational approval.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='45s';
DO $guard$
DECLARE v_oid oid := to_regclass('public.v_costing_material_review_acceptance_register');
BEGIN
 IF v_oid IS NULL
 OR md5(pg_get_viewdef(v_oid,true)) <> '0dcc3db262a30a9b770720dcb48e6376'
 OR (SELECT count(*) FROM pg_attribute WHERE attrelid=v_oid AND attnum>0 AND NOT attisdropped)<>38
 OR (SELECT relacl::text FROM pg_class WHERE oid=v_oid)<>'{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}'
 OR (SELECT reloptions FROM pg_class WHERE oid=v_oid) IS NOT NULL
 OR (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=v_oid)<>'postgres'
 THEN RAISE EXCEPTION 'WP05 R42 rollback: unknown intervening change; refusing overwrite'; END IF;
END $guard$;
CREATE OR REPLACE VIEW public.v_costing_material_review_acceptance_register AS
 SELECT acceptance_id,
    period_start,
    stock_item_id,
    stock_item_code,
    stock_item_name,
    material_area,
    action_severity,
    recommended_ui_route,
    issue_codes,
    warning_codes,
    action_required_summary,
    action_note_summary,
    bom_sources,
    material_line_statuses,
    affected_line_count,
    affected_product_count,
    affected_sku_count,
    approval_blocking_line_count,
    approval_blocking_sku_count,
    review_line_count,
    review_sku_count,
    acceptance_scope,
    acceptance_status,
    accepted_by,
    accepted_by_email,
    accepted_at,
    effective_from,
    effective_to,
    source_snapshot_refreshed_at,
    acceptance_reason,
    acceptance_note,
    created_at,
    updated_at,
    current_queue_snapshot_refreshed_at,
    current_queue_action_severity,
    current_queue_affected_sku_count,
    current_queue_row_exists,
    acceptance_register_status
   FROM ( SELECT v_material_review_acceptance_register.acceptance_id,
            v_material_review_acceptance_register.period_start,
            v_material_review_acceptance_register.stock_item_id,
            v_material_review_acceptance_register.stock_item_code,
            v_material_review_acceptance_register.stock_item_name,
            v_material_review_acceptance_register.material_area,
            v_material_review_acceptance_register.action_severity,
            v_material_review_acceptance_register.recommended_ui_route,
            v_material_review_acceptance_register.issue_codes,
            v_material_review_acceptance_register.warning_codes,
            v_material_review_acceptance_register.action_required_summary,
            v_material_review_acceptance_register.action_note_summary,
            v_material_review_acceptance_register.bom_sources,
            v_material_review_acceptance_register.material_line_statuses,
            v_material_review_acceptance_register.affected_line_count,
            v_material_review_acceptance_register.affected_product_count,
            v_material_review_acceptance_register.affected_sku_count,
            v_material_review_acceptance_register.approval_blocking_line_count,
            v_material_review_acceptance_register.approval_blocking_sku_count,
            v_material_review_acceptance_register.review_line_count,
            v_material_review_acceptance_register.review_sku_count,
            v_material_review_acceptance_register.acceptance_scope,
            v_material_review_acceptance_register.acceptance_status,
            v_material_review_acceptance_register.accepted_by,
            v_material_review_acceptance_register.accepted_by_email,
            v_material_review_acceptance_register.accepted_at,
            v_material_review_acceptance_register.effective_from,
            v_material_review_acceptance_register.effective_to,
            v_material_review_acceptance_register.source_snapshot_refreshed_at,
            v_material_review_acceptance_register.acceptance_reason,
            v_material_review_acceptance_register.acceptance_note,
            v_material_review_acceptance_register.created_at,
            v_material_review_acceptance_register.updated_at,
            v_material_review_acceptance_register.current_queue_snapshot_refreshed_at,
            v_material_review_acceptance_register.current_queue_action_severity,
            v_material_review_acceptance_register.current_queue_affected_sku_count,
            v_material_review_acceptance_register.current_queue_row_exists,
            v_material_review_acceptance_register.acceptance_register_status
           FROM costing.v_material_review_acceptance_register) q
  WHERE ( SELECT fn_costing_view_allowed() AS fn_costing_view_allowed);

DO $check$
BEGIN
 IF md5(pg_get_viewdef('public.v_costing_material_review_acceptance_register'::regclass,true))<>'df6c6771423c2aecb0130822a804a239'
 THEN RAISE EXCEPTION 'WP05 R42 rollback: did not restore original exact view'; END IF;
END $check$;
COMMIT;
