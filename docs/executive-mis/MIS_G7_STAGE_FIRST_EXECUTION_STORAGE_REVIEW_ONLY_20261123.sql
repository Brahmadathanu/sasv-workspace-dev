-- G7 owner-approved STAGE-FIRST route execution storage contract, REVIEW ONLY.
-- NOT A DEPLOYABLE MIGRATION; DO NOT EXECUTE IN PRODUCTION.
-- Existing route master/step and BMR keys verified in live READ ONLY catalog.
-- Security and complete immutable correction and rollback are not yet implemented.
--
-- Stage execution should be a signed EVENT, not a mutable flag on route master.
CREATE TABLE app_private.mis_batch_route_step_execution (
  execution_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id integer NOT NULL REFERENCES public.products(id),
  batch_number text NOT NULL CHECK(length(btrim(batch_number))>0),
  bmr_id integer REFERENCES public.bmr_details(id),
  product_route_id bigint REFERENCES costing.product_process_route(id),
  route_step_id bigint REFERENCES costing.production_route_family_route_step(id),
  step_key text NOT NULL,
  occurrence_index integer NOT NULL DEFAULT 1 CHECK(occurrence_index>0),
  activity_text text NOT NULL CHECK(length(btrim(activity_text))>0),
  source_dwl_id integer REFERENCES public.daily_work_log(id),
  execution_status text NOT NULL CHECK(execution_status IN ('SIGNED','VOIDED_BY_CORRECTION')),
  actual_base_qty numeric CHECK(actual_base_qty IS NULL OR actual_base_qty>=0),
  base_uom text,
  source_evidence_ref text NOT NULL CHECK(length(btrim(source_evidence_ref))>0),
  source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
  signed_by uuid NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  authority_reference text NOT NULL CHECK(length(btrim(authority_reference))>0),
  correction_of_execution_id bigint REFERENCES app_private.mis_batch_route_step_execution(execution_id),
  request_id uuid NOT NULL UNIQUE
);
CREATE INDEX mis_batch_route_step_execution_lookup
 ON app_private.mis_batch_route_step_execution
 (product_id,batch_number,product_route_id,route_step_id,occurrence_index,execution_id DESC);
ALTER TABLE app_private.mis_batch_route_step_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.mis_batch_route_step_execution FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_batch_route_step_execution FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE app_private.mis_batch_route_step_execution_execution_id_seq FROM PUBLIC,anon,authenticated;
-- No UPDATE/DELETE DML path, no client GRANT, no permission/signature RPC.
-- An append-only immutable correction implementation and narrowly privileged
-- writer must be designed, built, compiled and security tested separately.
-- Don't treat 'VOIDED_BY_CORRECTION' as permission to update an old event;
-- later correction is a NEW event with correction_of_execution_id.
-- Do not trust unverified historic event sources. 'SIGNED' comes from server.
-- The route required-step list and universal FG boundary must be versioned and
-- verified against the batch's route date. FG_TRANSFER != FG_BULK by default.
-- IMPORTANT: Location omitted intentionally from the governing stage identity.
-- Existing DWL area/plant remain optional linked operational metadata.
