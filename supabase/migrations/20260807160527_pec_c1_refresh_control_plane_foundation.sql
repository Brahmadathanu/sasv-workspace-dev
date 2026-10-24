-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- PEC-C1: durable, concurrency-safe, no-lost-request Procurement refresh control plane.

create table if not exists public.proc_snapshot_refresh_control (
  refresh_name text primary key,
  requested_revision bigint not null default 0,
  completed_revision bigint not null default 0,
  last_request_source text,
  last_requested_at timestamptz,
  last_requested_by uuid,
  updated_at timestamptz not null default now(),
  constraint proc_snapshot_refresh_control_revision_nonnegative_chk
    check (requested_revision >= 0 and completed_revision >= 0),
  constraint proc_snapshot_refresh_control_completed_le_requested_chk
    check (completed_revision <= requested_revision)
);

alter table public.proc_snapshot_refresh_control enable row level security;
revoke all on table public.proc_snapshot_refresh_control from public, anon, authenticated;
grant select, insert, update, delete on table public.proc_snapshot_refresh_control to service_role;

insert into public.proc_snapshot_refresh_control (
  refresh_name,
  requested_revision,
  completed_revision,
  updated_at
)
values (
  'procurement_execution_snapshots',
  0,
  0,
  now()
)
on conflict (refresh_name) do nothing;

alter table public.proc_snapshot_refresh_run
  add column if not exists target_revision bigint,
  add column if not exists latest_requested_revision bigint,
  add column if not exists coalesced_request_count integer;

update public.proc_snapshot_refresh_run
set target_revision = coalesce(target_revision, 0),
    latest_requested_revision = coalesce(latest_requested_revision, target_revision, 0),
    coalesced_request_count = coalesce(coalesced_request_count, 1)
where target_revision is null
   or latest_requested_revision is null
   or coalesced_request_count is null;

alter table public.proc_snapshot_refresh_run
  alter column target_revision set default 0,
  alter column target_revision set not null,
  alter column latest_requested_revision set default 0,
  alter column latest_requested_revision set not null,
  alter column coalesced_request_count set default 1,
  alter column coalesced_request_count set not null;

alter table public.proc_snapshot_refresh_run
  drop constraint if exists proc_snapshot_refresh_run_revision_nonnegative_chk;
alter table public.proc_snapshot_refresh_run
  add constraint proc_snapshot_refresh_run_revision_nonnegative_chk
  check (
    target_revision >= 0
    and latest_requested_revision >= target_revision
    and coalesced_request_count >= 1
  );

create unique index if not exists proc_snapshot_refresh_one_active_idx
  on public.proc_snapshot_refresh_run (refresh_name)
  where status in ('PENDING', 'RUNNING');

