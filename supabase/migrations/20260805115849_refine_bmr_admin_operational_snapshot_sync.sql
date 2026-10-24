-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.bmr_admin_assert_not_operational(p_bmr_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'lab', 'pg_temp'
as $function$
declare
  v_bmr public.bmr_details%rowtype;
  v_work_log_count integer;
  v_analysis_count integer;
  v_control_sample_count integer;
  v_op text := upper(coalesce(current_setting('app.bmr_admin_correction_operation', true), ''));
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

  select count(*)::integer into v_control_sample_count
  from lab.control_sample cs
  where cs.bmr_id = p_bmr_id;

  if (v_work_log_count > 0 or v_analysis_count > 0 or v_control_sample_count > 0)
     and v_op not in ('CORRECT_BMR_NUMBER','CORRECT_BMR_SIZE') then
    raise exception using
      errcode = '23514',
      message = format(
        'BMR %s is operationally used; remap/unlink is blocked (work_logs=%s, lab_analyses=%s, control_samples=%s)',
        p_bmr_id, v_work_log_count, v_analysis_count, v_control_sample_count
      );
  end if;

  return jsonb_build_object(
    'work_log_count', v_work_log_count,
    'lab_analysis_count', v_analysis_count,
    'control_sample_count', v_control_sample_count,
    'operationally_used', (v_work_log_count > 0 or v_analysis_count > 0 or v_control_sample_count > 0),
    'snapshot_sync_required', (
      v_op in ('CORRECT_BMR_NUMBER','CORRECT_BMR_SIZE')
      and (v_work_log_count > 0 or v_analysis_count > 0 or v_control_sample_count > 0)
    )
  );
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
set search_path to 'public', 'lab', 'auth', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_op text := upper(btrim(coalesce(p_operation_type,'')));
  v_reason text := btrim(coalesce(p_reason,''));
  v_batch record;
  v_old_bmr public.bmr_details%rowtype;
  v_target_bmr public.bmr_details%rowtype;
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
  v_work_logs_updated integer := 0;
  v_lab_rows_updated integer := 0;
  v_control_samples_updated integer := 0;
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
      'validation', v_existing.validation_snapshot,
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

  select b.*, h.status as header_status, h.plan_title,
         l.final_make_qty, l.residual_qty, l.batch_count
  into v_batch
  from public.batch_plan_batches b
  join public.batch_plan_headers h on h.id=b.header_id
  join public.batch_plan_lines l on l.id=b.line_id
  where b.id=p_batch_plan_batch_id
  for update of b;

  if not found then
    raise exception using errcode='23514', message='Planned batch not found';
  end if;

  if v_batch.header_status not in ('draft','submitted','applied') then
    raise exception using
      errcode='23514',
      message=format('Administrative correction is only for active draft/submitted/applied plans (current=%s)', v_batch.header_status);
  end if;

  if v_batch.bmr_id is not null then
    select * into v_old_bmr
    from public.bmr_details
    where id=v_batch.bmr_id
    for update;
  end if;

  v_before := jsonb_build_object(
    'plan_batch', jsonb_build_object(
      'id', v_batch.id, 'header_id', v_batch.header_id,
      'header_status', v_batch.header_status, 'line_id', v_batch.line_id,
      'product_id', v_batch.product_id, 'month_start', v_batch.month_start,
      'batch_no_seq', v_batch.batch_no_seq, 'planned_batch_size', v_batch.batch_size,
      'bmr_id', v_batch.bmr_id, 'bmr_linked_at', v_batch.bmr_linked_at,
      'bmr_linked_by', v_batch.bmr_linked_by
    ),
    'bmr', case when v_batch.bmr_id is null then null else to_jsonb(v_old_bmr) end
  );

  perform set_config('app.bmr_admin_correction_request', p_client_request_id::text, true);
  perform set_config('app.bmr_admin_correction_operation', v_op, true);

  if v_op = 'UNLINK_BMR' then
    if v_batch.bmr_id is null then
      raise exception using errcode='23514', message='Planned batch is already unmapped';
    end if;
    v_validation := public.bmr_admin_assert_not_operational(v_batch.bmr_id);
    update public.batch_plan_batches
    set bmr_id=null, bmr_linked_at=null, bmr_linked_by=null, updated_at=now()
    where id=v_batch.id;
    v_result := 'UNLINKED';
    v_new_bmr_id := null; v_new_bn := null; v_new_size := null;

  elsif v_op = 'REMAP_BMR' then
    if p_target_bmr_id is null then
      raise exception using errcode='23514', message='target_bmr_id is required for REMAP_BMR';
    end if;
    if v_batch.bmr_id = p_target_bmr_id then
      raise exception using errcode='23514', message='Target BMR is already mapped to this planned batch';
    end if;
    if v_batch.bmr_id is not null then
      v_validation := jsonb_set(v_validation, '{old_bmr}', public.bmr_admin_assert_not_operational(v_batch.bmr_id), true);
    end if;
    select * into v_target_bmr from public.bmr_details where id=p_target_bmr_id for update;
    if not found then raise exception using errcode='23514', message='Target BMR not found'; end if;
    if v_target_bmr.product_id <> v_batch.product_id then
      raise exception using errcode='23514', message='Target BMR product does not match planned batch product';
    end if;
    if abs(v_target_bmr.batch_size - v_batch.batch_size) > v_epsilon then
      raise exception using errcode='23514', message='Target BMR batch size does not match the planned batch size';
    end if;
    if exists (select 1 from public.batch_plan_batches x where x.bmr_id=p_target_bmr_id and x.id<>v_batch.id) then
      raise exception using errcode='23514', message='Target BMR is already mapped to another planned batch';
    end if;
    v_validation := jsonb_set(v_validation, '{target_bmr}', public.bmr_admin_assert_not_operational(p_target_bmr_id), true);
    update public.batch_plan_batches
    set bmr_id=p_target_bmr_id, bmr_linked_at=now(), bmr_linked_by=v_uid, updated_at=now()
    where id=v_batch.id;
    v_result := 'REMAPPED';
    v_new_bmr_id := p_target_bmr_id; v_new_bn := v_target_bmr.bn; v_new_size := v_target_bmr.batch_size;

  elsif v_op = 'CORRECT_BMR_NUMBER' then
    if v_batch.bmr_id is null then raise exception using errcode='23514', message='A mapped BMR is required for number correction'; end if;
    if nullif(btrim(coalesce(p_new_bn,'')),'') is null then raise exception using errcode='23514', message='new_bn is required'; end if;
    if btrim(p_new_bn) = v_old_bmr.bn then raise exception using errcode='23514', message='New BMR number is unchanged'; end if;

    v_validation := public.bmr_admin_assert_not_operational(v_batch.bmr_id);

    update public.bmr_details set bn=btrim(p_new_bn) where id=v_batch.bmr_id;

    update public.daily_work_log
    set batch_number=btrim(p_new_bn)
    where lower(btrim(item))=lower(btrim(v_old_bmr.item))
      and btrim(batch_number)=btrim(v_old_bmr.bn);
    get diagnostics v_work_logs_updated = row_count;

    update lab.analysis_record
    set batch_no_snapshot=btrim(p_new_bn), updated_at=now(), updated_by=v_uid
    where bmr_id=v_batch.bmr_id;
    get diagnostics v_lab_rows_updated = row_count;

    update lab.control_sample
    set batch_no_snapshot=btrim(p_new_bn), updated_at=now(), updated_by=v_uid
    where bmr_id=v_batch.bmr_id;
    get diagnostics v_control_samples_updated = row_count;

    v_validation := v_validation || jsonb_build_object(
      'snapshot_sync', jsonb_build_object(
        'work_logs_updated', v_work_logs_updated,
        'lab_analyses_updated', v_lab_rows_updated,
        'control_samples_updated', v_control_samples_updated
      )
    );

    v_result := 'BMR_NUMBER_CORRECTED_MAPPING_RETAINED';
    v_new_bmr_id := v_batch.bmr_id; v_new_bn := btrim(p_new_bn); v_new_size := v_old_bmr.batch_size;

  elsif v_op = 'CORRECT_BMR_SIZE' then
    if v_batch.bmr_id is null then raise exception using errcode='23514', message='A mapped BMR is required for size correction'; end if;
    if p_new_batch_size is null or p_new_batch_size <= 0 then raise exception using errcode='23514', message='new_batch_size must be greater than zero'; end if;
    if p_new_batch_size is not distinct from v_old_bmr.batch_size then raise exception using errcode='23514', message='New BMR batch size is unchanged'; end if;

    v_validation := public.bmr_admin_assert_not_operational(v_batch.bmr_id);

    update public.bmr_details set batch_size=p_new_batch_size where id=v_batch.bmr_id;

    update public.daily_work_log
    set batch_size=p_new_batch_size
    where lower(btrim(item))=lower(btrim(v_old_bmr.item))
      and btrim(batch_number)=btrim(v_old_bmr.bn);
    get diagnostics v_work_logs_updated = row_count;

    update lab.analysis_record
    set batch_size_snapshot=p_new_batch_size, updated_at=now(), updated_by=v_uid
    where bmr_id=v_batch.bmr_id;
    get diagnostics v_lab_rows_updated = row_count;

    v_validation := v_validation || jsonb_build_object(
      'snapshot_sync', jsonb_build_object(
        'work_logs_updated', v_work_logs_updated,
        'lab_analyses_updated', v_lab_rows_updated,
        'process_output_quantities_changed', false
      )
    );

    v_new_bmr_id := v_batch.bmr_id; v_new_bn := v_old_bmr.bn; v_new_size := p_new_batch_size;
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
      'id', b.id, 'header_id', b.header_id, 'line_id', b.line_id,
      'product_id', b.product_id, 'month_start', b.month_start,
      'batch_no_seq', b.batch_no_seq, 'planned_batch_size', b.batch_size,
      'bmr_id', b.bmr_id, 'bmr_linked_at', b.bmr_linked_at,
      'bmr_linked_by', b.bmr_linked_by
    ),
    'bmr', case when coalesce(b.bmr_id, v_batch.bmr_id) is null then null
                else (select to_jsonb(d) from public.bmr_details d where d.id=coalesce(b.bmr_id, v_batch.bmr_id)) end
  ) into v_after
  from public.batch_plan_batches b where b.id=v_batch.id;

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
    v_new_size, v_batch.batch_size,
    case when v_batch.bmr_id is null then v_target_bmr.uom else v_old_bmr.uom end,
    v_reason, nullif(btrim(coalesce(p_supporting_reference,'')),''), true,
    v_before, v_after, v_validation,
    v_uid, v_uid
  );

  return jsonb_build_object(
    'correction_no', v_correction_no, 'operation_type', v_op,
    'operation_result', v_result, 'status', 'COMPLETED',
    'batch_plan_batch_id', v_batch.id, 'header_id', v_batch.header_id,
    'header_status', v_batch.header_status, 'old_bmr_id', v_batch.bmr_id,
    'new_bmr_id', v_new_bmr_id,
    'old_bn', case when v_batch.bmr_id is null then null else v_old_bmr.bn end,
    'new_bn', v_new_bn,
    'old_batch_size', case when v_batch.bmr_id is null then null else v_old_bmr.batch_size end,
    'new_batch_size', v_new_size, 'planned_batch_size', v_batch.batch_size,
    'plan_batch_size_changed', false,
    'snapshot_sync', coalesce(v_validation->'snapshot_sync','{}'::jsonb),
    'executed_at', now(), 'idempotent_replay', false
  );
