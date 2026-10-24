-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view costing.v_product_qc_allocation_current as
with current_run as (
    select refresh_run_id, period_start, valuation_date
    from costing.v_current_successful_costing_refresh_run
), persisted as (
    select
        p.id,
        p.period_start,
        p.valuation_date,
        p.refresh_run_id,
        p.product_workload_snapshot_id,
        p.policy_id,
        p.quality_control_pool_snapshot_id,
        p.product_id,
        p.product_name,
        p.product_group_id,
        p.protocol_category_id,
        p.base_spec_profile_id,
        p.workload_units,
        p.company_resolved_workload_units,
        p.product_workload_share,
        p.quality_control_pool_amount,
        p.product_qc_allocation_amount,
        p.product_base_uom,
        p.product_absorption_base_qty,
        p.absorption_basis_source,
        p.absorption_basis_method,
        p.absorption_basis_source_month,
        p.absorption_basis_status,
        p.absorption_basis_note,
        p.qc_cost_per_product_base_uom,
        p.allocation_status,
        p.allocation_reason_code,
        p.allocation_note,
        p.recipient_product_count,
        p.included_product_count,
        p.excluded_product_count,
        p.resolved_coverage_ratio,
        p.refreshed_at,
        'PERSISTED_EXACT_RUN'::text as projection_source
    from costing.product_qc_allocation_snapshot p
    join current_run r on r.refresh_run_id=p.refresh_run_id
), recipient as (
    select
        r.refresh_run_id,
        r.period_start,
        r.valuation_date,
        b.product_id,
        max(b.product_name) as product_name,
        min(b.product_base_uom) as product_base_uom,
        min(b.monthly_product_allocation_base_qty) as product_absorption_base_qty,
        min(b.monthly_driver_source) as absorption_basis_source,
        min(b.monthly_driver_method) as absorption_basis_method,
        min(b.monthly_driver_source_month) as absorption_basis_source_month,
        case
          when bool_or(b.monthly_driver_status='BLOCKED') then 'BLOCKED'
          when bool_or(b.monthly_driver_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
          else 'READY'
        end as absorption_basis_status,
        string_agg(distinct coalesce(b.monthly_driver_note,b.allocation_resolution_note,''),' | ') as absorption_basis_note
    from current_run r
    join costing.sku_sales_allocation_basis_snapshot b
      on b.refresh_run_id=r.refresh_run_id
    group by r.refresh_run_id,r.period_start,r.valuation_date,b.product_id
), preview as (
    select rec.*, lab.fn_preview_effective_fg_spec_for_product(rec.product_id,rec.valuation_date) as spec
    from recipient rec
    where not exists (select 1 from persisted p where p.refresh_run_id=rec.refresh_run_id)
), method_calc as (
    select
      p.refresh_run_id,p.product_id,
      count(*) filter (where coalesce((line->>'is_required')::boolean,false))::integer as required_line_count,
      count(distinct nullif(line->>'method_id','')::bigint) filter (where coalesce((line->>'is_required')::boolean,false))::integer as distinct_method_count,
      sum(1.00::numeric + greatest(x.line_count-1,0)::numeric*0.25::numeric) as workload_units
    from preview p
    left join lateral jsonb_array_elements(coalesce(p.spec->'lines','[]'::jsonb)) line on true
    left join lateral (
      select count(*)::integer as line_count
      from jsonb_array_elements(coalesce(p.spec->'lines','[]'::jsonb)) l2
      where coalesce((l2->>'is_required')::boolean,false)
        and nullif(l2->>'method_id','')::bigint = nullif(line->>'method_id','')::bigint
    ) x on coalesce((line->>'is_required')::boolean,false)
    group by p.refresh_run_id,p.product_id
), counts as (
    select
      count(*)::integer as recipient_count,
      count(*) filter (where coalesce((p.spec->>'ok')::boolean,false))::integer as included_count,
      count(*) filter (where not coalesce((p.spec->>'ok')::boolean,false))::integer as excluded_count
    from preview p
), fallback as (
    select
      null::bigint as id,
      p.period_start,p.valuation_date,p.refresh_run_id,
      null::bigint as product_workload_snapshot_id,
      pol.id as policy_id,
      null::bigint as quality_control_pool_snapshot_id,
      p.product_id,p.product_name,
      nullif(p.spec->>'product_group_id','')::bigint as product_group_id,
      nullif(p.spec->>'protocol_category_id','')::bigint as protocol_category_id,
      nullif(p.spec->>'base_spec_profile_id','')::bigint as base_spec_profile_id,
      case when coalesce((p.spec->>'ok')::boolean,false) then m.workload_units else null end as workload_units,
      null::numeric as company_resolved_workload_units,
      null::numeric as product_workload_share,
      null::numeric as quality_control_pool_amount,
      null::numeric as product_qc_allocation_amount,
      p.product_base_uom,
      case when coalesce((p.spec->>'ok')::boolean,false) then p.product_absorption_base_qty else null end as product_absorption_base_qty,
      p.absorption_basis_source,p.absorption_basis_method,p.absorption_basis_source_month,
      p.absorption_basis_status,p.absorption_basis_note,
      null::numeric as qc_cost_per_product_base_uom,
      case
        when not coalesce((p.spec->>'ok')::boolean,false) then 'BLOCKED'
        else 'REVIEW_REQUIRED'
      end as allocation_status,
      case
        when not coalesce((p.spec->>'ok')::boolean,false)
             and coalesce(p.spec->>'message','') like 'No active FG protocol mapping found%'
          then 'BLOCKED_MISSING_FG_PROTOCOL_MAPPING'
        when not coalesce((p.spec->>'ok')::boolean,false)
          then 'BLOCKED_EFFECTIVE_SPEC_RESOLUTION_ERROR'
        else 'PENDING_NEW_GOVERNED_REFRESH'
      end as allocation_reason_code,
      case
        when not coalesce((p.spec->>'ok')::boolean,false) then coalesce(p.spec->>'message','Effective FG specification could not be resolved.')
        else 'Method 3 workload can be previewed, but immutable QC monetary allocation is pending the next governed costing refresh.'
      end as allocation_note,
      c.recipient_count,
      c.included_count,
      c.excluded_count,
      c.included_count::numeric/nullif(c.recipient_count,0)::numeric as resolved_coverage_ratio,
      clock_timestamp() as refreshed_at,
      'CONTROLLED_PRE_REFRESH_FALLBACK'::text as projection_source
    from preview p
    left join method_calc m on m.refresh_run_id=p.refresh_run_id and m.product_id=p.product_id
    cross join counts c
    left join lateral (select (costing.fn_resolve_qc_workload_policy(p.valuation_date)).*) pol on true
)
select * from persisted
union all
select * from fallback;

create or replace view costing.v_sku_qc_allocation_current as
with current_run as (
  select refresh_run_id from costing.v_current_successful_costing_refresh_run
), persisted as (
  select
    s.id,s.period_start,s.valuation_date,s.refresh_run_id,
    s.product_qc_allocation_snapshot_id,s.sales_allocation_basis_snapshot_id,
    s.sku_id,s.product_id,s.product_name,s.pack_size,s.pack_uom,
    s.product_base_uom,s.sku_base_qty_per_unit,s.qc_cost_per_product_base_uom,
    s.quality_control_overhead_cost_per_sku,s.allocation_status,
    s.allocation_reason_code,s.allocation_note,s.refreshed_at,
    'PERSISTED_EXACT_RUN'::text as projection_source
  from costing.sku_qc_allocation_snapshot s
  join current_run r on r.refresh_run_id=s.refresh_run_id
), fallback as (
  select
    null::bigint as id,
    b.period_start,b.valuation_date,b.refresh_run_id,
    null::bigint as product_qc_allocation_snapshot_id,
    b.id as sales_allocation_basis_snapshot_id,
    b.sku_id,b.product_id,b.product_name,b.pack_size,b.pack_uom,
    b.product_base_uom,
    case when p.allocation_status<>'BLOCKED' then b.sku_base_qty_per_unit else null end,
    null::numeric as qc_cost_per_product_base_uom,
    null::numeric as quality_control_overhead_cost_per_sku,
    p.allocation_status,p.allocation_reason_code,p.allocation_note,
    p.refreshed_at,
    'CONTROLLED_PRE_REFRESH_FALLBACK'::text as projection_source
  from costing.sku_sales_allocation_basis_snapshot b
  join current_run r on r.refresh_run_id=b.refresh_run_id
  join costing.v_product_qc_allocation_current p
    on p.refresh_run_id=b.refresh_run_id and p.product_id=b.product_id
  where not exists (select 1 from persisted x where x.refresh_run_id=b.refresh_run_id)
)
select * from persisted
union all
select * from fallback;

create or replace view costing.v_qc_action_queue_current as
select
  p.period_start,p.valuation_date,p.refresh_run_id,
  p.product_id,p.product_name,p.product_group_id,p.protocol_category_id,p.base_spec_profile_id,
  case when p.allocation_status='BLOCKED' then 'BLOCKER' else 'REVIEW_REQUIRED' end as action_severity,
  case
    when p.allocation_reason_code='BLOCKED_MISSING_FG_PROTOCOL_MAPPING' then 1
    when p.allocation_reason_code like 'BLOCKED_%' then 2
    when p.absorption_basis_status='REVIEW_REQUIRED' then 3
    else 4
  end as action_priority,
  p.allocation_reason_code as action_code,
  case
    when p.allocation_reason_code='BLOCKED_MISSING_FG_PROTOCOL_MAPPING' then 'LIMS_FG_PROTOCOL_MAPPING'
    when p.absorption_basis_status='REVIEW_REQUIRED' then 'COSTING_MONTHLY_ABSORPTION_BASIS'
    else 'QC_COSTING_REVIEW'
  end as recommended_ui_route,
  case
    when p.allocation_reason_code='BLOCKED_MISSING_FG_PROTOCOL_MAPPING' then 'Classify the Product Group, assign and approve the applicable FG protocol category in LIMS, then request a new costing refresh.'
    when p.allocation_reason_code='PENDING_NEW_GOVERNED_REFRESH' then 'Request a new governed costing refresh to persist the approved QC workload and monetary allocation.'
    when p.absorption_basis_status='REVIEW_REQUIRED' then 'Review the governed monthly Product absorption quantity used to express QC allocation per base UOM.'
    else 'Review and resolve the QC costing control state.'
  end as recommended_action,
  p.allocation_note as action_note,
  p.workload_units,p.product_absorption_base_qty,p.absorption_basis_source,p.absorption_basis_status,
  p.allocation_status,p.recipient_product_count,p.included_product_count,p.excluded_product_count,
  p.resolved_coverage_ratio,p.projection_source,p.refreshed_at
from costing.v_product_qc_allocation_current p
where p.allocation_status in ('BLOCKED','REVIEW_REQUIRED');

create or replace function public.rpc_get_qc_action_queue(
  p_period_start date default null,
  p_action_code text default null,
  p_q text default null,
  p_limit integer default 100,
  p_offset integer default 0
) returns table(row_data jsonb,total_count bigint)
language plpgsql security definer
set search_path='public','costing','pg_temp'
as $$
declare
  v_period_start date := case when p_period_start is null then null else date_trunc('month',p_period_start)::date end;
  v_action_code text := nullif(upper(btrim(coalesce(p_action_code,''))),'');
  v_q text := nullif(btrim(coalesce(p_q,'')),'');
begin
  perform public.require_permission('module:cost-sheet-review',false);
  return query
  with filtered as (
    select q.* from costing.v_qc_action_queue_current q
    where (v_period_start is null or q.period_start=v_period_start)
      and (v_action_code is null or upper(q.action_code)=v_action_code)
      and (v_q is null or q.product_name ilike '%'||v_q||'%' or q.product_id::text ilike '%'||v_q||'%' or q.action_code ilike '%'||v_q||'%')
  ), counted as (select count(*)::bigint total_count from filtered),
  page as (
    select * from filtered
    order by action_priority,product_name,product_id
    limit greatest(coalesce(p_limit,100),1)
    offset greatest(coalesce(p_offset,0),0)
  )
  select to_jsonb(page.*),counted.total_count from page cross join counted;
end;
$$;

create or replace function public.rpc_get_product_qc_explain(
  p_period_start date,
  p_product_id bigint
) returns jsonb
language plpgsql stable security definer
set search_path='public','costing','lab','pg_temp'
as $$
declare
  v_period date := date_trunc('month',p_period_start)::date;
  v_row record;
  v_methods jsonb;
  v_preview jsonb;
begin
  perform public.require_permission('module:cost-sheet-review',false);
  if p_period_start is null or p_product_id is null then raise exception 'period_start and product_id are required'; end if;
  select * into v_row from costing.v_product_qc_allocation_current
  where period_start=v_period and product_id=p_product_id;
  if not found then
    return jsonb_build_object('summary_status','NO_TRACE_DATA','period_start',v_period,'product_id',p_product_id,'message','No current QC allocation context exists for the selected Product.');
  end if;
  if v_row.projection_source='PERSISTED_EXACT_RUN' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'method_id',d.method_id,'method_code',d.method_code,'method_name',d.method_name,
      'required_line_count',d.required_line_count,'method_base_units',d.method_base_units,
      'additional_parameter_units',d.additional_parameter_units,'method_workload_units',d.method_workload_units,
      'effective_test_evidence',d.effective_test_evidence
    ) order by d.method_name,d.method_id),'[]'::jsonb)
    into v_methods
    from costing.product_qc_method_workload_snapshot d
    where d.refresh_run_id=v_row.refresh_run_id and d.product_id=p_product_id;
  else
    v_preview:=lab.fn_preview_effective_fg_spec_for_product(p_product_id,v_row.valuation_date);
    select coalesce(jsonb_agg(jsonb_build_object(
      'method_id',x.method_id,'method_code',x.method_code,'method_name',x.method_name,
      'required_line_count',x.line_count,'method_base_units',1.00,
      'additional_parameter_units',0.25,
      'method_workload_units',1.00+greatest(x.line_count-1,0)*0.25,
      'effective_test_evidence',x.evidence
    ) order by x.method_name,x.method_id),'[]'::jsonb)
    into v_methods
    from (
      select nullif(line->>'method_id','')::bigint method_id,max(line->>'method_code') method_code,max(line->>'method_name') method_name,
             count(*)::integer line_count,
             jsonb_agg(jsonb_build_object('seq_no',line->>'seq_no','test_id',line->>'test_id','test_code',line->>'test_code','test_name',line->>'test_name','source_type',line->>'source_type','source_override_id',line->>'source_override_id') order by nullif(line->>'seq_no','')::integer) evidence
      from jsonb_array_elements(coalesce(v_preview->'lines','[]'::jsonb)) line
      where coalesce((line->>'is_required')::boolean,false)
      group by nullif(line->>'method_id','')::bigint
    ) x;
  end if;
  return to_jsonb(v_row)||jsonb_build_object('methods',v_methods,'summary_status',v_row.allocation_status);
