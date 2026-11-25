-- Costing retention R1: compact identity ledger (NON-DESTRUCTIVE).
-- PostgreSQL 17. Run independently of any DELETE or scheduled retention.
-- PR #491 / Issue #539. November 2026 is the first authoritative month.
BEGIN;
CREATE TABLE IF NOT EXISTS costing.costing_run_retention_ledger (
  refresh_run_id bigint PRIMARY KEY
    REFERENCES costing.costing_refresh_run(id) ON DELETE RESTRICT,
  valuation_month date NOT NULL,
  valuation_date date NOT NULL,
  original_overall_status text NOT NULL,
  run_classification text NOT NULL DEFAULT 'UNCLASSIFIED'
    CHECK (run_classification IN
      ('UNCLASSIFIED','FINAL_APPROVED','SUPERSEDED_APPROVED','DRAFT','FAILED','OTHER')),
  detail_state text NOT NULL DEFAULT 'DETAILS_AVAILABLE'
    CHECK (detail_state IN
      ('DETAILS_AVAILABLE','PURGE_ELIGIBLE','PURGE_IN_PROGRESS','DETAILS_PURGED','PURGE_BLOCKED')),
  retention_reason text,
  original_designation_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  details_purged_at timestamptz,
  purge_receipt_id uuid,
  removed_row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_digest text,
  last_preflight_at timestamptz,
  last_blocker text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valuation_month_is_first CHECK
    (valuation_month = date_trunc('month', valuation_month)::date),
  CONSTRAINT purge_receipt_consistency CHECK
    ((detail_state = 'DETAILS_PURGED') = (details_purged_at IS NOT NULL)),
  CONSTRAINT purge_metadata_consistency CHECK
    (details_purged_at IS NULL OR purge_receipt_id IS NOT NULL)
);
COMMENT ON TABLE costing.costing_run_retention_ledger IS
 'Small provenance ledger; DETAILS_PURGED refers only to independently verified full-detail purge, never merely to elapsed retention time.';
-- Legacy run headers are immutable FK anchors. Initial seeding does not delete data,
-- infer approvals, or confer authority to purge any individual run.
INSERT INTO costing.costing_run_retention_ledger
  (refresh_run_id,valuation_month,valuation_date,original_overall_status,
   run_classification,detail_state,retention_reason)
SELECT r.id,date_trunc('month',r.valuation_date)::date,r.valuation_date,
       r.overall_status,'UNCLASSIFIED','DETAILS_AVAILABLE',
       'Initial inventory; live dependencies and designated approval must be classified'
FROM costing.costing_refresh_run r
ON CONFLICT (refresh_run_id) DO NOTHING;
REVOKE ALL ON costing.costing_run_retention_ledger FROM PUBLIC;
REVOKE ALL ON costing.costing_run_retention_ledger FROM anon,authenticated;
COMMIT;
-- HARD STOP: no deletion, no automated job, no approval or pricing pointer change.
