-- G7 S7 candidate, NOT A MIGRATION / NOT APPLIED.
-- Requires isolated acceptance before promotion. Preserve S2-S6 byte-for-byte.
-- IDs: positive base-step IDs; negative added override IDs. Positive product route
-- IDs; negative inherited family-route IDs. These namespaces are separate.
-- Never reinterpret existing signatures: this transition is allowed only with
-- an empty signed-stage event table. No permission assignments.
DO $guard$
BEGIN
  IF (SELECT mode FROM app_private.mis_g7_enforcement) IS DISTINCT FROM 'AUDIT'
     OR EXISTS (SELECT 1 FROM app_private.mis_batch_stage_event)
     OR EXISTS (SELECT 1 FROM public.user_permissions_canonical
       WHERE target LIKE 'module:mis-%' AND (can_view OR can_edit)) THEN
    RAISE EXCEPTION 'MIS_G7_S7_PRECONDITION';
  END IF;
  IF encode(sha256(convert_to(pg_get_functiondef(
       'app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'::regprocedure),'UTF8')),'hex')
       <> '6d89aa0f224a74374d016d787d671c9c5dc2be48631a328e4e7ad21e3b5ff0'
     OR encode(sha256(convert_to(pg_get_functiondef(
       'app_private.mis_stage_fp(integer,text,integer,bigint,integer)'::regprocedure),'UTF8')),'hex')
       <> 'd438e858f03325bfbecc6f564999bd359d81d7ee24ecf2a4b7c98a92dab359d4' THEN
    RAISE EXCEPTION 'MIS_G7_S7_SOURCE_DRIFT';
  END IF;
  IF EXISTS (SELECT 1 FROM costing.production_route_family_route_step WHERE id<=0)
     OR EXISTS (SELECT 1 FROM costing.product_process_route_override WHERE id<=0)
     OR EXISTS (SELECT 1 FROM costing.product_process_route WHERE id<=0)
     OR EXISTS (SELECT 1 FROM costing.production_route_family_route WHERE id<=0) THEN
    RAISE EXCEPTION 'MIS_G7_S7_ID_NAMESPACE_COLLISION';
  END IF;
END $guard$;

-- Private authoritative route context shared by read and write paths.
CREATE OR REPLACE FUNCTION app_private.mis_g7_route_context(p_product_id integer,p_batch text,p_work_log_id integer)
RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public,costing,pg_temp AS $f$
DECLARE w record; b integer; nb bigint; nr bigint; v jsonb; steps jsonb; route bigint; fg bigint;
BEGIN
  SELECT d.id,d.log_date,d.activity,d.status,d.storage_qty,d.storage_qty_uom,p.id pid,d.batch_number
    INTO w FROM public.daily_work_log d JOIN public.products p ON p.item=d.item WHERE d.id=p_work_log_id;
  IF w.id IS NULL OR w.pid IS DISTINCT FROM p_product_id OR w.batch_number IS DISTINCT FROM p_batch
     OR w.log_date IS NULL OR coalesce(btrim(p_batch),'')='' THEN
    RETURN jsonb_build_object('ok',false,'code','WORK_LOG_IDENTITY_MISMATCH');
  END IF;
  SELECT count(*),min(id) INTO nb,b FROM public.bmr_details WHERE product_id=p_product_id AND bn=p_batch;
  IF nb<>1 THEN RETURN jsonb_build_object('ok',false,'code','BMR_IDENTITY_REVIEW'); END IF;
  SELECT count(*) INTO nr FROM costing.product_process_route
   WHERE product_id=p_product_id AND archived_at IS NULL AND status='APPROVED'
     AND effective_from<=w.log_date AND (effective_to IS NULL OR effective_to>=w.log_date);
  IF nr>1 THEN RETURN jsonb_build_object('ok',false,'code','APPROVED_ROUTE_OVERLAP'); END IF;
  v:=costing.fn_validate_effective_product_process_route(p_product_id,w.log_date);
  IF NOT coalesce((v->>'valid')::boolean,false) THEN
    RETURN jsonb_build_object('ok',false,'code','PRODUCT_ROUTE_COVERAGE','validation',v);
  END IF;
  route:=coalesce((v->>'product_route_id')::bigint,-(v->>'family_route_id')::bigint);
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'route_step_id',coalesce(e.base_step_id,-e.override_id)::text,
    'effective_step_key',e.effective_step_key,'activity_name',a.activity_name,
    'sequence_no',e.sequence_no,'is_mandatory',e.is_mandatory,'allows_repeat',e.allows_repeat,
    'expected_occurrence_count',e.expected_occurrence_count,'source_type',e.source_type,
    'stage_role',case when a.activity_name='FG bulk storage' then 'FG_BULK' else 'OTHER' end,
    'activity_matches',a.activity_name=w.activity) ORDER BY e.sequence_no,e.effective_step_key),'[]'::jsonb),
    count(*) FILTER (WHERE a.activity_name='FG bulk storage' AND e.is_mandatory)
    INTO steps,fg FROM costing.fn_effective_product_process_steps(p_product_id,w.log_date) e
    JOIN public.activities a ON a.id=e.activity_id;
  IF route IS NULL OR fg<>1 THEN RETURN jsonb_build_object('ok',false,'code','MANDATORY_FG_STAGE_GAP'); END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(steps) e WHERE e->>'route_step_id' IS NULL)
     OR (SELECT count(DISTINCT e->>'route_step_id') FROM jsonb_array_elements(steps) e)<>jsonb_array_length(steps) THEN
    RETURN jsonb_build_object('ok',false,'code','STEP_NOT_IN_EFFECTIVE_ROUTE');
  END IF;
  RETURN jsonb_build_object('ok',true,'code','OK','bmr_id',b,'route_id',route::text,
    'route_source',v->>'route_source','work_log_id',w.id,'log_date',w.log_date,
    'activity',w.activity,'status',w.status,'storage_qty',w.storage_qty,'storage_uom',w.storage_qty_uom,'steps',steps);
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_route_context(integer,text,integer) FROM PUBLIC,anon,authenticated;

