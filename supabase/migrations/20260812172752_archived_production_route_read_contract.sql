-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Gate 11Y.10I.2C.3F.1B.3
-- Read-only Archived Routes contract for the future client archive tab.

create or replace function public.rpc_get_archived_production_route_architecture(
  p_search text default null,
  p_entity_type text default null,
  p_limit integer default 100,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_limit integer:=greatest(1,least(coalesce(p_limit,100),500));
  v_offset integer:=greatest(coalesce(p_offset,0),0);
  v_entity_type text:=nullif(upper(btrim(p_entity_type)),'');
  v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager',false);
  if v_entity_type is not null and v_entity_type not in(
    'ROUTE_FAMILY','FAMILY_ROUTE','PRODUCT_GROUP_MAPPING','PRODUCT_SUBGROUP_MAPPING','PRODUCT_MAPPING','PRODUCT_ROUTE'
  ) then raise exception 'Invalid archived route entity type %',p_entity_type; end if;

  with archived_rows as materialized (
    select 'ROUTE_FAMILY'::text entity_type,f.id entity_id,null::bigint parent_id,
           f.family_code entity_code,f.family_name entity_name,f.status,f.effective_from,f.effective_to,
           f.approval_reference,f.approved_at,f.archived_at,f.archived_by,f.archive_reason,
           jsonb_build_object('description',f.description,'supersedes_family_id',f.supersedes_family_id) detail
    from costing.production_route_family f where f.archived_at is not null

    union all

    select 'FAMILY_ROUTE',r.id,r.route_family_id,r.route_code,r.route_name,r.status,r.effective_from,r.effective_to,
           r.approval_reference,r.approved_at,r.archived_at,r.archived_by,r.archive_reason,
           jsonb_build_object('route_version',r.route_version,'source_type',r.source_type,'evidence_status',r.evidence_status,
                              'supersedes_route_id',r.supersedes_route_id,
                              'route_family_code',f.family_code,'route_family_name',f.family_name,
                              'step_count',(select count(*) from costing.production_route_family_route_step s where s.family_route_id=r.id))
    from costing.production_route_family_route r
    join costing.production_route_family f on f.id=r.route_family_id
    where r.archived_at is not null

    union all

    select 'PRODUCT_GROUP_MAPPING',m.id,m.route_family_id,null::text,pg.group_name,m.status,m.effective_from,m.effective_to,
           m.approval_reference,m.approved_at,m.archived_at,m.archived_by,m.archive_reason,
           jsonb_build_object('product_group_id',m.product_group_id,'route_family_id',m.route_family_id,
                              'route_family_code',f.family_code,'route_family_name',f.family_name,
                              'mapping_basis',m.mapping_basis,'mapping_note',m.mapping_note,'supersedes_mapping_id',m.supersedes_mapping_id)
    from costing.production_route_family_product_group_map m
    join public.product_groups pg on pg.id=m.product_group_id
    join costing.production_route_family f on f.id=m.route_family_id
    where m.archived_at is not null

    union all

    select 'PRODUCT_SUBGROUP_MAPPING',m.id,m.route_family_id,null::text,sg.sub_group_name,m.status,m.effective_from,m.effective_to,
           m.approval_reference,m.approved_at,m.archived_at,m.archived_by,m.archive_reason,
           jsonb_build_object('product_subgroup_id',m.product_subgroup_id,'product_group_id',sg.product_group_id,
                              'route_family_id',m.route_family_id,'route_family_code',f.family_code,'route_family_name',f.family_name,
                              'mapping_basis',m.mapping_basis,'mapping_note',m.mapping_note,'supersedes_mapping_id',m.supersedes_mapping_id)
    from costing.production_route_family_product_subgroup_map m
    join public.sub_groups sg on sg.id=m.product_subgroup_id
    join costing.production_route_family f on f.id=m.route_family_id
    where m.archived_at is not null

    union all

    select 'PRODUCT_MAPPING',m.id,m.route_family_id,null::text,p.item,m.status,m.effective_from,m.effective_to,
           m.approval_reference,m.approved_at,m.archived_at,m.archived_by,m.archive_reason,
           jsonb_build_object('product_id',m.product_id,'route_family_id',m.route_family_id,
                              'route_family_code',f.family_code,'route_family_name',f.family_name,
                              'assignment_basis',m.assignment_basis,'assignment_note',m.assignment_note,
                              'supersedes_assignment_id',m.supersedes_assignment_id,
                              'cancellation_reason',m.cancellation_reason,'cancelled_at',m.cancelled_at)
    from costing.production_route_family_product_map m
    join public.products p on p.id=m.product_id
    join costing.production_route_family f on f.id=m.route_family_id
    where m.archived_at is not null

    union all

    select 'PRODUCT_ROUTE',r.id,r.base_route_family_route_id,r.route_code,p.item,r.status,r.effective_from,r.effective_to,
           r.approval_reference,r.approved_at,r.archived_at,r.archived_by,r.archive_reason,
           jsonb_build_object('product_id',r.product_id,'product_name',p.item,'route_version',r.route_version,
                              'base_route_family_route_id',r.base_route_family_route_id,
                              'base_route_family_id',fr.route_family_id,'base_family_route_version',fr.route_version,
                              'source_type',r.source_type,'evidence_status',r.evidence_status,'batch_size_ref_id',r.batch_size_ref_id,
                              'supersedes_route_id',r.supersedes_route_id,
                              'override_count',(select count(*) from costing.product_process_route_override o where o.product_route_id=r.id))
    from costing.product_process_route r
    join public.products p on p.id=r.product_id
    join costing.production_route_family_route fr on fr.id=r.base_route_family_route_id
    where r.archived_at is not null
  ), filtered as materialized (
    select * from archived_rows a
    where (v_entity_type is null or a.entity_type=v_entity_type)
      and (nullif(btrim(p_search),'') is null
           or coalesce(a.entity_name,'') ilike '%'||btrim(p_search)||'%'
           or coalesce(a.entity_code,'') ilike '%'||btrim(p_search)||'%'
           or coalesce(a.approval_reference,'') ilike '%'||btrim(p_search)||'%'
           or coalesce(a.archive_reason,'') ilike '%'||btrim(p_search)||'%'
           or a.entity_id::text=btrim(p_search))
  ), page as (
    select * from filtered
    order by archived_at desc,entity_type,entity_name,entity_id
    limit v_limit offset v_offset
  ), type_counts as (
    select entity_type,count(*)::integer count from archived_rows group by entity_type
  )
  select jsonb_build_object(
    'read_only',true,
    'total_count',(select count(*) from filtered),
    'limit',v_limit,'offset',v_offset,
    'entity_type_filter',v_entity_type,
    'type_counts',coalesce((select jsonb_agg(to_jsonb(t) order by t.entity_type) from type_counts t),'[]'::jsonb),
    'rows',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('read_only',true) order by p.archived_at desc,p.entity_type,p.entity_name,p.entity_id) from page p),'[]'::jsonb)
  ) into v_result;
  return v_result;
end
$function$;

revoke all on function public.rpc_get_archived_production_route_architecture(text,text,integer,integer) from public,anon;
grant execute on function public.rpc_get_archived_production_route_architecture(text,text,integer,integer) to authenticated;