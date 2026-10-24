-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.production_route_family_product_map
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by uuid,
  add column if not exists cancelled_at timestamptz;

alter table costing.production_route_family_product_map
  drop constraint if exists production_route_family_product_map_status_check;

alter table costing.production_route_family_product_map
  add constraint production_route_family_product_map_status_check
  check (status = any (array[
    'DRAFT'::text,
    'IN_REVIEW'::text,
    'APPROVED'::text,
    'SUPERSEDED'::text,
    'INACTIVE'::text,
    'CANCELLED'::text
  ]));

alter table costing.production_route_family_product_map
  drop constraint if exists production_route_family_product_map_cancellation_check;

alter table costing.production_route_family_product_map
  add constraint production_route_family_product_map_cancellation_check
  check (
    status <> 'CANCELLED'
    or (
      nullif(btrim(cancellation_reason),'') is not null
      and cancelled_at is not null
    )
  );

create or replace function costing.fn_product_route_family_assignment_guard()
returns trigger
language plpgsql
set search_path to 'costing','public'
as $function$
declare
  v_product_status text;
begin
  if tg_op='DELETE' then
    if old.status in ('APPROVED','INACTIVE','SUPERSEDED','CANCELLED') then
      raise exception 'Governed Product Route Family assignment history is immutable; use a governed lifecycle action instead';
    end if;
    return old;
  end if;

  if new.effective_to is not null and new.effective_to < new.effective_from then
    raise exception 'Assignment effective-to cannot precede effective-from';
  end if;

  select upper(coalesce(p.status,'')) into v_product_status
  from public.products p where p.id=new.product_id;
  if v_product_status is distinct from 'ACTIVE' then
    raise exception 'Product % must be ACTIVE for Route Family assignment',new.product_id;
  end if;

  if new.status='CANCELLED' then
    if tg_op <> 'UPDATE' or old.status not in ('DRAFT','IN_REVIEW') then
      raise exception 'Only Draft or In-Review Product Route Family assignments may be cancelled';
    end if;
    if nullif(btrim(new.cancellation_reason),'') is null or new.cancelled_at is null then
      raise exception 'Cancelled Product assignment requires a meaningful cancellation reason and timestamp';
    end if;
    if (to_jsonb(old)-array['status','cancellation_reason','cancelled_by','cancelled_at','updated_at'])
       is distinct from
       (to_jsonb(new)-array['status','cancellation_reason','cancelled_by','cancelled_at','updated_at']) then
      raise exception 'Cancellation may not alter the Product assignment definition';
    end if;
  end if;

  if new.status='APPROVED' then
    if not exists(
      select 1 from costing.production_route_family f
      where f.id=new.route_family_id and f.status='APPROVED'
        and f.effective_from<=new.effective_from
        and (f.effective_to is null or f.effective_to>=new.effective_from)
    ) then
      raise exception 'Route Family % must be approved and effective for assignment',new.route_family_id;
    end if;
    if nullif(btrim(new.approval_reference),'') is null or new.approved_at is null then
      raise exception 'Approved Product assignment requires approval reference and timestamp';
    end if;
    if exists(
      select 1
      from costing.production_route_family_product_map x
      where x.id<>coalesce(new.id,0)
        and x.product_id=new.product_id
        and x.status='APPROVED'
        and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]')
            && daterange(new.effective_from,coalesce(new.effective_to,'infinity'::date),'[]')
    ) then
      raise exception 'Product % already has an overlapping approved Route Family assignment',new.product_id;
    end if;
  end if;

  if tg_op='UPDATE' and old.status='APPROVED' then
    if new.status not in ('APPROVED','SUPERSEDED','INACTIVE') then
      raise exception 'Approved Product assignment may only remain approved or become superseded/inactive';
    end if;
    if (to_jsonb(old)-array['status','effective_to','updated_at'])
       is distinct from
       (to_jsonb(new)-array['status','effective_to','updated_at']) then
      raise exception 'Approved Product assignment definition is immutable';
    end if;
  end if;

  if tg_op='UPDATE' and old.status in ('INACTIVE','SUPERSEDED','CANCELLED') then
    if to_jsonb(old) is distinct from to_jsonb(new) then
      raise exception 'Terminal Product assignment history is immutable';
    end if;
  end if;

  return new;
