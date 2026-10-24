-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.proc_publish_snapshot_generation_internal(p_run_id bigint)
returns table(
  published_run_id bigint,
  published_revision bigint,
  published_at timestamptz,
  vendor_candidate_count bigint,
  indent_balance_count bigint,
  priority_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.proc_snapshot_refresh_run%rowtype;
  v_vendor_count bigint;
  v_balance_count bigint;
  v_priority_count bigint;
  v_stage_vendor integer;
  v_stage_balance integer;
  v_stage_priority integer;
  v_failed_or_pending bigint;
begin
  if p_run_id is null then
    raise exception 'p_run_id is required';
  end if;

  select * into v_run
  from public.proc_snapshot_refresh_run r
  where r.run_id = p_run_id
    and r.refresh_name = 'procurement_execution_snapshots';

  if not found then
    raise exception 'Procurement snapshot refresh run not found: %', p_run_id;
  end if;

  if v_run.status <> 'SUCCESS' then
    raise exception 'Cannot publish run % with status %', p_run_id, v_run.status;
  end if;

  select count(*) into v_failed_or_pending
  from public.proc_snapshot_refresh_run_stage s
  where s.run_id = p_run_id
    and s.status <> 'SUCCESS';

  if v_failed_or_pending <> 0 then
    raise exception 'Cannot publish run %: one or more stages are not SUCCESS', p_run_id;
  end if;

  select max(s.row_count) filter (where s.stage_code='01_VENDOR_CANDIDATES'),
         max(s.row_count) filter (where s.stage_code='02_INDENT_BALANCES'),
         max(s.row_count) filter (where s.stage_code='03_PRIORITY_SNAPSHOT')
  into v_stage_vendor, v_stage_balance, v_stage_priority
  from public.proc_snapshot_refresh_run_stage s
  where s.run_id = p_run_id;

  if v_stage_vendor is null or v_stage_balance is null or v_stage_priority is null then
    raise exception 'Cannot publish run %: required stage row counts are missing', p_run_id;
  end if;

  select count(*) into v_vendor_count from public.proc_vendor_item_candidate_generation where run_id=p_run_id;
  select count(*) into v_balance_count from public.proc_indent_line_balance_generation where run_id=p_run_id;
  select count(*) into v_priority_count from public.proc_indent_line_priority_generation where run_id=p_run_id;

  if v_vendor_count <> v_stage_vendor
     or v_balance_count <> v_stage_balance
     or v_priority_count <> v_stage_priority then
    raise exception 'Cannot publish run %: generation counts do not match stage counts (vendor %/%, balance %/%, priority %/%)',
      p_run_id, v_vendor_count, v_stage_vendor, v_balance_count, v_stage_balance, v_priority_count, v_stage_priority;
  end if;

  update public.proc_snapshot_refresh_control c
  set published_run_id = p_run_id,
      published_revision = v_run.target_revision,
      published_at = now(),
      updated_at = now()
  where c.refresh_name='procurement_execution_snapshots';

  return query
  select p_run_id,
         v_run.target_revision,
         c.published_at,
         v_vendor_count,
         v_balance_count,
         v_priority_count
  from public.proc_snapshot_refresh_control c
  where c.refresh_name='procurement_execution_snapshots';
end;
$$;

revoke all on function public.proc_publish_snapshot_generation_internal(bigint) from public, anon, authenticated;
grant execute on function public.proc_publish_snapshot_generation_internal(bigint) to service_role;
