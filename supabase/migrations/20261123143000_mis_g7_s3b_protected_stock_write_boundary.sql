-- MIS G7 S3b: protected write boundary for FG bulk stock. REQUIRES SEPARATE OWNER AUTHORIZATION.
-- Evidence (independent live review of PR #522): legacy writers trg_fg_ledger_from_dwl,
-- trg_fg_ledger_from_es, trg_fg_bulk_internal_transfer_to_ledger, fn_fg_auto_zero,
-- fn_fg_ledger_add and fn_fg_force_close(integer,text,numeric) are SECURITY INVOKER; authenticated
-- holds INSERT/UPDATE/DELETE on fg_bulk_stock_ledger (broad RLS) and UPDATE/DELETE on
-- event_skus/packaging_events. Revoking ledger DML alone would break those invoker writers, so this
-- migration (1) converts exactly those writers to SECURITY DEFINER (attribute only; bodies, argument
-- lists and search_path are NOT changed; installed pg_get_functiondef hashes WILL change because the
-- attribute is part of the definition -- record new fingerprints), then (2) revokes direct ledger DML,
-- and (3) adds a ticketed gate on event_skus/packaging_events with a switch:
--   AUDIT   (default): old clients keep working; direct bulk-affecting packing writes are LOGGED.
--   ENFORCE (owner flips): direct bulk-affecting event_skus INSERT/UPDATE/DELETE, header reassignment
--           and header delete are denied unless made by mis_pack_fg_bulk_v1 in the same transaction.
-- Signature, search_path and caller-inventory verification fail the install closed.
-- Exact pre-change state (ACLs, secdef flag, pinned config) of every object this migration alters, captured
-- once (obj is the key; a second run never overwrites the original). The rollback replays THIS record, so it
-- is exact whatever the live privileges really were. Insert-only; retained after rollback.
CREATE TABLE IF NOT EXISTS app_private.mis_g7_s3b_baseline (
  obj text PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('function','table')),
  acl aclitem[], secdef boolean, proconfig text[], captured_at timestamptz NOT NULL DEFAULT clock_timestamp());
DROP TRIGGER IF EXISTS mis_g7_s3b_baseline_append_only ON app_private.mis_g7_s3b_baseline;
CREATE TRIGGER mis_g7_s3b_baseline_append_only BEFORE UPDATE OR DELETE ON app_private.mis_g7_s3b_baseline
  FOR EACH ROW EXECUTE FUNCTION app_private.mis_g7_append_only_guard();
ALTER TABLE app_private.mis_g7_s3b_baseline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_g7_s3b_baseline FROM PUBLIC, anon, authenticated;
INSERT INTO app_private.mis_g7_s3b_baseline (obj, kind, acl, secdef, proconfig)
SELECT p.oid::regprocedure::text, 'function', p.proacl, p.prosecdef, p.proconfig FROM pg_proc p
 WHERE p.oid = ANY (ARRAY[to_regprocedure('public.trg_fg_ledger_from_dwl()'), to_regprocedure('public.trg_fg_ledger_from_es()'),
   to_regprocedure('public.trg_fg_bulk_internal_transfer_to_ledger()'), to_regprocedure('public.fn_fg_auto_zero(integer,text,numeric)'),
   to_regprocedure('public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)'),
   to_regprocedure('public.fn_fg_force_close(integer,text,numeric)')]::oid[])
ON CONFLICT (obj) DO NOTHING;
INSERT INTO app_private.mis_g7_s3b_baseline (obj, kind, acl)
SELECT 'public.fg_bulk_stock_ledger', 'table', c.relacl FROM pg_class c WHERE c.oid = 'public.fg_bulk_stock_ledger'::regclass
ON CONFLICT (obj) DO NOTHING;

