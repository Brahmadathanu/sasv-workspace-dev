-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view costing.v_product_rm_stores_workload_current
with (security_invoker = false) as
select
    rm.*,
    p.policy_code,
    p.policy_version,
    p.repeated_rm_line_increment,
    p.rm_form_conversion_increment,
    p.pm_override_line_increment,
    p.pm_global_multiplier,
    p.approval_reference as policy_approval_reference,
    'PERSISTED_EXACT_RUN'::text as projection_source
from costing.product_rm_stores_workload_snapshot rm
join costing.v_current_successful_costing_refresh_run cr
  on cr.refresh_run_id = rm.refresh_run_id
join costing.materials_stores_workload_policy p
  on p.id = rm.policy_id;

create or replace view costing.v_sku_pm_stores_workload_current
with (security_invoker = false) as
select
    pm.*,
    p.policy_code,
    p.policy_version,
    p.pm_override_line_increment,
    p.pm_global_multiplier,
    p.approval_reference as policy_approval_reference,
    'PERSISTED_EXACT_RUN'::text as projection_source
from costing.sku_pm_stores_workload_snapshot pm
join costing.v_current_successful_costing_refresh_run cr
  on cr.refresh_run_id = pm.refresh_run_id
join costing.materials_stores_workload_policy p
  on p.id = pm.policy_id;

create or replace view costing.v_sku_materials_stores_allocation_current
with (security_invoker = false) as
select
    a.id as allocation_snapshot_id,
    a.period_start,
    a.valuation_date,
    a.refresh_run_id,
    a.workload_snapshot_id,
    a.pool_snapshot_id,
    w.policy_id,
    p.policy_code,
    p.policy_version,
    p.approval_reference as policy_approval_reference,
    a.sku_id,
    a.product_id,
    a.product_name,
    a.pack_size,
    a.pack_uom,
    w.product_base_uom,
    w.product_rm_workload_snapshot_id,
    w.sku_pm_workload_snapshot_id,
    w.monthly_sku_units,
    w.monthly_sku_base_qty,
    w.monthly_driver_method,
    w.monthly_driver_source,
    w.monthly_driver_source_month,
    w.monthly_driver_status,
    w.monthly_driver_note,
    rm.required_rm_line_count,
    rm.distinct_purchase_item_count,
    rm.repeated_rm_line_count,
    rm.form_conversion_line_count,
    rm.rm_complexity_units,
    rm.rm_reference_output_qty,
    rm.rm_reference_output_uom,
    rm.rm_uom_compatibility_status,
    rm.zero_rm_classification_code,
    rm.rm_evidence_status,
    rm.rm_evidence_reason,
    pm.required_pm_line_count,
    pm.distinct_pm_item_count,
    pm.pm_override_line_count,
    pm.pm_complexity_units,
    pm.pm_reference_output_qty,
    pm.zero_pm_classification_code,
    pm.pm_evidence_status,
    pm.pm_evidence_reason,
    w.rm_workload_units,
    w.pm_workload_units,
    a.unified_workload_units,
    a.company_eligible_workload_units,
    a.workload_share,
    a.frozen_pool_amount,
    a.monthly_sku_allocation_amount,
    a.materials_stores_overhead_cost_per_sku,
    a.allocation_status,
    a.allocation_reason_code,
    a.allocation_note,
    a.captured_at,
    'PERSISTED_EXACT_RUN'::text as projection_source
from costing.sku_materials_stores_allocation_snapshot a
join costing.v_current_successful_costing_refresh_run cr
  on cr.refresh_run_id = a.refresh_run_id
join costing.sku_materials_stores_workload_snapshot w
  on w.id = a.workload_snapshot_id
join costing.product_rm_stores_workload_snapshot rm
  on rm.id = w.product_rm_workload_snapshot_id
join costing.sku_pm_stores_workload_snapshot pm
  on pm.id = w.sku_pm_workload_snapshot_id
join costing.materials_stores_workload_policy p
  on p.id = w.policy_id;