create or replace function public.proc_create_snapshot_refresh_run_internal(
  p_target_revision bigint,
  p_request_source text,
  p_requested_by uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_run_id bigint;
begin
  if p_target_revision is null or p_target_revision < 0 then
    raise exception 'p_target_revision must be >= 0';
  end if;

  insert into public.proc_snapshot_refresh_run (
    refresh_name,
    requested_by,
    request_source,
    status,
    message,
    target_revision,
    latest_requested_revision,
    coalesced_request_count
  )
  values (
    'procurement_execution_snapshots',
    p_requested_by,
    coalesce(nullif(trim(p_request_source), ''), 'manual'),
    'PENDING',
    format('Refresh requested for revision %s.', p_target_revision),
    p_target_revision,
    p_target_revision,
    1
  )
  returning run_id into v_run_id;

  insert into public.proc_snapshot_refresh_run_stage (
    run_id,
    stage_no,
    stage_code,
    stage_label,
    status
  )
  values
    (v_run_id, 1, '01_VENDOR_CANDIDATES', 'Refresh vendor candidate snapshot', 'PENDING'),
    (v_run_id, 2, '02_INDENT_BALANCES', 'Refresh indent line balance snapshot', 'PENDING'),
    (v_run_id, 3, '03_PRIORITY_SNAPSHOT', 'Refresh indent line priority snapshot', 'PENDING'),
    (v_run_id, 4, '04_FINAL_STATUS_CHECK', 'Final snapshot status check', 'PENDING');

  return v_run_id;
end;
$function$;

revoke all on function public.proc_create_snapshot_refresh_run_internal(bigint,text,uuid)
  from public, anon, authenticated;
grant execute on function public.proc_create_snapshot_refresh_run_internal(bigint,text,uuid)
  to service_role;

create or replace function public.proc_request_snapshot_refresh(
  p_request_source text default 'manual'::text
)
returns table(run_id bigint, status text, message text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_run_id bigint;
  v_existing_run_id bigint;
  v_existing_status text;
  v_revision bigint;
  v_source text;
begin
  v_source := coalesce(nullif(trim(p_request_source), ''), 'manual');

  -- Serialize request creation/coalescing so the partial unique index is a final
  -- database invariant rather than the primary race-control mechanism.
  perform pg_advisory_xact_lock(hashtext('procurement_snapshot_refresh_request'));

  insert into public.proc_snapshot_refresh_control (
    refresh_name,
    requested_revision,
    completed_revision,
    updated_at
  )
  values (
    'procurement_execution_snapshots',
    0,
    0,
    now()
  )
  on conflict (refresh_name) do nothing;

  update public.proc_snapshot_refresh_control c
  set requested_revision = c.requested_revision + 1,
      last_request_source = v_source,
      last_requested_at = now(),
      last_requested_by = auth.uid(),
      updated_at = now()
  where c.refresh_name = 'procurement_execution_snapshots'
  returning c.requested_revision into v_revision;

  select r.run_id, r.status
  into v_existing_run_id, v_existing_status
  from public.proc_snapshot_refresh_run r
  where r.refresh_name = 'procurement_execution_snapshots'
    and r.status in ('PENDING', 'RUNNING')
  order by r.requested_at asc
  limit 1
  for update;

  if v_existing_run_id is not null then
    if v_existing_status = 'PENDING' then
      -- Safe coalescing: no stage has started, therefore the pending generation
      -- may expand its target revision to include this request.
      update public.proc_snapshot_refresh_run r
      set target_revision = v_revision,
          latest_requested_revision = v_revision,
          coalesced_request_count = r.coalesced_request_count + 1,
          message = format(
            'Pending refresh coalesced through revision %s.',
            v_revision
          )
      where r.run_id = v_existing_run_id;
    else
      -- Frozen-target rule: once processing has begun, never move the target.
      -- The control row now remains dirty (requested_revision > target_revision),
      -- guaranteeing a follow-up run after this one completes.
      update public.proc_snapshot_refresh_run r
      set latest_requested_revision = greatest(r.latest_requested_revision, v_revision),
          coalesced_request_count = r.coalesced_request_count + 1,
          message = format(
            'Refresh running for revision %s; newer revision %s is queued for follow-up.',
            r.target_revision,
            v_revision
          )
      where r.run_id = v_existing_run_id;
    end if;

    return query
    select
      v_existing_run_id,
      'EXISTING'::text,
      case
        when v_existing_status = 'PENDING'
          then format('Existing pending refresh now covers revision %s.', v_revision)
        else format('Existing running refresh retained; revision %s is durably pending.', v_revision)
      end;
    return;
  end if;

  v_run_id := public.proc_create_snapshot_refresh_run_internal(
    v_revision,
    v_source,
    auth.uid()
  );

  return query
  select
    v_run_id,
    'PENDING'::text,
    format('Procurement snapshot refresh requested for revision %s.', v_revision);
end;
$function$;

create or replace function public.proc_process_snapshot_refresh_next_stage()
returns table(
  run_id bigint,
  stage_code text,
  stage_status text,
  run_status text,
  row_count integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_locked boolean := false;
  v_run_id bigint;
  v_stage_id bigint;
  v_stage_code text;
  v_target_revision bigint;
  v_count integer := null;
  v_message text := 'OK';
  v_pending_count integer;
  v_failed_count integer;
  v_requested_revision bigint;
  v_completed_revision bigint;
  v_follow_up_run_id bigint;
  v_follow_up_source text;
  v_follow_up_by uuid;
begin
  v_locked := pg_try_advisory_lock(hashtext('procurement_snapshot_refresh_stage_processor'));

  if not v_locked then
    return query
    select
      null::bigint,
      null::text,
      'SKIPPED'::text,
      'RUNNING'::text,
      null::integer,
      'Another snapshot refresh stage is already processing.'::text;
    return;
  end if;

  select r.run_id, s.stage_id, s.stage_code, r.target_revision
  into v_run_id, v_stage_id, v_stage_code, v_target_revision
  from public.proc_snapshot_refresh_run r
  join public.proc_snapshot_refresh_run_stage s
    on s.run_id = r.run_id
  where r.refresh_name = 'procurement_execution_snapshots'
    and r.status in ('PENDING', 'RUNNING')
    and s.status = 'PENDING'
  order by r.requested_at asc, s.stage_no asc
  limit 1;

  if v_stage_id is null then
    perform pg_advisory_unlock(hashtext('procurement_snapshot_refresh_stage_processor'));

    return query
    select
      null::bigint,
      null::text,
      'NO_PENDING_STAGE'::text,
      'IDLE'::text,
      null::integer,
      'No pending procurement snapshot refresh stage found.'::text;
    return;
  end if;

  update public.proc_snapshot_refresh_run
  set status = 'RUNNING',
      started_at = coalesce(started_at, now()),
      message = format('Refresh is running for revision %s.', v_target_revision)
  where proc_snapshot_refresh_run.run_id = v_run_id;

  update public.proc_snapshot_refresh_run_stage
  set status = 'RUNNING',
      started_at = now(),
      message = 'Running'
  where proc_snapshot_refresh_run_stage.stage_id = v_stage_id;

  begin
    if v_stage_code = '01_VENDOR_CANDIDATES' then
      select r.refreshed_count
      into v_count
      from public.proc_refresh_vendor_item_candidate_snapshot() r;

    elsif v_stage_code = '02_INDENT_BALANCES' then
      select r.refreshed_count
      into v_count
      from public.proc_refresh_indent_line_balance_snapshot(null) r;

    elsif v_stage_code = '03_PRIORITY_SNAPSHOT' then
      select r.refreshed_count
      into v_count
      from public.proc_refresh_indent_line_priority_snapshot(null) r;

    elsif v_stage_code = '04_FINAL_STATUS_CHECK' then
      select least(
        coalesce((select count(*) from public.proc_vendor_item_candidate_snapshot), 0),
        coalesce((select count(*) from public.proc_indent_line_balance_snapshot), 0),
        coalesce((select count(*) from public.proc_indent_line_priority_snapshot), 0)
      )::integer
      into v_count;

      v_message := 'Final status checked.';

    else
      raise exception 'Unknown refresh stage: %', v_stage_code;
    end if;

    update public.proc_snapshot_refresh_run_stage
    set status = 'SUCCESS',
        finished_at = now(),
        row_count = v_count,
        message = v_message
    where proc_snapshot_refresh_run_stage.stage_id = v_stage_id;

  exception
    when others then
      update public.proc_snapshot_refresh_run_stage
      set status = 'FAILED',
          finished_at = now(),
          row_count = v_count,
          message = sqlerrm
      where proc_snapshot_refresh_run_stage.stage_id = v_stage_id;

      update public.proc_snapshot_refresh_run
      set status = 'FAILED',
          finished_at = now(),
          message = sqlerrm
      where proc_snapshot_refresh_run.run_id = v_run_id;

      perform pg_advisory_unlock(hashtext('procurement_snapshot_refresh_stage_processor'));

      return query
      select
        v_run_id,
        v_stage_code,
        'FAILED'::text,
        'FAILED'::text,
        v_count,
        sqlerrm::text;
      return;
  end;

  select count(*)
  into v_pending_count
  from public.proc_snapshot_refresh_run_stage
  where proc_snapshot_refresh_run_stage.run_id = v_run_id
    and status = 'PENDING';

  select count(*)
  into v_failed_count
  from public.proc_snapshot_refresh_run_stage
  where proc_snapshot_refresh_run_stage.run_id = v_run_id
    and status = 'FAILED';

  if v_failed_count > 0 then
    update public.proc_snapshot_refresh_run
    set status = 'FAILED',
        finished_at = now(),
        message = 'One or more refresh stages failed.'
    where proc_snapshot_refresh_run.run_id = v_run_id;

  elsif v_pending_count = 0 then
    update public.proc_snapshot_refresh_run
    set status = 'SUCCESS',
        finished_at = now(),
        message = format('Procurement snapshot refresh completed through revision %s.', v_target_revision)
    where proc_snapshot_refresh_run.run_id = v_run_id;

    insert into public.proc_snapshot_refresh_log (
      refresh_name,
      started_at,
      finished_at,
      success,
      vendor_candidate_count,
      indent_balance_count,
      priority_count,
      message
    )
    select
      'procurement_execution_snapshots',
      r.started_at,
      r.finished_at,
      true,
      max(s.row_count) filter (where s.stage_code = '01_VENDOR_CANDIDATES'),
      max(s.row_count) filter (where s.stage_code = '02_INDENT_BALANCES'),
      max(s.row_count) filter (where s.stage_code = '03_PRIORITY_SNAPSHOT'),
      format('OK; staged refresh completed through revision %s', v_target_revision)
    from public.proc_snapshot_refresh_run r
    join public.proc_snapshot_refresh_run_stage s
      on s.run_id = r.run_id
    where r.run_id = v_run_id
    group by r.started_at, r.finished_at;

    -- Publish completion only at the control-plane revision level in C1.
    -- Snapshot-row generation lineage is deliberately deferred to PEC-C2.
    perform pg_advisory_xact_lock(hashtext('procurement_snapshot_refresh_request'));

    update public.proc_snapshot_refresh_control c
    set completed_revision = greatest(c.completed_revision, v_target_revision),
        updated_at = now()
    where c.refresh_name = 'procurement_execution_snapshots';

    select
      c.requested_revision,
      c.completed_revision,
      c.last_request_source,
      c.last_requested_by
    into
      v_requested_revision,
      v_completed_revision,
      v_follow_up_source,
      v_follow_up_by
    from public.proc_snapshot_refresh_control c
    where c.refresh_name = 'procurement_execution_snapshots'
    for update;

    if v_requested_revision > v_completed_revision then
      v_follow_up_run_id := public.proc_create_snapshot_refresh_run_internal(
        v_requested_revision,
        coalesce(v_follow_up_source, 'follow_up'),
        v_follow_up_by
      );
    end if;

  else
    update public.proc_snapshot_refresh_run
    set status = 'RUNNING',
        message = format('Refresh is running for revision %s.', v_target_revision)
    where proc_snapshot_refresh_run.run_id = v_run_id;
  end if;

  perform pg_advisory_unlock(hashtext('procurement_snapshot_refresh_stage_processor'));

  return query
  select
    v_run_id,
    v_stage_code,
    'SUCCESS'::text,
    (
      select r.status
      from public.proc_snapshot_refresh_run r
      where r.run_id = v_run_id
    ),
    v_count,
    case
      when v_follow_up_run_id is not null
        then format('%s Follow-up refresh run %s queued for newer revision %s.', v_message, v_follow_up_run_id, v_requested_revision)
      else v_message
    end;
end;
$function$;
