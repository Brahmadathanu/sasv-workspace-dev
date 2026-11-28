CREATE OR REPLACE FUNCTION public.proc_pr_add_line_pec_internal(p_pr_id bigint, p_material_class_id bigint, p_stock_item_id bigint, p_uom_id bigint, p_requested_qty numeric DEFAULT 0, p_reason text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
declare
  v_kind text;
  v_line_id bigint;
  v_status text;
  v_header_class bigint;
begin
  if p_pr_id is null then raise exception 'p_pr_id is required'; end if;
  if p_material_class_id is null then raise exception 'p_material_class_id is required'; end if;
  if p_stock_item_id is null then raise exception 'p_stock_item_id is required'; end if;
  if p_uom_id is null then raise exception 'p_uom_id is required'; end if;

  select status, material_class_id into v_status, v_header_class
  from public.proc_pr_header
  where pr_id = p_pr_id
  for update;

  if v_status is null then raise exception 'PR not found: %', p_pr_id; end if;
  if v_status <> 'draft' then
    raise exception 'PR is not editable in status %', v_status;
  end if;

  IF v_header_class IS NOT NULL AND p_material_class_id IS DISTINCT FROM v_header_class THEN
    RAISE EXCEPTION 'PR material class is fixed to %', v_header_class;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.v_inv_stock_item_with_class sic WHERE sic.stock_item_id=p_stock_item_id AND sic.category_id=p_material_class_id AND sic.active=true AND sic.default_uom_id=p_uom_id) THEN
    RAISE EXCEPTION 'Stock item must be active and match the PR material class and default UOM';
  END IF;

  -- Internal bulk/semi-finished materials cannot gain a positive new or
  -- increased external PR commitment. Legacy draft reductions remain possible.
  IF p_material_class_id=1 AND EXISTS (
    SELECT 1 FROM public.v_inv_stock_item_with_class sic
    WHERE sic.stock_item_id=p_stock_item_id
      AND sic.subcategory_code IN ('finished_bulk_material','semifinished_goods')
  ) THEN
    IF coalesce(p_requested_qty,0) > coalesce((
      SELECT l.requested_qty FROM public.proc_pr_line l
      WHERE l.pr_id=p_pr_id AND l.material_class_id=p_material_class_id
        AND l.stock_item_id=p_stock_item_id AND l.uom_id=p_uom_id
      FOR UPDATE
    ),0) AND coalesce(p_requested_qty,0)>0 THEN
      RAISE EXCEPTION 'New or increased external PR quantity is prohibited for internal finished-bulk/semi-finished stock item %',p_stock_item_id;
    END IF;
  END IF;

  v_kind := public.proc_material_kind_for_class(p_material_class_id);

  insert into public.proc_pr_line (
    pr_id,
    material_class_id,
    material_kind,
    stock_item_id,
    uom_id,
    system_suggested_qty,
    requested_qty,
    manual_delta_qty,
    manual_reason
  )
  values (
    p_pr_id,
    p_material_class_id,
    v_kind,
    p_stock_item_id,
    p_uom_id,
    0,
    coalesce(p_requested_qty, 0),
    0,
    nullif(trim(p_reason), '')
  )
  on conflict (pr_id, material_class_id, stock_item_id, uom_id)
  do update set
    material_class_id = excluded.material_class_id,
    requested_qty     = excluded.requested_qty,
    manual_reason     = coalesce(excluded.manual_reason, public.proc_pr_line.manual_reason),
    updated_at        = now()
  returning pr_line_id into v_line_id;

  update public.proc_pr_header
  set updated_at = now(), updated_by = auth.uid()
  where pr_id = p_pr_id;

  return v_line_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.proc_pec_s5_generate_pr(p_pr_number text, p_effective_from_date date, p_horizon_start_month date, p_horizon_end_month date, p_material_class_id integer, p_rm_scope text, p_method text, p_compare_history boolean, p_generation_filters jsonb, p_notes text, p_expected_plan_signature text, p_confirm boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
 v_id bigint;
 v_scope text := coalesce(nullif(btrim(p_rm_scope),''),'normal');
 v_review jsonb;v_rows jsonb;v_signature text;
 v_auto integer;v_total integer;v_review_count integer;
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',true);
  IF p_confirm IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit confirmed S5 review is required';
  END IF;
  IF p_pr_number IS NULL OR length(btrim(p_pr_number))<3
    OR p_effective_from_date IS NULL
    OR p_horizon_start_month IS NULL OR p_horizon_end_month IS NULL
    OR p_expected_plan_signature IS NULL
    OR p_expected_plan_signature !~ '^[0-9a-f]{32}$'
  THEN RAISE EXCEPTION 'Valid PR number, effective date and current plan signature are required'; END IF;
  IF p_material_class_id IS NULL OR p_material_class_id NOT IN (1,2,5)
    OR p_method IS NULL OR p_method NOT IN ('plan','hybrid') THEN
    RAISE EXCEPTION 'Unsupported S5 class or method';
  END IF;

  -- Shared existing S4/JIT lock and exact-horizon/scope duplicate policy.
  PERFORM pg_advisory_xact_lock(hashtext('PEC_S4_HORIZON'),
    hashtext(p_horizon_start_month::text||':'||p_horizon_end_month::text));
  IF EXISTS (
    SELECT 1 FROM public.proc_pr_header h
    WHERE h.status IN ('draft','active')
      AND h.horizon_start_month=p_horizon_start_month
      AND h.horizon_end_month=p_horizon_end_month
      AND (h.material_class_id IS NULL OR h.material_class_id=p_material_class_id)
      AND (p_material_class_id<>1 OR h.material_class_id IS NULL
        OR v_scope='all' OR coalesce(h.generation_filters->>'rm_scope','all')='all'
        OR coalesce(h.generation_filters->>'rm_scope','all')=v_scope)
  ) THEN
    RAISE EXCEPTION 'Existing active or draft PR for the same class and horizon; review or reconcile it instead';
  END IF;

  v_review:=public.proc_pec_s5_review_plan(
    p_horizon_start_month,p_horizon_end_month,p_material_class_id,
    v_scope,p_method,p_compare_history);
  v_signature:=v_review->>'plan_signature';
  v_rows:=v_review->'rows';
  v_total:=coalesce(jsonb_array_length(v_rows),0);
  IF v_total=0 THEN RAISE EXCEPTION 'No valid planning candidates for this class and horizon'; END IF;
  IF v_signature IS DISTINCT FROM p_expected_plan_signature THEN
    RAISE EXCEPTION 'Planning evidence changed since review; refresh and reconfirm the draft';
  END IF;

  -- No untrusted filter key controls actual class, scope or calculation.
  INSERT INTO public.proc_pr_header(
    pr_number,status,effective_from_date,horizon_start_month,horizon_end_month,
    material_class_id,generation_filters,notes,created_by,updated_by
  ) VALUES (
    btrim(p_pr_number),'draft',p_effective_from_date,
    p_horizon_start_month,p_horizon_end_month,p_material_class_id,
    (coalesce(p_generation_filters,'{}'::jsonb)
      - 'rm_scope' - 'method' - 'source' - 's4_mode' - 's5_mode'
      - 'plan_signature' - 'history_comparison')
       || jsonb_build_object(
         'rm_scope',CASE WHEN p_material_class_id=1 THEN v_scope ELSE NULL END,'method',p_method,'source','s5_unified',
         's5_mode',p_method,'history_comparison',coalesce(p_compare_history,false),
         'plan_signature',v_signature,'s5_generated_at',now(),
         's5_automatic',true),
    nullif(btrim(p_notes),''),auth.uid(),auth.uid()
  ) RETURNING pr_id INTO v_id;

  -- Immutable per-candidate audit evidence, including class/method and origin.
  INSERT INTO public.proc_pr_ccf_generation_evidence(
     pr_id,material_class_id,stock_item_id,uom_id,baseline_mrp_qty,
     recommended_qty,decision,evidence
  )
  SELECT v_id,p_material_class_id,(x->>'stock_item_id')::bigint,
    (x->>'uom_id')::bigint,
    CASE WHEN p_material_class_id=5 THEN 0
         ELSE coalesce((x->>'mrp_net_qty')::numeric,0) END,
    (x->>'recommended_qty')::numeric,x->>'gate',
    x || jsonb_build_object('s5_plan_signature',v_signature,'s5_frozen_at',now())
  FROM jsonb_array_elements(v_rows) x;

  -- Direct insertion is intentional: IND has no production-MRP source.
  -- Review-required material lines are present at qty 0, never auto-purchased.
  INSERT INTO public.proc_pr_line(
    pr_id,material_class_id,stock_item_id,uom_id,system_suggested_qty,
    requested_qty,manual_delta_qty,manual_reason
  )
  SELECT v_id,p_material_class_id,(x->>'stock_item_id')::bigint,
     (x->>'uom_id')::bigint,
     CASE WHEN x->>'gate'='AUTO_ELIGIBLE'
       THEN coalesce((x->>'recommended_qty')::numeric,0) ELSE 0 END,
     CASE WHEN x->>'gate'='AUTO_ELIGIBLE'
       THEN coalesce((x->>'recommended_qty')::numeric,0) ELSE 0 END,
     0,NULL
  FROM jsonb_array_elements(v_rows) x;

  SELECT count(*) FILTER (WHERE decision='AUTO_ELIGIBLE'),
     count(*) FILTER (WHERE decision<>'AUTO_ELIGIBLE')
    INTO v_auto,v_review_count
  FROM public.proc_pr_ccf_generation_evidence WHERE pr_id=v_id;
  IF (v_auto+v_review_count) IS DISTINCT FROM v_total THEN
    RAISE EXCEPTION 'Frozen evidence mismatch; all PR changes are rolled back';
  END IF;
  RETURN jsonb_build_object(
     'pr_id',v_id,'pr_number',btrim(p_pr_number),'status','draft',
     'mode','s5_unified','method',p_method,
     'material_class_id',p_material_class_id,'rm_scope',CASE WHEN p_material_class_id=1 THEN v_scope ELSE NULL END,
     'plan_signature',v_signature,'total_candidates',v_total,
     'auto_evidenced_lines',v_auto,'review_required_lines',v_review_count);
END;
$function$;
CREATE OR REPLACE VIEW public.v_proc_pr_header AS WITH line_tot AS (
         SELECT l.pr_id,
            count(*)::integer AS line_count,
            sum(COALESCE(l.requested_qty, 0::numeric) + COALESCE(l.manual_delta_qty, 0::numeric)) AS total_final_qty
           FROM proc_pr_line l
          GROUP BY l.pr_id
        )
 SELECT h.pr_id,
    h.pr_number,
    h.status,
    h.effective_from_date,
    h.horizon_start_month,
    h.horizon_end_month,
    h.material_class_id,
    c.code AS material_class_code,
    c.label AS material_class_label,
    h.generation_filters,
    h.notes,
    h.created_at,
    h.created_by,
    h.updated_at,
    h.updated_by,
    COALESCE(lt.line_count, 0) AS line_count,
    COALESCE(lt.total_final_qty, 0::numeric) AS total_final_qty,
        CASE
            WHEN c.code IS NOT NULL AND c.label IS NOT NULL THEN (c.code || ' - '::text) || c.label
            WHEN c.label IS NOT NULL THEN c.label
            WHEN c.code IS NOT NULL THEN c.code
            WHEN h.material_class_id IS NOT NULL THEN 'Class ID: '::text || h.material_class_id::text
            ELSE '—'::text
        END AS material_class_display,
    CASE WHEN h.material_class_id=1 THEN NULLIF(TRIM(BOTH FROM h.generation_filters ->> 'rm_scope'::text), ''::text) ELSE NULL::text END AS rm_scope,
        CASE WHEN h.material_class_id=1 THEN CASE NULLIF(TRIM(BOTH FROM h.generation_filters ->> 'rm_scope'::text), ''::text)
            WHEN 'normal'::text THEN 'Normal RM'::text
            WHEN 'jit'::text THEN 'JIT RM'::text
            WHEN 'all'::text THEN 'All RM'::text
            ELSE NULL::text
        END ELSE NULL::text END AS rm_scope_label
   FROM proc_pr_header h
     LEFT JOIN inv_class_category c ON c.id = h.material_class_id
     LEFT JOIN line_tot lt ON lt.pr_id = h.pr_id;
UPDATE public.proc_pr_header SET generation_filters=generation_filters-'rm_scope' WHERE material_class_id IN (2,5) AND generation_filters ? 'rm_scope';
