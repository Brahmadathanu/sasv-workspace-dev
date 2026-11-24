-- MIS G7 S3: one shared product_id+exact batch_number transaction lock observed by
-- EVERY writer of public.fg_bulk_stock_ledger (INSERT/UPDATE/DELETE), installed as a
-- common choke point rather than patched into individual writers. This covers:
--   trg_fg_ledger_from_dwl, trg_fg_ledger_from_es, fn_fg_force_close, fn_fg_auto_zero,
--   trg_fg_bulk_internal_transfer_to_ledger (INSERT and UPDATE/DELETE leg rebuild),
--   fn_fg_ledger_add, and direct authenticated DML. No existing function body is replaced:
--   old writer semantics, FKs, base UOM and old-client compatibility are unchanged.
-- Trigger name sorts BEFORE any alphabetic trigger (digits first), so the lock is taken
-- before fn_fg_ledger_check_negative's SUM(): the existing negative guard becomes
-- race-safe because competing writers for one batch now serialize on the lock.
-- Residual (documented): writers that READ balance before their first ledger write
-- (force-close/auto-zero) hold no lock during that read; a concurrent pack that commits
-- in between makes their later insert fail CLOSED via the negative guard (never over-draw).
-- Early-lock wrappers for those need live baselines (S3 TODO). No location gate.
-- Direct-DML grant hardening is NOT in this migration; see
-- supabase/tests/mis_g7/DRAFT_ledger_grant_hardening_NOT_APPLIED.sql.
-- Exact pre-change ACL of the two S2 advisory-lock helpers (S2 left them with the default PUBLIC EXECUTE, so authenticated could call them
-- directly and take arbitrary advisory locks). S3 closes that; the rollback restores exactly this recorded state (captured once).
-- Legitimate callers are unaffected: the S2 sign/correct RPCs and the S3 ledger trigger are SECURITY DEFINER and run as the owner.
CREATE TABLE IF NOT EXISTS app_private.mis_g7_s3_baseline (
  obj text PRIMARY KEY, acl aclitem[], captured_at timestamptz NOT NULL DEFAULT clock_timestamp());
DROP TRIGGER IF EXISTS mis_g7_s3_baseline_append_only ON app_private.mis_g7_s3_baseline;
CREATE TRIGGER mis_g7_s3_baseline_append_only BEFORE UPDATE OR DELETE ON app_private.mis_g7_s3_baseline
  FOR EACH ROW EXECUTE FUNCTION app_private.mis_g7_append_only_guard();
ALTER TABLE app_private.mis_g7_s3_baseline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_g7_s3_baseline FROM PUBLIC, anon, authenticated;
INSERT INTO app_private.mis_g7_s3_baseline (obj, acl)
SELECT p.oid::regprocedure::text, p.proacl FROM pg_proc p
 WHERE p.oid = ANY (ARRAY[to_regprocedure('app_private.mis_lock_fg_batch(integer,text)'), to_regprocedure('app_private.mis_lock_fg_batches(integer,text,integer,text)')]::oid[])
ON CONFLICT (obj) DO NOTHING;
DO $$ BEGIN
  IF (SELECT count(*) FROM app_private.mis_g7_s3_baseline) <> 2 THEN RAISE EXCEPTION 'MIS_G7_S3: S2 lock helpers missing; S2 must be installed first'; END IF;
END $$;

CREATE OR REPLACE FUNCTION app_private.trg_mis_fg_ledger_batch_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $f$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM app_private.mis_lock_fg_batch(NEW.product_id, NEW.batch_number);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM app_private.mis_lock_fg_batch(OLD.product_id, OLD.batch_number);
  ELSE
    PERFORM app_private.mis_lock_fg_batches(OLD.product_id, OLD.batch_number, NEW.product_id, NEW.batch_number);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $f$;
REVOKE ALL ON FUNCTION app_private.trg_mis_fg_ledger_batch_lock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.mis_lock_fg_batch(integer,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.mis_lock_fg_batches(integer,text,integer,text) FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "00_mis_g7_fg_batch_lock" ON public.fg_bulk_stock_ledger;
CREATE TRIGGER "00_mis_g7_fg_batch_lock"
  BEFORE INSERT OR UPDATE OR DELETE ON public.fg_bulk_stock_ledger
  FOR EACH ROW EXECUTE FUNCTION app_private.trg_mis_fg_ledger_batch_lock();
