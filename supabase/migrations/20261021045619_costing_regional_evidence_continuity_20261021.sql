-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Reuse prior acceptance only for identical governed evidence/quantities; ignore computed allocation cost drift.
CREATE OR REPLACE FUNCTION costing.fn_regional_marketing_review_status(p_regional_marketing_snapshot_id bigint)
 RETURNS TABLE(raw_status text, effective_status text, acceptance_id bigint, evidence_fingerprint text, is_acceptance_eligible boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
with s as (
  select e.*,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,
    costing.fn_regional_marketing_evidence_fingerprint(
      e.sku_id,e.product_id,e.region_code,e.valuation_date,e.regional_basis_source,
      e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,
      b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,
      e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region
    ) fp,
    (
      e.marketing_expense_allocation_status='REVIEW_REQUIRED'
      and (
        e.regional_basis_source in ('REGION_SCALED_COMMON_BASIS','REGIONAL_DEFAULT_POLICY_UNITS','REGIONAL_ASSUMPTION_UNITS')
        or e.marketing_value_source in ('GOVERNED_REGIONAL_DEFAULT','APPROVED_REGIONAL_ASSUMPTION')
      )
      and not (e.marketing_value_source='ACTUAL_SIGNED_BILLED_SALES' and coalesce(e.resolved_product_region_marketing_sales_value,0)<=0)
    ) eligible
  from costing.sku_regional_marketing_expense_allocation_snapshot e
  join costing.sku_regional_marketing_allocation_basis_snapshot b on b.id=e.regional_basis_snapshot_id
  where e.id=p_regional_marketing_snapshot_id
), a as (
  select a.id
  from s join costing.regional_marketing_evidence_acceptance a
    on a.period_start=s.period_start
   and a.source_valuation_date<=s.valuation_date
   and a.sku_id=s.sku_id
   and a.product_id=s.product_id
   and a.region_code=s.region_code
   and a.acceptance_status='ACTIVE'
   and (
     (a.source_valuation_date=s.valuation_date and a.evidence_fingerprint=s.fp)
     or
     (a.source_valuation_date<s.valuation_date
       and a.regional_basis_source=s.regional_basis_source
       and a.marketing_value_source=s.marketing_value_source
       and a.regional_assumption_id is not distinct from s.regional_assumption_id
       and a.regional_default_policy_id is not distinct from s.regional_default_policy_id
       and a.regional_default_scenario is not distinct from s.regional_default_scenario
       and a.resolved_regional_units is not distinct from s.resolved_regional_units
       and a.resolved_regional_base_qty is not distinct from s.resolved_regional_base_qty
       and a.resolved_product_region_marketing_sales_value is not distinct from s.resolved_product_region_marketing_sales_value)
   )
  order by a.accepted_at desc,a.id desc limit 1
)
select s.marketing_expense_allocation_status,
       case when s.marketing_expense_allocation_status='REVIEW_REQUIRED' and s.eligible and a.id is not null then 'READY'
            else s.marketing_expense_allocation_status end,
       a.id,s.fp,s.eligible
from s left join a on true;
$function$;
