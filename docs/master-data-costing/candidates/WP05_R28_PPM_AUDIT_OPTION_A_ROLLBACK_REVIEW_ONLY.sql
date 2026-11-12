-- REVIEW ROLLBACK ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL.
-- Reverts ONLY the Scheme Master audit view after an approved R28 Option A rollout.
-- Exact expected candidate view fingerprint observed on isolated PostgreSQL 17.11:
-- e2b9eb3c1b86d073183cd376f704cf58. Fails on intervening view edits.
-- Restores the exact original 20-field projection and four-module helper predicate.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $guard$
DECLARE
 v_oid oid := to_regclass('public.v_costing_scheme_master_audit');
 v_def text;
BEGIN
 IF v_oid IS NULL THEN RAISE EXCEPTION 'WP05 R28 rollback: view missing'; END IF;
 v_def := pg_get_viewdef(v_oid,true);
 IF position('module:pricing-policy-manager' IN v_def)=0
   OR position('fn_costing_view_allowed' IN v_def)>0
   OR position('costing.scheme_master_audit' IN v_def)=0
   OR md5(v_def) <> 'e2b9eb3c1b86d073183cd376f704cf58'
   OR (SELECT count(*) FROM pg_attribute WHERE attrelid=v_oid AND attnum>0 AND NOT attisdropped)<>20 THEN
   RAISE EXCEPTION 'WP05 R28 rollback: unknown intervening view revision; do not overwrite';
 END IF;
END
$guard$;
CREATE OR REPLACE VIEW public.v_costing_scheme_master_audit AS
 SELECT audit_event_id,
    scheme_id,
    scheme_name,
    event_type,
    reason,
    approval_reference,
    actor_user_id,
    event_at,
    old_scheme_name,
    new_scheme_name,
    old_paid_qty,
    new_paid_qty,
    old_free_qty,
    new_free_qty,
    old_is_active,
    new_is_active,
    old_remarks,
    new_remarks,
    old_approval_reference,
    new_approval_reference
   FROM ( SELECT a.id AS audit_event_id,
            a.scheme_id,
            COALESCE(a.new_snapshot ->> 'scheme_name'::text, a.old_snapshot ->> 'scheme_name'::text) AS scheme_name,
            a.event_type,
            a.reason,
            a.approval_reference,
            a.actor_user_id,
            a.event_at,
            NULLIF(a.old_snapshot ->> 'scheme_name'::text, ''::text) AS old_scheme_name,
            NULLIF(a.new_snapshot ->> 'scheme_name'::text, ''::text) AS new_scheme_name,
            NULLIF(a.old_snapshot ->> 'paid_qty'::text, ''::text)::numeric AS old_paid_qty,
            NULLIF(a.new_snapshot ->> 'paid_qty'::text, ''::text)::numeric AS new_paid_qty,
            NULLIF(a.old_snapshot ->> 'free_qty'::text, ''::text)::numeric AS old_free_qty,
            NULLIF(a.new_snapshot ->> 'free_qty'::text, ''::text)::numeric AS new_free_qty,
            NULLIF(a.old_snapshot ->> 'is_active'::text, ''::text)::boolean AS old_is_active,
            NULLIF(a.new_snapshot ->> 'is_active'::text, ''::text)::boolean AS new_is_active,
            NULLIF(a.old_snapshot ->> 'remarks'::text, ''::text) AS old_remarks,
            NULLIF(a.new_snapshot ->> 'remarks'::text, ''::text) AS new_remarks,
            NULLIF(a.old_snapshot ->> 'approval_reference'::text, ''::text) AS old_approval_reference,
            NULLIF(a.new_snapshot ->> 'approval_reference'::text, ''::text) AS new_approval_reference
           FROM costing.scheme_master_audit a) q
  WHERE ( SELECT fn_costing_view_allowed() AS fn_costing_view_allowed);


DO $check$
BEGIN
 IF md5(pg_get_viewdef('public.v_costing_scheme_master_audit'::regclass,true))
       <> '001024540bdeab9f2e5aa4ec2a6f6c53' THEN
   RAISE EXCEPTION 'WP05 R28 rollback: original view fingerprint differs';
 END IF;
END
$check$;
COMMIT;
