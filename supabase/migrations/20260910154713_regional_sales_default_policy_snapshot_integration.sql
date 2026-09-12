-- SOURCE-CONTROL PARITY — already applied in production as
--   20260910154713_regional_sales_default_policy_snapshot_integration
-- Captured 2026-09-11 from the linked project (qhmoqtxpeasamtlxaoak)
-- via information_schema / pg_get_functiondef / pg_get_triggerdef.
-- Bodies below are the live definitions.
--
-- DO NOT apply this migration to production. Production already has it.
-- This file exists so repository schema history matches live
-- supabase_migrations.schema_migrations.

alter table costing.sku_regional_marketing_allocation_basis_snapshot
  add column if not exists regional_default_policy_id bigint,
  add column if not exists regional_default_scenario text,
  add column if not exists regional_default_sales_units numeric,
  add column if not exists regional_default_effective_from date,
  add column if not exists regional_default_effective_to date,
  add column if not exists regional_default_resolution_status text,
  add column if not exists regional_default_resolution_note text,
  add column if not exists regional_default_assumed_sales_value numeric,
  add column if not exists regional_default_value_source text;

CREATE OR REPLACE FUNCTION costing.fn_apply_regional_default_to_basis_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
    v_scenario text; v_policy record; v_value record;
begin
    -- Higher precedence remains untouched: positive regional actual or one explicit governed assumption.
    if new.regional_actual_units > 0 then return new; end if;
    if new.assumption_resolution_status='RESOLVED' and new.assumed_total_units>0 then return new; end if;

    if coalesce(new.product_region_actual_evidence_row_count,0)=0 then
        v_scenario := 'NO_ELIGIBLE_REGIONAL_HISTORY';
    elsif coalesce(new.product_regional_positive_actual_share,0)<=0 then
        v_scenario := 'NO_POSITIVE_REGIONAL_HISTORY';
    else
        -- Existing REGION_SCALED_COMMON_BASIS remains the preferred evidence-based fallback.
        return new;
    end if;

    select * into v_policy from costing.fn_resolve_regional_sales_default_policy_as_of(v_scenario,new.region_code,new.valuation_date);
    new.regional_default_resolution_status := v_policy.resolution_status;
    new.regional_default_resolution_note := v_policy.resolution_note;
    if v_policy.resolution_status is distinct from 'RESOLVED' then return new; end if;

    select * into v_value from costing.fn_resolve_regional_default_commercial_value(new.sku_id,new.region_code,v_policy.default_sales_units,new.valuation_date);
    new.regional_default_policy_id := v_policy.policy_id;
    new.regional_default_scenario := v_policy.scenario_code;
    new.regional_default_sales_units := v_policy.default_sales_units;
    new.regional_default_effective_from := v_policy.effective_from;
    new.regional_default_effective_to := v_policy.effective_to;
    new.regional_default_resolution_status := v_value.resolution_status;
    new.regional_default_resolution_note := v_value.resolution_note;
    new.regional_default_assumed_sales_value := v_value.resolved_sales_value;
    new.regional_default_value_source := v_value.value_resolution_source;

    if v_value.resolution_status is distinct from 'READY' then return new; end if;

    new.resolved_regional_units := v_policy.default_sales_units;
    new.resolved_regional_base_qty := v_policy.default_sales_units * new.sku_base_qty_per_unit;
    new.regional_basis_source := 'REGIONAL_DEFAULT_POLICY_UNITS';
    new.regional_basis_status := 'REVIEW_REQUIRED';
    new.regional_basis_note := format(
        'No higher-precedence positive regional physical basis is available. Governed regional default policy %s supplies %s total sales units for %s; commercial value is derived from governed standard pricing and requires review.',
        v_policy.policy_id,v_policy.default_sales_units,new.region_code
    );
    return new;
end;
$function$;

drop trigger if exists trg_apply_regional_default_to_basis_snapshot
  on costing.sku_regional_marketing_allocation_basis_snapshot;

CREATE TRIGGER trg_apply_regional_default_to_basis_snapshot
  BEFORE INSERT ON costing.sku_regional_marketing_allocation_basis_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION costing.fn_apply_regional_default_to_basis_snapshot();

