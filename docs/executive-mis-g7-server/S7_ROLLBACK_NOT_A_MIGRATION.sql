-- MIS G7 S7 staged rollback. NOT A MIGRATION. Each section is marker-delimited and independently executable; run in the order S7C, S7B, then S7A,
-- each as ONE transaction, only with owner authorization. S2–S6 are never touched. Signed events are never modified or deleted.
-- Tables app_private.mis_g7_s7_baseline and app_private.mis_g7_governance_cutover are RETAINED (evidence), like S2's tables.

-- ===== S7C ROLLBACK =====
DROP FUNCTION IF EXISTS public.mis_preview_pack_fg_bulk_v1(bigint,jsonb,bigint,integer);
DROP FUNCTION IF EXISTS public.mis_get_governance_exception_summary_v1(date,date,integer,integer);
-- ===== END S7C ROLLBACK =====

-- ===== S7B ROLLBACK =====
-- Restores the exact installed S2 signer and S4 packer from the persisted baseline (hash-checked). Always safe for signatures: the original
-- receipt rule is weaker, so no valid signature can become invalid. Refuses while S7C is still installed.
DO $g$
DECLARE r record;
BEGIN
  IF to_regprocedure('public.mis_preview_pack_fg_bulk_v1(bigint,jsonb,bigint,integer)') IS NOT NULL THEN RAISE EXCEPTION 'MIS_G7_S7_ROLLBACK_ORDER: roll back S7C first'; END IF;
  FOR r IN SELECT obj, def, sha256 FROM app_private.mis_g7_s7_baseline
            WHERE obj IN ('public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)', 'public.mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb)') LOOP
    IF encode(sha256(convert_to(r.def,'UTF8')),'hex') <> r.sha256 THEN RAISE EXCEPTION 'MIS_G7_S7_ROLLBACK_BASELINE_CORRUPT: %', r.obj; END IF;
    EXECUTE r.def;
    IF encode(sha256(convert_to(pg_get_functiondef(r.obj::regprocedure),'UTF8')),'hex') <> r.sha256 THEN RAISE EXCEPTION 'MIS_G7_S7_ROLLBACK_RESTORE_MISMATCH: %', r.obj; END IF;
  END LOOP;
  IF (SELECT count(*) FROM app_private.mis_g7_s7_baseline WHERE obj LIKE 'public.mis_%') <> 2 THEN RAISE EXCEPTION 'MIS_G7_S7_ROLLBACK_NO_BASELINE'; END IF;
END $g$;
-- ===== END S7B ROLLBACK =====

-- ===== S7A ROLLBACK =====
DO $g$
DECLARE d text; sha text;
BEGIN
  IF to_regprocedure('public.mis_preview_pack_fg_bulk_v1(bigint,jsonb,bigint,integer)') IS NOT NULL
     OR to_regprocedure('public.mis_get_governance_exception_summary_v1(date,date,integer,integer)') IS NOT NULL
     OR position('mis_g7_fg_receipt' IN (SELECT prosrc FROM pg_proc WHERE oid = 'public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'MIS_G7_S7_ROLLBACK_ORDER: roll back S7C and S7B first'; END IF;
  IF to_regclass('app_private.mis_g7_s7_baseline') IS NULL THEN RAISE EXCEPTION 'MIS_G7_S7_ROLLBACK_NO_BASELINE'; END IF;
  -- 1. Identities that the original S2 resolver cannot express (inherited family routes: route_id < 0; added override steps: route_step_id < 0).
  IF EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event WHERE route_id <= 0 OR route_step_id <= 0) THEN
    RAISE EXCEPTION 'MIS_G7_S7_ROLLBACK_INCOMPATIBLE_IDENTITIES: genuine signatures use S7-only route identities; they are preserved and rollback is refused';
  END IF;
  -- 2. Which signatures verify today (under S7)?
  CREATE TEMP TABLE mis_g7_s7_rb_valid ON COMMIT DROP AS
    SELECT s.event_id FROM app_private.mis_batch_stage_event s
     WHERE s.event_kind = 'SIGN'
       AND app_private.mis_stage_fp(s.product_id, s.batch_number, s.work_log_id, s.route_step_id, s.step_occurrence) = s.source_fingerprint;
  -- 3. Exact restore of the original resolver from the persisted baseline (hash-checked).
  SELECT def, b.sha256 INTO d, sha FROM app_private.mis_g7_s7_baseline b WHERE obj = 'app_private.mis_resolve_batch_stage(integer,text,integer,bigint)';
  IF d IS NULL OR encode(sha256(convert_to(d,'UTF8')),'hex') <> sha THEN RAISE EXCEPTION 'MIS_G7_S7_ROLLBACK_BASELINE_CORRUPT'; END IF;
  EXECUTE d;
  -- 4. Every signature that was valid must still verify under the restored resolver, otherwise nothing is rolled back.
  IF EXISTS (SELECT 1 FROM mis_g7_s7_rb_valid v JOIN app_private.mis_batch_stage_event s USING (event_id)
              WHERE app_private.mis_stage_fp(s.product_id, s.batch_number, s.work_log_id, s.route_step_id, s.step_occurrence) IS DISTINCT FROM s.source_fingerprint) THEN
    RAISE EXCEPTION 'MIS_G7_S7_ROLLBACK_INCOMPATIBLE_SIGNATURES: restoring the original resolver would invalidate genuine signatures';
  END IF;
  IF encode(sha256(convert_to(pg_get_functiondef('app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'::regprocedure),'UTF8')),'hex') <> sha THEN
    RAISE EXCEPTION 'MIS_G7_S7_ROLLBACK_RESTORE_MISMATCH'; END IF;
END $g$;
DROP FUNCTION IF EXISTS public.mis_get_batch_route_context_v1(integer,text,integer);
DROP FUNCTION IF EXISTS public.mis_get_batch_stage_status_v1(integer,text);
DROP FUNCTION IF EXISTS app_private.mis_g7_batch_stage_status(integer,text);
DROP FUNCTION IF EXISTS app_private.mis_g7_fg_state(integer,text);
DROP FUNCTION IF EXISTS app_private.mis_g7_route_context(integer,text,integer);
DROP FUNCTION IF EXISTS app_private.mis_g7_batch_receipt_code(integer,text);
DROP FUNCTION IF EXISTS app_private.mis_g7_fg_stage_log(integer,text);
DROP FUNCTION IF EXISTS app_private.mis_g7_fg_receipt(integer,text,integer);
DROP FUNCTION IF EXISTS app_private.mis_g7_can_view(text);
-- ===== END S7A ROLLBACK =====
