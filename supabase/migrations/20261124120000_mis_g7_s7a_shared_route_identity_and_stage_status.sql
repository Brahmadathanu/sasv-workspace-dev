-- MIS G7 S7a: shared effective-route resolution for signing AND route context, plus persistent stage status.
-- FORWARD-ONLY. NOT INSTALLED. Owner authorization required. S2-S6 files are never edited or replayed.
--
-- Route identity (verified in isolated acceptance against the REAL Costing route engine, see S7 acceptance receipt):
--   route_step_id  = base_step_id (> 0, costing.production_route_family_route_step.id)   for inherited and base steps,
--                    -override_id (< 0, costing.product_process_route_override.id)        for ADD_STEP overrides.
--   route_id       = product_route_id (> 0)                                               for a product-specific route,
--                    -family_route_id (< 0, costing.production_route_family_route.id)     for an inherited family route.
--   Positive and negative spaces cannot collide; every id source is a bigint identity (guarded > 0 below).
--   Replaced / altered / bypassed base steps keep their base id; the fingerprint (S2/S6, UNCHANGED here) binds route_id,
--   route_step_id, occurrence, work log AND the effective activity, so an in-place route edit is reported as SOURCE_CHANGED.
-- The original S2 resolver is preserved byte-for-byte in app_private.mis_g7_s7_baseline for the rollback section.
-- No permission is assigned. No existing signature is reinterpreted (proof below, or the whole transaction rolls back).
-- Run as ONE transaction (the migration tool does; a manual psql run must use `psql -1` or BEGIN/COMMIT).

DO $guard$
BEGIN
  IF (SELECT mode FROM app_private.mis_g7_enforcement) IS DISTINCT FROM 'AUDIT' THEN RAISE EXCEPTION 'MIS_G7_S7_PRECONDITION: mode must be AUDIT'; END IF;
  -- sha256 of pg_proc.prosrc (exact installed S2 source text; independent of pg_get_functiondef formatting by server version)
  IF encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid = 'app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'::regprocedure),'UTF8')),'hex')
       <> '53c9c60c22ddfa33e4628d43e228789505c53bfcae9925f622e7d68b08eba9e3'
     OR encode(sha256(convert_to(pg_get_functiondef('app_private.mis_stage_fp(integer,text,integer,bigint,integer)'::regprocedure),'UTF8')),'hex')
       <> 'd438e858f03325bfbecc6f564999bd359d81d7ee24ecf2a4b7c98a92dab359d4' THEN
    RAISE EXCEPTION 'MIS_G7_S7_SOURCE_DRIFT';
  END IF;
  IF EXISTS (SELECT 1 FROM costing.production_route_family_route_step WHERE id <= 0)
     OR EXISTS (SELECT 1 FROM costing.product_process_route_override WHERE id <= 0)
     OR EXISTS (SELECT 1 FROM costing.product_process_route WHERE id <= 0)
     OR EXISTS (SELECT 1 FROM costing.production_route_family_route WHERE id <= 0) THEN
    RAISE EXCEPTION 'MIS_G7_S7_ID_NAMESPACE_COLLISION';
  END IF;
  -- The Costing route engine S7 reuses must be exactly the source acceptance-tested (sha256 of pg_proc.prosrc; verbatim repository migration text).
  IF EXISTS (SELECT 1 FROM (VALUES
      ('costing.fn_resolve_route_family_for_product(integer,date)', 'fda6b65c85b998e497627129a23d290af222dc1cea15ca7a84916b9c83817660'),
      ('costing.fn_resolve_effective_route_family_route(integer,date)', '065cb137b51b484f0b716887af3ba0fd5943687b729ef37e8b0ef7e9eae2dad3'),
      ('costing.fn_resolve_effective_product_process_route(integer,date)', '98b9f3605ee6179a4dfbb35f538f03a4a1291784c60b857beac8d48b8b59e177'),
      ('costing.fn_effective_product_process_route_steps(bigint)', '6d3c21fff37c8cca324ae7fe64e07b911a4e0b8c23337a7324ecb5c0b9a0b6d4'),
      ('costing.fn_effective_product_process_steps(integer,date)', 'f94e1ce737060a54eac2374b73f6aa7819df05a58fc15130739665d350627c8d'),
      ('costing.fn_validate_product_process_route(bigint)', '7aaf0c6ee6547af64f0bf492b4f2e3786d78f2ed3f7582dc44704836e89194a3'),
      ('costing.fn_validate_route_family_route(bigint)', '1d8f0946ec7c895bfcc1835b98fb23be6237abdce9859f8478656223c850af2d'),
      ('costing.fn_validate_effective_product_process_route(integer,date)', 'f2773bdb1ccda5f4708e9449c70c20655faeaeac0c964ca53877a8da637e5461')) v(sig, h)
      WHERE to_regprocedure(v.sig) IS NULL
         OR encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure(v.sig)),'UTF8')),'hex') <> v.h) THEN
    RAISE EXCEPTION 'MIS_G7_S7_ENGINE_DRIFT: the live Costing route engine differs from the accepted source';
  END IF;
  IF to_regprocedure('costing.fn_validate_effective_product_process_route(integer,date)') IS NULL
     OR to_regprocedure('costing.fn_effective_product_process_steps(integer,date)') IS NULL
     OR to_regprocedure('costing.fn_resolve_effective_route_family_route(integer,date)') IS NULL
     OR to_regprocedure('app_private.mis_g7_stage_problem(integer,text)') IS NULL THEN
    RAISE EXCEPTION 'MIS_G7_S7_DEPENDENCY_MISSING';
  END IF;
