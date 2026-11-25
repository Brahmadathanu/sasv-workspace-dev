-- MIS G7 S7b: exact FG receipt evidence in the signing and packing WRITERS.
-- FORWARD-ONLY. NOT INSTALLED. Requires S7a. Owner authorization required. S2/S4 files are never edited or replayed: the two installed
-- writers are patched in place by one exact, pinned text substitution each (S5b style) and their originals are persisted for rollback.
--
-- Why: the live ledger's positive rows include packaging returns (event_skus), internal transfers (fg_bulk_internal_transfer) and manual
-- entries/corrections, so "the batch ledger holds at least that much positive stock" (S2 signer) and "any positive ledger row exists"
-- (S4 packer) do not prove an original FG production receipt. After S7b both writers require the exact source evidence of
-- app_private.mis_g7_fg_receipt (ledger rows of that FG work log, product, batch and receipt reasons; net = logged quantity).
--   signer : FG_RECEIPT_EVIDENCE_MISSING (no source ledger / wrong log) or the NEW FG_RECEIPT_LEDGER_MISMATCH (net differs from the log)
--   packer : FG_RECEIPT_MISSING for the SIGNED stage's work log (+ 'receipt' detail code)
-- Run as ONE transaction (the migration tool does; a manual psql run must use `psql -1`).

DO $guard$
DECLARE s2 text; s4 text;
BEGIN
  IF (SELECT mode FROM app_private.mis_g7_enforcement) IS DISTINCT FROM 'AUDIT' THEN RAISE EXCEPTION 'MIS_G7_S7B_PRECONDITION: mode must be AUDIT'; END IF;
  IF to_regprocedure('app_private.mis_g7_fg_receipt(integer,text,integer)') IS NULL OR to_regclass('app_private.mis_g7_s7_baseline') IS NULL THEN
    RAISE EXCEPTION 'MIS_G7_S7B_PRECONDITION: S7a is not installed'; END IF;
  SELECT prosrc INTO s2 FROM pg_proc WHERE oid = 'public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)'::regprocedure;
  SELECT prosrc INTO s4 FROM pg_proc WHERE oid = 'public.mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb)'::regprocedure;
  -- sha256(prosrc) of the installed S2 signer / S4 packer, derived from the committed files (version independent)
  IF encode(sha256(convert_to(s2,'UTF8')),'hex') <> '2a4134f23aa2409af4ca8ca0e94936e3fdbf03761c0ba7df4a99a2b9e0420005'
     OR encode(sha256(convert_to(s4,'UTF8')),'hex') <> '97673b20153679e09f42f858d0e5b2ee4d2db559f5580244bb6c266f781f165c' THEN
    RAISE EXCEPTION 'MIS_G7_S7B_SOURCE_DRIFT: installed signer/packer differ from the accepted S2/S4 source';
  END IF;
END $guard$;

DO $patch$
DECLARE
  items text[][] := ARRAY[
    ARRAY['public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)', 'sign',
          '2a4134f23aa2409af4ca8ca0e94936e3fdbf03761c0ba7df4a99a2b9e0420005', 'acf7560122b81a53429518a7adbbe2a7594a7338b5762c583f939f536b36d194'],
    ARRAY['public.mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb)', 'pack',
          '97673b20153679e09f42f858d0e5b2ee4d2db559f5580244bb6c266f781f165c', 'e663eeaab6a0aafbbdc8e35ae0484f331e0236e4e431a6ab505031006856aef2']];
  old_sign constant text := $old1$    IF (SELECT coalesce(sum(qty_base), 0) FROM public.fg_bulk_stock_ledger
         WHERE product_id = p_product_id AND batch_number = v_batch AND qty_base > 0) < p_measured_qty_base THEN
      RETURN jsonb_build_object('ok', false, 'code', 'FG_RECEIPT_EVIDENCE_MISSING', 'detail', 'ledger holds less positive stock than measured');
    END IF;
$old1$;
  new_sign constant text := $new1$    -- S7b: the certified receipt is tied to the exact FG work-log source record (see app_private.mis_g7_fg_receipt)
    IF app_private.mis_g7_fg_receipt(p_product_id, v_batch, p_work_log_id)->>'code' = 'LEDGER_MISMATCH' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'FG_RECEIPT_LEDGER_MISMATCH', 'log_qty', app_private.mis_g7_fg_receipt(p_product_id, v_batch, p_work_log_id)->'log_qty', 'ledger_net_base', app_private.mis_g7_fg_receipt(p_product_id, v_batch, p_work_log_id)->'ledger_net_base');
    END IF;
    IF app_private.mis_g7_fg_receipt(p_product_id, v_batch, p_work_log_id)->>'ok' <> 'true' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'FG_RECEIPT_EVIDENCE_MISSING', 'detail', 'no ledger receipt posted for this work log', 'receipt', app_private.mis_g7_fg_receipt(p_product_id, v_batch, p_work_log_id)->>'code');
    END IF;
$new1$;
  old_pack constant text := $old2$  IF NOT EXISTS (SELECT 1 FROM public.fg_bulk_stock_ledger WHERE product_id = v_prod.id AND batch_number = v_batch AND qty_base > 0) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FG_RECEIPT_MISSING'); END IF;
$old2$;
  new_pack constant text := $new2$  -- S7b: receipt evidence = exact ledger source of the SIGNED stage's work log (not any positive stock)
  IF app_private.mis_g7_fg_receipt(v_prod.id, v_batch, v_se.wl)->>'ok' <> 'true' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FG_RECEIPT_MISSING', 'receipt', app_private.mis_g7_fg_receipt(v_prod.id, v_batch, v_se.wl)->>'code'); END IF;
$new2$;
  i int; d text; n text; o text; nw text; sig text; kind text;
BEGIN
  FOR i IN 1..2 LOOP
    sig := items[i][1]; kind := items[i][2];
    o := CASE kind WHEN 'sign' THEN old_sign ELSE old_pack END; nw := CASE kind WHEN 'sign' THEN new_sign ELSE new_pack END;
    d := pg_get_functiondef(sig::regprocedure);
    INSERT INTO app_private.mis_g7_s7_baseline (obj, def, sha256) VALUES (sig, d, encode(sha256(convert_to(d,'UTF8')),'hex')) ON CONFLICT (obj) DO NOTHING;
    IF (length(d) - length(replace(d, o, ''))) / length(o) <> 1 THEN RAISE EXCEPTION 'MIS_G7_S7B_PATCH_ANCHOR: expected exactly one occurrence in %', sig; END IF;
    n := replace(d, o, nw);
    EXECUTE n;
    IF encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid = sig::regprocedure),'UTF8')),'hex') <> items[i][4] THEN
      RAISE EXCEPTION 'MIS_G7_S7B_PATCH_RESULT: patched % does not match the accepted result', sig; END IF;
  END LOOP;
END $patch$;
