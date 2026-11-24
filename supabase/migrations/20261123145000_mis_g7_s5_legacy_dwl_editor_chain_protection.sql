-- MIS G7 S5: protected integration for the governed legacy DWL editor (rpc_update_daily_work_log_with_packaging
-- and its SECURITY DEFINER __core, which DELETES the work log's event_skus and packaging_events header(s) and RECREATES
-- them from sku_breakdown, deletes the whole chain when the row stops being Done/packaging, applies governed FG source
-- quantity deltas and reconciles). INSTALLABLE CODE ONLY; depends on S2..S4b. Not applied anywhere.
--
-- WHAT THIS DOES NOT DO: it does not modify the live core and does not "ticket around" it. The exact live source (core sha256
-- df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec) is retained in
-- docs/executive-mis-g7-server/LIVE_DWL_EDITOR_REFERENCE_ONLY_20261124.md; the minimal patch that calls the primitives below is the
-- separate OWNER-GATED migration S5b (…146000). A general-purpose caller ticket would let the old editor bypass signed-stage
-- authorization; instead this migration
-- provides two PRIVATE primitives a reviewed core calls (begin before its first write, finish after its last write):
--   begin  : batch lock, snapshot of the chain's current lines, a work-log-scoped ticket that the event_skus/packaging_events
--            gate honours ONLY for that work log, in this transaction.
--   finish : verifies (a) when any bulk-affecting line exists before or after the edit: signed + un-drifted FG stage,
--            (b) FG stock conservation: the ledger movements of ALL old and new lines of the chain net to exactly the
--            depletion implied by the new lines (so deleting a line that was never depleted -- the historical missing
--            depletion class -- cannot manufacture stock), (c) balance >= 0. Under ENFORCE any violation raises and the whole
--            edit rolls back atomically; under AUDIT (default) it is only recorded in app_private.mis_g7_direct_pack_audit
--            (tbl='chain_replace') and the legacy behavior proceeds unchanged. The identity change of the work log (item/batch)
--            is verified per identity. A DEFERRED constraint trigger refuses to COMMIT a ticket that was never finished,
--            so a migrated core cannot skip the verification.
-- ENFORCE stays impossible (fail closed) until the live core demonstrably calls both primitives AND an owner sign-off
-- is recorded for the core's exact current SHA-256 (separate permission target):
--   module:mis-g7-core-migration-signoff   (owner assigns; not granted here)
-- Expected live facts (independent review): wrapper is SECURITY DEFINER and requires module:edit-log-entry (edit); __core is
-- SECURITY DEFINER and not executable by authenticated. The core owner must be able to EXECUTE the private primitives
-- (they are owned by the migration role; if the core has another owner, GRANT EXECUTE to that role explicitly).
CREATE TABLE IF NOT EXISTS app_private.mis_g7_chain_ticket (
  txid bigint NOT NULL, work_log_id bigint NOT NULL, product_id integer, batch_number text,
  old_line_ids bigint[] NOT NULL DEFAULT '{}', old_bulk boolean NOT NULL DEFAULT false,
  begun_at timestamptz NOT NULL DEFAULT clock_timestamp(), finished_at timestamptz,
  PRIMARY KEY (txid, work_log_id));
