-- MIS G7 C1/C2/C3 REVIEW-ONLY SCHEMA DESIGN — DO NOT EXECUTE ON PRODUCTION.
-- This is an auditable design skeleton, NOT a complete/installable migration.
-- Existing writers, permissions, trigger compatibility and DB concurrency are NOT tested.
-- App_private currently grants authenticated schema USAGE, so explicit table REVOKE required.
--
-- The lock key is product_id + exact batch_number; NULL location is NOT used as
-- a second lock identity. Location balance is validated INSIDE the same batch
-- lock; this conservatively serializes all locations and internal transfers
-- for a product/batch while legacy code operates at batch scope.
-- Source identity normalization of batch_number requires separate policy.

CREATE TABLE app_private.mis_fg_batch_write_gate (
    product_id integer NOT NULL REFERENCES public.products(id),
    batch_number text NOT NULL CHECK (length(btrim(batch_number))>0),
    PRIMARY KEY (product_id,batch_number)
);
ALTER TABLE app_private.mis_fg_batch_write_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.mis_fg_batch_write_gate FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_fg_batch_write_gate
  FROM PUBLIC,anon,authenticated;

-- Planned writer transaction (not executable here):
-- INSERT gate(product,batch) ON CONFLICT DO NOTHING;
-- SELECT 1 FROM gate WHERE product_id=? AND batch_number=?
--    FOR UPDATE;  -- locks entire product+batch, across all locations
-- For multiple affected batches acquire ordered (product_id,batch_number)
-- locks; then read location balance using IS NOT DISTINCT FROM for nullable
-- section/subsection/area/plant IDs, including internal transfer endpoints.
-- Do NOT trust this lock unless EVERY legitimate stock writer uses it, or
-- all bypass DML is revoked and a common ledger trigger enforces it.
-- Direct privilege revocation and trigger refactor are separate coordinated
-- owner-authorized migration steps.

CREATE TABLE app_private.mis_fg_batch_stage_signoff (
    signoff_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id integer NOT NULL REFERENCES public.products(id),
    batch_number text NOT NULL CHECK(length(btrim(batch_number))>0),
    stage_code text NOT NULL CHECK(length(btrim(stage_code))>0),
    -- Route master is only the specification, never the execution receipt.
    route_master_id bigint,
    route_version integer,
    source_work_log_id integer REFERENCES public.daily_work_log(id),
    source_bmr_id integer REFERENCES public.bmr_details(id),
    source_evidence_ref text NOT NULL CHECK(length(btrim(source_evidence_ref))>0),
    measured_qty_base numeric NOT NULL CHECK(measured_qty_base>0),
    measured_base_uom text NOT NULL CHECK(length(btrim(measured_base_uom))>0),
    section_id integer,
    subsection_id integer,
    area_id integer,
    plant_id integer,
    signed_by uuid NOT NULL,
    signed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    authority_code text NOT NULL CHECK(length(btrim(authority_code))>0),
    signoff_state text NOT NULL CHECK(signoff_state IN ('SIGNED','REVOKED_BY_CORRECTION')),
    predecessor_signoff_id bigint REFERENCES app_private.mis_fg_batch_stage_signoff(signoff_id),
    -- Each approval is immutable. A later correction is a new event.
    source_projection_sha256 text NOT NULL CHECK(source_projection_sha256 ~ '^[0-9a-f]{64}$'),
    idempotency_key uuid NOT NULL UNIQUE
);
CREATE INDEX mis_fg_batch_stage_signoff_lookup
 ON app_private.mis_fg_batch_stage_signoff
 (product_id,batch_number,stage_code,signed_at DESC,signoff_id DESC);
ALTER TABLE app_private.mis_fg_batch_stage_signoff ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.mis_fg_batch_stage_signoff FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_fg_batch_stage_signoff
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE app_private.mis_fg_batch_stage_signoff_signoff_id_seq
 FROM PUBLIC,anon,authenticated;

CREATE TABLE app_private.mis_fg_signed_excess_receipt (
    excess_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id integer NOT NULL REFERENCES public.products(id),
    batch_number text NOT NULL CHECK(length(btrim(batch_number))>0),
    fg_stage_signoff_id bigint NOT NULL
      REFERENCES app_private.mis_fg_batch_stage_signoff(signoff_id),
    section_id integer,
    subsection_id integer,
    area_id integer,
    plant_id integer,
    qty_base numeric NOT NULL CHECK(qty_base>0),
    base_uom text NOT NULL CHECK(length(btrim(base_uom))>0),
    measured_evidence_ref text NOT NULL CHECK(length(btrim(measured_evidence_ref))>0),
    reason text NOT NULL CHECK(length(btrim(reason))>0),
    signed_by uuid NOT NULL,
    authorized_by uuid NOT NULL,
    signed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    packaging_request_key uuid NOT NULL,
    source_projection_sha256 text NOT NULL CHECK(source_projection_sha256 ~ '^[0-9a-f]{64}$'),
    idempotency_key uuid NOT NULL UNIQUE
);
CREATE INDEX mis_fg_signed_excess_receipt_batch
 ON app_private.mis_fg_signed_excess_receipt
 (product_id,batch_number,packaging_request_key);
ALTER TABLE app_private.mis_fg_signed_excess_receipt ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.mis_fg_signed_excess_receipt FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_fg_signed_excess_receipt
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE app_private.mis_fg_signed_excess_receipt_excess_id_seq
 FROM PUBLIC,anon,authenticated;

-- CRITICAL: these review tables alone do NOT guarantee append-only authority.
-- Complete deployment must add a protected common immutable-event guard,
-- explicit owner/signer permission, validated row FK cross-identity, rollback
-- preserving signed history, and narrow SECURITY DEFINER wrappers with a
-- provably executable RLS path. FORCE RLS is NOT bypassed by a standard
-- SECURITY DEFINER function owner without a verified bypass policy/role.
--
-- An actual stage's signed evidence is never deduced from route master/BMR
-- status/DWL Done. Historical rows require source-backed C3 review.
-- Never expose direct ledger writes to authenticated users after rollout.
