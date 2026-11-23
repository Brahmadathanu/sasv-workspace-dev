-- MIS G7 S2: protected, signed, append-only per-batch route-stage events.
-- INSTALLABLE CODE ONLY. Not applied anywhere. Owner authorization required.
-- Depends on (pre-existing, NOT created here): public.products, public.bmr_details,
-- public.daily_work_log, public.activities, costing.product_process_route,
-- costing.production_route_family_route_step, public.require_permission(text,boolean).
-- Rollback: see docs/executive-mis-g7-server/README.md (signed history is preserved:
-- rollback drops functions only; tables are retained).
-- New permission targets (must be granted to roles by the owner; none granted here):
--   module:mis-batch-stage-signer   (sign / correct a batch stage)
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;

-- Generic append-only guard (UPDATE/DELETE/TRUNCATE rejected for every role).
CREATE OR REPLACE FUNCTION app_private.mis_g7_append_only_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $f$
BEGIN
  RAISE EXCEPTION 'MIS_G7_APPEND_ONLY: % on %.% is not permitted',
    TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = '42501';
END $f$;

CREATE TABLE IF NOT EXISTS app_private.mis_batch_stage_event (
  event_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_kind      text   NOT NULL CHECK (event_kind IN ('SIGN','CORRECTION')),
  product_id      integer NOT NULL REFERENCES public.products(id),
  batch_number    text   NOT NULL CHECK (length(btrim(batch_number)) > 0 AND batch_number = btrim(batch_number)),
  bmr_id          integer NOT NULL,
  route_id        bigint NOT NULL,      -- costing.product_process_route.id (each row is one route version)
  route_step_id   bigint NOT NULL,      -- costing.production_route_family_route_step.id
  step_occurrence integer NOT NULL DEFAULT 1 CHECK (step_occurrence >= 1),
  stage_role      text   NOT NULL CHECK (stage_role IN ('FG_BULK','OTHER')),
  work_log_id     integer NOT NULL,     -- actual DWL activity this stage is evidenced by
  measured_qty_base numeric CHECK (measured_qty_base IS NULL OR measured_qty_base > 0),
  measured_uom    text,
  evidence_ref    text   NOT NULL CHECK (length(btrim(evidence_ref)) > 0),
  signed_by       uuid   NOT NULL,
  signed_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
  source          text   NOT NULL DEFAULT 'mis_sign_batch_stage_v1',
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  idempotency_key uuid   NOT NULL UNIQUE,
  corrects_event_id bigint REFERENCES app_private.mis_batch_stage_event(event_id),
  correction_reason text,
  CONSTRAINT mis_stage_event_correction_shape CHECK (
    (event_kind = 'SIGN' AND corrects_event_id IS NULL AND correction_reason IS NULL)
    OR (event_kind = 'CORRECTION' AND corrects_event_id IS NOT NULL
        AND length(btrim(coalesce(correction_reason,''))) > 0)),
  CONSTRAINT mis_stage_event_fg_measured CHECK (
    event_kind = 'CORRECTION' OR stage_role <> 'FG_BULK'
    OR (measured_qty_base IS NOT NULL AND measured_uom IS NOT NULL))
);
-- At most one live (un-corrected) SIGN per product/batch/step/occurrence is enforced
-- by the RPC under the batch lock plus this partial helper index for lookups.
CREATE INDEX IF NOT EXISTS mis_batch_stage_event_lookup
  ON app_private.mis_batch_stage_event (product_id, batch_number, route_step_id, step_occurrence, event_id DESC);
CREATE INDEX IF NOT EXISTS mis_batch_stage_event_corrects
  ON app_private.mis_batch_stage_event (corrects_event_id) WHERE corrects_event_id IS NOT NULL;
-- A SIGN can be corrected at most once.
CREATE UNIQUE INDEX IF NOT EXISTS mis_batch_stage_event_one_correction
  ON app_private.mis_batch_stage_event (corrects_event_id) WHERE event_kind = 'CORRECTION';

DROP TRIGGER IF EXISTS mis_batch_stage_event_append_only ON app_private.mis_batch_stage_event;
CREATE TRIGGER mis_batch_stage_event_append_only
  BEFORE UPDATE OR DELETE ON app_private.mis_batch_stage_event
  FOR EACH ROW EXECUTE FUNCTION app_private.mis_g7_append_only_guard();
DROP TRIGGER IF EXISTS mis_batch_stage_event_no_truncate ON app_private.mis_batch_stage_event;
CREATE TRIGGER mis_batch_stage_event_no_truncate
  BEFORE TRUNCATE ON app_private.mis_batch_stage_event
  FOR EACH STATEMENT EXECUTE FUNCTION app_private.mis_g7_append_only_guard();
