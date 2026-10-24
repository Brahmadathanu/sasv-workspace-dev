-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Gate 11Y.10C.1 — Stage 03 route-foundation execution hardening
-- Performance-only refactor: preserve policy mathematics, statuses and snapshot lineage.

create or replace function costing.fn_effective_product_process_steps(
  p_product_id integer,
  p_as_of_date date default current_date
)
returns table(
  product_id integer,
  product_route_id bigint,
  family_route_id bigint,
  effective_step_key text,
  sequence_no numeric,
  activity_id integer,
  cost_centre_id bigint,
  section_id integer,
  subsection_id integer,
  area_id integer,
  plant_id integer,
  behaviour_code text,
  resource_class_code text,
  route_step_scope text,
  expected_occurrence_count numeric,
  standard_cycle_count numeric,
  is_mandatory boolean,
  allows_repeat boolean,
  allows_skip_with_approval boolean,
  production_overhead_scope text,
  direct_labour_scope text,
  source_type text,
  base_step_id bigint,
  override_id bigint
)
language plpgsql
stable
security definer
set search_path to 'costing','public'
as $function$
declare
  v_date date := coalesce(p_as_of_date,current_date);
  v_family_id bigint;
  v_family_route_id bigint;
  v_product_route_id bigint;
begin
  -- Resolve Product -> Route Family once.
  v_family_id := costing.fn_resolve_route_family_for_product(p_product_id,v_date);
  if v_family_id is null then
    return;
  end if;

  -- Resolve the effective approved family route directly from the resolved family.
  select r.id
  into v_family_route_id
  from costing.production_route_family_route r
  where r.route_family_id=v_family_id
    and r.status='APPROVED'
    and r.effective_from<=v_date
    and (r.effective_to is null or r.effective_to>=v_date)
  order by r.effective_from desc,r.route_version desc,r.id desc
  limit 1;

  if v_family_route_id is null then
    return;
  end if;

  -- Resolve Product route directly once.
  select r.id
  into v_product_route_id
  from costing.product_process_route r
  where r.product_id=p_product_id
    and r.status='APPROVED'
    and r.effective_from<=v_date
    and (r.effective_to is null or r.effective_to>=v_date)
  order by r.effective_from desc,r.route_version desc,r.id desc
  limit 1;

  if v_product_route_id is not null then
    return query
    select
      p_product_id,
      e.product_route_id,
      v_family_route_id,
      e.effective_step_key,
      e.sequence_no,
      e.activity_id,
      e.cost_centre_id,
      e.section_id,
      e.subsection_id,
      e.area_id,
      e.plant_id,
      e.behaviour_code,
      e.resource_class_code,
      e.route_step_scope,
      e.expected_occurrence_count,
      e.standard_cycle_count,
      e.is_mandatory,
      e.allows_repeat,
      e.allows_skip_with_approval,
      e.production_overhead_scope,
      e.direct_labour_scope,
      e.source_type,
      e.base_step_id,
      e.override_id
    from costing.fn_effective_product_process_route_steps(v_product_route_id) e
    order by e.sequence_no,e.effective_step_key;
  else
    return query
    select
      p_product_id,
      null::bigint,
      v_family_route_id,
      s.step_key,
      s.sequence_no,
      s.activity_id,
      s.cost_centre_id,
      s.section_id,
      s.subsection_id,
      s.area_id,
      s.plant_id,
      s.behaviour_code,
      s.resource_class_code,
      s.route_step_scope,
      s.expected_occurrence_count,
      s.standard_cycle_count,
      s.is_mandatory,
      s.allows_repeat,
      s.allows_skip_with_approval,
      s.production_overhead_scope,
      s.direct_labour_scope,
      'ROUTE_FAMILY_INHERITED'::text,
      s.id,
      null::bigint
    from costing.production_route_family_route_step s
    where s.family_route_id=v_family_route_id
    order by s.sequence_no,s.step_key;
  end if;
end;
$function$;

