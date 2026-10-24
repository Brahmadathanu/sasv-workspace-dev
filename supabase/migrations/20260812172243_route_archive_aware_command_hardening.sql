-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Gate 11Y.10I.2C.3F.1B.2B.2
-- Archived route architecture is immutable through operational command RPCs.

create or replace function public.rpc_create_route_family_route_draft(
  p_route_family_id bigint,
  p_route_name text,
  p_effective_from date default null,
  p_source_type text default 'MANUAL',
  p_evidence_status text default 'MANUAL_COMPLETE',
  p_route_note text default null,
  p_supersedes_route_id bigint default null
) returns jsonb
language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_version integer; v_code text; v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  if nullif(btrim(p_route_name),'') is null then raise exception 'Route name is required'; end if;
  if not exists(select 1 from costing.production_route_family f where f.id=p_route_family_id and f.archived_at is null) then
    raise exception 'Active Route Family % not found',p_route_family_id;
  end if;
  if exists(select 1 from costing.production_route_family_route r where r.route_family_id=p_route_family_id and r.archived_at is null and r.status in ('DRAFT','REVIEW_REQUIRED')) then
    raise exception 'Route Family already has a writable route candidate';
  end if;
  if p_supersedes_route_id is not null and not exists(
    select 1 from costing.production_route_family_route r
    where r.id=p_supersedes_route_id and r.route_family_id=p_route_family_id and r.archived_at is null and r.status='APPROVED'
  ) then raise exception 'supersedes_route_id must identify an active approved route of the same Route Family'; end if;
  select coalesce(max(route_version),0)+1 into v_version from costing.production_route_family_route where route_family_id=p_route_family_id;
  select family_code||'_ROUTE' into v_code from costing.production_route_family where id=p_route_family_id and archived_at is null;
  insert into costing.production_route_family_route(route_family_id,route_code,route_version,route_name,effective_from,source_type,evidence_status,route_note,supersedes_route_id,created_by)
  values(p_route_family_id,v_code,v_version,btrim(p_route_name),p_effective_from,upper(p_source_type),upper(p_evidence_status),nullif(btrim(p_route_note),''),p_supersedes_route_id,auth.uid())
  returning id into v_id;
  return jsonb_build_object('family_route_id',v_id,'route_version',v_version,'status','DRAFT');
end
$function$;

create or replace function public.rpc_clone_route_family_route_draft(
  p_source_family_route_id bigint,
  p_effective_from date,
  p_route_name text default null,
  p_route_note text default null
) returns jsonb
language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_source costing.production_route_family_route%rowtype; v_id bigint; v_version integer;
begin
  perform public.require_permission('module:production-route-manager',true);
  select r.* into v_source
  from costing.production_route_family_route r
  join costing.production_route_family f on f.id=r.route_family_id
  where r.id=p_source_family_route_id and r.archived_at is null and f.archived_at is null
    and r.status in ('APPROVED','SUPERSEDED','INACTIVE');
  if not found then raise exception 'Source Route Family route must be an active non-archived historical version'; end if;
  if exists(select 1 from costing.production_route_family_route r where r.route_family_id=v_source.route_family_id and r.archived_at is null and r.status in ('DRAFT','REVIEW_REQUIRED')) then
    raise exception 'Route Family already has a writable route candidate';
  end if;
  if p_effective_from is null then raise exception 'effective_from is required'; end if;
  select coalesce(max(route_version),0)+1 into v_version from costing.production_route_family_route where route_family_id=v_source.route_family_id;
  insert into costing.production_route_family_route(route_family_id,route_code,route_version,route_name,effective_from,source_type,evidence_status,route_note,supersedes_route_id,created_by)
  values(v_source.route_family_id,v_source.route_code,v_version,coalesce(nullif(btrim(p_route_name),''),v_source.route_name),p_effective_from,
         'COPIED_VERSION',v_source.evidence_status,coalesce(nullif(btrim(p_route_note),''),'Copied from Route Family route '||p_source_family_route_id),
         p_source_family_route_id,auth.uid()) returning id into v_id;
  insert into costing.production_route_family_route_step(family_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,
    behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,
    production_overhead_scope,direct_labour_scope,step_note,created_by)
  select v_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,behaviour_code,resource_class_code,route_step_scope,
    expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,step_note,auth.uid()
  from costing.production_route_family_route_step where family_route_id=p_source_family_route_id order by sequence_no,id;
  return jsonb_build_object('family_route_id',v_id,'route_family_id',v_source.route_family_id,'route_version',v_version,'status','DRAFT','validation',costing.fn_validate_route_family_route(v_id));