ALTER TABLE app_private.mis_batch_stage_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_batch_stage_event FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE app_private.mis_batch_stage_event_event_id_seq FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- S3 shared lock primitive (also used by S2 and S4). One stable lock identity:
-- product_id + exact batch_number. Advisory xact lock; a 64-bit hash collision can
-- only cause extra serialization, never a missed lock. Multi-key callers MUST use
-- mis_lock_fg_batches (sorted) to avoid deadlock.
CREATE OR REPLACE FUNCTION app_private.mis_fg_batch_lock_key(p_product_id integer, p_batch text)
RETURNS bigint LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, pg_temp AS $f$
  SELECT hashtextextended('sasv:mis:fg_batch:' || p_product_id::text || ':' || p_batch, 0)
$f$;

CREATE OR REPLACE FUNCTION app_private.mis_lock_fg_batch(p_product_id integer, p_batch text)
RETURNS void LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $f$
BEGIN
  IF p_product_id IS NULL OR p_batch IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(app_private.mis_fg_batch_lock_key(p_product_id, p_batch));
END $f$;

CREATE OR REPLACE FUNCTION app_private.mis_lock_fg_batches(p_a_product integer, p_a_batch text,
                                                           p_b_product integer, p_b_batch text)
RETURNS void LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $f$
DECLARE ka bigint; kb bigint;
BEGIN
  IF p_a_product IS NOT NULL AND p_a_batch IS NOT NULL THEN
    ka := app_private.mis_fg_batch_lock_key(p_a_product, p_a_batch); END IF;
  IF p_b_product IS NOT NULL AND p_b_batch IS NOT NULL THEN
    kb := app_private.mis_fg_batch_lock_key(p_b_product, p_b_batch); END IF;
  IF ka IS NOT NULL AND kb IS NOT NULL AND kb < ka THEN
    PERFORM pg_advisory_xact_lock(kb); PERFORM pg_advisory_xact_lock(ka);
  ELSE
    IF ka IS NOT NULL THEN PERFORM pg_advisory_xact_lock(ka); END IF;
    IF kb IS NOT NULL AND kb IS DISTINCT FROM ka THEN PERFORM pg_advisory_xact_lock(kb); END IF;
  END IF;
END $f$;

