-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_create_product_group_route_draft(
  p_product_group_id integer,
  p_route_name text,
  p_effective_from date default null,
  p_source_type text default 'MANUAL',
  p_evidence_status text default 'MANUAL_COMPLETE',
  p_route_note text default null,
  p_supersedes_route_id bigint default null
) returns jsonb
language plpgsql
security definer
set search_path=public,costing
as $$
declare v_id bigint; v_version integer; v_code text; v_user uuid:=auth.uid();
begin
  perform public.require_permission('module:production-route-manager',true);
  if not exists(select 1 from public.product_groups where id=p_product_group_id) then raise exception 'Product Group % not found',p_product_group_id; end if;
  if nullif(btrim(p_route_name),'') is null then raise exception 'Route name is required'; end if;
  if p_source_type not in('MANUAL','HISTORICAL_CANDIDATE','COPIED_VERSION') then raise exception 'Invalid source type %',p_source_type; end if;
  if p_evidence_status not in('MANUAL_COMPLETE','HISTORICAL_COMPLETE','PARTIAL_EVIDENCE','NO_EVIDENCE') then raise exception 'Invalid evidence status %',p_evidence_status; end if;
  if p_supersedes_route_id is not null and not exists(select 1 from costing.product_group_process_route where id=p_supersedes_route_id and product_group_id=p_product_group_id) then raise exception 'Superseded route does not belong to Product Group'; end if;
  select coalesce(max(route_version),0)+1 into v_version from costing.product_group_process_route where product_group_id=p_product_group_id;
  v_code:='PGR-'||p_product_group_id::text;
  insert into costing.product_group_process_route(product_group_id,route_code,route_version,route_name,status,effective_from,source_type,evidence_status,supersedes_route_id,route_note,created_by)
  values(p_product_group_id,v_code,v_version,btrim(p_route_name),'DRAFT',p_effective_from,p_source_type,p_evidence_status,p_supersedes_route_id,nullif(btrim(p_route_note),''),v_user)
  returning id into v_id;
  return public.rpc_get_product_group_route_detail(v_id);
end;
$$;

