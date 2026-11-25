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
  acl aclitem[], secdef boolean, proconfig text[], def text, def_sha text, captured_at timestamptz NOT NULL DEFAULT clock_timestamp());
DROP TRIGGER IF EXISTS mis_g7_s3b_baseline_append_only ON app_private.mis_g7_s3b_baseline;
CREATE TRIGGER mis_g7_s3b_baseline_append_only BEFORE UPDATE OR DELETE ON app_private.mis_g7_s3b_baseline
  FOR EACH ROW EXECUTE FUNCTION app_private.mis_g7_append_only_guard();
ALTER TABLE app_private.mis_g7_s3b_baseline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_g7_s3b_baseline FROM PUBLIC, anon, authenticated;
-- Full pre-change function source + SHA-256 are persisted too (immutable deployment packet). Scope = the six
-- writers PLUS the reconcile chain discovered by the independent review: fn_fg_reconcile_batch, the three
-- statement-level triggers that call it, AND fn_fg_mark_done_if_zero (authenticated-callable invoker edge into the
-- reconciler, found by the pre-install read-only run against production).
INSERT INTO app_private.mis_g7_s3b_baseline (obj, kind, acl, secdef, proconfig, def, def_sha)
SELECT p.oid::regprocedure::text, 'function', p.proacl, p.prosecdef, p.proconfig, pg_get_functiondef(p.oid),
       encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex')
  FROM pg_proc p WHERE p.oid = ANY (ARRAY[to_regprocedure('public.trg_fg_ledger_from_dwl()'), to_regprocedure('public.trg_fg_ledger_from_es()'),
   to_regprocedure('public.trg_fg_bulk_internal_transfer_to_ledger()'), to_regprocedure('public.fn_fg_auto_zero(integer,text,numeric)'),
   to_regprocedure('public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)'),
   to_regprocedure('public.fn_fg_force_close(integer,text,numeric)'),
   to_regprocedure('public.fn_fg_reconcile_batch(integer,text,numeric)'),
   to_regprocedure('public.trg_fg_ledger_reconcile_ins_stmt()'), to_regprocedure('public.trg_fg_ledger_reconcile_upd_stmt()'),
   to_regprocedure('public.trg_fg_ledger_reconcile_del_stmt()'),
   to_regprocedure('public.fn_fg_mark_done_if_zero(integer,text,numeric)')]::oid[])
ON CONFLICT (obj) DO NOTHING;
INSERT INTO app_private.mis_g7_s3b_baseline (obj, kind, acl)
SELECT 'public.fg_bulk_stock_ledger', 'table', c.relacl FROM pg_class c WHERE c.oid = 'public.fg_bulk_stock_ledger'::regclass
ON CONFLICT (obj) DO NOTHING;

