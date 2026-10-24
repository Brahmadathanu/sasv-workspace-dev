-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- PEC-C2: generation lineage foundation without changing current published read tables.

create table if not exists public.proc_vendor_item_candidate_generation (
  run_id bigint not null references public.proc_snapshot_refresh_run(run_id) on delete cascade,
  like public.proc_vendor_item_candidate_snapshot including defaults
);

create table if not exists public.proc_indent_line_balance_generation (
  run_id bigint not null references public.proc_snapshot_refresh_run(run_id) on delete cascade,
  like public.proc_indent_line_balance_snapshot including defaults
);

create table if not exists public.proc_indent_line_priority_generation (
  run_id bigint not null references public.proc_snapshot_refresh_run(run_id) on delete cascade,
  like public.proc_indent_line_priority_snapshot including defaults
);

create unique index if not exists proc_vendor_item_candidate_generation_uq
  on public.proc_vendor_item_candidate_generation(run_id, material_class_id, stock_item_id, vendor_id);

create unique index if not exists proc_indent_line_balance_generation_uq
  on public.proc_indent_line_balance_generation(run_id, indent_line_id);

create unique index if not exists proc_indent_line_priority_generation_uq
  on public.proc_indent_line_priority_generation(run_id, indent_line_id);

create index if not exists proc_vendor_item_candidate_generation_run_idx
  on public.proc_vendor_item_candidate_generation(run_id);
create index if not exists proc_indent_line_balance_generation_run_idx
  on public.proc_indent_line_balance_generation(run_id);
create index if not exists proc_indent_line_priority_generation_run_idx
  on public.proc_indent_line_priority_generation(run_id);

alter table public.proc_snapshot_refresh_control
  add column if not exists published_run_id bigint references public.proc_snapshot_refresh_run(run_id),
  add column if not exists published_revision bigint not null default 0,
  add column if not exists published_at timestamptz;

-- Bootstrap current legacy published snapshot contents as the last known successful run.
-- Only do this if no published generation has yet been established.
do $$
declare
  v_bootstrap_run_id bigint;
  v_published_run_id bigint;
begin
  select published_run_id
  into v_published_run_id
  from public.proc_snapshot_refresh_control
  where refresh_name = 'procurement_execution_snapshots'
  for update;

  if v_published_run_id is null then
    select r.run_id
    into v_bootstrap_run_id
    from public.proc_snapshot_refresh_run r
    where r.refresh_name = 'procurement_execution_snapshots'
      and r.status = 'SUCCESS'
    order by r.finished_at desc nulls last, r.run_id desc
    limit 1;

    if v_bootstrap_run_id is null then
      raise exception 'PEC-C2 bootstrap requires at least one successful procurement refresh run';
    end if;

    insert into public.proc_vendor_item_candidate_generation
    select v_bootstrap_run_id, s.*
    from public.proc_vendor_item_candidate_snapshot s
    on conflict do nothing;

    insert into public.proc_indent_line_balance_generation
    select v_bootstrap_run_id, s.*
    from public.proc_indent_line_balance_snapshot s
    on conflict do nothing;

    insert into public.proc_indent_line_priority_generation
    select v_bootstrap_run_id, s.*
    from public.proc_indent_line_priority_snapshot s
    on conflict do nothing;

    update public.proc_snapshot_refresh_control c
    set published_run_id = v_bootstrap_run_id,
        published_revision = coalesce((select r.target_revision from public.proc_snapshot_refresh_run r where r.run_id = v_bootstrap_run_id), 0),
        published_at = coalesce((select r.finished_at from public.proc_snapshot_refresh_run r where r.run_id = v_bootstrap_run_id), now()),
        updated_at = now()
    where c.refresh_name = 'procurement_execution_snapshots';
  end if;
end $$;

create or replace function public.proc_get_published_snapshot_generation()
returns table(
  run_id bigint,
  revision bigint,
  published_at timestamptz,
  vendor_candidate_count bigint,
  indent_balance_count bigint,
  priority_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.published_run_id,
    c.published_revision,
    c.published_at,
    (select count(*) from public.proc_vendor_item_candidate_generation g where g.run_id = c.published_run_id),
    (select count(*) from public.proc_indent_line_balance_generation g where g.run_id = c.published_run_id),
    (select count(*) from public.proc_indent_line_priority_generation g where g.run_id = c.published_run_id)
  from public.proc_snapshot_refresh_control c
  where c.refresh_name = 'procurement_execution_snapshots';
$$;

revoke all on public.proc_vendor_item_candidate_generation from public, anon, authenticated;
revoke all on public.proc_indent_line_balance_generation from public, anon, authenticated;
revoke all on public.proc_indent_line_priority_generation from public, anon, authenticated;
revoke all on function public.proc_get_published_snapshot_generation() from public, anon;
grant execute on function public.proc_get_published_snapshot_generation() to authenticated, service_role;