create or replace function public.rpc_update_product_group_route_draft(p_group_route_id bigint,p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,costing
as $$
declare r costing.product_group_process_route%rowtype;
begin
  perform public.require_permission('module:production-route-manager',true);
  select * into r from costing.product_group_process_route where id=p_group_route_id for update;
  if not found then raise exception 'Product Group route % not found',p_group_route_id; end if;
  if r.status not in('DRAFT','REVIEW_REQUIRED','REJECTED') then raise exception 'Route status % is not editable',r.status; end if;
  update costing.product_group_process_route set
    route_name=coalesce(nullif(btrim(p_patch->>'route_name'),''),route_name),
    effective_from=case when p_patch ? 'effective_from' then nullif(p_patch->>'effective_from','')::date else effective_from end,
    effective_to=case when p_patch ? 'effective_to' then nullif(p_patch->>'effective_to','')::date else effective_to end,
    source_type=coalesce(nullif(p_patch->>'source_type',''),source_type),
    evidence_status=coalesce(nullif(p_patch->>'evidence_status',''),evidence_status),
    route_note=case when p_patch ? 'route_note' then nullif(btrim(p_patch->>'route_note'),'') else route_note end,
    status=case when status='REJECTED' then 'DRAFT' else status end,
    updated_at=now()
  where id=p_group_route_id;
  return public.rpc_get_product_group_route_detail(p_group_route_id);
end;
$$;

create or replace function public.rpc_upsert_product_group_route_step(p_group_route_id bigint,p_step_id bigint default null,p_step jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,costing
as $$
declare r costing.product_group_process_route%rowtype; v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  select * into r from costing.product_group_process_route where id=p_group_route_id for update;
  if not found then raise exception 'Product Group route % not found',p_group_route_id; end if;
  if r.status not in('DRAFT','REVIEW_REQUIRED','REJECTED') then raise exception 'Route status % is not editable',r.status; end if;
  if p_step_id is null then
    insert into costing.product_group_process_route_step(
      group_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,
      behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,
      is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,step_note,created_by
    ) values(
      p_group_route_id,btrim(p_step->>'step_key'),(p_step->>'sequence_no')::numeric,(p_step->>'activity_id')::integer,(p_step->>'cost_centre_id')::bigint,
      (p_step->>'section_id')::integer,(p_step->>'subsection_id')::integer,(p_step->>'area_id')::integer,nullif(p_step->>'plant_id','')::integer,
      p_step->>'behaviour_code',p_step->>'resource_class_code',p_step->>'route_step_scope',coalesce(nullif(p_step->>'expected_occurrence_count','')::numeric,1),
      coalesce(nullif(p_step->>'standard_cycle_count','')::numeric,1),coalesce((p_step->>'is_mandatory')::boolean,true),coalesce((p_step->>'allows_repeat')::boolean,false),
      coalesce((p_step->>'allows_skip_with_approval')::boolean,false),coalesce(nullif(p_step->>'production_overhead_scope',''),'INCLUDE'),
      coalesce(nullif(p_step->>'direct_labour_scope',''),'INCLUDE'),nullif(btrim(p_step->>'step_note'),''),auth.uid()
    ) returning id into v_id;
  else
    if not exists(select 1 from costing.product_group_process_route_step where id=p_step_id and group_route_id=p_group_route_id) then raise exception 'Route step % not found',p_step_id; end if;
    update costing.product_group_process_route_step set
      step_key=coalesce(nullif(btrim(p_step->>'step_key'),''),step_key),
      sequence_no=coalesce(nullif(p_step->>'sequence_no','')::numeric,sequence_no),
      activity_id=coalesce(nullif(p_step->>'activity_id','')::integer,activity_id),
      cost_centre_id=coalesce(nullif(p_step->>'cost_centre_id','')::bigint,cost_centre_id),
      section_id=coalesce(nullif(p_step->>'section_id','')::integer,section_id),
      subsection_id=coalesce(nullif(p_step->>'subsection_id','')::integer,subsection_id),
      area_id=coalesce(nullif(p_step->>'area_id','')::integer,area_id),
      plant_id=case when p_step ? 'plant_id' then nullif(p_step->>'plant_id','')::integer else plant_id end,
      behaviour_code=coalesce(nullif(p_step->>'behaviour_code',''),behaviour_code),
      resource_class_code=coalesce(nullif(p_step->>'resource_class_code',''),resource_class_code),
      route_step_scope=coalesce(nullif(p_step->>'route_step_scope',''),route_step_scope),
      expected_occurrence_count=coalesce(nullif(p_step->>'expected_occurrence_count','')::numeric,expected_occurrence_count),
      standard_cycle_count=coalesce(nullif(p_step->>'standard_cycle_count','')::numeric,standard_cycle_count),
      is_mandatory=case when p_step ? 'is_mandatory' then (p_step->>'is_mandatory')::boolean else is_mandatory end,
      allows_repeat=case when p_step ? 'allows_repeat' then (p_step->>'allows_repeat')::boolean else allows_repeat end,
      allows_skip_with_approval=case when p_step ? 'allows_skip_with_approval' then (p_step->>'allows_skip_with_approval')::boolean else allows_skip_with_approval end,
      production_overhead_scope=coalesce(nullif(p_step->>'production_overhead_scope',''),production_overhead_scope),
      direct_labour_scope=coalesce(nullif(p_step->>'direct_labour_scope',''),direct_labour_scope),
      step_note=case when p_step ? 'step_note' then nullif(btrim(p_step->>'step_note'),'') else step_note end,
      updated_at=now()
    where id=p_step_id returning id into v_id;
  end if;
  update costing.product_group_process_route set status='DRAFT',updated_at=now() where id=p_group_route_id and status in('REVIEW_REQUIRED','REJECTED');
  return public.rpc_get_product_group_route_detail(p_group_route_id);
end;
$$;

create or replace function public.rpc_delete_product_group_route_step(p_group_route_id bigint,p_step_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
declare v_status text;
begin
  perform public.require_permission('module:production-route-manager',true);
  select status into v_status from costing.product_group_process_route where id=p_group_route_id for update;
  if v_status is null then raise exception 'Product Group route % not found',p_group_route_id; end if;
  if v_status not in('DRAFT','REVIEW_REQUIRED','REJECTED') then raise exception 'Route status % is not editable',v_status; end if;
  delete from costing.product_group_process_route_step where id=p_step_id and group_route_id=p_group_route_id;
  if not found then raise exception 'Route step % not found',p_step_id; end if;
  update costing.product_group_process_route set status='DRAFT',updated_at=now() where id=p_group_route_id;
  return public.rpc_get_product_group_route_detail(p_group_route_id);
end;$$;

create or replace function public.rpc_submit_product_group_route_for_review(p_group_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
declare v jsonb; v_status text;
begin
  perform public.require_permission('module:production-route-manager',true);
  select status into v_status from costing.product_group_process_route where id=p_group_route_id for update;
  if v_status is null then raise exception 'Product Group route % not found',p_group_route_id; end if;
  if v_status not in('DRAFT','REJECTED') then raise exception 'Route status % cannot be submitted',v_status; end if;
  v:=costing.fn_validate_group_process_route(p_group_route_id);
  if not coalesce((v->>'valid')::boolean,false) then raise exception 'Group route validation failed: %',v::text; end if;
  update costing.product_group_process_route set status='REVIEW_REQUIRED',updated_at=now() where id=p_group_route_id;
  return public.rpc_get_product_group_route_detail(p_group_route_id);
end;$$;

create or replace function public.rpc_approve_product_group_route(p_group_route_id bigint,p_approval_reference text)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
begin
  perform public.require_permission('module:production-route-manager',true);
  perform costing.fn_approve_group_process_route(p_group_route_id,p_approval_reference);
  return public.rpc_get_product_group_route_detail(p_group_route_id);
end;$$;

create or replace function public.rpc_supersede_product_group_route(p_old_group_route_id bigint,p_new_group_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
declare o costing.product_group_process_route%rowtype; n costing.product_group_process_route%rowtype;
begin
  perform public.require_permission('module:production-route-manager',true);
  select * into o from costing.product_group_process_route where id=p_old_group_route_id for update;
  select * into n from costing.product_group_process_route where id=p_new_group_route_id for update;
  if o.status<>'APPROVED' or n.status<>'APPROVED' then raise exception 'Both old and new Group routes must be APPROVED'; end if;
  if o.product_group_id<>n.product_group_id then raise exception 'Routes belong to different Product Groups'; end if;
  if n.effective_from is null or n.effective_from<=o.effective_from then raise exception 'New route must start after old route'; end if;
  update costing.product_group_process_route set status='SUPERSEDED',effective_to=n.effective_from-1,updated_at=now() where id=o.id;
  return jsonb_build_object('old_route',public.rpc_get_product_group_route_detail(o.id),'new_route',public.rpc_get_product_group_route_detail(n.id));
end;$$;

create or replace function public.rpc_create_product_route_draft(
 p_product_id integer,p_base_group_route_id bigint,p_batch_size_ref_id bigint,p_effective_from date default null,
 p_source_type text default 'GROUP_ROUTE_ONLY',p_evidence_status text default 'MANUAL_COMPLETE',p_route_note text default null,p_supersedes_route_id bigint default null
) returns jsonb language plpgsql security definer set search_path=public,costing as $$
declare v_id bigint;v_version integer;v_code text;v_pg integer;v_base_pg integer;
begin
  perform public.require_permission('module:production-route-manager',true);
  if not exists(select 1 from public.products where id=p_product_id) then raise exception 'Product % not found',p_product_id; end if;
  select product_group_id into v_base_pg from costing.product_group_process_route where id=p_base_group_route_id and status='APPROVED';
  if v_base_pg is null then raise exception 'Base Product Group route must be APPROVED'; end if;
  v_pg:=costing.fn_product_group_id_for_product(p_product_id);
  if v_pg is distinct from v_base_pg then raise exception 'Product does not belong to base route Product Group'; end if;
  if not exists(select 1 from public.production_batch_size_ref where id=p_batch_size_ref_id and product_id=p_product_id) then raise exception 'Batch-size reference does not belong to Product'; end if;
  if p_supersedes_route_id is not null and not exists(select 1 from costing.product_process_route where id=p_supersedes_route_id and product_id=p_product_id) then raise exception 'Superseded route does not belong to Product'; end if;
  select coalesce(max(route_version),0)+1 into v_version from costing.product_process_route where product_id=p_product_id;
  v_code:='PPR-'||p_product_id::text;
  insert into costing.product_process_route(product_id,base_group_route_id,route_version,route_code,status,effective_from,batch_size_ref_id,source_type,evidence_status,supersedes_route_id,route_note,created_by)
  values(p_product_id,p_base_group_route_id,v_version,v_code,'DRAFT',p_effective_from,p_batch_size_ref_id,p_source_type,p_evidence_status,p_supersedes_route_id,nullif(btrim(p_route_note),''),auth.uid()) returning id into v_id;
  return public.rpc_get_product_route_detail(v_id);
end;$$;

create or replace function public.rpc_update_product_route_draft(p_product_route_id bigint,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
declare r costing.product_process_route%rowtype;
begin
  perform public.require_permission('module:production-route-manager',true);
  select * into r from costing.product_process_route where id=p_product_route_id for update;
  if not found then raise exception 'Product route % not found',p_product_route_id; end if;
  if r.status not in('DRAFT','REVIEW_REQUIRED','REJECTED') then raise exception 'Route status % is not editable',r.status; end if;
  if p_patch ? 'batch_size_ref_id' and not exists(select 1 from public.production_batch_size_ref where id=(p_patch->>'batch_size_ref_id')::bigint and product_id=r.product_id) then raise exception 'Batch-size reference does not belong to Product'; end if;
  update costing.product_process_route set
   effective_from=case when p_patch ? 'effective_from' then nullif(p_patch->>'effective_from','')::date else effective_from end,
   effective_to=case when p_patch ? 'effective_to' then nullif(p_patch->>'effective_to','')::date else effective_to end,
   batch_size_ref_id=coalesce(nullif(p_patch->>'batch_size_ref_id','')::bigint,batch_size_ref_id),
   source_type=coalesce(nullif(p_patch->>'source_type',''),source_type),
   evidence_status=coalesce(nullif(p_patch->>'evidence_status',''),evidence_status),
   route_note=case when p_patch ? 'route_note' then nullif(btrim(p_patch->>'route_note'),'') else route_note end,
   status=case when status='REJECTED' then 'DRAFT' else status end,updated_at=now()
  where id=p_product_route_id;
  return public.rpc_get_product_route_detail(p_product_route_id);
end;$$;

create or replace function public.rpc_upsert_product_route_override(p_product_route_id bigint,p_override_id bigint default null,p_override jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
declare r costing.product_process_route%rowtype;v_id bigint;v_op text;
begin
  perform public.require_permission('module:production-route-manager',true);
  select * into r from costing.product_process_route where id=p_product_route_id for update;
  if not found then raise exception 'Product route % not found',p_product_route_id; end if;
  if r.status not in('DRAFT','REVIEW_REQUIRED','REJECTED') then raise exception 'Route status % is not editable',r.status; end if;
  v_op:=p_override->>'operation_type';
  if p_override_id is null then
    insert into costing.product_process_route_override(
      product_route_id,operation_type,base_step_id,override_step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,
      behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,
      production_overhead_scope,direct_labour_scope,override_reason,created_by
    ) values(
      p_product_route_id,v_op,nullif(p_override->>'base_step_id','')::bigint,nullif(btrim(p_override->>'override_step_key'),''),nullif(p_override->>'sequence_no','')::numeric,
      nullif(p_override->>'activity_id','')::integer,nullif(p_override->>'cost_centre_id','')::bigint,nullif(p_override->>'section_id','')::integer,
      nullif(p_override->>'subsection_id','')::integer,nullif(p_override->>'area_id','')::integer,nullif(p_override->>'plant_id','')::integer,
      nullif(p_override->>'behaviour_code',''),nullif(p_override->>'resource_class_code',''),nullif(p_override->>'route_step_scope',''),
      nullif(p_override->>'expected_occurrence_count','')::numeric,nullif(p_override->>'standard_cycle_count','')::numeric,
      case when p_override ? 'is_mandatory' then (p_override->>'is_mandatory')::boolean end,
      case when p_override ? 'allows_repeat' then (p_override->>'allows_repeat')::boolean end,
      case when p_override ? 'allows_skip_with_approval' then (p_override->>'allows_skip_with_approval')::boolean end,
      nullif(p_override->>'production_overhead_scope',''),nullif(p_override->>'direct_labour_scope',''),btrim(p_override->>'override_reason'),auth.uid()
    ) returning id into v_id;
  else
    if not exists(select 1 from costing.product_process_route_override where id=p_override_id and product_route_id=p_product_route_id) then raise exception 'Override % not found',p_override_id; end if;
    update costing.product_process_route_override set
      operation_type=coalesce(nullif(p_override->>'operation_type',''),operation_type),
      base_step_id=case when p_override ? 'base_step_id' then nullif(p_override->>'base_step_id','')::bigint else base_step_id end,
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
      override_reason=coalesce(nullif(btrim(p_override->>'override_reason'),''),override_reason),updated_at=now()
    where id=p_override_id returning id into v_id;
  end if;
  update costing.product_process_route set status='DRAFT',updated_at=now() where id=p_product_route_id and status in('REVIEW_REQUIRED','REJECTED');
  return public.rpc_get_product_route_detail(p_product_route_id);
end;$$;

create or replace function public.rpc_delete_product_route_override(p_product_route_id bigint,p_override_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
declare v_status text;
begin
  perform public.require_permission('module:production-route-manager',true);
  select status into v_status from costing.product_process_route where id=p_product_route_id for update;
  if v_status is null then raise exception 'Product route % not found',p_product_route_id; end if;
  if v_status not in('DRAFT','REVIEW_REQUIRED','REJECTED') then raise exception 'Route status % is not editable',v_status; end if;
  delete from costing.product_process_route_override where id=p_override_id and product_route_id=p_product_route_id;
  if not found then raise exception 'Override % not found',p_override_id; end if;
  update costing.product_process_route set status='DRAFT',updated_at=now() where id=p_product_route_id;
  return public.rpc_get_product_route_detail(p_product_route_id);
end;$$;

create or replace function public.rpc_submit_product_route_for_review(p_product_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
declare v jsonb;v_status text;
begin
  perform public.require_permission('module:production-route-manager',true);
  select status into v_status from costing.product_process_route where id=p_product_route_id for update;
  if v_status is null then raise exception 'Product route % not found',p_product_route_id; end if;
  if v_status not in('DRAFT','REJECTED') then raise exception 'Route status % cannot be submitted',v_status; end if;
  v:=costing.fn_validate_product_process_route(p_product_route_id);
  if not coalesce((v->>'valid')::boolean,false) then raise exception 'Product route validation failed: %',v::text; end if;
  update costing.product_process_route set status='REVIEW_REQUIRED',updated_at=now() where id=p_product_route_id;
  return public.rpc_get_product_route_detail(p_product_route_id);
end;$$;

create or replace function public.rpc_approve_product_route(p_product_route_id bigint,p_approval_reference text)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
begin
  perform public.require_permission('module:production-route-manager',true);
  perform costing.fn_approve_product_process_route(p_product_route_id,p_approval_reference);
  return public.rpc_get_product_route_detail(p_product_route_id);
end;$$;

create or replace function public.rpc_supersede_product_route(p_old_product_route_id bigint,p_new_product_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
declare o costing.product_process_route%rowtype;n costing.product_process_route%rowtype;
begin
  perform public.require_permission('module:production-route-manager',true);
  select * into o from costing.product_process_route where id=p_old_product_route_id for update;
  select * into n from costing.product_process_route where id=p_new_product_route_id for update;
  if o.status<>'APPROVED' or n.status<>'APPROVED' then raise exception 'Both old and new Product routes must be APPROVED'; end if;
  if o.product_id<>n.product_id then raise exception 'Routes belong to different Products'; end if;
  if n.effective_from is null or n.effective_from<=o.effective_from then raise exception 'New route must start after old route'; end if;
  update costing.product_process_route set status='SUPERSEDED',effective_to=n.effective_from-1,updated_at=now() where id=o.id;
  return jsonb_build_object('old_route',public.rpc_get_product_route_detail(o.id),'new_route',public.rpc_get_product_route_detail(n.id));
end;$$;

create or replace function public.rpc_validate_product_group_route(p_group_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $$begin perform public.require_permission('module:production-route-manager',false);return costing.fn_validate_group_process_route(p_group_route_id);end;$$;
create or replace function public.rpc_validate_product_route(p_product_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $$begin perform public.require_permission('module:production-route-manager',false);return costing.fn_validate_product_process_route(p_product_route_id);end;$$;

revoke all on function public.rpc_create_product_group_route_draft(integer,text,date,text,text,text,bigint) from public,anon;
revoke all on function public.rpc_update_product_group_route_draft(bigint,jsonb) from public,anon;
revoke all on function public.rpc_upsert_product_group_route_step(bigint,bigint,jsonb) from public,anon;
revoke all on function public.rpc_delete_product_group_route_step(bigint,bigint) from public,anon;
revoke all on function public.rpc_submit_product_group_route_for_review(bigint) from public,anon;
revoke all on function public.rpc_approve_product_group_route(bigint,text) from public,anon;
revoke all on function public.rpc_supersede_product_group_route(bigint,bigint) from public,anon;
revoke all on function public.rpc_create_product_route_draft(integer,bigint,bigint,date,text,text,text,bigint) from public,anon;
revoke all on function public.rpc_update_product_route_draft(bigint,jsonb) from public,anon;
revoke all on function public.rpc_upsert_product_route_override(bigint,bigint,jsonb) from public,anon;
revoke all on function public.rpc_delete_product_route_override(bigint,bigint) from public,anon;
revoke all on function public.rpc_submit_product_route_for_review(bigint) from public,anon;
revoke all on function public.rpc_approve_product_route(bigint,text) from public,anon;
revoke all on function public.rpc_supersede_product_route(bigint,bigint) from public,anon;
revoke all on function public.rpc_validate_product_group_route(bigint) from public,anon;
revoke all on function public.rpc_validate_product_route(bigint) from public,anon;

grant execute on function public.rpc_create_product_group_route_draft(integer,text,date,text,text,text,bigint) to authenticated,service_role;
grant execute on function public.rpc_update_product_group_route_draft(bigint,jsonb) to authenticated,service_role;
grant execute on function public.rpc_upsert_product_group_route_step(bigint,bigint,jsonb) to authenticated,service_role;
grant execute on function public.rpc_delete_product_group_route_step(bigint,bigint) to authenticated,service_role;
grant execute on function public.rpc_submit_product_group_route_for_review(bigint) to authenticated,service_role;
grant execute on function public.rpc_approve_product_group_route(bigint,text) to authenticated,service_role;
grant execute on function public.rpc_supersede_product_group_route(bigint,bigint) to authenticated,service_role;
grant execute on function public.rpc_create_product_route_draft(integer,bigint,bigint,date,text,text,text,bigint) to authenticated,service_role;
grant execute on function public.rpc_update_product_route_draft(bigint,jsonb) to authenticated,service_role;
grant execute on function public.rpc_upsert_product_route_override(bigint,bigint,jsonb) to authenticated,service_role;
grant execute on function public.rpc_delete_product_route_override(bigint,bigint) to authenticated,service_role;
grant execute on function public.rpc_submit_product_route_for_review(bigint) to authenticated,service_role;
grant execute on function public.rpc_approve_product_route(bigint,text) to authenticated,service_role;
grant execute on function public.rpc_supersede_product_route(bigint,bigint) to authenticated,service_role;
grant execute on function public.rpc_validate_product_group_route(bigint) to authenticated,service_role;
grant execute on function public.rpc_validate_product_route(bigint) to authenticated,service_role;