-- PEC S5 forward-only owner-authorized unified planning installation.
-- Source review branch: feat/pec-s5-unified-server-20261123.
-- Independently transaction-tested with synthetic-only PRs and no persisted writes.
-- PEC S5 server candidate A: IND planned requirement source.
-- NOT A DEPLOYABLE MIGRATION. This candidate is to be integrated with the complete
-- class-aware S5 planner/writer and tested before assigning a migration version.
-- Historic MRP RM/PM views and their recursive quantity semantics remain untouched.
CREATE TABLE IF NOT EXISTS public.proc_pec_ind_planned_requirement (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stock_item_id bigint NOT NULL REFERENCES public.inv_stock_item(id),
  uom_id bigint NOT NULL REFERENCES public.inv_uom(id),
  month_start date NOT NULL,
  gross_required_qty numeric NOT NULL CHECK (gross_required_qty >= 0),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT proc_pec_ind_plan_first_day_ck CHECK
    (month_start = date_trunc('month', month_start)::date),
  CONSTRAINT proc_pec_ind_plan_one_item_month_uk UNIQUE (stock_item_id, month_start)
);

COMMENT ON TABLE public.proc_pec_ind_planned_requirement IS
  'S5 governed operator-defined indirect material requirements, monthly and independent of production BOM demand; not historical consumption or automatic MRP.';
ALTER TABLE public.proc_pec_ind_planned_requirement ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proc_pec_ind_planned_requirement FROM PUBLIC, anon, authenticated;

-- A distinct IND source parallel to the existing
-- v_mrp_material_gross_requirement_rm and _pm components.
-- Do NOT union this directly into the existing RM/PM recursive MRP stock engine.
CREATE OR REPLACE VIEW public.v_mrp_material_gross_requirement_ind AS
SELECT 'indirect_material'::text AS material_kind,
       p.month_start,
       p.stock_item_id,
       p.uom_id,
       p.gross_required_qty,
       NULL::bigint AS seasonal_overlay_run_id,
       false AS conversion_applied,
       'operator_plan'::text AS requirement_source
FROM public.proc_pec_ind_planned_requirement p
JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=p.stock_item_id
WHERE p.is_active AND c.active AND c.category_id=5;
REVOKE ALL ON public.v_mrp_material_gross_requirement_ind FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.proc_pec_ind_set_planned_requirement(
  p_stock_item_id bigint, p_month_start date,
  p_gross_required_qty numeric, p_reason text, p_is_active boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public AS $fn$
DECLARE v_uom bigint; v_id bigint; v_month date;
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',true);
  v_month := date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')::date;
  IF p_stock_item_id IS NULL OR p_month_start IS NULL
    OR p_month_start<>date_trunc('month',p_month_start)::date
    OR p_month_start < v_month
    OR p_month_start > (v_month + interval '12 months')::date
    OR p_gross_required_qty IS NULL OR p_gross_required_qty<0
    OR length(btrim(coalesce(p_reason,'')))<10
    OR p_is_active IS NULL
  THEN RAISE EXCEPTION 'Invalid IND planned requirement or justification'; END IF;

  SELECT i.default_uom_id INTO v_uom
  FROM public.inv_stock_item i
  JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=i.id
  WHERE i.id=p_stock_item_id AND i.active AND c.active AND c.category_id=5;
  IF v_uom IS NULL THEN RAISE EXCEPTION 'Active IND item with a valid default UOM required'; END IF;

  INSERT INTO public.proc_pec_ind_planned_requirement
    (stock_item_id,uom_id,month_start,gross_required_qty,reason,is_active,created_by,updated_by)
  VALUES (p_stock_item_id,v_uom,p_month_start,p_gross_required_qty,btrim(p_reason),
          p_is_active,auth.uid(),auth.uid())
  ON CONFLICT (stock_item_id,month_start) DO UPDATE
  SET uom_id=excluded.uom_id,
      gross_required_qty=excluded.gross_required_qty,
      reason=excluded.reason,is_active=excluded.is_active,
      updated_at=now(),updated_by=auth.uid()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id',v_id,'stock_item_id',p_stock_item_id,
     'month_start',p_month_start,'gross_required_qty',p_gross_required_qty,
     'is_active',p_is_active);
END;
$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_ind_set_planned_requirement(bigint,date,numeric,text,boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_ind_set_planned_requirement(bigint,date,numeric,text,boolean)
  TO authenticated;
-- The planned-demand view is not public Data API content: expose through the
-- future S5 review RPC, guarded by the read-level PEC permission check.

-- Every change to a governed monthly plan has an append-only before/after audit.
CREATE TABLE IF NOT EXISTS public.proc_pec_ind_planned_requirement_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plan_id bigint NOT NULL REFERENCES public.proc_pec_ind_planned_requirement(id),
  event_kind text NOT NULL CHECK(event_kind IN ('INSERT','UPDATE')),
  old_row jsonb,
  new_row jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid
);
ALTER TABLE public.proc_pec_ind_planned_requirement_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proc_pec_ind_planned_requirement_audit FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.proc_pec_ind_plan_audit_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public AS $audit$
BEGIN
  INSERT INTO public.proc_pec_ind_planned_requirement_audit(
    plan_id,event_kind,old_row,new_row,changed_by)
  VALUES (NEW.id,TG_OP,
    CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW),auth.uid());
  RETURN NEW;