-- Live fingerprints (SHA-256 of pg_get_functiondef, independent READ ONLY review of PR #522 @ e938b557, before S3b).
-- The install FAILS CLOSED unless every listed function still hashes to its reviewed value (11 functions).
CREATE TABLE IF NOT EXISTS app_private.mis_g7_s3b_expected_sha (
  obj text PRIMARY KEY, sha text NOT NULL CHECK (sha ~ '^[0-9a-f]{64}$'));
ALTER TABLE app_private.mis_g7_s3b_expected_sha ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_g7_s3b_expected_sha FROM PUBLIC, anon, authenticated;
INSERT INTO app_private.mis_g7_s3b_expected_sha (obj, sha) VALUES
 ('fn_fg_auto_zero(integer,text,numeric)','705fecd3e68576272af73b5230737c98689c9f538d88e40d723a5b935ae5a582'),
 ('fn_fg_force_close(integer,text,numeric)','c48578e7e08d311aebdefdaaf512bbfe2a87daecf61c2bde735f46d1e7cff10d'),
 ('fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)','9b9a1a4975679358a2628f3e598a75a2a4b0ac658173da9f6f1950cdd6629675'),
 ('trg_fg_bulk_internal_transfer_to_ledger()','6adab6d8180d2d0f15f8415acd51403691cc6f64c58b549b71ce386e6faa69c5'),
 ('trg_fg_ledger_from_dwl()','ffe12985b5e7c135766655c4893a886adc2d1a36bd6a181c80cd185649c2eec1'),
 ('trg_fg_ledger_from_es()','cc32357d320fb63278632c5726085bdcf6b32395453838d39cac8c3584faed28'),
 ('trg_fg_ledger_reconcile_ins_stmt()','d4cdfe3dbc827d0e14122fe41993981e65b4903bd18d8da3d0013fd730cc2412'),
 ('trg_fg_ledger_reconcile_upd_stmt()','a298bcff5a7fede05d59c4d77c4673fd4fe5db2f5609914cb900dedfbf6b5f7b'),
 ('trg_fg_ledger_reconcile_del_stmt()','d09789baea588ff64d78e9b787ae769a4dff2df9f307547bfcdedd562cb995ad'),
 ('fn_fg_reconcile_batch(integer,text,numeric)','b229faad84f128420eb61caae3fb0678b15772d22b0d13f416c0332a92b9a7be'),
 ('fn_fg_mark_done_if_zero(integer,text,numeric)','278f4fdc43cc5886b57995407d6cc5cdc52404362fb0135ab19aedd440cacb6a')
ON CONFLICT (obj) DO NOTHING;

-- Review correction (PR #522 head 9d6f249): converting a publicly EXECUTABLE writer to SECURITY DEFINER
-- would create a privileged stock-write entrypoint. Therefore this migration ALSO revokes EXECUTE on all six
-- converted writers from PUBLIC/anon/authenticated. Live inventory: no client call site exists for
-- fn_fg_ledger_add / fn_fg_auto_zero (only fn_fg_force_close(integer,text), a definer wrapper that is NOT
-- altered here); trigger functions need no EXECUTE by the invoking role. The install fails closed if any
-- other non-definer function body references the two helpers (an invoker caller would silently break).
-- Resolved-graph precheck (review of e938b557): the reconcile chain
--   3 statement triggers (trg_fg_ledger_reconcile_{ins,upd,del}_stmt, SECURITY INVOKER, authenticated EXECUTE)
--     -> fn_fg_reconcile_batch (SECURITY INVOKER, EXECUTE postgres+service_role only)
--       -> fn_fg_auto_zero (+ guarded transaction-local Done marking)
-- would run as the DML user and break once EXECUTE on fn_fg_auto_zero is revoked. Resolution implemented here:
-- convert the whole chain to SECURITY DEFINER (owner context, pinned search_path, bodies untouched) so automatic
-- reconciliation + governed Done marking keep working for every writer, while EXECUTE on the privileged helpers
-- stays closed to clients. fn_fg_reconcile_batch's own ACL is NOT changed (must already exclude clients).
DO $$
DECLARE s text; v_callers text; v_cfg text[]; v_bad text; v_oid oid; v_md text := 'public.fn_fg_mark_done_if_zero(integer,text,numeric)';
  v_chain text[] := ARRAY[
    'public.trg_fg_ledger_from_dwl()','public.trg_fg_ledger_from_es()',
    'public.trg_fg_bulk_internal_transfer_to_ledger()','public.fn_fg_auto_zero(integer,text,numeric)',
    'public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)',
    'public.fn_fg_force_close(integer,text,numeric)','public.fn_fg_reconcile_batch(integer,text,numeric)',
    'public.trg_fg_ledger_reconcile_ins_stmt()','public.trg_fg_ledger_reconcile_upd_stmt()','public.trg_fg_ledger_reconcile_del_stmt()'];
  v_closed text[] := ARRAY[   -- EXECUTE revoked from clients (everything in the chain except the reconciler, whose ACL is kept)
    'public.trg_fg_ledger_from_dwl()','public.trg_fg_ledger_from_es()',
    'public.trg_fg_bulk_internal_transfer_to_ledger()','public.fn_fg_auto_zero(integer,text,numeric)',
    'public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)',
    'public.fn_fg_force_close(integer,text,numeric)',
    'public.trg_fg_ledger_reconcile_ins_stmt()','public.trg_fg_ledger_reconcile_upd_stmt()','public.trg_fg_ledger_reconcile_del_stmt()'];
BEGIN
  FOREACH s IN ARRAY v_chain LOOP
    IF to_regprocedure(s) IS NULL THEN RAISE EXCEPTION 'MIS_G7_S3B: chain function % missing; refusing install', s; END IF;
    SELECT proconfig INTO v_cfg FROM pg_proc WHERE oid = to_regprocedure(s);
    IF v_cfg IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(v_cfg) c WHERE c LIKE 'search_path=%') THEN
      RAISE EXCEPTION 'MIS_G7_S3B: % has no pinned search_path; refusing DEFINER conversion', s; END IF;
  END LOOP;
  -- reviewed fingerprints must still match
  SELECT string_agg(e.obj || ' live=' || coalesce(encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.' || e.obj)), 'UTF8')), 'hex'), 'MISSING'), '; ')
    INTO v_bad FROM app_private.mis_g7_s3b_expected_sha e
   WHERE coalesce(encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.' || e.obj)), 'UTF8')), 'hex'), '') <> e.sha;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'MIS_G7_S3B: live function fingerprint mismatch (definitions changed since review): %', v_bad; END IF;
  -- fn_fg_mark_done_if_zero: SECURITY INVOKER, authenticated+service_role EXECUTE, calls the reconciler directly.
  -- It cannot be left as is (it would break once the chain runs as owner) and cannot simply become DEFINER with its
  -- client EXECUTE (any authenticated caller could then trigger stock auto-zero with a caller-chosen epsilon).
  IF to_regprocedure(v_md) IS NULL THEN RAISE EXCEPTION 'MIS_G7_S3B: % missing; refusing install', v_md; END IF;
  SELECT proconfig INTO v_cfg FROM pg_proc WHERE oid = to_regprocedure(v_md);
  IF v_cfg IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(v_cfg) c WHERE c LIKE 'search_path=%') THEN
    RAISE EXCEPTION 'MIS_G7_S3B: % has no pinned search_path; refusing', v_md; END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure(v_md)) THEN
    RAISE EXCEPTION 'MIS_G7_S3B: % is already SECURITY DEFINER; unexpected state', v_md; END IF;
  IF (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure(v_md)) NOT ILIKE '%fn_fg_reconcile_batch%' THEN
    RAISE EXCEPTION 'MIS_G7_S3B: % no longer references the reconciler; re-review', v_md; END IF;
  IF to_regprocedure('public.fn_fg_eps_default()') IS NULL THEN
    RAISE EXCEPTION 'MIS_G7_S3B: public.fn_fg_eps_default() missing; the mark-done wrapper bounds epsilon by it'; END IF;
  IF (SELECT public.fn_fg_eps_default()) IS NULL OR (SELECT public.fn_fg_eps_default()) <= 0 THEN
    RAISE EXCEPTION 'MIS_G7_S3B: fn_fg_eps_default() must return a positive numeric'; END IF;
  IF to_regprocedure('public.fn_fg_mark_done_if_zero_legacy(integer,text,numeric)') IS NOT NULL THEN
    RAISE EXCEPTION 'MIS_G7_S3B: fn_fg_mark_done_if_zero_legacy already exists; refusing rename'; END IF;
  -- the reconciler must not already be client-executable (we never widen it)
  v_oid := to_regprocedure('public.fn_fg_reconcile_batch(integer,text,numeric)');
  IF has_function_privilege('authenticated', v_oid, 'EXECUTE') OR has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('public'::name, v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'MIS_G7_S3B: fn_fg_reconcile_batch is executable by a client role; resolve before install'; END IF;
  -- the three reconcile triggers must be the statement-level ledger triggers that reach the reconciler
  FOREACH s IN ARRAY ARRAY['public.trg_fg_ledger_reconcile_ins_stmt()','public.trg_fg_ledger_reconcile_upd_stmt()','public.trg_fg_ledger_reconcile_del_stmt()'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgfoid = to_regprocedure(s) AND t.tgrelid = 'public.fg_bulk_stock_ledger'::regclass
                    AND NOT t.tgisinternal AND (t.tgtype & 1) = 0) THEN
      RAISE EXCEPTION 'MIS_G7_S3B: % is not an installed statement-level trigger on fg_bulk_stock_ledger', s; END IF;
  END LOOP;
  -- every OTHER non-definer function that references a chain entrypoint would silently break: refuse
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_callers
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.prokind = 'f' AND NOT p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema')
     AND (p.prosrc ILIKE '%fn_fg_ledger_add%' OR p.prosrc ILIKE '%fn_fg_auto_zero%' OR p.prosrc ILIKE '%fn_fg_reconcile_batch%'
          OR p.prosrc ILIKE '%fn_fg_mark_done_if_zero%')
     AND p.oid <> ALL (SELECT to_regprocedure(c)::oid FROM unnest(v_chain || v_md) c);   -- v_chain already contains fn_fg_force_close(integer,text,numeric)
  IF v_callers IS NOT NULL THEN
    RAISE EXCEPTION 'MIS_G7_S3B: invoker functions call revoked helpers: %; review before install', v_callers; END IF;
  -- trg_fg_ledger_from_dwl pins search_path=public ONLY (live): under DEFINER that lets pg_temp objects shadow
  -- public relations. Pin pg_catalog,public,pg_temp (pg_temp last) before elevating.
  ALTER FUNCTION public.trg_fg_ledger_from_dwl() SET search_path = pg_catalog, public, pg_temp;
  FOREACH s IN ARRAY v_chain LOOP EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', s); END LOOP;
  FOREACH s IN ARRAY v_closed LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', s); END LOOP;
  -- mark_done_if_zero: keep the proven body as a CLOSED private implementation (DEFINER, owner + service_role only, so the
  -- trusted service_role path keeps its exact capability) and re-publish the original name/signature as a narrow wrapper.
  ALTER FUNCTION public.fn_fg_mark_done_if_zero(integer,text,numeric) RENAME TO fn_fg_mark_done_if_zero_legacy;
  ALTER FUNCTION public.fn_fg_mark_done_if_zero_legacy(integer,text,numeric) SECURITY DEFINER;
  REVOKE ALL ON FUNCTION public.fn_fg_mark_done_if_zero_legacy(integer,text,numeric) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.fn_fg_mark_done_if_zero_legacy(integer,text,numeric) TO service_role;
END $$;

-- Narrow, permission-checked public entrypoint (same name, argument list and void return as the live function).
-- Authorization: the trusted service_role database role, or an authenticated user passing the SAME canonical permission
-- as the installed fn_fg_force_close(integer,text) wrapper: public.require_permission('module:fg-bulk-stock', true)
-- (verified live by the independent review). Epsilon policy: a non-NULL caller epsilon must lie in [0, fn_fg_eps_default()]
-- (live default 0.01), i.e. the existing system threshold is preserved (nothing narrower than the live default is imposed)
-- while a caller can still not zero a meaningful balance by passing a huge epsilon. NULL is forwarded unchanged so legacy
-- NULL behavior is identical (NULL can never widen the zeroing threshold). The batch lock is taken first, like every other
-- writer; stage/stock rules are untouched (no excess, no receipts, no signing).

CREATE OR REPLACE FUNCTION public.fn_fg_mark_done_if_zero(p_product_id integer, p_batch_number text, p_eps numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
BEGIN
  -- MIS_G7_MARK_DONE_WRAPPER (marker used by the rollback script)
  -- Trusted service path is the ACTUAL database role (SET ROLE, which a non-member cannot forge), never a JWT-claim GUC.
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
    PERFORM public.require_permission('module:fg-bulk-stock', true);
  END IF;
  IF p_product_id IS NULL OR p_batch_number IS NULL OR btrim(p_batch_number) = '' THEN
    RAISE EXCEPTION 'MIS_G7_INVALID_INPUT' USING ERRCODE = '22023'; END IF;
  IF p_eps IS NOT NULL AND (p_eps < 0 OR p_eps > public.fn_fg_eps_default()) THEN
    RAISE EXCEPTION 'MIS_G7_EPS_OUT_OF_RANGE: epsilon must be between 0 and fn_fg_eps_default() (%)', public.fn_fg_eps_default() USING ERRCODE = '22023'; END IF;
  PERFORM app_private.mis_lock_fg_batch(p_product_id, p_batch_number);
  PERFORM public.fn_fg_mark_done_if_zero_legacy(p_product_id, p_batch_number, p_eps);
END $f$;
REVOKE ALL ON FUNCTION public.fn_fg_mark_done_if_zero(integer,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_fg_mark_done_if_zero(integer,text,numeric) TO authenticated, service_role;
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

-- Parity with the legacy trigger: event_type is CITEXT live and event_type_lkp.label is TEXT; `label = event_type` resolves to text = text (case-sensitive),
-- so the gate compares the SAME way. The parameter is plain text on purpose: the citext type lives in schema `extensions` in production (not `public`),
-- and a citext argument is implicitly cast to text, so no schema-qualified citext type is referenced.
CREATE OR REPLACE FUNCTION app_private.mis_g7_type_is_bulk(p_type text)
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
REVOKE ALL ON FUNCTION app_private.mis_g7_type_is_bulk(text), app_private.mis_g7_event_is_bulk(bigint),
  app_private.mis_g7_gate_check(text,text,bigint,bigint,boolean),
  app_private.trg_mis_g7_event_skus_gate(), app_private.trg_mis_g7_packaging_events_gate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "00_mis_g7_event_skus_gate" ON public.event_skus;
CREATE TRIGGER "00_mis_g7_event_skus_gate" BEFORE INSERT OR UPDATE OR DELETE ON public.event_skus
  FOR EACH ROW EXECUTE FUNCTION app_private.trg_mis_g7_event_skus_gate();
DROP TRIGGER IF EXISTS "00_mis_g7_packaging_events_gate" ON public.packaging_events;
CREATE TRIGGER "00_mis_g7_packaging_events_gate" BEFORE UPDATE OR DELETE ON public.packaging_events
  FOR EACH ROW EXECUTE FUNCTION app_private.trg_mis_g7_packaging_events_gate();
