-- SP BOM schema and RPCs

create table if not exists public.sp_bom_header (
  id bigserial primary key,
  owner_item_id bigint not null,
  reference_output_qty numeric(18, 6) not null,
  reference_output_uom_id bigint not null,
  process_loss_pct numeric(7, 4) null default 0,
  notes text null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  last_updated_at timestamp with time zone null default now(),
  last_updated_by uuid null,
  constraint sp_bom_header_owner_item_id_fkey foreign key (owner_item_id) references inv_stock_item (id) on delete restrict,
  constraint sp_bom_header_reference_output_uom_id_fkey foreign key (reference_output_uom_id) references inv_uom (id),
  constraint sp_bom_header_process_loss_pct_check check ((process_loss_pct >= (0)::numeric) and (process_loss_pct < (1)::numeric)),
  constraint sp_bom_header_reference_output_qty_check check ((reference_output_qty > (0)::numeric))
);

create unique index if not exists uq_sp_bom_header_owner on public.sp_bom_header using btree (owner_item_id);

create table if not exists public.sp_bom_line (
  id bigserial primary key,
  sp_bom_id bigint not null,
  line_no integer not null,
  stock_item_id bigint not null,
  qty_per_reference_output numeric(18, 6) not null,
  uom_id bigint not null,
  wastage_pct numeric(7, 4) null,
  is_optional boolean not null default false,
  remarks text null,
  constraint sp_bom_line_sp_bom_id_fkey foreign key (sp_bom_id) references sp_bom_header (id) on delete cascade,
  constraint sp_bom_line_stock_item_id_fkey foreign key (stock_item_id) references inv_stock_item (id) on delete restrict,
  constraint sp_bom_line_uom_id_fkey foreign key (uom_id) references inv_uom (id),
  constraint sp_bom_line_wastage_pct_check check (((wastage_pct is null) or ((wastage_pct >= (0)::numeric) and (wastage_pct < (1)::numeric)))),
  constraint sp_bom_line_qty_per_reference_output_check check ((qty_per_reference_output > (0)::numeric)),
  constraint sp_bom_line_line_no_check check ((line_no > 0))
);

create unique index if not exists uq_sp_bom_line_unique on public.sp_bom_line using btree (sp_bom_id, line_no);

-- Picker: SP owners (semi-finished goods). Filter to RM category and 'semifinished_goods' subcategory.
create or replace view public.v_picker_sp_owners as
select
  i.id                           as id,
  i.name                         as label,
  u.code                         as default_uom_code,
  coalesce(icc.code,'')          as category_code,
  coalesce(ics.code,'')          as subcategory_code
from inv_stock_item i
left join inv_uom u                      on u.id = i.default_uom_id
left join inv_stock_item_class_map icm   on icm.stock_item_id = i.id
left join inv_class_category icc         on icc.id = icm.category_id
left join inv_class_subcategory ics      on ics.id = icm.subcategory_id
where coalesce(i.active, true)
  and lower(icc.code) = 'rm'
  and lower(ics.code) = 'semifinished_goods'
order by i.name;

-- 3.1 Get header (or null)
create or replace function public.rpc_sp_bom_get_header(p_owner_item_id bigint)
returns table (
  id                      bigint,
  owner_item_id           bigint,
  reference_output_qty    numeric,
  reference_output_uom_id bigint,
  reference_output_uom    text,
  process_loss_pct        numeric,
  notes                   text
)
language sql
stable
as $$
  select
    h.id,
    h.owner_item_id,
    h.reference_output_qty,
    h.reference_output_uom_id,
    u.code as reference_output_uom,
    h.process_loss_pct,
    h.notes
  from sp_bom_header h
  join inv_uom u on u.id = h.reference_output_uom_id
  where h.owner_item_id = p_owner_item_id
$$;

-- 3.2 List lines
create or replace function public.rpc_sp_bom_list_lines(p_owner_item_id bigint)
returns table (
  line_id       bigint,
  line_no       int,
  stock_item_id bigint,
  stock_item_name text,
  qty_per_reference_output numeric,
  uom_id       bigint,
  uom_code     text,
  wastage_pct  numeric,
  is_optional  boolean,
  remarks      text
)
language sql
stable
as $$
  select
    l.id,
    l.line_no,
    l.stock_item_id,
    i.name as stock_item_name,
    l.qty_per_reference_output,
    l.uom_id,
    u.code as uom_code,
    l.wastage_pct,
    l.is_optional,
    l.remarks
  from sp_bom_header h
  join sp_bom_line   l on l.sp_bom_id = h.id
  join inv_stock_item i on i.id = l.stock_item_id
  join inv_uom u on u.id = l.uom_id
  where h.owner_item_id = p_owner_item_id
  order by l.line_no
