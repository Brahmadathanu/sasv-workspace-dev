-- S3E — STAGING ONLY, ROLLBACK-ONLY DELETION REHEARSAL
-- NOT FOR THE SASV PRODUCTION PROJECT qhmoqtxpeasamtlxaoak.
-- Not a production purge function, not a cron job, not an archive/restore proof.
--
-- Use only on a separately authorised isolated staging database populated
-- with an exact fixture for historical run 87, AFTER a separately verified
-- external backup and restore rehearsal have succeeded.
--
-- Purpose: exercise DELETE on only two FK-leaf, large, repeated evidence tables
-- belonging to the historical unapproved run 87. Both have NO incoming FK
-- references in production metadata at the 2026-11-22 inspection.
-- No run headers, accepted governance rows or product/pricing tables touched.
--
-- Safety features:
--  * explicit opt-in ONLY; isolation must be verified OUTSIDE SQL by operator
--  * one known run id (87), 2026-09-01 period and unchanged designation guards
--  * fail closed if expected row counts differ
--  * all changes inside ONE transaction, explicit ROLLBACK at bottom
--  * no writes survive a normal successful completion
--  * if your SQL client stops on a raised error, explicitly issue ROLLBACK.
--
-- NOTE: SQL cannot attest that a cloned database is isolated. Validate the
-- project ref in your SQL connection UI OUTSIDE this script before executing.
--
-- To opt in on an isolated stage DB, run this *single session* script with
-- the following staging guard inside the transaction. Do not set it in prod.

-- S3E BLOCKER DISCOVERED 23 NOV 2026:
-- fn_enforce_mutable_refresh_run_snapshot() explicitly prohibits DELETE for
-- SUCCESS runs, including test run 87. The following deletion rehearsal is
-- DISABLED unless an independently reviewed, deployed governance-safe
-- maintenance pathway is introduced on isolated staging. Never disable,
-- bypass or change the trigger merely to make this script pass.
-- Current function permits mutation only QUEUED, RUNNING, FAILED. No live
-- deletion was attempted.

BEGIN;
-- Fail closed on the known, currently installed terminal-run mutation guard.
DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON p.oid=t.tgfoid
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE t.tgrelid IN (
      'costing.marketing_signed_billed_sales_evidence_snapshot'::regclass,
      'costing.marketing_regional_sales_evidence_snapshot'::regclass
    )
    AND t.tgenabled <> 'D' AND n.nspname='costing'
    AND p.proname='fn_enforce_mutable_refresh_run_snapshot'
  ) THEN
    RAISE EXCEPTION 'S3E_BLOCKED_TERMINAL_RUN_GUARD: SUCCESS run 87 cannot be deleted under existing snapshot writer policy';
  END IF;
END
$preflight$;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
SET LOCAL idle_in_transaction_session_timeout = '12min';
SET LOCAL sasv.retention_staging_rehearsal = 'EXPLICIT_STAGE_RUN87';

DO $check$
DECLARE
  target costing.costing_refresh_run%ROWTYPE;
  displayed bigint;
