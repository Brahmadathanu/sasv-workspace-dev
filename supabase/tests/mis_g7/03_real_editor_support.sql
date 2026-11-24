-- TEST-ONLY helpers for the EXACT live DWL editor (wrapper/core/parser installed from the committed production reference).
-- t_edit_dwl: SECURITY INVOKER (the caller's role/JWT context applies to the real SECURITY DEFINER wrapper) that overlays a jsonb
-- patch on the current daily_work_log row and calls the real 30-argument wrapper with every column value.
CREATE FUNCTION public.t_edit_dwl(p_id bigint, p_patch jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(daily_work_log_id bigint, packaging_event_id bigint, inserted_event_sku_count integer)
LANGUAGE plpgsql AS $$
DECLARE d public.daily_work_log; r public.daily_work_log;
BEGIN
  SELECT * INTO d FROM public.daily_work_log WHERE id = p_id;
  IF NOT FOUND THEN d.id := p_id; END IF;      -- let the wrapper raise "No daily_work_log row found" for unknown ids
  r := jsonb_populate_record(NULL::public.daily_work_log, to_jsonb(d) || coalesce(p_patch, '{}'::jsonb));
  RETURN QUERY SELECT * FROM public.rpc_update_daily_work_log_with_packaging(r.id, r.log_date, r.section_id, r.subsection_id, r.area_id, r.plant_id, r.item,
    r.batch_number, r.batch_size, r.batch_uom, r.activity, r.juice_or_decoction, r.specify, r.count_of_saravam, r.fuel, r.fuel_under, r.fuel_over,
    r.started_on, r.due_date, r.status, r.completed_on, r.qty_after_process, r.qty_uom, r.remarks, r.lab_ref_number, r.sku_breakdown,
    r.storage_qty, r.storage_qty_uom, r.rm_juice_qty, r.rm_juice_uom);
END $$;
GRANT EXECUTE ON FUNCTION public.t_edit_dwl(bigint, jsonb) TO authenticated;
-- Real-flow batch: FG bulk storage row (the DWL trigger posts the receipt, like live) + a packaging work log (activity = lkp code Bottling,
-- not Done, no chain yet). Returns the packaging work log id.
CREATE FUNCTION public.t_mkbatch_real(p_bn text, p_qty numeric, p_act text DEFAULT 'Bottling') RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE w bigint; f bigint; BEGIN
  INSERT INTO public.bmr_details(id,product_id,bn,lifecycle_status) VALUES ((SELECT coalesce(max(id),1000)+1 FROM public.bmr_details),1,p_bn,'Released');
  INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status,storage_qty,storage_qty_uom)
    VALUES ('P1',p_bn,'FG bulk storage','2026-11-10','Done',p_qty,'kg') RETURNING id INTO w;
  INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status) VALUES ('P1',p_bn,p_act,'2026-11-11','In Progress') RETURNING id INTO f;
  RETURN f; END $$;
