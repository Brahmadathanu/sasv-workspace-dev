-- S3K REVIEW-ONLY IMPLEMENTATION — DO NOT APPLY TO PRODUCTION.
-- This source is for an ISOLATED PostgreSQL 17 fixture and independent security
-- review before producing a formal Supabase migration.
-- Implements exactly two run-87 evidence leaf tables; no full-run purge.
-- ZERO direct grants to anon/authenticated/service_role/PUBLIC.
-- Requires a dedicated NOINHERIT LOGIN sasv_retention_executor created by DBA
-- through an independently reviewed credential provisioning process.
-- FAIL CLOSED: if role does not exist, installation aborts. Never create a
-- production role/password from this file or expose direct database secrets.
--
-- No trigger disabled, no status spoofed, no TRUNCATE, no broad CASCADE.
-- Deliberately does not touch the existing designated-run guard.

BEGIN;
DO $gate$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sasv_retention_executor'
      AND rolcanlogin AND NOT rolbypassrls AND NOT rolinherit) THEN
    RAISE EXCEPTION 'S3K: separately provisioned dedicated LOGIN role required';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sasv_retention_executor' AND rolsuper) THEN
    RAISE EXCEPTION 'S3K: executor must not be superuser';
  END IF;
  IF to_regnamespace('costing_retention') IS NOT NULL THEN
    RAISE EXCEPTION 'S3K: private schema already exists; review separately, never reuse silently';
  END IF;
END $gate$;

CREATE SCHEMA costing_retention;
REVOKE ALL ON SCHEMA costing_retention FROM PUBLIC, anon, authenticated, service_role;
-- The namespace is NOT an exposed PostgREST schema.