END;
$audit$;
REVOKE ALL ON FUNCTION public.proc_pec_ind_plan_audit_trg() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_proc_pec_ind_plan_audit
  ON public.proc_pec_ind_planned_requirement;
CREATE TRIGGER trg_proc_pec_ind_plan_audit
AFTER INSERT OR UPDATE ON public.proc_pec_ind_planned_requirement
FOR EACH ROW EXECUTE FUNCTION public.proc_pec_ind_plan_audit_trg();

-- Read permission is enforced at the RPC boundary; do not grant direct SELECT.
CREATE OR REPLACE FUNCTION public.proc_pec_ind_list_planned_requirements(
 p_start date,p_end date
) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,public AS $list$
DECLARE v_month date:=date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 PERFORM public.require_permission('module:procurement-execution-console',false);
 IF p_start IS NULL OR p_end IS NULL
   OR p_start<>date_trunc('month',p_start)::date
   OR p_end<>date_trunc('month',p_end)::date
   OR p_end<p_start OR p_start<(v_month-interval '1 month')::date
   OR p_end>(v_month+interval '12 months')::date
 THEN RAISE EXCEPTION 'Invalid IND plan listing horizon'; END IF;
 RETURN QUERY
 SELECT jsonb_build_object(
   'id',p.id,'stock_item_id',p.stock_item_id,'stock_item_name',si.name,
   'uom_id',p.uom_id,'uom_code',u.code,'month_start',p.month_start,
   'planned_qty',p.gross_required_qty,'reason',p.reason,
   'is_active',p.is_active,'updated_at',p.updated_at)
 FROM public.proc_pec_ind_planned_requirement p
 JOIN public.inv_stock_item si ON si.id=p.stock_item_id
 LEFT JOIN public.inv_uom u ON u.id=p.uom_id
 WHERE p.month_start BETWEEN p_start AND p_end
 ORDER BY si.name,p.month_start;
END;
$list$;
REVOKE ALL ON FUNCTION public.proc_pec_ind_list_planned_requirements(date,date)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_ind_list_planned_requirements(date,date)
 TO authenticated;