end
$function$;

create or replace function public.rpc_cancel_product_route_family_assignment(
  p_assignment_id bigint,
  p_cancellation_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_assignment costing.production_route_family_product_map%rowtype;
begin
  perform public.require_permission('module:production-route-manager',true);

  if p_assignment_id is null or p_assignment_id <= 0 then
    raise exception 'A valid assignment ID is required';
  end if;

  if nullif(btrim(p_cancellation_reason),'') is null
     or upper(btrim(p_cancellation_reason)) in ('-','—','NA','N/A') then
    raise exception 'A meaningful cancellation reason is required';
  end if;

  update costing.production_route_family_product_map a
  set status='CANCELLED',
      cancellation_reason=btrim(p_cancellation_reason),
      cancelled_by=auth.uid(),
      cancelled_at=now(),
      updated_at=now()
  where a.id=p_assignment_id
    and a.status in ('DRAFT','IN_REVIEW')
  returning a.* into v_assignment;

  if not found then
    if exists (
      select 1 from costing.production_route_family_product_map where id=p_assignment_id
    ) then
      raise exception 'Only Draft or In-Review Product Route Family assignments may be cancelled';
    end if;
    raise exception 'Product Route Family assignment % not found',p_assignment_id;
  end if;

  return jsonb_build_object(
    'assignment_id',v_assignment.id,
    'product_id',v_assignment.product_id,
    'route_family_id',v_assignment.route_family_id,
    'status',v_assignment.status,
    'cancellation_reason',v_assignment.cancellation_reason,
    'cancelled_at',v_assignment.cancelled_at
  );
end
$function$;

revoke all on function public.rpc_cancel_product_route_family_assignment(bigint,text) from public;
revoke all on function public.rpc_cancel_product_route_family_assignment(bigint,text) from anon;
grant execute on function public.rpc_cancel_product_route_family_assignment(bigint,text) to authenticated;

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
set search_path to 'public','costing','pg_temp'
as $function$
declare
    v_limit integer := greatest(1, least(coalesce(p_limit,100),500));
    v_offset integer := greatest(coalesce(p_offset,0),0);
    v_status text := nullif(upper(btrim(p_status)),'');
    v_result jsonb;
begin
    perform public.require_permission('module:production-route-manager',false);

    if v_status is not null
       and v_status not in ('DRAFT','IN_REVIEW','APPROVED','INACTIVE','SUPERSEDED','CANCELLED') then
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
            a.cancellation_reason,
            a.cancelled_by,
            a.cancelled_at,
            a.created_by,
            a.created_at,
            a.updated_at,
            case
                when a.status='DRAFT' then jsonb_build_array('SUBMIT_FOR_REVIEW','CANCEL')
                when a.status='IN_REVIEW' then jsonb_build_array('APPROVE','CANCEL')
                when a.status='APPROVED' then jsonb_build_array('INACTIVATE')
                else '[]'::jsonb
            end as lifecycle_actions,
            true as definition_read_only,
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
        select * from assignment_rows where v_status is null or status=v_status
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
                when 'CANCELLED' then 6
                else 7
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
            from (select status,count(*) cnt from assignment_rows group by status) s
        ),'{}'::jsonb),
        'rows',coalesce((select jsonb_agg(to_jsonb(page) order by
            case status
                when 'DRAFT' then 1
                when 'IN_REVIEW' then 2
                when 'APPROVED' then 3
                when 'INACTIVE' then 4
                when 'SUPERSEDED' then 5
                when 'CANCELLED' then 6
                else 7
            end,
            category_name,subcategory_name,product_group_name,product_name,
            effective_from desc,assignment_id desc
        ) from page),'[]'::jsonb)
    ) into v_result;

    return v_result;
end
$function$;

revoke all on function public.rpc_get_production_route_manager_product_assignments(text,text,bigint,integer,integer,integer,integer) from public;
revoke all on function public.rpc_get_production_route_manager_product_assignments(text,text,bigint,integer,integer,integer,integer) from anon;
grant execute on function public.rpc_get_production_route_manager_product_assignments(text,text,bigint,integer,integer,integer,integer) to authenticated;