$$;

-- 3.3 Upsert header
create or replace function public.rpc_sp_bom_upsert_header(
  p_owner_item_id           bigint,
  p_reference_output_qty    numeric,
  p_reference_output_uom    text,
  p_process_loss_pct        numeric,
  p_notes                   text default null
)
returns bigint
language plpgsql
security definer
as $$
declare
  v_uom_id bigint;
  v_id     bigint;
begin
  select id into v_uom_id from inv_uom where lower(code)=lower(p_reference_output_uom);
  if v_uom_id is null then
    raise exception 'Unknown UOM: %', p_reference_output_uom;
  end if;

  insert into sp_bom_header (owner_item_id, reference_output_qty, reference_output_uom_id, process_loss_pct, notes)
  values (p_owner_item_id, p_reference_output_qty, v_uom_id, coalesce(p_process_loss_pct,0), p_notes)
  on conflict (owner_item_id) do update
    set reference_output_qty = excluded.reference_output_qty,
        reference_output_uom_id = excluded.reference_output_uom_id,
        process_loss_pct = excluded.process_loss_pct,
        notes = excluded.notes,
        last_updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.rpc_sp_bom_upsert_header(bigint,numeric,text,numeric,text) to authenticated, service_role;

-- 3.4 Upsert line
create or replace function public.rpc_sp_bom_upsert_line(
  p_owner_item_id bigint,
  p_stock_item_id bigint,
  p_qty           numeric,
  p_uom_code      text,
  p_wastage_pct   numeric default null,
  p_is_optional   boolean default false,
  p_remarks       text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_header_id bigint;
  v_uom_id    bigint;
  v_line_no   int;
begin
  select id into v_header_id from sp_bom_header where owner_item_id = p_owner_item_id;
  if v_header_id is null then
    raise exception 'SP BOM header missing for owner_item_id=%', p_owner_item_id;
  end if;

  select id into v_uom_id from inv_uom where lower(code)=lower(p_uom_code);
  if v_uom_id is null then
    raise exception 'Unknown UOM: %', p_uom_code;
  end if;

  if exists (
    select 1 from sp_bom_line
    where sp_bom_id = v_header_id and stock_item_id = p_stock_item_id and uom_id = v_uom_id
  ) then
    update sp_bom_line
    set qty_per_reference_output = p_qty,
        wastage_pct = p_wastage_pct,
        is_optional = coalesce(p_is_optional, false),
        remarks = p_remarks
    where sp_bom_id = v_header_id and stock_item_id = p_stock_item_id and uom_id = v_uom_id;
  else
    select coalesce(max(line_no),0)+1 into v_line_no from sp_bom_line where sp_bom_id = v_header_id;

    insert into sp_bom_line(
      sp_bom_id, line_no, stock_item_id, qty_per_reference_output, uom_id, wastage_pct, is_optional, remarks
    )
    values (
      v_header_id, v_line_no, p_stock_item_id, p_qty, v_uom_id, p_wastage_pct, coalesce(p_is_optional,false), p_remarks
    );
  end if;
end;
$$;

grant execute on function public.rpc_sp_bom_upsert_line(bigint,bigint,numeric,text,numeric,boolean,text) to authenticated, service_role;

-- 3.5 Delete line
create or replace function public.rpc_sp_bom_delete_line(
  p_owner_item_id bigint,
  p_stock_item_id bigint,
  p_uom_code      text
)
returns void
language plpgsql
security definer
as $$
declare
  v_header_id bigint;
  v_uom_id    bigint;
begin
  select id into v_header_id from sp_bom_header where owner_item_id = p_owner_item_id;
  if v_header_id is null then return; end if;

  select id into v_uom_id from inv_uom where lower(code)=lower(p_uom_code);
  if v_uom_id is null then return; end if;

  delete from sp_bom_line
  where sp_bom_id = v_header_id and stock_item_id = p_stock_item_id and uom_id = v_uom_id;
end;
$$;

grant execute on function public.rpc_sp_bom_delete_line(bigint,bigint,text) to authenticated, service_role;

-- 3.6 Renumber
create or replace function public.rpc_sp_bom_renumber(p_owner_item_id bigint)
returns void
language plpgsql
security definer
as $$
declare
  v_header_id bigint;
begin
  select id into v_header_id from sp_bom_header where owner_item_id = p_owner_item_id;
  if v_header_id is null then return; end if;

  with ordered as (
    select id, row_number() over (order by line_no, id) as rn
    from sp_bom_line
    where sp_bom_id = v_header_id
  )
  update sp_bom_line l
  set line_no = o.rn
  from ordered o
  where o.id = l.id;
end;
$$;

grant execute on function public.rpc_sp_bom_renumber(bigint) to authenticated, service_role;
