
-- PEC S4 authoritative-source consolidation: retire the obsolete CCF writer.
-- Earlier read-only comparison remains for historical diagnostics.
CREATE OR REPLACE FUNCTION public.proc_pec_ccf_apply_draft_line(
 p_pr_line_id bigint,p_expected_effective_qty numeric,
 p_expected_ccf_floor numeric,p_expected_stock_as_of date,
 p_reason text,p_confirm boolean
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 PERFORM public.require_permission('module:procurement-execution-console',true);
 RAISE EXCEPTION 'Legacy single-line CCF writer retired. Use the governed S4 hybrid generation/reconciliation workflow.';
END;$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_ccf_apply_draft_line(bigint,numeric,numeric,date,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_ccf_apply_draft_line(bigint,numeric,numeric,date,text,boolean) TO authenticated;