CREATE TABLE IF NOT EXISTS app_private.mis_g7_core_migration_acceptance (
  acceptance_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  core_sha text NOT NULL UNIQUE CHECK (core_sha ~ '^[0-9a-f]{64}$'),
  evidence_ref text NOT NULL CHECK (length(btrim(evidence_ref)) > 0),
  accepted_by uuid NOT NULL, accepted_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE IF NOT EXISTS app_private.mis_g7_s5_baseline (
  obj text PRIMARY KEY, def text NOT NULL, def_sha text NOT NULL, captured_at timestamptz NOT NULL DEFAULT clock_timestamp());
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['mis_g7_chain_ticket','mis_g7_core_migration_acceptance','mis_g7_s5_baseline'] LOOP
    EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE app_private.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['mis_g7_core_migration_acceptance','mis_g7_s5_baseline'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON app_private.%I', t||'_append_only', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON app_private.%I FOR EACH ROW EXECUTE FUNCTION app_private.mis_g7_append_only_guard()', t||'_append_only', t);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE app_private.mis_g7_core_migration_acceptance_acceptance_id_seq FROM PUBLIC, anon, authenticated;

-- Exact pre-change definitions of the three private/public functions this migration replaces (rollback replays them).
INSERT INTO app_private.mis_g7_s5_baseline (obj, def, def_sha)
SELECT p.oid::regprocedure::text, pg_get_functiondef(p.oid), encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex')
  FROM pg_proc p WHERE p.oid = ANY (ARRAY[to_regprocedure('app_private.mis_g7_gate_check(text,text,bigint,bigint,boolean)'),
        to_regprocedure('public.mis_g7_set_enforcement_v1(text,text)'), to_regprocedure('public.mis_g7_enforcement_readiness_v1(integer)')]::oid[])
ON CONFLICT (obj) DO NOTHING;
DO $$ BEGIN
  IF (SELECT count(*) FROM app_private.mis_g7_s5_baseline) <> 3 THEN
    RAISE EXCEPTION 'MIS_G7_S5: S3b/S4b objects missing; apply S3b and S4b first'; END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Gate: additionally honour a work-log-scoped chain ticket (header must still exist: the core deletes lines before the header).
CREATE OR REPLACE FUNCTION app_private.mis_g7_gate_check(p_op text, p_tbl text, p_event_id bigint, p_sku bigint, p_is_bulk boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_mode text;
BEGIN
  IF p_event_id IS NULL OR NOT coalesce(p_is_bulk, false) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM app_private.mis_g7_pack_ticket WHERE txid = txid_current() AND packaging_event_id = p_event_id) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM app_private.mis_g7_chain_ticket t JOIN public.packaging_events pe ON pe.work_log_id = t.work_log_id
              WHERE t.txid = txid_current() AND t.finished_at IS NULL AND pe.id = p_event_id) THEN RETURN; END IF;
  SELECT mode INTO v_mode FROM app_private.mis_g7_enforcement WHERE singleton;
  v_mode := coalesce(v_mode, 'ENFORCE');                      -- missing config fails closed
  IF v_mode = 'ENFORCE' THEN
    RAISE EXCEPTION 'MIS_G7_DIRECT_PACKING_DENIED: % on % for packaging_event % must use mis_pack_fg_bulk_v1', p_op, p_tbl, p_event_id
      USING ERRCODE = '42501';
  END IF;
  INSERT INTO app_private.mis_g7_direct_pack_audit(op, tbl, packaging_event_id, sku_id, actor, txid, mode)
  VALUES (p_op, p_tbl, p_event_id, p_sku, auth.uid(), txid_current(), v_mode);
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_gate_check(text,text,bigint,bigint,boolean) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private primitives for a reviewed core (closed to every client role).
CREATE OR REPLACE FUNCTION app_private.mis_g7_chain_replace_begin(p_work_log_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_wl record; v_ids bigint[]; v_bulk boolean;
BEGIN
  IF p_work_log_id IS NULL THEN RAISE EXCEPTION 'MIS_G7_CHAIN_INVALID_WORK_LOG' USING ERRCODE = '22023'; END IF;
  SELECT wl.id, wl.batch_number, p.id AS pid INTO v_wl
    FROM public.daily_work_log wl LEFT JOIN public.products p ON p.item = wl.item WHERE wl.id = p_work_log_id;
  IF v_wl.id IS NOT NULL AND v_wl.pid IS NOT NULL AND coalesce(btrim(v_wl.batch_number), '') <> '' THEN
    PERFORM app_private.mis_lock_fg_batch(v_wl.pid, v_wl.batch_number);          -- same lock order as every writer
  END IF;
  SELECT coalesce(array_agg(es.id ORDER BY es.id), '{}'), coalesce(bool_or(app_private.mis_g7_type_is_bulk(pe.event_type)), false)
    INTO v_ids, v_bulk
    FROM public.event_skus es JOIN public.packaging_events pe ON pe.id = es.packaging_event_id WHERE pe.work_log_id = p_work_log_id;
  INSERT INTO app_private.mis_g7_chain_ticket (txid, work_log_id, product_id, batch_number, old_line_ids, old_bulk)
  VALUES (txid_current(), p_work_log_id, v_wl.pid, v_wl.batch_number, v_ids, v_bulk) ON CONFLICT DO NOTHING;
END $f$;

-- Violations of the chain rules: ENFORCE (or a missing mode row: fail closed) raises and rolls the whole edit back; AUDIT only RECORDS the
-- violation in the append-only audit log and lets the legacy behavior proceed (AUDIT = observation, old clients unchanged).
ALTER TABLE app_private.mis_g7_direct_pack_audit ADD COLUMN IF NOT EXISTS detail text;
CREATE OR REPLACE FUNCTION app_private.mis_g7_chain_violation(p_code text, p_work_log_id bigint, p_detail text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_mode text;
BEGIN
  SELECT mode INTO v_mode FROM app_private.mis_g7_enforcement WHERE singleton;
  IF coalesce(v_mode, 'ENFORCE') = 'ENFORCE' THEN
    RAISE EXCEPTION 'MIS_G7_%: %', p_code, p_detail USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO app_private.mis_g7_direct_pack_audit(op, tbl, packaging_event_id, sku_id, actor, txid, mode, detail)
  VALUES (p_code, 'chain_replace', NULL, NULL, auth.uid(), txid_current(), v_mode, 'work_log ' || p_work_log_id || ': ' || p_detail);
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_chain_violation(text,bigint,text) FROM PUBLIC, anon, authenticated;

-- Stage state for ONE product/batch identity: NULL = signed and un-drifted FG_BULK stage, otherwise the violation code.
CREATE OR REPLACE FUNCTION app_private.mis_g7_stage_problem(p_product_id integer, p_batch text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_stage bigint; v_se record; v_fpnow text;
BEGIN
  IF p_product_id IS NULL OR coalesce(btrim(p_batch), '') = '' THEN RETURN 'CHAIN_BATCH_IDENTITY_MISSING'; END IF;
  SELECT s.event_id INTO v_stage FROM app_private.mis_batch_stage_event s
   WHERE s.event_kind = 'SIGN' AND s.product_id = p_product_id AND s.batch_number = p_batch AND s.stage_role = 'FG_BULK'
     AND NOT EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event c WHERE c.event_kind = 'CORRECTION' AND c.corrects_event_id = s.event_id)
   ORDER BY s.event_id DESC LIMIT 1;
  IF v_stage IS NULL THEN RETURN 'CHAIN_STAGE_NOT_SIGNED'; END IF;
  SELECT s.source_fingerprint, s.work_log_id AS wl, s.route_step_id AS stp, s.step_occurrence AS occ INTO v_se
    FROM app_private.mis_batch_stage_event s WHERE s.event_id = v_stage;
  v_fpnow := app_private.mis_stage_fp(p_product_id, p_batch, v_se.wl, v_se.stp, v_se.occ);
  IF v_fpnow IS NULL OR v_fpnow <> v_se.source_fingerprint THEN RETURN 'CHAIN_STAGE_SOURCE_CHANGED'; END IF;
  RETURN NULL;
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_stage_problem(integer,text) FROM PUBLIC, anon, authenticated;

-- Net FG ledger effect, for one product/batch identity, of every movement ever sourced from the given event_skus ids.
CREATE OR REPLACE FUNCTION app_private.mis_g7_chain_net(p_product_id integer, p_batch text, p_ids bigint[])
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
  SELECT coalesce(sum(qty_base), 0) FROM public.fg_bulk_stock_ledger
   WHERE source_table = 'event_skus' AND source_id = ANY (ARRAY(SELECT x::int FROM unnest(p_ids) x))
     AND product_id = p_product_id AND batch_number = p_batch
$f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_chain_net(integer,text,bigint[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.mis_g7_chain_replace_finish(p_work_log_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE
  t app_private.mis_g7_chain_ticket; v_ln record; v_sku record; v_new record; v_prod record; v_lkp record; v_base_per numeric;
  v_required numeric := 0; v_any_new_bulk boolean := false; v_ids bigint[]; v_same boolean; v_bal numeric; v_calc_ok boolean := true; v_prob text; v_net numeric;
BEGIN
  SELECT * INTO t FROM app_private.mis_g7_chain_ticket WHERE txid = txid_current() AND work_log_id = p_work_log_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MIS_G7_CHAIN_REPLACE_NOT_BEGUN: work log %', p_work_log_id USING ERRCODE = 'P0001'; END IF;
  IF t.finished_at IS NOT NULL THEN RETURN; END IF;
  -- The editor may change the work log's item/batch identity: lines are always created under the identity AFTER the edit,
  -- the old chain was consumed under the identity captured by begin. Both are verified.
  SELECT p.id AS pid, wl.batch_number AS bn INTO v_new FROM public.daily_work_log wl LEFT JOIN public.products p ON p.item = wl.item WHERE wl.id = p_work_log_id;
  v_same := (t.product_id IS NOT DISTINCT FROM v_new.pid) AND (t.batch_number IS NOT DISTINCT FROM v_new.bn);
  SELECT p.id, p.uom_base, p.conversion_to_base INTO v_prod FROM public.products p WHERE p.id = v_new.pid;
  v_ids := t.old_line_ids;
  FOR v_ln IN SELECT es.id, es.sku_id, es."count" AS cnt, pe.event_type FROM public.event_skus es
                JOIN public.packaging_events pe ON pe.id = es.packaging_event_id WHERE pe.work_log_id = p_work_log_id ORDER BY es.id LOOP
    v_ids := v_ids || v_ln.id;
    IF NOT app_private.mis_g7_type_is_bulk(v_ln.event_type) THEN CONTINUE; END IF;
    v_any_new_bulk := true;
    IF v_prod.id IS NULL THEN PERFORM app_private.mis_g7_chain_violation('CHAIN_BATCH_IDENTITY_MISSING', p_work_log_id, 'no product for the work log item'); v_calc_ok := false; CONTINUE; END IF;
    SELECT label, affects_bulk_stock INTO v_lkp FROM public.event_type_lkp WHERE label = v_ln.event_type AND active;
    IF v_lkp.affects_bulk_stock > 0 THEN PERFORM app_private.mis_g7_chain_violation('CHAIN_EVENT_NOT_DEPLETING', p_work_log_id, 'line ' || v_ln.id); v_calc_ok := false; CONTINUE; END IF;
    SELECT id, product_id, pack_size, uom INTO v_sku FROM public.product_skus WHERE id = v_ln.sku_id;
    IF v_sku.id IS NULL OR v_sku.product_id <> v_prod.id OR v_sku.pack_size IS NULL OR v_sku.pack_size <= 0 THEN
      PERFORM app_private.mis_g7_chain_violation('CHAIN_SKU_INVALID', p_work_log_id, 'line ' || v_ln.id || ' sku ' || v_ln.sku_id); v_calc_ok := false; CONTINUE; END IF;
    IF v_sku.uom = v_prod.uom_base THEN v_base_per := v_sku.pack_size;   -- exact comparison, identical to trg_fg_ledger_from_es
    ELSE
      IF v_prod.conversion_to_base IS NULL OR v_prod.conversion_to_base <= 0 THEN
        PERFORM app_private.mis_g7_chain_violation('CHAIN_SKU_INVALID', p_work_log_id, 'conversion for sku ' || v_ln.sku_id); v_calc_ok := false; CONTINUE; END IF;
      v_base_per := v_sku.pack_size * v_prod.conversion_to_base;
    END IF;
    v_required := v_required + v_ln.cnt * v_base_per * (-v_lkp.affects_bulk_stock);
  END LOOP;
  IF t.old_bulk OR v_any_new_bulk THEN
    -- stage authorization on the identity(ies) actually touched, evaluated on the FINAL state, atomically with the edit
    IF t.old_bulk THEN
      v_prob := app_private.mis_g7_stage_problem(t.product_id, t.batch_number);
      IF v_prob IS NOT NULL THEN PERFORM app_private.mis_g7_chain_violation(v_prob, p_work_log_id, 'old identity product ' || coalesce(t.product_id::text, '?') || ' batch ' || coalesce(t.batch_number, '?')); END IF;
    END IF;
    IF v_any_new_bulk AND NOT (v_same AND t.old_bulk) THEN
      v_prob := app_private.mis_g7_stage_problem(v_new.pid, v_new.bn);
      IF v_prob IS NOT NULL THEN PERFORM app_private.mis_g7_chain_violation(v_prob, p_work_log_id, 'product ' || coalesce(v_new.pid::text, '?') || ' batch ' || coalesce(v_new.bn, '?')); END IF;
    END IF;
    -- conservation: the old identity nets to the new depletion when unchanged; otherwise old nets to 0 and new to -required
    IF v_calc_ok THEN
      IF v_same THEN
        v_net := app_private.mis_g7_chain_net(v_new.pid, v_new.bn, v_ids);
        IF v_net <> -v_required THEN PERFORM app_private.mis_g7_chain_violation('CHAIN_CONSERVATION_MISMATCH', p_work_log_id, 'expected ' || (-v_required) || ' posted ' || v_net); END IF;
      ELSE
        IF t.product_id IS NOT NULL THEN
          v_net := app_private.mis_g7_chain_net(t.product_id, t.batch_number, v_ids);
          IF v_net <> 0 THEN PERFORM app_private.mis_g7_chain_violation('CHAIN_CONSERVATION_MISMATCH', p_work_log_id, 'old identity expected 0 posted ' || v_net); END IF;
        END IF;
        IF v_new.pid IS NOT NULL THEN
          v_net := app_private.mis_g7_chain_net(v_new.pid, v_new.bn, v_ids);
          IF v_net <> -v_required THEN PERFORM app_private.mis_g7_chain_violation('CHAIN_CONSERVATION_MISMATCH', p_work_log_id, 'new identity expected ' || (-v_required) || ' posted ' || v_net); END IF;
        END IF;
      END IF;
    END IF;
    FOR v_bal IN SELECT coalesce(sum(l.qty_base), 0) FROM public.fg_bulk_stock_ledger l
                  WHERE (l.product_id, l.batch_number) IN ((t.product_id, t.batch_number), (v_new.pid, v_new.bn)) GROUP BY l.product_id, l.batch_number LOOP
      IF v_bal < 0 THEN PERFORM app_private.mis_g7_chain_violation('NEGATIVE_BALANCE', p_work_log_id, 'ledger balance ' || v_bal); END IF;
    END LOOP;
  END IF;
  UPDATE app_private.mis_g7_chain_ticket SET finished_at = clock_timestamp() WHERE txid = t.txid AND work_log_id = t.work_log_id;
END $f$;

CREATE OR REPLACE FUNCTION app_private.trg_mis_g7_chain_ticket_must_finish() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.mis_g7_chain_ticket WHERE txid = NEW.txid AND work_log_id = NEW.work_log_id AND finished_at IS NOT NULL) THEN
    RAISE EXCEPTION 'MIS_G7_CHAIN_REPLACE_NOT_FINISHED: work log % (verification skipped)', NEW.work_log_id USING ERRCODE = 'P0001'; END IF;
  RETURN NULL;
END $f$;
DROP TRIGGER IF EXISTS mis_g7_chain_ticket_must_finish ON app_private.mis_g7_chain_ticket;
CREATE CONSTRAINT TRIGGER mis_g7_chain_ticket_must_finish AFTER INSERT ON app_private.mis_g7_chain_ticket
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.trg_mis_g7_chain_ticket_must_finish();
REVOKE ALL ON FUNCTION app_private.mis_g7_chain_replace_begin(bigint), app_private.mis_g7_chain_replace_finish(bigint),
  app_private.trg_mis_g7_chain_ticket_must_finish() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- ENFORCE readiness gate for the legacy DWL editor. NULL = ready; otherwise the refusal code.
CREATE OR REPLACE FUNCTION app_private.mis_g7_core_gate() RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_n int; v_oid oid; v_src text; v_sha text;
BEGIN
  SELECT count(*), min(p.oid) INTO v_n, v_oid FROM pg_proc p
   WHERE p.proname = 'rpc_update_daily_work_log_with_packaging__core' AND p.pronamespace = 'public'::regnamespace;
  IF v_n <> 1 THEN RETURN 'LEGACY_DWL_EDITOR_NOT_FOUND'; END IF;
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = v_oid;
  IF v_src NOT LIKE '%mis_g7_chain_replace_begin%' OR v_src NOT LIKE '%mis_g7_chain_replace_finish%' THEN RETURN 'LEGACY_DWL_EDITOR_NOT_MIGRATED'; END IF;
  v_sha := encode(sha256(convert_to(pg_get_functiondef(v_oid), 'UTF8')), 'hex');
  IF NOT EXISTS (SELECT 1 FROM app_private.mis_g7_core_migration_acceptance WHERE core_sha = v_sha) THEN RETURN 'CORE_MIGRATION_NOT_ACCEPTED'; END IF;
  RETURN NULL;
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_core_gate() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mis_g7_record_core_migration_acceptance_v1(p_core_sha text, p_evidence_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_actor uuid := auth.uid(); v_n int; v_oid oid; v_src text; v_sha text; v_ev text := btrim(p_evidence_ref);
BEGIN
  PERFORM public.require_permission('module:mis-g7-core-migration-signoff', true);
  IF v_actor IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_core_sha IS NULL OR p_core_sha !~ '^[0-9a-f]{64}$' OR coalesce(v_ev, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
  SELECT count(*), min(p.oid) INTO v_n, v_oid FROM pg_proc p
   WHERE p.proname = 'rpc_update_daily_work_log_with_packaging__core' AND p.pronamespace = 'public'::regnamespace;
  IF v_n <> 1 THEN RETURN jsonb_build_object('ok', false, 'code', 'LEGACY_DWL_EDITOR_NOT_FOUND'); END IF;
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = v_oid;
  v_sha := encode(sha256(convert_to(pg_get_functiondef(v_oid), 'UTF8')), 'hex');
  IF v_sha <> p_core_sha THEN RETURN jsonb_build_object('ok', false, 'code', 'CORE_SHA_MISMATCH', 'live_core_sha', v_sha); END IF;
  IF v_src NOT LIKE '%mis_g7_chain_replace_begin%' OR v_src NOT LIKE '%mis_g7_chain_replace_finish%' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LEGACY_DWL_EDITOR_NOT_MIGRATED'); END IF;
  IF EXISTS (SELECT 1 FROM app_private.mis_g7_core_migration_acceptance WHERE core_sha = v_sha) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_ACCEPTED', 'core_sha', v_sha); END IF;
  INSERT INTO app_private.mis_g7_core_migration_acceptance (core_sha, evidence_ref, accepted_by) VALUES (v_sha, v_ev, v_actor);
  RETURN jsonb_build_object('ok', true, 'core_sha', v_sha);
END $f$;
REVOKE ALL ON FUNCTION public.mis_g7_record_core_migration_acceptance_v1(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_g7_record_core_migration_acceptance_v1(text,text) TO authenticated;

-- set_enforcement: ENFORCE additionally requires the core gate (fail closed). Returning to AUDIT is always allowed.
CREATE OR REPLACE FUNCTION public.mis_g7_set_enforcement_v1(p_mode text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_actor uuid := auth.uid(); v_from text; v_reason text := btrim(p_reason); v_gate text;
BEGIN
  PERFORM public.require_permission('module:mis-g7-enforcement-admin', true);
  IF v_actor IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('AUDIT', 'ENFORCE') OR coalesce(v_reason, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
  IF p_mode = 'ENFORCE' THEN
    IF to_regprocedure('public.mis_correct_pack_line_v1(uuid,bigint,integer,text,jsonb)') IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'CORRECTION_PATH_NOT_INSTALLED'); END IF;
    v_gate := app_private.mis_g7_core_gate();
    IF v_gate = 'LEGACY_DWL_EDITOR_NOT_FOUND' THEN RETURN jsonb_build_object('ok', false, 'code', 'LEGACY_DWL_EDITOR_NOT_FOUND'); END IF;
    IF v_gate = 'LEGACY_DWL_EDITOR_NOT_MIGRATED' THEN RETURN jsonb_build_object('ok', false, 'code', 'LEGACY_DWL_EDITOR_NOT_MIGRATED'); END IF;
    IF v_gate = 'CORE_MIGRATION_NOT_ACCEPTED' THEN RETURN jsonb_build_object('ok', false, 'code', 'CORE_MIGRATION_NOT_ACCEPTED'); END IF;
    IF v_gate IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'LEGACY_DWL_EDITOR_NOT_MIGRATED'); END IF;   -- unknown gate result: fail closed
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('sasv:mis:enforcement', 0));
  SELECT mode INTO v_from FROM app_private.mis_g7_enforcement WHERE singleton;
  IF v_from IS NOT DISTINCT FROM p_mode THEN RETURN jsonb_build_object('ok', false, 'code', 'MODE_UNCHANGED', 'mode', v_from); END IF;
  UPDATE app_private.mis_g7_enforcement SET mode = p_mode, changed_at = clock_timestamp() WHERE singleton;
  INSERT INTO app_private.mis_g7_enforcement_log (from_mode, to_mode, actor, reason) VALUES (v_from, p_mode, v_actor, v_reason);
  RETURN jsonb_build_object('ok', true, 'from_mode', v_from, 'mode', p_mode);
END $f$;
REVOKE ALL ON FUNCTION public.mis_g7_set_enforcement_v1(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_g7_set_enforcement_v1(text,text) TO authenticated;

-- readiness: adds the core gate status ('OK' or the blocking code).
CREATE OR REPLACE FUNCTION public.mis_g7_enforcement_readiness_v1(p_days integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_days integer := least(greatest(coalesce(p_days, 7), 1), 365);
BEGIN
  PERFORM public.require_permission('module:mis-g7-enforcement-admin', false);
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object('ok', true, 'mode', (SELECT mode FROM app_private.mis_g7_enforcement WHERE singleton), 'window_days', v_days,
    'core_gate', coalesce(app_private.mis_g7_core_gate(), 'OK'),
    'direct_writes', coalesce((SELECT jsonb_agg(jsonb_build_object('tbl', tbl, 'op', op, 'writes', n, 'distinct_actors', a, 'last_at', l) ORDER BY tbl, op)
        FROM (SELECT tbl, op, count(*) n, count(DISTINCT actor) a, max(at) l FROM app_private.mis_g7_direct_pack_audit
               WHERE at >= clock_timestamp() - make_interval(days => v_days) GROUP BY tbl, op) x), '[]'::jsonb),
    'ticketed_corrections', (SELECT count(*) FROM app_private.mis_fg_pack_correction WHERE corrected_at >= clock_timestamp() - make_interval(days => v_days)),
    'ticketed_packs', (SELECT count(*) FROM app_private.mis_fg_pack_request WHERE created_at >= clock_timestamp() - make_interval(days => v_days)),
    'chain_replacements', (SELECT count(*) FROM app_private.mis_g7_chain_ticket WHERE begun_at >= clock_timestamp() - make_interval(days => v_days)));
END $f$;
REVOKE ALL ON FUNCTION public.mis_g7_enforcement_readiness_v1(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_g7_enforcement_readiness_v1(integer) TO authenticated;
