-- G7-S3 REVIEW-ONLY storage contract, not a complete installation migration.
-- DO NOT EXECUTE IN PRODUCTION. No owner approval for new schema or writer.
-- No grants/writer are supplied. Prevent public access and do not expose a client DML path.
-- This DDL must be independently reviewed in a free isolated database before an authorized install.
-- PostgreSQL private schema app_private is already present in the live project.

CREATE TABLE app_private.mis_report_receipt (
    receipt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_kind text NOT NULL,
    report_month date NOT NULL,
    as_of_cutoff date NOT NULL,
    report_version integer NOT NULL CHECK (report_version >= 1),
    predecessor_receipt_id bigint
      REFERENCES app_private.mis_report_receipt(receipt_id),
    finalization_status text NOT NULL
      CHECK (finalization_status IN
        ('FINALIZED_WITH_DISCLOSED_LIMITATIONS','FINALIZED_VERIFIED')),
    finalized_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    finalized_by uuid NOT NULL,
    finalization_reason text NOT NULL,
    payload_schema_version integer NOT NULL CHECK (payload_schema_version >= 1),
    frozen_report_jsonb jsonb NOT NULL
      CHECK (jsonb_typeof(frozen_report_jsonb) = 'object'),
    frozen_valuation_jsonb jsonb NOT NULL
      CHECK (jsonb_typeof(frozen_valuation_jsonb) = 'object'),
    source_provenance_jsonb jsonb NOT NULL
      CHECK (jsonb_typeof(source_provenance_jsonb) = 'object'),
    canonical_payload_sha256 text NOT NULL
      CHECK (canonical_payload_sha256 ~ '^[0-9a-f]{64}$'),
    source_projection_sha256 text NOT NULL
      CHECK (source_projection_sha256 ~ '^[0-9a-f]{64}$'),
    idempotency_key text NOT NULL CHECK (length(idempotency_key) > 0),
    -- Fully qualified report version is immutable and auditable.
    UNIQUE (report_kind,report_month,as_of_cutoff,report_version),
    UNIQUE (report_kind,report_month,as_of_cutoff,idempotency_key),
    CONSTRAINT mis_report_receipt_month_first CHECK
       (report_month = date_trunc('month',report_month::timestamp)::date),
    CONSTRAINT mis_report_receipt_cutoff_in_month CHECK
       (as_of_cutoff >= report_month AND
        as_of_cutoff < (report_month + interval '1 month')::date)
);

-- IMPORTANT: live app_private schema grants authenticated USAGE; therefore
-- schema location ALONE is not an access boundary. Enforce exact table access.
-- Review-only DDL, never execute in production without separately approved migration.
ALTER TABLE app_private.mis_report_receipt ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.mis_report_receipt FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_report_receipt
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE app_private.mis_report_receipt_receipt_id_seq
  FROM PUBLIC, anon, authenticated;

-- No client policy or table DML grant is intentionally created. Future
-- SECURITY DEFINER writer must be explicitly scoped, audited, and executed
-- via a narrowly granted wrapper after real role tests. FORCE RLS demands
-- an explicitly reviewed privileged server execution path; do not assume
-- that defining the table and adding a writer will automatically permit INSERT.

-- Indexed read for a report's latest version. There is no mutable active=true flag.
CREATE INDEX mis_report_receipt_latest_idx
 ON app_private.mis_report_receipt
 (report_kind,report_month,as_of_cutoff,report_version DESC);

-- Defense in depth only, not a defense against privileged superuser/DDL bypass.
-- A server writer is NOT part of this review candidate. Its guarded transaction,
-- authenticated owner authorization, source reconstruction and canonical digest
-- verification require separate full design and explicit owner approval.
CREATE OR REPLACE FUNCTION app_private.mis_report_receipt_block_mutation()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'pg_catalog','pg_temp'
AS $$
BEGIN
  RAISE EXCEPTION
    'Finalized MIS report receipts are append-only: create a new revision'
    USING ERRCODE='42501';
END;
$$;

REVOKE ALL ON FUNCTION app_private.mis_report_receipt_block_mutation()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER mis_report_receipt_no_update_delete
 BEFORE UPDATE OR DELETE ON app_private.mis_report_receipt
 FOR EACH ROW EXECUTE FUNCTION app_private.mis_report_receipt_block_mutation();

-- Mandatory installation checklist (deliberately NOT embedded as executable grants):
-- 1. Verify app_private is not exposed by PostgREST; no anon/authenticated
--    table privileges, no direct client writes; review owner and schema USAGE.
-- 2. Verify finalization writer *computes* payload server-side, validates
--    canonical MIS edit+owner authority and never accepts client money JSON.
-- 3. Use narrow transaction-scoped serialization + unique version/idempotency.
-- 4. Freeze actual per-SKU valued rates or sufficient deterministic projection;
--    never store only costing run ID if historical runs can be pruned.
-- 5. Freeze original Tally line projection with latest-wins precedence and
--    finalizer job IDs, expected-key fingerprints, exact selected as-of.
-- 6. Version canonical byte encoding; do not include volatile time in digest.
-- 7. Distinguish missing/unverified values as NULL with explicit limitations.
-- 8. Attempt mutation / unauthenticated / view-only / concurrent retry tests.
-- 9. Validate storage size & retention vs approved costing pruning policy.
-- 10. Produce rollback approach preserving all signed receipts before approval.
