-- R1 (corrected): compact run-identity retention ledger. NON-DESTRUCTIVE. PostgreSQL 17.
-- PR #491 / Issue #539. Supersedes ../20261125_costing_run_retention_ledger.sql (draft).
-- Corrections vs draft: RLS + explicit grants; nullable valuation_date preserved; original period_start kept;
-- detail_state no longer conflates "unverified"/"incomplete"/"purged" with planner decisions (separate retention_decision);
-- failed/cancelled/in-flight runs are never labelled available; state machine + immutable provenance enforced by trigger;
-- registration and lifecycle sync are transactional with costing_refresh_run writes.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE SCHEMA IF NOT EXISTS costing_retention;
REVOKE ALL ON SCHEMA costing_retention FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE costing.costing_run_retention_ledger (
  refresh_run_id bigint PRIMARY KEY REFERENCES costing.costing_refresh_run(id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  valuation_month date NOT NULL,
  valuation_date date,
  original_overall_status text NOT NULL,
  current_overall_status text NOT NULL,
  run_classification text NOT NULL DEFAULT 'UNCLASSIFIED'
    CHECK (run_classification IN ('UNCLASSIFIED','FINAL_APPROVED','SUPERSEDED_APPROVED','REFERENCE','REVOKED','DRAFT','FAILED','OTHER')),
  detail_state text NOT NULL
    CHECK (detail_state IN ('RUN_IN_PROGRESS','DETAILS_INCOMPLETE','DETAILS_UNVERIFIED','DETAILS_AVAILABLE','PURGE_IN_PROGRESS','DETAILS_PURGED')),
  retention_decision text NOT NULL DEFAULT 'UNEVALUATED'
    CHECK (retention_decision IN ('UNEVALUATED','RETAIN','ELIGIBLE','HOLD')),
  retention_reason text,
  original_designation_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  details_purged_at timestamptz,
  purge_receipt_id uuid,
  removed_row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_digest text,
  last_preflight_at timestamptz,
  last_blocker text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ledger_valuation_month_is_first CHECK (valuation_month = date_trunc('month',valuation_month)::date),
  CONSTRAINT ledger_month_matches_period CHECK (valuation_month = date_trunc('month',period_start)::date),
  CONSTRAINT ledger_purged_iff_timestamp CHECK ((detail_state='DETAILS_PURGED') = (details_purged_at IS NOT NULL)),
  CONSTRAINT ledger_purged_has_receipt CHECK (detail_state<>'DETAILS_PURGED' OR (purge_receipt_id IS NOT NULL AND verification_digest IS NOT NULL))
);
COMMENT ON TABLE costing.costing_run_retention_ledger IS
 'Compact run provenance. DETAILS_PURGED only after independently verified zero residual detail; elapsed time never implies purge. UNVERIFIED/INCOMPLETE/IN_PROGRESS are NOT available-detail claims.';
COMMENT ON COLUMN costing.costing_run_retention_ledger.detail_state IS
 'Storage fact. retention_decision is a separate planner verdict and never changes this.';
ALTER TABLE costing.costing_run_retention_ledger ENABLE ROW LEVEL SECURITY;  -- no policies: only the owner/definer functions can touch it
REVOKE ALL ON costing.costing_run_retention_ledger FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX costing_run_retention_ledger_month_idx ON costing.costing_run_retention_ledger(valuation_month,detail_state);

CREATE FUNCTION costing_retention.fn_initial_detail_state(p_status text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN p_status='SUCCESS' THEN 'DETAILS_UNVERIFIED'
             WHEN p_status IN ('QUEUED','RUNNING') THEN 'RUN_IN_PROGRESS'
             ELSE 'DETAILS_INCOMPLETE' END $$;

-- State machine + provenance immutability. Defence-in-depth: no API role has table privileges at all.
CREATE FUNCTION costing_retention.fn_ledger_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,costing AS $$
DECLARE ok boolean;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'RETENTION_LEDGER_APPEND_ONLY: delete prohibited'; END IF;
 IF (NEW.refresh_run_id,NEW.period_start,NEW.valuation_month,NEW.valuation_date,NEW.original_overall_status,NEW.created_at)
    IS DISTINCT FROM (OLD.refresh_run_id,OLD.period_start,OLD.valuation_month,OLD.valuation_date,OLD.original_overall_status,OLD.created_at)
 THEN RAISE EXCEPTION 'RETENTION_LEDGER_PROVENANCE_IMMUTABLE'; END IF;
 -- after a purge only the mirrored run status may still move (so run-header writes can never fail on a purged ledger row)
 IF OLD.detail_state='DETAILS_PURGED' AND to_jsonb(NEW)-'updated_at'-'current_overall_status' IS DISTINCT FROM to_jsonb(OLD)-'updated_at'-'current_overall_status'
 THEN RAISE EXCEPTION 'RETENTION_LEDGER_PURGED_IS_TERMINAL'; END IF;
 IF NEW.detail_state IS DISTINCT FROM OLD.detail_state THEN
  ok := (OLD.detail_state,NEW.detail_state) IN (
    ('RUN_IN_PROGRESS','DETAILS_UNVERIFIED'),('RUN_IN_PROGRESS','DETAILS_INCOMPLETE'),
    ('DETAILS_INCOMPLETE','DETAILS_UNVERIFIED'),('DETAILS_INCOMPLETE','PURGE_IN_PROGRESS'),
    ('DETAILS_UNVERIFIED','DETAILS_AVAILABLE'),('DETAILS_UNVERIFIED','DETAILS_INCOMPLETE'),('DETAILS_UNVERIFIED','PURGE_IN_PROGRESS'),
    ('DETAILS_AVAILABLE','PURGE_IN_PROGRESS'),('PURGE_IN_PROGRESS','DETAILS_PURGED'));
  IF NOT ok THEN RAISE EXCEPTION 'RETENTION_LEDGER_BAD_TRANSITION % -> %',OLD.detail_state,NEW.detail_state; END IF;
 END IF;
 NEW.updated_at:=clock_timestamp();
 RETURN NEW;
END $$;
CREATE TRIGGER ledger_guard BEFORE UPDATE OR DELETE ON costing.costing_run_retention_ledger
 FOR EACH ROW EXECUTE FUNCTION costing_retention.fn_ledger_guard();
CREATE FUNCTION costing_retention.fn_ledger_no_truncate() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS
$$ BEGIN RAISE EXCEPTION 'RETENTION_LEDGER_APPEND_ONLY: truncate prohibited'; END $$;
CREATE TRIGGER ledger_no_truncate BEFORE TRUNCATE ON costing.costing_run_retention_ledger
 FOR EACH STATEMENT EXECUTE FUNCTION costing_retention.fn_ledger_no_truncate();

-- Transactional registration/lifecycle: the ledger row commits or rolls back with the run row.
CREATE FUNCTION costing_retention.fn_register_run() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,costing,costing_retention AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO costing.costing_run_retention_ledger(refresh_run_id,period_start,valuation_month,valuation_date,
    original_overall_status,current_overall_status,detail_state,retention_reason)
  VALUES(NEW.id,NEW.period_start,date_trunc('month',NEW.period_start)::date,NEW.valuation_date,NEW.overall_status,NEW.overall_status,
    costing_retention.fn_initial_detail_state(NEW.overall_status),'Registered at run creation');
 ELSE
  UPDATE costing.costing_run_retention_ledger l SET current_overall_status=NEW.overall_status,
    detail_state=CASE
      WHEN l.detail_state IN ('PURGE_IN_PROGRESS','DETAILS_PURGED') THEN l.detail_state
      WHEN NEW.overall_status='SUCCESS' AND l.detail_state IN ('RUN_IN_PROGRESS','DETAILS_INCOMPLETE') THEN 'DETAILS_UNVERIFIED'
      WHEN NEW.overall_status IN ('QUEUED','RUNNING') AND l.detail_state='RUN_IN_PROGRESS' THEN l.detail_state
      WHEN NEW.overall_status NOT IN ('SUCCESS','QUEUED','RUNNING') AND l.detail_state IN ('RUN_IN_PROGRESS','DETAILS_UNVERIFIED') THEN 'DETAILS_INCOMPLETE'
      ELSE l.detail_state END
  WHERE l.refresh_run_id=NEW.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RETENTION_LEDGER_MISSING_ROW for run %',NEW.id; END IF;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION costing_retention.fn_register_run() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER retention_ledger_register AFTER INSERT ON costing.costing_refresh_run
 FOR EACH ROW EXECUTE FUNCTION costing_retention.fn_register_run();
CREATE TRIGGER retention_ledger_sync AFTER UPDATE OF overall_status ON costing.costing_refresh_run
 FOR EACH ROW WHEN (OLD.overall_status IS DISTINCT FROM NEW.overall_status) EXECUTE FUNCTION costing_retention.fn_register_run();

-- Initial inventory under the same lock: no deletion, no inferred approval, no purge authority.
LOCK TABLE costing.costing_refresh_run IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO costing.costing_run_retention_ledger(refresh_run_id,period_start,valuation_month,valuation_date,
  original_overall_status,current_overall_status,detail_state,retention_reason)
SELECT r.id,r.period_start,date_trunc('month',r.period_start)::date,r.valuation_date,r.overall_status,r.overall_status,
  costing_retention.fn_initial_detail_state(r.overall_status),'Initial inventory; classification and detail verification pending'
FROM costing.costing_refresh_run r ON CONFLICT (refresh_run_id) DO NOTHING;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM costing.costing_refresh_run r LEFT JOIN costing.costing_run_retention_ledger l ON l.refresh_run_id=r.id WHERE l.refresh_run_id IS NULL)
 THEN RAISE EXCEPTION 'R1 inventory incomplete'; END IF;
END $$;
COMMIT;
-- HARD STOP: no deletion, no automated job, no approval/pricing pointer change.
