-- backfilled from live schema_migrations on 2026-10-24, CI-016

create or replace function costing.fn_resolve_materials_stores_explain_selected_run(
  p_period_start date,
  p_valuation_date date default null,
  p_refresh_run_id bigint default null
)
returns table(
  period_start date,
  valuation_date date,
  refresh_run_id bigint
)
language plpgsql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_period date;
  v_has_valuation boolean;
  v_has_run boolean;
begin
  if p_period_start is null then
    raise exception 'p_period_start is required';
  end if;

  v_period := date_trunc('month', p_period_start)::date;
  v_has_valuation := p_valuation_date is not null;
  v_has_run := p_refresh_run_id is not null;

  if v_has_valuation <> v_has_run then
    raise exception 'Materials / Stores Explain exact-run identity requires both p_valuation_date and p_refresh_run_id';
  end if;

  if not v_has_valuation then
    return query
    select r.period_start, r.valuation_date, r.refresh_run_id
    from costing.v_current_successful_costing_refresh_run r
    where r.period_start = v_period
    limit 1;
    return;
  end if;

  return query
  select r.period_start, r.valuation_date, r.id
  from costing.costing_refresh_run r
  where r.period_start = v_period
    and r.valuation_date = p_valuation_date
    and r.id = p_refresh_run_id
    and r.overall_status = 'SUCCESS'
    and r.valuation_context_source = 'CAPTURED_AT_REQUEST';

  if not found then
    raise exception 'No governed successful costing refresh run matches the requested Materials / Stores Explain exact-run identity';
  end if;
end;
$function$;

revoke all on function costing.fn_resolve_materials_stores_explain_selected_run(date,date,bigint) from public;
revoke all on function costing.fn_resolve_materials_stores_explain_selected_run(date,date,bigint) from anon, authenticated, service_role;

drop function if exists public.rpc_get_product_materials_stores_explain(date,bigint);

