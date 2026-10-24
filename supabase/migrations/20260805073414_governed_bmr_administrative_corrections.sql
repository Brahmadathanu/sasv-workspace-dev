-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

insert into public.permission_targets(key, kind, label, sort_order, is_assignable, meta)
select
  'role:manager-bmr-admin-correction',
  'role',
  'Role — Manager BMR — Administrative Correction',
  955,
  true,
  jsonb_build_object(
    'module', 'module:manage-bmr',
    'purpose', 'Governed correction of BMR identity, size and applied-plan mapping'
  )
where not exists (
  select 1 from public.permission_targets
  where key = 'role:manager-bmr-admin-correction'
);

insert into public.user_permissions_canonical(user_id, target, can_view, can_edit, meta, updated_at)
select
  up.user_id,
  'role:manager-bmr-admin-correction',
  true,
  true,
  jsonb_build_object('seed_source', 'module:admin-console', 'seeded_at', now()),
  now()
from public.user_permissions_canonical up
where up.target = 'module:admin-console'
  and up.can_edit = true
  and not exists (
    select 1
    from public.user_permissions_canonical x
    where x.user_id = up.user_id
      and x.target = 'role:manager-bmr-admin-correction'
  );

create sequence if not exists public.bmr_admin_correction_no_seq;

create table if not exists public.bmr_administrative_corrections (
  id bigint generated always as identity primary key,
  correction_no text not null unique,
  client_request_id uuid not null unique,
  operation_type text not null,
  operation_result text not null,
  status text not null default 'COMPLETED',
  batch_plan_batch_id bigint not null references public.batch_plan_batches(id) on delete restrict,
  batch_plan_header_id bigint not null references public.batch_plan_headers(id) on delete restrict,
  product_id bigint not null references public.products(id) on delete restrict,
  old_bmr_id integer references public.bmr_details(id) on delete restrict,
  new_bmr_id integer references public.bmr_details(id) on delete restrict,
  old_bn text,
  new_bn text,
  old_bmr_batch_size numeric,
  new_bmr_batch_size numeric,
  planned_batch_size numeric not null,
  uom text,
  reason text not null,
  supporting_reference text,
  impact_acknowledged boolean not null,
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  validation_snapshot jsonb not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  executed_by uuid not null,
  executed_at timestamptz not null default now(),
  constraint bmr_admin_correction_operation_ck check (
    operation_type in ('REMAP_BMR','UNLINK_BMR','CORRECT_BMR_NUMBER','CORRECT_BMR_SIZE')
  ),
  constraint bmr_admin_correction_status_ck check (status = 'COMPLETED'),
  constraint bmr_admin_correction_reason_ck check (length(btrim(reason)) >= 10),
  constraint bmr_admin_correction_ack_ck check (impact_acknowledged = true)
);

create index if not exists ix_bmr_admin_correction_bmr_old
  on public.bmr_administrative_corrections(old_bmr_id, executed_at desc);
create index if not exists ix_bmr_admin_correction_bmr_new
  on public.bmr_administrative_corrections(new_bmr_id, executed_at desc);
create index if not exists ix_bmr_admin_correction_plan_batch
  on public.bmr_administrative_corrections(batch_plan_batch_id, executed_at desc);
create index if not exists ix_bmr_admin_correction_product
  on public.bmr_administrative_corrections(product_id, executed_at desc);

alter table public.bmr_administrative_corrections enable row level security;

revoke all on table public.bmr_administrative_corrections from public, anon, authenticated;
grant select on table public.bmr_administrative_corrections to service_role;

create or replace function public.bmr_admin_audit_immutable_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  raise exception using
    errcode = '55000',
    message = 'BMR administrative correction history is immutable';
end;
$function$;

revoke all on function public.bmr_admin_audit_immutable_guard() from public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bmr_admin_audit_immutable ON public.bmr_administrative_corrections;
CREATE TRIGGER trg_bmr_admin_audit_immutable
BEFORE UPDATE OR DELETE ON public.bmr_administrative_corrections
FOR EACH ROW EXECUTE FUNCTION public.bmr_admin_audit_immutable_guard();

