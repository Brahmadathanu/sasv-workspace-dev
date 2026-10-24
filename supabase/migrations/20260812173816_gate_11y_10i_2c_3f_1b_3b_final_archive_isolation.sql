-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Final archive-isolation hardening for operational PRM surfaces.

create or replace function public.rpc_get_route_family_mapping_review_candidates(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint,
    p_as_of_date date default current_date,
    p_candidate_class text default null,
    p_product_group_id integer default null,
    p_search text default null,
    p_limit integer default 100,
    p_offset integer default 0
) returns jsonb
language plpgsql stable security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
    v_period_start date := date_trunc('month', p_period_start)::date;
    v_as_of_date date := coalesce(p_as_of_date, current_date);
    v_limit integer := greatest(1, least(coalesce(p_limit,100),500));
    v_offset integer := greatest(coalesce(p_offset,0),0);
    v_candidate_class text := nullif(upper(btrim(p_candidate_class)),'');
    v_run costing.costing_refresh_run%rowtype;
    v_result jsonb;
begin
    perform public.require_permission('module:production-route-manager', false);
    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;
    if v_candidate_class is not null
       and v_candidate_class not in ('SAME_GROUP_SINGLE_FAMILY_EVIDENCE','NO_READY_SAME_GROUP_EVIDENCE','AMBIGUOUS_SAME_GROUP_FAMILY_EVIDENCE') then
        raise exception 'Invalid candidate class %', p_candidate_class;
    end if;
    select * into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
    if not found then raise exception 'Costing refresh run % not found', p_refresh_run_id; end if;
    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Route-family mapping review context does not match refresh run %', p_refresh_run_id;
    end if;

    with recipients as materialized (
        select distinct w.product_id
        from costing.product_direct_labour_workload_snapshot w
        where w.refresh_run_id=p_refresh_run_id
          and w.period_start=v_period_start
          and w.valuation_date=p_valuation_date
    ), readiness as materialized (
        select r.*
        from costing.fn_product_process_route_readiness(v_as_of_date) r
        join recipients x on x.product_id=r.product_id
    ), ready_group_evidence as materialized (
        select r.product_group_id,
               count(*)::integer ready_products_same_group,
               count(distinct r.route_family_id)::integer distinct_ready_route_families_same_group,
               array_agg(distinct r.route_family_id order by r.route_family_id) filter(where r.route_family_id is not null) ready_route_family_ids,
               min(r.route_family_id) filter(where r.route_family_id is not null) sole_ready_route_family_id
        from readiness r where r.readiness_status='READY' group by r.product_group_id
    ), candidate_rows as materialized (
        select r.product_id,r.product_name,r.category_id,r.category_name,r.sub_category_id,r.subcategory_name,
               r.product_group_id,r.product_group_name,r.readiness_status,r.validation,
               coalesce(e.ready_products_same_group,0) ready_products_same_group,
               coalesce(e.distinct_ready_route_families_same_group,0) distinct_ready_route_families_same_group,
               coalesce(e.ready_route_family_ids,'{}'::bigint[]) ready_route_family_ids,
               case when coalesce(e.distinct_ready_route_families_same_group,0)=1 then e.sole_ready_route_family_id end candidate_route_family_id,
               case when coalesce(e.distinct_ready_route_families_same_group,0)=1 then 'SAME_GROUP_SINGLE_FAMILY_EVIDENCE'
                    when coalesce(e.distinct_ready_route_families_same_group,0)=0 then 'NO_READY_SAME_GROUP_EVIDENCE'
                    else 'AMBIGUOUS_SAME_GROUP_FAMILY_EVIDENCE' end candidate_class
        from readiness r left join ready_group_evidence e on e.product_group_id=r.product_group_id
        where r.readiness_status='BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'
    ), enriched as materialized (
        select c.*,f.family_code candidate_route_family_code,f.family_name candidate_route_family_name,f.status candidate_route_family_status,
               exists(select 1 from costing.production_route_family_product_group_map gm
                      where gm.product_group_id=c.product_group_id and gm.archived_at is null
                        and gm.status in ('DRAFT','IN_REVIEW')
                        and (gm.effective_to is null or gm.effective_to>=v_as_of_date)) has_pending_group_mapping,
               exists(select 1 from public.products p
                      join costing.production_route_family_product_subgroup_map sm on sm.product_subgroup_id=p.sub_group_id
                      where p.id=c.product_id and sm.archived_at is null
                        and sm.status in ('DRAFT','IN_REVIEW')
                        and (sm.effective_to is null or sm.effective_to>=v_as_of_date)) has_pending_subgroup_mapping,
               exists(select 1 from costing.production_route_family_product_map pm
                      where pm.product_id=c.product_id and pm.archived_at is null
                        and pm.status in ('DRAFT','IN_REVIEW')
                        and (pm.effective_to is null or pm.effective_to>=v_as_of_date)) has_pending_product_assignment
        from candidate_rows c
        left join costing.production_route_family f on f.id=c.candidate_route_family_id and f.archived_at is null
    ), filtered as materialized (
        select * from enriched e
        where (v_candidate_class is null or e.candidate_class=v_candidate_class)
          and (p_product_group_id is null or e.product_group_id=p_product_group_id)
          and (nullif(btrim(p_search),'') is null
               or e.product_name ilike '%'||btrim(p_search)||'%'
               or e.product_group_name ilike '%'||btrim(p_search)||'%'
               or e.category_name ilike '%'||btrim(p_search)||'%'
               or e.subcategory_name ilike '%'||btrim(p_search)||'%'
               or coalesce(e.candidate_route_family_name,'') ilike '%'||btrim(p_search)||'%'
               or coalesce(e.candidate_route_family_code,'') ilike '%'||btrim(p_search)||'%'
               or e.product_id::text=btrim(p_search))
    ), page as (
        select * from filtered
        order by case candidate_class when 'SAME_GROUP_SINGLE_FAMILY_EVIDENCE' then 1 when 'AMBIGUOUS_SAME_GROUP_FAMILY_EVIDENCE' then 2 else 3 end,
                 category_name,subcategory_name,product_group_name,product_name,product_id
        limit v_limit offset v_offset
    ), class_summary as (
        select candidate_class,count(*)::integer product_count,count(distinct product_group_id)::integer product_group_count
        from enriched group by candidate_class
    )
    select jsonb_build_object(
      'period_start',v_period_start,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'as_of_date',v_as_of_date,
      'total_blocked_product_count',(select count(*) from enriched),'filtered_count',(select count(*) from filtered),
      'limit',v_limit,'offset',v_offset,
      'class_summary',coalesce((select jsonb_agg(to_jsonb(s) order by s.candidate_class) from class_summary s),'[]'::jsonb),
      'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.category_name,p.subcategory_name,p.product_group_name,p.product_name,p.product_id) from page p),'[]'::jsonb)
    ) into v_result;
    return v_result;