create or replace function costing.fn_validate_product_process_route(p_product_route_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'costing','public'
as $function$
declare
  v_route costing.product_process_route%rowtype;
  v_errors jsonb:='[]'::jsonb;
  v_family_id bigint;
  v_base_family_id bigint;
  v_batch_product_id integer;
  v_steps integer;
  v_rm integer;
  v_fg integer;
  v_prod integer;
  v_duplicate_sequence boolean := false;
begin
  select * into v_route from costing.product_process_route where id=p_product_route_id;
  if not found then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('PRODUCT_ROUTE_NOT_FOUND'));
  end if;

  v_family_id:=costing.fn_resolve_route_family_for_product(v_route.product_id,coalesce(v_route.effective_from,current_date));
  select route_family_id into v_base_family_id from costing.production_route_family_route where id=v_route.base_route_family_route_id;

  if v_family_id is null then
    v_errors:=v_errors||jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_ASSIGNMENT');
  elsif v_family_id<>v_base_family_id then
    v_errors:=v_errors||jsonb_build_array('ROUTE_FAMILY_ASSIGNMENT_MISMATCH');
  end if;

  if not exists(
    select 1 from costing.production_route_family_route
    where id=v_route.base_route_family_route_id and status='APPROVED'
  ) then
    v_errors:=v_errors||jsonb_build_array('BASE_ROUTE_FAMILY_ROUTE_NOT_APPROVED');
  end if;

  select product_id into v_batch_product_id
  from public.production_batch_size_ref
  where id=v_route.batch_size_ref_id;
  if v_batch_product_id is distinct from v_route.product_id then
    v_errors:=v_errors||jsonb_build_array('BATCH_REFERENCE_PRODUCT_MISMATCH');
  end if;

  if exists(
    select 1
    from costing.product_process_route_override o
    join costing.production_route_family_route_step s on s.id=o.base_step_id
    where o.product_route_id=p_product_route_id
      and s.family_route_id<>v_route.base_route_family_route_id
  ) then
    v_errors:=v_errors||jsonb_build_array('OVERRIDE_REFERENCES_FOREIGN_ROUTE_FAMILY_STEP');
  end if;

  -- Materialize the effective steps once and derive all validation statistics from that set.
  with es as materialized (
    select * from costing.fn_effective_product_process_route_steps(p_product_route_id)
  ), counts as (
    select
      count(*)::integer as steps,
      count(*) filter(where route_step_scope='BOUNDARY_RM_ISSUE')::integer as rm,
      count(*) filter(where route_step_scope='BOUNDARY_FG_TRANSFER')::integer as fg,
      count(*) filter(where route_step_scope='PRODUCTION_PROCESS')::integer as prod
    from es
  ), dup as (
    select exists(
      select 1 from es group by sequence_no having count(*)>1
    ) as has_dup
  )
  select counts.steps,counts.rm,counts.fg,counts.prod,dup.has_dup
  into v_steps,v_rm,v_fg,v_prod,v_duplicate_sequence
  from counts cross join dup;

  if v_steps=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS'); end if;
  if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY'); end if;
  if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY'); end if;
  if v_prod<1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP'); end if;
  if coalesce(v_duplicate_sequence,false) then
    v_errors:=v_errors||jsonb_build_array('DUPLICATE_EFFECTIVE_SEQUENCE');
  end if;
  if v_route.evidence_status not in ('MANUAL_COMPLETE','HISTORICAL_COMPLETE') then
    v_errors:=v_errors||jsonb_build_array('INCOMPLETE_ROUTE_EVIDENCE');
  end if;

  return jsonb_build_object(
    'valid',jsonb_array_length(v_errors)=0,
    'errors',v_errors,
    'step_count',v_steps,
    'rm_boundary_count',v_rm,
    'fg_boundary_count',v_fg,
    'production_step_count',v_prod,
    'resolved_route_family_id',v_family_id
  );
end;
$function$;