end;
$$;

create or replace function public.rpc_get_sku_qc_explain(
  p_period_start date,
  p_product_id bigint,
  p_sku_id bigint
) returns jsonb
language plpgsql stable security definer
set search_path='public','costing','pg_temp'
as $$
declare
  v_period date := date_trunc('month',p_period_start)::date;
  v_sku record;
  v_product jsonb;
begin
  perform public.require_permission('module:cost-sheet-review',false);
  if p_period_start is null or p_product_id is null or p_sku_id is null then raise exception 'period_start, product_id and sku_id are required'; end if;
  select * into v_sku from costing.v_sku_qc_allocation_current
  where period_start=v_period and product_id=p_product_id and sku_id=p_sku_id;
  if not found then
    return jsonb_build_object('summary_status','NO_TRACE_DATA','period_start',v_period,'product_id',p_product_id,'sku_id',p_sku_id,'message','No current QC allocation context exists for the selected SKU.');
  end if;
  v_product:=public.rpc_get_product_qc_explain(v_period,p_product_id);
  return jsonb_build_object('sku',to_jsonb(v_sku),'product',v_product,'summary_status',v_sku.allocation_status);
end;
$$;

revoke all on costing.v_product_qc_allocation_current from public,anon,authenticated;
revoke all on costing.v_sku_qc_allocation_current from public,anon,authenticated;
revoke all on costing.v_qc_action_queue_current from public,anon,authenticated;
revoke all on function public.rpc_get_qc_action_queue(date,text,text,integer,integer) from public,anon;
revoke all on function public.rpc_get_product_qc_explain(date,bigint) from public,anon;
revoke all on function public.rpc_get_sku_qc_explain(date,bigint,bigint) from public,anon;
grant execute on function public.rpc_get_qc_action_queue(date,text,text,integer,integer) to authenticated,service_role;
grant execute on function public.rpc_get_product_qc_explain(date,bigint) to authenticated,service_role;
grant execute on function public.rpc_get_sku_qc_explain(date,bigint,bigint) to authenticated,service_role;