end;
$function$;

create or replace function public.rpc_approve_route_family(p_route_family_id bigint,p_approval_reference text,p_effective_from date default null)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp'
as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  if nullif(btrim(p_approval_reference),'') is null then raise exception 'Approval reference is required'; end if;
  update costing.production_route_family
  set status='APPROVED',effective_from=coalesce(p_effective_from,effective_from,current_date),approval_reference=btrim(p_approval_reference),approved_by=auth.uid(),approved_at=now(),updated_at=now()
  where id=p_route_family_id and archived_at is null and status in ('DRAFT','IN_REVIEW');
  if not found then raise exception 'Route Family is not approvable or is archived'; end if;
  return jsonb_build_object('route_family_id',p_route_family_id,'status','APPROVED');
end
$function$;

create or replace function public.rpc_submit_product_route_family_assignment_for_review(p_assignment_id bigint)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp'
as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  update costing.production_route_family_product_map set status='IN_REVIEW',updated_at=now()
  where id=p_assignment_id and archived_at is null and status='DRAFT';
  if not found then raise exception 'Product Route Family assignment is not an editable active draft'; end if;
  return jsonb_build_object('assignment_id',p_assignment_id,'status','IN_REVIEW');
end
$function$;

create or replace function public.rpc_supersede_product_route(p_old_product_route_id bigint,p_new_product_route_id bigint)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp'
as $function$
declare v_new_from date; v_old_product integer; v_new_product integer;
begin
  perform public.require_permission('module:production-route-manager',true);
  select effective_from,product_id into v_new_from,v_new_product from costing.product_process_route
  where id=p_new_product_route_id and archived_at is null and status='APPROVED';
  select product_id into v_old_product from costing.product_process_route
  where id=p_old_product_route_id and archived_at is null and status='APPROVED';
  if v_new_product is null or v_old_product is null or v_new_product<>v_old_product then
    raise exception 'Both routes must be active approved versions of the same Product';
  end if;
  update costing.product_process_route set status='SUPERSEDED',effective_to=v_new_from-1,updated_at=now()
  where id=p_old_product_route_id and archived_at is null and status='APPROVED';
  return jsonb_build_object('old_product_route_id',p_old_product_route_id,'new_product_route_id',p_new_product_route_id,'status','SUPERSEDED');
end
$function$;

create or replace function public.rpc_supersede_route_family_route(p_old_family_route_id bigint,p_new_family_route_id bigint)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp'
as $function$
declare v_new_from date; v_old_family bigint; v_new_family bigint; v_old_status text; v_new_status text;
begin
  perform public.require_permission('module:production-route-manager',true);
  select effective_from,route_family_id,status into v_new_from,v_new_family,v_new_status
  from costing.production_route_family_route where id=p_new_family_route_id and archived_at is null;
  select route_family_id,status into v_old_family,v_old_status
  from costing.production_route_family_route where id=p_old_family_route_id and archived_at is null;
  if v_new_status='APPROVED' and v_old_status='SUPERSEDED' and v_new_family=v_old_family then
    return jsonb_build_object('old_family_route_id',p_old_family_route_id,'new_family_route_id',p_new_family_route_id,'status','SUPERSEDED','already_applied',true);
  end if;
  if v_new_status<>'APPROVED' or v_old_status<>'APPROVED' or v_new_family is null or v_old_family is null or v_new_family<>v_old_family then
    raise exception 'Both routes must be active approved versions of the same Route Family';
  end if;
  if v_new_from is null then raise exception 'New approved Route Family route must have effective_from'; end if;
  update costing.production_route_family_route set status='SUPERSEDED',effective_to=v_new_from-1,updated_at=now()
  where id=p_old_family_route_id and archived_at is null and status='APPROVED';
  return jsonb_build_object('old_family_route_id',p_old_family_route_id,'new_family_route_id',p_new_family_route_id,'status','SUPERSEDED','already_applied',false);