end
$function$;

create or replace function public.rpc_submit_route_family_route_for_review(p_family_route_id bigint)
returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  if not exists(select 1 from costing.production_route_family_route where id=p_family_route_id and archived_at is null and status='DRAFT') then
    raise exception 'Route Family route is not an active editable draft';
  end if;
  if not coalesce((costing.fn_validate_route_family_route(p_family_route_id)->>'valid')::boolean,false) then raise exception 'Route Family route validation failed'; end if;
  update costing.production_route_family_route set status='REVIEW_REQUIRED',updated_at=now()
  where id=p_family_route_id and archived_at is null and status='DRAFT';
  return jsonb_build_object('family_route_id',p_family_route_id,'status','REVIEW_REQUIRED');
end
$function$;

create or replace function public.rpc_upsert_route_family_route_step(
  p_family_route_id bigint,p_step_id bigint default null,p_step jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_status text; v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  select status into v_status from costing.production_route_family_route
  where id=p_family_route_id and archived_at is null for update;
  if v_status not in ('DRAFT','REVIEW_REQUIRED') then raise exception 'Route Family route is missing, archived, or read-only'; end if;
  if p_step_id is null then
    insert into costing.production_route_family_route_step(family_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,
      behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,
      production_overhead_scope,direct_labour_scope,step_note,created_by)
    values(p_family_route_id,p_step->>'step_key',(p_step->>'sequence_no')::numeric,(p_step->>'activity_id')::integer,(p_step->>'cost_centre_id')::bigint,
      (p_step->>'section_id')::integer,(p_step->>'subsection_id')::integer,(p_step->>'area_id')::integer,nullif(p_step->>'plant_id','')::integer,
      p_step->>'behaviour_code',p_step->>'resource_class_code',p_step->>'route_step_scope',coalesce((p_step->>'expected_occurrence_count')::numeric,1),
      coalesce((p_step->>'standard_cycle_count')::numeric,1),coalesce((p_step->>'is_mandatory')::boolean,true),coalesce((p_step->>'allows_repeat')::boolean,false),
      coalesce((p_step->>'allows_skip_with_approval')::boolean,false),coalesce(p_step->>'production_overhead_scope','INCLUDE'),
      coalesce(p_step->>'direct_labour_scope','INCLUDE'),nullif(p_step->>'step_note',''),auth.uid()) returning id into v_id;
  else
    update costing.production_route_family_route_step s set
      step_key=coalesce(p_step->>'step_key',s.step_key),sequence_no=coalesce((p_step->>'sequence_no')::numeric,s.sequence_no),
      activity_id=coalesce((p_step->>'activity_id')::integer,s.activity_id),cost_centre_id=coalesce((p_step->>'cost_centre_id')::bigint,s.cost_centre_id),
      section_id=coalesce((p_step->>'section_id')::integer,s.section_id),subsection_id=coalesce((p_step->>'subsection_id')::integer,s.subsection_id),
      area_id=coalesce((p_step->>'area_id')::integer,s.area_id),plant_id=case when p_step ? 'plant_id' then nullif(p_step->>'plant_id','')::integer else s.plant_id end,
      behaviour_code=coalesce(p_step->>'behaviour_code',s.behaviour_code),resource_class_code=coalesce(p_step->>'resource_class_code',s.resource_class_code),
      route_step_scope=coalesce(p_step->>'route_step_scope',s.route_step_scope),expected_occurrence_count=coalesce((p_step->>'expected_occurrence_count')::numeric,s.expected_occurrence_count),
      standard_cycle_count=coalesce((p_step->>'standard_cycle_count')::numeric,s.standard_cycle_count),is_mandatory=coalesce((p_step->>'is_mandatory')::boolean,s.is_mandatory),
      allows_repeat=coalesce((p_step->>'allows_repeat')::boolean,s.allows_repeat),allows_skip_with_approval=coalesce((p_step->>'allows_skip_with_approval')::boolean,s.allows_skip_with_approval),
      production_overhead_scope=coalesce(p_step->>'production_overhead_scope',s.production_overhead_scope),direct_labour_scope=coalesce(p_step->>'direct_labour_scope',s.direct_labour_scope),
      step_note=case when p_step ? 'step_note' then nullif(p_step->>'step_note','') else s.step_note end,updated_at=now()
    where s.id=p_step_id and s.family_route_id=p_family_route_id returning id into v_id;
  end if;
  if v_id is null then raise exception 'Route Family step not found'; end if;
  if v_status='REVIEW_REQUIRED' then update costing.production_route_family_route set status='DRAFT',updated_at=now() where id=p_family_route_id and archived_at is null; end if;
  return jsonb_build_object('step_id',v_id,'family_route_id',p_family_route_id,'route_status',case when v_status='REVIEW_REQUIRED' then 'DRAFT' else v_status end,
    'validation',costing.fn_validate_route_family_route(p_family_route_id));
end
$function$;

create or replace function public.rpc_delete_route_family_route_step(p_family_route_id bigint,p_step_id bigint)
returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_status text; v_deleted boolean;
begin
  perform public.require_permission('module:production-route-manager',true);
  select status into v_status from costing.production_route_family_route where id=p_family_route_id and archived_at is null for update;
  if v_status not in ('DRAFT','REVIEW_REQUIRED') then raise exception 'Route Family route is missing, archived, or read-only'; end if;
  delete from costing.production_route_family_route_step where id=p_step_id and family_route_id=p_family_route_id; v_deleted:=found;
  if v_deleted and v_status='REVIEW_REQUIRED' then update costing.production_route_family_route set status='DRAFT',updated_at=now() where id=p_family_route_id and archived_at is null; end if;
  return jsonb_build_object('deleted',v_deleted,'family_route_id',p_family_route_id,'route_status',case when v_deleted and v_status='REVIEW_REQUIRED' then 'DRAFT' else v_status end,
    'validation',costing.fn_validate_route_family_route(p_family_route_id));
end
$function$;

create or replace function public.rpc_create_product_route_draft(
  p_product_id integer,p_base_route_family_route_id bigint,p_batch_size_ref_id bigint,p_effective_from date default null,
  p_source_type text default 'ROUTE_FAMILY_ONLY',p_evidence_status text default 'MANUAL_COMPLETE',p_route_note text default null,p_supersedes_route_id bigint default null
) returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_version integer; v_id bigint; v_family_id bigint; v_base_family_id bigint; v_batch_product integer;
begin
  perform public.require_permission('module:production-route-manager',true);
  if exists(select 1 from costing.product_process_route where product_id=p_product_id and archived_at is null and status in ('DRAFT','REVIEW_REQUIRED')) then
    raise exception 'Product already has a writable Product route candidate';
  end if;
  v_family_id:=costing.fn_resolve_route_family_for_product(p_product_id,coalesce(p_effective_from,current_date));
  select r.route_family_id into v_base_family_id
  from costing.production_route_family_route r join costing.production_route_family f on f.id=r.route_family_id
  where r.id=p_base_route_family_route_id and r.archived_at is null and f.archived_at is null and r.status='APPROVED';
  if v_family_id is null then raise exception 'Product has no approved Route Family mapping'; end if;
  if v_base_family_id is null or v_base_family_id<>v_family_id then raise exception 'Base Route Family route does not match the Product mapping'; end if;
  if p_supersedes_route_id is not null and not exists(
    select 1 from costing.product_process_route r where r.id=p_supersedes_route_id and r.product_id=p_product_id and r.archived_at is null and r.status='APPROVED'
  ) then raise exception 'supersedes_route_id must identify an active approved Product route for the same Product'; end if;
  select product_id into v_batch_product from public.production_batch_size_ref where id=p_batch_size_ref_id and is_active;
  if v_batch_product is distinct from p_product_id then raise exception 'Batch-size reference does not belong to Product'; end if;
  select coalesce(max(route_version),0)+1 into v_version from costing.product_process_route where product_id=p_product_id;
  insert into costing.product_process_route(product_id,base_route_family_route_id,route_version,route_code,effective_from,batch_size_ref_id,source_type,evidence_status,route_note,supersedes_route_id,created_by)
  values(p_product_id,p_base_route_family_route_id,v_version,'PRODUCT_'||p_product_id||'_ROUTE',p_effective_from,p_batch_size_ref_id,upper(p_source_type),upper(p_evidence_status),nullif(btrim(p_route_note),''),p_supersedes_route_id,auth.uid()) returning id into v_id;
  return jsonb_build_object('product_route_id',v_id,'route_version',v_version,'status','DRAFT');
end
$function$;

create or replace function public.rpc_update_product_route_draft(p_product_route_id bigint,p_patch jsonb)
returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  update costing.product_process_route r set
    effective_from=case when p_patch ? 'effective_from' then nullif(p_patch->>'effective_from','')::date else r.effective_from end,
    source_type=coalesce(nullif(upper(p_patch->>'source_type'),''),r.source_type),
    evidence_status=coalesce(nullif(upper(p_patch->>'evidence_status'),''),r.evidence_status),
    route_note=case when p_patch ? 'route_note' then nullif(p_patch->>'route_note','') else r.route_note end,
    batch_size_ref_id=coalesce((p_patch->>'batch_size_ref_id')::bigint,r.batch_size_ref_id),updated_at=now()
  where r.id=p_product_route_id and r.archived_at is null and r.status in ('DRAFT','REVIEW_REQUIRED');
  if not found then raise exception 'Product route is missing, archived, or not editable'; end if;
  return jsonb_build_object('product_route_id',p_product_route_id,'updated',true);
end
$function$;

create or replace function public.rpc_submit_product_route_for_review(p_product_route_id bigint)
returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  if not exists(select 1 from costing.product_process_route where id=p_product_route_id and archived_at is null and status='DRAFT') then
    raise exception 'Product route is missing, archived, or not a draft';
  end if;
  if not coalesce((costing.fn_validate_product_process_route(p_product_route_id)->>'valid')::boolean,false) then raise exception 'Product route validation failed'; end if;
  update costing.product_process_route set status='REVIEW_REQUIRED',updated_at=now() where id=p_product_route_id and archived_at is null and status='DRAFT';
  return jsonb_build_object('product_route_id',p_product_route_id,'status','REVIEW_REQUIRED');
end
$function$;

create or replace function public.rpc_upsert_product_route_override(
  p_product_route_id bigint,p_override_id bigint default null,p_override jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare r costing.product_process_route%rowtype; v_id bigint; v_op text; v_base_step_id bigint; v_override_reason text; v_base_allows_skip boolean; v_base_family_route_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  select * into r from costing.product_process_route where id=p_product_route_id and archived_at is null for update;
  if not found then raise exception 'Product route % not found or archived',p_product_route_id; end if;
  if r.status not in('DRAFT','REVIEW_REQUIRED','REJECTED') then raise exception 'Route status % is not editable',r.status; end if;
  if not exists(select 1 from costing.production_route_family_route fr join costing.production_route_family f on f.id=fr.route_family_id
                where fr.id=r.base_route_family_route_id and fr.archived_at is null and f.archived_at is null) then
    raise exception 'Base Route Family route is archived';
  end if;
  v_op:=upper(nullif(btrim(p_override->>'operation_type'),'')); v_override_reason:=nullif(btrim(p_override->>'override_reason'),'');
  if p_override_id is null then v_base_step_id:=nullif(p_override->>'base_step_id','')::bigint;
  else
    select coalesce(nullif(p_override->>'base_step_id','')::bigint,o.base_step_id),coalesce(v_op,o.operation_type),coalesce(v_override_reason,o.override_reason)
    into v_base_step_id,v_op,v_override_reason from costing.product_process_route_override o
    where o.id=p_override_id and o.product_route_id=p_product_route_id;
    if not found then raise exception 'Override % not found',p_override_id; end if;
  end if;
  if v_op='BYPASS_STEP' then
    if v_base_step_id is null then raise exception 'BYPASS_STEP requires a base step'; end if;
    if v_override_reason is null then raise exception 'BYPASS_STEP requires a meaningful Product-specific reason'; end if;
    select s.allows_skip_with_approval,s.family_route_id into v_base_allows_skip,v_base_family_route_id from costing.production_route_family_route_step s where s.id=v_base_step_id;
    if v_base_family_route_id is null then raise exception 'Base Route Family step % not found',v_base_step_id; end if;
    if v_base_family_route_id<>r.base_route_family_route_id then raise exception 'Bypass step does not belong to the Product route base family route'; end if;
    if not coalesce(v_base_allows_skip,false) then raise exception 'Base Route Family step % does not permit approved bypass',v_base_step_id; end if;
  end if;
  if p_override_id is null then
    insert into costing.product_process_route_override(product_route_id,operation_type,base_step_id,override_step_key,sequence_no,activity_id,cost_centre_id,
      section_id,subsection_id,area_id,plant_id,behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,
      allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,override_reason,created_by)
    values(p_product_route_id,v_op,v_base_step_id,nullif(btrim(p_override->>'override_step_key'),''),nullif(p_override->>'sequence_no','')::numeric,
      nullif(p_override->>'activity_id','')::integer,nullif(p_override->>'cost_centre_id','')::bigint,nullif(p_override->>'section_id','')::integer,
      nullif(p_override->>'subsection_id','')::integer,nullif(p_override->>'area_id','')::integer,nullif(p_override->>'plant_id','')::integer,
      nullif(p_override->>'behaviour_code',''),nullif(p_override->>'resource_class_code',''),nullif(p_override->>'route_step_scope',''),
      nullif(p_override->>'expected_occurrence_count','')::numeric,nullif(p_override->>'standard_cycle_count','')::numeric,
      case when p_override ? 'is_mandatory' then (p_override->>'is_mandatory')::boolean end,case when p_override ? 'allows_repeat' then (p_override->>'allows_repeat')::boolean end,
      case when p_override ? 'allows_skip_with_approval' then (p_override->>'allows_skip_with_approval')::boolean end,
      nullif(p_override->>'production_overhead_scope',''),nullif(p_override->>'direct_labour_scope',''),v_override_reason,auth.uid()) returning id into v_id;
  else
    update costing.product_process_route_override set operation_type=coalesce(v_op,operation_type),
      base_step_id=case when p_override ? 'base_step_id' then v_base_step_id else base_step_id end,
      override_step_key=case when p_override ? 'override_step_key' then nullif(btrim(p_override->>'override_step_key'),'') else override_step_key end,
      sequence_no=case when p_override ? 'sequence_no' then nullif(p_override->>'sequence_no','')::numeric else sequence_no end,
      activity_id=case when p_override ? 'activity_id' then nullif(p_override->>'activity_id','')::integer else activity_id end,
      cost_centre_id=case when p_override ? 'cost_centre_id' then nullif(p_override->>'cost_centre_id','')::bigint else cost_centre_id end,
      section_id=case when p_override ? 'section_id' then nullif(p_override->>'section_id','')::integer else section_id end,
      subsection_id=case when p_override ? 'subsection_id' then nullif(p_override->>'subsection_id','')::integer else subsection_id end,
      area_id=case when p_override ? 'area_id' then nullif(p_override->>'area_id','')::integer else area_id end,
      plant_id=case when p_override ? 'plant_id' then nullif(p_override->>'plant_id','')::integer else plant_id end,
      behaviour_code=case when p_override ? 'behaviour_code' then nullif(p_override->>'behaviour_code','') else behaviour_code end,
      resource_class_code=case when p_override ? 'resource_class_code' then nullif(p_override->>'resource_class_code','') else resource_class_code end,
      route_step_scope=case when p_override ? 'route_step_scope' then nullif(p_override->>'route_step_scope','') else route_step_scope end,
      expected_occurrence_count=case when p_override ? 'expected_occurrence_count' then nullif(p_override->>'expected_occurrence_count','')::numeric else expected_occurrence_count end,
      standard_cycle_count=case when p_override ? 'standard_cycle_count' then nullif(p_override->>'standard_cycle_count','')::numeric else standard_cycle_count end,
      is_mandatory=case when p_override ? 'is_mandatory' then (p_override->>'is_mandatory')::boolean else is_mandatory end,
      allows_repeat=case when p_override ? 'allows_repeat' then (p_override->>'allows_repeat')::boolean else allows_repeat end,
      allows_skip_with_approval=case when p_override ? 'allows_skip_with_approval' then (p_override->>'allows_skip_with_approval')::boolean else allows_skip_with_approval end,
      production_overhead_scope=case when p_override ? 'production_overhead_scope' then nullif(p_override->>'production_overhead_scope','') else production_overhead_scope end,
      direct_labour_scope=case when p_override ? 'direct_labour_scope' then nullif(p_override->>'direct_labour_scope','') else direct_labour_scope end,
      override_reason=coalesce(v_override_reason,override_reason),updated_at=now()
    where id=p_override_id and product_route_id=p_product_route_id returning id into v_id;
  end if;
  update costing.product_process_route set status='DRAFT',updated_at=now() where id=p_product_route_id and archived_at is null and status in('REVIEW_REQUIRED','REJECTED');
  return public.rpc_get_product_route_detail(p_product_route_id);
end
$function$;

create or replace function public.rpc_delete_product_route_override(p_product_route_id bigint,p_override_id bigint)
returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  if not exists(select 1 from costing.product_process_route where id=p_product_route_id and archived_at is null and status in ('DRAFT','REVIEW_REQUIRED')) then
    raise exception 'Product route is missing, archived, or read-only';
  end if;
  delete from costing.product_process_route_override where id=p_override_id and product_route_id=p_product_route_id;
  return jsonb_build_object('deleted',found);
end
$function$;

create or replace function public.rpc_update_route_family_mapping_draft(p_mapping_id bigint,p_patch jsonb)
returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_mapping costing.production_route_family_product_group_map%rowtype; v_allowed_keys constant text[]:=array['effective_from','mapping_basis','mapping_note']; v_unknown_keys text[]; v_basis text;
begin
  perform public.require_permission('module:production-route-manager',true);
  if p_mapping_id is null or p_mapping_id<=0 then raise exception 'A valid mapping ID is required'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'A non-empty mapping patch object is required'; end if;
  select array_agg(k order by k) into v_unknown_keys from jsonb_object_keys(p_patch) k where not(k=any(v_allowed_keys));
  if coalesce(cardinality(v_unknown_keys),0)>0 then raise exception 'Unsupported mapping patch keys: %',array_to_string(v_unknown_keys,', '); end if;
  if p_patch ? 'mapping_basis' then v_basis:=upper(nullif(btrim(p_patch->>'mapping_basis'),'')); if v_basis is null or v_basis not in('MANUAL','HISTORICAL_REVIEW','MIGRATED') then raise exception 'Mapping basis must be MANUAL, HISTORICAL_REVIEW, or MIGRATED'; end if; end if;
  if p_patch ? 'effective_from' and nullif(btrim(p_patch->>'effective_from'),'') is null then raise exception 'Effective-from date cannot be blank when supplied'; end if;
  update costing.production_route_family_product_group_map m set
    effective_from=case when p_patch ? 'effective_from' then (p_patch->>'effective_from')::date else m.effective_from end,
    mapping_basis=case when p_patch ? 'mapping_basis' then v_basis else m.mapping_basis end,
    mapping_note=case when p_patch ? 'mapping_note' then nullif(btrim(p_patch->>'mapping_note'),'') else m.mapping_note end,updated_at=now()
  where m.id=p_mapping_id and m.archived_at is null and m.status in('DRAFT','IN_REVIEW') returning m.* into v_mapping;
  if not found then raise exception 'Route Family mapping is missing, archived, or not editable'; end if;
  return jsonb_build_object('mapping',to_jsonb(v_mapping),'mapping_id',v_mapping.id,'status',v_mapping.status,'updated',true);
end
$function$;

create or replace function public.rpc_update_product_subgroup_route_family_mapping_draft(p_mapping_id bigint,p_patch jsonb)
returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_mapping costing.production_route_family_product_subgroup_map%rowtype; v_allowed_keys constant text[]:=array['effective_from','mapping_basis','mapping_note']; v_unknown_keys text[]; v_basis text;
begin
  perform public.require_permission('module:production-route-manager',true);
  if p_mapping_id is null or p_mapping_id<=0 then raise exception 'A valid mapping ID is required'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'A non-empty mapping patch object is required'; end if;
  select array_agg(k order by k) into v_unknown_keys from jsonb_object_keys(p_patch) k where not(k=any(v_allowed_keys));
  if coalesce(cardinality(v_unknown_keys),0)>0 then raise exception 'Unsupported Subgroup mapping patch keys: %',array_to_string(v_unknown_keys,', '); end if;
  if p_patch ? 'mapping_basis' then v_basis:=upper(nullif(btrim(p_patch->>'mapping_basis'),'')); if v_basis is null or v_basis not in('MANUAL','HISTORICAL_REVIEW','MIGRATED') then raise exception 'Mapping basis must be MANUAL, HISTORICAL_REVIEW, or MIGRATED'; end if; end if;
  if p_patch ? 'effective_from' and nullif(btrim(p_patch->>'effective_from'),'') is null then raise exception 'Effective-from date cannot be blank when supplied'; end if;
  update costing.production_route_family_product_subgroup_map m set
    effective_from=case when p_patch ? 'effective_from' then (p_patch->>'effective_from')::date else m.effective_from end,
    mapping_basis=case when p_patch ? 'mapping_basis' then v_basis else m.mapping_basis end,
    mapping_note=case when p_patch ? 'mapping_note' then nullif(btrim(p_patch->>'mapping_note'),'') else m.mapping_note end,updated_at=now()
  where m.id=p_mapping_id and m.archived_at is null and m.status in('DRAFT','IN_REVIEW') returning m.* into v_mapping;
  if not found then raise exception 'Product Subgroup mapping is missing, archived, or not editable'; end if;
  return jsonb_build_object('mapping',to_jsonb(v_mapping),'mapping_id',v_mapping.id,'status',v_mapping.status,'updated',true);
end
$function$;

create or replace function public.rpc_inactivate_product_subgroup_route_family_mapping(p_mapping_id bigint,p_effective_to date)
returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  update costing.production_route_family_product_subgroup_map
  set status='INACTIVE',effective_to=p_effective_to,updated_at=now()
  where id=p_mapping_id and archived_at is null and status='APPROVED' and p_effective_to>=effective_from;
  if not found then raise exception 'Approved Product Subgroup Route Family mapping is not inactivatable'; end if;
  return jsonb_build_object('mapping_id',p_mapping_id,'status','INACTIVE','effective_to',p_effective_to);
end
$function$;

create or replace function public.rpc_cancel_product_route_family_assignment(p_assignment_id bigint,p_cancellation_reason text)
returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_assignment costing.production_route_family_product_map%rowtype;
begin
  perform public.require_permission('module:production-route-manager',true);
  if p_assignment_id is null or p_assignment_id<=0 then raise exception 'A valid assignment ID is required'; end if;
  if nullif(btrim(p_cancellation_reason),'') is null or upper(btrim(p_cancellation_reason)) in('-','—','NA','N/A') then raise exception 'A meaningful cancellation reason is required'; end if;
  update costing.production_route_family_product_map a set status='CANCELLED',cancellation_reason=btrim(p_cancellation_reason),cancelled_by=auth.uid(),cancelled_at=now(),updated_at=now()
  where a.id=p_assignment_id and a.archived_at is null and a.status in('DRAFT','IN_REVIEW') returning a.* into v_assignment;
  if not found then raise exception 'Product Route Family assignment is missing, archived, or not cancellable'; end if;
  return jsonb_build_object('assignment_id',v_assignment.id,'product_id',v_assignment.product_id,'route_family_id',v_assignment.route_family_id,'status',v_assignment.status,
    'cancellation_reason',v_assignment.cancellation_reason,'cancelled_at',v_assignment.cancelled_at);
end
$function$;

create or replace function public.rpc_inactivate_product_route_family_assignment(p_assignment_id bigint,p_effective_to date)
returns jsonb language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  update costing.production_route_family_product_map set status='INACTIVE',effective_to=p_effective_to,updated_at=now()
  where id=p_assignment_id and archived_at is null and status='APPROVED' and p_effective_to>=effective_from;
  if not found then raise exception 'Approved Product Route Family assignment is missing, archived, or not inactivatable'; end if;
  return jsonb_build_object('assignment_id',p_assignment_id,'status','INACTIVE','effective_to',p_effective_to);
end
$function$;
