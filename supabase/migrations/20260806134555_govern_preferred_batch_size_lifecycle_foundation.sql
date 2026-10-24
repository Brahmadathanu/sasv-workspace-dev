-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter table public.production_batch_size_ref
  add column if not exists effective_to date,
  add column if not exists change_reason text,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists inactivated_by uuid,
  add column if not exists inactivated_at timestamptz,
  add column if not exists supersedes_reference_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.production_batch_size_ref'::regclass
      and conname = 'production_batch_size_ref_supersedes_reference_id_fkey'
  ) then
    alter table public.production_batch_size_ref
      add constraint production_batch_size_ref_supersedes_reference_id_fkey
      foreign key (supersedes_reference_id)
      references public.production_batch_size_ref(id)
      on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.production_batch_size_ref'::regclass
      and conname = 'production_batch_size_ref_range_order_check'
  ) then
    alter table public.production_batch_size_ref
      add constraint production_batch_size_ref_range_order_check
      check (
        (min_batch_size is null or min_batch_size <= preferred_batch_size)
        and (max_batch_size is null or preferred_batch_size <= max_batch_size)
        and (min_batch_size is null or max_batch_size is null or min_batch_size <= max_batch_size)
      ) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.production_batch_size_ref'::regclass
      and conname = 'production_batch_size_ref_effective_range_check'
  ) then
    alter table public.production_batch_size_ref
      add constraint production_batch_size_ref_effective_range_check
      check (effective_to is null or effective_to >= effective_from) not valid;
  end if;
end $$;

create index if not exists ix_pbsr_supersedes_reference
  on public.production_batch_size_ref(supersedes_reference_id)
  where supersedes_reference_id is not null;

create index if not exists ix_pbsr_product_history
  on public.production_batch_size_ref(product_id, effective_from desc, id desc);

create or replace function public.rpc_get_supply_batch_size_references(
  p_product_id bigint default null,
  p_search text default null,
  p_state text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit,100),500));
  v_offset integer := greatest(coalesce(p_offset,0),0);
  v_state text := coalesce(nullif(upper(btrim(p_state)),''),'ALL');
  v_result jsonb;