create or replace view costing.v_materials_stores_action_queue_current
with (security_invoker = false) as
select
    s.period_start,
    s.valuation_date,
    s.refresh_run_id,
    s.sku_id,
    s.product_id,
    s.product_name,
    s.pack_size,
    s.pack_uom,
    s.product_base_uom,
    case when s.allocation_status = 'BLOCKED' then 'BLOCKER' else 'REVIEW_REQUIRED' end::text as action_severity,
    case
      when s.allocation_reason_code = 'BLOCKED_NO_RM_OR_PM_STANDARD_EVIDENCE' then 1
      when s.allocation_reason_code = 'BLOCKED_MISSING_PM_REFERENCE_OUTPUT' then 2
      when s.allocation_reason_code in ('BLOCKED_MISSING_RM_REFERENCE_OUTPUT','BLOCKED_MISSING_RM_REFERENCE_UOM','BLOCKED_INCOMPATIBLE_RM_REFERENCE_UOM') then 3
      when s.allocation_status = 'BLOCKED' then 4
      when s.allocation_reason_code in ('REVIEW_ZERO_RM_CLASSIFICATION_REQUIRED','REVIEW_ZERO_PM_CLASSIFICATION_REQUIRED') then 5
      else 6
    end::integer as action_priority,
    s.allocation_reason_code as action_code,
    case
      when s.allocation_reason_code in ('BLOCKED_NO_RM_OR_PM_STANDARD_EVIDENCE','BLOCKED_MISSING_RM_REFERENCE_OUTPUT','BLOCKED_MISSING_RM_REFERENCE_UOM','BLOCKED_INCOMPATIBLE_RM_REFERENCE_UOM','REVIEW_ZERO_RM_CLASSIFICATION_REQUIRED') then 'MATERIAL_COST_MANAGER_RM'
      when s.allocation_reason_code in ('BLOCKED_MISSING_PM_REFERENCE_OUTPUT','REVIEW_ZERO_PM_CLASSIFICATION_REQUIRED') then 'MATERIAL_COST_MANAGER_PM'
      when s.allocation_reason_code in ('REVIEW_MONTHLY_ALLOCATION_BASIS','BLOCKED_MONTHLY_ALLOCATION_BASIS') then 'COSTING_MONTHLY_ALLOCATION_BASIS'
      else 'COST_SHEET_REVIEW'
    end::text as recommended_ui_route,
    case
      when s.allocation_reason_code = 'BLOCKED_NO_RM_OR_PM_STANDARD_EVIDENCE' then 'Define governed RM and/or PM standard evidence for the SKU, then request a fresh costing refresh.'
      when s.allocation_reason_code = 'BLOCKED_MISSING_PM_REFERENCE_OUTPUT' then 'Correct or approve the SKU pack-format reference output, then request a fresh costing refresh.'
      when s.allocation_reason_code = 'BLOCKED_MISSING_RM_REFERENCE_OUTPUT' then 'Correct or approve the Product RM reference output quantity, then request a fresh costing refresh.'
      when s.allocation_reason_code = 'BLOCKED_MISSING_RM_REFERENCE_UOM' then 'Correct the Product RM reference-output UOM or Product base UOM, then request a fresh costing refresh.'
      when s.allocation_reason_code = 'BLOCKED_INCOMPATIBLE_RM_REFERENCE_UOM' then 'Resolve the governed Product-base and RM reference-output UOM incompatibility, then request a fresh costing refresh.'
      when s.allocation_reason_code = 'REVIEW_ZERO_RM_CLASSIFICATION_REQUIRED' then 'Classify the absence of Product RM evidence through the governed Materials / Stores classification register.'
      when s.allocation_reason_code = 'REVIEW_ZERO_PM_CLASSIFICATION_REQUIRED' then 'Classify the absence of SKU PM evidence through the governed Materials / Stores classification register.'
      when s.allocation_reason_code = 'REVIEW_MONTHLY_ALLOCATION_BASIS' then 'Review the governed assumed or default monthly SKU quantity used for Stores workload absorption.'
      when s.allocation_reason_code = 'BLOCKED_MONTHLY_ALLOCATION_BASIS' then 'Resolve the blocked monthly SKU allocation basis, then request a fresh costing refresh.'
      else 'Review and resolve the Materials / Stores costing control state.'
    end::text as recommended_action,
    s.allocation_note as action_note,
    s.required_rm_line_count,
    s.required_pm_line_count,
    s.rm_evidence_status,
    s.pm_evidence_status,
    s.monthly_driver_status,
    s.monthly_sku_units,
    s.unified_workload_units,
    s.monthly_sku_allocation_amount,
    s.materials_stores_overhead_cost_per_sku,
    s.allocation_status,
    s.projection_source,
    s.captured_at
from costing.v_sku_materials_stores_allocation_current s
where s.allocation_status in ('BLOCKED','REVIEW_REQUIRED');

create or replace function public.rpc_get_materials_stores_action_queue(
    p_period_start date default null,
    p_action_code text default null,
    p_q text default null,
    p_limit integer default 100,
    p_offset integer default 0
)
returns table(row_data jsonb,total_count bigint)
language plpgsql
security definer
set search_path = public,costing,pg_temp
as $function$
declare
    v_period_start date := case when p_period_start is null then null else date_trunc('month',p_period_start)::date end;
    v_action_code text := nullif(upper(btrim(coalesce(p_action_code,''))),'');
    v_q text := nullif(btrim(coalesce(p_q,'')),'');
