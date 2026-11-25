-- MIS G7 S4b: ticketed packaging-line corrections (the governed alternative to direct event_skus UPDATE/DELETE that
-- ENFORCE mode needs), a logged enforcement switch, and an owner readiness report built on the AUDIT log.
-- INSTALLABLE CODE ONLY; depends on S2/S3/S4/S3b. Not applied anywhere. Owner authorization required.
-- New permission target (owner assigns; none granted here): module:mis-g7-enforcement-admin
--   (mode switch + readiness report). Corrections reuse module:mis-fg-bulk-packing; separately authorized measured
--   excess reuses module:mis-fg-excess-adjustment. No client-supplied authorization/committed flag is ever read.
--
-- Scope boundaries (deliberate):
--  * A correction changes the COUNT of ONE existing SKU line (or removes it with count 0) of a bulk-affecting packaging
--    event whose batch has a signed, un-drifted FG stage. Stock moves only through the legacy es trigger under the batch
--    lock + ticket; the RPC then proves the ledger moved by exactly the expected base quantity or the whole transaction
--    rolls back. It never fabricates stock: a line whose original depletion is absent/different (e.g. the historical
--    "29 missing depletion" lines) is refused (CORRECTION_NO_DEPLETION_BASIS / CORRECTION_LEDGER_MISMATCH).
--  * Header reassignment / retyping / deletion stay denied under ENFORCE (owner-governed manual path, not a client path).
CREATE TABLE IF NOT EXISTS app_private.mis_fg_pack_correction (
  correction_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  event_sku_id bigint NOT NULL,
  packaging_event_id bigint NOT NULL,
  sku_id bigint NOT NULL,
  product_id integer NOT NULL REFERENCES public.products(id),
  batch_number text NOT NULL,
  old_count integer NOT NULL CHECK (old_count >= 0),
  new_count integer NOT NULL CHECK (new_count >= 0),
  delta_base numeric NOT NULL,            -- signed ledger effect requested (negative = more depletion)
  base_uom text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  excess_id bigint,
  corrected_by uuid NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE IF NOT EXISTS app_private.mis_g7_enforcement_log (
  log_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_mode text, to_mode text NOT NULL CHECK (to_mode IN ('AUDIT','ENFORCE')),
  actor uuid NOT NULL, reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  at timestamptz NOT NULL DEFAULT clock_timestamp());
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['mis_fg_pack_correction','mis_g7_enforcement_log'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON app_private.%I', t||'_append_only', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON app_private.%I FOR EACH ROW EXECUTE FUNCTION app_private.mis_g7_append_only_guard()', t||'_append_only', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON app_private.%I', t||'_no_truncate', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON app_private.%I FOR EACH STATEMENT EXECUTE FUNCTION app_private.mis_g7_append_only_guard()', t||'_no_truncate', t);
    EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE app_private.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE app_private.mis_fg_pack_correction_correction_id_seq, app_private.mis_g7_enforcement_log_log_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mis_correct_pack_line_v1(
  p_request_id uuid, p_event_sku_id bigint, p_new_count integer, p_reason text, p_excess jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE
  v_actor uuid := auth.uid(); v_hash text; v_prior app_private.mis_fg_pack_request;
  v_line record; v_pe record; v_prod record; v_lkp record; v_sku record; v_batch text; v_reason text := btrim(p_reason);
  v_base_per numeric; v_old_dep numeric; v_posted numeric; v_delta_dep numeric; v_available numeric;
  v_ex_qty numeric; v_ex_ev text; v_ex_reason text; v_excess_id bigint; v_stage bigint; v_se record; v_fpnow text;
  v_after_line numeric; v_after numeric; v_resp jsonb; v_can_excess boolean; v_new_posted numeric;
BEGIN
  PERFORM public.require_permission('module:mis-fg-bulk-packing', true);
  IF v_actor IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL OR p_event_sku_id IS NULL OR p_new_count IS NULL OR p_new_count < 0
     OR coalesce(v_reason, '') = '' OR (p_excess IS NOT NULL AND jsonb_typeof(p_excess) <> 'object') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
  IF p_excess IS NOT NULL THEN
    BEGIN v_ex_qty := (p_excess->>'qty_base')::numeric; EXCEPTION WHEN OTHERS THEN v_ex_qty := NULL; END;
    v_ex_ev := btrim(p_excess->>'evidence_ref'); v_ex_reason := btrim(p_excess->>'reason');
    IF v_ex_qty IS NULL OR v_ex_qty <= 0 OR coalesce(v_ex_ev, '') = '' OR coalesce(v_ex_reason, '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'EXCESS_INVALID'); END IF;
  END IF;
  v_hash := encode(sha256(convert_to(jsonb_build_object('l', p_event_sku_id, 'n', p_new_count, 'r', v_reason,
            'x', CASE WHEN p_excess IS NULL THEN NULL ELSE jsonb_build_object('q', v_ex_qty, 'v', v_ex_ev, 'r', v_ex_reason) END)::text, 'UTF8')), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('sasv:mis:packreq:' || p_request_id::text, 0));
  SELECT * INTO v_prior FROM app_private.mis_fg_pack_request WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_prior.actor = v_actor AND v_prior.request_hash = v_hash THEN
      RETURN v_prior.response || jsonb_build_object('idempotent_replay', true); END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REUSED');
  END IF;

  SELECT es.id, es.packaging_event_id, es.sku_id, es."count" AS cnt INTO v_line FROM public.event_skus es WHERE es.id = p_event_sku_id;
  IF v_line.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'CORRECTION_LINE_NOT_FOUND'); END IF;
  SELECT pe.id, pe.work_log_id, pe.event_type INTO v_pe FROM public.packaging_events pe WHERE pe.id = v_line.packaging_event_id;
  SELECT p.id, p.uom_base, p.conversion_to_base, wl.batch_number INTO v_prod
    FROM public.daily_work_log wl JOIN public.products p ON p.item = wl.item WHERE wl.id = v_pe.work_log_id;
  IF v_prod.id IS NULL OR coalesce(btrim(v_prod.batch_number), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BATCH_IDENTITY_MISSING'); END IF;
  v_batch := v_prod.batch_number;
  SELECT label, affects_bulk_stock, is_packaging INTO v_lkp FROM public.event_type_lkp WHERE label = v_pe.event_type AND active;
  IF v_lkp.label IS NULL OR NOT v_lkp.is_packaging OR v_lkp.affects_bulk_stock = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_BULK_AFFECTING'); END IF;
  IF v_lkp.affects_bulk_stock > 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_DEPLETING'); END IF;

  PERFORM app_private.mis_lock_fg_batch(v_prod.id, v_batch);
  -- re-read under the lock: the line/header must be exactly as read above
  SELECT es.id, es.packaging_event_id, es.sku_id, es."count" AS cnt INTO v_line FROM public.event_skus es
   WHERE es.id = p_event_sku_id AND es.packaging_event_id = v_pe.id FOR UPDATE;
  IF v_line.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'CORRECTION_LINE_CHANGED'); END IF;
  PERFORM 1 FROM public.packaging_events WHERE id = v_pe.id AND work_log_id = v_pe.work_log_id AND event_type = v_pe.event_type FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'PACKAGING_EVENT_CHANGED'); END IF;
  IF p_new_count = v_line.cnt THEN RETURN jsonb_build_object('ok', false, 'code', 'CORRECTION_NO_CHANGE'); END IF;

  SELECT s.event_id INTO v_stage FROM app_private.mis_batch_stage_event s
   WHERE s.event_kind = 'SIGN' AND s.product_id = v_prod.id AND s.batch_number = v_batch AND s.stage_role = 'FG_BULK'
     AND NOT EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event c WHERE c.event_kind = 'CORRECTION' AND c.corrects_event_id = s.event_id)
   ORDER BY s.event_id DESC LIMIT 1;
  IF v_stage IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'FG_STAGE_NOT_SIGNED', 'historical_state', 'NOT_VERIFIED'); END IF;
  SELECT s.source_fingerprint, s.work_log_id AS wl, s.route_step_id AS stp, s.step_occurrence AS occ INTO v_se
    FROM app_private.mis_batch_stage_event s WHERE s.event_id = v_stage;
  v_fpnow := app_private.mis_stage_fp(v_prod.id, v_batch, v_se.wl, v_se.stp, v_se.occ);
  IF v_fpnow IS NULL OR v_fpnow <> v_se.source_fingerprint THEN
    RETURN jsonb_build_object('ok', false, 'code', 'STAGE_SOURCE_CHANGED', 'historical_state', 'NOT_VERIFIED'); END IF;

  SELECT id, product_id, pack_size, uom INTO v_sku FROM public.product_skus WHERE id = v_line.sku_id;
  IF v_sku.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'SKU_NOT_FOUND', 'sku_id', v_line.sku_id); END IF;
  IF v_sku.product_id <> v_prod.id THEN RETURN jsonb_build_object('ok', false, 'code', 'SKU_PRODUCT_MISMATCH', 'sku_id', v_line.sku_id); END IF;
  IF v_sku.pack_size IS NULL OR v_sku.pack_size <= 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'SKU_PACK_SIZE_INVALID', 'sku_id', v_line.sku_id); END IF;
  IF v_sku.uom = v_prod.uom_base THEN v_base_per := v_sku.pack_size;
  ELSE
    IF v_prod.conversion_to_base IS NULL OR v_prod.conversion_to_base <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SKU_CONVERSION_INVALID', 'sku_id', v_line.sku_id); END IF;
    v_base_per := v_sku.pack_size * v_prod.conversion_to_base;
  END IF;

  -- never fabricate stock: the line's own recorded depletion must equal what its current count implies
  v_old_dep := v_line.cnt * v_base_per * (-v_lkp.affects_bulk_stock);                -- positive base quantity consumed
  SELECT coalesce(sum(qty_base), 0) INTO v_posted FROM public.fg_bulk_stock_ledger
   WHERE source_table = 'event_skus' AND source_id = v_line.id::int AND product_id = v_prod.id AND batch_number = v_batch;
  IF v_posted = 0 AND v_old_dep <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CORRECTION_NO_DEPLETION_BASIS', 'expected_posted_base', -v_old_dep, 'posted_base', v_posted); END IF;
  IF v_posted <> -v_old_dep THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CORRECTION_LEDGER_MISMATCH', 'expected_posted_base', -v_old_dep, 'posted_base', v_posted); END IF;

  v_delta_dep := (p_new_count - v_line.cnt) * v_base_per * (-v_lkp.affects_bulk_stock);   -- >0: more stock consumed, <0: stock returned
  SELECT coalesce(sum(qty_base), 0) INTO v_available FROM public.fg_bulk_stock_ledger WHERE product_id = v_prod.id AND batch_number = v_batch;

  IF v_delta_dep > 0 AND v_delta_dep > v_available THEN
    IF p_excess IS NULL THEN
      v_can_excess := app_private.mis_g7_has_permission('module:mis-fg-excess-adjustment');
      RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BULK', 'product_id', v_prod.id, 'batch_number', v_batch,
        'required_base', v_delta_dep, 'available_base', v_available, 'shortfall_base', v_delta_dep - v_available,
        'base_uom', v_prod.uom_base, 'excess_permitted', v_can_excess);
    END IF;
    IF NOT app_private.mis_g7_has_permission('module:mis-fg-excess-adjustment') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'EXCESS_NOT_AUTHORIZED'); END IF;
    IF v_available + v_ex_qty < v_delta_dep THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_AFTER_EXCESS', 'required_base', v_delta_dep, 'available_base', v_available,
        'excess_base', v_ex_qty, 'shortfall_base', v_delta_dep - v_available - v_ex_qty, 'base_uom', v_prod.uom_base); END IF;
    INSERT INTO app_private.mis_fg_signed_excess_receipt
      (request_id, product_id, batch_number, packaging_event_id, fg_stage_event_id, qty_base, base_uom, evidence_ref, reason, measured_by)
    VALUES (p_request_id, v_prod.id, v_batch, v_pe.id, v_stage, v_ex_qty, v_prod.uom_base, v_ex_ev, v_ex_reason, v_actor)
    RETURNING excess_id INTO v_excess_id;
    IF v_excess_id > 2147483647 THEN RAISE EXCEPTION 'MIS_G7_SOURCE_ID_OVERFLOW: excess_id %', v_excess_id USING ERRCODE = '22003'; END IF;
    INSERT INTO public.fg_bulk_stock_ledger (product_id, batch_number, movement_date, qty, qty_base, uom, reason_code, source_table, source_id, created_at)
    VALUES (v_prod.id, v_batch, CURRENT_DATE, v_ex_qty, v_ex_qty, v_prod.uom_base, 'FG_EXCESS_MEASURED', 'mis_fg_signed_excess_receipt', v_excess_id, now());
  ELSIF p_excess IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'EXCESS_NOT_NEEDED', 'required_base', greatest(v_delta_dep, 0), 'available_base', v_available);
  END IF;

  INSERT INTO app_private.mis_g7_pack_ticket (txid, packaging_event_id, request_id)
  VALUES (txid_current(), v_pe.id, p_request_id) ON CONFLICT DO NOTHING;
  IF p_new_count = 0 THEN DELETE FROM public.event_skus WHERE id = v_line.id;
  ELSE UPDATE public.event_skus SET "count" = p_new_count WHERE id = v_line.id; END IF;

  -- prove the legacy trigger moved the ledger by exactly the expected quantity (guards against silent skips)
  SELECT coalesce(sum(qty_base), 0) INTO v_new_posted FROM public.fg_bulk_stock_ledger
   WHERE source_table = 'event_skus' AND source_id = v_line.id::int AND product_id = v_prod.id AND batch_number = v_batch;
  IF v_new_posted <> -(p_new_count * v_base_per * (-v_lkp.affects_bulk_stock)) THEN
    RAISE EXCEPTION 'MIS_G7_CORRECTION_MISMATCH: expected % posted %', -(p_new_count * v_base_per * (-v_lkp.affects_bulk_stock)), v_new_posted USING ERRCODE = 'P0001'; END IF;
  SELECT coalesce(sum(qty_base), 0) INTO v_after FROM public.fg_bulk_stock_ledger WHERE product_id = v_prod.id AND batch_number = v_batch;
  IF v_after < 0 THEN RAISE EXCEPTION 'MIS_G7_NEGATIVE_BALANCE' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO app_private.mis_fg_pack_correction
    (request_id, event_sku_id, packaging_event_id, sku_id, product_id, batch_number, old_count, new_count, delta_base, base_uom, reason, excess_id, corrected_by)
  VALUES (p_request_id, v_line.id, v_pe.id, v_line.sku_id, v_prod.id, v_batch, v_line.cnt, p_new_count, -v_delta_dep, v_prod.uom_base, v_reason, v_excess_id, v_actor);
  v_resp := jsonb_build_object('ok', true, 'idempotent_replay', false, 'request_id', p_request_id, 'event_sku_id', v_line.id,
    'packaging_event_id', v_pe.id, 'product_id', v_prod.id, 'batch_number', v_batch, 'old_count', v_line.cnt, 'new_count', p_new_count,
    'line_removed', p_new_count = 0, 'stock_delta_base', -v_delta_dep, 'excess_base', coalesce(v_ex_qty, 0), 'excess_id', v_excess_id,
    'balance_after_base', v_after, 'base_uom', v_prod.uom_base);
  INSERT INTO app_private.mis_fg_pack_request (request_id, actor, request_hash, product_id, batch_number, packaging_event_id, response)
  VALUES (p_request_id, v_actor, v_hash, v_prod.id, v_batch, v_pe.id, v_resp);
  RETURN v_resp;