END $guard$;

-- Baseline of what S7 replaces (exact restore source for the rollback section). Append-only in practice: ON CONFLICT DO NOTHING.
CREATE TABLE IF NOT EXISTS app_private.mis_g7_s7_baseline (
  obj text PRIMARY KEY, def text NOT NULL, sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'), captured_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE app_private.mis_g7_s7_baseline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_g7_s7_baseline FROM PUBLIC, anon, authenticated;
INSERT INTO app_private.mis_g7_s7_baseline (obj, def, sha256)
SELECT 'app_private.mis_resolve_batch_stage(integer,text,integer,bigint)', d, encode(sha256(convert_to(d,'UTF8')),'hex')
  FROM (SELECT pg_get_functiondef('app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'::regprocedure) d) x
ON CONFLICT (obj) DO NOTHING;
INSERT INTO app_private.mis_g7_s7_baseline (obj, def, sha256)
VALUES ('max_event_id_at_install', (SELECT coalesce(max(event_id),0)::text FROM app_private.mis_batch_stage_event),
        encode(sha256(convert_to((SELECT coalesce(max(event_id),0)::text FROM app_private.mis_batch_stage_event),'UTF8')),'hex'))
ON CONFLICT (obj) DO NOTHING;

-- Governance cut-over: FG bulk logs dated BEFORE it that have no signature are historical (NOT_VERIFIED); on/after it they are UNSIGNED (actionable).
CREATE TABLE IF NOT EXISTS app_private.mis_g7_governance_cutover (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), effective_from date NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE app_private.mis_g7_governance_cutover ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_g7_governance_cutover FROM PUBLIC, anon, authenticated;
INSERT INTO app_private.mis_g7_governance_cutover (effective_from) VALUES (CURRENT_DATE) ON CONFLICT DO NOTHING;

-- Pre-replacement fingerprint truth: which existing signatures are valid today (compared after replacement).
CREATE TEMP TABLE mis_g7_s7_pre_fp AS
  SELECT s.event_id FROM app_private.mis_batch_stage_event s
   WHERE s.event_kind = 'SIGN'
     AND app_private.mis_stage_fp(s.product_id, s.batch_number, s.work_log_id, s.route_step_id, s.step_occurrence) = s.source_fingerprint;

-- View-level permission helper (no edit needed). Denial/absence of identity => false (fail closed).
CREATE OR REPLACE FUNCTION app_private.mis_g7_can_view(p_target text)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $f$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  PERFORM public.require_permission(p_target, false);
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_can_view(text) FROM PUBLIC, anon, authenticated;

-- Private authoritative route context, shared by the signer (write) and the context/exception reads. Reuses the Costing route engine.
-- Never raises: engine failures (e.g. ambiguous family mapping) become ROUTE_RESOLUTION_ERROR.
CREATE OR REPLACE FUNCTION app_private.mis_g7_route_context(p_product_id integer, p_batch text, p_work_log_id integer)
RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, public, costing, pg_temp AS $f$
DECLARE
  w record; b integer; nb bigint; nr bigint; v jsonb; errs jsonb; steps jsonb; route bigint; fg integer; ndist integer; nsteps integer;
  base jsonb; kind text; fam bigint; prod_route bigint; code text;
BEGIN
  IF p_product_id IS NULL OR coalesce(btrim(p_batch),'') = '' OR p_work_log_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
  SELECT d.id, d.log_date, d.activity, d.status, d.storage_qty, d.storage_qty_uom, p.id AS pid, d.batch_number
    INTO w FROM public.daily_work_log d JOIN public.products p ON p.item = d.item WHERE d.id = p_work_log_id;
  IF w.id IS NULL OR w.pid IS DISTINCT FROM p_product_id OR w.batch_number IS DISTINCT FROM p_batch OR w.log_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'WORK_LOG_IDENTITY_MISMATCH'); END IF;
  base := jsonb_build_object('work_log_id', w.id, 'log_date', w.log_date, 'activity', w.activity, 'status', w.status,
                             'storage_qty', w.storage_qty, 'storage_uom', w.storage_qty_uom);
  SELECT count(*), min(id) INTO nb, b FROM public.bmr_details WHERE product_id = p_product_id AND bn = p_batch;
  IF nb <> 1 THEN RETURN jsonb_build_object('ok', false, 'code', 'BMR_IDENTITY_REVIEW') || base; END IF;
  SELECT count(*) INTO nr FROM costing.product_process_route
   WHERE product_id = p_product_id AND archived_at IS NULL AND status = 'APPROVED'
     AND effective_from <= w.log_date AND (effective_to IS NULL OR effective_to >= w.log_date);
  IF nr > 1 THEN RETURN jsonb_build_object('ok', false, 'code', 'APPROVED_ROUTE_OVERLAP') || base; END IF;
  BEGIN
    v := costing.fn_validate_effective_product_process_route(p_product_id, w.log_date);
    IF NOT coalesce((v->>'valid')::boolean, false) THEN
      errs := coalesce(v->'errors', '[]'::jsonb);
      IF errs ? 'NO_APPROVED_ROUTE_FAMILY_MAPPING' OR errs ? 'NO_APPROVED_ROUTE_FAMILY_ROUTE' THEN
        code := CASE WHEN costing.fn_resolve_effective_route_family_route(p_product_id, CURRENT_DATE) IS NOT NULL
                     THEN 'EFFECTIVE_DATE_ROUTE_GAP' ELSE 'PRODUCT_ROUTE_COVERAGE' END;
      ELSE code := 'ROUTE_INVALID'; END IF;
      RETURN jsonb_build_object('ok', false, 'code', code, 'route_errors', errs) || base;
    END IF;
    fam := nullif(v->>'family_route_id','')::bigint; prod_route := nullif(v->>'product_route_id','')::bigint;
    kind := CASE WHEN prod_route IS NOT NULL THEN 'PRODUCT_ROUTE' ELSE 'ROUTE_FAMILY_INHERITED' END;
    route := CASE WHEN prod_route IS NOT NULL THEN prod_route ELSE -fam END;
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'route_step_id', coalesce(e.base_step_id, -e.override_id)::text,
        'step_kind', CASE WHEN e.base_step_id IS NOT NULL THEN 'BASE' ELSE 'ADDED' END,
        'base_step_id', e.base_step_id::text, 'override_id', e.override_id::text,
        'effective_step_key', e.effective_step_key, 'activity_name', a.activity_name, 'sequence_no', e.sequence_no,
        'is_mandatory', e.is_mandatory, 'allows_repeat', e.allows_repeat, 'expected_occurrence_count', e.expected_occurrence_count,
        'source_type', e.source_type, 'stage_role', CASE WHEN a.activity_name = 'FG bulk storage' THEN 'FG_BULK' ELSE 'OTHER' END,
        'activity_matches', a.activity_name = w.activity) ORDER BY e.sequence_no, e.effective_step_key), '[]'::jsonb),
      count(*) FILTER (WHERE a.activity_name = 'FG bulk storage' AND e.is_mandatory),
      count(DISTINCT coalesce(e.base_step_id, -e.override_id)), count(*)
      INTO steps, fg, ndist, nsteps
      FROM costing.fn_effective_product_process_steps(p_product_id, w.log_date) e
      JOIN public.activities a ON a.id = e.activity_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUTE_RESOLUTION_ERROR', 'sqlstate', SQLSTATE) || base;
  END;
  IF fg <> 1 THEN RETURN jsonb_build_object('ok', false, 'code', 'MANDATORY_FG_STAGE_GAP') || base; END IF;
  IF ndist <> nsteps OR EXISTS (SELECT 1 FROM jsonb_array_elements(steps) s WHERE s->>'route_step_id' IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'STEP_NOT_IN_EFFECTIVE_ROUTE', 'detail', 'step identity not unique') || base; END IF;
  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'bmr_id', b, 'route_id', route::text, 'route_kind', kind,
    'product_route_id', prod_route::text, 'family_route_id', fam::text, 'route_source', v->>'route_source', 'steps', steps) || base;
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_route_context(integer,text,integer) FROM PUBLIC, anon, authenticated;

