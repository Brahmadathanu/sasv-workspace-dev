-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_validate_effective_product_process_route(p_product_id integer, p_as_of_date date default current_date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_date date:=coalesce(p_as_of_date,current_date);
  v_family_id bigint;
  v_family_route_id bigint;
  v_product_route_id bigint;
  v_validation jsonb;
begin
  v_family_id:=costing.fn_resolve_route_family_for_product(p_product_id,v_date);
  if v_family_id is null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_MAPPING'),'route_source',null,'product_id',p_product_id);
  end if;

  v_family_route_id:=costing.fn_resolve_effective_route_family_route(p_product_id,v_date);
  if v_family_route_id is null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_ROUTE'),'route_source',null,'product_id',p_product_id,'route_family_id',v_family_id);
  end if;

  v_product_route_id:=costing.fn_resolve_effective_product_process_route(p_product_id,v_date);
  if v_product_route_id is not null then
    return costing.fn_validate_product_process_route(v_product_route_id)
      || jsonb_build_object('route_source','PRODUCT_ROUTE','product_id',p_product_id,'route_family_id',v_family_id,
                            'family_route_id',v_family_route_id,'product_route_id',v_product_route_id);
  end if;

  v_validation:=costing.fn_validate_route_family_route(v_family_route_id);
  return v_validation || jsonb_build_object(
    'route_source','ROUTE_FAMILY_INHERITED',
    'product_id',p_product_id,
    'route_family_id',v_family_id,
    'family_route_id',v_family_route_id,
    'product_route_id',null
  );
end
$function$;

create or replace function costing.fn_validate_product_process_route(p_product_route_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_route costing.product_process_route%rowtype;
  v_errors jsonb:='[]'::jsonb;
  v_family_id bigint;
  v_base_family_id bigint;
  v_release_only boolean:=false;
  v_batch_product_id integer;
  v_steps integer;
  v_rm integer;
  v_fg integer;
  v_prod integer;
  v_qc integer;
  v_duplicate_sequence boolean:=false;
begin
  select * into v_route from costing.product_process_route where id=p_product_route_id;
  if not found then return jsonb_build_object('valid',false,'errors',jsonb_build_array('PRODUCT_ROUTE_NOT_FOUND')); end if;
  if v_route.archived_at is not null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('ARCHIVED_PRODUCT_ROUTE'),'product_route_id',p_product_route_id);
  end if;

  v_family_id:=costing.fn_resolve_route_family_for_product(v_route.product_id,coalesce(v_route.effective_from,current_date));
  select r.route_family_id,coalesce(f.allows_release_only_route,false)
    into v_base_family_id,v_release_only
  from costing.production_route_family_route r
  join costing.production_route_family f on f.id=r.route_family_id
  where r.id=v_route.base_route_family_route_id and r.archived_at is null and f.archived_at is null;

  if v_base_family_id is null then v_errors:=v_errors||jsonb_build_array('BASE_ROUTE_FAMILY_ROUTE_ARCHIVED_OR_MISSING'); end if;
  if v_family_id is null then v_errors:=v_errors||jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_ASSIGNMENT');
  elsif v_family_id<>v_base_family_id then v_errors:=v_errors||jsonb_build_array('ROUTE_FAMILY_ASSIGNMENT_MISMATCH'); end if;

  if not exists(
    select 1 from costing.production_route_family_route r
    join costing.production_route_family f on f.id=r.route_family_id
    where r.id=v_route.base_route_family_route_id and r.archived_at is null and f.archived_at is null and r.status='APPROVED'
  ) then v_errors:=v_errors||jsonb_build_array('BASE_ROUTE_FAMILY_ROUTE_NOT_APPROVED'); end if;

  select product_id into v_batch_product_id from public.production_batch_size_ref where id=v_route.batch_size_ref_id;
  if v_batch_product_id is distinct from v_route.product_id then v_errors:=v_errors||jsonb_build_array('BATCH_REFERENCE_PRODUCT_MISMATCH'); end if;

  if exists(
    select 1 from costing.product_process_route_override o
    join costing.production_route_family_route_step s on s.id=o.base_step_id
    where o.product_route_id=p_product_route_id and s.family_route_id<>v_route.base_route_family_route_id
  ) then v_errors:=v_errors||jsonb_build_array('OVERRIDE_REFERENCES_FOREIGN_ROUTE_FAMILY_STEP'); end if;

  with es as materialized (select * from costing.fn_effective_product_process_route_steps(p_product_route_id)),
  counts as (
    select count(*)::integer steps,
           count(*) filter(where route_step_scope='BOUNDARY_RM_ISSUE')::integer rm,
           count(*) filter(where route_step_scope='BOUNDARY_FG_TRANSFER')::integer fg,
           count(*) filter(where route_step_scope='PRODUCTION_PROCESS')::integer prod,
           count(*) filter(where route_step_scope='QC_OTHER_POOL')::integer qc
    from es
  ), dup as (select exists(select 1 from es group by sequence_no having count(*)>1) has_dup)
  select counts.steps,counts.rm,counts.fg,counts.prod,counts.qc,dup.has_dup
    into v_steps,v_rm,v_fg,v_prod,v_qc,v_duplicate_sequence
  from counts cross join dup;

  if v_steps=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS'); end if;
  if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY'); end if;
  if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY'); end if;
  if v_release_only then
    if v_prod<>0 then v_errors:=v_errors||jsonb_build_array('RELEASE_ONLY_ROUTE_MUST_NOT_HAVE_PRODUCTION_PROCESS_STEP'); end if;
    if v_qc<>1 then v_errors:=v_errors||jsonb_build_array('RELEASE_ONLY_ROUTE_REQUIRES_EXACTLY_ONE_QC_STEP'); end if;
    if v_steps<>3 then v_errors:=v_errors||jsonb_build_array('RELEASE_ONLY_ROUTE_REQUIRES_EXACTLY_THREE_STEPS'); end if;
  elsif v_prod<1 then
    v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP');
  end if;
  if coalesce(v_duplicate_sequence,false) then v_errors:=v_errors||jsonb_build_array('DUPLICATE_EFFECTIVE_SEQUENCE'); end if;
  if v_route.evidence_status not in ('MANUAL_COMPLETE','HISTORICAL_COMPLETE') then v_errors:=v_errors||jsonb_build_array('INCOMPLETE_ROUTE_EVIDENCE'); end if;

  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'step_count',v_steps,
    'rm_boundary_count',v_rm,'fg_boundary_count',v_fg,'production_step_count',v_prod,'qc_step_count',v_qc,
    'allows_release_only_route',v_release_only,'resolved_route_family_id',v_family_id);
end
$function$;