create or replace function public.bmr_admin_assert_not_operational(p_bmr_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public, lab, pg_temp
as $function$
declare
  v_bmr public.bmr_details%rowtype;
  v_work_log_count integer;
  v_analysis_count integer;
begin
  select * into v_bmr
  from public.bmr_details
  where id = p_bmr_id;

  if not found then
    raise exception using errcode='23514', message=format('BMR %s not found', p_bmr_id);
  end if;

  select count(*)::integer into v_work_log_count
  from public.daily_work_log d
  where lower(btrim(d.item)) = lower(btrim(v_bmr.item))
    and btrim(d.batch_number) = btrim(v_bmr.bn);

  select count(*)::integer into v_analysis_count
  from lab.analysis_record ar
  where ar.bmr_id = p_bmr_id;

  if v_work_log_count > 0 or v_analysis_count > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'BMR %s is operationally used; administrative identity/size/mapping correction is blocked (work_logs=%s, lab_analyses=%s)',
        p_bmr_id, v_work_log_count, v_analysis_count
      );
  end if;

  return jsonb_build_object(
    'work_log_count', v_work_log_count,
    'lab_analysis_count', v_analysis_count,
    'operationally_used', false
  );
end;
$function$;

revoke all on function public.bmr_admin_assert_not_operational(integer) from public, anon, authenticated;

create or replace function public.bmr_block_changes_if_mapped()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_mapped boolean;
  v_admin_gate boolean := false;
begin
  v_admin_gate :=
    current_user in ('postgres','service_role')
    and nullif(current_setting('app.bmr_admin_correction_request', true), '') is not null;

  select exists (
    select 1 from public.batch_plan_batches b
    where b.bmr_id = old.id
  ) into v_mapped;

  if tg_op = 'DELETE' then
    if v_mapped then
      raise exception using
        errcode = '23503',
        message = format('BMR id=%s cannot be deleted: it is linked to batch_plan_batches', old.id);
    end if;
    return old;
  end if;

  if v_mapped
     and (new.bn is distinct from old.bn or new.batch_size is distinct from old.batch_size)
     and not v_admin_gate then
    raise exception using
      errcode = '23514',
      message = format('BMR %s is mapped to a plan; BN/size cannot be changed directly', old.id);
  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_bmr_lock_if_mapped ON public.bmr_details;

create or replace function public.trg_bpb_edit_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_status text;
  v_force_unlink boolean := false;
  v_admin_gate boolean := false;
begin
  v_force_unlink := current_setting('app.allow_force_unlink', true) = '1';
  v_admin_gate :=
    current_user in ('postgres','service_role')
    and nullif(current_setting('app.bmr_admin_correction_request', true), '') is not null;

  select status into v_status
  from public.batch_plan_headers
  where id = case when tg_op='DELETE' then old.header_id else new.header_id end;

  if tg_op = 'UPDATE' and v_admin_gate then
    if new.header_id is not distinct from old.header_id
       and new.line_id is not distinct from old.line_id
       and new.product_id is not distinct from old.product_id
       and new.month_start is not distinct from old.month_start
       and new.batch_no_seq is not distinct from old.batch_no_seq
       and new.batch_size is not distinct from old.batch_size
       and new.source_rule is not distinct from old.source_rule
       and new.notes is not distinct from old.notes
    then
      return new;
    end if;

    raise exception using
      errcode='23514',
      message=format('Administrative correction may change only the BMR mapping of planned batch %s', old.id);
  end if;

  if v_force_unlink
     and tg_op = 'UPDATE'
     and old.bmr_id is not null
     and new.bmr_id is null
     and new.batch_size is not distinct from old.batch_size
     and new.product_id is not distinct from old.product_id
     and new.month_start is not distinct from old.month_start
  then
    return new;
  end if;

  if v_status = 'applied' then
    raise exception using
      errcode='23514',
      message=format('Batch plan header %s is applied (read-only)', case when tg_op='DELETE' then old.header_id else new.header_id end);
  end if;

  if tg_op = 'DELETE' and old.bmr_id is not null then
    raise exception using
      errcode='23514',
      message=format('Planned batch %s is already mapped to a BMR (read-only)', old.id);
  end if;

  if tg_op = 'UPDATE' and old.bmr_id is not null then
    if new.bmr_id is not null and new.bmr_id <> old.bmr_id then
      raise exception using
        errcode='23514',
        message=format('Planned batch %s is already mapped to BMR %s (cannot remap directly)', new.id, old.bmr_id);
    end if;

    if new.batch_size is distinct from old.batch_size
       or new.product_id is distinct from old.product_id
       or new.month_start is distinct from old.month_start then
      raise exception using
        errcode='23514',
        message=format('Mapped batch %s cannot be structurally edited', new.id);
    end if;
  end if;

  return case when tg_op='DELETE' then old else new end;