-- ---------------------------------------------------------------------------
-- Permission helper: returns false on denial (fail closed), never raises denial.
CREATE OR REPLACE FUNCTION app_private.mis_g7_has_permission(p_target text)
RETURNS boolean LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $f$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  PERFORM public.require_permission(p_target, true);
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_has_permission(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Route/BMR resolver. STABLE read-only. Returns resolution + fail-closed code.
CREATE OR REPLACE FUNCTION app_private.mis_resolve_batch_stage(
  p_product_id integer, p_batch text, p_work_log_id integer, p_route_step_id bigint)
RETURNS TABLE (code text, bmr_id integer, route_id bigint, route_step_id bigint,
               stage_role text, activity_name text, wl_log_date date,
               wl_status text, wl_storage_qty numeric, wl_storage_uom text)
LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, public, costing, pg_temp AS $f$
DECLARE
  v_wl record; v_bmr int; v_nbmr int; v_nroute int; v_route bigint;
  v_step record; v_nfg int;
BEGIN
  SELECT wl.id, wl.log_date, wl.status, wl.storage_qty, wl.storage_qty_uom, wl.activity, wl.batch_number, p.id AS pid
    INTO v_wl
    FROM public.daily_work_log wl JOIN public.products p ON p.item = wl.item
   WHERE wl.id = p_work_log_id;
  IF v_wl.id IS NULL OR v_wl.pid <> p_product_id OR v_wl.batch_number IS DISTINCT FROM p_batch THEN
    RETURN QUERY SELECT 'WORK_LOG_IDENTITY_MISMATCH'::text, NULL::int, NULL::bigint, NULL::bigint,
      NULL::text, NULL::text, NULL::date, NULL::text, NULL::numeric, NULL::text; RETURN;
  END IF;
  SELECT count(*), min(b.id) INTO v_nbmr, v_bmr FROM public.bmr_details b
   WHERE b.product_id = p_product_id AND b.bn = p_batch;
  IF v_nbmr <> 1 THEN
    RETURN QUERY SELECT 'BMR_IDENTITY_REVIEW'::text, NULL::int, NULL::bigint, NULL::bigint,
      NULL::text, NULL::text, v_wl.log_date, v_wl.status, v_wl.storage_qty, v_wl.storage_qty_uom; RETURN;
  END IF;
  SELECT count(*), min(pr.id) INTO v_nroute, v_route FROM costing.product_process_route pr
   WHERE pr.product_id = p_product_id AND pr.status = 'APPROVED'
     AND pr.effective_from <= v_wl.log_date
     AND (pr.effective_to IS NULL OR pr.effective_to >= v_wl.log_date);
  IF v_nroute = 0 THEN
    RETURN QUERY SELECT CASE WHEN EXISTS (SELECT 1 FROM costing.product_process_route x
       WHERE x.product_id = p_product_id AND x.status = 'APPROVED')
       THEN 'EFFECTIVE_DATE_ROUTE_GAP' ELSE 'PRODUCT_ROUTE_COVERAGE' END,
      v_bmr, NULL::bigint, NULL::bigint, NULL::text, NULL::text,
      v_wl.log_date, v_wl.status, v_wl.storage_qty, v_wl.storage_qty_uom; RETURN;
  ELSIF v_nroute > 1 THEN
    RETURN QUERY SELECT 'APPROVED_ROUTE_OVERLAP'::text, v_bmr, NULL::bigint, NULL::bigint,
      NULL::text, NULL::text, v_wl.log_date, v_wl.status, v_wl.storage_qty, v_wl.storage_qty_uom; RETURN;
  END IF;
  -- mandatory FG bulk stage must exist exactly once in the effective route
  SELECT count(*) INTO v_nfg
    FROM costing.product_process_route pr
    JOIN costing.production_route_family_route_step s ON s.family_route_id = pr.base_route_family_route_id
    JOIN public.activities a ON a.id = s.activity_id
   WHERE pr.id = v_route AND a.activity_name = 'FG bulk storage' AND s.is_mandatory;
  IF v_nfg <> 1 THEN
    RETURN QUERY SELECT 'MANDATORY_FG_STAGE_GAP'::text, v_bmr, v_route, NULL::bigint, NULL::text, NULL::text,
      v_wl.log_date, v_wl.status, v_wl.storage_qty, v_wl.storage_qty_uom; RETURN;
  END IF;
  SELECT s.id, a.activity_name INTO v_step
    FROM costing.product_process_route pr
    JOIN costing.production_route_family_route_step s ON s.family_route_id = pr.base_route_family_route_id
    JOIN public.activities a ON a.id = s.activity_id
   WHERE pr.id = v_route AND s.id = p_route_step_id;
  IF v_step.id IS NULL THEN
    RETURN QUERY SELECT 'STEP_NOT_IN_EFFECTIVE_ROUTE'::text, v_bmr, v_route, NULL::bigint, NULL::text, NULL::text,
      v_wl.log_date, v_wl.status, v_wl.storage_qty, v_wl.storage_qty_uom; RETURN;
  END IF;
  IF v_step.activity_name IS DISTINCT FROM v_wl.activity THEN
    RETURN QUERY SELECT 'ACTIVITY_STEP_MISMATCH'::text, v_bmr, v_route, v_step.id, NULL::text, v_step.activity_name,
      v_wl.log_date, v_wl.status, v_wl.storage_qty, v_wl.storage_qty_uom; RETURN;
  END IF;
  RETURN QUERY SELECT 'OK'::text, v_bmr, v_route, v_step.id,
    CASE WHEN v_step.activity_name = 'FG bulk storage' THEN 'FG_BULK' ELSE 'OTHER' END,
    v_step.activity_name, v_wl.log_date, v_wl.status, v_wl.storage_qty, v_wl.storage_qty_uom;
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_resolve_batch_stage(integer,text,integer,bigint) FROM PUBLIC, anon, authenticated;

-- Latest effective state of a stage occurrence: 'SIGNED' / 'CORRECTED' / NULL.
CREATE OR REPLACE FUNCTION app_private.mis_stage_is_signed(p_product_id integer, p_batch text, p_stage_role text)
RETURNS boolean LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp AS $f$
  SELECT EXISTS (
    SELECT 1 FROM app_private.mis_batch_stage_event s
     WHERE s.event_kind = 'SIGN' AND s.product_id = p_product_id AND s.batch_number = p_batch
       AND s.stage_role = p_stage_role
       AND NOT EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event c
                        WHERE c.event_kind = 'CORRECTION' AND c.corrects_event_id = s.event_id))
$f$;
REVOKE ALL ON FUNCTION app_private.mis_stage_is_signed(integer,text,text) FROM PUBLIC, anon, authenticated;