-- Review correction (PR #522 head 9d6f249): converting a publicly EXECUTABLE writer to SECURITY DEFINER
-- would create a privileged stock-write entrypoint. Therefore this migration ALSO revokes EXECUTE on all six
-- converted writers from PUBLIC/anon/authenticated. Live inventory: no client call site exists for
-- fn_fg_ledger_add / fn_fg_auto_zero (only fn_fg_force_close(integer,text), a definer wrapper that is NOT
-- altered here); trigger functions need no EXECUTE by the invoking role. The install fails closed if any
-- other non-definer function body references the two helpers (an invoker caller would silently break).
DO $$
DECLARE s text; v_callers text; v_cfg text[];
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'public.trg_fg_ledger_from_dwl()','public.trg_fg_ledger_from_es()',
    'public.trg_fg_bulk_internal_transfer_to_ledger()','public.fn_fg_auto_zero(integer,text,numeric)',
    'public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)',
    'public.fn_fg_force_close(integer,text,numeric)'] LOOP
    IF to_regprocedure(s) IS NULL THEN RAISE EXCEPTION 'MIS_G7_S3B: legacy writer % missing; refusing install', s; END IF;
    SELECT proconfig INTO v_cfg FROM pg_proc WHERE oid = to_regprocedure(s);
    IF v_cfg IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(v_cfg) c WHERE c LIKE 'search_path=%') THEN
      RAISE EXCEPTION 'MIS_G7_S3B: % has no pinned search_path; refusing DEFINER conversion', s; END IF;
  END LOOP;
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_callers
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.prokind = 'f' AND NOT p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema')
     AND (p.prosrc ILIKE '%fn_fg_ledger_add%' OR p.prosrc ILIKE '%fn_fg_auto_zero%')
     AND p.oid <> ALL (ARRAY[to_regprocedure('public.fn_fg_auto_zero(integer,text,numeric)'),
                             to_regprocedure('public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)')]::oid[]);
  IF v_callers IS NOT NULL THEN
    RAISE EXCEPTION 'MIS_G7_S3B: invoker functions call revoked helpers: %; review before install', v_callers; END IF;
  -- trg_fg_ledger_from_dwl pins search_path=public ONLY (live): under DEFINER that lets pg_temp objects shadow
  -- public relations. Pin pg_catalog,public,pg_temp (pg_temp last) before elevating.
  ALTER FUNCTION public.trg_fg_ledger_from_dwl() SET search_path = pg_catalog, public, pg_temp;
  FOREACH s IN ARRAY ARRAY[
    'public.trg_fg_ledger_from_dwl()','public.trg_fg_ledger_from_es()',
    'public.trg_fg_bulk_internal_transfer_to_ledger()','public.fn_fg_auto_zero(integer,text,numeric)',
    'public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)',
    'public.fn_fg_force_close(integer,text,numeric)'] LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', s);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', s);
  END LOOP;
END $$;
-- Direct ledger mutation is no longer an authenticated capability (RLS policy kept: it still grants SELECT).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.fg_bulk_stock_ledger FROM PUBLIC, anon, authenticated;   -- original ACL recorded in mis_g7_s3b_baseline

CREATE TABLE IF NOT EXISTS app_private.mis_g7_enforcement (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  mode text NOT NULL DEFAULT 'AUDIT' CHECK (mode IN ('AUDIT','ENFORCE')),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO app_private.mis_g7_enforcement DEFAULT VALUES ON CONFLICT DO NOTHING;
ALTER TABLE app_private.mis_g7_enforcement ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_g7_enforcement FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS app_private.mis_g7_direct_pack_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  op text NOT NULL, tbl text NOT NULL, packaging_event_id bigint, sku_id bigint,
  actor uuid, txid bigint NOT NULL, mode text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp());
DROP TRIGGER IF EXISTS mis_g7_direct_pack_audit_append_only ON app_private.mis_g7_direct_pack_audit;
CREATE TRIGGER mis_g7_direct_pack_audit_append_only BEFORE UPDATE OR DELETE ON app_private.mis_g7_direct_pack_audit
  FOR EACH ROW EXECUTE FUNCTION app_private.mis_g7_append_only_guard();
ALTER TABLE app_private.mis_g7_direct_pack_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_g7_direct_pack_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE app_private.mis_g7_direct_pack_audit_audit_id_seq FROM PUBLIC, anon, authenticated;

-- citext parity: event_type is CITEXT live, so compare WITHOUT ::text casts (case-insensitive, like the legacy trigger).
CREATE OR REPLACE FUNCTION app_private.mis_g7_type_is_bulk(p_type public.citext)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
  SELECT p_type IS NOT NULL AND EXISTS (SELECT 1 FROM public.event_type_lkp l
                 WHERE l.label = p_type AND l.active AND l.is_packaging AND l.affects_bulk_stock <> 0)
