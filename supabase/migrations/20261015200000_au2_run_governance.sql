-- AU-2/2b: reference/approved run governance (independent costing audit, A0/A6).
-- DRAFT. NOT APPLIED LIVE. Tested only on the local PG17 parity DB (scripts/audit/local-db on the audit branch).
-- Version 20261015200000 is a placeholder; if applied via MCP the server assigns a version (see AU-1 PPM rename).
-- Changes no existing rows. Adds: designation + fingerprint + supersession-authorisation tables (append-only),
-- guard triggers on costing snapshot tables, refresh-request refusal for designated periods,
-- designation-first current-run view, auto fingerprint at SUCCESS, governed period close.

begin;
set local lock_timeout = '5s';  -- creating ~90 triggers locks 52 snapshot tables briefly; fail fast instead of queueing behind a running stage
-- Preflight: refuse to apply while a costing run is active (the 5-minute stage processor could be mid-stage).
do $pf$ begin
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then
    raise exception 'AU2_PREFLIGHT: a costing refresh run is QUEUED/RUNNING; apply between runs';
  end if;
end $pf$;

-- 0. Generic append-only guard ------------------------------------------------------------
create or replace function costing.fn_guard_append_only()
returns trigger language plpgsql set search_path to 'costing','public','pg_temp' as $$
begin
  raise exception 'AU2_APPEND_ONLY: % on costing.% is prohibited (append-only governance table)', tg_op, tg_table_name
    using errcode = 'P0001';
end $$;

