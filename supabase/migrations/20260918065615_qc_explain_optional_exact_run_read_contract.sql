-- backfilled from live schema_migrations on 2026-10-24, CI-016

create or replace function costing.fn_resolve_qc_explain_selected_run(
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
    raise exception 'QC Explain exact-run identity requires both p_valuation_date and p_refresh_run_id';
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
    raise exception 'No governed successful costing refresh run matches the requested QC Explain exact-run identity';
  end if;
end;
$function$;

revoke all on function costing.fn_resolve_qc_explain_selected_run(date,date,bigint) from public;
revoke all on function costing.fn_resolve_qc_explain_selected_run(date,date,bigint) from anon, authenticated, service_role;

drop function if exists public.rpc_get_product_qc_explain(date,bigint);
create function public.rpc_get_product_qc_explain(
  p_period_start date,
  p_product_id bigint,
  p_valuation_date date default null,
  p_refresh_run_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','costing','lab','pg_temp'
as $function$
declare
  v_period date := date_trunc('month',p_period_start)::date;
  v_row record;
  v_methods jsonb;
  v_preview jsonb;
  v_selected record;
  v_explicit boolean := p_valuation_date is not null or p_refresh_run_id is not null;
begin
  perform public.require_permission('module:cost-sheet-review',false);
  if p_period_start is null or p_product_id is null then
    raise exception 'period_start and product_id are required';
  end if;

  if v_explicit then
    select * into v_selected
    from costing.fn_resolve_qc_explain_selected_run(v_period,p_valuation_date,p_refresh_run_id);

    select p.* into v_row
    from costing.product_qc_allocation_snapshot p
    where p.period_start=v_selected.period_start
      and p.valuation_date=v_selected.valuation_date
      and p.refresh_run_id=v_selected.refresh_run_id
      and p.product_id=p_product_id;

    if not found then
      return jsonb_build_object(
        'summary_status','NO_TRACE_DATA',
        'period_start',v_selected.period_start,
        'valuation_date',v_selected.valuation_date,
        'refresh_run_id',v_selected.refresh_run_id,
        'product_id',p_product_id,
        'projection_source','PERSISTED_EXACT_RUN_UNAVAILABLE',
        'message','No persisted QC allocation evidence exists for the requested exact costing run and Product.'
      );
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'method_id',d.method_id,'method_code',d.method_code,'method_name',d.method_name,
      'required_line_count',d.required_line_count,'method_base_units',d.method_base_units,
      'additional_parameter_units',d.additional_parameter_units,'method_workload_units',d.method_workload_units,
      'effective_test_evidence',d.effective_test_evidence
    ) order by d.method_name,d.method_id),'[]'::jsonb)
    into v_methods
    from costing.product_qc_method_workload_snapshot d
    where d.period_start=v_selected.period_start
      and d.valuation_date=v_selected.valuation_date
      and d.refresh_run_id=v_selected.refresh_run_id
      and d.product_id=p_product_id;

    return to_jsonb(v_row)
      || jsonb_build_object(
           'methods',v_methods,
           'summary_status',v_row.allocation_status,
           'projection_source','PERSISTED_EXACT_RUN'
         );
  end if;

  select * into v_row
  from costing.v_product_qc_allocation_current
  where period_start=v_period and product_id=p_product_id;

  if not found then
    return jsonb_build_object(
      'summary_status','NO_TRACE_DATA',
      'period_start',v_period,
      'product_id',p_product_id,
      'message','No current QC allocation context exists for the selected Product.'
    );
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
    where d.period_start=v_row.period_start
      and d.valuation_date=v_row.valuation_date
      and d.refresh_run_id=v_row.refresh_run_id
      and d.product_id=p_product_id;
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
      select nullif(line->>'method_id','')::bigint method_id,
             max(line->>'method_code') method_code,
             max(line->>'method_name') method_name,
             count(*)::integer line_count,
             jsonb_agg(jsonb_build_object(
               'seq_no',line->>'seq_no','test_id',line->>'test_id',
               'test_code',line->>'test_code','test_name',line->>'test_name',
               'source_type',line->>'source_type','source_override_id',line->>'source_override_id'
             ) order by nullif(line->>'seq_no','')::integer) evidence
      from jsonb_array_elements(coalesce(v_preview->'lines','[]'::jsonb)) line
      where coalesce((line->>'is_required')::boolean,false)
      group by nullif(line->>'method_id','')::bigint
    ) x;
  end if;

  return to_jsonb(v_row)||jsonb_build_object('methods',v_methods,'summary_status',v_row.allocation_status);
end;
$function$;

drop function if exists public.rpc_get_sku_qc_explain(date,bigint,bigint);
create function public.rpc_get_sku_qc_explain(
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
  v_period date := date_trunc('month',p_period_start)::date;
  v_sku record;
  v_product jsonb;
  v_selected record;
  v_explicit boolean := p_valuation_date is not null or p_refresh_run_id is not null;
begin
  perform public.require_permission('module:cost-sheet-review',false);
  if p_period_start is null or p_product_id is null or p_sku_id is null then
    raise exception 'period_start, product_id and sku_id are required';
  end if;

  if v_explicit then
    select * into v_selected
    from costing.fn_resolve_qc_explain_selected_run(v_period,p_valuation_date,p_refresh_run_id);

    select s.* into v_sku
    from costing.sku_qc_allocation_snapshot s
    where s.period_start=v_selected.period_start
      and s.valuation_date=v_selected.valuation_date
      and s.refresh_run_id=v_selected.refresh_run_id
      and s.product_id=p_product_id
      and s.sku_id=p_sku_id;

    if not found then
      return jsonb_build_object(
        'summary_status','NO_TRACE_DATA',
        'period_start',v_selected.period_start,
        'valuation_date',v_selected.valuation_date,
        'refresh_run_id',v_selected.refresh_run_id,
        'product_id',p_product_id,
        'sku_id',p_sku_id,
        'projection_source','PERSISTED_EXACT_RUN_UNAVAILABLE',
        'message','No persisted QC allocation evidence exists for the requested exact costing run and SKU.'
      );
    end if;

    v_product:=public.rpc_get_product_qc_explain(
      v_selected.period_start,p_product_id,v_selected.valuation_date,v_selected.refresh_run_id
    );

    return jsonb_build_object(
      'sku',to_jsonb(v_sku)||jsonb_build_object('projection_source','PERSISTED_EXACT_RUN'),
      'product',v_product,
      'summary_status',v_sku.allocation_status
    );
  end if;

  select * into v_sku
  from costing.v_sku_qc_allocation_current
  where period_start=v_period and product_id=p_product_id and sku_id=p_sku_id;

  if not found then
    return jsonb_build_object(
      'summary_status','NO_TRACE_DATA',
      'period_start',v_period,
      'product_id',p_product_id,
      'sku_id',p_sku_id,
      'message','No current QC allocation context exists for the selected SKU.'
    );
  end if;

  v_product:=public.rpc_get_product_qc_explain(v_period,p_product_id);

  return jsonb_build_object(
    'sku',to_jsonb(v_sku),
    'product',v_product,
    'summary_status',v_sku.allocation_status
  );
end;
$function$;

revoke all on function public.rpc_get_product_qc_explain(date,bigint,date,bigint) from public, anon;
revoke all on function public.rpc_get_sku_qc_explain(date,bigint,bigint,date,bigint) from public, anon;
grant execute on function public.rpc_get_product_qc_explain(date,bigint,date,bigint) to authenticated, service_role;
grant execute on function public.rpc_get_sku_qc_explain(date,bigint,bigint,date,bigint) to authenticated, service_role;