-- PEC S5 candidate B: server-side default for draft PR manual quantity adjustments.
-- NOT A DEPLOYABLE MIGRATION. Integrate with the complete S5 release package.
-- Wrapper only; preserves R10 header-lock, draft-only and internal-material restrictions
-- in proc_pr_set_manual_delta_pec_internal. Avoids recording an invented procurement rationale.
CREATE OR REPLACE FUNCTION public.proc_pr_set_manual_delta(
  p_pr_line_id bigint, p_manual_delta_qty numeric,
  p_manual_reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public AS $fn$
DECLARE
  v_old_final numeric;
  v_new_final numeric;
  v_base numeric;
  v_note text := nullif(btrim(p_manual_reason),'');
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',true);

  IF p_pr_line_id IS NULL THEN
    RAISE EXCEPTION 'PR line id is required';
  END IF;
  SELECT l.requested_qty + l.manual_delta_qty,
         l.requested_qty + coalesce(p_manual_delta_qty,0),
         l.requested_qty
    INTO v_old_final,v_new_final,v_base
  FROM public.proc_pr_line l
  WHERE l.pr_line_id=p_pr_line_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PR line not found'; END IF;
  IF v_new_final<0 THEN RAISE EXCEPTION 'Final PR quantity cannot be negative'; END IF;

  IF coalesce(p_manual_delta_qty,0)<>0 AND v_note IS NULL THEN
    v_note := format('Manual quantity adjustment during PR review: %s to %s.',
                       v_old_final,v_new_final);
  END IF;
  -- Deliberately delegate the authoritative header lock, stale-status recheck,
  -- prohibited internal RM material increase, actual update and audit trigger.
  PERFORM public.proc_pr_set_manual_delta_pec_internal(
    p_pr_line_id,p_manual_delta_qty,v_note
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.proc_pr_set_manual_delta(bigint,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pr_set_manual_delta(bigint,numeric,text) TO authenticated;


-- PEC S5 candidate C: common read-only procurement planning RPC, NOT production-installed.
-- Dependencies: candidate A's v_mrp_material_gross_requirement_ind and governed plan table.
-- The two supported methods: plan, hybrid.  comparison flag is informational only.
-- 1 RM normal, 1 RM jit, 2 PM, 5 IND. Existing hybrid and JIT exact route delegates
-- preserve all current default quantity semantics; new routes use class-specific gates.

CREATE OR REPLACE FUNCTION public.proc_pec_s5_unified_plan(
  p_start date,p_end date,p_class integer,p_rm_scope text,
  p_method text,p_compare_history boolean DEFAULT true
) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,public AS $fn$
DECLARE
  v_month date := date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_h integer;
  v_scope text := coalesce(nullif(btrim(p_rm_scope),''),'normal');
  v_method text := lower(coalesce(nullif(btrim(p_method),''),''));
  v_cmp boolean := coalesce(p_compare_history,false);
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',false);
  IF p_start IS NULL OR p_end IS NULL
    OR p_start<>date_trunc('month',p_start)::date
    OR p_end<>date_trunc('month',p_end)::date
    OR p_end < p_start
    OR p_start < (v_month - interval '1 month')::date
    OR p_start > (v_month + interval '12 months')::date
    OR p_class IS NULL OR p_class NOT IN (1,2,5)
    OR v_method NOT IN ('plan','hybrid')
    OR (p_class=1 AND v_scope NOT IN ('normal','jit','all'))
    OR (p_class<>1 AND v_scope<>'normal')
  THEN RAISE EXCEPTION 'Invalid S5 class, route, method or planning horizon'; END IF;
  v_h := (12*extract(year from age(p_end,p_start))
    +extract(month from age(p_end,p_start))+1)::integer;
  IF v_h NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION 'S5 planning horizon must be 1–6 months';
  END IF;

  -- RM All is a genuine per-item split, not a blanket JIT exemption.
  IF p_class=1 AND v_scope='all' THEN
    RETURN QUERY SELECT x
      FROM public.proc_pec_s5_unified_plan(p_start,p_end,1,'normal',v_method,v_cmp) x;
    RETURN QUERY SELECT x
      FROM public.proc_pec_s5_unified_plan(p_start,p_end,1,'jit',v_method,v_cmp) x;
    RETURN;
  END IF;

  -- Exact baseline hybrid for RM Normal and PM: preserve the approved S4 source
  -- and frozen formula; history remains mandatory evidence even when an
  -- independent supplementary comparison control is switched OFF.
  IF p_class IN (1,2) AND v_method='hybrid' AND (p_class=2 OR v_scope='normal') THEN
    RETURN QUERY
    SELECT x || jsonb_build_object(
      'method','hybrid','planning_method','plan_plus_consumption',
      'history_comparison',v_cmp,'source','s4_hybrid',
      'material_scope',v_scope)
    FROM public.proc_pec_s4_new_pr_plan(p_start,p_end,p_class,v_scope) x;
    RETURN;
  END IF;

  -- Exact JIT plan-only route: mature, performance-fixed materialized indent balance.
  IF p_class=1 AND v_scope='jit' AND v_method='plan' THEN
    RETURN QUERY
    SELECT x || jsonb_build_object(
      'method','plan','planning_method','planned_demand',
      'history_comparison',v_cmp,'source','jit_mrp',
      'material_scope','jit')
    FROM public.proc_pec_jit_mrp_plan(p_start,p_end,v_cmp) x;
    RETURN;
  END IF;

  -- New RM Normal / PM plan-only route.  MRP.procure_qty already includes the
  -- MRP stock netting. Never deduct current stock a second time.
  IF p_class IN (1,2) AND v_method='plan' THEN
    RETURN QUERY
    WITH mrp AS MATERIALIZED (
      SELECT p.material_class_id::bigint class_id,p.stock_item_id,p.uom_id,
        sum(p.procure_qty)::numeric mrp_net,count(*)::integer mrp_months
      FROM public.v_mrp_procurement_plan p
      JOIN public.inv_stock_item si ON si.id=p.stock_item_id
      JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=p.stock_item_id
      WHERE p.month_start BETWEEN p_start AND p_end AND c.active
        AND p.material_class_id=p_class
        AND (p_class<>1 OR c.subcategory_code NOT IN
          ('finished_bulk_material','semifinished_goods'))
        AND (p_class<>1 OR si.rm_procurement_mode IS DISTINCT FROM 'jit_procured')
      GROUP BY 1,2,3
    ), stock AS MATERIALIZED (
      SELECT s.inv_stock_item_id item_id,sum(s.qty_value) stock_qty,
        count(*) source_count,max(s.source_kind) source_kind
      FROM public.v_stock_current_by_item s
      JOIN (SELECT DISTINCT stock_item_id FROM mrp) m ON m.stock_item_id=s.inv_stock_item_id
      GROUP BY 1
    ), indent AS MATERIALIZED (
      SELECT i.material_class_id class_id,i.stock_item_id,i.uom_id,
        sum(greatest(0,i.remaining_qty)) outstanding,
        count(*) FILTER (WHERE i.remaining_qty>0) open_lines
      FROM public.v_proc_indent_line_balance i
      WHERE i.material_class_id=p_class
      GROUP BY 1,2,3
    ), moq AS (
      SELECT q.stock_item_id,q.uom_id,count(*) policies,max(q.moq_qty) moq_qty
      FROM public.inv_stock_item_moq_policy q
      JOIN mrp m ON m.stock_item_id=q.stock_item_id AND m.uom_id=q.uom_id
      WHERE q.is_active AND (q.effective_from IS NULL OR q.effective_from<=v_today)
        AND (q.effective_to IS NULL OR q.effective_to>=v_today)
      GROUP BY 1,2
    ), x AS (
      SELECT m.*,si.name item_name,si.default_uom_id,u.code uom_code,
        s.stock_qty,s.source_count,s.source_kind,
        coalesce(i.outstanding,0) outstanding,
        coalesce(i.open_lines,0) open_lines,
        coalesce(q.policies,0) policies,q.moq_qty,
        CASE WHEN p_class=1 THEN (SELECT max(as_of_date) FROM public.tally_rm_stock_snapshot)
             ELSE (SELECT max(as_of_date) FROM public.tally_plm_stock_snapshot) END stock_as_of
      FROM mrp m JOIN public.inv_stock_item si ON si.id=m.stock_item_id
      LEFT JOIN public.inv_uom u ON u.id=m.uom_id
      LEFT JOIN stock s ON s.item_id=m.stock_item_id
      LEFT JOIN indent i ON i.class_id=m.class_id AND i.stock_item_id=m.stock_item_id AND i.uom_id=m.uom_id
      LEFT JOIN moq q ON q.stock_item_id=m.stock_item_id AND q.uom_id=m.uom_id
    ), y AS (
      SELECT x.*,greatest(0,mrp_net-outstanding) net_after_indent,
        CASE
         WHEN stock_qty IS NULL OR source_count<>1
           OR source_kind<>CASE WHEN p_class=1 THEN 'rm' ELSE 'plm' END
           THEN 'STOCK_MAPPING_REVIEW'
         WHEN stock_as_of IS NULL OR stock_as_of NOT BETWEEN v_today-1 AND v_today
           THEN 'STALE_STOCK_REVIEW'
         WHEN stock_qty<0 THEN 'NEGATIVE_STOCK_REVIEW'
         WHEN default_uom_id IS DISTINCT FROM uom_id OR uom_code IS NULL
           THEN 'UOM_REVIEW'
         WHEN policies>1 OR (moq_qty IS NOT NULL AND moq_qty<=0)
           OR (uom_code='Nos' AND moq_qty IS NOT NULL AND moq_qty<>ceil(moq_qty))
           THEN 'MOQ_POLICY_REVIEW'
         WHEN mrp_months<>v_h THEN 'MRP_HORIZON_REVIEW'
         WHEN mrp_net<0 THEN 'MRP_QUANTITY_REVIEW'
         ELSE 'AUTO_ELIGIBLE' END gate
      FROM x
    )
    SELECT jsonb_build_object(
      'mode','s5_unified','method','plan','planning_method','planned_demand',
      'history_comparison',v_cmp,'source','mrp_view',
      'material_scope',v_scope,'material_class_id',class_id,
      'stock_item_id',stock_item_id,'stock_item_name',item_name,
      'uom_id',uom_id,'uom_code',uom_code,
      'mrp_net_qty',mrp_net,'mrp_months',mrp_months,'coverage_months',v_h,
      'stock_qty',stock_qty,'stock_as_of',stock_as_of,
      'outstanding_indent_qty',outstanding,'outstanding_indent_lines',open_lines,
      'net_after_indent',net_after_indent,'moq_qty',moq_qty,
      'gate',gate,'recommended_qty',
        CASE WHEN gate<>'AUTO_ELIGIBLE' THEN NULL
          WHEN moq_qty>0 THEN ceil(net_after_indent/moq_qty)*moq_qty
          WHEN uom_code='Nos' THEN ceil(net_after_indent)
          ELSE net_after_indent END,
      'consumption_only',false,'stock_netted_by','v_mrp_procurement_plan'
    ) FROM y ORDER BY item_name,stock_item_id;
    RETURN;
  END IF;

  -- JIT hybrid is permitted only when explicitly chosen. History can increase
  -- demand, but missing stock is allowed solely for this true JIT class.
  -- JIT items with actual mapped stock use that stock for the history alternative.
  IF p_class=1 AND v_scope='jit' AND v_method='hybrid' THEN
    RETURN QUERY
    WITH j AS MATERIALIZED (
      SELECT x AS obj FROM public.proc_pec_jit_mrp_plan(p_start,p_end,true) x
    ), st AS MATERIALIZED (
      SELECT s.inv_stock_item_id item_id,sum(s.qty_value) stock_qty,
         count(*) source_count,max(s.source_kind) source_kind
      FROM public.v_stock_current_by_item s
      JOIN (SELECT DISTINCT (obj->>'stock_item_id')::bigint AS id FROM j) k
        ON k.id=s.inv_stock_item_id
      GROUP BY 1
    ), x AS (
      SELECT j.obj,(j.obj->>'stock_item_id')::bigint item_id,
        (j.obj->>'mrp_net_qty')::numeric mrp_net,
        coalesce((j.obj->>'period_consumption')::numeric,0) consumption,
        coalesce((j.obj->>'outstanding_indent_qty')::numeric,0) outstanding,
        (j.obj->>'moq_qty')::numeric moq_qty,j.obj->>'uom_code' uom_code,
        j.obj->>'gate' original_gate,st.stock_qty,st.source_count,st.source_kind,
        (SELECT max(as_of_date) FROM public.tally_rm_stock_snapshot) stock_as_of
      FROM j LEFT JOIN st ON st.item_id=(j.obj->>'stock_item_id')::bigint
    ), y AS (
      SELECT x.*,greatest(0,consumption-coalesce(stock_qty,0)) usage_stock_net,
        CASE
        WHEN source_count IS NOT NULL AND
          (source_count<>1 OR source_kind<>'rm') THEN 'STOCK_MAPPING_REVIEW'
        WHEN stock_qty<0 THEN 'NEGATIVE_STOCK_REVIEW'
        WHEN stock_qty IS NOT NULL AND
          (stock_as_of IS NULL OR stock_as_of NOT BETWEEN v_today-1 AND v_today)
          THEN 'STALE_STOCK_REVIEW'
        ELSE original_gate END gate
      FROM x
    ), z AS (
      SELECT y.*,greatest(0,greatest(mrp_net,usage_stock_net)-outstanding) net_qty
      FROM y
    )
    SELECT obj || jsonb_build_object(
      'method','hybrid','planning_method','plan_plus_consumption',
      'history_comparison',v_cmp,'consumption_comparison',v_cmp,
      'source','jit_mrp_plus_history',
      'material_scope','jit',
      'stock_qty',stock_qty,'stock_as_of',stock_as_of,
      'stock_netted_consumption',usage_stock_net,
      'net_after_indent',net_qty,
      'gate',gate,'recommended_qty',
        CASE WHEN gate<>'AUTO_ELIGIBLE' THEN NULL
         WHEN moq_qty>0 THEN ceil(net_qty/moq_qty)*moq_qty
         WHEN uom_code='Nos' THEN ceil(net_qty)
         ELSE net_qty END)
    FROM z ORDER BY obj->>'stock_item_name',item_id;

    -- In explicitly selected hybrid mode, JIT consumption-only materials may
    -- also enter the preview, but only with documented 12-month history and
    -- class/UOM/MOQ/indent safeguards. JIT PLAN mode never includes these.
    RETURN QUERY
    WITH usage AS MATERIALIZED (
      SELECT c.inv_stock_item_id item_id,
        sum(c.total_consumed_qty)::numeric used12,
        count(*) FILTER(WHERE c.total_consumed_qty>0)::integer positive_months
      FROM public.v_item_consumption_monthly_by_item c
      JOIN public.inv_stock_item si ON si.id=c.inv_stock_item_id
      JOIN public.v_inv_stock_item_with_class cat ON cat.stock_item_id=si.id
      WHERE si.active AND cat.active AND cat.category_id=1
        AND si.rm_procurement_mode='jit_procured'
        AND cat.subcategory_code NOT IN
          ('finished_bulk_material','semifinished_goods')
        AND c.month_start_date>=(v_month-interval '12 months')::date
        AND c.month_start_date<v_month
      GROUP BY 1
      HAVING sum(c.total_consumed_qty)>0
    ), planned_jit_ids AS MATERIALIZED (
      SELECT DISTINCT p.stock_item_id
      FROM public.v_mrp_procurement_plan p
      WHERE p.material_class_id=1 AND p.month_start BETWEEN p_start AND p_end
    ), k AS MATERIALIZED (
      SELECT u.*,si.name item_name,si.default_uom_id uom_id,
        uv.code uom_code,u.used12/12*v_h period_usage
      FROM usage u
      JOIN public.inv_stock_item si ON si.id=u.item_id
      LEFT JOIN public.inv_uom uv ON uv.id=si.default_uom_id
      LEFT JOIN planned_jit_ids p ON p.stock_item_id=u.item_id
      WHERE p.stock_item_id IS NULL
    ), st AS MATERIALIZED (
      SELECT s.inv_stock_item_id item_id,sum(s.qty_value) stock_qty,
         count(*) source_count,max(s.source_kind) source_kind
      FROM public.v_stock_current_by_item s
      JOIN k ON k.item_id=s.inv_stock_item_id GROUP BY 1
    ), ib AS MATERIALIZED (
      SELECT i.stock_item_id item_id,i.uom_id,
        sum(greatest(0,i.remaining_qty)) outstanding,
        count(*) FILTER(WHERE i.remaining_qty>0) open_lines
      FROM public.v_proc_indent_line_balance i
      WHERE i.material_class_id=1 GROUP BY 1,2
    ), mq AS MATERIALIZED (
      SELECT m.stock_item_id item_id,m.uom_id,
        count(*) policies,max(m.moq_qty) moq_qty
      FROM public.inv_stock_item_moq_policy m
      JOIN k ON k.item_id=m.stock_item_id AND k.uom_id=m.uom_id
      WHERE m.is_active AND (m.effective_from IS NULL OR m.effective_from<=v_today)
        AND (m.effective_to IS NULL OR m.effective_to>=v_today)
      GROUP BY 1,2
    ), x AS (
      SELECT k.*,s.stock_qty,s.source_count,s.source_kind,
        coalesce(i.outstanding,0) outstanding,coalesce(i.open_lines,0) open_lines,
        coalesce(m.policies,0) policies,m.moq_qty,
        (SELECT max(as_of_date) FROM public.tally_rm_stock_snapshot) stock_as_of
      FROM k LEFT JOIN st s ON s.item_id=k.item_id
      LEFT JOIN ib i ON i.item_id=k.item_id AND i.uom_id=k.uom_id
      LEFT JOIN mq m ON m.item_id=k.item_id AND m.uom_id=k.uom_id
    ), y AS (
      SELECT x.*,greatest(0,period_usage-coalesce(stock_qty,0)) usage_net,
        CASE
         WHEN source_count IS NOT NULL AND
           (source_count<>1 OR source_kind<>'rm') THEN 'STOCK_MAPPING_REVIEW'
         WHEN stock_qty<0 THEN 'NEGATIVE_STOCK_REVIEW'
         WHEN stock_qty IS NOT NULL AND
           (stock_as_of IS NULL OR stock_as_of NOT BETWEEN v_today-1 AND v_today)
           THEN 'STALE_STOCK_REVIEW'
         WHEN uom_code IS NULL THEN 'UOM_REVIEW'
         WHEN policies>1 OR (moq_qty IS NOT NULL AND moq_qty<=0)
           OR (uom_code='Nos' AND moq_qty IS NOT NULL AND moq_qty<>ceil(moq_qty))
           THEN 'MOQ_POLICY_REVIEW'
         ELSE 'AUTO_ELIGIBLE' END gate
      FROM x
    ), z AS (
      SELECT y.*,greatest(0,usage_net-outstanding) net_after_indent FROM y
    )
    SELECT jsonb_build_object(
      'mode','s5_unified','method','hybrid','planning_method','plan_plus_consumption',
      'history_comparison',v_cmp,'consumption_comparison',v_cmp,
      'source','jit_history_only','material_scope','jit',
      'material_class_id',1,'stock_item_id',item_id,
      'stock_item_name',item_name,'uom_id',uom_id,'uom_code',uom_code,
      'mrp_net_qty',0,'mrp_months',0,'coverage_months',v_h,
      'usage_12m',used12,'positive_months',positive_months,
      'period_consumption',period_usage,'stock_qty',stock_qty,
      'stock_as_of',stock_as_of,'stock_netted_consumption',usage_net,
      'outstanding_indent_qty',outstanding,'outstanding_indent_lines',open_lines,
      'net_after_indent',net_after_indent,'moq_qty',moq_qty,
      'gate',gate,'recommended_qty',
        CASE WHEN gate<>'AUTO_ELIGIBLE' THEN NULL
          WHEN moq_qty>0 THEN ceil(net_after_indent/moq_qty)*moq_qty
          WHEN uom_code='Nos' THEN ceil(net_after_indent)
          ELSE net_after_indent END,
      'consumption_only',true
    ) FROM z ORDER BY item_name,item_id;
    RETURN;
  END IF;

  -- IND is NOT production-BOM-based MRP. Its explicit monthly operational plan
  -- is a separate namesake view, and consumption is an independent forecast.
  IF p_class=5 THEN
    RETURN QUERY
    WITH candidates AS MATERIALIZED (
      SELECT si.id item_id,si.name item_name,si.default_uom_id uom_id,
        u.code uom_code
      FROM public.inv_stock_item si
      JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=si.id
      LEFT JOIN public.inv_uom u ON u.id=si.default_uom_id
      WHERE si.active AND c.active AND c.category_id=5
    ), plans AS MATERIALIZED (
      SELECT p.stock_item_id item_id,p.uom_id,
        sum(p.gross_required_qty) planned_gross,count(*)::integer plan_months
      FROM public.v_mrp_material_gross_requirement_ind p
      WHERE p.month_start BETWEEN p_start AND p_end
      GROUP BY 1,2
    ), history AS MATERIALIZED (
      SELECT u.inv_stock_item_id item_id,sum(u.total_consumed_qty)::numeric used12,
        count(*) FILTER(WHERE u.total_consumed_qty>0)::integer positive_months
      FROM public.v_item_consumption_monthly_by_item u
      JOIN candidates c ON c.item_id=u.inv_stock_item_id
      WHERE u.month_start_date>=(v_month-interval '12 months')::date
        AND u.month_start_date<v_month
        AND u.source_kind='consumable'
      GROUP BY 1
    ), stock AS MATERIALIZED (
      SELECT s.inv_stock_item_id item_id,sum(s.qty_value) stock_qty,
        count(*) source_count,max(s.source_kind) source_kind
      FROM public.v_stock_current_by_item s
      JOIN candidates c ON c.item_id=s.inv_stock_item_id
      GROUP BY 1
    ), indent AS MATERIALIZED (
      SELECT i.stock_item_id item_id,i.uom_id,
        sum(greatest(0,i.remaining_qty)) outstanding,
        count(*) FILTER(WHERE i.remaining_qty>0) open_lines
      FROM public.v_proc_indent_line_balance i
      WHERE i.material_class_id=5 GROUP BY 1,2
    ), moq AS MATERIALIZED (
      SELECT p.stock_item_id item_id,p.uom_id,count(*) policies,max(p.moq_qty) moq_qty
      FROM public.inv_stock_item_moq_policy p
      JOIN candidates c ON c.item_id=p.stock_item_id AND c.uom_id=p.uom_id
      WHERE p.is_active AND (p.effective_from IS NULL OR p.effective_from<=v_today)
        AND (p.effective_to IS NULL OR p.effective_to>=v_today)
      GROUP BY 1,2
    ), x AS (
      SELECT c.*,p.planned_gross,p.plan_months,p.uom_id planned_uom,
        h.used12,h.positive_months,
        coalesce(h.used12,0)/12*v_h usage_projected,
        s.stock_qty,s.source_count,s.source_kind,
        CASE WHEN s.source_kind='fuel'
          THEN (SELECT max(as_of_date) FROM public.tally_fuel_stock_snapshot)
          ELSE (SELECT max(as_of_date) FROM public.tally_consumables_stock_snapshot) END stock_as_of,
        coalesce(i.outstanding,0) outstanding,coalesce(i.open_lines,0) open_lines,
        coalesce(m.policies,0) policies,m.moq_qty
      FROM candidates c
      LEFT JOIN plans p ON p.item_id=c.item_id
      LEFT JOIN history h ON h.item_id=c.item_id
      LEFT JOIN stock s ON s.item_id=c.item_id
      LEFT JOIN indent i ON i.item_id=c.item_id AND i.uom_id=c.uom_id
      LEFT JOIN moq m ON m.item_id=c.item_id AND m.uom_id=c.uom_id
      WHERE p.item_id IS NOT NULL OR (v_method='hybrid' AND coalesce(h.used12,0)>0)
    ), y AS (
      SELECT x.*,greatest(0,coalesce(planned_gross,0)-coalesce(stock_qty,0)) plan_stock_net,
        greatest(0,usage_projected-coalesce(stock_qty,0)) history_stock_net,
        CASE
         WHEN stock_qty IS NULL OR source_count<>1
           OR source_kind NOT IN ('consumable','fuel') THEN 'STOCK_MAPPING_REVIEW'
         WHEN stock_as_of IS NULL OR stock_as_of NOT BETWEEN v_today-1 AND v_today
           THEN 'STALE_STOCK_REVIEW'
         WHEN stock_qty<0 THEN 'NEGATIVE_STOCK_REVIEW'
         WHEN uom_code IS NULL OR
           (planned_uom IS NOT NULL AND planned_uom IS DISTINCT FROM uom_id)
           THEN 'UOM_REVIEW'
         WHEN policies>1 OR (moq_qty IS NOT NULL AND moq_qty<=0)
           OR (uom_code='Nos' AND moq_qty IS NOT NULL AND moq_qty<>ceil(moq_qty))
           THEN 'MOQ_POLICY_REVIEW'
         WHEN v_method='plan' AND coalesce(plan_months,0)<>v_h
           THEN 'IND_PLAN_HORIZON_REVIEW'
         WHEN v_method='hybrid' AND coalesce(used12,0)=0
           AND coalesce(plan_months,0)<>v_h
           THEN 'IND_DEMAND_SOURCE_REVIEW'
         ELSE 'AUTO_ELIGIBLE' END gate
      FROM x
    ), z AS (
      SELECT y.*,greatest(0,
        CASE WHEN v_method='plan' THEN plan_stock_net
        ELSE greatest(plan_stock_net,history_stock_net) END - outstanding
      ) net_after_indent
      FROM y
    )
    SELECT jsonb_build_object(
      'mode','s5_unified','method',v_method,'planning_method',
          CASE WHEN v_method='plan' THEN 'operational_plan' ELSE 'plan_plus_consumption' END,
      'history_comparison',v_cmp,'source','ind_operational_plan_plus_optional_history',
      'material_scope','normal','material_class_id',5,
      'stock_item_id',item_id,'stock_item_name',item_name,
      'uom_id',uom_id,'uom_code',uom_code,
      'mrp_net_qty',plan_stock_net,'planned_gross_qty',planned_gross,
      'plan_months',coalesce(plan_months,0),'coverage_months',v_h,
      'usage_12m',used12,'positive_months',coalesce(positive_months,0),
      'period_consumption',CASE WHEN v_method='hybrid' OR v_cmp THEN usage_projected END,
      'stock_qty',stock_qty,'stock_as_of',stock_as_of,
      'stock_netted_consumption',CASE WHEN v_method='hybrid' OR v_cmp THEN history_stock_net END,
      'outstanding_indent_qty',outstanding,'outstanding_indent_lines',open_lines,
      'net_after_indent',net_after_indent,'moq_qty',moq_qty,
      'gate',gate,'recommended_qty',
        CASE WHEN gate<>'AUTO_ELIGIBLE' THEN NULL
        WHEN moq_qty>0 THEN ceil(net_after_indent/moq_qty)*moq_qty
        WHEN uom_code='Nos' THEN ceil(net_after_indent)
        ELSE net_after_indent END,
      'consumption_only',planned_gross IS NULL,
      'demand_source',CASE WHEN planned_gross IS NULL THEN 'historical_forecast'
          ELSE 'operator_plan' END
    ) FROM z ORDER BY item_name,item_id;
    RETURN;
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_s5_unified_plan(date,date,integer,text,text,boolean)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_s5_unified_plan(date,date,integer,text,text,boolean)
 TO authenticated;


-- PEC S5 candidate D: consolidated review/fingerprint and atomic guarded generator.
-- NOT DEPLOYABLE ALONE: requires S5 candidates A and C. This is staged source only.
CREATE OR REPLACE FUNCTION public.proc_pec_s5_review_plan(
  p_start date,p_end date,p_class integer,p_rm_scope text,
  p_method text,p_compare_history boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,public AS $fn$
DECLARE v_rows jsonb;v_signature text;v_scope text;
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',false);
  v_scope:=coalesce(nullif(btrim(p_rm_scope),''),'normal');
  -- The authoritative planner validates all method/scope/horizon arguments.
  SELECT coalesce(jsonb_agg(r.obj ORDER BY
       (r.obj->>'material_class_id')::integer,
       (r.obj->>'stock_item_id')::bigint,
       (r.obj->>'uom_id')::bigint),'[]'::jsonb)
    INTO v_rows
  FROM public.proc_pec_s5_unified_plan(
    p_start,p_end,p_class,v_scope,p_method,p_compare_history) AS r(obj);

  v_signature:=md5(jsonb_build_object(
    'start',p_start,'end',p_end,'class',p_class,'scope',v_scope,
    'method',p_method,'compare_history',coalesce(p_compare_history,false),
    'rows',v_rows)::text);
  RETURN jsonb_build_object(
    'planning_method',p_method,'material_class_id',p_class,'rm_scope',v_scope,
    'history_comparison',coalesce(p_compare_history,false),
    'plan_signature',v_signature,'rows',v_rows,
    'total_candidates',jsonb_array_length(v_rows),
    'auto_eligible',(
      SELECT count(*) FROM jsonb_array_elements(v_rows) x
      WHERE x->>'gate'='AUTO_ELIGIBLE'),
    'review_required',(
      SELECT count(*) FROM jsonb_array_elements(v_rows) x
      WHERE x->>'gate'<>'AUTO_ELIGIBLE'));
END;
$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_s5_review_plan(date,date,integer,text,text,boolean)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_s5_review_plan(date,date,integer,text,text,boolean)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.proc_pec_s5_generate_pr(
  p_pr_number text,p_effective_from_date date,
  p_horizon_start_month date,p_horizon_end_month date,
  p_material_class_id integer,p_rm_scope text,p_method text,
  p_compare_history boolean,p_generation_filters jsonb,p_notes text,
  p_expected_plan_signature text,p_confirm boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public AS $fn$
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
         'rm_scope',v_scope,'method',p_method,'source','s5_unified',
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
     'material_class_id',p_material_class_id,'rm_scope',v_scope,
     'plan_signature',v_signature,'total_candidates',v_total,
     'auto_evidenced_lines',v_auto,'review_required_lines',v_review_count);
END;
$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_s5_generate_pr(
  text,date,date,date,integer,text,text,boolean,jsonb,text,text,boolean)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_s5_generate_pr(
  text,date,date,date,integer,text,text,boolean,jsonb,text,text,boolean)
 TO authenticated;