$f$;
CREATE OR REPLACE FUNCTION app_private.mis_g7_event_is_bulk(p_event_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
  SELECT app_private.mis_g7_type_is_bulk((SELECT pe.event_type FROM public.packaging_events pe WHERE pe.id = p_event_id))
$f$;

CREATE OR REPLACE FUNCTION app_private.mis_g7_gate_check(p_op text, p_tbl text, p_event_id bigint, p_sku bigint, p_is_bulk boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_mode text;
BEGIN
  IF p_event_id IS NULL OR NOT coalesce(p_is_bulk, false) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM app_private.mis_g7_pack_ticket WHERE txid = txid_current() AND packaging_event_id = p_event_id) THEN RETURN; END IF;
  SELECT mode INTO v_mode FROM app_private.mis_g7_enforcement WHERE singleton;
  v_mode := coalesce(v_mode, 'ENFORCE');                      -- missing config fails closed
  IF v_mode = 'ENFORCE' THEN
    RAISE EXCEPTION 'MIS_G7_DIRECT_PACKING_DENIED: % on % for packaging_event % must use mis_pack_fg_bulk_v1', p_op, p_tbl, p_event_id
      USING ERRCODE = '42501';
  END IF;
  INSERT INTO app_private.mis_g7_direct_pack_audit(op, tbl, packaging_event_id, sku_id, actor, txid, mode)
  VALUES (p_op, p_tbl, p_event_id, p_sku, auth.uid(), txid_current(), v_mode);
END $f$;

CREATE OR REPLACE FUNCTION app_private.trg_mis_g7_event_skus_gate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    PERFORM app_private.mis_g7_gate_check(TG_OP, 'event_skus', OLD.packaging_event_id, OLD.sku_id, app_private.mis_g7_event_is_bulk(OLD.packaging_event_id)); END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND (TG_OP = 'INSERT' OR NEW.packaging_event_id IS DISTINCT FROM OLD.packaging_event_id) THEN
    PERFORM app_private.mis_g7_gate_check(TG_OP, 'event_skus', NEW.packaging_event_id, NEW.sku_id, app_private.mis_g7_event_is_bulk(NEW.packaging_event_id)); END IF;
  RETURN COALESCE(NEW, OLD);
END $f$;

-- Header gate evaluates BOTH the OLD and the NEW event type: retyping a header that already carries SKU
-- lines from non-bulk to bulk (or back) would make the legacy es trigger compute UPDATE/DELETE deltas
-- against a ledger that never received the original depletion (fabricated stock). Header creation itself
-- carries no ledger effect until lines exist and is therefore not gated (see README).
CREATE OR REPLACE FUNCTION app_private.trg_mis_g7_packaging_events_gate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_old_bulk boolean; v_new_bulk boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM public.event_skus WHERE packaging_event_id = OLD.id) THEN
    v_old_bulk := app_private.mis_g7_type_is_bulk(OLD.event_type);
    IF TG_OP = 'DELETE' THEN
      PERFORM app_private.mis_g7_gate_check(TG_OP, 'packaging_events', OLD.id, NULL, v_old_bulk);
    ELSIF NEW.work_log_id IS DISTINCT FROM OLD.work_log_id OR NEW.event_type IS DISTINCT FROM OLD.event_type THEN
      v_new_bulk := app_private.mis_g7_type_is_bulk(NEW.event_type);
      PERFORM app_private.mis_g7_gate_check(TG_OP, 'packaging_events', OLD.id, NULL, v_old_bulk OR v_new_bulk);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_type_is_bulk(public.citext), app_private.mis_g7_event_is_bulk(bigint),
  app_private.mis_g7_gate_check(text,text,bigint,bigint,boolean),
  app_private.trg_mis_g7_event_skus_gate(), app_private.trg_mis_g7_packaging_events_gate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "00_mis_g7_event_skus_gate" ON public.event_skus;
CREATE TRIGGER "00_mis_g7_event_skus_gate" BEFORE INSERT OR UPDATE OR DELETE ON public.event_skus
  FOR EACH ROW EXECUTE FUNCTION app_private.trg_mis_g7_event_skus_gate();
DROP TRIGGER IF EXISTS "00_mis_g7_packaging_events_gate" ON public.packaging_events;
CREATE TRIGGER "00_mis_g7_packaging_events_gate" BEFORE UPDATE OR DELETE ON public.packaging_events
  FOR EACH ROW EXECUTE FUNCTION app_private.trg_mis_g7_packaging_events_gate();