end
$function$;

-- Patch family-route approval to refuse archived family/route and ignore archived overlaps/predecessors.
create or replace function public.rpc_approve_route_family_route(p_family_route_id bigint,p_approval_reference text)
returns jsonb language plpgsql security definer set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_route costing.production_route_family_route%rowtype;
  v_old costing.production_route_family_route%rowtype;
  v_validation jsonb;
  v_ref text:=nullif(btrim(p_approval_reference),'');
begin
  perform public.require_permission('module:production-route-manager',true);
  if v_ref is null or upper(v_ref) in ('-','—','NA','N/A','AUTO','MIGRATION') then raise exception 'A meaningful approval reference is required'; end if;
  select * into v_route from costing.production_route_family_route where id=p_family_route_id and archived_at is null for update;
  if not found then raise exception 'Route Family route not found or is archived'; end if;
  if v_route.status<>'REVIEW_REQUIRED' then raise exception 'Route Family route must be in review'; end if;
  if v_route.effective_from is null then raise exception 'Route Family route effective_from is required before approval'; end if;
  if not exists(select 1 from costing.production_route_family where id=v_route.route_family_id and archived_at is null and status='APPROVED') then
    raise exception 'Route Family must be active and approved first';
  end if;
  v_validation:=costing.fn_validate_route_family_route(p_family_route_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then raise exception 'Route Family route validation failed: %',v_validation->'errors'; end if;
  if v_route.supersedes_route_id is not null then
    select * into v_old from costing.production_route_family_route
    where id=v_route.supersedes_route_id and archived_at is null for update;
    if not found or v_old.status<>'APPROVED' or v_old.route_family_id<>v_route.route_family_id then
      raise exception 'supersedes_route_id must identify the current active approved route of the same Route Family';
    end if;
    if v_route.effective_from<=v_old.effective_from then raise exception 'Successor route effective_from % must be after prior approved route effective_from %',v_route.effective_from,v_old.effective_from; end if;
    if exists(select 1 from costing.production_route_family_route r
      where r.id not in (p_family_route_id,v_old.id) and r.route_family_id=v_route.route_family_id and r.archived_at is null and r.status='APPROVED'
        and daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]') && daterange(v_route.effective_from,'infinity'::date,'[]')) then
      raise exception 'Another active approved Route Family route overlaps the successor effective period';
    end if;
    update costing.production_route_family_route set status='SUPERSEDED',effective_to=v_route.effective_from-1,updated_at=now()
    where id=v_old.id and archived_at is null;
  else
    if exists(select 1 from costing.production_route_family_route r
      where r.id<>p_family_route_id and r.route_family_id=v_route.route_family_id and r.archived_at is null and r.status='APPROVED'
        and daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]') && daterange(v_route.effective_from,'infinity'::date,'[]')) then
      raise exception 'An active approved Route Family route overlaps the requested effective period; create a successor version linked by supersedes_route_id';
    end if;
  end if;
  update costing.production_route_family_route
  set status='APPROVED',approval_reference=v_ref,approved_by=auth.uid(),approved_at=clock_timestamp(),updated_at=now()
  where id=p_family_route_id and archived_at is null;
  return jsonb_build_object('family_route_id',p_family_route_id,'status','APPROVED','superseded_route_id',v_route.supersedes_route_id,'validation',v_validation);
end
$function$;

revoke all on function public.rpc_approve_route_family(bigint,text,date) from public, anon;
revoke all on function public.rpc_submit_product_route_family_assignment_for_review(bigint) from public, anon;
revoke all on function public.rpc_supersede_product_route(bigint,bigint) from public, anon;
revoke all on function public.rpc_supersede_route_family_route(bigint,bigint) from public, anon;
revoke all on function public.rpc_approve_route_family_route(bigint,text) from public, anon;
grant execute on function public.rpc_approve_route_family(bigint,text,date) to authenticated, service_role;
grant execute on function public.rpc_submit_product_route_family_assignment_for_review(bigint) to authenticated, service_role;
grant execute on function public.rpc_supersede_product_route(bigint,bigint) to authenticated, service_role;
grant execute on function public.rpc_supersede_route_family_route(bigint,bigint) to authenticated, service_role;
grant execute on function public.rpc_approve_route_family_route(bigint,text) to authenticated, service_role;
