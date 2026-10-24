-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_production_route_manager_product_assignments(
    p_status text default null,
    p_search text default null,
    p_route_family_id bigint default null,
    p_product_group_id integer default null,
    p_product_id integer default null,
    p_limit integer default 100,
    p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $function$
declare
    v_limit integer := greatest(1, least(coalesce(p_limit,100),500));
    v_offset integer := greatest(coalesce(p_offset,0),0);
    v_status text := nullif(upper(btrim(p_status)),'');
    v_result jsonb;
begin
    perform public.require_permission('module:production-route-manager',false);

    if v_status is not null
       and v_status not in ('DRAFT','IN_REVIEW','APPROVED','INACTIVE','SUPERSEDED') then
        raise exception 'Invalid assignment status %', p_status;
    end if;

    with assignment_rows as materialized (
        select
            a.id as assignment_id,
            a.status,
            a.product_id,
            p.item as product_name,
            p.status as product_status,
            p.uom_base as product_base_uom,
            c.id as category_id,
            c.category_name,
            sc.id as sub_category_id,
            sc.subcategory_name,
            pg.id as product_group_id,
            pg.group_name as product_group_name,
            a.route_family_id,
            rf.family_code as route_family_code,
            rf.family_name as route_family_name,
            rf.status as route_family_status,
            a.assignment_basis,
            a.assignment_note,
            a.effective_from,
            a.effective_to,
            a.approval_reference,
            a.approved_by,
            a.approved_at,
            a.supersedes_assignment_id,
            a.created_by,
            a.created_at,
            a.updated_at,
            case
                when a.status='DRAFT' then jsonb_build_array('SUBMIT_FOR_REVIEW')
                when a.status='IN_REVIEW' then jsonb_build_array('APPROVE')
                when a.status='APPROVED' then jsonb_build_array('INACTIVATE')
                else '[]'::jsonb
            end as lifecycle_actions,
            case
                when a.status in ('DRAFT','IN_REVIEW') then false
                else true
            end as definition_read_only,
            exists (
                select 1
                from costing.production_route_family_product_map x
                where x.id<>a.id
                  and x.product_id=a.product_id
                  and x.status in ('DRAFT','IN_REVIEW','APPROVED')
                  and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]')
                      && daterange(a.effective_from,coalesce(a.effective_to,'infinity'::date),'[]')
            ) as has_active_or_pending_overlap,
            coalesce((
                select jsonb_agg(jsonb_build_object(
                    'assignment_id',x.id,
                    'status',x.status,
                    'route_family_id',x.route_family_id,
                    'effective_from',x.effective_from,
                    'effective_to',x.effective_to
                ) order by x.effective_from,x.id)
                from costing.production_route_family_product_map x
                where x.id<>a.id
                  and x.product_id=a.product_id
                  and x.status in ('DRAFT','IN_REVIEW','APPROVED')
                  and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]')
                      && daterange(a.effective_from,coalesce(a.effective_to,'infinity'::date),'[]')
            ),'[]'::jsonb) as overlap_evidence,
            costing.fn_validate_effective_product_process_route(
                a.product_id,
                case
                    when a.effective_to is not null then least(current_date,a.effective_to)
                    else greatest(a.effective_from,current_date)
                end
            ) as current_effective_route_validation
        from costing.production_route_family_product_map a
        join public.products p on p.id=a.product_id
        join public.sub_groups sg on sg.id=p.sub_group_id
        join public.product_groups pg on pg.id=sg.product_group_id
        join public.sub_categories sc on sc.id=pg.sub_category_id
        join public.categories c on c.id=sc.category_id
        join costing.production_route_family rf on rf.id=a.route_family_id
        where (p_route_family_id is null or a.route_family_id=p_route_family_id)
          and (p_product_group_id is null or pg.id=p_product_group_id)
          and (p_product_id is null or a.product_id=p_product_id)
          and (
              nullif(btrim(p_search),'') is null
              or p.item ilike '%'||btrim(p_search)||'%'
              or pg.group_name ilike '%'||btrim(p_search)||'%'
              or rf.family_name ilike '%'||btrim(p_search)||'%'
              or c.category_name ilike '%'||btrim(p_search)||'%'
              or sc.subcategory_name ilike '%'||btrim(p_search)||'%'
              or a.product_id::text=btrim(p_search)
              or a.id::text=btrim(p_search)
          )
    ), filtered as (
        select *
        from assignment_rows
        where v_status is null or status=v_status
    ), page as (
        select *
        from filtered
        order by
            case status
                when 'DRAFT' then 1
                when 'IN_REVIEW' then 2
                when 'APPROVED' then 3
                when 'INACTIVE' then 4
                when 'SUPERSEDED' then 5
                else 6
            end,
            category_name,subcategory_name,product_group_name,product_name,
            effective_from desc,assignment_id desc
        limit v_limit offset v_offset
    )
    select jsonb_build_object(
        'status_filter',v_status,
        'product_id_filter',p_product_id,
        'total_count',(select count(*) from filtered),
        'limit',v_limit,
        'offset',v_offset,
        'status_counts',coalesce((
            select jsonb_object_agg(status,cnt order by status)
            from (
                select status,count(*) cnt
                from assignment_rows
                group by status
            ) s
        ),'{}'::jsonb),
        'rows',coalesce((select jsonb_agg(to_jsonb(page) order by
            case status
                when 'DRAFT' then 1
                when 'IN_REVIEW' then 2
                when 'APPROVED' then 3
                when 'INACTIVE' then 4
                when 'SUPERSEDED' then 5
                else 6
            end,
            category_name,subcategory_name,product_group_name,product_name,
            effective_from desc,assignment_id desc
        ) from page),'[]'::jsonb)
    ) into v_result;

    return v_result;
end;
$function$;

revoke all on function public.rpc_get_production_route_manager_product_assignments(text,text,bigint,integer,integer,integer,integer) from public;
revoke all on function public.rpc_get_production_route_manager_product_assignments(text,text,bigint,integer,integer,integer,integer) from anon;
grant execute on function public.rpc_get_production_route_manager_product_assignments(text,text,bigint,integer,integer,integer,integer) to authenticated;

comment on function public.rpc_get_production_route_manager_product_assignments(text,text,bigint,integer,integer,integer,integer)
is 'Governed paginated Product-to-Route-Family assignment lifecycle read contract for Production Route Manager. Supports Product-scoped detail and cross-Product queues; no direct table access is exposed.';