begin
    perform public.require_permission('module:cost-sheet-review',false);
    return query
    with filtered as (
      select q.*
      from costing.v_materials_stores_action_queue_current q
      where (v_period_start is null or q.period_start=v_period_start)
        and (v_action_code is null or upper(q.action_code)=v_action_code)
        and (
          v_q is null
          or q.product_name ilike '%'||v_q||'%'
          or q.product_id::text ilike '%'||v_q||'%'
          or q.sku_id::text ilike '%'||v_q||'%'
          or q.action_code ilike '%'||v_q||'%'
        )
    ), counted as (
      select count(*)::bigint total_count from filtered
    ), page as (
      select * from filtered
      order by action_priority,product_name,pack_size,pack_uom,sku_id
      limit greatest(least(coalesce(p_limit,100),500),1)
      offset greatest(coalesce(p_offset,0),0)
    )
    select to_jsonb(page.*),counted.total_count
    from page cross join counted;
end;
$function$;

create or replace function public.rpc_get_product_materials_stores_explain(
    p_period_start date,
    p_product_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public,costing,pg_temp
as $function$
declare
    v_period date := date_trunc('month',p_period_start)::date;
    v_rm record;
    v_skus jsonb;
    v_summary_status text;
begin
    perform public.require_permission('module:cost-sheet-review',false);
    if p_period_start is null or p_product_id is null then
      raise exception 'period_start and product_id are required';
    end if;

    select * into v_rm
    from costing.v_product_rm_stores_workload_current
    where period_start=v_period and product_id=p_product_id;

    if not found then
      return jsonb_build_object(
        'summary_status','NO_TRACE_DATA',
        'period_start',v_period,
        'product_id',p_product_id,
        'message','No current Materials / Stores Product RM context exists for the selected Product.'
      );
    end if;

    select
      coalesce(jsonb_agg(to_jsonb(s) order by s.pack_size,s.pack_uom,s.sku_id),'[]'::jsonb),
      case
        when bool_or(s.allocation_status='BLOCKED') then 'BLOCKED'
        when bool_or(s.allocation_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
        else 'READY'
      end
    into v_skus,v_summary_status
    from costing.v_sku_materials_stores_allocation_current s
    where s.period_start=v_period and s.product_id=p_product_id;

    return jsonb_build_object(
      'summary_status',coalesce(v_summary_status,v_rm.rm_evidence_status),
      'product_rm',to_jsonb(v_rm),
      'skus',v_skus
    );
end;
$function$;

create or replace function public.rpc_get_sku_materials_stores_explain(
    p_period_start date,
    p_product_id bigint,
    p_sku_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public,costing,pg_temp
as $function$
declare
    v_sku record;
begin
    perform public.require_permission('module:cost-sheet-review',false);
    if p_period_start is null or p_product_id is null or p_sku_id is null then
      raise exception 'period_start, product_id and sku_id are required';
    end if;

    select * into v_sku
    from costing.v_sku_materials_stores_allocation_current
    where period_start=date_trunc('month',p_period_start)::date
      and product_id=p_product_id
      and sku_id=p_sku_id;

    if not found then
      return jsonb_build_object(
        'summary_status','NO_TRACE_DATA',
        'period_start',date_trunc('month',p_period_start)::date,
        'product_id',p_product_id,
        'sku_id',p_sku_id,
        'message','No current Materials / Stores allocation context exists for the selected SKU.'
      );
    end if;

    return jsonb_build_object(
      'summary_status',v_sku.allocation_status,
      'sku',to_jsonb(v_sku),
      'calculation',jsonb_build_object(
        'rm_workload_formula','RM complexity × monthly SKU base quantity ÷ Product RM reference output quantity',
        'pm_workload_formula','PM complexity × monthly SKU units ÷ SKU pack-format reference output quantity',
        'unified_workload_formula','RM workload + PM workload',
        'monthly_allocation_formula','Frozen Stores pool × SKU workload share',
        'per_sku_absorption_formula','Monthly SKU Stores allocation ÷ governed monthly SKU units'
      )
    );
end;
$function$;

revoke all on costing.v_product_rm_stores_workload_current from public,anon,authenticated;
revoke all on costing.v_sku_pm_stores_workload_current from public,anon,authenticated;
revoke all on costing.v_sku_materials_stores_allocation_current from public,anon,authenticated;
revoke all on costing.v_materials_stores_action_queue_current from public,anon,authenticated;

grant select on costing.v_product_rm_stores_workload_current to service_role;
grant select on costing.v_sku_pm_stores_workload_current to service_role;
grant select on costing.v_sku_materials_stores_allocation_current to service_role;
grant select on costing.v_materials_stores_action_queue_current to service_role;

revoke all on function public.rpc_get_materials_stores_action_queue(date,text,text,integer,integer) from public,anon;
revoke all on function public.rpc_get_product_materials_stores_explain(date,bigint) from public,anon;
revoke all on function public.rpc_get_sku_materials_stores_explain(date,bigint,bigint) from public,anon;

grant execute on function public.rpc_get_materials_stores_action_queue(date,text,text,integer,integer) to authenticated,service_role;
grant execute on function public.rpc_get_product_materials_stores_explain(date,bigint) to authenticated,service_role;
grant execute on function public.rpc_get_sku_materials_stores_explain(date,bigint,bigint) to authenticated,service_role;
