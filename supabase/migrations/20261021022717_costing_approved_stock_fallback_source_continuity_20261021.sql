-- backfilled from live schema_migrations on 2026-10-24, CI-016
CREATE OR REPLACE FUNCTION costing.fn_material_review_acceptance_matches(p_period_start date,p_valuation_date date,p_stock_item_id bigint,p_material_area text,p_issue_codes text,p_warning_codes text,p_action_required_summary text,p_selected_rate numeric,p_rate_source text,p_rate_date date,p_selected_manual_rate_id bigint,p_selected_purchase_fact_id bigint,p_selected_stock_valuation_source text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'costing','public','pg_temp'
AS $function$
 SELECT EXISTS (
 SELECT 1 FROM costing.material_review_acceptance_register ar
 WHERE ar.acceptance_status='ACTIVE'
 AND ar.acceptance_scope='MATERIAL_ACTION'
 AND ar.period_start=date_trunc('month',p_period_start)::date
 AND ar.period_start=date_trunc('month',p_valuation_date)::date
 AND ar.source_valuation_date IS NOT NULL
 AND ar.source_valuation_date<=p_valuation_date
 AND ar.effective_from<=p_valuation_date
 AND (ar.effective_to IS NULL OR ar.effective_to>=p_valuation_date)
 AND ar.stock_item_id=p_stock_item_id
 AND upper(ar.material_area)=upper(p_material_area)
 AND upper(ar.recommended_ui_route)='MATERIAL_RATE_REVIEW'
 AND coalesce(ar.issue_codes,'')=coalesce(p_issue_codes,'')
 AND coalesce(ar.warning_codes,'')=coalesce(p_warning_codes,'')
 AND coalesce(ar.action_required_summary,'')=coalesce(p_action_required_summary,'')
 AND ar.source_rate_source IS NOT DISTINCT FROM p_rate_source
 AND ar.source_selected_manual_rate_id IS NOT DISTINCT FROM p_selected_manual_rate_id
 AND ar.source_selected_purchase_fact_id IS NOT DISTINCT FROM p_selected_purchase_fact_id
 AND ar.source_selected_stock_valuation_source IS NOT DISTINCT FROM p_selected_stock_valuation_source
 AND (
   (ar.source_rate_source='STOCK_VALUATION'
    AND ar.issue_codes IN ('RM_STOCK_VALUATION_FALLBACK','PM_STOCK_VALUATION_FALLBACK')
    AND p_selected_rate IS NOT NULL AND p_selected_rate>0
    AND p_rate_date IS NOT NULL AND p_rate_date<=p_valuation_date)
   OR
   (ar.source_selected_rate IS NOT DISTINCT FROM p_selected_rate
    AND ar.source_rate_date IS NOT DISTINCT FROM p_rate_date)
 )
 );
$function$;