end;
$function$;

create or replace function public.rpc_admin_correct_bmr_plan_mapping(
  p_operation_type text,
  p_batch_plan_batch_id bigint,
  p_target_bmr_id integer default null,
  p_new_bn text default null,
  p_new_batch_size numeric default null,
  p_reason text default null,
  p_supporting_reference text default null,
  p_impact_acknowledged boolean default false,
  p_client_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, lab, auth, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_op text := upper(btrim(coalesce(p_operation_type,'')));
  v_reason text := btrim(coalesce(p_reason,''));
  v_batch record;
  v_old_bmr record;
  v_target_bmr record;
  v_before jsonb;
  v_after jsonb;
  v_validation jsonb := '{}'::jsonb;
  v_result text;
  v_new_bmr_id integer;
  v_new_bn text;
  v_new_size numeric;
  v_correction_no text;
  v_existing public.bmr_administrative_corrections%rowtype;
  v_epsilon numeric := 0.000001;
begin
  if v_uid is null then
    raise exception using errcode='42501', message='Not authenticated';
  end if;

  perform public.require_permission('role:manager-bmr-admin-correction', true);

  if p_client_request_id is null then
    raise exception using errcode='23514', message='client_request_id is required';
  end if;

  select * into v_existing
  from public.bmr_administrative_corrections
  where client_request_id = p_client_request_id;

  if found then
    if v_existing.requested_by <> v_uid then
      raise exception using errcode='42501', message='client_request_id belongs to another user';
    end if;
    return jsonb_build_object(
      'correction_id', v_existing.id,
      'correction_no', v_existing.correction_no,
      'operation_type', v_existing.operation_type,
      'operation_result', v_existing.operation_result,
      'status', v_existing.status,
      'batch_plan_batch_id', v_existing.batch_plan_batch_id,
      'old_bmr_id', v_existing.old_bmr_id,
      'new_bmr_id', v_existing.new_bmr_id,
      'old_bn', v_existing.old_bn,
      'new_bn', v_existing.new_bn,
      'old_batch_size', v_existing.old_bmr_batch_size,
      'new_batch_size', v_existing.new_bmr_batch_size,
      'planned_batch_size', v_existing.planned_batch_size,
      'executed_at', v_existing.executed_at,
      'idempotent_replay', true
    );
  end if;

  if v_op not in ('REMAP_BMR','UNLINK_BMR','CORRECT_BMR_NUMBER','CORRECT_BMR_SIZE') then
    raise exception using errcode='23514', message='Invalid administrative correction operation';
  end if;
  if length(v_reason) < 10 then
    raise exception using errcode='23514', message='A clear correction reason of at least 10 characters is required';
  end if;
  if coalesce(p_impact_acknowledged,false) is not true then
    raise exception using errcode='23514', message='Operational impact acknowledgement is required';
  end if;

  select
    b.*,
    h.status as header_status,
    h.plan_title,
    l.final_make_qty,
    l.residual_qty,
    l.batch_count
  into v_batch
  from public.batch_plan_batches b
  join public.batch_plan_headers h on h.id=b.header_id
  join public.batch_plan_lines l on l.id=b.line_id
  where b.id=p_batch_plan_batch_id
  for update of b;

  if not found then
    raise exception using errcode='23514', message='Planned batch not found';
  end if;

  if v_batch.header_status not in ('submitted','applied') then
    raise exception using
      errcode='23514',
      message=format('Administrative correction is only for submitted/applied plans (current=%s)', v_batch.header_status);
  end if;

  if v_batch.bmr_id is not null then
    select * into v_old_bmr
    from public.bmr_details
    where id=v_batch.bmr_id
    for update;
  end if;

  v_before := jsonb_build_object(
    'plan_batch', jsonb_build_object(
      'id', v_batch.id,
      'header_id', v_batch.header_id,
      'header_status', v_batch.header_status,
      'line_id', v_batch.line_id,
      'product_id', v_batch.product_id,
      'month_start', v_batch.month_start,
      'batch_no_seq', v_batch.batch_no_seq,
      'planned_batch_size', v_batch.batch_size,
      'bmr_id', v_batch.bmr_id,
      'bmr_linked_at', v_batch.bmr_linked_at,
      'bmr_linked_by', v_batch.bmr_linked_by
    ),
    'bmr', case when v_batch.bmr_id is null then null else to_jsonb(v_old_bmr) end
  );

  perform set_config('app.bmr_admin_correction_request', p_client_request_id::text, true);

  if v_op = 'UNLINK_BMR' then
    if v_batch.bmr_id is null then
      raise exception using errcode='23514', message='Planned batch is already unmapped';
    end if;

    v_validation := public.bmr_admin_assert_not_operational(v_batch.bmr_id);

    update public.batch_plan_batches
    set bmr_id=null, bmr_linked_at=null, bmr_linked_by=null, updated_at=now()
    where id=v_batch.id;

    v_result := 'UNLINKED';
    v_new_bmr_id := null;
    v_new_bn := null;
    v_new_size := null;

  elsif v_op = 'REMAP_BMR' then
    if p_target_bmr_id is null then
      raise exception using errcode='23514', message='target_bmr_id is required for REMAP_BMR';
    end if;
    if v_batch.bmr_id = p_target_bmr_id then
      raise exception using errcode='23514', message='Target BMR is already mapped to this planned batch';
    end if;

    if v_batch.bmr_id is not null then
      v_validation := jsonb_set(
        v_validation,
        '{old_bmr}',
        public.bmr_admin_assert_not_operational(v_batch.bmr_id),
        true
      );
    end if;

    select * into v_target_bmr
    from public.bmr_details
    where id=p_target_bmr_id
    for update;

    if not found then
      raise exception using errcode='23514', message='Target BMR not found';
    end if;
    if v_target_bmr.product_id <> v_batch.product_id then
      raise exception using errcode='23514', message='Target BMR product does not match planned batch product';
    end if;
    if abs(v_target_bmr.batch_size - v_batch.batch_size) > v_epsilon then
      raise exception using errcode='23514', message='Target BMR batch size does not match the planned batch size';
    end if;
    if exists (
      select 1 from public.batch_plan_batches x
      where x.bmr_id=p_target_bmr_id and x.id<>v_batch.id
    ) then
      raise exception using errcode='23514', message='Target BMR is already mapped to another planned batch';
    end if;

    v_validation := jsonb_set(
      v_validation,
      '{target_bmr}',
      public.bmr_admin_assert_not_operational(p_target_bmr_id),
      true
    );

    update public.batch_plan_batches
    set bmr_id=p_target_bmr_id,
        bmr_linked_at=now(),
        bmr_linked_by=v_uid,
        updated_at=now()
    where id=v_batch.id;

    v_result := 'REMAPPED';
    v_new_bmr_id := p_target_bmr_id;
    v_new_bn := v_target_bmr.bn;
    v_new_size := v_target_bmr.batch_size;

  elsif v_op = 'CORRECT_BMR_NUMBER' then
    if v_batch.bmr_id is null then
      raise exception using errcode='23514', message='A mapped BMR is required for number correction';
    end if;
    if nullif(btrim(coalesce(p_new_bn,'')),'') is null then
      raise exception using errcode='23514', message='new_bn is required';
    end if;
    if btrim(p_new_bn) = v_old_bmr.bn then
      raise exception using errcode='23514', message='New BMR number is unchanged';
    end if;

    v_validation := public.bmr_admin_assert_not_operational(v_batch.bmr_id);

    update public.bmr_details
    set bn=btrim(p_new_bn)
    where id=v_batch.bmr_id;

    v_result := 'BMR_NUMBER_CORRECTED_MAPPING_RETAINED';
    v_new_bmr_id := v_batch.bmr_id;
    v_new_bn := btrim(p_new_bn);
    v_new_size := v_old_bmr.batch_size;

  elsif v_op = 'CORRECT_BMR_SIZE' then
    if v_batch.bmr_id is null then
      raise exception using errcode='23514', message='A mapped BMR is required for size correction';
    end if;
    if p_new_batch_size is null or p_new_batch_size <= 0 then
      raise exception using errcode='23514', message='new_batch_size must be greater than zero';
    end if;
    if p_new_batch_size is not distinct from v_old_bmr.batch_size then
      raise exception using errcode='23514', message='New BMR batch size is unchanged';
    end if;

    v_validation := public.bmr_admin_assert_not_operational(v_batch.bmr_id);

    update public.bmr_details
    set batch_size=p_new_batch_size
    where id=v_batch.bmr_id;

    v_new_bmr_id := v_batch.bmr_id;
    v_new_bn := v_old_bmr.bn;
    v_new_size := p_new_batch_size;

    if abs(p_new_batch_size - v_batch.batch_size) > v_epsilon then
      update public.batch_plan_batches
      set bmr_id=null, bmr_linked_at=null, bmr_linked_by=null, updated_at=now()
      where id=v_batch.id;
      v_result := 'BMR_SIZE_CORRECTED_AUTO_UNLINKED_SIZE_MISMATCH';
      v_new_bmr_id := null;
    else
      v_result := 'BMR_SIZE_CORRECTED_MAPPING_RETAINED';
    end if;
  end if;

  select jsonb_build_object(
    'plan_batch', jsonb_build_object(
      'id', b.id,
      'header_id', b.header_id,
      'line_id', b.line_id,
      'product_id', b.product_id,
      'month_start', b.month_start,
      'batch_no_seq', b.batch_no_seq,
      'planned_batch_size', b.batch_size,
      'bmr_id', b.bmr_id,
      'bmr_linked_at', b.bmr_linked_at,
      'bmr_linked_by', b.bmr_linked_by
    ),
    'bmr', case when coalesce(b.bmr_id, v_batch.bmr_id) is null then null
                else (select to_jsonb(d) from public.bmr_details d where d.id=coalesce(b.bmr_id, v_batch.bmr_id)) end
  )
  into v_after
  from public.batch_plan_batches b
  where b.id=v_batch.id;

  v_correction_no := 'BMR-AC-' || to_char(current_date,'YYYY') || '-' || lpad(nextval('public.bmr_admin_correction_no_seq')::text, 6, '0');

  insert into public.bmr_administrative_corrections(
    correction_no, client_request_id, operation_type, operation_result,
    batch_plan_batch_id, batch_plan_header_id, product_id,
    old_bmr_id, new_bmr_id, old_bn, new_bn,
    old_bmr_batch_size, new_bmr_batch_size, planned_batch_size, uom,
    reason, supporting_reference, impact_acknowledged,
    before_snapshot, after_snapshot, validation_snapshot,
    requested_by, executed_by
  ) values (
    v_correction_no, p_client_request_id, v_op, v_result,
    v_batch.id, v_batch.header_id, v_batch.product_id,
    v_batch.bmr_id, v_new_bmr_id,
    case when v_batch.bmr_id is null then null else v_old_bmr.bn end,
    v_new_bn,
    case when v_batch.bmr_id is null then null else v_old_bmr.batch_size end,
    v_new_size,
    v_batch.batch_size,
    case when v_batch.bmr_id is null then v_target_bmr.uom else v_old_bmr.uom end,
    v_reason, nullif(btrim(coalesce(p_supporting_reference,'')),''), true,
    v_before, v_after, v_validation,
    v_uid, v_uid
  );

  return jsonb_build_object(
    'correction_no', v_correction_no,
    'operation_type', v_op,
    'operation_result', v_result,
    'status', 'COMPLETED',
    'batch_plan_batch_id', v_batch.id,
    'header_id', v_batch.header_id,
    'header_status', v_batch.header_status,
    'old_bmr_id', v_batch.bmr_id,
    'new_bmr_id', v_new_bmr_id,
    'old_bn', case when v_batch.bmr_id is null then null else v_old_bmr.bn end,
    'new_bn', v_new_bn,
    'old_batch_size', case when v_batch.bmr_id is null then null else v_old_bmr.batch_size end,
    'new_batch_size', v_new_size,
    'planned_batch_size', v_batch.batch_size,
    'plan_batch_size_changed', false,
    'executed_at', now(),
    'idempotent_replay', false
  );
end;
$function$;

revoke all on function public.rpc_admin_correct_bmr_plan_mapping(text,bigint,integer,text,numeric,text,text,boolean,uuid) from public, anon;
grant execute on function public.rpc_admin_correct_bmr_plan_mapping(text,bigint,integer,text,numeric,text,text,boolean,uuid) to authenticated, service_role;

create or replace function public.rpc_get_bmr_admin_correction_history(
  p_bmr_id integer default null,
  p_batch_plan_batch_id bigint default null,
  p_limit integer default 100
)
returns table(
  correction_no text,
  operation_type text,
  operation_result text,
  batch_plan_batch_id bigint,
  batch_plan_header_id bigint,
  product_id bigint,
  old_bmr_id integer,
  new_bmr_id integer,
  old_bn text,
  new_bn text,
  old_bmr_batch_size numeric,
  new_bmr_batch_size numeric,
  planned_batch_size numeric,
  reason text,
  supporting_reference text,
  executed_by uuid,
  executed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.require_permission('module:manage-bmr', false);

  return query
  select
    c.correction_no, c.operation_type, c.operation_result,
    c.batch_plan_batch_id, c.batch_plan_header_id, c.product_id,
    c.old_bmr_id, c.new_bmr_id, c.old_bn, c.new_bn,
    c.old_bmr_batch_size, c.new_bmr_batch_size, c.planned_batch_size,
    c.reason, c.supporting_reference, c.executed_by, c.executed_at
  from public.bmr_administrative_corrections c
  where (p_bmr_id is null or c.old_bmr_id=p_bmr_id or c.new_bmr_id=p_bmr_id)
    and (p_batch_plan_batch_id is null or c.batch_plan_batch_id=p_batch_plan_batch_id)
  order by c.executed_at desc, c.id desc
  limit greatest(1, least(coalesce(p_limit,100),500));
end;
$function$;

revoke all on function public.rpc_get_bmr_admin_correction_history(integer,bigint,integer) from public, anon;
grant execute on function public.rpc_get_bmr_admin_correction_history(integer,bigint,integer) to authenticated, service_role;

create or replace function public.rpc_preview_bmr_admin_correction(p_batch_plan_batch_id bigint)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, lab, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_work_logs integer := 0;
  v_lab integer := 0;
begin
  if v_uid is null then
    raise exception using errcode='42501', message='Not authenticated';
  end if;
  perform public.require_permission('module:manage-bmr', false);

  select b.id, b.header_id, h.status header_status, h.plan_title,
         b.line_id, b.product_id, p.item product_name,
         b.month_start, b.batch_no_seq, b.batch_size planned_batch_size,
         b.bmr_id, d.bn, d.batch_size bmr_batch_size, d.uom,
         b.bmr_linked_at, b.bmr_linked_by
  into v_row
  from public.batch_plan_batches b
  join public.batch_plan_headers h on h.id=b.header_id
  join public.products p on p.id=b.product_id
  left join public.bmr_details d on d.id=b.bmr_id
  where b.id=p_batch_plan_batch_id;

  if not found then
    raise exception using errcode='23514', message='Planned batch not found';
  end if;

  if v_row.bmr_id is not null then
    select count(*)::integer into v_work_logs
    from public.daily_work_log dwl
    where lower(btrim(dwl.item))=lower(btrim(v_row.product_name))
      and btrim(dwl.batch_number)=btrim(v_row.bn);

    select count(*)::integer into v_lab
    from lab.analysis_record ar
    where ar.bmr_id=v_row.bmr_id;
  end if;

  return jsonb_build_object(
    'plan_batch', to_jsonb(v_row),
    'operational_evidence', jsonb_build_object(
      'work_log_count', v_work_logs,
      'lab_analysis_count', v_lab,
      'correction_blocked', (v_work_logs>0 or v_lab>0)
    ),
    'permissions', jsonb_build_object(
      'can_view_manager_bmr', public.app_has_permission('module:manage-bmr','view'),
      'can_admin_correct', public.app_has_permission('role:manager-bmr-admin-correction','edit')
    ),
    'rules', jsonb_build_object(
      'plan_batch_size_is_immutable', true,
      'size_mismatch_auto_unlinks', true,
      'eligible_plan_statuses', jsonb_build_array('submitted','applied')
    )
  );
end;
$function$;

revoke all on function public.rpc_preview_bmr_admin_correction(bigint) from public, anon;
grant execute on function public.rpc_preview_bmr_admin_correction(bigint) to authenticated, service_role;

commit;