-- Shared source fingerprint (used at sign time AND re-verified at pack time).
-- Returns NULL when the resolver does not return OK (e.g. route/DWL changed since signing).
CREATE OR REPLACE FUNCTION app_private.mis_stage_fp(p_product_id integer, p_batch text, p_work_log_id integer,
                                                    p_route_step_id bigint, p_occ integer)
RETURNS text LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, public, costing, pg_temp AS $f$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM app_private.mis_resolve_batch_stage(p_product_id, p_batch, p_work_log_id, p_route_step_id);
  IF r.code <> 'OK' THEN RETURN NULL; END IF;
  RETURN encode(sha256(convert_to(jsonb_build_object(
      'product_id', p_product_id, 'batch', p_batch, 'bmr_id', r.bmr_id, 'route_id', r.route_id,
      'route_step_id', r.route_step_id, 'occurrence', p_occ, 'work_log_id', p_work_log_id,
      'wl_status', r.wl_status, 'wl_storage_qty', r.wl_storage_qty, 'wl_storage_uom', r.wl_storage_uom,
      'wl_log_date', r.wl_log_date, 'activity', r.activity_name)::text, 'UTF8')), 'hex');
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_stage_fp(integer,text,integer,bigint,integer) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public RPC: sign a batch stage. Actor is auth.uid(); client flags never trusted.
CREATE OR REPLACE FUNCTION public.mis_sign_batch_stage_v1(
  p_idempotency_key uuid, p_product_id integer, p_batch_number text, p_work_log_id integer,
  p_route_step_id bigint, p_step_occurrence integer, p_measured_qty_base numeric,
  p_evidence_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, costing, pg_temp AS $f$
DECLARE
  v_actor uuid := auth.uid(); r record; v_fp text; v_ev bigint; v_uom text;
  v_prior app_private.mis_batch_stage_event; v_occ int := coalesce(p_step_occurrence, 1);
  v_batch text := btrim(p_batch_number);
BEGIN
  PERFORM public.require_permission('module:mis-batch-stage-signer', true);
  IF v_actor IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_idempotency_key IS NULL OR p_product_id IS NULL OR v_batch IS NULL OR v_batch = ''
     OR p_work_log_id IS NULL OR p_route_step_id IS NULL OR v_occ < 1
     OR p_evidence_ref IS NULL OR length(btrim(p_evidence_ref)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('sasv:mis:idem:' || p_idempotency_key::text, 0));
  PERFORM app_private.mis_lock_fg_batch(p_product_id, v_batch);

  SELECT * INTO v_prior FROM app_private.mis_batch_stage_event WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_prior.signed_by = v_actor AND v_prior.event_kind = 'SIGN' AND v_prior.product_id = p_product_id
       AND v_prior.batch_number = v_batch AND v_prior.work_log_id = p_work_log_id
       AND v_prior.route_step_id = p_route_step_id AND v_prior.step_occurrence = v_occ THEN
      RETURN jsonb_build_object('ok', true, 'idempotent_replay', true, 'event_id', v_prior.event_id,
        'stage_role', v_prior.stage_role, 'source_fingerprint', v_prior.source_fingerprint);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REUSED');
  END IF;

  SELECT * INTO r FROM app_private.mis_resolve_batch_stage(p_product_id, v_batch, p_work_log_id, p_route_step_id);
  IF r.code <> 'OK' THEN
    RETURN jsonb_build_object('ok', false, 'code', r.code, 'historical_state', 'NOT_VERIFIED');
  END IF;
  IF EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event s
              WHERE s.event_kind = 'SIGN' AND s.product_id = p_product_id AND s.batch_number = v_batch
                AND s.route_step_id = p_route_step_id AND s.step_occurrence = v_occ
                AND NOT EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event c
                                 WHERE c.event_kind = 'CORRECTION' AND c.corrects_event_id = s.event_id)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'STAGE_ALREADY_SIGNED');
  END IF;
  IF r.stage_role = 'FG_BULK' THEN
    SELECT uom_base INTO v_uom FROM public.products WHERE id = p_product_id;
    IF p_measured_qty_base IS NULL OR p_measured_qty_base <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'MEASURED_QTY_REQUIRED');
    END IF;
    -- C1 evidence: the certified amount must be the actual DWL FG receipt, in the product base UOM,
    -- and the batch ledger must really hold at least that positive stock. No unit guessing.
    IF r.wl_storage_qty IS NULL OR r.wl_storage_qty <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'FG_RECEIPT_EVIDENCE_MISSING', 'detail', 'work log has no positive storage_qty');
    END IF;
    IF r.wl_storage_uom IS DISTINCT FROM v_uom THEN
      RETURN jsonb_build_object('ok', false, 'code', 'FG_UOM_MISMATCH', 'work_log_uom', r.wl_storage_uom, 'base_uom', v_uom);
    END IF;
    IF p_measured_qty_base <> r.wl_storage_qty THEN
      RETURN jsonb_build_object('ok', false, 'code', 'MEASURED_QTY_MISMATCH', 'work_log_qty', r.wl_storage_qty, 'measured_qty_base', p_measured_qty_base);
    END IF;
    IF (SELECT coalesce(sum(qty_base), 0) FROM public.fg_bulk_stock_ledger
         WHERE product_id = p_product_id AND batch_number = v_batch AND qty_base > 0) < p_measured_qty_base THEN
      RETURN jsonb_build_object('ok', false, 'code', 'FG_RECEIPT_EVIDENCE_MISSING', 'detail', 'ledger holds less positive stock than measured');
    END IF;
  ELSE
    v_uom := CASE WHEN p_measured_qty_base IS NULL THEN NULL
                  ELSE (SELECT uom_base FROM public.products WHERE id = p_product_id) END;
  END IF;
  v_fp := app_private.mis_stage_fp(p_product_id, v_batch, p_work_log_id, p_route_step_id, v_occ);
  INSERT INTO app_private.mis_batch_stage_event
    (event_kind, product_id, batch_number, bmr_id, route_id, route_step_id, step_occurrence, stage_role,
     work_log_id, measured_qty_base, measured_uom, evidence_ref, signed_by, source_fingerprint, idempotency_key)
  VALUES ('SIGN', p_product_id, v_batch, r.bmr_id, r.route_id, r.route_step_id, v_occ, r.stage_role,
     p_work_log_id, p_measured_qty_base, v_uom, btrim(p_evidence_ref), v_actor, v_fp, p_idempotency_key)
  RETURNING event_id INTO v_ev;
  RETURN jsonb_build_object('ok', true, 'idempotent_replay', false, 'event_id', v_ev,
    'stage_role', r.stage_role, 'route_id', r.route_id, 'bmr_id', r.bmr_id, 'source_fingerprint', v_fp);