-- Preserve signature and S6 fingerprint call chain. No historical evidence rewrite.
CREATE OR REPLACE FUNCTION app_private.mis_resolve_batch_stage(p_product_id integer,p_batch text,p_work_log_id integer,p_route_step_id bigint)
RETURNS TABLE(code text,bmr_id integer,route_id bigint,route_step_id bigint,stage_role text,activity_name text,
 wl_log_date date,wl_status text,wl_storage_qty numeric,wl_storage_uom text)
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public,costing,pg_temp AS $f$
DECLARE ctx jsonb; st jsonb;
BEGIN
  ctx:=app_private.mis_g7_route_context(p_product_id,p_batch,p_work_log_id);
  code:=ctx->>'code'; bmr_id:=(ctx->>'bmr_id')::integer; route_id:=(ctx->>'route_id')::bigint;
  wl_log_date:=(ctx->>'log_date')::date; wl_status:=ctx->>'status';
  wl_storage_qty:=(ctx->>'storage_qty')::numeric; wl_storage_uom:=ctx->>'storage_uom';
  IF code='OK' THEN
    SELECT e INTO st FROM jsonb_array_elements(ctx->'steps') e WHERE (e->>'route_step_id')::bigint=p_route_step_id;
    IF st IS NULL THEN code:='STEP_NOT_IN_EFFECTIVE_ROUTE';
    ELSIF NOT coalesce((st->>'activity_matches')::boolean,false) THEN code:='ACTIVITY_STEP_MISMATCH';
    ELSE route_step_id:=p_route_step_id; stage_role:=st->>'stage_role'; activity_name:=st->>'activity_name';
    END IF;
  END IF;
  RETURN NEXT;
