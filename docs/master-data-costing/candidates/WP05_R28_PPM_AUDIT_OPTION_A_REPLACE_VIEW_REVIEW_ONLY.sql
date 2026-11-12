-- REVIEW CANDIDATE ONLY. DO NOT APPLY TO PRODUCTION WITHOUT SEPARATE OWNER EXECUTION APPROVAL.
-- WP05 R28 Option A: PPM View -> Scheme Master audit history. No other costing-view shortcut.
-- Original live view pg_get_viewdef md5: 001024540bdeab9f2e5aa4ec2a6f6c53 (12 Nov 2026).
-- This intentionally lives in docs/, NOT supabase/migrations/.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $guard$
DECLARE
  v_oid oid := to_regclass('public.v_costing_scheme_master_audit');
  v_cols int;
  v_hash text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'WP05 R28 precondition: Scheme audit view missing';
  END IF;
  SELECT md5(pg_get_viewdef(v_oid, true)),
         (SELECT count(*)::int FROM pg_attribute WHERE attrelid=v_oid AND attnum>0 AND NOT attisdropped)
    INTO v_hash, v_cols;
  IF v_hash IS DISTINCT FROM '001024540bdeab9f2e5aa4ec2a6f6c53' OR v_cols <> 20 THEN
    RAISE EXCEPTION 'WP05 R28 precondition: view definition or 20-column contract drift';
  END IF;
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=v_oid) <> 'postgres' THEN
    RAISE EXCEPTION 'WP05 R28 precondition: view owner drift';
  END IF;
  IF NOT has_table_privilege('authenticated',v_oid,'SELECT')
     OR has_table_privilege('anon',v_oid,'SELECT')
     OR has_table_privilege('service_role',v_oid,'SELECT') THEN
    RAISE EXCEPTION 'WP05 R28 precondition: public view SQL ACL drift';
  END IF;
END
$guard$;

-- Retain the original 20 columns in their existing order/types, view owner and ACL.
-- Only change the final outer policy gate. No new helper, no GRANT, no base-table change.
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
  WHERE (
    SELECT current_user = ANY(ARRAY['postgres','service_role']::name[])
           OR public.app_has_permission('module:pricing-policy-manager','view')
  );

-- Future actual-execution verification is catalogue-only unless owner separately
-- approves a genuine authenticated no-row-export role test.
DO $check$
DECLARE
  v_oid oid := 'public.v_costing_scheme_master_audit'::regclass;
  v_def text := pg_get_viewdef(v_oid,true);
BEGIN
  IF position('app_has_permission(' IN v_def)=0
     OR position('module:pricing-policy-manager' IN v_def)=0
     OR position('fn_costing_view_allowed' IN v_def)>0
     OR position('costing.scheme_master_audit' IN v_def)=0 THEN
    RAISE EXCEPTION 'WP05 R28 postcondition: wrong Scheme audit source or reader predicate';
  END IF;
  IF has_table_privilege('service_role',v_oid,'SELECT') THEN
    RAISE EXCEPTION 'WP05 R28 postcondition: service_role unexpectedly gained view SELECT';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid=v_oid AND attnum>0 AND NOT attisdropped)<>20 THEN
    RAISE EXCEPTION 'WP05 R28 postcondition: changed audit column count';
  END IF;
END
$check$;
COMMIT;
