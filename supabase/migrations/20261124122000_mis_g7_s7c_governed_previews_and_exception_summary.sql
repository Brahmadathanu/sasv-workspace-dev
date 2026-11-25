-- MIS G7 S7c: advisory packing/correction preview and bounded live governance-exception summary.
-- FORWARD-ONLY. NOT INSTALLED. Requires S7a and S7b (exact FG receipt evidence in the writers, so previews and exceptions classify receipts the same way). READ-ONLY functions (STABLE; no table is written). No permission assigned.
-- The writers (mis_pack_fg_bulk_v1 / mis_correct_pack_line_v1) stay authoritative and re-validate under their own locks.

DO $guard$
BEGIN
  IF to_regprocedure('app_private.mis_g7_route_context(integer,text,integer)') IS NULL
     OR to_regprocedure('app_private.mis_g7_fg_state(integer,text)') IS NULL
     OR to_regprocedure('app_private.mis_g7_can_view(text)') IS NULL
     OR to_regprocedure('app_private.mis_g7_fg_receipt(integer,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'MIS_G7_S7C_PRECONDITION: S7a is not installed';
  END IF;
  IF position('mis_g7_fg_receipt' IN (SELECT prosrc FROM pg_proc WHERE oid = 'public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)'::regprocedure)) = 0
     OR position('mis_g7_fg_receipt' IN (SELECT prosrc FROM pg_proc WHERE oid = 'public.mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'MIS_G7_S7C_PRECONDITION: S7b is not installed (writers do not yet use exact receipt evidence)';
  END IF;
END $guard$;

-- Preview of a packing (p_lines) or of a single-line correction (p_event_sku_id + p_new_count). Exactly one mode.
-- ok=false: static input/identity/SKU refusal (same codes as the writers). ok=true: figures + preview_code = the first
-- state-dependent outcome the writer would produce ('OK' when it would post without excess). Scalars only: no record variable
-- is ever read before assignment.
CREATE OR REPLACE FUNCTION public.mis_preview_pack_fg_bulk_v1(p_packaging_event_id bigint, p_lines jsonb DEFAULT NULL,
  p_event_sku_id bigint DEFAULT NULL, p_new_count integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE
  v_pe_id bigint; v_pe_wl integer; v_pe_type text;
  v_pid integer; v_uom text; v_conv numeric; v_batch text;
  v_lk_label text; v_lk_aff numeric; v_lk_pack boolean;
  v_mode text; v_line_id bigint; v_line_sku bigint; v_line_cnt integer;
  v_lines jsonb; v_x record;
  v_sku_id bigint; v_sku_prod bigint; v_sku_pack numeric; v_sku_uom text;
  v_per numeric; v_delta numeric := 0; v_available numeric; v_old_dep numeric; v_posted numeric;
  v_problem text; v_receipt boolean; v_code text := 'OK'; v_basis boolean := NULL; v_stage_log integer; v_receipt_code text;
BEGIN
  PERFORM public.require_permission('module:mis-fg-bulk-packing', false);
  IF p_packaging_event_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
  SELECT pe.id, pe.work_log_id, pe.event_type::text INTO v_pe_id, v_pe_wl, v_pe_type FROM public.packaging_events pe WHERE pe.id = p_packaging_event_id;
  IF v_pe_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'PACKAGING_EVENT_NOT_FOUND'); END IF;
  SELECT p.id, p.uom_base, p.conversion_to_base, wl.batch_number INTO v_pid, v_uom, v_conv, v_batch
    FROM public.daily_work_log wl JOIN public.products p ON p.item = wl.item WHERE wl.id = v_pe_wl;
  IF v_pid IS NULL OR coalesce(btrim(v_batch),'') = '' THEN RETURN jsonb_build_object('ok', false, 'code', 'BATCH_IDENTITY_MISSING'); END IF;
  SELECT label, affects_bulk_stock, is_packaging INTO v_lk_label, v_lk_aff, v_lk_pack FROM public.event_type_lkp WHERE label = v_pe_type AND active;
  IF v_lk_label IS NULL OR NOT v_lk_pack OR v_lk_aff = 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_BULK_AFFECTING'); END IF;
  IF v_lk_aff > 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_DEPLETING'); END IF;

  IF p_event_sku_id IS NOT NULL THEN
    v_mode := 'CORRECT';
    IF p_lines IS NOT NULL OR p_new_count IS NULL OR p_new_count < 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
    SELECT es.id, es.sku_id, es."count" INTO v_line_id, v_line_sku, v_line_cnt FROM public.event_skus es WHERE es.id = p_event_sku_id AND es.packaging_event_id = v_pe_id;
    IF v_line_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'CORRECTION_LINE_NOT_FOUND'); END IF;
    v_lines := jsonb_build_array(jsonb_build_object('sku_id', v_line_sku, 'count', p_new_count));
  ELSE
    v_mode := 'PACK';
    IF p_new_count IS NOT NULL OR p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array'
       OR jsonb_array_length(p_lines) = 0 OR jsonb_array_length(p_lines) > 500 THEN RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
    v_lines := p_lines;
  END IF;

  BEGIN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_lines) e WHERE jsonb_typeof(e) <> 'object') THEN RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
    IF (SELECT count(DISTINCT (e->>'sku_id')::bigint) FROM jsonb_array_elements(v_lines) e) <> jsonb_array_length(v_lines) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
    FOR v_x IN SELECT (e->>'sku_id')::bigint AS sid, (e->>'count')::integer AS cnt FROM jsonb_array_elements(v_lines) e LOOP
      IF v_x.sid IS NULL OR v_x.cnt IS NULL OR v_x.cnt < 0 OR (v_mode = 'PACK' AND v_x.cnt = 0) THEN RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
      SELECT id, product_id, pack_size, uom INTO v_sku_id, v_sku_prod, v_sku_pack, v_sku_uom FROM public.product_skus WHERE id = v_x.sid;
      IF v_sku_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'SKU_NOT_FOUND'); END IF;
      IF v_sku_prod IS DISTINCT FROM v_pid THEN RETURN jsonb_build_object('ok', false, 'code', 'SKU_PRODUCT_MISMATCH'); END IF;
      IF v_sku_pack IS NULL OR v_sku_pack <= 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'SKU_PACK_SIZE_INVALID'); END IF;
      IF v_sku_uom = v_uom THEN v_per := v_sku_pack;
      ELSE
        IF v_conv IS NULL OR v_conv <= 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'SKU_CONVERSION_INVALID'); END IF;
        v_per := v_sku_pack * v_conv;
      END IF;
      v_per := v_per * (-v_lk_aff);
      IF v_mode = 'PACK' THEN
        IF EXISTS (SELECT 1 FROM public.event_skus WHERE packaging_event_id = v_pe_id AND sku_id = v_x.sid) THEN RETURN jsonb_build_object('ok', false, 'code', 'SKU_LINE_EXISTS'); END IF;
        v_delta := v_delta + v_x.cnt * v_per;
      ELSE
        v_old_dep := v_line_cnt * v_per;
        v_delta := (v_x.cnt - v_line_cnt) * v_per;
        SELECT coalesce(sum(qty_base), 0) INTO v_posted FROM public.fg_bulk_stock_ledger
         WHERE source_table = 'event_skus' AND source_id = v_line_id::integer AND product_id = v_pid AND batch_number = v_batch;
      END IF;
    END LOOP;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_parameter_value THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END;

  SELECT coalesce(sum(qty_base), 0) INTO v_available FROM public.fg_bulk_stock_ledger WHERE product_id = v_pid AND batch_number = v_batch;
  -- exact receipt evidence, selected exactly as the packing writer does: the SIGNED stage's work log (else batch level, for display)
  v_stage_log := app_private.mis_g7_fg_stage_log(v_pid, v_batch);
  v_receipt_code := CASE WHEN v_stage_log IS NOT NULL THEN app_private.mis_g7_fg_receipt(v_pid, v_batch, v_stage_log)->>'code' ELSE app_private.mis_g7_batch_receipt_code(v_pid, v_batch) END;
  v_receipt := v_receipt_code = 'OK';
  v_problem := app_private.mis_g7_stage_problem(v_pid, v_batch);
  IF v_mode = 'CORRECT' THEN
    v_basis := NOT (v_posted = 0 AND v_old_dep <> 0) AND v_posted = -v_old_dep;
  END IF;

  -- first state-dependent outcome, in the writers' order
  IF v_mode = 'CORRECT' AND p_new_count = v_line_cnt THEN v_code := 'CORRECTION_NO_CHANGE';
  ELSIF v_problem = 'CHAIN_STAGE_NOT_SIGNED' THEN v_code := 'FG_STAGE_NOT_SIGNED';
  ELSIF v_problem = 'CHAIN_STAGE_SOURCE_CHANGED' THEN v_code := 'STAGE_SOURCE_CHANGED';
  ELSIF v_problem IS NOT NULL THEN v_code := 'BATCH_IDENTITY_MISSING';
  ELSIF v_mode = 'PACK' AND NOT v_receipt THEN v_code := 'FG_RECEIPT_MISSING';
  ELSIF v_mode = 'CORRECT' AND v_posted = 0 AND v_old_dep <> 0 THEN v_code := 'CORRECTION_NO_DEPLETION_BASIS';
  ELSIF v_mode = 'CORRECT' AND NOT v_basis THEN v_code := 'CORRECTION_LEDGER_MISMATCH';
  ELSIF v_delta > 0 AND v_delta > v_available THEN v_code := 'INSUFFICIENT_BULK';
  END IF;

  RETURN jsonb_build_object('ok', true, 'advisory', true, 'mode', v_mode, 'preview_code', v_code,
    'product_id', v_pid, 'batch_number', v_batch, 'base_uom', v_uom, 'packaging_event_id', v_pe_id,
    'available_base', v_available, 'required_base', greatest(v_delta, 0), 'stock_delta_base', -v_delta,
    'shortfall_base', CASE WHEN v_delta > v_available THEN v_delta - v_available ELSE 0 END,
    'stage_problem', v_problem, 'receipt_present', v_receipt, 'receipt_code', v_receipt_code,
    'eligible_without_excess', v_code = 'OK',
    'excess_permitted', app_private.mis_g7_has_permission('module:mis-fg-bulk-packing') AND app_private.mis_g7_has_permission('module:mis-fg-excess-adjustment'),
    'event_sku_id', v_line_id, 'old_count', v_line_cnt, 'new_count', p_new_count,
    'has_depletion_basis', v_basis, 'expected_posted_base', CASE WHEN v_mode = 'CORRECT' THEN -v_old_dep END,
    'posted_base', CASE WHEN v_mode = 'CORRECT' THEN v_posted END);
