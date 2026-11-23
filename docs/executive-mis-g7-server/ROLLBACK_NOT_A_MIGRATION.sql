-- Rollback for MIS G7 S2-S4 migrations. NOT in supabase/migrations. Owner-authorized use only.
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
