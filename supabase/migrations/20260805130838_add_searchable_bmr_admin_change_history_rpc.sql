-- backfilled from live schema_migrations on 2026-10-24, CI-016
create index if not exists ix_bmr_admin_correction_executed_at
  on public.bmr_administrative_corrections (executed_at desc, id desc);

create index if not exists ix_bmr_admin_correction_operation
  on public.bmr_administrative_corrections (operation_type, executed_at desc);

create index if not exists ix_bmr_admin_correction_result
  on public.bmr_administrative_corrections (operation_result, executed_at desc);

create index if not exists ix_bmr_admin_correction_executed_by
  on public.bmr_administrative_corrections (executed_by, executed_at desc);

create or replace function public.rpc_search_bmr_admin_correction_history(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_operation_type text default null,
  p_operation_result text default null,
  p_product_id bigint default null,
  p_executed_by uuid default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_operation_type text := nullif(upper(btrim(coalesce(p_operation_type, ''))), '');
  v_operation_result text := nullif(upper(btrim(coalesce(p_operation_result, ''))), '');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Not authenticated';
  end if;

  perform public.require_permission('module:manage-bmr', false);

  if p_date_from is not null and p_date_to is not null and p_date_from > p_date_to then
    raise exception using errcode='23514', message='date_from cannot be after date_to';
  end if;

  v_offset := (v_page - 1) * v_page_size;

  with filtered as (
    select
      c.id,
      c.correction_no,
      c.operation_type,
      c.operation_result,
      c.status,
      c.batch_plan_batch_id,
      c.batch_plan_header_id,
      c.product_id,
      p.item as product_name,
      c.old_bmr_id,
      c.new_bmr_id,
      c.old_bn,
      c.new_bn,
      c.old_bmr_batch_size,
      c.new_bmr_batch_size,
      c.planned_batch_size,
      c.uom,
      c.reason,
      c.supporting_reference,
      c.impact_acknowledged,
      c.requested_by,
      c.requested_at,
      c.executed_by,
      hp.full_name as executed_by_name,
      c.executed_at,
      c.before_snapshot,
      c.after_snapshot,
      c.validation_snapshot
    from public.bmr_administrative_corrections c
    left join public.products p on p.id = c.product_id
    left join public.hub_profiles hp on hp.user_id = c.executed_by
    where (p_date_from is null or c.executed_at >= p_date_from::timestamptz)
      and (p_date_to is null or c.executed_at < (p_date_to + 1)::timestamptz)
      and (v_operation_type is null or c.operation_type = v_operation_type)
      and (v_operation_result is null or c.operation_result = v_operation_result)
      and (p_product_id is null or c.product_id = p_product_id)
      and (p_executed_by is null or c.executed_by = p_executed_by)
      and (
        v_search is null
        or c.correction_no ilike '%' || v_search || '%'
        or coalesce(p.item, '') ilike '%' || v_search || '%'
        or coalesce(c.old_bn, '') ilike '%' || v_search || '%'
        or coalesce(c.new_bn, '') ilike '%' || v_search || '%'
        or coalesce(c.reason, '') ilike '%' || v_search || '%'
        or coalesce(c.supporting_reference, '') ilike '%' || v_search || '%'
        or coalesce(hp.full_name, '') ilike '%' || v_search || '%'
        or c.batch_plan_batch_id::text = v_search
        or c.batch_plan_header_id::text = v_search
      )
  )
  select count(*) into v_total from filtered;

  with filtered as (
    select
      c.id,
      c.correction_no,
      c.operation_type,
      c.operation_result,
      c.status,
      c.batch_plan_batch_id,
      c.batch_plan_header_id,
      c.product_id,
      p.item as product_name,
      c.old_bmr_id,
      c.new_bmr_id,
      c.old_bn,
      c.new_bn,
      c.old_bmr_batch_size,
      c.new_bmr_batch_size,
      c.planned_batch_size,
      c.uom,
      c.reason,
      c.supporting_reference,
      c.impact_acknowledged,
      c.requested_by,
      c.requested_at,
      c.executed_by,
      hp.full_name as executed_by_name,
      c.executed_at,
      c.before_snapshot,
      c.after_snapshot,
      c.validation_snapshot
    from public.bmr_administrative_corrections c
    left join public.products p on p.id = c.product_id
    left join public.hub_profiles hp on hp.user_id = c.executed_by
    where (p_date_from is null or c.executed_at >= p_date_from::timestamptz)
      and (p_date_to is null or c.executed_at < (p_date_to + 1)::timestamptz)
      and (v_operation_type is null or c.operation_type = v_operation_type)
      and (v_operation_result is null or c.operation_result = v_operation_result)
      and (p_product_id is null or c.product_id = p_product_id)
      and (p_executed_by is null or c.executed_by = p_executed_by)
      and (
        v_search is null
        or c.correction_no ilike '%' || v_search || '%'
        or coalesce(p.item, '') ilike '%' || v_search || '%'
        or coalesce(c.old_bn, '') ilike '%' || v_search || '%'
        or coalesce(c.new_bn, '') ilike '%' || v_search || '%'
        or coalesce(c.reason, '') ilike '%' || v_search || '%'
        or coalesce(c.supporting_reference, '') ilike '%' || v_search || '%'
        or coalesce(hp.full_name, '') ilike '%' || v_search || '%'
        or c.batch_plan_batch_id::text = v_search
        or c.batch_plan_header_id::text = v_search
      )
    order by c.executed_at desc, c.id desc
    limit v_page_size offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(filtered) order by executed_at desc, id desc), '[]'::jsonb)
  into v_rows
  from filtered;

  return jsonb_build_object(
    'rows', v_rows,
    'total_count', v_total,
    'page', v_page,
    'page_size', v_page_size,
    'total_pages', case when v_total = 0 then 0 else ceil(v_total::numeric / v_page_size)::integer end,
    'sort', jsonb_build_object('executed_at', 'desc', 'id', 'desc'),
    'filters', jsonb_build_object(
      'search', v_search,
      'date_from', p_date_from,
      'date_to', p_date_to,
      'operation_type', v_operation_type,
      'operation_result', v_operation_result,
      'product_id', p_product_id,
      'executed_by', p_executed_by
    )
  );
end;
$function$;

revoke all on function public.rpc_search_bmr_admin_correction_history(text,date,date,text,text,bigint,uuid,integer,integer) from public;
revoke all on function public.rpc_search_bmr_admin_correction_history(text,date,date,text,text,bigint,uuid,integer,integer) from anon;
grant execute on function public.rpc_search_bmr_admin_correction_history(text,date,date,text,text,bigint,uuid,integer,integer) to authenticated;
grant execute on function public.rpc_search_bmr_admin_correction_history(text,date,date,text,text,bigint,uuid,integer,integer) to service_role;

comment on function public.rpc_search_bmr_admin_correction_history(text,date,date,text,text,bigint,uuid,integer,integer)
is 'Searchable, filterable and paginated Manager BMR administrative correction register. Newest corrections first.';