END $f$;

-- Correction is a separate event; the original SIGN is never modified.
CREATE OR REPLACE FUNCTION public.mis_correct_batch_stage_v1(
  p_idempotency_key uuid, p_event_id bigint, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, costing, pg_temp AS $f$
DECLARE v_actor uuid := auth.uid(); o app_private.mis_batch_stage_event; v_new bigint; v_prior app_private.mis_batch_stage_event;
BEGIN
  PERFORM public.require_permission('module:mis-batch-stage-signer', true);
  IF v_actor IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_idempotency_key IS NULL OR p_event_id IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
  SELECT * INTO o FROM app_private.mis_batch_stage_event WHERE event_id = p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND'); END IF;
  PERFORM app_private.mis_lock_fg_batch(o.product_id, o.batch_number);
  SELECT * INTO v_prior FROM app_private.mis_batch_stage_event WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_prior.event_kind = 'CORRECTION' AND v_prior.corrects_event_id = p_event_id AND v_prior.signed_by = v_actor THEN
      RETURN jsonb_build_object('ok', true, 'idempotent_replay', true, 'event_id', v_prior.event_id); END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REUSED');
  END IF;
  IF o.event_kind <> 'SIGN' THEN RETURN jsonb_build_object('ok', false, 'code', 'ONLY_SIGN_CAN_BE_CORRECTED'); END IF;
  IF EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event WHERE corrects_event_id = p_event_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_CORRECTED'); END IF;
  INSERT INTO app_private.mis_batch_stage_event
    (event_kind, product_id, batch_number, bmr_id, route_id, route_step_id, step_occurrence, stage_role,
     work_log_id, measured_qty_base, measured_uom, evidence_ref, signed_by, source_fingerprint, idempotency_key,
     corrects_event_id, correction_reason)
  VALUES ('CORRECTION', o.product_id, o.batch_number, o.bmr_id, o.route_id, o.route_step_id, o.step_occurrence,
     o.stage_role, o.work_log_id, NULL, NULL, o.evidence_ref, v_actor, o.source_fingerprint, p_idempotency_key,
     p_event_id, btrim(p_reason))
  RETURNING event_id INTO v_new;
  RETURN jsonb_build_object('ok', true, 'idempotent_replay', false, 'event_id', v_new, 'corrects_event_id', p_event_id);
END $f$;

REVOKE ALL ON FUNCTION public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mis_correct_batch_stage_v1(uuid,bigint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_correct_batch_stage_v1(uuid,bigint,text) TO authenticated;
