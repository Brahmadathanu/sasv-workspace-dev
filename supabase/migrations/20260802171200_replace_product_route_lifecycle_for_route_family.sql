-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop function if exists public.rpc_create_product_route_draft(integer,bigint,bigint,date,text,text,text,bigint);

create function public.rpc_create_product_route_draft(
  p_product_id integer,p_base_route_family_route_id bigint,p_batch_size_ref_id bigint,
  p_effective_from date default null,p_source_type text default 'ROUTE_FAMILY_ONLY',
  p_evidence_status text default 'MANUAL_COMPLETE',p_route_note text default null,
  p_supersedes_route_id bigint default null
)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_version integer; v_id bigint; v_family_id bigint; v_base_family_id bigint; v_batch_product integer;
begin
  perform public.require_permission('module:production-route-manager',true);
  v_family_id:=costing.fn_resolve_route_family_for_product(p_product_id,coalesce(p_effective_from,current_date));
  select route_family_id into v_base_family_id from costing.production_route_family_route where id=p_base_route_family_route_id and status='APPROVED';
  if v_family_id is null then raise exception 'Product has no approved Route Family mapping'; end if;
  if v_base_family_id is null or v_base_family_id<>v_family_id then raise exception 'Base Route Family route does not match the Product mapping'; end if;
  select product_id into v_batch_product from public.production_batch_size_ref where id=p_batch_size_ref_id and is_active;
  if v_batch_product is distinct from p_product_id then raise exception 'Batch-size reference does not belong to Product'; end if;
  select coalesce(max(route_version),0)+1 into v_version from costing.product_process_route where product_id=p_product_id;
  insert into costing.product_process_route(product_id,base_route_family_route_id,route_version,route_code,effective_from,batch_size_ref_id,source_type,evidence_status,route_note,supersedes_route_id,created_by)
  values(p_product_id,p_base_route_family_route_id,v_version,'PRODUCT_'||p_product_id||'_ROUTE',p_effective_from,p_batch_size_ref_id,upper(p_source_type),upper(p_evidence_status),nullif(btrim(p_route_note),''),p_supersedes_route_id,auth.uid()) returning id into v_id;
  return jsonb_build_object('product_route_id',v_id,'route_version',v_version,'status','DRAFT');
end
$function$;

create or replace function public.rpc_update_product_route_draft(p_product_route_id bigint,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  update costing.product_process_route r set
    effective_from=case when p_patch ? 'effective_from' then nullif(p_patch->>'effective_from','')::date else r.effective_from end,
    source_type=coalesce(nullif(upper(p_patch->>'source_type'),''),r.source_type),
    evidence_status=coalesce(nullif(upper(p_patch->>'evidence_status'),''),r.evidence_status),
    route_note=case when p_patch ? 'route_note' then nullif(p_patch->>'route_note','') else r.route_note end,
    batch_size_ref_id=coalesce((p_patch->>'batch_size_ref_id')::bigint,r.batch_size_ref_id),updated_at=now()
  where r.id=p_product_route_id and r.status in ('DRAFT','REVIEW_REQUIRED');
  if not found then raise exception 'Product route is not editable'; end if;
  return jsonb_build_object('product_route_id',p_product_route_id,'updated',true);
end
$function$;

create or replace function public.rpc_delete_product_route_override(p_product_route_id bigint,p_override_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
begin perform public.require_permission('module:production-route-manager',true); if not exists(select 1 from costing.product_process_route where id=p_product_route_id and status in ('DRAFT','REVIEW_REQUIRED')) then raise exception 'Product route is read-only'; end if; delete from costing.product_process_route_override where id=p_override_id and product_route_id=p_product_route_id; return jsonb_build_object('deleted',found); end
$function$;

create or replace function public.rpc_validate_product_route(p_product_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$ begin perform public.require_permission('module:production-route-manager',false); return costing.fn_validate_product_process_route(p_product_route_id); end $function$;

create or replace function public.rpc_submit_product_route_for_review(p_product_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
begin perform public.require_permission('module:production-route-manager',true); if not coalesce((costing.fn_validate_product_process_route(p_product_route_id)->>'valid')::boolean,false) then raise exception 'Product route validation failed'; end if; update costing.product_process_route set status='REVIEW_REQUIRED',updated_at=now() where id=p_product_route_id and status='DRAFT'; if not found then raise exception 'Product route is not a draft'; end if; return jsonb_build_object('product_route_id',p_product_route_id,'status','REVIEW_REQUIRED'); end
$function$;

create or replace function public.rpc_approve_product_route(p_product_route_id bigint,p_approval_reference text)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_product integer; v_from date;
begin perform public.require_permission('module:production-route-manager',true); if nullif(btrim(p_approval_reference),'') is null then raise exception 'Approval reference is required'; end if; if not coalesce((costing.fn_validate_product_process_route(p_product_route_id)->>'valid')::boolean,false) then raise exception 'Product route validation failed'; end if; select product_id,coalesce(effective_from,current_date) into v_product,v_from from costing.product_process_route where id=p_product_route_id and status='REVIEW_REQUIRED'; if v_product is null then raise exception 'Product route must be in review'; end if; if exists(select 1 from costing.product_process_route where id<>p_product_route_id and product_id=v_product and status='APPROVED' and effective_from<=v_from and (effective_to is null or effective_to>=v_from)) then raise exception 'Approved Product route overlaps requested effective date'; end if; update costing.product_process_route set status='APPROVED',effective_from=v_from,approval_reference=btrim(p_approval_reference),approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_product_route_id; return jsonb_build_object('product_route_id',p_product_route_id,'status','APPROVED'); end
$function$;

create or replace function public.rpc_supersede_product_route(p_old_product_route_id bigint,p_new_product_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_new_from date; v_old_product integer; v_new_product integer;
begin perform public.require_permission('module:production-route-manager',true); select effective_from,product_id into v_new_from,v_new_product from costing.product_process_route where id=p_new_product_route_id and status='APPROVED'; select product_id into v_old_product from costing.product_process_route where id=p_old_product_route_id and status='APPROVED'; if v_new_product is null or v_old_product is null or v_new_product<>v_old_product then raise exception 'Both routes must be approved versions of the same Product'; end if; update costing.product_process_route set status='SUPERSEDED',effective_to=v_new_from-1,updated_at=now() where id=p_old_product_route_id; return jsonb_build_object('old_product_route_id',p_old_product_route_id,'new_product_route_id',p_new_product_route_id,'status','SUPERSEDED'); end
$function$;

revoke all on function public.rpc_create_product_route_draft(integer,bigint,bigint,date,text,text,text,bigint) from public,anon;
grant execute on function public.rpc_create_product_route_draft(integer,bigint,bigint,date,text,text,text,bigint) to authenticated,service_role;