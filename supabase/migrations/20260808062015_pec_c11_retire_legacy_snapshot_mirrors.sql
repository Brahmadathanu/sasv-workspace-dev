-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view public.v_proc_published_indent_line_balance as
select g.indent_line_id,g.indent_id,g.material_class_id,g.stock_item_id,g.remaining_qty,g.refreshed_at
from public.proc_snapshot_refresh_control c
join public.proc_indent_line_balance_generation g on g.run_id=c.published_run_id
where c.refresh_name='procurement_execution_snapshots';

create or replace view public.v_proc_published_vendor_item_candidate as
select g.material_class_id,g.stock_item_id,g.vendor_id,g.rate_value,g.evidence,g.source_summary,g.refreshed_at
from public.proc_snapshot_refresh_control c
join public.proc_vendor_item_candidate_generation g on g.run_id=c.published_run_id
where c.refresh_name='procurement_execution_snapshots';

revoke all on public.v_proc_published_indent_line_balance from public,anon,authenticated;
revoke all on public.v_proc_published_vendor_item_candidate from public,anon,authenticated;
grant select on public.v_proc_published_indent_line_balance to service_role;
grant select on public.v_proc_published_vendor_item_candidate to service_role;

do $$
declare
  r record;
  d text;
begin
  for r in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname in (
      'proc_apply_vendor_to_same_item_lines_pec_internal',
      'proc_clear_vendor_assignment_for_same_item_lines_pec_internal',
      'proc_indent_recommend_and_accept_vendors_step_pec_internal',
      'proc_preview_same_item_vendor_action_pec_internal'
    )
  loop
    d:=pg_get_functiondef(r.oid);
    d:=replace(d,'public.proc_indent_line_balance_snapshot','public.v_proc_published_indent_line_balance');
    d:=replace(d,'public.proc_vendor_item_candidate_snapshot','public.v_proc_published_vendor_item_candidate');
    execute d;
  end loop;
end$$;

create or replace function public.proc_process_snapshot_refresh_next_stage()
returns table(run_id bigint, stage_code text, stage_status text, run_status text, row_count integer, message text)
language plpgsql
security definer
set search_path to 'public'
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
  v_vendor_count integer;
  v_balance_count integer;
  v_priority_count integer;