BEGIN
  IF current_setting('sasv.retention_staging_rehearsal',true)
      IS DISTINCT FROM 'EXPLICIT_STAGE_RUN87' THEN
    RAISE EXCEPTION 'Staging opt-in missing';
  END IF;
  SELECT * INTO target FROM costing.costing_refresh_run WHERE id=87 FOR UPDATE;
  IF NOT FOUND OR target.period_start <> DATE '2026-09-01'
     OR target.overall_status <> 'SUCCESS' THEN
    RAISE EXCEPTION 'Pilot run identity/period/status drift';
  END IF;
  IF EXISTS(SELECT 1 FROM costing.costing_run_designation WHERE refresh_run_id=87)
     OR EXISTS(SELECT 1 FROM costing.material_review_acceptance_register WHERE source_refresh_run_id=87)
     OR EXISTS(SELECT 1 FROM costing.regional_marketing_evidence_acceptance WHERE source_refresh_run_id=87)
     OR EXISTS(SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance WHERE source_refresh_run_id=87)
     OR EXISTS(SELECT 1 FROM costing.cost_driver_policy_cutover_acceptance WHERE accepted_refresh_run_id=87)
     OR EXISTS(SELECT 1 FROM costing.manufacturing_cost_behaviour_split WHERE reference_refresh_run_id=87)
     OR EXISTS(SELECT 1 FROM costing.costing_period_refresh_authorization WHERE consumed_by_run_id=87)
  THEN RAISE EXCEPTION 'Run 87 is governance-linked'; END IF;

  SELECT displayed_run_id INTO displayed FROM costing.v_costing_period_run_status
    WHERE period_start=DATE '2026-09-01';
  IF displayed IS NULL OR displayed=87 THEN
    RAISE EXCEPTION 'Run 87 display protection failed or missing period view';
  END IF;
  IF EXISTS (
    SELECT 1 FROM costing.costing_refresh_run
    WHERE id=87 AND overall_status IN ('QUEUED','RUNNING')
  ) THEN RAISE EXCEPTION 'Active target run'; END IF;

  -- Fail-closed if schema gained incoming FKs into either evidence relation.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype='f' AND c.confrelid IN (
      'costing.marketing_signed_billed_sales_evidence_snapshot'::regclass,
      'costing.marketing_regional_sales_evidence_snapshot'::regclass
    )
  ) THEN RAISE EXCEPTION 'New incoming FK dependency detected'; END IF;
END
$check$;

-- Transaction-local copies are NOT a durable archive; the outer ROLLBACK
-- restores everything, including any table modifications and temp snapshots.
CREATE TEMP TABLE s3e_signed_before ON COMMIT DROP AS
 SELECT * FROM costing.marketing_signed_billed_sales_evidence_snapshot
 WHERE refresh_run_id=87;
CREATE TEMP TABLE s3e_regional_before ON COMMIT DROP AS
 SELECT * FROM costing.marketing_regional_sales_evidence_snapshot
 WHERE refresh_run_id=87;

DO $assert$
BEGIN
 IF (SELECT count(*) FROM s3e_signed_before) <> 108982
 OR (SELECT count(*) FROM s3e_regional_before) <> 108982
 THEN RAISE EXCEPTION 'Exact run-87 evidence count changed; abort'; END IF;
END
$assert$;

CREATE TEMP TABLE s3e_delete_receipt (
  table_name text PRIMARY KEY, deleted_rows bigint NOT NULL
) ON COMMIT DROP;

WITH deleted AS (
 DELETE FROM costing.marketing_signed_billed_sales_evidence_snapshot
 WHERE refresh_run_id=87
 RETURNING 1
)
INSERT INTO s3e_delete_receipt SELECT 'signed',count(*) FROM deleted;

WITH deleted AS (
 DELETE FROM costing.marketing_regional_sales_evidence_snapshot
 WHERE refresh_run_id=87
 RETURNING 1
)
INSERT INTO s3e_delete_receipt SELECT 'regional',count(*) FROM deleted;

DO $verify$
BEGIN
  IF (SELECT deleted_rows FROM s3e_delete_receipt WHERE table_name='signed') <> 108982
  OR (SELECT deleted_rows FROM s3e_delete_receipt WHERE table_name='regional') <> 108982
  OR EXISTS(SELECT 1 FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id=87)
  OR EXISTS(SELECT 1 FROM costing.marketing_regional_sales_evidence_snapshot WHERE refresh_run_id=87)
  OR NOT EXISTS(SELECT 1 FROM costing.costing_refresh_run WHERE id=87)
  THEN RAISE EXCEPTION 'Rehearsal post-delete invariants failed; abort'; END IF;
END
$verify$;

SELECT * FROM s3e_delete_receipt ORDER BY table_name;
-- ALWAYS ROLLBACK, including if the above passes.
ROLLBACK;

-- Re-check in a separate READ ONLY transaction after rehearsal: both source
-- evidence tables must contain precisely 108982 run-87 rows again.
-- This test does not prove durable archive/restore, full 64-table cleanup,
-- actual physical file reclamation, or month rollover scheduling.