END $f$;

-- Bounded live exception summary over FG-bulk-storage logs and depleting packaging in [p_from, p_to].
-- count_unit: distinct product/batch per state (states overlap by design). line_counts: distinct event_skus lines.
-- Historical (pre cut-over) unsigned batches are NOT_VERIFIED, never SIGNED/UNSIGNED. Nothing is backfilled or inferred as signed.
CREATE OR REPLACE FUNCTION public.mis_get_governance_exception_summary_v1(p_from date, p_to date, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $f$
DECLARE result jsonb;
BEGIN
  PERFORM public.require_permission('module:executive-mis-dashboard', false);
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 92 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200
     OR p_offset IS NULL OR p_offset < 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); END IF;
  WITH logs AS MATERIALIZED (
    SELECT w.id, w.log_date, p.id AS pid, p.item, w.batch_number
      FROM public.daily_work_log w JOIN public.products p ON p.item = w.item
     WHERE w.log_date BETWEEN p_from AND p_to AND w.activity = 'FG bulk storage' AND coalesce(btrim(w.batch_number),'') <> ''
  ), pack_lines AS MATERIALIZED (
    SELECT p.id AS pid, p.item, w.batch_number, es.id AS line_id
      FROM public.daily_work_log w JOIN public.products p ON p.item = w.item
      JOIN public.packaging_events pe ON pe.work_log_id = w.id
      JOIN public.event_type_lkp e ON e.label = pe.event_type::text AND e.active AND e.is_packaging AND e.affects_bulk_stock < 0
      JOIN public.event_skus es ON es.packaging_event_id = pe.id
     WHERE w.log_date BETWEEN p_from AND p_to AND coalesce(btrim(w.batch_number),'') <> ''
  ), batches AS MATERIALIZED (
    SELECT DISTINCT pid, item, batch_number FROM logs UNION SELECT DISTINCT pid, item, batch_number FROM pack_lines
  ), fg AS MATERIALIZED (
    SELECT b.pid, b.item, b.batch_number, app_private.mis_g7_fg_state(b.pid, b.batch_number) AS state, NULL::text AS detail FROM batches b
  ), route AS MATERIALIZED (
    SELECT DISTINCT l.pid, l.item, l.batch_number,
           CASE WHEN c.ctx->>'code' = 'BMR_IDENTITY_REVIEW' THEN 'BMR_IDENTITY_REVIEW' ELSE 'MISSING_ROUTE' END AS state, c.ctx->>'code' AS detail
      FROM logs l CROSS JOIN LATERAL (SELECT app_private.mis_g7_route_context(l.pid, l.batch_number, l.id) AS ctx) c
     WHERE c.ctx->>'code' <> 'OK'
  ), receipt AS MATERIALIZED (
    -- exact receipt evidence (ledger rows of an FG work log of the batch, net = logged quantity); transfers, packaging returns and manual entries never count
    SELECT b.pid, b.item, b.batch_number, 'MISSING_RECEIPT'::text AS state, r.c AS detail FROM batches b
      CROSS JOIN LATERAL (SELECT app_private.mis_g7_batch_receipt_code(b.pid, b.batch_number) AS c) r WHERE r.c <> 'OK'
  ), nodep AS MATERIALIZED (
    SELECT pl.pid, pl.item, pl.batch_number, pl.line_id FROM pack_lines pl
     WHERE NOT EXISTS (SELECT 1 FROM public.fg_bulk_stock_ledger g WHERE g.source_table = 'event_skus' AND g.source_id = pl.line_id::integer
                          AND g.product_id = pl.pid AND g.batch_number = pl.batch_number AND g.qty_base < 0)
  ), flags AS MATERIALIZED (
    SELECT * FROM fg UNION ALL SELECT * FROM route UNION ALL SELECT * FROM receipt
    UNION ALL SELECT DISTINCT pid, item, batch_number, 'NOT_VERIFIED', 'PACKING_LINE_WITHOUT_DEPLETION' FROM nodep
  ), items AS (
    SELECT pid, item, batch_number, state, detail FROM flags WHERE state <> 'SIGNED' ORDER BY state, pid, batch_number, detail LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object('ok', true, 'scope', 'FG_BULK_STORAGE_LOGS_AND_DEPLETING_PACKAGING', 'from', p_from, 'to', p_to,
    'count_unit', 'distinct product/batch per state; states overlap by design',
    'total_batches', (SELECT count(*) FROM batches),
    'governance_cutover', (SELECT effective_from FROM app_private.mis_g7_governance_cutover),
    'counts', coalesce((SELECT jsonb_object_agg(state, n) FROM (SELECT state, count(DISTINCT (pid, batch_number)) AS n FROM flags GROUP BY state) s), '{}'::jsonb),
    'line_count_unit', 'distinct event_skus lines in the window',
    'line_counts', jsonb_build_object('PACKING_LINES', (SELECT count(*) FROM pack_lines), 'PACKING_LINES_WITHOUT_DEPLETION', (SELECT count(*) FROM nodep)),
    'total_items', (SELECT count(*) FROM flags WHERE state <> 'SIGNED'),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('product_id', pid, 'product', item, 'batch_number', batch_number, 'state', state, 'detail', detail)
                        ORDER BY state, pid, batch_number, detail) FROM items), '[]'::jsonb),
    'limit', p_limit, 'offset', p_offset) INTO result;
  RETURN result;
END $f$;

REVOKE ALL ON FUNCTION public.mis_preview_pack_fg_bulk_v1(bigint,jsonb,bigint,integer), public.mis_get_governance_exception_summary_v1(date,date,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_preview_pack_fg_bulk_v1(bigint,jsonb,bigint,integer), public.mis_get_governance_exception_summary_v1(date,date,integer,integer) TO authenticated;
