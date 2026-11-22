
-- PEC S4 compatibility: route legacy Electron MRP creation through S4.
-- Existing RPC signatures remain identical; new generator returns the same pr_id.
CREATE OR REPLACE FUNCTION public.create_pr_from_mrp_plan(
 p_pr_number text,p_effective_from_date date,p_horizon_start_month date,
 p_horizon_end_month date,p_material_class_id integer,p_generation_filters jsonb,p_notes text
) RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $fn$
DECLARE r jsonb;
BEGIN
 PERFORM public.require_permission('module:procurement-execution-console',true);
 r:=public.proc_pec_s4_generate_pr(
  p_pr_number,p_effective_from_date,p_horizon_start_month,p_horizon_end_month,
  p_material_class_id,p_generation_filters,p_notes,true);
 RETURN (r->>'pr_id')::bigint;
END;$fn$;

-- Rebuild must not revert S4 stock/consumption recommendations to MRP-only.
CREATE OR REPLACE FUNCTION public.proc_pr_rebuild_from_mrp(
 p_pr_id bigint,p_mode text DEFAULT 'safe'
) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 PERFORM public.require_permission('module:procurement-execution-console',true);
 IF EXISTS(SELECT 1 FROM public.proc_pr_ccf_generation_evidence WHERE pr_id=p_pr_id) THEN
   RAISE EXCEPTION 'S4 draft has frozen hybrid evidence. Legacy MRP-only rebuild is disabled; use governed S4 review.';
 END IF;
 PERFORM public.proc_pr_rebuild_from_mrp_pec_internal(p_pr_id,p_mode);
END;$fn$;