-- 1. Fingerprints -------------------------------------------------------------------------
create or replace function costing.fn_costing_run_scoped_tables()
returns setof text language sql stable set search_path to 'costing','public','pg_temp' as $$
  select c.relname::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='costing' and c.relkind='r' and c.relname like '%snapshot%'
    and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='refresh_run_id' and not a.attisdropped)
    -- Note (PR #68 risk assessment): costing_control_dashboard_snapshot / _integrity_audit_snapshot are deleted BY PERIOD
    -- in their refresh RPCs, but the live guard a_stage05_exact_write_guard (fires first) silently skips rows of other
    -- runs, so a later run never touches a designated run's rows. They stay guarded; test T15b proves the interaction.
  order by 1
$$;

create or replace function costing.fn_compute_run_fingerprint(p_refresh_run_id bigint)
returns jsonb language plpgsql stable set search_path to 'costing','public','pg_temp' as $$
declare t text; v_n bigint; v_h text; v jsonb := '{}'::jsonb;
begin
  for t in select * from costing.fn_costing_run_scoped_tables() loop
    execute format('select count(*), md5(coalesce(string_agg(x::text, %L order by x::text), %L)) from costing.%I x where x.refresh_run_id = $1', '|', '', t)
      into v_n, v_h using p_refresh_run_id;
    if v_n > 0 then v := v || jsonb_build_object(t, jsonb_build_object('rows', v_n, 'md5', v_h)); end if;
  end loop;
  return v;
end $$;

create table if not exists costing.costing_run_fingerprint (
  id bigint generated always as identity primary key,
  refresh_run_id bigint not null references costing.costing_refresh_run(id),
  purpose text not null check (purpose in ('DESIGNATION','RUN_SUCCESS','CHECK')),
  captured_by text not null check (length(btrim(captured_by)) > 0),
  captured_at timestamptz not null default now(),
  fingerprint jsonb not null
);
create index if not exists costing_run_fingerprint_run_idx on costing.costing_run_fingerprint(refresh_run_id, captured_at desc);

create or replace function costing.fn_verify_run_fingerprint(p_refresh_run_id bigint)
returns table(table_name text, captured jsonb, current_value jsonb, matches boolean)
language sql stable set search_path to 'costing','public','pg_temp' as $$
  with cap as (select fingerprint from costing.costing_run_fingerprint where refresh_run_id=p_refresh_run_id
               order by captured_at desc, id desc limit 1),
       cur as (select costing.fn_compute_run_fingerprint(p_refresh_run_id) fp),
       k as (select jsonb_object_keys(cap.fingerprint) k from cap union select jsonb_object_keys(cur.fp) from cur)
  select k.k, cap.fingerprint->k.k, cur.fp->k.k, (cap.fingerprint->k.k) is not distinct from (cur.fp->k.k)
  from k, cap, cur order by 1
$$;

-- 2. Designations -------------------------------------------------------------------------
create table if not exists costing.costing_run_designation (
  id bigint generated always as identity primary key,
  refresh_run_id bigint not null references costing.costing_refresh_run(id),
  period_start date not null,
  designation text not null check (designation in ('REFERENCE','APPROVED','REVOKED')),
  designated_by text not null check (length(btrim(designated_by)) > 0),
  designated_by_uid uuid,
  designated_at timestamptz not null default now(),
  reason text not null check (length(btrim(reason)) >= 10),
  fingerprint_id bigint references costing.costing_run_fingerprint(id)
);
create index if not exists costing_run_designation_period_idx on costing.costing_run_designation(period_start, designated_at desc);

create or replace view costing.v_costing_run_effective_designation as
  select distinct on (d.refresh_run_id) d.refresh_run_id, d.period_start, d.designation, d.designated_by,
         d.designated_at, d.reason, d.fingerprint_id, d.id as designation_id
  from costing.costing_run_designation d
  order by d.refresh_run_id, d.designated_at desc, d.id desc;

-- 3. Supersession authorisation (needed to request a new run for a period holding a designated run)
create table if not exists costing.costing_period_refresh_authorization (
  id bigint generated always as identity primary key,
  period_start date not null,
  authorised_by text not null check (length(btrim(authorised_by)) > 0),
  authorised_at timestamptz not null default now(),
  reason text not null check (length(btrim(reason)) >= 10),
  valid_until timestamptz not null,
  consumed_by_run_id bigint references costing.costing_refresh_run(id),
  consumed_at timestamptz
);

create or replace function costing.fn_guard_refresh_authorization()
returns trigger language plpgsql set search_path to 'costing','public','pg_temp' as $$
begin
  if tg_op = 'UPDATE' and old.consumed_by_run_id is null and new.consumed_by_run_id is not null
     and (new.period_start, new.authorised_by, new.authorised_at, new.reason, new.valid_until)
         is not distinct from (old.period_start, old.authorised_by, old.authorised_at, old.reason, old.valid_until) then
    return new;  -- single permitted transition: consumption
  end if;
  raise exception 'AU2_APPEND_ONLY: % on costing.costing_period_refresh_authorization is prohibited', tg_op using errcode='P0001';
end $$;

do $$ declare t text; begin
  foreach t in array array['costing_run_fingerprint','costing_run_designation'] loop
    execute format('drop trigger if exists trg_au2_append_only on costing.%I', t);
    execute format('create trigger trg_au2_append_only before update or delete on costing.%I for each row execute function costing.fn_guard_append_only()', t);
    execute format('drop trigger if exists trg_au2_append_only_truncate on costing.%I', t);
    execute format('create trigger trg_au2_append_only_truncate before truncate on costing.%I for each statement execute function costing.fn_guard_append_only()', t);
  end loop;
end $$;
drop trigger if exists trg_au2_refresh_authorization_guard on costing.costing_period_refresh_authorization;
create trigger trg_au2_refresh_authorization_guard before update or delete on costing.costing_period_refresh_authorization
  for each row execute function costing.fn_guard_refresh_authorization();
drop trigger if exists trg_au2_refresh_authorization_truncate on costing.costing_period_refresh_authorization;
create trigger trg_au2_refresh_authorization_truncate before truncate on costing.costing_period_refresh_authorization
  for each statement execute function costing.fn_guard_append_only();

-- 4. Snapshot guards -----------------------------------------------------------------------
-- 4a. designated-run rows are immutable on every run-scoped snapshot table
create or replace function costing.fn_guard_designated_run_rows()
returns trigger language plpgsql security definer set search_path to 'costing','public','pg_temp' as $$
declare v_run bigint; v_des text;
begin
  v_run := case when tg_op='DELETE' then old.refresh_run_id else new.refresh_run_id end;
  if tg_op='UPDATE' and old.refresh_run_id is distinct from new.refresh_run_id then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id=old.refresh_run_id;
    if v_des in ('REFERENCE','APPROVED') then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; % on costing.% prohibited', old.refresh_run_id, v_des, tg_op, tg_table_name using errcode='P0001';
    end if;
  end if;
  if v_run is not null then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id=v_run;
    if v_des in ('REFERENCE','APPROVED') then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; % on costing.% prohibited', v_run, v_des, tg_op, tg_table_name using errcode='P0001';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

create or replace function costing.fn_guard_snapshot_truncate()
returns trigger language plpgsql set search_path to 'costing','public','pg_temp' as $$
begin
  raise exception 'AU2_SNAPSHOT_TRUNCATE_PROHIBITED: TRUNCATE on costing.% would destroy run history', tg_table_name using errcode='P0001';
end $$;

do $$ declare t text; begin
  for t in select * from costing.fn_costing_run_scoped_tables() loop
    execute format('drop trigger if exists trg_au2_designated_run_guard on costing.%I', t);
    execute format('create trigger trg_au2_designated_run_guard before insert or update or delete on costing.%I for each row execute function costing.fn_guard_designated_run_rows()', t);
    execute format('drop trigger if exists trg_au2_snapshot_truncate_guard on costing.%I', t);
    execute format('create trigger trg_au2_snapshot_truncate_guard before truncate on costing.%I for each statement execute function costing.fn_guard_snapshot_truncate()', t);
  end loop;
end $$;

-- 4b. the 15 previously unguarded run-scoped snapshot tables get the existing terminal-run guard
do $$ declare t text; begin
  foreach t in array array[
    'cost_sheet_line_monthly_snapshot','cost_sheet_rm_line_traceability_snapshot','direct_labour_component_pool_snapshot',
    'internal_source_material_review_queue_snapshot','product_direct_labour_step_snapshot','product_rm_material_cost_line_snapshot',
    'scheme_master_context_snapshot','sku_internal_loaded_cost_snapshot','sku_internal_material_conversion_snapshot',
    'sku_manufacturing_cop_snapshot','sku_overhead_allocation_snapshot','sku_packing_labour_workload_snapshot',
    'sku_pm_material_cost_line_snapshot','sku_prime_cost_snapshot','sku_rm_material_cost_line_snapshot'] loop
    execute format('drop trigger if exists trg_au2_mutable_run_guard on costing.%I', t);
    execute format('create trigger trg_au2_mutable_run_guard before insert or update or delete on costing.%I for each row execute function costing.fn_enforce_mutable_refresh_run_snapshot()', t);
  end loop;
end $$;

-- 5. Run-row protection and refresh-request refusal -----------------------------------------
create or replace function costing.fn_guard_designated_run_header()
returns trigger language plpgsql security definer set search_path to 'costing','public','pg_temp' as $$
declare v_des text; v_auth bigint; v_ref bigint;
begin
  if tg_op = 'INSERT' then
    select e.refresh_run_id into v_ref from costing.v_costing_run_effective_designation e
     where e.period_start = new.period_start and e.designation = 'APPROVED'
     order by e.designated_at desc limit 1;
    if v_ref is not null then
      select a.id into v_auth from costing.costing_period_refresh_authorization a
       where a.period_start = new.period_start and a.consumed_by_run_id is null and a.valid_until > now()
       order by a.authorised_at desc limit 1 for update;
      if v_auth is null then
        raise exception 'AU2_PERIOD_HOLDS_APPROVED_RUN: period % holds APPROVED run %; a recorded supersession authorisation is required', new.period_start, v_ref using errcode='P0001';
      end if;
      new.request_note := coalesce(new.request_note,'') || format(' [AU2 supersession authorisation %s]', v_auth);
      perform set_config('costing.au2_pending_authorization', v_auth::text, true);
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id = old.id;
    if v_des in ('REFERENCE','APPROVED') and (row(new.*) is distinct from row(old.*)) then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; header update prohibited', old.id, v_des using errcode='P0001';
    end if;
    return new;
  else
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id = old.id;
    if v_des is not null then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % has designation history; delete prohibited', old.id using errcode='P0001';
    end if;
    return old;
  end if;
end $$;

create or replace function costing.fn_after_refresh_run_au2()
returns trigger language plpgsql security definer set search_path to 'costing','public','pg_temp' as $$
declare v_auth text;
begin
  if tg_op = 'INSERT' then
    v_auth := nullif(current_setting('costing.au2_pending_authorization', true), '');
    if v_auth is not null then
      update costing.costing_period_refresh_authorization set consumed_by_run_id = new.id, consumed_at = now() where id = v_auth::bigint;
      perform set_config('costing.au2_pending_authorization', '', true);
    end if;
  elsif new.overall_status = 'SUCCESS' and old.overall_status is distinct from 'SUCCESS' then
    begin  -- non-fatal: a fingerprint problem must never turn a good run into FAILED (designation re-captures one)
      insert into costing.costing_run_fingerprint(refresh_run_id, purpose, captured_by, fingerprint)
      values (new.id, 'RUN_SUCCESS', 'system:run-success', costing.fn_compute_run_fingerprint(new.id));
    exception when others then
      raise warning 'AU2_RUN_SUCCESS_FINGERPRINT_SKIPPED: run % (%)', new.id, sqlerrm;
    end;
  end if;
  return null;
end $$;

drop trigger if exists trg_au2_designated_run_header on costing.costing_refresh_run;
create trigger trg_au2_designated_run_header before insert or update or delete on costing.costing_refresh_run
  for each row execute function costing.fn_guard_designated_run_header();
drop trigger if exists trg_au2_after_refresh_run on costing.costing_refresh_run;
create trigger trg_au2_after_refresh_run after insert or update of overall_status on costing.costing_refresh_run
  for each row execute function costing.fn_after_refresh_run_au2();

-- 6. Governed RPCs (service_role only; the user's decision is recorded by name) ------------
create or replace function costing.rpc_designate_costing_run(p_refresh_run_id bigint, p_designation text, p_designated_by text, p_reason text)
returns bigint language plpgsql security definer set search_path to 'costing','public','pg_temp' as $$
declare r costing.costing_refresh_run%rowtype; v_fp bigint; v_id bigint;
begin
  if p_designation not in ('REFERENCE','APPROVED','REVOKED') then raise exception 'AU2_BAD_DESIGNATION: %', p_designation; end if;
  select * into r from costing.costing_refresh_run where id = p_refresh_run_id for update;
  if not found then raise exception 'AU2_RUN_NOT_FOUND: %', p_refresh_run_id; end if;
  if p_designation <> 'REVOKED' and (r.overall_status <> 'SUCCESS' or r.valuation_context_source <> 'CAPTURED_AT_REQUEST') then
    raise exception 'AU2_RUN_NOT_DESIGNATABLE: run % status % context %', r.id, r.overall_status, r.valuation_context_source;
  end if;
  insert into costing.costing_run_fingerprint(refresh_run_id, purpose, captured_by, fingerprint)
  values (r.id, 'DESIGNATION', p_designated_by, costing.fn_compute_run_fingerprint(r.id)) returning id into v_fp;
  insert into costing.costing_run_designation(refresh_run_id, period_start, designation, designated_by, designated_by_uid, reason, fingerprint_id)
  values (r.id, r.period_start, p_designation, p_designated_by, auth.uid(), p_reason, v_fp) returning id into v_id;
  return v_id;
end $$;

create or replace function costing.rpc_authorize_period_refresh(p_period_start date, p_authorised_by text, p_reason text, p_valid_minutes int default 60)
returns bigint language sql security definer set search_path to 'costing','public','pg_temp' as $$
  insert into costing.costing_period_refresh_authorization(period_start, authorised_by, reason, valid_until)
  values (p_period_start, p_authorised_by, p_reason, now() + make_interval(mins => greatest(1, least(p_valid_minutes, 1440))))
  returning id
$$;

create or replace function costing.rpc_close_cost_period(p_period_start date, p_closed_by text, p_reason text, p_approval_reference text)
returns text language plpgsql security definer set search_path to 'costing','public','pg_temp' as $$
declare p costing.cost_periods%rowtype; v_run bigint; v_bad int;
begin
  select * into p from costing.cost_periods where period_start = p_period_start for update;
  if not found then raise exception 'AU2_PERIOD_NOT_FOUND: %', p_period_start; end if;
  if p.status = 'CLOSED' then raise exception 'AU2_PERIOD_ALREADY_CLOSED: %', p_period_start; end if;
  if coalesce(length(btrim(p_closed_by)),0)=0 or coalesce(length(btrim(p_reason)),0)<10 or coalesce(length(btrim(p_approval_reference)),0)=0 then
    raise exception 'AU2_CLOSE_EVIDENCE_REQUIRED';
  end if;
  select refresh_run_id into v_run from costing.v_costing_run_effective_designation
   where period_start = p_period_start and designation = 'APPROVED' order by designated_at desc limit 1;
  if v_run is null then raise exception 'AU2_CLOSE_REQUIRES_APPROVED_RUN: period %', p_period_start; end if;
  if exists (select 1 from costing.costing_refresh_run where period_start = p_period_start and overall_status in ('QUEUED','RUNNING')) then
    raise exception 'AU2_CLOSE_ACTIVE_RUN: period %', p_period_start;
  end if;
  select count(*) into v_bad from costing.fn_verify_run_fingerprint(v_run) where not matches;
  if v_bad > 0 then raise exception 'AU2_CLOSE_FINGERPRINT_DRIFT: run % has % drifted tables', v_run, v_bad; end if;
  update costing.cost_periods set status='CLOSED', valuation_date_status='FINAL', closed_at=now(), closed_by=auth.uid(),
         close_reason=p_reason, close_approval_reference=p_approval_reference || ' | closed_by=' || p_closed_by || ' | run=' || v_run,
         updated_at=now()
   where period_start = p_period_start;
  return format('CLOSED %s on approved run %s', p_period_start, v_run);
end $$;

revoke all on function costing.rpc_designate_costing_run(bigint,text,text,text) from public, anon, authenticated;
revoke all on function costing.rpc_authorize_period_refresh(date,text,text,int) from public, anon, authenticated;
revoke all on function costing.rpc_close_cost_period(date,text,text,text) from public, anon, authenticated;
grant execute on function costing.rpc_designate_costing_run(bigint,text,text,text) to service_role;
grant execute on function costing.rpc_authorize_period_refresh(date,text,text,int) to service_role;
grant execute on function costing.rpc_close_cost_period(date,text,text,text) to service_role;
grant select on costing.costing_run_designation, costing.costing_run_fingerprint, costing.v_costing_run_effective_designation to authenticated;

-- 7. Current-run selection by designation (same leading columns; selection_basis appended) ---
-- Current-run rule (decided 2026-10-15, documented in AU2_APPLY_RUNBOOK.md):
--   1. latest APPROVED run of the period;
--   2. else latest SUCCESS run with captured context that is NOT designated REFERENCE;
--   3. else the latest REFERENCE run (REFERENCE_FALLBACK, only when no other valid run exists).
-- A REFERENCE run is preserved evidence, never the pricing source while another valid run exists.
-- Columns: identical to live, plus selection_basis appended (dependent views keep working).
create or replace view costing.v_current_successful_costing_refresh_run as
select refresh_run_id, period_start, valuation_date, overall_status, valuation_context_source, source_trigger,
       requested_scope, requested_at, started_at, finished_at, selection_basis
from (
  select r.id as refresh_run_id, r.period_start, r.valuation_date, r.overall_status, r.valuation_context_source,
         r.source_trigger, r.requested_scope, r.requested_at, r.started_at, r.finished_at,
         case e.designation when 'APPROVED' then 'APPROVED' when 'REFERENCE' then 'REFERENCE_FALLBACK' else 'LATEST_SUCCESS' end as selection_basis,
         row_number() over (partition by r.period_start
           order by case e.designation when 'APPROVED' then 1 when 'REFERENCE' then 3 else 2 end,
                    r.finished_at desc nulls last, r.id desc) as governed_run_rank
  from costing.costing_refresh_run r
  left join costing.v_costing_run_effective_designation e
         on e.refresh_run_id = r.id and e.designation in ('REFERENCE','APPROVED')
  where r.overall_status = 'SUCCESS' and r.valuation_context_source = 'CAPTURED_AT_REQUEST'
) ranked
where governed_run_rank = 1;

commit;
