-- MIS G7 S4: atomic FG bulk packing RPC with optional separately authorized measured excess.
-- Excess ledger receipt + event_skus rows (-> legacy trg_fg_ledger_from_es depletion) + request
-- record commit in ONE transaction; any raise rolls everything back. Domain refusals return
-- {ok:false, code,...} BEFORE any write. Client-supplied authorization/committed flags are
-- never read. Depends on S2 + S3 migrations and on the legacy tables/trigger named below.
-- New permission targets (owner must assign; none granted here):
--   module:mis-fg-bulk-packing      (call the RPC)
--   module:mis-fg-excess-adjustment (supply measured excess; separately governed)
CREATE TABLE IF NOT EXISTS app_private.mis_fg_signed_excess_receipt (
  excess_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  product_id integer NOT NULL REFERENCES public.products(id),
  batch_number text NOT NULL CHECK (length(btrim(batch_number)) > 0),
  packaging_event_id integer NOT NULL,
  fg_stage_event_id bigint NOT NULL REFERENCES app_private.mis_batch_stage_event(event_id),
  qty_base numeric NOT NULL CHECK (qty_base > 0),
  base_uom text NOT NULL CHECK (length(btrim(base_uom)) > 0),
  evidence_ref text NOT NULL CHECK (length(btrim(evidence_ref)) > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  measured_by uuid NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS app_private.mis_fg_pack_request (
  request_id uuid PRIMARY KEY,
  actor uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  product_id integer NOT NULL,
  batch_number text NOT NULL,
  packaging_event_id integer NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['mis_fg_signed_excess_receipt','mis_fg_pack_request'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON app_private.%I', t||'_append_only', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON app_private.%I FOR EACH ROW EXECUTE FUNCTION app_private.mis_g7_append_only_guard()', t||'_append_only', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON app_private.%I', t||'_no_truncate', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON app_private.%I FOR EACH STATEMENT EXECUTE FUNCTION app_private.mis_g7_append_only_guard()', t||'_no_truncate', t);
    EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE app_private.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE app_private.mis_fg_signed_excess_receipt_excess_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mis_pack_fg_bulk_v1(
  p_request_id uuid, p_packaging_event_id integer, p_lines jsonb, p_excess jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE
  v_actor uuid := auth.uid();
  v_hash text; v_prior app_private.mis_fg_pack_request;
  v_pe record; v_prod record; v_batch text; v_lkp record;
  v_lines jsonb; v_n int; v_ln record; v_sku record;
  v_required numeric := 0; v_available numeric; v_base_per numeric;
  v_ex_qty numeric; v_ex_ev text; v_ex_reason text; v_excess_id bigint;
  v_stage bigint; v_ids bigint[] := '{}'; v_id bigint; v_after numeric; v_posted numeric;
  v_resp jsonb; v_can_excess boolean;
BEGIN
  PERFORM public.require_permission('module:mis-fg-bulk-packing', true);
  IF v_actor IS NULL THEN RAISE EXCEPTION 'MIS_G7_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL OR p_packaging_event_id IS NULL OR p_lines IS NULL
     OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0
     OR (p_excess IS NOT NULL AND jsonb_typeof(p_excess) <> 'object') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
  -- normalize lines (only sku_id,count read; any other key ignored)
  BEGIN
    SELECT jsonb_agg(jsonb_build_object('sku_id', (e->>'sku_id')::int, 'count', (e->>'count')::int)
                     ORDER BY (e->>'sku_id')::int) INTO v_lines
      FROM jsonb_array_elements(p_lines) e;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_lines) e WHERE (e->>'count')::int <= 0)
     OR (SELECT count(DISTINCT e->>'sku_id') FROM jsonb_array_elements(v_lines) e) <> jsonb_array_length(v_lines) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
  IF p_excess IS NOT NULL THEN
    BEGIN v_ex_qty := (p_excess->>'qty_base')::numeric; EXCEPTION WHEN OTHERS THEN v_ex_qty := NULL; END;
    v_ex_ev := btrim(p_excess->>'evidence_ref'); v_ex_reason := btrim(p_excess->>'reason');
    IF v_ex_qty IS NULL OR v_ex_qty <= 0 OR coalesce(v_ex_ev,'') = '' OR coalesce(v_ex_reason,'') = '' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'EXCESS_INVALID'); END IF;
  END IF;
  v_hash := encode(sha256(convert_to(jsonb_build_object('e', p_packaging_event_id, 'l', v_lines,
            'x', CASE WHEN p_excess IS NULL THEN NULL ELSE jsonb_build_object('q', v_ex_qty, 'v', v_ex_ev, 'r', v_ex_reason) END)::text, 'UTF8')), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('sasv:mis:packreq:' || p_request_id::text, 0));
  SELECT * INTO v_prior FROM app_private.mis_fg_pack_request WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_prior.actor = v_actor AND v_prior.request_hash = v_hash THEN
      RETURN v_prior.response || jsonb_build_object('idempotent_replay', true); END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REUSED');
  END IF;

  SELECT pe.id, pe.work_log_id, pe.event_type INTO v_pe FROM public.packaging_events pe WHERE pe.id = p_packaging_event_id;
  IF v_pe.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'PACKAGING_EVENT_NOT_FOUND'); END IF;
  SELECT p.id, p.uom_base, p.conversion_to_base, wl.batch_number INTO v_prod
    FROM public.daily_work_log wl JOIN public.products p ON p.item = wl.item WHERE wl.id = v_pe.work_log_id;
  IF v_prod.id IS NULL OR coalesce(btrim(v_prod.batch_number),'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BATCH_IDENTITY_MISSING'); END IF;
  v_batch := v_prod.batch_number;
  SELECT label, affects_bulk_stock, is_packaging INTO v_lkp FROM public.event_type_lkp WHERE label = v_pe.event_type AND active;
  IF v_lkp.label IS NULL OR NOT v_lkp.is_packaging OR v_lkp.affects_bulk_stock = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_BULK_AFFECTING'); END IF;
  IF v_lkp.affects_bulk_stock > 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_DEPLETING'); END IF;

  PERFORM app_private.mis_lock_fg_batch(v_prod.id, v_batch);   -- before any balance read

  SELECT s.event_id INTO v_stage FROM app_private.mis_batch_stage_event s
   WHERE s.event_kind = 'SIGN' AND s.product_id = v_prod.id AND s.batch_number = v_batch AND s.stage_role = 'FG_BULK'
     AND NOT EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event c WHERE c.event_kind='CORRECTION' AND c.corrects_event_id = s.event_id)
   ORDER BY s.event_id DESC LIMIT 1;
  IF v_stage IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FG_STAGE_NOT_SIGNED', 'historical_state', 'NOT_VERIFIED'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fg_bulk_stock_ledger WHERE product_id = v_prod.id AND batch_number = v_batch AND qty_base > 0) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FG_RECEIPT_MISSING'); END IF;

  FOR v_ln IN SELECT (e->>'sku_id')::int sku_id, (e->>'count')::int cnt FROM jsonb_array_elements(v_lines) e LOOP
    SELECT id, product_id, pack_size, uom INTO v_sku FROM public.product_skus WHERE id = v_ln.sku_id;
    IF v_sku.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'SKU_NOT_FOUND', 'sku_id', v_ln.sku_id); END IF;
    IF v_sku.product_id <> v_prod.id THEN RETURN jsonb_build_object('ok', false, 'code', 'SKU_PRODUCT_MISMATCH', 'sku_id', v_ln.sku_id); END IF;
    IF v_sku.pack_size IS NULL OR v_sku.pack_size <= 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'SKU_PACK_SIZE_INVALID', 'sku_id', v_ln.sku_id); END IF;
    IF v_sku.uom = v_prod.uom_base THEN v_base_per := v_sku.pack_size;
    ELSE
      IF v_prod.conversion_to_base IS NULL OR v_prod.conversion_to_base <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SKU_CONVERSION_INVALID', 'sku_id', v_ln.sku_id); END IF;
      v_base_per := v_sku.pack_size * v_prod.conversion_to_base;
    END IF;
    IF EXISTS (SELECT 1 FROM public.event_skus WHERE packaging_event_id = p_packaging_event_id AND sku_id = v_ln.sku_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SKU_LINE_EXISTS', 'sku_id', v_ln.sku_id); END IF;
    v_required := v_required + v_ln.cnt * v_base_per * (-v_lkp.affects_bulk_stock);
  END LOOP;

  SELECT coalesce(sum(qty_base), 0) INTO v_available FROM public.fg_bulk_stock_ledger
   WHERE product_id = v_prod.id AND batch_number = v_batch;

  IF p_excess IS NULL THEN
    IF v_required > v_available THEN
      v_can_excess := app_private.mis_g7_has_permission('module:mis-fg-excess-adjustment');
      RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BULK', 'product_id', v_prod.id,
        'batch_number', v_batch, 'required_base', v_required, 'available_base', v_available,
        'shortfall_base', v_required - v_available, 'base_uom', v_prod.uom_base, 'excess_permitted', v_can_excess);
    END IF;
  ELSE
    IF NOT app_private.mis_g7_has_permission('module:mis-fg-excess-adjustment') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'EXCESS_NOT_AUTHORIZED'); END IF;
    IF v_required <= v_available THEN
      RETURN jsonb_build_object('ok', false, 'code', 'EXCESS_NOT_NEEDED', 'required_base', v_required, 'available_base', v_available); END IF;
    IF v_available + v_ex_qty < v_required THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_AFTER_EXCESS', 'required_base', v_required,
        'available_base', v_available, 'excess_base', v_ex_qty, 'shortfall_base', v_required - v_available - v_ex_qty,
        'base_uom', v_prod.uom_base); END IF;
    INSERT INTO app_private.mis_fg_signed_excess_receipt
      (request_id, product_id, batch_number, packaging_event_id, fg_stage_event_id, qty_base, base_uom, evidence_ref, reason, measured_by)
    VALUES (p_request_id, v_prod.id, v_batch, p_packaging_event_id, v_stage, v_ex_qty, v_prod.uom_base, v_ex_ev, v_ex_reason, v_actor)
    RETURNING excess_id INTO v_excess_id;
    INSERT INTO public.fg_bulk_stock_ledger (product_id, batch_number, movement_date, qty, qty_base, uom, reason_code, source_table, source_id, created_at)
    VALUES (v_prod.id, v_batch, CURRENT_DATE, v_ex_qty, v_ex_qty, v_prod.uom_base, 'FG_EXCESS_MEASURED', 'mis_fg_signed_excess_receipt', v_excess_id, now());
  END IF;

  FOR v_ln IN SELECT (e->>'sku_id')::int sku_id, (e->>'count')::int cnt FROM jsonb_array_elements(v_lines) e LOOP
    INSERT INTO public.event_skus (packaging_event_id, sku_id, "count") VALUES (p_packaging_event_id, v_ln.sku_id, v_ln.cnt) RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;
  -- Defend against the legacy trigger's silent-skip: every line must have produced its depletion.
  SELECT coalesce(sum(qty_base), 0) INTO v_posted FROM public.fg_bulk_stock_ledger
   WHERE source_table = 'event_skus' AND source_id = ANY (v_ids);
  IF v_posted <> -v_required THEN
    RAISE EXCEPTION 'MIS_G7_DEPLETION_MISMATCH: expected % posted %', -v_required, v_posted USING ERRCODE = 'P0001'; END IF;
  SELECT coalesce(sum(qty_base), 0) INTO v_after FROM public.fg_bulk_stock_ledger WHERE product_id = v_prod.id AND batch_number = v_batch;
  IF v_after < 0 THEN RAISE EXCEPTION 'MIS_G7_NEGATIVE_BALANCE' USING ERRCODE = 'P0001'; END IF;

  v_resp := jsonb_build_object('ok', true, 'idempotent_replay', false, 'request_id', p_request_id,
    'product_id', v_prod.id, 'batch_number', v_batch, 'packaging_event_id', p_packaging_event_id,
    'required_base', v_required, 'available_before_base', v_available, 'excess_base', coalesce(v_ex_qty, 0),
    'excess_id', v_excess_id, 'balance_after_base', v_after, 'base_uom', v_prod.uom_base, 'event_sku_ids', to_jsonb(v_ids));
  INSERT INTO app_private.mis_fg_pack_request (request_id, actor, request_hash, product_id, batch_number, packaging_event_id, response)
  VALUES (p_request_id, v_actor, v_hash, v_prod.id, v_batch, p_packaging_event_id, v_resp);
  RETURN v_resp;
END $f$;
REVOKE ALL ON FUNCTION public.mis_pack_fg_bulk_v1(uuid,integer,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_pack_fg_bulk_v1(uuid,integer,jsonb,jsonb) TO authenticated;