END $f$;
REVOKE ALL ON FUNCTION public.mis_correct_pack_line_v1(uuid,bigint,integer,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_correct_pack_line_v1(uuid,bigint,integer,text,jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Logged enforcement switch (owner-governed). ENFORCE requires the ticketed correction path to be installed.
CREATE OR REPLACE FUNCTION public.mis_g7_set_enforcement_v1(p_mode text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_actor uuid := auth.uid(); v_from text; v_reason text := btrim(p_reason);
BEGIN
  PERFORM public.require_permission('module:mis-g7-enforcement-admin', true);
  IF v_actor IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('AUDIT', 'ENFORCE') OR coalesce(v_reason, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
  IF p_mode = 'ENFORCE' AND to_regprocedure('public.mis_correct_pack_line_v1(uuid,bigint,integer,text,jsonb)') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CORRECTION_PATH_NOT_INSTALLED'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('sasv:mis:enforcement', 0));
  SELECT mode INTO v_from FROM app_private.mis_g7_enforcement WHERE singleton;
  IF v_from IS NOT DISTINCT FROM p_mode THEN RETURN jsonb_build_object('ok', false, 'code', 'MODE_UNCHANGED', 'mode', v_from); END IF;
  UPDATE app_private.mis_g7_enforcement SET mode = p_mode, changed_at = clock_timestamp() WHERE singleton;
  INSERT INTO app_private.mis_g7_enforcement_log (from_mode, to_mode, actor, reason) VALUES (v_from, p_mode, v_actor, v_reason);
  RETURN jsonb_build_object('ok', true, 'from_mode', v_from, 'mode', p_mode);
END $f$;
REVOKE ALL ON FUNCTION public.mis_g7_set_enforcement_v1(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_g7_set_enforcement_v1(text,text) TO authenticated;

-- Read-only readiness report from the AUDIT log (view permission on the same admin target).
CREATE OR REPLACE FUNCTION public.mis_g7_enforcement_readiness_v1(p_days integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE v_days integer := least(greatest(coalesce(p_days, 7), 1), 365);
BEGIN
  PERFORM public.require_permission('module:mis-g7-enforcement-admin', false);
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object('ok', true, 'mode', (SELECT mode FROM app_private.mis_g7_enforcement WHERE singleton), 'window_days', v_days,
    'direct_writes', coalesce((SELECT jsonb_agg(jsonb_build_object('tbl', tbl, 'op', op, 'writes', n, 'distinct_actors', a, 'last_at', l) ORDER BY tbl, op)
        FROM (SELECT tbl, op, count(*) n, count(DISTINCT actor) a, max(at) l FROM app_private.mis_g7_direct_pack_audit
               WHERE at >= clock_timestamp() - make_interval(days => v_days) GROUP BY tbl, op) x), '[]'::jsonb),
    'ticketed_corrections', (SELECT count(*) FROM app_private.mis_fg_pack_correction WHERE corrected_at >= clock_timestamp() - make_interval(days => v_days)),
    'ticketed_packs', (SELECT count(*) FROM app_private.mis_fg_pack_request WHERE created_at >= clock_timestamp() - make_interval(days => v_days)));
END $f$;
REVOKE ALL ON FUNCTION public.mis_g7_enforcement_readiness_v1(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_g7_enforcement_readiness_v1(integer) TO authenticated;
