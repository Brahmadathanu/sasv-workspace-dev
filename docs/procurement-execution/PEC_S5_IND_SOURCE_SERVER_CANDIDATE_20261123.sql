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