CREATE TABLE costing_retention.sealed_batch_approval (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 refresh_run_id bigint NOT NULL REFERENCES costing.costing_refresh_run(id) ON DELETE RESTRICT,
 table_name text NOT NULL CHECK(table_name IN
   ('marketing_signed_billed_sales_evidence_snapshot','marketing_regional_sales_evidence_snapshot')),
 approved_total_rows bigint NOT NULL CHECK(approved_total_rows BETWEEN 1 AND 200000),
 archive_sha256 text NOT NULL CHECK(archive_sha256 ~ '^[0-9a-f]{64}$'),
 restore_receipt_sha256 text NOT NULL CHECK(restore_receipt_sha256 ~ '^[0-9a-f]{64}$'),
 restore_verified boolean NOT NULL DEFAULT false,
 approver text NOT NULL,
 sealed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'SEALED' CHECK(state IN ('SEALED','COMPLETE','REVOKED')),
 UNIQUE(refresh_run_id,table_name),
 CHECK(expires_at > sealed_at)
);
CREATE TABLE costing_retention.active_transaction (
 backend_pid integer NOT NULL,
 transaction_id bigint NOT NULL,
 login_name text NOT NULL,
 approval_id bigint NOT NULL REFERENCES costing_retention.sealed_batch_approval(id),
 refresh_run_id bigint NOT NULL,
 table_name text NOT NULL,
 PRIMARY KEY(backend_pid,transaction_id)
);
CREATE TABLE costing_retention.batch_receipt (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 approval_id bigint NOT NULL REFERENCES costing_retention.sealed_batch_approval(id),
 refresh_run_id bigint NOT NULL,
 table_name text NOT NULL,
 deleted_rows integer NOT NULL CHECK(deleted_rows BETWEEN 0 AND 500),
 executed_by text NOT NULL,
 transaction_id bigint NOT NULL,
 executed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON ALL TABLES IN SCHEMA costing_retention FROM PUBLIC,anon,authenticated,service_role,sasv_retention_executor;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA costing_retention FROM PUBLIC,anon,authenticated,service_role,sasv_retention_executor;

-- Called by the existing SECURITY DEFINER trigger only. No general EXECUTE.
CREATE OR REPLACE FUNCTION costing_retention.is_authorized_leaf_delete(
 p_run bigint,p_table text
) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, costing_retention
AS $fn$
SELECT
 session_user = 'sasv_retention_executor'
 AND p_table IN ('marketing_signed_billed_sales_evidence_snapshot',
                 'marketing_regional_sales_evidence_snapshot')
 AND EXISTS(
   SELECT 1 FROM costing_retention.active_transaction x
   JOIN costing_retention.sealed_batch_approval a ON a.id=x.approval_id
   WHERE x.backend_pid=pg_backend_pid()
     AND x.transaction_id=txid_current()
     AND x.login_name=session_user
     AND x.refresh_run_id=p_run
     AND x.table_name=p_table
     AND a.refresh_run_id=p_run
     AND a.table_name=p_table
     AND a.state='SEALED'
     AND a.restore_verified
     AND a.expires_at>clock_timestamp()
 )
 AND NOT EXISTS(SELECT 1 FROM costing.costing_run_designation
                WHERE refresh_run_id=p_run);
$fn$;
REVOKE ALL ON FUNCTION costing_retention.is_authorized_leaf_delete(bigint,text)
 FROM PUBLIC,anon,authenticated,service_role,sasv_retention_executor;

-- Preserve original status guard for all normal writes. A precise additional
-- DELETE-only branch is allowed only on the two explicitly selected tables.
CREATE OR REPLACE FUNCTION costing.fn_enforce_mutable_refresh_run_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, costing, costing_retention
AS $fn$
DECLARE v_run bigint; v_status text;
BEGIN
 v_run := CASE WHEN TG_OP='DELETE' THEN OLD.refresh_run_id ELSE NEW.refresh_run_id END;
 IF v_run IS NULL THEN
   RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 END IF;
 SELECT r.overall_status INTO v_status
 FROM costing.costing_refresh_run r WHERE r.id=v_run;
 IF NOT FOUND THEN RAISE EXCEPTION 'Refresh run % does not exist',v_run; END IF;

 IF v_status NOT IN ('QUEUED','RUNNING','FAILED') THEN
   IF NOT (TG_OP='DELETE'
     AND TG_TABLE_SCHEMA='costing'
     AND costing_retention.is_authorized_leaf_delete(v_run,TG_TABLE_NAME))
   THEN RAISE EXCEPTION
     'Snapshot mutation prohibited for terminal refresh run % with status %',v_run,v_status;
   END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $fn$;
-- Preserve the existing designated-run trigger WITHOUT ANY CHANGE.
REVOKE ALL ON FUNCTION costing.fn_enforce_mutable_refresh_run_snapshot()
 FROM PUBLIC,anon,authenticated,service_role,sasv_retention_executor;

-- One batch only, maximum 500 rows. Exact approved run/table pair is fixed.
-- No dynamic input table names except validated literal branches.
CREATE OR REPLACE FUNCTION costing_retention.execute_leaf_batch(p_approval_id bigint)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, costing_retention
AS $fn$
DECLARE a costing_retention.sealed_batch_approval%ROWTYPE;
 v_run costing.costing_refresh_run%ROWTYPE;
 v_displayed bigint; v_approved bigint; v_before bigint; v_deleted integer;
 v_done bigint; v_expected integer;
BEGIN
 IF session_user <> 'sasv_retention_executor' THEN
   RAISE EXCEPTION 'S3K_DENIED_LOGIN';
 END IF;
 PERFORM pg_advisory_xact_lock(92201,p_approval_id::integer);
 SELECT * INTO a FROM costing_retention.sealed_batch_approval
 WHERE id=p_approval_id FOR UPDATE;
 IF NOT FOUND OR a.state <> 'SEALED' OR NOT a.restore_verified
    OR clock_timestamp() >= a.expires_at THEN
   RAISE EXCEPTION 'S3K_DENIED_APPROVAL';
 END IF;
 IF a.refresh_run_id <> 87 OR a.table_name NOT IN
   ('marketing_signed_billed_sales_evidence_snapshot',
    'marketing_regional_sales_evidence_snapshot') THEN
   RAISE EXCEPTION 'S3K_DENIED_SCOPE';
 END IF;
 SELECT * INTO v_run FROM costing.costing_refresh_run
 WHERE id=a.refresh_run_id FOR UPDATE;
 IF NOT FOUND OR v_run.period_start<>DATE '2026-09-01'
    OR v_run.overall_status<>'SUCCESS' THEN
   RAISE EXCEPTION 'S3K_DENIED_RUN';
 END IF;
 SELECT displayed_run_id,approved_run_id INTO v_displayed,v_approved
 FROM costing.v_costing_period_run_status WHERE period_start=v_run.period_start;
 IF v_displayed IS NULL OR v_displayed=a.refresh_run_id
    OR v_approved=a.refresh_run_id THEN RAISE EXCEPTION 'S3K_DENIED_POINTER'; END IF;
 IF EXISTS(SELECT 1 FROM costing.costing_run_designation WHERE refresh_run_id=a.refresh_run_id)
    OR EXISTS(SELECT 1 FROM costing.material_review_acceptance_register WHERE source_refresh_run_id=a.refresh_run_id)
    OR EXISTS(SELECT 1 FROM costing.regional_marketing_evidence_acceptance WHERE source_refresh_run_id=a.refresh_run_id)
    OR EXISTS(SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance WHERE source_refresh_run_id=a.refresh_run_id)
    OR EXISTS(SELECT 1 FROM costing.cost_driver_policy_cutover_acceptance WHERE accepted_refresh_run_id=a.refresh_run_id)
    OR EXISTS(SELECT 1 FROM costing.manufacturing_cost_behaviour_split WHERE reference_refresh_run_id=a.refresh_run_id)
    OR EXISTS(SELECT 1 FROM costing.costing_period_refresh_authorization WHERE consumed_by_run_id=a.refresh_run_id)
 THEN RAISE EXCEPTION 'S3K_DENIED_GOVERNANCE_LINK'; END IF;

 IF a.table_name='marketing_signed_billed_sales_evidence_snapshot' THEN
  SELECT count(*) INTO v_before FROM costing.marketing_signed_billed_sales_evidence_snapshot
     WHERE refresh_run_id=a.refresh_run_id;
 ELSE
  SELECT count(*) INTO v_before FROM costing.marketing_regional_sales_evidence_snapshot
     WHERE refresh_run_id=a.refresh_run_id;
 END IF;
 SELECT coalesce(sum(deleted_rows),0) INTO v_done FROM costing_retention.batch_receipt
 WHERE approval_id=a.id;
 IF v_before+v_done<>a.approved_total_rows THEN
   RAISE EXCEPTION 'S3K_DENIED_ROW_COUNT_DRIFT';
 END IF;
 v_expected:=least(v_before,500);
 IF v_expected=0 THEN
   UPDATE costing_retention.sealed_batch_approval SET state='COMPLETE'
   WHERE id=a.id;
   RETURN 0;
 END IF;
 -- Single-transaction authorization context. Role cannot directly insert it.
 INSERT INTO costing_retention.active_transaction
 (backend_pid,transaction_id,login_name,approval_id,refresh_run_id,table_name)
 VALUES(pg_backend_pid(),txid_current(),session_user,a.id,a.refresh_run_id,a.table_name);

 IF a.table_name='marketing_signed_billed_sales_evidence_snapshot' THEN
  WITH ids AS (SELECT id FROM costing.marketing_signed_billed_sales_evidence_snapshot
    WHERE refresh_run_id=a.refresh_run_id ORDER BY id LIMIT 500 FOR UPDATE),
  del AS (DELETE FROM costing.marketing_signed_billed_sales_evidence_snapshot t
    USING ids WHERE t.id=ids.id AND t.refresh_run_id=a.refresh_run_id RETURNING t.id)
  SELECT count(*) INTO v_deleted FROM del;
 ELSE
  WITH ids AS (SELECT id FROM costing.marketing_regional_sales_evidence_snapshot
    WHERE refresh_run_id=a.refresh_run_id ORDER BY id LIMIT 500 FOR UPDATE),
  del AS (DELETE FROM costing.marketing_regional_sales_evidence_snapshot t
    USING ids WHERE t.id=ids.id AND t.refresh_run_id=a.refresh_run_id RETURNING t.id)
  SELECT count(*) INTO v_deleted FROM del;
 END IF;
 IF v_deleted<>v_expected THEN RAISE EXCEPTION 'S3K_DENIED_DELETE_COUNT_DRIFT'; END IF;
 DELETE FROM costing_retention.active_transaction
 WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current();
 INSERT INTO costing_retention.batch_receipt
 (approval_id,refresh_run_id,table_name,deleted_rows,executed_by,transaction_id)
 VALUES (a.id,a.refresh_run_id,a.table_name,v_deleted,session_user,txid_current());
 IF v_done+v_deleted=a.approved_total_rows THEN
  UPDATE costing_retention.sealed_batch_approval SET state='COMPLETE'
  WHERE id=a.id;
 END IF;
 RETURN v_deleted;
END $fn$;
REVOKE ALL ON FUNCTION costing_retention.execute_leaf_batch(bigint)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA costing_retention TO sasv_retention_executor;
GRANT EXECUTE ON FUNCTION costing_retention.execute_leaf_batch(bigint)
 TO sasv_retention_executor;
-- Block direct caller function access and private data modification.
COMMIT;

-- REQUIRED BEFORE PILOT (not automated by this script):
-- 1. DBA independently seals two exact, restored archive approvals; never
--    mark restore_verified based on user-submitted text alone.
-- 2. Verify baseline function definition before replacing it, plus roles,
--    schema privileges and default privileges on staging.
-- 3. Confirm triggers keep same designated-run guard intact.
-- 4. Verify negative role, forged GUC, expired approval, designated runs,
--    changed counts, cross-run refs, force-retry and abort cases.
-- 5. A mere archive hash in sealed approval is not enough if not independently
--    verified against a durable off-database artifact.
-- 6. This first scaffold is not a complete full-run purge; staged backup and
--    restore of the actual rows and all consumer parity remain mandatory.