CREATE OR REPLACE FUNCTION costing.fn_reprice_regional_marketing_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare v_run_id bigint;
begin
  for v_run_id in select distinct refresh_run_id from new_rows loop
    with pr as materialized (
      select b.product_id,b.region_code,
             max(b.product_region_actual_evidence_row_count)::bigint actual_row_count,
             max(b.product_region_actual_signed_billed_value)::numeric actual_value,
             count(*) filter(where b.product_region_actual_evidence_row_count=0 and b.assumption_resolution_status='RESOLVED')::bigint explicit_count,
             coalesce(sum(b.assumed_sales_value) filter(where b.product_region_actual_evidence_row_count=0 and b.assumption_resolution_status='RESOLVED'),0::numeric) explicit_value,
             count(*) filter(where b.product_region_actual_evidence_row_count=0 and b.assumption_resolution_status<>'RESOLVED' and b.regional_default_resolution_status='READY' and b.regional_default_assumed_sales_value is not null)::bigint default_count,
             coalesce(sum(b.regional_default_assumed_sales_value) filter(where b.product_region_actual_evidence_row_count=0 and b.assumption_resolution_status<>'RESOLVED' and b.regional_default_resolution_status='READY'),0::numeric) default_value,
             sum(b.resolved_regional_base_qty) filter(where b.regional_basis_status in ('READY','REVIEW_REQUIRED') and b.resolved_regional_base_qty>0)::numeric recipient_base_qty
      from costing.sku_regional_marketing_allocation_basis_snapshot b
      where b.refresh_run_id=v_run_id
      group by b.product_id,b.region_code
    ), resolved_pr as materialized (
      select pr.*,
             case when actual_row_count>0 then 'ACTUAL_SIGNED_BILLED_SALES'
                  when explicit_count>0 then 'APPROVED_REGIONAL_ASSUMPTION'
                  when default_count>0 then 'GOVERNED_REGIONAL_DEFAULT'
                  else 'NO_ELIGIBLE_HISTORY' end value_source,
             case when actual_row_count>0 then actual_value
                  when explicit_count>0 then explicit_value
                  when default_count>0 then default_value
                  else 0::numeric end resolved_value
      from pr
    ), company as (
      select coalesce(sum(resolved_value),0::numeric) company_value from resolved_pr
    ), calc as (
      select e.id,p.value_source,p.resolved_value,p.recipient_base_qty,c.company_value,
             case when c.company_value<>0 then p.resolved_value/c.company_value else null::numeric end monetary_share
      from costing.sku_regional_marketing_expense_allocation_snapshot e
      join resolved_pr p on p.product_id=e.product_id and p.region_code=e.region_code
      cross join company c
      where e.refresh_run_id=v_run_id
    )
    update costing.sku_regional_marketing_expense_allocation_snapshot e
       set marketing_value_source=c.value_source,
           resolved_product_region_marketing_sales_value=c.resolved_value,
           resolved_company_marketing_sales_value=c.company_value,
           product_region_monetary_allocation_share=c.monetary_share,
           product_region_marketing_allocation=case when c.monetary_share is null then null else e.marketing_pool_amount*c.monetary_share end,
           recipient_product_region_base_qty=c.recipient_base_qty,
           marketing_expense_cost_per_sku_region=case
             when e.regional_basis_status='BLOCKED' then null
             when c.recipient_base_qty is null or c.recipient_base_qty<=0 then null
             when e.sku_base_qty_per_unit is null or e.sku_base_qty_per_unit<=0 then null
             when c.monetary_share is null then null
             else (e.marketing_pool_amount*c.monetary_share/c.recipient_base_qty)*e.sku_base_qty_per_unit end,
           marketing_expense_allocation_status=case
             when e.regional_basis_status='BLOCKED' then 'BLOCKED'
             when c.recipient_base_qty is null or c.recipient_base_qty<=0 then 'BLOCKED'
             when e.sku_base_qty_per_unit is null or e.sku_base_qty_per_unit<=0 then 'BLOCKED'
             when c.monetary_share is null then 'BLOCKED'
             when c.value_source in ('APPROVED_REGIONAL_ASSUMPTION','GOVERNED_REGIONAL_DEFAULT','NO_ELIGIBLE_HISTORY') then 'REVIEW_REQUIRED'
             when c.resolved_value<=0 then 'REVIEW_REQUIRED'
             when e.regional_basis_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
             else 'READY' end,
           marketing_expense_allocation_note=case
             when e.regional_basis_status='BLOCKED' then 'Regional Marketing allocation is blocked because the governed SKU-region physical basis is blocked.'
             when c.recipient_base_qty is null or c.recipient_base_qty<=0 then 'Regional Marketing allocation is blocked because the Product × Region recipient base quantity is missing or nonpositive.'
             when e.sku_base_qty_per_unit is null or e.sku_base_qty_per_unit<=0 then 'Regional Marketing allocation is blocked because SKU base quantity per unit is missing or nonpositive.'
             when c.monetary_share is null then 'Regional Marketing allocation is blocked because the resolved company Marketing sales value is zero.'
             when c.value_source='GOVERNED_REGIONAL_DEFAULT' then 'No eligible actual Product × Region sales rows or explicit regional assumption exist; Marketing allocation uses the governed regional default quantity with commercial value derived from standard pricing and requires review.'
             when c.value_source='APPROVED_REGIONAL_ASSUMPTION' then 'No eligible actual Product × Region sales rows exist; the monetary share uses governed regional assumptions visible at the exact refresh-run cutoff and requires review.'
             when c.value_source='NO_ELIGIBLE_HISTORY' then 'No eligible actual Product × Region sales rows, explicit assumption, or usable governed regional default exist. Regional Marketing allocation is zero and requires review.'
             when c.resolved_value<=0 then 'Actual eligible Product × Region signed billed value is zero or negative. Actual monetary precedence is retained and requires review.'
             when e.regional_basis_status='REVIEW_REQUIRED' then 'Actual Product × Region monetary share is combined with a governed assumed/default or region-scaled physical basis and requires review.'
             else 'Regional Marketing expense uses Product × Region signed tax-exclusive billed value and the governed regional base quantity.' end
      from calc c where e.id=c.id;
  end loop;
  return null;
end;
$function$;