create or replace function costing.fn_validate_effective_product_process_route(
  p_product_id integer,
  p_as_of_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'costing','public'
as $function$
declare
  v_date date := coalesce(p_as_of_date,current_date);
  v_family_id bigint;
  v_family_route_id bigint;
  v_product_route_id bigint;
  v_steps integer;
  v_rm integer;
  v_fg integer;
  v_prod integer;
  v_errors jsonb := '[]'::jsonb;
begin
  v_family_id := costing.fn_resolve_route_family_for_product(p_product_id,v_date);
  if v_family_id is null then
    return jsonb_build_object(
      'valid',false,
      'errors',jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_MAPPING'),
      'route_source',null,
      'product_id',p_product_id
    );
  end if;

  -- Do not call fn_resolve_effective_route_family_route here: the family is already known.
  select r.id
  into v_family_route_id
  from costing.production_route_family_route r
  where r.route_family_id=v_family_id
    and r.status='APPROVED'
    and r.effective_from<=v_date
    and (r.effective_to is null or r.effective_to>=v_date)
  order by r.effective_from desc,r.route_version desc,r.id desc
  limit 1;

  if v_family_route_id is null then
    return jsonb_build_object(
      'valid',false,
      'errors',jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_ROUTE'),
      'route_source',null,
      'product_id',p_product_id,
      'route_family_id',v_family_id
    );
  end if;

  select r.id
  into v_product_route_id
  from costing.product_process_route r
  where r.product_id=p_product_id
    and r.status='APPROVED'
    and r.effective_from<=v_date
    and (r.effective_to is null or r.effective_to>=v_date)
  order by r.effective_from desc,r.route_version desc,r.id desc
  limit 1;

  if v_product_route_id is not null then
    return costing.fn_validate_product_process_route(v_product_route_id)
      || jsonb_build_object(
        'route_source','PRODUCT_ROUTE',
        'product_id',p_product_id,
        'route_family_id',v_family_id,
        'family_route_id',v_family_route_id,
        'product_route_id',v_product_route_id
      );
  end if;

  -- Inherited route: validate the already-resolved family-route steps directly.
  select
    count(*)::integer,
    count(*) filter(where route_step_scope='BOUNDARY_RM_ISSUE')::integer,
    count(*) filter(where route_step_scope='BOUNDARY_FG_TRANSFER')::integer,
    count(*) filter(where route_step_scope='PRODUCTION_PROCESS')::integer
  into v_steps,v_rm,v_fg,v_prod
  from costing.production_route_family_route_step
  where family_route_id=v_family_route_id;

  if v_steps=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS'); end if;
  if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY'); end if;
  if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY'); end if;
  if v_prod<1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP'); end if;

  return jsonb_build_object(
    'valid',jsonb_array_length(v_errors)=0,
    'errors',v_errors,
    'step_count',v_steps,
    'rm_boundary_count',v_rm,
    'fg_boundary_count',v_fg,
    'production_step_count',v_prod,
    'route_source','ROUTE_FAMILY_INHERITED',
    'product_id',p_product_id,
    'route_family_id',v_family_id,
    'family_route_id',v_family_route_id,
    'product_route_id',null
  );
end;
$function$;

create or replace function costing.fn_preview_shared_standard_batch_route_foundation(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint,
  p_route_family_id bigint default null::bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
    v_period_start date;
    v_run costing.costing_refresh_run%rowtype;
    v_result jsonb;
begin
    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;

    v_period_start := date_trunc('month', p_period_start)::date;

    select * into v_run
    from costing.costing_refresh_run r
    where r.id = p_refresh_run_id;

    if not found then
        raise exception 'Costing refresh run % not found', p_refresh_run_id;
    end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Shared standard batch-route preview context does not match refresh run %',p_refresh_run_id;
    end if;

    with recipients as materialized (
        select
            b.product_id,
            max(b.product_name) as product_name,
            max(b.product_base_uom) as product_base_uom,
            max(b.monthly_product_allocation_base_qty) as monthly_product_base_qty,
            max(b.monthly_driver_status) as monthly_driver_status,
            count(*)::integer as recipient_sku_count,
            count(*) filter(where b.assumption_id is null and b.default_policy_id is null)::integer as actual_source_sku_count,
            count(*) filter(where b.assumption_id is not null)::integer as assumption_source_sku_count,
            count(*) filter(where b.default_policy_id is not null)::integer as default_source_sku_count,
            jsonb_agg(
                jsonb_build_object(
                    'sku_id', b.sku_id,
                    'monthly_allocation_base_qty', b.monthly_allocation_base_qty,
                    'monthly_driver_method', b.monthly_driver_method,
                    'monthly_driver_source', b.monthly_driver_source,
                    'monthly_driver_source_month', b.monthly_driver_source_month,
                    'monthly_driver_status', b.monthly_driver_status,
                    'assumption_id', b.assumption_id,
                    'assumption_basis', b.assumption_basis,
                    'default_policy_id', b.default_policy_id,
                    'default_policy_scenario', b.default_policy_scenario
                ) order by b.sku_id
            ) as sku_quantity_evidence
        from costing.sku_sales_allocation_basis_snapshot b
        where b.period_start = v_period_start
          and b.valuation_date = p_valuation_date
          and b.refresh_run_id = p_refresh_run_id
        group by b.product_id
    ), batch_ref as materialized (
        select distinct on (b.product_id)
            b.product_id,b.id as batch_size_ref_id,b.preferred_batch_size,b.min_batch_size,b.max_batch_size,b.effective_from
        from public.production_batch_size_ref b
        where b.is_active=true and b.effective_from<=p_valuation_date
        order by b.product_id,b.effective_from desc,b.id desc
    ), route_validation as materialized (
        select r.product_id,
               costing.fn_validate_effective_product_process_route(r.product_id::integer,p_valuation_date) as route_validation
        from recipients r
    ), route_context as materialized (
        select
          rv.product_id,
          nullif(rv.route_validation->>'route_family_id','')::bigint as route_family_id,
          nullif(rv.route_validation->>'family_route_id','')::bigint as family_route_id,
          nullif(rv.route_validation->>'product_route_id','')::bigint as product_route_id,
          rv.route_validation
        from route_validation rv
    ), step_context as materialized (
        select
            r.product_id,
            count(e.effective_step_key)::integer as effective_step_count,
            count(e.effective_step_key) filter(where e.direct_labour_scope='INCLUDE')::integer as direct_labour_include_step_count,
            count(e.effective_step_key) filter(where e.direct_labour_scope='SUPERVISION')::integer as direct_labour_supervision_step_count,
            count(e.effective_step_key) filter(where e.direct_labour_scope='EXCLUDE_OTHER_POOL')::integer as direct_labour_excluded_step_count,
            count(e.effective_step_key) filter(where e.production_overhead_scope='INCLUDE')::integer as production_overhead_include_step_count,
            count(e.effective_step_key) filter(where e.production_overhead_scope='PASSIVE')::integer as production_overhead_passive_step_count,
            count(e.effective_step_key) filter(where e.production_overhead_scope='EXCLUDE_OTHER_POOL')::integer as production_overhead_excluded_step_count,
            jsonb_agg(
                jsonb_build_object(
                    'effective_step_key', e.effective_step_key,
                    'sequence_no', e.sequence_no,
                    'activity_id', e.activity_id,
                    'cost_centre_id', e.cost_centre_id,
                    'behaviour_code', e.behaviour_code,
                    'resource_class_code', e.resource_class_code,
                    'expected_occurrence_count', e.expected_occurrence_count,
                    'standard_cycle_count', e.standard_cycle_count,
                    'direct_labour_scope', e.direct_labour_scope,
                    'production_overhead_scope', e.production_overhead_scope,
                    'source_type', e.source_type,
                    'base_step_id', e.base_step_id,
                    'override_id', e.override_id
                ) order by e.sequence_no,e.effective_step_key
            ) filter(where e.effective_step_key is not null) as step_evidence
        from recipients r
        left join lateral costing.fn_effective_product_process_steps(r.product_id::integer,p_valuation_date) e on true
        group by r.product_id
    ), rows as (
        select
            r.product_id,r.product_name,r.product_base_uom,r.recipient_sku_count,r.monthly_product_base_qty,
            r.monthly_driver_status,r.actual_source_sku_count,r.assumption_source_sku_count,r.default_source_sku_count,
            r.sku_quantity_evidence,b.batch_size_ref_id,b.preferred_batch_size,b.min_batch_size,b.max_batch_size,
            b.effective_from as batch_size_effective_from,
            case when b.preferred_batch_size>0 and r.monthly_product_base_qty>0
                 then r.monthly_product_base_qty/b.preferred_batch_size end as raw_batch_requirement,
            case when b.preferred_batch_size>0 and r.monthly_product_base_qty>0
                 then ceil(r.monthly_product_base_qty/b.preferred_batch_size)::bigint end as standard_batch_count,
            rc.route_family_id,rc.family_route_id,rc.product_route_id,
            rc.route_validation->>'route_source' as effective_route_source,
            rc.route_validation,
            coalesce(s.effective_step_count,0) as effective_step_count,
            coalesce(s.direct_labour_include_step_count,0) as direct_labour_include_step_count,
            coalesce(s.direct_labour_supervision_step_count,0) as direct_labour_supervision_step_count,
            coalesce(s.direct_labour_excluded_step_count,0) as direct_labour_excluded_step_count,
            coalesce(s.production_overhead_include_step_count,0) as production_overhead_include_step_count,
            coalesce(s.production_overhead_passive_step_count,0) as production_overhead_passive_step_count,
            coalesce(s.production_overhead_excluded_step_count,0) as production_overhead_excluded_step_count,
            coalesce(s.step_evidence,'[]'::jsonb) as step_evidence,
            case
                when r.monthly_product_base_qty is null or r.monthly_product_base_qty<=0 then 'BLOCKED_NO_GOVERNED_MONTHLY_PRODUCT_QUANTITY'
                when r.monthly_driver_status='BLOCKED' then 'BLOCKED_MONTHLY_QUANTITY_DRIVER'
                when b.batch_size_ref_id is null or b.preferred_batch_size is null or b.preferred_batch_size<=0 then 'BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE'
                when coalesce((rc.route_validation->>'valid')::boolean,false)=false then 'BLOCKED_NO_VALID_EFFECTIVE_ROUTE'
                when coalesce(s.effective_step_count,0)=0 then 'BLOCKED_NO_EFFECTIVE_ROUTE_STEPS'
                when r.monthly_driver_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER'
                else 'READY'
            end as foundation_status,
            case
                when r.monthly_product_base_qty is null or r.monthly_product_base_qty<=0 then 'A positive governed monthly Product quantity is required. Existing SKUs normally use sales evidence; missing or new SKUs require an approved assumption.'
                when r.monthly_driver_status='BLOCKED' then 'The exact-run monthly quantity driver is blocked.'
                when b.batch_size_ref_id is null or b.preferred_batch_size is null or b.preferred_batch_size<=0 then 'An effective positive preferred batch size is mandatory.'
                when coalesce((rc.route_validation->>'valid')::boolean,false)=false then 'A valid effective Product manufacturing route is mandatory.'
                when coalesce(s.effective_step_count,0)=0 then 'The effective route contains no usable steps.'
                when r.monthly_driver_status='REVIEW_REQUIRED' then 'The foundation is calculable but its monthly quantity source requires review.'
                else 'Shared standard batch-and-route foundation is ready for separate Direct Labour and Production Overhead factor lenses.'
            end as foundation_note
        from recipients r
        left join batch_ref b on b.product_id=r.product_id
        left join route_context rc on rc.product_id=r.product_id
        left join step_context s on s.product_id=r.product_id
        where p_route_family_id is null or rc.route_family_id=p_route_family_id
    )
    select jsonb_build_object(
        'preview_only',true,
        'records_created',0,
        'monetary_allocation_created',false,
        'stage03_cutover_status','NOT_AUTHORISED_BY_THIS_GATE',
        'period_start',v_period_start,
        'valuation_date',p_valuation_date,
        'refresh_run_id',p_refresh_run_id,
        'route_family_id',p_route_family_id,
        'readiness_rule',jsonb_build_object(
            'existing_sku','Governed monthly quantity and effective preferred batch size are mandatory; sales is normal, approved assumption is allowed when sales is missing or unsuitable.',
            'new_sku_or_product','Approved manual quantity assumption, effective preferred batch size and effective route are mandatory.',
            'bmr_dependency',false,'forecast_dependency',false,'daily_work_log_dependency',false
        ),
        'summary',jsonb_build_object(
            'recipient_product_count',count(*),
            'ready_count',count(*) filter(where foundation_status='READY'),
            'review_required_count',count(*) filter(where foundation_status like 'REVIEW_REQUIRED%'),
            'blocked_count',count(*) filter(where foundation_status like 'BLOCKED%'),
            'products_using_actual_sales_only',count(*) filter(where actual_source_sku_count>0 and assumption_source_sku_count=0 and default_source_sku_count=0),
            'products_using_assumption',count(*) filter(where assumption_source_sku_count>0),
            'products_using_default_policy',count(*) filter(where default_source_sku_count>0),
            'total_standard_batch_count',sum(standard_batch_count) filter(where foundation_status in ('READY','REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER'))
        ),
        'status_counts',coalesce((select jsonb_object_agg(foundation_status,cnt) from (select foundation_status,count(*) cnt from rows group by foundation_status)x),'{}'::jsonb),
        'rows',coalesce(jsonb_agg(to_jsonb(rows) order by product_name,product_id),'[]'::jsonb)
    ) into v_result from rows;

    return v_result;
end;
$function$;

create or replace function costing.fn_preview_direct_labour_shadow_workload(
  p_policy_id bigint,
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint,
  p_route_family_id bigint default null::bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
    v_policy costing.direct_labour_workload_policy%rowtype;
    v_validation jsonb;
    v_foundation jsonb;
    v_result jsonb;
begin
    if p_policy_id is null or p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'policy_id, period_start, valuation_date and refresh_run_id are required';
    end if;
    select * into v_policy from costing.direct_labour_workload_policy where id=p_policy_id;
    if not found then raise exception 'Direct Labour workload policy % not found',p_policy_id; end if;
    v_validation:=costing.fn_validate_direct_labour_workload_policy(p_policy_id);
    if not coalesce((v_validation->>'valid')::boolean,false) then
        raise exception 'Direct Labour workload policy % is invalid: %',p_policy_id,v_validation->'errors';
    end if;

    v_foundation:=costing.fn_preview_shared_standard_batch_route_foundation(
        p_period_start,p_valuation_date,p_refresh_run_id,p_route_family_id
    );

    with foundation_rows as materialized (
        select *
        from jsonb_to_recordset(coalesce(v_foundation->'rows','[]'::jsonb)) as r(
            product_id bigint,product_name text,product_base_uom text,recipient_sku_count integer,
            monthly_product_base_qty numeric,monthly_driver_status text,actual_source_sku_count integer,
            assumption_source_sku_count integer,default_source_sku_count integer,sku_quantity_evidence jsonb,
            batch_size_ref_id bigint,preferred_batch_size numeric,min_batch_size numeric,max_batch_size numeric,
            raw_batch_requirement numeric,standard_batch_count bigint,route_family_id bigint,family_route_id bigint,
            product_route_id bigint,effective_route_source text,route_validation jsonb,effective_step_count integer,
            foundation_status text,foundation_note text,step_evidence jsonb
        )
    ), step_rows as (
        select f.product_id,
               count(*)::integer as effective_step_count,
               count(*) filter(where s.direct_labour_scope='INCLUDE')::integer as include_step_count,
               count(*) filter(where s.direct_labour_scope='SUPERVISION')::integer as supervision_step_count,
               count(*) filter(where s.direct_labour_scope='EXCLUDE_OTHER_POOL')::integer as excluded_step_count,
               sum(sf.factor*bf.factor*s.expected_occurrence_count*s.standard_cycle_count) as direct_labour_route_intensity,
               jsonb_agg(jsonb_build_object(
                   'effective_step_key',s.effective_step_key,
                   'sequence_no',s.sequence_no,
                   'activity_id',s.activity_id,
                   'cost_centre_id',s.cost_centre_id,
                   'direct_labour_scope',s.direct_labour_scope,
                   'scope_factor',sf.factor,
                   'behaviour_code',s.behaviour_code,
                   'attendance_factor',bf.factor,
                   'expected_occurrence_count',s.expected_occurrence_count,
                   'standard_cycle_count',s.standard_cycle_count,
                   'step_labour_factor',sf.factor*bf.factor*s.expected_occurrence_count*s.standard_cycle_count,
                   'resource_class_code',s.resource_class_code,
                   'resource_factor_applied',false,
                   'source_type',s.source_type,
                   'base_step_id',s.base_step_id,
                   'override_id',s.override_id
               ) order by s.sequence_no,s.effective_step_key) as labour_step_evidence
        from foundation_rows f
        cross join lateral jsonb_to_recordset(
          case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end
        ) as s(
          effective_step_key text,sequence_no numeric,activity_id integer,cost_centre_id bigint,
          behaviour_code text,resource_class_code text,expected_occurrence_count numeric,
          standard_cycle_count numeric,direct_labour_scope text,production_overhead_scope text,
          source_type text,base_step_id bigint,override_id bigint
        )
        join costing.direct_labour_scope_factor sf on sf.policy_id=p_policy_id and sf.scope_code=s.direct_labour_scope
        join costing.direct_labour_behaviour_factor bf on bf.policy_id=p_policy_id and bf.behaviour_code=s.behaviour_code
        group by f.product_id
    ), rows as (
        select f.*,
               coalesce(s.include_step_count,0) as include_step_count,
               coalesce(s.supervision_step_count,0) as supervision_step_count,
               coalesce(s.excluded_step_count,0) as excluded_step_count,
               s.direct_labour_route_intensity,
               coalesce(s.labour_step_evidence,'[]'::jsonb) as labour_step_evidence,
               case when f.standard_batch_count is not null and s.direct_labour_route_intensity is not null
                    then f.standard_batch_count*s.direct_labour_route_intensity end as direct_labour_workload_units,
               case
                 when f.foundation_status like 'BLOCKED%' then f.foundation_status
                 when s.direct_labour_route_intensity is null or s.direct_labour_route_intensity<=0 then 'BLOCKED_NO_POSITIVE_DIRECT_LABOUR_ROUTE_INTENSITY'
                 when f.foundation_status like 'REVIEW_REQUIRED%' then 'REVIEW_REQUIRED_FOUNDATION'
                 else 'READY'
               end as workload_status,
               case
                 when f.foundation_status like 'BLOCKED%' then f.foundation_note
                 when s.direct_labour_route_intensity is null or s.direct_labour_route_intensity<=0 then 'The effective route has no positive Direct Labour intensity under this policy.'
                 when f.foundation_status like 'REVIEW_REQUIRED%' then 'Direct Labour workload is calculable but the shared quantity foundation requires review.'
                 else 'Direct Labour shadow workload is ready for review; no monetary allocation is authorised.'
               end as workload_note
        from foundation_rows f left join step_rows s on s.product_id=f.product_id
    )
    select jsonb_build_object(
        'preview_only',true,'records_created',0,'monetary_allocation_created',false,'pool_consumed',false,
        'stage03_cutover_status','NOT_AUTHORISED_BY_THIS_GATE','policy',to_jsonb(v_policy),'policy_validation',v_validation,
        'formula','STANDARD_BATCH_COUNT × SUM(DL_SCOPE_FACTOR × ATTENDANCE_FACTOR × EXPECTED_OCCURRENCES × STANDARD_CYCLES)',
        'resource_factor_used',false,'crew_factor_used',false,'foundation_summary',v_foundation->'summary',
        'summary',jsonb_build_object(
            'product_count',count(*),'ready_count',count(*) filter(where workload_status='READY'),
            'review_required_count',count(*) filter(where workload_status like 'REVIEW_REQUIRED%'),
            'blocked_count',count(*) filter(where workload_status like 'BLOCKED%'),
            'company_ready_workload_units',sum(direct_labour_workload_units) filter(where workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION')),
            'total_standard_batch_count',sum(standard_batch_count) filter(where workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION'))
        ),
        'status_counts',coalesce((select jsonb_object_agg(workload_status,cnt) from (select workload_status,count(*) cnt from rows group by workload_status)x),'{}'::jsonb),
        'rows',coalesce(jsonb_agg(to_jsonb(rows) order by product_name,product_id),'[]'::jsonb)
    ) into v_result from rows;
    return v_result;
end;
$function$;

-- Supporting exact-context indexes for the now-hot prospective Stage 03 path.
create index if not exists idx_sales_allocation_basis_run_product
  on costing.sku_sales_allocation_basis_snapshot(refresh_run_id,product_id);

create index if not exists idx_route_family_product_map_effective_lookup
  on costing.production_route_family_product_map(product_id,status,effective_from desc,id desc);

create index if not exists idx_route_family_group_map_effective_lookup
  on costing.production_route_family_product_group_map(product_group_id,status,effective_from desc,id desc);

create index if not exists idx_route_family_route_effective_lookup
  on costing.production_route_family_route(route_family_id,status,effective_from desc,route_version desc,id desc);

create index if not exists idx_product_process_route_effective_lookup
  on costing.product_process_route(product_id,status,effective_from desc,route_version desc,id desc);