end;
$function$;

create or replace function public.rpc_preview_bmr_admin_correction(p_batch_plan_batch_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'lab', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_work_logs integer := 0;
  v_lab integer := 0;
  v_control_samples integer := 0;
  v_operational boolean := false;
begin
  if v_uid is null then raise exception using errcode='42501', message='Not authenticated'; end if;
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

  if not found then raise exception using errcode='23514', message='Planned batch not found'; end if;

  if v_row.bmr_id is not null then
    select count(*)::integer into v_work_logs
    from public.daily_work_log dwl
    where lower(btrim(dwl.item))=lower(btrim(v_row.product_name))
      and btrim(dwl.batch_number)=btrim(v_row.bn);
    select count(*)::integer into v_lab from lab.analysis_record ar where ar.bmr_id=v_row.bmr_id;
    select count(*)::integer into v_control_samples from lab.control_sample cs where cs.bmr_id=v_row.bmr_id;
  end if;
  v_operational := (v_work_logs>0 or v_lab>0 or v_control_samples>0);

  return jsonb_build_object(
    'plan_batch', to_jsonb(v_row),
    'operational_evidence', jsonb_build_object(
      'work_log_count', v_work_logs,
      'lab_analysis_count', v_lab,
      'control_sample_count', v_control_samples,
      'operationally_used', v_operational,
      'correction_blocked', false,
      'snapshot_sync_available', true
    ),
    'operation_policy', jsonb_build_object(
      'CORRECT_BMR_NUMBER', jsonb_build_object('allowed', true, 'snapshot_sync', v_operational),
      'CORRECT_BMR_SIZE', jsonb_build_object('allowed', true, 'snapshot_sync', v_operational, 'process_output_preserved', true),
      'UNLINK_BMR', jsonb_build_object('allowed', not v_operational, 'blocked_by_operational_evidence', v_operational),
      'REMAP_BMR', jsonb_build_object('allowed', not v_operational, 'blocked_by_operational_evidence', v_operational)
    ),
    'permissions', jsonb_build_object(
      'can_view_manager_bmr', public.app_has_permission('module:manage-bmr','view'),
      'can_admin_correct', public.app_has_permission('role:manager-bmr-admin-correction','edit')
    ),
    'rules', jsonb_build_object(
      'plan_batch_size_is_immutable', true,
      'size_mismatch_auto_unlinks', true,
      'operational_snapshot_sync', true,
      'process_output_quantities_preserved', true,
      'eligible_plan_statuses', jsonb_build_array('draft','submitted','applied')
    )
  );
end;
$function$;