begin
  v_locked := pg_try_advisory_lock(hashtext('procurement_snapshot_refresh_stage_processor'));
  if not v_locked then
    return query select null::bigint,null::text,'SKIPPED'::text,'RUNNING'::text,null::integer,
      'Another snapshot refresh stage is already processing.'::text;
    return;
  end if;

  select r.run_id,s.stage_id,s.stage_code,r.target_revision
  into v_run_id,v_stage_id,v_stage_code,v_target_revision
  from public.proc_snapshot_refresh_run r
  join public.proc_snapshot_refresh_run_stage s on s.run_id=r.run_id
  where r.refresh_name='procurement_execution_snapshots'
    and r.status in ('PENDING','RUNNING') and s.status='PENDING'
  order by r.requested_at asc,s.stage_no asc limit 1;

  if v_stage_id is null then
    perform pg_advisory_unlock(hashtext('procurement_snapshot_refresh_stage_processor'));
    return query select null::bigint,null::text,'NO_PENDING_STAGE'::text,'IDLE'::text,null::integer,
      'No pending procurement snapshot refresh stage found.'::text;
    return;
  end if;

  update public.proc_snapshot_refresh_run
  set status='RUNNING',started_at=coalesce(started_at,now()),message=format('Refresh is running for revision %s.',v_target_revision)
  where proc_snapshot_refresh_run.run_id=v_run_id;
  update public.proc_snapshot_refresh_run_stage
  set status='RUNNING',started_at=now(),message='Running'
  where proc_snapshot_refresh_run_stage.stage_id=v_stage_id;

  begin
    if v_stage_code='01_VENDOR_CANDIDATES' then
      select r.refreshed_count into v_count from public.proc_build_vendor_candidate_generation_internal(v_run_id) r;
    elsif v_stage_code='02_INDENT_BALANCES' then
      select r.refreshed_count into v_count from public.proc_build_indent_balance_generation_internal(v_run_id) r;
    elsif v_stage_code='03_PRIORITY_SNAPSHOT' then
      select r.refreshed_count into v_count from public.proc_build_indent_priority_generation_internal(v_run_id) r;
    elsif v_stage_code='04_FINAL_STATUS_CHECK' then
      select count(*)::integer into v_vendor_count from public.proc_vendor_item_candidate_generation g where g.run_id=v_run_id;
      select count(*)::integer into v_balance_count from public.proc_indent_line_balance_generation g where g.run_id=v_run_id;
      select count(*)::integer into v_priority_count from public.proc_indent_line_priority_generation g where g.run_id=v_run_id;

      if v_vendor_count <> coalesce((select s.row_count from public.proc_snapshot_refresh_run_stage s where s.run_id=v_run_id and s.stage_code='01_VENDOR_CANDIDATES'),-1) then
        raise exception 'Vendor candidate generation count mismatch for run %',v_run_id;
      end if;
      if v_balance_count <> coalesce((select s.row_count from public.proc_snapshot_refresh_run_stage s where s.run_id=v_run_id and s.stage_code='02_INDENT_BALANCES'),-1) then
        raise exception 'Indent balance generation count mismatch for run %',v_run_id;
      end if;
      if v_priority_count <> coalesce((select s.row_count from public.proc_snapshot_refresh_run_stage s where s.run_id=v_run_id and s.stage_code='03_PRIORITY_SNAPSHOT'),-1) then
        raise exception 'Priority generation count mismatch for run %',v_run_id;
      end if;
      if v_priority_count <> v_balance_count then
        raise exception 'Priority/balance same-run row count mismatch for run %: priority %, balance %',v_run_id,v_priority_count,v_balance_count;
      end if;
      v_count:=least(v_vendor_count,v_balance_count,v_priority_count);
      v_message:=format('Generation integrity checked for run %s.',v_run_id);
    else
      raise exception 'Unknown refresh stage: %',v_stage_code;
    end if;

    update public.proc_snapshot_refresh_run_stage
    set status='SUCCESS',finished_at=now(),row_count=v_count,message=v_message
    where proc_snapshot_refresh_run_stage.stage_id=v_stage_id;
  exception when others then
    update public.proc_snapshot_refresh_run_stage
    set status='FAILED',finished_at=now(),row_count=v_count,message=sqlerrm
    where proc_snapshot_refresh_run_stage.stage_id=v_stage_id;
    update public.proc_snapshot_refresh_run
    set status='FAILED',finished_at=now(),message=sqlerrm
    where proc_snapshot_refresh_run.run_id=v_run_id;
    perform pg_advisory_unlock(hashtext('procurement_snapshot_refresh_stage_processor'));
    return query select v_run_id,v_stage_code,'FAILED'::text,'FAILED'::text,v_count,sqlerrm::text;
    return;
  end;

  select count(*) into v_pending_count from public.proc_snapshot_refresh_run_stage s where s.run_id=v_run_id and s.status='PENDING';
  select count(*) into v_failed_count from public.proc_snapshot_refresh_run_stage s where s.run_id=v_run_id and s.status='FAILED';

  if v_failed_count>0 then
    update public.proc_snapshot_refresh_run set status='FAILED',finished_at=now(),message='One or more refresh stages failed.' where proc_snapshot_refresh_run.run_id=v_run_id;
  elsif v_pending_count=0 then
    update public.proc_snapshot_refresh_run
    set status='SUCCESS',finished_at=now(),message=format('Procurement snapshot refresh completed through revision %s.',v_target_revision)
    where proc_snapshot_refresh_run.run_id=v_run_id;

    insert into public.proc_snapshot_refresh_log(refresh_name,started_at,finished_at,success,vendor_candidate_count,indent_balance_count,priority_count,message)
    select 'procurement_execution_snapshots',r.started_at,r.finished_at,true,
      max(s.row_count) filter(where s.stage_code='01_VENDOR_CANDIDATES'),
      max(s.row_count) filter(where s.stage_code='02_INDENT_BALANCES'),
      max(s.row_count) filter(where s.stage_code='03_PRIORITY_SNAPSHOT'),
      format('OK; generation-staged refresh completed through revision %s',v_target_revision)
    from public.proc_snapshot_refresh_run r
    join public.proc_snapshot_refresh_run_stage s on s.run_id=r.run_id
    where r.run_id=v_run_id group by r.started_at,r.finished_at;

    perform pg_advisory_xact_lock(hashtext('procurement_snapshot_refresh_request'));
    update public.proc_snapshot_refresh_control c
    set completed_revision=greatest(c.completed_revision,v_target_revision),updated_at=now()
    where c.refresh_name='procurement_execution_snapshots';
    select c.requested_revision,c.completed_revision,c.last_request_source,c.last_requested_by
    into v_requested_revision,v_completed_revision,v_follow_up_source,v_follow_up_by
    from public.proc_snapshot_refresh_control c
    where c.refresh_name='procurement_execution_snapshots' for update;
    if v_requested_revision>v_completed_revision then
      v_follow_up_run_id:=public.proc_create_snapshot_refresh_run_internal(v_requested_revision,coalesce(v_follow_up_source,'follow_up'),v_follow_up_by);
    end if;
  else
    update public.proc_snapshot_refresh_run
    set status='RUNNING',message=format('Refresh is running for revision %s.',v_target_revision)
    where proc_snapshot_refresh_run.run_id=v_run_id;
  end if;

  perform pg_advisory_unlock(hashtext('procurement_snapshot_refresh_stage_processor'));
  return query select v_run_id,v_stage_code,'SUCCESS'::text,
    (select r.status from public.proc_snapshot_refresh_run r where r.run_id=v_run_id),v_count,
    case when v_follow_up_run_id is not null
      then format('%s Follow-up refresh run %s queued for newer revision %s.',v_message,v_follow_up_run_id,v_requested_revision)
      else v_message end;
end;
$function$;

revoke execute on function public.proc_get_published_snapshot_generation() from public,anon,authenticated;

drop function public.proc_refresh_vendor_item_candidate_snapshot();
drop function public.proc_refresh_indent_line_balance_snapshot(bigint);
drop function public.proc_refresh_indent_line_priority_snapshot(bigint);

drop table public.proc_vendor_item_candidate_snapshot;
drop table public.proc_indent_line_balance_snapshot;
drop table public.proc_indent_line_priority_snapshot;