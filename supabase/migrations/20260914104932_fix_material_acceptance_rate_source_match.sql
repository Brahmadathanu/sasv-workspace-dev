-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_build_product_rm_cost_as_of(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
returns table(period_start date, valuation_date date, product_id bigint, product_name text, product_base_uom text, conversion_to_base numeric, rm_line_count bigint, direct_rm_line_count bigint, expanded_sp_line_count bigint, form_converted_line_count bigint, rm_cost_per_base_unit numeric, ok_line_count bigint, review_rate_line_count bigint, optional_missing_rate_line_count bigint, blocking_line_count bigint, blocking_stock_item_count bigint, stale_purchase_rate_line_count bigint, stock_valuation_fallback_line_count bigint, manual_rate_line_count bigint, calculation_warning_line_count bigint, rm_costing_status text, rm_costing_note text, accepted_review_rate_line_count bigint, unaccepted_review_rate_line_count bigint)
language sql stable security definer set search_path to 'costing','public','pg_temp'
as $function$
with ctx as (
  select 1 from costing.costing_refresh_run r
  where r.id=p_refresh_run_id and r.period_start=date_trunc('month',p_period_start)::date and r.valuation_date=p_valuation_date and r.valuation_context_source='CAPTURED_AT_REQUEST'
), line_classified as (
 select l.*,
   case when l.rate_warning_code='STALE_PURCHASE_RATE' then 'STALE_RM_PURCHASE_RATE'
        when l.rate_warning_code='STOCK_VALUATION_FALLBACK' then 'RM_STOCK_VALUATION_FALLBACK'
        when l.rate_warning_code='MANUAL_RATE_USED' then 'RM_MANUAL_RATE_USED'
        when l.action_required='OPTIONAL_MISSING_RATE' then 'OPTIONAL_RM_RATE_MISSING'
        when l.calculation_warning_code is not null then l.calculation_warning_code
        when l.rate_warning_code is not null then l.rate_warning_code else l.action_required end acceptance_issue_codes,
   case when l.rate_warning_code is not null then l.rate_warning_code end acceptance_warning_codes,
   case when l.action_required in ('REVIEW_RATE','OPTIONAL_MISSING_RATE') then l.action_required end acceptance_action_required_summary,
   (l.approval_block_flag is not true and (l.action_required in ('REVIEW_RATE','OPTIONAL_MISSING_RATE') or l.rate_warning_code is not null)) non_blocking_review_flag
 from costing.fn_build_product_rm_cost_lines_as_of(p_period_start,p_valuation_date) l
 cross join ctx
), line_acceptance as (
 select lc.*, case when lc.non_blocking_review_flag and costing.fn_material_review_acceptance_matches(
   p_period_start,p_valuation_date,lc.purchase_stock_item_id,'RM',lc.acceptance_issue_codes,lc.acceptance_warning_codes,lc.acceptance_action_required_summary,
   lc.selected_rate,lc.rate_source,lc.rate_date,lc.selected_manual_rate_id,lc.selected_purchase_fact_id,lc.selected_stock_valuation_source
 ) then true else false end review_acceptance_active
 from line_classified lc
)
select date_trunc('month',p_period_start)::date,p_valuation_date,product_id,product_name,product_base_uom,max(conversion_to_base),count(*)::bigint,
 count(*) filter(where source='RM_BOM')::bigint,count(*) filter(where source='SP_BOM')::bigint,count(*) filter(where form_conversion_applied)::bigint,
 sum(coalesce(rm_cost_per_base_unit_line,0)),count(*) filter(where action_required='OK')::bigint,
 count(*) filter(where action_required='REVIEW_RATE' and approval_block_flag is not true)::bigint,
 count(*) filter(where action_required='OPTIONAL_MISSING_RATE' and approval_block_flag is not true)::bigint,
 count(*) filter(where approval_block_flag=true)::bigint,count(distinct purchase_stock_item_id) filter(where approval_block_flag=true)::bigint,
 count(*) filter(where rate_warning_code='STALE_PURCHASE_RATE' and approval_block_flag is not true)::bigint,
 count(*) filter(where rate_warning_code='STOCK_VALUATION_FALLBACK' and approval_block_flag is not true)::bigint,
 count(*) filter(where rate_warning_code='MANUAL_RATE_USED' and approval_block_flag is not true)::bigint,
 count(*) filter(where calculation_warning_flag)::bigint,
 case when count(*) filter(where approval_block_flag=true)>0 then 'BLOCKED' when count(*) filter(where non_blocking_review_flag and review_acceptance_active is not true)>0 then 'REVIEW_REQUIRED' else 'READY' end,
 case when count(*) filter(where approval_block_flag=true)>0 then 'Raw material cost is incomplete because required RM items have missing, ambiguous, or invalid calculation inputs.'
      when count(*) filter(where non_blocking_review_flag and review_acceptance_active is not true)>0 then 'Raw material cost can be calculated, but review is required because fallback, stale, manual, or optional-missing rates are present.'
      when count(*) filter(where non_blocking_review_flag and review_acceptance_active)>0 then 'Raw material cost is ready because all review-required RM rate issues are actively accepted for this frozen valuation evidence.'
      else 'Raw material cost is ready.' end,
 count(*) filter(where non_blocking_review_flag and review_acceptance_active)::bigint,
 count(*) filter(where non_blocking_review_flag and review_acceptance_active is not true)::bigint
from line_acceptance group by product_id,product_name,product_base_uom;
$function$;

create or replace function costing.fn_build_sku_pm_cost_as_of(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
returns table(period_start date, valuation_date date, sku_id bigint, product_id bigint, product_name text, pack_size numeric, pack_uom text, pm_line_count bigint, required_pm_line_count bigint, optional_pm_line_count bigint, pm_cost_per_sku numeric, blocking_missing_rate_line_count bigint, blocking_missing_rate_item_count bigint, optional_missing_rate_line_count bigint, stale_purchase_rate_line_count bigint, stock_valuation_fallback_line_count bigint, manual_rate_line_count bigint, review_rate_line_count bigint, pm_costing_status text, pm_costing_note text, accepted_review_rate_line_count bigint, unaccepted_review_rate_line_count bigint)
language sql stable security definer set search_path to 'costing','public','pg_temp'
as $function$
with ctx as (
 select 1 from costing.costing_refresh_run r where r.id=p_refresh_run_id and r.period_start=date_trunc('month',p_period_start)::date and r.valuation_date=p_valuation_date and r.valuation_context_source='CAPTURED_AT_REQUEST'
), line_acceptance as (
 select l.*, case when l.review_required_flag and l.required_missing_rate_block_flag is not true and costing.fn_material_review_acceptance_matches(
   p_period_start,p_valuation_date,l.stock_item_id,'PM',l.acceptance_issue_codes,l.acceptance_warning_codes,l.acceptance_action_required_summary,
   l.selected_rate,l.rate_source,l.rate_date,l.selected_manual_rate_id,l.selected_purchase_fact_id,l.selected_stock_valuation_source
 ) then true else false end review_acceptance_active
 from costing.fn_build_sku_pm_cost_lines_as_of(p_period_start,p_valuation_date) l cross join ctx
), a as (
 select date_trunc('month',p_period_start)::date period_start,p_valuation_date valuation_date,sku_id,product_id,product_name,pack_size,pack_uom,
 count(*)::bigint pm_line_count,count(*) filter(where is_optional=false)::bigint required_pm_line_count,count(*) filter(where is_optional=true)::bigint optional_pm_line_count,
 count(*) filter(where approval_block_flag=true)::bigint blocking_missing_rate_line_count,count(distinct stock_item_id) filter(where approval_block_flag=true)::bigint blocking_missing_rate_item_count,
 count(*) filter(where action_required='OPTIONAL_MISSING_RATE')::bigint optional_missing_rate_line_count,
 count(*) filter(where rate_warning_code='STALE_PURCHASE_RATE')::bigint stale_purchase_rate_line_count,
 count(*) filter(where rate_warning_code='STOCK_VALUATION_FALLBACK')::bigint stock_valuation_fallback_line_count,
 count(*) filter(where rate_warning_code='MANUAL_RATE_USED')::bigint manual_rate_line_count,
 count(*) filter(where review_required_flag)::bigint review_rate_line_count,
 count(*) filter(where review_required_flag and review_acceptance_active)::bigint accepted_review_rate_line_count,
 count(*) filter(where review_required_flag and review_acceptance_active is not true)::bigint unaccepted_review_rate_line_count,
 sum(pm_cost_per_sku_line) filter(where pm_cost_per_sku_line is not null) calculated_pm_cost
 from line_acceptance group by sku_id,product_id,product_name,pack_size,pack_uom
)
select period_start,valuation_date,sku_id,product_id,product_name,pack_size,pack_uom,pm_line_count,required_pm_line_count,optional_pm_line_count,
 case when blocking_missing_rate_line_count>0 then null::numeric else calculated_pm_cost end,blocking_missing_rate_line_count,blocking_missing_rate_item_count,optional_missing_rate_line_count,stale_purchase_rate_line_count,stock_valuation_fallback_line_count,manual_rate_line_count,review_rate_line_count,
 case when blocking_missing_rate_line_count>0 then 'BLOCKED' when unaccepted_review_rate_line_count>0 then 'REVIEW_REQUIRED' else 'READY' end,
 case when blocking_missing_rate_line_count>0 then 'Packing material cost is incomplete because required PM items have missing or ambiguous rates.' when unaccepted_review_rate_line_count>0 then 'Packing material cost can be calculated, but review is required because fallback, stale, manual, or optional-missing rates are present.' when accepted_review_rate_line_count>0 then 'Packing material cost is ready because all review-required PM rate issues are actively accepted for this frozen valuation evidence.' else 'Packing material cost is ready.' end,
 accepted_review_rate_line_count,unaccepted_review_rate_line_count from a;
$function$;