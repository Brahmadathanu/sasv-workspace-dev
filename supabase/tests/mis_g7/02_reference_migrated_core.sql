-- REFERENCE migrated core used ONLY by tests: the shim's reconstructed legacy __core body with the two S5 primitives added
-- (begin right after the row lock, finish after the last write). The real core must be migrated the same way ONLY after its
-- live source (sha256 df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec) has been reviewed.
CREATE OR REPLACE FUNCTION public.rpc_update_daily_work_log_with_packaging__core(p_work_log_id bigint, p_status text, p_sku_breakdown text, p_event_type text, p_storage_qty numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','pg_temp' AS $$
DECLARE v_old numeric; v_pid int; v_item text; v_act text; v_hdr bigint; v_part text; v_bn text;
BEGIN
  SELECT item, activity, storage_qty, batch_number INTO v_item, v_act, v_old, v_bn FROM public.daily_work_log WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'work log % not found', p_work_log_id; END IF;
  PERFORM app_private.mis_g7_chain_replace_begin(p_work_log_id);
  IF p_storage_qty IS NOT NULL AND v_act = 'FG bulk storage' THEN
    SELECT id INTO v_pid FROM public.products WHERE item = v_item;
    IF p_storage_qty <> coalesce(v_old, 0) THEN
      INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id)
      VALUES (v_pid, v_bn, CURRENT_DATE, p_storage_qty - coalesce(v_old,0), p_storage_qty - coalesce(v_old,0), 'kg', 'FG source correction', 'daily_work_log', p_work_log_id);
    END IF;
    UPDATE public.daily_work_log SET storage_qty = p_storage_qty WHERE id = p_work_log_id;
  END IF;
  DELETE FROM public.event_skus WHERE packaging_event_id IN (SELECT id FROM public.packaging_events WHERE work_log_id = p_work_log_id);
  DELETE FROM public.packaging_events WHERE work_log_id = p_work_log_id;
  UPDATE public.daily_work_log SET status = p_status WHERE id = p_work_log_id;
  IF p_status = 'Done' AND p_sku_breakdown IS NOT NULL AND btrim(p_sku_breakdown) <> '' THEN
    INSERT INTO public.packaging_events(work_log_id, event_type) VALUES (p_work_log_id, p_event_type::public.citext) RETURNING id INTO v_hdr;
    FOREACH v_part IN ARRAY string_to_array(p_sku_breakdown, ',') LOOP
      INSERT INTO public.event_skus(packaging_event_id, sku_id, "count") VALUES (v_hdr, split_part(v_part, ':', 1)::bigint, split_part(v_part, ':', 2)::int);
    END LOOP;
  END IF;
  PERFORM app_private.mis_g7_chain_replace_finish(p_work_log_id);
END $$;
