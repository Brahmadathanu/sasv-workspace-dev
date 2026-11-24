-- Rollback for MIS G7 S2-S4b migrations. NOT in supabase/migrations. Owner-authorized use only.
-- ORDER: run section S5B first, then S5, then S4B, then S3B, then the S2-S4 section (top of this file, everything before the S3B marker).
-- Sections are delimited by marker comments; each is independently executable.
-- No legacy function was replaced by these migrations, so the legacy baselines are untouched:
--   trg_fg_ledger_from_es  sha256 cc32357d320fb63278632c5726085bdcf6b32395453838d39cac8c3584faed28
--   fn_fg_ledger_check_negative sha256 211a6e879999cb97d4c28a9017cff66fb3ee493fedead10c36c4d0b81f6a1090
-- Signed history (app_private.mis_* tables) is deliberately RETAINED.
DROP FUNCTION IF EXISTS public.mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.mis_correct_batch_stage_v1(uuid,bigint,text);
DROP FUNCTION IF EXISTS public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text);
DROP TRIGGER IF EXISTS "00_mis_g7_fg_batch_lock" ON public.fg_bulk_stock_ledger;
DROP FUNCTION IF EXISTS app_private.trg_mis_fg_ledger_batch_lock();
-- ==== S3B ROLLBACK ====
-- Exact restore from app_private.mis_g7_s3b_baseline (captured by the S3b migration before it changed anything).
-- Restores: SECURITY attribute, pinned search_path, EXECUTE ACLs of the six legacy writers, and the ledger table ACL.
-- RLS state/policies are untouched by S3b. Retained: gate/audit/ticket/baseline tables and all signed history.
DROP TRIGGER IF EXISTS "00_mis_g7_event_skus_gate" ON public.event_skus;
DROP TRIGGER IF EXISTS "00_mis_g7_packaging_events_gate" ON public.packaging_events;
-- mark_done_if_zero: remove the wrapper (only if it is ours) and give the original function its name back; the generic
-- baseline loop below then restores its SECURITY attribute, search_path and ACL.
DO $$
BEGIN
  IF to_regprocedure('public.fn_fg_mark_done_if_zero_legacy(integer,text,numeric)') IS NOT NULL THEN
    IF to_regprocedure('public.fn_fg_mark_done_if_zero(integer,text,numeric)') IS NOT NULL THEN
      IF (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.fn_fg_mark_done_if_zero(integer,text,numeric)')) NOT LIKE '%MIS_G7_MARK_DONE_WRAPPER%' THEN
        RAISE EXCEPTION 'S3B rollback: fn_fg_mark_done_if_zero is not the S3b wrapper; refusing'; END IF;
      DROP FUNCTION public.fn_fg_mark_done_if_zero(integer,text,numeric);
    END IF;
    ALTER FUNCTION public.fn_fg_mark_done_if_zero_legacy(integer,text,numeric) RENAME TO fn_fg_mark_done_if_zero;
  END IF;
END $$;
DO $$
DECLARE b record; a record; v_cfg text;
BEGIN
  IF (SELECT count(*) FROM app_private.mis_g7_s3b_baseline) = 0 THEN
    RAISE EXCEPTION 'S3B rollback: no baseline recorded; refusing (restore from captured pg_get_functiondef packet)'; END IF;
  FOR b IN SELECT * FROM app_private.mis_g7_s3b_baseline ORDER BY kind DESC, obj LOOP
    IF b.kind = 'function' THEN
      EXECUTE format('ALTER FUNCTION %s %s', b.obj, CASE WHEN b.secdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END);
      EXECUTE format('ALTER FUNCTION %s RESET search_path', b.obj);
      SELECT substr(c, length('search_path=') + 1) INTO v_cfg FROM unnest(coalesce(b.proconfig, '{}'::text[])) c WHERE c LIKE 'search_path=%';
      IF v_cfg IS NOT NULL THEN EXECUTE format('ALTER FUNCTION %s SET search_path = %s', b.obj, v_cfg); END IF;
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', b.obj);
      IF b.acl IS NULL THEN EXECUTE format('GRANT ALL ON FUNCTION %s TO PUBLIC', b.obj); END IF;
    ELSE
      EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', b.obj);
    END IF;
    IF b.acl IS NOT NULL THEN
      FOR a IN SELECT x.privilege_type, x.is_grantable, x.grantee, x.grantor FROM aclexplode(b.acl) x
                WHERE x.grantee <> x.grantor LOOP
        EXECUTE format('GRANT %s ON %s %s TO %s%s', a.privilege_type, CASE WHEN b.kind = 'function' THEN 'FUNCTION' ELSE 'TABLE' END, b.obj,
          CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident((SELECT rolname FROM pg_roles WHERE oid = a.grantee)) END,
          CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ==== S4B ROLLBACK ====
-- Removes the ticketed correction RPC, the enforcement switch and the readiness report. Because ENFORCE needs the correction
-- path, the mode is returned to AUDIT (logged) so legacy corrections work again. Retained: pack/correction/enforcement logs,
-- audit rows, excess receipts and all signed history.
DROP FUNCTION IF EXISTS public.mis_g7_enforcement_readiness_v1(integer);
DROP FUNCTION IF EXISTS public.mis_g7_set_enforcement_v1(text,text);
DROP FUNCTION IF EXISTS public.mis_correct_pack_line_v1(uuid,bigint,integer,text,jsonb);
DO $$
BEGIN
  IF (SELECT mode FROM app_private.mis_g7_enforcement WHERE singleton) = 'ENFORCE' THEN
    UPDATE app_private.mis_g7_enforcement SET mode = 'AUDIT', changed_at = clock_timestamp() WHERE singleton;
    INSERT INTO app_private.mis_g7_enforcement_log (from_mode, to_mode, actor, reason)
    VALUES ('ENFORCE', 'AUDIT', '00000000-0000-0000-0000-000000000000', 'S4B rollback: ticketed correction path removed');
  END IF;
END $$;

-- ==== S5 ROLLBACK ====
-- Removes the legacy-DWL-editor protection primitives, acceptance RPC and gate. REFUSES while the live core still calls the
-- primitives (revert/replace the migrated core first, otherwise it would break). The three functions S5 replaced are restored
-- EXACTLY from app_private.mis_g7_s5_baseline. Retained: tickets, acceptance records, baselines, all logs and signed history.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rpc_update_daily_work_log_with_packaging__core' AND pronamespace = 'public'::regnamespace
              AND (prosrc LIKE '%mis_g7_chain_replace_begin%' OR prosrc LIKE '%mis_g7_chain_replace_finish%')) THEN
    RAISE EXCEPTION 'S5 rollback: the live core still calls the S5 primitives; revert the core first'; END IF;
  IF (SELECT count(*) FROM app_private.mis_g7_s5_baseline) <> 3 THEN RAISE EXCEPTION 'S5 rollback: baseline missing; refusing'; END IF;
  IF (SELECT mode FROM app_private.mis_g7_enforcement WHERE singleton) = 'ENFORCE' THEN   -- the unmigrated core cannot run under ENFORCE
    UPDATE app_private.mis_g7_enforcement SET mode = 'AUDIT', changed_at = clock_timestamp() WHERE singleton;
    INSERT INTO app_private.mis_g7_enforcement_log (from_mode, to_mode, actor, reason)
    VALUES ('ENFORCE', 'AUDIT', '00000000-0000-0000-0000-000000000000', 'S5 rollback: legacy DWL editor protection removed');
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.mis_g7_record_core_migration_acceptance_v1(text,text);
DROP TRIGGER IF EXISTS mis_g7_chain_ticket_must_finish ON app_private.mis_g7_chain_ticket;
DROP FUNCTION IF EXISTS app_private.trg_mis_g7_chain_ticket_must_finish();
DROP FUNCTION IF EXISTS app_private.mis_g7_chain_replace_begin(bigint);
DROP FUNCTION IF EXISTS app_private.mis_g7_chain_replace_finish(bigint);
DROP FUNCTION IF EXISTS app_private.mis_g7_core_gate();
DO $$ DECLARE b record; BEGIN
  FOR b IN SELECT * FROM app_private.mis_g7_s5_baseline ORDER BY obj LOOP EXECUTE b.def; END LOOP;
END $$;

-- ==== S5B ROLLBACK ====
-- Restores the EXACT original live core (sha256 df7290df…6aec) from app_private.mis_g7_s5b_baseline and verifies the hash. The wrapper and the
-- SKU parser were never touched. If ENFORCE is on it is returned to AUDIT (the original core cannot run under ENFORCE) and logged.
-- Run this BEFORE the S5 section (S5 refuses to roll back while the core still calls its primitives).
DO $$
DECLARE b record; v_sha text;
BEGIN
  SELECT * INTO b FROM app_private.mis_g7_s5b_baseline ORDER BY captured_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'S5B rollback: no baseline recorded; refusing'; END IF;
  IF b.def_sha <> 'df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec' THEN RAISE EXCEPTION 'S5B rollback: baseline is not the reviewed live core; refusing'; END IF;
  EXECUTE b.def;
  SELECT encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(b.obj)), 'UTF8')), 'hex') INTO v_sha;
  IF v_sha <> b.def_sha THEN RAISE EXCEPTION 'S5B rollback: restored core hash % differs from baseline %', v_sha, b.def_sha; END IF;
  IF (SELECT mode FROM app_private.mis_g7_enforcement WHERE singleton) = 'ENFORCE' THEN
    UPDATE app_private.mis_g7_enforcement SET mode = 'AUDIT', changed_at = clock_timestamp() WHERE singleton;
    INSERT INTO app_private.mis_g7_enforcement_log (from_mode, to_mode, actor, reason)
    VALUES ('ENFORCE', 'AUDIT', '00000000-0000-0000-0000-000000000000', 'S5B rollback: original DWL editor core restored');
  END IF;
END $$;