create function public.rpc_get_product_materials_stores_explain(
  p_period_start date,
  p_product_id bigint,
  p_valuation_date date default null,
  p_refresh_run_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_period date := date_trunc('month',p_period_start)::date;
  v_rm record;
  v_skus jsonb;
  v_summary_status text;
  v_selected record;
  v_explicit boolean := p_valuation_date is not null or p_refresh_run_id is not null;
begin
  perform public.require_permission('module:cost-sheet-review',false);

  if p_period_start is null or p_product_id is null then
    raise exception 'period_start and product_id are required';
  end if;

  if v_explicit then
    select * into v_selected
    from costing.fn_resolve_materials_stores_explain_selected_run(
      v_period,p_valuation_date,p_refresh_run_id
    );

    select
      rm.id,
      rm.period_start,
      rm.valuation_date,
      rm.refresh_run_id,
      rm.policy_id,
      rm.product_id,
      rm.product_name,
      rm.product_base_uom,
      rm.required_rm_line_count,
      rm.distinct_purchase_item_count,
      rm.repeated_rm_line_count,
      rm.form_conversion_line_count,
      rm.rm_complexity_units,
      rm.rm_reference_output_qty,
      rm.rm_reference_output_uom,
      rm.rm_uom_compatibility_status,
      rm.zero_rm_classification_id,
      rm.zero_rm_classification_code,
      rm.rm_evidence_status,
      rm.rm_evidence_reason,
      rm.captured_at,
      p.policy_code,
      p.policy_version,
      p.repeated_rm_line_increment,
      p.rm_form_conversion_increment,
      p.pm_override_line_increment,
      p.pm_global_multiplier,
      p.approval_reference as policy_approval_reference,
      'PERSISTED_EXACT_RUN'::text as projection_source
    into v_rm
    from costing.product_rm_stores_workload_snapshot rm
    join costing.materials_stores_workload_policy p on p.id=rm.policy_id
    where rm.period_start=v_selected.period_start
      and rm.valuation_date=v_selected.valuation_date
      and rm.refresh_run_id=v_selected.refresh_run_id
      and rm.product_id=p_product_id;

    if not found then
      return jsonb_build_object(
        'summary_status','NO_TRACE_DATA',
        'period_start',v_selected.period_start,
        'valuation_date',v_selected.valuation_date,
        'refresh_run_id',v_selected.refresh_run_id,
        'product_id',p_product_id,
        'projection_source','PERSISTED_EXACT_RUN_UNAVAILABLE',
        'message','No persisted Materials / Stores Product RM evidence exists for the requested exact costing run and Product.'
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
    from (
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
      join costing.sku_materials_stores_workload_snapshot w on w.id=a.workload_snapshot_id
      join costing.product_rm_stores_workload_snapshot rm on rm.id=w.product_rm_workload_snapshot_id
      join costing.sku_pm_stores_workload_snapshot pm on pm.id=w.sku_pm_workload_snapshot_id
      join costing.materials_stores_workload_policy p on p.id=w.policy_id
      where a.period_start=v_selected.period_start
        and a.valuation_date=v_selected.valuation_date
        and a.refresh_run_id=v_selected.refresh_run_id
        and a.product_id=p_product_id
    ) s;

    return jsonb_build_object(
      'summary_status',coalesce(v_summary_status,v_rm.rm_evidence_status),
      'period_start',v_selected.period_start,
      'valuation_date',v_selected.valuation_date,
      'refresh_run_id',v_selected.refresh_run_id,
      'projection_source','PERSISTED_EXACT_RUN',
      'product_rm',to_jsonb(v_rm),
      'skus',v_skus
    );
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

drop function if exists public.rpc_get_sku_materials_stores_explain(date,bigint,bigint);

create function public.rpc_get_sku_materials_stores_explain(
  p_period_start date,
  p_product_id bigint,
  p_sku_id bigint,
  p_valuation_date date default null,
  p_refresh_run_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_sku record;
  v_selected record;
  v_explicit boolean := p_valuation_date is not null or p_refresh_run_id is not null;
begin
  perform public.require_permission('module:cost-sheet-review',false);

  if p_period_start is null or p_product_id is null or p_sku_id is null then
    raise exception 'period_start, product_id and sku_id are required';
  end if;

  if v_explicit then
    select * into v_selected
    from costing.fn_resolve_materials_stores_explain_selected_run(
      date_trunc('month',p_period_start)::date,p_valuation_date,p_refresh_run_id
    );

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
    into v_sku
    from costing.sku_materials_stores_allocation_snapshot a
    join costing.sku_materials_stores_workload_snapshot w on w.id=a.workload_snapshot_id
    join costing.product_rm_stores_workload_snapshot rm on rm.id=w.product_rm_workload_snapshot_id
    join costing.sku_pm_stores_workload_snapshot pm on pm.id=w.sku_pm_workload_snapshot_id
    join costing.materials_stores_workload_policy p on p.id=w.policy_id
    where a.period_start=v_selected.period_start
      and a.valuation_date=v_selected.valuation_date
      and a.refresh_run_id=v_selected.refresh_run_id
      and a.product_id=p_product_id
      and a.sku_id=p_sku_id;

    if not found then
      return jsonb_build_object(
        'summary_status','NO_TRACE_DATA',
        'period_start',v_selected.period_start,
        'valuation_date',v_selected.valuation_date,
        'refresh_run_id',v_selected.refresh_run_id,
        'product_id',p_product_id,
        'sku_id',p_sku_id,
        'projection_source','PERSISTED_EXACT_RUN_UNAVAILABLE',
        'message','No persisted Materials / Stores allocation evidence exists for the requested exact costing run and SKU.'
      );
    end if;

    return jsonb_build_object(
      'summary_status',v_sku.allocation_status,
      'period_start',v_selected.period_start,
      'valuation_date',v_selected.valuation_date,
      'refresh_run_id',v_selected.refresh_run_id,
      'projection_source','PERSISTED_EXACT_RUN',
      'sku',to_jsonb(v_sku),
      'calculation',jsonb_build_object(
        'rm_workload_formula','RM complexity × monthly SKU base quantity ÷ Product RM reference output quantity',
        'pm_workload_formula','PM complexity × monthly SKU units ÷ SKU pack-format reference output quantity',
        'unified_workload_formula','RM workload + PM workload',
        'monthly_allocation_formula','Frozen Stores pool × SKU workload share',
        'per_sku_absorption_formula','Monthly SKU Stores allocation ÷ governed monthly SKU units'
      )
    );
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

revoke all on function public.rpc_get_product_materials_stores_explain(date,bigint,date,bigint) from public, anon;
revoke all on function public.rpc_get_sku_materials_stores_explain(date,bigint,bigint,date,bigint) from public, anon;

grant execute on function public.rpc_get_product_materials_stores_explain(date,bigint,date,bigint) to authenticated, service_role;
grant execute on function public.rpc_get_sku_materials_stores_explain(date,bigint,bigint,date,bigint) to authenticated, service_role;
