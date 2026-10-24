-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_submit_route_family_route_for_review(p_family_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  if not coalesce((costing.fn_validate_route_family_route(p_family_route_id)->>'valid')::boolean,false) then raise exception 'Route Family route validation failed'; end if;
  update costing.production_route_family_route set status='REVIEW_REQUIRED',updated_at=now() where id=p_family_route_id and status='DRAFT';
  if not found then raise exception 'Route Family route is not an editable draft'; end if;
  return jsonb_build_object('family_route_id',p_family_route_id,'status','REVIEW_REQUIRED');
end
$function$;

create or replace function public.rpc_approve_route_family(p_route_family_id bigint,p_approval_reference text,p_effective_from date default null)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  if nullif(btrim(p_approval_reference),'') is null then raise exception 'Approval reference is required'; end if;
  update costing.production_route_family set status='APPROVED',effective_from=coalesce(p_effective_from,effective_from,current_date),approval_reference=btrim(p_approval_reference),approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_route_family_id and status in ('DRAFT','IN_REVIEW');
  if not found then raise exception 'Route Family is not approvable'; end if;
  return jsonb_build_object('route_family_id',p_route_family_id,'status','APPROVED');
end
$function$;

create or replace function public.rpc_approve_route_family_mapping(p_mapping_id bigint,p_approval_reference text,p_effective_from date default null)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_group_id integer; v_from date;
begin
  perform public.require_permission('module:production-route-manager',true);
  if nullif(btrim(p_approval_reference),'') is null then raise exception 'Approval reference is required'; end if;
  select product_group_id,coalesce(p_effective_from,effective_from,current_date) into v_group_id,v_from from costing.production_route_family_product_group_map where id=p_mapping_id;
  if v_group_id is null then raise exception 'Route Family mapping not found'; end if;
  if not exists(select 1 from costing.production_route_family_product_group_map m join costing.production_route_family f on f.id=m.route_family_id where m.id=p_mapping_id and f.status='APPROVED') then raise exception 'Route Family must be approved before its mapping'; end if;
  if exists(select 1 from costing.production_route_family_product_group_map where id<>p_mapping_id and product_group_id=v_group_id and status='APPROVED' and effective_from<=v_from and (effective_to is null or effective_to>=v_from)) then raise exception 'Product Group already has an overlapping approved Route Family mapping'; end if;
  update costing.production_route_family_product_group_map set status='APPROVED',effective_from=v_from,approval_reference=btrim(p_approval_reference),approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_mapping_id and status in ('DRAFT','IN_REVIEW');
  if not found then raise exception 'Route Family mapping is not approvable'; end if;
  return jsonb_build_object('mapping_id',p_mapping_id,'status','APPROVED');
end
$function$;

create or replace function public.rpc_approve_route_family_route(p_family_route_id bigint,p_approval_reference text)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_route costing.production_route_family_route%rowtype;
begin
  perform public.require_permission('module:production-route-manager',true);
  if nullif(btrim(p_approval_reference),'') is null then raise exception 'Approval reference is required'; end if;
  select * into v_route from costing.production_route_family_route where id=p_family_route_id;
  if not found then raise exception 'Route Family route not found'; end if;
  if not exists(select 1 from costing.production_route_family where id=v_route.route_family_id and status='APPROVED') then raise exception 'Route Family must be approved first'; end if;
  if not coalesce((costing.fn_validate_route_family_route(p_family_route_id)->>'valid')::boolean,false) then raise exception 'Route Family route validation failed'; end if;
  if exists(select 1 from costing.production_route_family_route where id<>p_family_route_id and route_family_id=v_route.route_family_id and status='APPROVED' and effective_from<=coalesce(v_route.effective_from,current_date) and (effective_to is null or effective_to>=coalesce(v_route.effective_from,current_date))) then raise exception 'An approved Route Family route overlaps the requested effective date'; end if;
  update costing.production_route_family_route set status='APPROVED',effective_from=coalesce(effective_from,current_date),approval_reference=btrim(p_approval_reference),approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_family_route_id and status='REVIEW_REQUIRED';
  if not found then raise exception 'Route Family route must be in review'; end if;
  return jsonb_build_object('family_route_id',p_family_route_id,'status','APPROVED');
end
$function$;

create or replace function public.rpc_supersede_route_family_route(p_old_family_route_id bigint,p_new_family_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_new_from date; v_old_family bigint; v_new_family bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  select effective_from,route_family_id into v_new_from,v_new_family from costing.production_route_family_route where id=p_new_family_route_id and status='APPROVED';
  select route_family_id into v_old_family from costing.production_route_family_route where id=p_old_family_route_id and status='APPROVED';
  if v_new_family is null or v_old_family is null or v_new_family<>v_old_family then raise exception 'Both routes must be approved versions of the same Route Family'; end if;
  update costing.production_route_family_route set status='SUPERSEDED',effective_to=v_new_from-1,updated_at=now() where id=p_old_family_route_id;
  return jsonb_build_object('old_family_route_id',p_old_family_route_id,'new_family_route_id',p_new_family_route_id,'status','SUPERSEDED');
end
$function$;

revoke all on function public.rpc_submit_route_family_route_for_review(bigint) from public,anon;
revoke all on function public.rpc_approve_route_family(bigint,text,date) from public,anon;
revoke all on function public.rpc_approve_route_family_mapping(bigint,text,date) from public,anon;
revoke all on function public.rpc_approve_route_family_route(bigint,text) from public,anon;
revoke all on function public.rpc_supersede_route_family_route(bigint,bigint) from public,anon;

grant execute on function public.rpc_submit_route_family_route_for_review(bigint) to authenticated,service_role;
grant execute on function public.rpc_approve_route_family(bigint,text,date) to authenticated,service_role;
grant execute on function public.rpc_approve_route_family_mapping(bigint,text,date) to authenticated,service_role;
grant execute on function public.rpc_approve_route_family_route(bigint,text) to authenticated,service_role;
grant execute on function public.rpc_supersede_route_family_route(bigint,bigint) to authenticated,service_role;