END $f$;
REVOKE ALL ON FUNCTION app_private.mis_resolve_batch_stage(integer,text,integer,bigint) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.mis_get_batch_route_context_v1(p_product_id integer,p_batch text,p_work_log_id integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $f$
BEGIN
  PERFORM public.require_permission('module:mis-batch-stage-signer',false);
  RETURN app_private.mis_g7_route_context(p_product_id,p_batch,p_work_log_id);
END $f$;

CREATE OR REPLACE FUNCTION app_private.mis_g7_batch_stage_status(p_product_id integer,p_batch text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $f$
SELECT jsonb_build_object('ok',true,'product_id',p_product_id,'batch_number',p_batch,
  'fg_bulk_state',case app_private.mis_g7_stage_problem(p_product_id,p_batch)
    when 'CHAIN_STAGE_NOT_SIGNED' then 'UNSIGNED' when 'CHAIN_STAGE_SOURCE_CHANGED' then 'SOURCE_CHANGED'
    when 'CHAIN_BATCH_IDENTITY_MISSING' then 'NOT_VERIFIED' else 'SIGNED' end,
  'events',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'event_id',s.event_id::text,'event_kind',s.event_kind,'route_id',s.route_id::text,'route_step_id',s.route_step_id::text,
    'step_occurrence',s.step_occurrence,'work_log_id',s.work_log_id,'stage_role',s.stage_role,'signed_at',s.signed_at,
    'corrects_event_id',s.corrects_event_id::text,'measured_qty_base',s.measured_qty_base,'measured_uom',s.measured_uom,
    'state',case when s.event_kind='CORRECTION' then 'CORRECTION'
      when exists(select 1 from app_private.mis_batch_stage_event c where c.corrects_event_id=s.event_id) then 'CORRECTED'
      when app_private.mis_stage_fp(s.product_id,s.batch_number,s.work_log_id,s.route_step_id,s.step_occurrence)
         IS DISTINCT FROM s.source_fingerprint then 'SOURCE_CHANGED' else 'SIGNED' end)
    order by s.event_id) FROM app_private.mis_batch_stage_event s WHERE s.product_id=p_product_id AND s.batch_number=p_batch),'[]'::jsonb))
