-- Issue #528. Align Cost Sheet Review modal diagnostics with the canonical governed costing run.
-- Keep all historical costing snapshots untouched, all existing view column lists and ACLs intact.
-- Preflight exact source definitions and fail closed on unexpected schema drift.
DO $fix$
DECLARE v_def text; v_new text;
BEGIN
 v_def:=pg_get_viewdef('public.v_costing_pricing_sku_status_diagnosis'::regclass,true);
 IF strpos(v_def,'FROM costing.sku_pricing_bridge_snapshot pb')=0
 OR strpos(v_def,'mc.period_start = pb.period_start AND mc.sku_id = pb.sku_id')=0
 OR strpos(v_def,'ilc.period_start = pb.period_start AND ilc.sku_id = pb.sku_id')=0
 THEN RAISE EXCEPTION 'Issue 528: unexpected diagnosis view definition'; END IF;
 v_new:=replace(v_def,
 'FROM costing.sku_pricing_bridge_snapshot pb',
 'FROM costing.sku_pricing_bridge_snapshot pb JOIN costing.v_current_successful_costing_refresh_run selected_run ON selected_run.period_start = pb.period_start AND selected_run.valuation_date = pb.valuation_date AND selected_run.refresh_run_id = pb.refresh_run_id');
 v_new:=replace(v_new,
 'mc.period_start = pb.period_start AND mc.sku_id = pb.sku_id',
 'mc.period_start = pb.period_start AND mc.valuation_date = pb.valuation_date AND mc.refresh_run_id = pb.refresh_run_id AND mc.sku_id = pb.sku_id');
 v_new:=replace(v_new,
 'ilc.period_start = pb.period_start AND ilc.sku_id = pb.sku_id',
 'ilc.period_start = pb.period_start AND ilc.valuation_date = pb.valuation_date AND ilc.refresh_run_id = pb.refresh_run_id AND ilc.sku_id = pb.sku_id');
 EXECUTE 'CREATE OR REPLACE VIEW public.v_costing_pricing_sku_status_diagnosis AS '||v_new;

 v_def:=pg_get_viewdef('public.v_costing_pricing_workflow_diagnostics'::regclass,true);
 IF strpos(v_def,'FROM costing.v_pricing_workflow_diagnostics')=0
 THEN RAISE EXCEPTION 'Issue 528: unexpected workflow diagnostics view definition'; END IF;
 v_new:=replace(v_def,'FROM costing.v_pricing_workflow_diagnostics',
 'FROM costing.v_pricing_workflow_diagnostics JOIN costing.v_current_successful_costing_refresh_run selected_run ON selected_run.period_start = v_pricing_workflow_diagnostics.period_start AND selected_run.valuation_date = v_pricing_workflow_diagnostics.valuation_date AND selected_run.refresh_run_id = v_pricing_workflow_diagnostics.refresh_run_id');
 EXECUTE 'CREATE OR REPLACE VIEW public.v_costing_pricing_workflow_diagnostics AS '||v_new;

 -- Production repro: run 155 BLOCKED vs run 156 REVIEW_REQUIRED.
 -- Guard only if this fixture exists. General exact-run joins protect all periods.
 IF EXISTS (SELECT 1 FROM costing.costing_refresh_run WHERE id=156 AND period_start='2026-11-01')
 THEN
   IF (SELECT count(*) FROM public.v_costing_pricing_sku_status_diagnosis WHERE sku_id=1799 AND period_start='2026-11-01')<>1
   OR (SELECT count(*) FROM public.v_costing_pricing_workflow_diagnostics WHERE sku_id=1799 AND period_start='2026-11-01')<>1
   OR NOT EXISTS (SELECT 1 FROM public.v_costing_pricing_sku_status_diagnosis WHERE sku_id=1799 AND period_start='2026-11-01' AND costing_confidence_status='REVIEW_REQUIRED' AND pricing_bridge_status='REVIEW_REQUIRED')
   THEN RAISE EXCEPTION 'Issue 528: current-run diagnostic consistency failed'; END IF;
 END IF;
END $fix$;