-- Replacement resolver: SAME signature and output columns as S2; S2 callers (sign, fingerprint, pack, correct, chain guards) are untouched.
CREATE OR REPLACE FUNCTION app_private.mis_resolve_batch_stage(p_product_id integer, p_batch text, p_work_log_id integer, p_route_step_id bigint)
RETURNS TABLE (code text, bmr_id integer, route_id bigint, route_step_id bigint, stage_role text, activity_name text,
               wl_log_date date, wl_status text, wl_storage_qty numeric, wl_storage_uom text)
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, costing, pg_temp AS $f$
DECLARE ctx jsonb; st jsonb;
BEGIN
  ctx := app_private.mis_g7_route_context(p_product_id, p_batch, p_work_log_id);
  code := ctx->>'code';
  bmr_id := (ctx->>'bmr_id')::integer; route_id := (ctx->>'route_id')::bigint;
  wl_log_date := (ctx->>'log_date')::date; wl_status := ctx->>'status';
  wl_storage_qty := (ctx->>'storage_qty')::numeric; wl_storage_uom := ctx->>'storage_uom';
  IF p_route_step_id IS NULL AND code = 'OK' THEN code := 'STEP_NOT_IN_EFFECTIVE_ROUTE'; END IF;
  IF code = 'OK' THEN
    SELECT s INTO st FROM jsonb_array_elements(ctx->'steps') s WHERE (s->>'route_step_id')::bigint = p_route_step_id;
    IF st IS NULL THEN code := 'STEP_NOT_IN_EFFECTIVE_ROUTE';
    ELSIF NOT coalesce((st->>'activity_matches')::boolean, false) THEN
      code := 'ACTIVITY_STEP_MISMATCH'; route_step_id := p_route_step_id; activity_name := st->>'activity_name';
    ELSE route_step_id := p_route_step_id; stage_role := st->>'stage_role'; activity_name := st->>'activity_name';
    END IF;
  END IF;
  RETURN NEXT;
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_resolve_batch_stage(integer,text,integer,bigint) FROM PUBLIC, anon, authenticated;