$f$;
REVOKE ALL ON FUNCTION app_private.mis_g7_batch_stage_status(integer,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.mis_get_batch_stage_status_v1(p_product_id integer,p_batch text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $f$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.app_has_permission('module:mis-batch-stage-signer','view')
    OR public.app_has_permission('module:mis-fg-bulk-packing','view')
    OR public.app_has_permission('module:executive-mis-dashboard','view')) THEN
    RAISE EXCEPTION 'MIS_G7_PERMISSION_DENIED' USING ERRCODE='42501';
  END IF;
  IF p_product_id IS NULL OR coalesce(btrim(p_batch),'')='' THEN RETURN jsonb_build_object('ok',false,'code','INVALID_INPUT'); END IF;
  RETURN app_private.mis_g7_batch_stage_status(p_product_id,p_batch);
END $f$;

-- Preview is advisory; writer RPC remains authoritative and revalidates under its locks.
-- Both modes use the same legacy unit conversion, event multiplier and exact ledger source basis.
CREATE OR REPLACE FUNCTION public.mis_preview_pack_fg_bulk_v1(p_packaging_event_id bigint,p_lines jsonb DEFAULT NULL,
 p_event_sku_id bigint DEFAULT NULL,p_new_count integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $f$
DECLARE h record; l record; x record; sku record; n integer; v_required numeric:=0; v_available numeric;
 v_per numeric; v_old numeric; v_posted numeric; v_problem text; v_basis boolean;
BEGIN
  PERFORM public.require_permission('module:mis-fg-bulk-packing',false);
  SELECT pe.id,p.id pid,p.uom_base,p.conversion_to_base,w.batch_number,e.affects_bulk_stock,e.is_packaging,e.active
    INTO h FROM public.packaging_events pe JOIN public.daily_work_log w ON w.id=pe.work_log_id
    JOIN public.products p ON p.item=w.item JOIN public.event_type_lkp e ON e.label=pe.event_type
    WHERE pe.id=p_packaging_event_id;
  IF h.id IS NULL OR coalesce(btrim(h.batch_number),'')='' THEN RETURN jsonb_build_object('ok',false,'code','BATCH_IDENTITY_MISSING'); END IF;
  IF NOT h.active OR NOT h.is_packaging OR h.affects_bulk_stock>=0 THEN
    RETURN jsonb_build_object('ok',false,'code','EVENT_NOT_DEPLETING'); END IF;
  SELECT coalesce(sum(qty_base),0) INTO v_available FROM public.fg_bulk_stock_ledger
    WHERE product_id=h.pid AND batch_number=h.batch_number;
  v_problem:=app_private.mis_g7_stage_problem(h.pid,h.batch_number);
  IF p_event_sku_id IS NOT NULL THEN
    IF p_lines IS NOT NULL OR p_new_count IS NULL OR p_new_count<0 THEN RETURN jsonb_build_object('ok',false,'code','INVALID_INPUT'); END IF;
    SELECT es.id,es.sku_id,es."count" cnt INTO l FROM public.event_skus es
      WHERE es.id=p_event_sku_id AND es.packaging_event_id=h.id;
    IF l.id IS NULL THEN RETURN jsonb_build_object('ok',false,'code','CORRECTION_LINE_NOT_FOUND'); END IF;
    p_lines:=jsonb_build_array(jsonb_build_object('sku_id',l.sku_id,'count',p_new_count));
  ELSE
    IF p_new_count IS NOT NULL OR p_lines IS NULL OR jsonb_typeof(p_lines)<>'array' THEN RETURN jsonb_build_object('ok',false,'code','INVALID_INPUT'); END IF;
    IF jsonb_array_length(p_lines)=0 OR jsonb_array_length(p_lines)>500 THEN RETURN jsonb_build_object('ok',false,'code','INVALID_INPUT'); END IF;
  END IF;
  BEGIN
    IF (SELECT count(DISTINCT (e->>'sku_id')::bigint) FROM jsonb_array_elements(p_lines)e)<>jsonb_array_length(p_lines) THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_INPUT'); END IF;
    FOR x IN SELECT (e->>'sku_id')::bigint sid,(e->>'count')::integer cnt FROM jsonb_array_elements(p_lines)e LOOP
      IF x.cnt IS NULL OR x.cnt<0 OR (p_event_sku_id IS NULL AND x.cnt=0) THEN RETURN jsonb_build_object('ok',false,'code','INVALID_INPUT'); END IF;
      SELECT id,product_id,pack_size,uom INTO sku FROM public.product_skus WHERE id=x.sid;
      IF sku.id IS NULL OR sku.product_id IS DISTINCT FROM h.pid THEN RETURN jsonb_build_object('ok',false,'code','SKU_PRODUCT_MISMATCH'); END IF;
      IF sku.pack_size IS NULL OR sku.pack_size<=0 THEN RETURN jsonb_build_object('ok',false,'code','SKU_PACK_SIZE_INVALID'); END IF;
      v_per:=sku.pack_size*case when sku.uom=h.uom_base then 1 else h.conversion_to_base end*(-h.affects_bulk_stock);
      IF v_per IS NULL OR v_per<=0 THEN RETURN jsonb_build_object('ok',false,'code','SKU_CONVERSION_INVALID'); END IF;
      IF p_event_sku_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.event_skus WHERE packaging_event_id=h.id AND sku_id=x.sid) THEN RETURN jsonb_build_object('ok',false,'code','SKU_LINE_EXISTS'); END IF;
        v_required:=v_required+x.cnt*v_per;
      ELSE
        v_old:=l.cnt*v_per;
        SELECT coalesce(sum(qty_base),0) INTO v_posted FROM public.fg_bulk_stock_ledger
          WHERE source_table='event_skus' AND source_id=l.id AND product_id=h.pid AND batch_number=h.batch_number;
        v_basis:=v_posted=-v_old;
        v_required:=(x.cnt-l.cnt)*v_per;
      END IF;
    END LOOP;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_INPUT');
  END;
  RETURN jsonb_build_object('ok',true,'advisory',true,'product_id',h.pid,'batch_number',h.batch_number,'base_uom',h.uom_base,
    'available_base',v_available,'required_base',greatest(v_required,0),'stock_delta_base',-v_required,
    'shortfall_base',greatest(v_required-v_available,0),'stage_problem',v_problem,
    'has_depletion_basis',v_basis,'expected_posted_base',-v_old,'posted_base',v_posted,
    'excess_permitted',app_private.mis_g7_has_permission('module:mis-fg-bulk-packing') AND app_private.mis_g7_has_permission('module:mis-fg-excess-adjustment'));
END $f$;

-- Bounded live FG receipt / packing-evidence exception lens. Counts are batch-level
-- per category (not mutually exclusive). No synthetic unsigned stages or historical backfill.
CREATE OR REPLACE FUNCTION public.mis_get_governance_exception_summary_v1(p_from date,p_to date,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $f$
DECLARE result jsonb;
BEGIN
  PERFORM public.require_permission('module:executive-mis-dashboard',false);
  IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>92 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200
     OR p_offset IS NULL OR p_offset<0 THEN RETURN jsonb_build_object('ok',false,'code','INVALID_INPUT'); END IF;
  WITH logs AS MATERIALIZED (
    SELECT w.id,w.log_date,p.id pid,w.batch_number
      FROM public.daily_work_log w JOIN public.products p ON p.item=w.item
      WHERE w.log_date BETWEEN p_from AND p_to AND w.activity='FG bulk storage'
  ), batches AS MATERIALIZED (
    SELECT DISTINCT pid,batch_number FROM logs
    UNION SELECT DISTINCT p.id,w.batch_number FROM public.daily_work_log w JOIN public.products p ON p.item=w.item
      JOIN public.packaging_events pe ON pe.work_log_id=w.id JOIN public.event_type_lkp e ON e.label=pe.event_type
      WHERE w.log_date BETWEEN p_from AND p_to AND e.is_packaging AND e.affects_bulk_stock<0
  ), flags AS MATERIALIZED (
    SELECT b.pid,b.batch_number,case app_private.mis_g7_stage_problem(b.pid,b.batch_number)
      when 'CHAIN_STAGE_NOT_SIGNED' then 'UNSIGNED' when 'CHAIN_STAGE_SOURCE_CHANGED' then 'SOURCE_CHANGED'
      when 'CHAIN_BATCH_IDENTITY_MISSING' then 'NOT_VERIFIED' else 'SIGNED' end state
    FROM batches b
    UNION SELECT DISTINCT l.pid,l.batch_number,'MISSING_ROUTE' FROM logs l
      CROSS JOIN LATERAL (SELECT app_private.mis_g7_route_context(l.pid,l.batch_number,l.id::integer) ctx) c
      WHERE c.ctx->>'code' IN ('PRODUCT_ROUTE_COVERAGE','APPROVED_ROUTE_OVERLAP','MANDATORY_FG_STAGE_GAP','STEP_NOT_IN_EFFECTIVE_ROUTE')
    UNION SELECT b.pid,b.batch_number,'MISSING_RECEIPT' FROM batches b WHERE NOT EXISTS
      (SELECT 1 FROM public.fg_bulk_stock_ledger g WHERE g.product_id=b.pid AND g.batch_number=b.batch_number
        AND g.source_table='daily_work_log' AND g.qty_base>0)
    UNION SELECT DISTINCT p.id,w.batch_number,'NOT_VERIFIED' FROM public.daily_work_log w JOIN public.products p ON p.item=w.item
      JOIN public.packaging_events pe ON pe.work_log_id=w.id JOIN public.event_type_lkp e ON e.label=pe.event_type
      JOIN public.event_skus es ON es.packaging_event_id=pe.id
      WHERE w.log_date BETWEEN p_from AND p_to AND e.is_packaging AND e.affects_bulk_stock<0
        AND NOT EXISTS (SELECT 1 FROM public.fg_bulk_stock_ledger g WHERE g.source_table='event_skus' AND g.source_id=es.id
          AND g.product_id=p.id AND g.batch_number=w.batch_number AND g.qty_base<0)
  ), page AS (SELECT * FROM flags ORDER BY state,pid,batch_number LIMIT p_limit OFFSET p_offset)
  SELECT jsonb_build_object('ok',true,'scope','FG_RECEIPT_AND_DEPLETING_PACKAGING_BATCHES','from',p_from,'to',p_to,
    'count_unit','distinct product/batch per state; states can overlap','total_batches',(SELECT count(*) FROM batches),
    'counts',coalesce((SELECT jsonb_object_agg(state,n) FROM (SELECT state,count(*) n FROM flags GROUP BY state)s),'{}'::jsonb),
    'items',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY state,pid,batch_number) FROM page),'[]'::jsonb),
    'limit',p_limit,'offset',p_offset) INTO result;
  RETURN result;
END $f$;

REVOKE ALL ON FUNCTION public.mis_get_batch_route_context_v1(integer,text,integer),
 public.mis_get_batch_stage_status_v1(integer,text),public.mis_preview_pack_fg_bulk_v1(bigint,jsonb,bigint,integer),
 public.mis_get_governance_exception_summary_v1(date,date,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mis_get_batch_route_context_v1(integer,text,integer),
 public.mis_get_batch_stage_status_v1(integer,text),public.mis_preview_pack_fg_bulk_v1(bigint,jsonb,bigint,integer),
 public.mis_get_governance_exception_summary_v1(date,date,integer,integer) TO authenticated;

-- G-5 intentionally separate: reviewed registry proposal in this directory.
-- Do not apply until resolver identity, fingerprint, route validity, read/write parity,
-- exception classification, ACLs and rollback are tested against actual catalog.
