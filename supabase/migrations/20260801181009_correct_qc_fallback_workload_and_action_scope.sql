-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view costing.v_product_qc_allocation_current as
with current_run as (
    select refresh_run_id, period_start, valuation_date
    from costing.v_current_successful_costing_refresh_run
), persisted as (
    select
        p.id,p.period_start,p.valuation_date,p.refresh_run_id,
        p.product_workload_snapshot_id,p.policy_id,p.quality_control_pool_snapshot_id,
        p.product_id,p.product_name,p.product_group_id,p.protocol_category_id,p.base_spec_profile_id,
        p.workload_units,p.company_resolved_workload_units,p.product_workload_share,
        p.quality_control_pool_amount,p.product_qc_allocation_amount,
        p.product_base_uom,p.product_absorption_base_qty,
        p.absorption_basis_source,p.absorption_basis_method,p.absorption_basis_source_month,
        p.absorption_basis_status,p.absorption_basis_note,p.qc_cost_per_product_base_uom,
        p.allocation_status,p.allocation_reason_code,p.allocation_note,
        p.recipient_product_count,p.included_product_count,p.excluded_product_count,
        p.resolved_coverage_ratio,p.refreshed_at,
        'PERSISTED_EXACT_RUN'::text as projection_source
    from costing.product_qc_allocation_snapshot p
    join current_run r on r.refresh_run_id=p.refresh_run_id
), recipient as (
    select
        r.refresh_run_id,r.period_start,r.valuation_date,b.product_id,
        max(b.product_name) as product_name,
        min(b.product_base_uom) as product_base_uom,
        min(b.monthly_product_allocation_base_qty) as product_absorption_base_qty,
        min(b.monthly_driver_source) as absorption_basis_source,
        min(b.monthly_driver_method) as absorption_basis_method,
        min(b.monthly_driver_source_month) as absorption_basis_source_month,
        case when bool_or(b.monthly_driver_status='BLOCKED') then 'BLOCKED'
             when bool_or(b.monthly_driver_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
             else 'READY' end as absorption_basis_status,
        string_agg(distinct coalesce(b.monthly_driver_note,b.allocation_resolution_note,''),' | ') as absorption_basis_note
    from current_run r
    join costing.sku_sales_allocation_basis_snapshot b on b.refresh_run_id=r.refresh_run_id
    group by r.refresh_run_id,r.period_start,r.valuation_date,b.product_id
), preview as (
    select rec.*,lab.fn_preview_effective_fg_spec_for_product(rec.product_id,rec.valuation_date) spec
    from recipient rec
    where not exists(select 1 from persisted p where p.refresh_run_id=rec.refresh_run_id)
), method_calc as (
    select p.refresh_run_id,p.product_id,
           sum(1.00::numeric+greatest(m.line_count-1,0)::numeric*0.25::numeric) workload_units
    from preview p
    cross join lateral (
      select nullif(l->>'method_id','')::bigint method_id,count(*)::integer line_count
      from jsonb_array_elements(coalesce(p.spec->'lines','[]'::jsonb)) l
      where coalesce((l->>'is_required')::boolean,false)
      group by nullif(l->>'method_id','')::bigint
    ) m
    where coalesce((p.spec->>'ok')::boolean,false)
    group by p.refresh_run_id,p.product_id
), counts as (
    select count(*)::integer recipient_count,
           count(*) filter(where coalesce((spec->>'ok')::boolean,false))::integer included_count,
           count(*) filter(where not coalesce((spec->>'ok')::boolean,false))::integer excluded_count
    from preview
), fallback as (
    select
      null::bigint id,p.period_start,p.valuation_date,p.refresh_run_id,
      null::bigint product_workload_snapshot_id,pol.id policy_id,
      null::bigint quality_control_pool_snapshot_id,
      p.product_id,p.product_name,
      nullif(p.spec->>'product_group_id','')::bigint product_group_id,
      nullif(p.spec->>'protocol_category_id','')::bigint protocol_category_id,
      nullif(p.spec->>'base_spec_profile_id','')::bigint base_spec_profile_id,
      case when coalesce((p.spec->>'ok')::boolean,false) then m.workload_units end workload_units,
      null::numeric company_resolved_workload_units,null::numeric product_workload_share,
      null::numeric quality_control_pool_amount,null::numeric product_qc_allocation_amount,
      p.product_base_uom,
      case when coalesce((p.spec->>'ok')::boolean,false) then p.product_absorption_base_qty end product_absorption_base_qty,
      p.absorption_basis_source,p.absorption_basis_method,p.absorption_basis_source_month,
      p.absorption_basis_status,p.absorption_basis_note,
      null::numeric qc_cost_per_product_base_uom,
      case when not coalesce((p.spec->>'ok')::boolean,false) then 'BLOCKED' else 'REVIEW_REQUIRED' end allocation_status,
      case when not coalesce((p.spec->>'ok')::boolean,false) and coalesce(p.spec->>'message','') like 'No active FG protocol mapping found%' then 'BLOCKED_MISSING_FG_PROTOCOL_MAPPING'
           when not coalesce((p.spec->>'ok')::boolean,false) then 'BLOCKED_EFFECTIVE_SPEC_RESOLUTION_ERROR'
           else 'PENDING_NEW_GOVERNED_REFRESH' end allocation_reason_code,
      case when not coalesce((p.spec->>'ok')::boolean,false) then coalesce(p.spec->>'message','Effective FG specification could not be resolved.')
           else 'Method 3 workload can be previewed, but immutable QC monetary allocation is pending the next governed costing refresh.' end allocation_note,
      c.recipient_count,c.included_count,c.excluded_count,
      c.included_count::numeric/nullif(c.recipient_count,0)::numeric resolved_coverage_ratio,
      clock_timestamp() refreshed_at,'CONTROLLED_PRE_REFRESH_FALLBACK'::text projection_source
    from preview p
    left join method_calc m on m.refresh_run_id=p.refresh_run_id and m.product_id=p.product_id
    cross join counts c
    left join lateral(select (costing.fn_resolve_qc_workload_policy(p.valuation_date)).*) pol on true
)
select * from persisted
union all
select * from fallback;

create or replace view costing.v_qc_action_queue_current as
select
  p.period_start,p.valuation_date,p.refresh_run_id,p.product_id,p.product_name,
  p.product_group_id,p.protocol_category_id,p.base_spec_profile_id,
  case when p.allocation_status='BLOCKED' then 'BLOCKER' else 'REVIEW_REQUIRED' end action_severity,
  case when p.allocation_reason_code='BLOCKED_MISSING_FG_PROTOCOL_MAPPING' then 1
       when p.allocation_status='BLOCKED' then 2 else 3 end action_priority,
  case when p.allocation_status='BLOCKED' then p.allocation_reason_code
       else 'REVIEW_REQUIRED_QC_ABSORPTION_BASIS' end action_code,
  case when p.allocation_reason_code='BLOCKED_MISSING_FG_PROTOCOL_MAPPING' then 'LIMS_FG_PROTOCOL_MAPPING'
       when p.absorption_basis_status='REVIEW_REQUIRED' then 'COSTING_MONTHLY_ABSORPTION_BASIS'
       else 'QC_COSTING_REVIEW' end recommended_ui_route,
  case when p.allocation_reason_code='BLOCKED_MISSING_FG_PROTOCOL_MAPPING'
       then 'Classify the Product Group, assign and approve the applicable FG protocol category in LIMS, then request a new costing refresh.'
       when p.absorption_basis_status='REVIEW_REQUIRED'
       then 'Review the governed monthly Product absorption quantity used to express QC allocation per base UOM.'
       else 'Review and resolve the QC costing control state.' end recommended_action,
  case when p.allocation_status='BLOCKED' then p.allocation_note else p.absorption_basis_note end action_note,
  p.workload_units,p.product_absorption_base_qty,p.absorption_basis_source,p.absorption_basis_status,
  p.allocation_status,p.recipient_product_count,p.included_product_count,p.excluded_product_count,
  p.resolved_coverage_ratio,p.projection_source,p.refreshed_at
from costing.v_product_qc_allocation_current p
where p.allocation_status='BLOCKED'
   or (p.allocation_status<>'BLOCKED' and p.absorption_basis_status='REVIEW_REQUIRED');