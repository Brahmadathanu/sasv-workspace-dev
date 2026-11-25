-- MIS G7 S6: FG_BULK stage fingerprint no longer includes the mutable inventory lifecycle status. OWNER-REVIEW, NOT INSTALLED. Forward-only.
-- Problem (found by replaying the real production catalog): S2's mis_stage_fp hashes daily_work_log.status. When a fully packed batch is closed by the
-- governed reconciliation (Doing / In Storage -> Done) the signed FG receipt would be reported as changed (STAGE_SOURCE_CHANGED) and every later pack
-- correction would need the stage corrected and re-signed, although nothing about the receipt changed.
-- Change (ONLY this): for stage_role FG_BULK the fingerprint payload omits 'wl_status'. Every other evidence field is kept: product, batch, BMR, route,
-- route step, occurrence, work-log identity, receipt quantity, receipt UOM, log date, activity. Non-FG stages keep the exact original payload (byte-identical
-- fingerprint). A real receipt revision (quantity/UOM/batch/BMR/route/work-log/activity/date) still changes the fingerprint and requires governed correction
-- and re-signing. S2 is installed and is NOT modified; this migration replaces one function and keeps its signature, ACL, owner, search_path.
-- Preconditions (fail closed, nothing is rewritten): the live function must still be the reviewed S2 definition, and NO uncorrected FG_BULK SIGN
-- event may exist (an existing signature was fingerprinted with the old payload and would become incompatible). Live signed-stage count was verified as 0.
CREATE TABLE IF NOT EXISTS app_private.mis_g7_s6_baseline (
  obj text PRIMARY KEY, def text NOT NULL, def_sha text NOT NULL, captured_at timestamptz NOT NULL DEFAULT clock_timestamp());
DROP TRIGGER IF EXISTS mis_g7_s6_baseline_append_only ON app_private.mis_g7_s6_baseline;
CREATE TRIGGER mis_g7_s6_baseline_append_only BEFORE UPDATE OR DELETE ON app_private.mis_g7_s6_baseline
  FOR EACH ROW EXECUTE FUNCTION app_private.mis_g7_append_only_guard();
ALTER TABLE app_private.mis_g7_s6_baseline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_g7_s6_baseline FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_fn oid := to_regprocedure('app_private.mis_stage_fp(integer,text,integer,bigint,integer)'); v_sha text; v_n bigint;
BEGIN
  IF v_fn IS NULL THEN RAISE EXCEPTION 'MIS_G7_S6: S2 fingerprint function missing; refusing'; END IF;
  SELECT encode(sha256(convert_to(pg_get_functiondef(v_fn), 'UTF8')), 'hex') INTO v_sha;
  IF v_sha <> '69445f9880dea3874b6d30ae04469fa18f5c0ac1fbfc5ed13e961bfd4d083434' THEN
    RAISE EXCEPTION 'MIS_G7_S6: mis_stage_fp is not the reviewed S2 definition (live %); refusing', v_sha; END IF;
  SELECT count(*) INTO v_n FROM app_private.mis_batch_stage_event s
   WHERE s.event_kind = 'SIGN' AND s.stage_role = 'FG_BULK'
     AND NOT EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event c WHERE c.event_kind = 'CORRECTION' AND c.corrects_event_id = s.event_id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MIS_G7_S6: % uncorrected FG_BULK signature(s) carry the old fingerprint; refusing (historical signatures are never rewritten)', v_n; END IF;
  INSERT INTO app_private.mis_g7_s6_baseline (obj, def, def_sha)
  SELECT 'app_private.mis_stage_fp(integer,text,integer,bigint,integer)', pg_get_functiondef(v_fn), v_sha ON CONFLICT (obj) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION app_private.mis_stage_fp(p_product_id integer, p_batch text, p_work_log_id integer,
                                                    p_route_step_id bigint, p_occ integer)
RETURNS text LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, public, costing, pg_temp AS $f$
DECLARE r record; v_payload jsonb;
BEGIN
  SELECT * INTO r FROM app_private.mis_resolve_batch_stage(p_product_id, p_batch, p_work_log_id, p_route_step_id);
  IF r.code <> 'OK' THEN RETURN NULL; END IF;
  v_payload := jsonb_build_object(
      'product_id', p_product_id, 'batch', p_batch, 'bmr_id', r.bmr_id, 'route_id', r.route_id,
      'route_step_id', r.route_step_id, 'occurrence', p_occ, 'work_log_id', p_work_log_id,
      'wl_storage_qty', r.wl_storage_qty, 'wl_storage_uom', r.wl_storage_uom,
      'wl_log_date', r.wl_log_date, 'activity', r.activity_name);
  -- FG_BULK: lifecycle status (Doing / In Storage / Done ...) is mutable inventory state, not receipt evidence. Other stages: unchanged payload.
  IF r.stage_role IS DISTINCT FROM 'FG_BULK' THEN v_payload := v_payload || jsonb_build_object('wl_status', r.wl_status); END IF;
  RETURN encode(sha256(convert_to(v_payload::text, 'UTF8')), 'hex');
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_stage_fp(integer,text,integer,bigint,integer) FROM PUBLIC, anon, authenticated;