begin
  perform public.require_permission('module:supply-batch-plan', false);

  if v_state not in ('ALL','ACTIVE','INACTIVE','MISSING') then
    raise exception 'Invalid batch-size reference state %', p_state;
  end if;

  with product_scope as materialized (
    select
      p.id as product_id,
      p.item as product_name,
      p.status as product_status,
      p.uom_base as product_base_uom,
      c.id as category_id,
      c.category_name,
      sc.id as sub_category_id,
      sc.subcategory_name,
      pg.id as product_group_id,
      pg.group_name as product_group_name
    from public.products p
    join public.sub_groups sg on sg.id = p.sub_group_id
    join public.product_groups pg on pg.id = sg.product_group_id
    join public.sub_categories sc on sc.id = pg.sub_category_id
    join public.categories c on c.id = sc.category_id
    where (p_product_id is null or p.id = p_product_id)
      and (
        nullif(btrim(p_search),'') is null
        or p.item ilike '%'||btrim(p_search)||'%'
        or p.id::text = btrim(p_search)
        or pg.group_name ilike '%'||btrim(p_search)||'%'
        or sc.subcategory_name ilike '%'||btrim(p_search)||'%'
        or c.category_name ilike '%'||btrim(p_search)||'%'
      )
  ), ref_rows as materialized (
    select
      r.id as reference_id,
      ps.product_id,
      ps.product_name,
      ps.product_status,
      ps.product_base_uom,
      ps.category_id,
      ps.category_name,
      ps.sub_category_id,
      ps.subcategory_name,
      ps.product_group_id,
      ps.product_group_name,
      r.preferred_batch_size,
      r.min_batch_size,
      r.max_batch_size,
      r.effective_from,
      r.effective_to,
      r.is_active,
      case when r.is_active then 'ACTIVE' else 'INACTIVE' end as reference_state,
      r.notes,
      r.change_reason,
      r.created_at,
      r.updated_at,
      r.created_by,
      r.updated_by,
      r.inactivated_by,
      r.inactivated_at,
      r.supersedes_reference_id,
      case
        when r.min_batch_size is not null and r.min_batch_size > r.preferred_batch_size then false
        when r.max_batch_size is not null and r.preferred_batch_size > r.max_batch_size then false
        when r.min_batch_size is not null and r.max_batch_size is not null and r.min_batch_size > r.max_batch_size then false
        else true
      end as range_valid
    from product_scope ps
    join public.production_batch_size_ref r on r.product_id = ps.product_id
  ), missing_rows as materialized (
    select
      null::bigint as reference_id,
      ps.product_id,
      ps.product_name,
      ps.product_status,
      ps.product_base_uom,
      ps.category_id,
      ps.category_name,
      ps.sub_category_id,
      ps.subcategory_name,
      ps.product_group_id,
      ps.product_group_name,
      null::numeric as preferred_batch_size,
      null::numeric as min_batch_size,
      null::numeric as max_batch_size,
      null::date as effective_from,
      null::date as effective_to,
      false as is_active,
      'MISSING'::text as reference_state,
      null::text as notes,
      null::text as change_reason,
      null::timestamptz as created_at,
      null::timestamptz as updated_at,
      null::uuid as created_by,
      null::uuid as updated_by,
      null::uuid as inactivated_by,
      null::timestamptz as inactivated_at,
      null::bigint as supersedes_reference_id,
      null::boolean as range_valid
    from product_scope ps
    where upper(coalesce(ps.product_status,'')) = 'ACTIVE'
      and not exists (
        select 1
        from public.production_batch_size_ref r
        where r.product_id = ps.product_id
          and r.is_active = true
      )
  ), all_rows as materialized (
    select * from ref_rows
    union all
    select * from missing_rows
  ), filtered as materialized (
    select *
    from all_rows x
    where v_state = 'ALL'
       or x.reference_state = v_state
  ), page as materialized (
    select *
    from filtered
    order by category_name, subcategory_name, product_group_name, product_name, product_id,
             effective_from desc nulls last, reference_id desc nulls last
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total_count', (select count(*) from filtered),
    'limit', v_limit,
    'offset', v_offset,
    'state', v_state,
    'status_counts', jsonb_build_object(
      'ACTIVE', (select count(*) from all_rows where reference_state='ACTIVE'),
      'INACTIVE', (select count(*) from all_rows where reference_state='INACTIVE'),
      'MISSING', (select count(*) from all_rows where reference_state='MISSING')
    ),
    'invalid_range_count', (select count(*) from ref_rows where range_valid=false),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(page) order by category_name, subcategory_name, product_group_name, product_name, product_id,
                       effective_from desc nulls last, reference_id desc nulls last)
      from page
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.rpc_create_supply_batch_size_reference(
  p_product_id bigint,
  p_preferred_batch_size numeric,
  p_min_batch_size numeric default null,
  p_max_batch_size numeric default null,
  p_effective_from date default current_date,
  p_change_reason text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_product_name text;
  v_effective_from date := coalesce(p_effective_from,current_date);
  v_reason text := nullif(btrim(p_change_reason),'');
begin
  perform public.require_permission('module:supply-batch-plan', true);

  if p_product_id is null then raise exception 'Product is required'; end if;
  if p_preferred_batch_size is null or p_preferred_batch_size <= 0 then raise exception 'Preferred batch size must be positive'; end if;
  if p_min_batch_size is not null and p_min_batch_size <= 0 then raise exception 'Minimum batch size must be positive'; end if;
  if p_max_batch_size is not null and p_max_batch_size <= 0 then raise exception 'Maximum batch size must be positive'; end if;
  if p_min_batch_size is not null and p_min_batch_size > p_preferred_batch_size then raise exception 'Minimum batch size cannot exceed preferred batch size'; end if;
  if p_max_batch_size is not null and p_preferred_batch_size > p_max_batch_size then raise exception 'Preferred batch size cannot exceed maximum batch size'; end if;
  if p_min_batch_size is not null and p_max_batch_size is not null and p_min_batch_size > p_max_batch_size then raise exception 'Minimum batch size cannot exceed maximum batch size'; end if;
  if v_effective_from > current_date then raise exception 'Future-dated batch-size references are not supported in the current lifecycle'; end if;
  if v_reason is null or length(v_reason) < 5 or upper(v_reason) in ('N/A','NA','NONE','-','—') then raise exception 'A meaningful change reason is required'; end if;

  select p.item into v_product_name
  from public.products p
  where p.id = p_product_id
    and upper(coalesce(p.status,'')) = 'ACTIVE';
  if not found then raise exception 'Active Product % not found', p_product_id; end if;

  perform 1
  from public.production_batch_size_ref r
  where r.product_id = p_product_id
    and r.is_active = true
  for update;
  if found then raise exception 'Product % already has an active batch-size reference; revise it instead', p_product_id using errcode='23505'; end if;

  insert into public.production_batch_size_ref(
    product_id, preferred_batch_size, min_batch_size, max_batch_size,
    effective_from, effective_to, is_active, notes, change_reason,
    created_by, updated_by, created_at, updated_at
  ) values (
    p_product_id, p_preferred_batch_size, p_min_batch_size, p_max_batch_size,
    v_effective_from, null, true, nullif(btrim(p_notes),''), v_reason,
    auth.uid(), auth.uid(), now(), now()
  ) returning id into v_id;

  return jsonb_build_object(
    'reference_id',v_id,
    'product_id',p_product_id,
    'product_name',v_product_name,
    'status','ACTIVE',
    'effective_from',v_effective_from,
    'preferred_batch_size',p_preferred_batch_size,
    'min_batch_size',p_min_batch_size,
    'max_batch_size',p_max_batch_size
  );
end;
$$;

create or replace function public.rpc_revise_supply_batch_size_reference(
  p_reference_id bigint,
  p_preferred_batch_size numeric,
  p_min_batch_size numeric default null,
  p_max_batch_size numeric default null,
  p_effective_from date default current_date,
  p_change_reason text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current public.production_batch_size_ref%rowtype;
  v_new_id bigint;
  v_effective_from date := coalesce(p_effective_from,current_date);
  v_reason text := nullif(btrim(p_change_reason),'');
begin
  perform public.require_permission('module:supply-batch-plan', true);

  if p_reference_id is null then raise exception 'Reference ID is required'; end if;
  if p_preferred_batch_size is null or p_preferred_batch_size <= 0 then raise exception 'Preferred batch size must be positive'; end if;
  if p_min_batch_size is not null and p_min_batch_size <= 0 then raise exception 'Minimum batch size must be positive'; end if;
  if p_max_batch_size is not null and p_max_batch_size <= 0 then raise exception 'Maximum batch size must be positive'; end if;
  if p_min_batch_size is not null and p_min_batch_size > p_preferred_batch_size then raise exception 'Minimum batch size cannot exceed preferred batch size'; end if;
  if p_max_batch_size is not null and p_preferred_batch_size > p_max_batch_size then raise exception 'Preferred batch size cannot exceed maximum batch size'; end if;
  if p_min_batch_size is not null and p_max_batch_size is not null and p_min_batch_size > p_max_batch_size then raise exception 'Minimum batch size cannot exceed maximum batch size'; end if;
  if v_effective_from > current_date then raise exception 'Future-dated batch-size revisions are not supported in the current lifecycle'; end if;
  if v_reason is null or length(v_reason) < 5 or upper(v_reason) in ('N/A','NA','NONE','-','—') then raise exception 'A meaningful change reason is required'; end if;

  select * into v_current
  from public.production_batch_size_ref r
  where r.id = p_reference_id
  for update;
  if not found then raise exception 'Batch-size reference % not found', p_reference_id; end if;
  if not v_current.is_active then raise exception 'Only an active batch-size reference may be revised'; end if;
  if v_effective_from <= v_current.effective_from then
    raise exception 'Revision effective date % must be later than current effective date %',v_effective_from,v_current.effective_from;
  end if;

  update public.production_batch_size_ref
  set is_active=false,
      effective_to=v_effective_from-1,
      change_reason=coalesce(change_reason,v_reason),
      updated_by=auth.uid(),
      updated_at=now(),
      inactivated_by=auth.uid(),
      inactivated_at=now()
  where id=v_current.id;

  insert into public.production_batch_size_ref(
    product_id, preferred_batch_size, min_batch_size, max_batch_size,
    effective_from, effective_to, is_active, notes, change_reason,
    created_by, updated_by, created_at, updated_at, supersedes_reference_id
  ) values (
    v_current.product_id, p_preferred_batch_size, p_min_batch_size, p_max_batch_size,
    v_effective_from, null, true, nullif(btrim(p_notes),''), v_reason,
    auth.uid(), auth.uid(), now(), now(), v_current.id
  ) returning id into v_new_id;

  return jsonb_build_object(
    'reference_id',v_new_id,
    'supersedes_reference_id',v_current.id,
    'product_id',v_current.product_id,
    'status','ACTIVE',
    'effective_from',v_effective_from,
    'preferred_batch_size',p_preferred_batch_size,
    'min_batch_size',p_min_batch_size,
    'max_batch_size',p_max_batch_size
  );
end;
$$;

create or replace function public.rpc_inactivate_supply_batch_size_reference(
  p_reference_id bigint,
  p_effective_to date default current_date,
  p_change_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current public.production_batch_size_ref%rowtype;
  v_effective_to date := coalesce(p_effective_to,current_date);
  v_reason text := nullif(btrim(p_change_reason),'');
begin
  perform public.require_permission('module:supply-batch-plan', true);

  if p_reference_id is null then raise exception 'Reference ID is required'; end if;
  if v_reason is null or length(v_reason) < 5 or upper(v_reason) in ('N/A','NA','NONE','-','—') then raise exception 'A meaningful change reason is required'; end if;
  if v_effective_to > current_date then raise exception 'Future-dated inactivation is not supported in the current lifecycle'; end if;

  select * into v_current
  from public.production_batch_size_ref r
  where r.id=p_reference_id
  for update;
  if not found then raise exception 'Batch-size reference % not found', p_reference_id; end if;
  if not v_current.is_active then raise exception 'Batch-size reference % is already inactive', p_reference_id; end if;
  if v_effective_to < v_current.effective_from then raise exception 'Effective-to date cannot precede effective-from date'; end if;

  update public.production_batch_size_ref
  set is_active=false,
      effective_to=v_effective_to,
      change_reason=v_reason,
      updated_by=auth.uid(),
      updated_at=now(),
      inactivated_by=auth.uid(),
      inactivated_at=now()
  where id=v_current.id;

  return jsonb_build_object(
    'reference_id',v_current.id,
    'product_id',v_current.product_id,
    'status','INACTIVE',
    'effective_to',v_effective_to,
    'change_reason',v_reason
  );
end;
$$;

revoke all on function public.rpc_get_supply_batch_size_references(bigint,text,text,integer,integer) from public, anon;
revoke all on function public.rpc_create_supply_batch_size_reference(bigint,numeric,numeric,numeric,date,text,text) from public, anon;
revoke all on function public.rpc_revise_supply_batch_size_reference(bigint,numeric,numeric,numeric,date,text,text) from public, anon;
revoke all on function public.rpc_inactivate_supply_batch_size_reference(bigint,date,text) from public, anon;

grant execute on function public.rpc_get_supply_batch_size_references(bigint,text,text,integer,integer) to authenticated;
grant execute on function public.rpc_create_supply_batch_size_reference(bigint,numeric,numeric,numeric,date,text,text) to authenticated;
grant execute on function public.rpc_revise_supply_batch_size_reference(bigint,numeric,numeric,numeric,date,text,text) to authenticated;
grant execute on function public.rpc_inactivate_supply_batch_size_reference(bigint,date,text) to authenticated;

comment on function public.rpc_get_supply_batch_size_references(bigint,text,text,integer,integer)
  is 'Governed Supply Batch Plan preferred-batch-size register/history read.';
comment on function public.rpc_create_supply_batch_size_reference(bigint,numeric,numeric,numeric,date,text,text)
  is 'Governed create for Product preferred-batch-size master data. No plan rebuild is triggered.';
comment on function public.rpc_revise_supply_batch_size_reference(bigint,numeric,numeric,numeric,date,text,text)
  is 'Governed immutable revision of an active Product preferred-batch-size reference. No plan rebuild is triggered.';
comment on function public.rpc_inactivate_supply_batch_size_reference(bigint,date,text)
  is 'Governed inactivation of an active Product preferred-batch-size reference. No plan rebuild is triggered.';

commit;