-- Compatibility proof: every signature that was valid before S7 must still verify bit-for-bit. Otherwise nothing is installed.
DO $proof$
BEGIN
  IF EXISTS (SELECT 1 FROM mis_g7_s7_pre_fp t JOIN app_private.mis_batch_stage_event s USING (event_id)
              WHERE app_private.mis_stage_fp(s.product_id, s.batch_number, s.work_log_id, s.route_step_id, s.step_occurrence)
                    IS DISTINCT FROM s.source_fingerprint) THEN
    RAISE EXCEPTION 'MIS_G7_S7_SIGNATURE_INCOMPATIBLE: an existing valid signature would no longer verify';
  END IF;
END $proof$;
DROP TABLE mis_g7_s7_pre_fp;

-- ---------- persistent stage status (read-only) ----------
CREATE OR REPLACE FUNCTION app_private.mis_g7_fg_state(p_product_id integer, p_batch text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE prob text; cut date; first_log date;
BEGIN
  prob := app_private.mis_g7_stage_problem(p_product_id, p_batch);
  IF prob IS NULL THEN RETURN 'SIGNED'; END IF;
  IF prob = 'CHAIN_STAGE_SOURCE_CHANGED' THEN RETURN 'SOURCE_CHANGED'; END IF;
  IF prob = 'CHAIN_BATCH_IDENTITY_MISSING' THEN RETURN 'NOT_VERIFIED'; END IF;
  -- not signed: historical (never governed) vs actionable
  IF EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event s WHERE s.product_id = p_product_id AND s.batch_number = p_batch) THEN RETURN 'UNSIGNED'; END IF;
  SELECT effective_from INTO cut FROM app_private.mis_g7_governance_cutover;
  SELECT min(w.log_date) INTO first_log FROM public.daily_work_log w JOIN public.products p ON p.item = w.item
   WHERE p.id = p_product_id AND w.batch_number = p_batch AND w.activity = 'FG bulk storage';
  IF first_log IS NOT NULL AND cut IS NOT NULL AND first_log < cut THEN RETURN 'NOT_VERIFIED'; END IF;
  RETURN 'UNSIGNED';
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_fg_state(integer,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.mis_g7_batch_stage_status(p_product_id integer, p_batch text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $f$
SELECT jsonb_build_object('ok', true, 'product_id', p_product_id, 'batch_number', p_batch,
  'fg_bulk_state', app_private.mis_g7_fg_state(p_product_id, p_batch),
  'events', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'event_id', s.event_id::text, 'event_kind', s.event_kind, 'route_id', s.route_id::text, 'route_step_id', s.route_step_id::text,
      'step_occurrence', s.step_occurrence, 'work_log_id', s.work_log_id, 'stage_role', s.stage_role, 'signed_at', s.signed_at,
      'corrects_event_id', s.corrects_event_id::text, 'measured_qty_base', s.measured_qty_base, 'measured_uom', s.measured_uom,
      'state', CASE WHEN s.event_kind = 'CORRECTION' THEN 'CORRECTION'
        WHEN EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event c WHERE c.corrects_event_id = s.event_id) THEN 'CORRECTED'
        WHEN app_private.mis_stage_fp(s.product_id, s.batch_number, s.work_log_id, s.route_step_id, s.step_occurrence)
             IS DISTINCT FROM s.source_fingerprint THEN 'SOURCE_CHANGED' ELSE 'SIGNED' END)
      ORDER BY s.event_id)
    FROM app_private.mis_batch_stage_event s WHERE s.product_id = p_product_id AND s.batch_number = p_batch), '[]'::jsonb))
$f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_batch_stage_status(integer,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mis_get_batch_route_context_v1(p_product_id integer, p_batch text, p_work_log_id integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $f$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  PERFORM public.require_permission('module:mis-batch-stage-signer', false);
  RETURN app_private.mis_g7_route_context(p_product_id, p_batch, p_work_log_id);
END $f$;

CREATE OR REPLACE FUNCTION public.mis_get_batch_stage_status_v1(p_product_id integer, p_batch text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $f$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT (app_private.mis_g7_can_view('module:mis-batch-stage-signer') OR app_private.mis_g7_can_view('module:mis-fg-bulk-packing')
          OR app_private.mis_g7_can_view('module:executive-mis-dashboard')) THEN
    RAISE EXCEPTION 'MIS_G7_PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_product_id IS NULL OR coalesce(btrim(p_batch),'') = '' THEN RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
  RETURN app_private.mis_g7_batch_stage_status(p_product_id, p_batch);
END $f$;

REVOKE ALL ON FUNCTION public.mis_get_batch_route_context_v1(integer,text,integer), public.mis_get_batch_stage_status_v1(integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_get_batch_route_context_v1(integer,text,integer), public.mis_get_batch_stage_status_v1(integer,text) TO authenticated;
