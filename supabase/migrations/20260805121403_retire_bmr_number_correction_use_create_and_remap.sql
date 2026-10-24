-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Retire in-place BMR number correction.
-- Correct practice: create the required BMR identity, then governed remap when eligible.

alter function public.rpc_admin_correct_bmr_plan_mapping(
  text,bigint,integer,text,numeric,text,text,boolean,uuid
) rename to rpc_admin_correct_bmr_plan_mapping_internal_v1;

revoke all on function public.rpc_admin_correct_bmr_plan_mapping_internal_v1(
  text,bigint,integer,text,numeric,text,text,boolean,uuid
) from public, anon, authenticated, service_role;

create function public.rpc_admin_correct_bmr_plan_mapping(
  p_operation_type text,
  p_batch_plan_batch_id bigint,
  p_target_bmr_id integer default null,
  p_new_bn text default null,
  p_new_batch_size numeric default null,
  p_reason text default null,
  p_supporting_reference text default null,
  p_impact_acknowledged boolean default false,
  p_client_request_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = public, lab, auth, pg_temp
as $$
declare
  v_op text := upper(btrim(coalesce(p_operation_type,'')));
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Not authenticated';
  end if;

  perform public.require_permission('role:manager-bmr-admin-correction', true);

  if v_op = 'CORRECT_BMR_NUMBER' then
    raise exception using
      errcode='23514',
      message='BMR number correction is retired. Create the BMR with the required batch number and use governed REMAP_BMR when eligible.';
  end if;

  if v_op not in ('REMAP_BMR','UNLINK_BMR','CORRECT_BMR_SIZE') then
    raise exception using errcode='23514', message='Invalid administrative correction operation';
  end if;

  return public.rpc_admin_correct_bmr_plan_mapping_internal_v1(
    p_operation_type,
    p_batch_plan_batch_id,
    p_target_bmr_id,
    null,
    p_new_batch_size,
    p_reason,
    p_supporting_reference,
    p_impact_acknowledged,
    p_client_request_id
  );
end;
$$;

revoke all on function public.rpc_admin_correct_bmr_plan_mapping(
  text,bigint,integer,text,numeric,text,text,boolean,uuid
) from public, anon;
grant execute on function public.rpc_admin_correct_bmr_plan_mapping(
  text,bigint,integer,text,numeric,text,text,boolean,uuid
) to authenticated, service_role;

comment on function public.rpc_admin_correct_bmr_plan_mapping(
  text,bigint,integer,text,numeric,text,text,boolean,uuid
) is 'Governed BMR plan correction endpoint. Supported operations: REMAP_BMR, UNLINK_BMR, CORRECT_BMR_SIZE. In-place BMR number correction is retired; create the correct BMR and remap.';

create or replace function public.bmr_block_changes_if_mapped()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mapped boolean;
  v_admin_size_gate boolean := false;
begin
  v_admin_size_gate :=
    current_user in ('postgres','service_role')
    and nullif(current_setting('app.bmr_admin_correction_request', true), '') is not null
    and upper(coalesce(current_setting('app.bmr_admin_correction_operation', true),'')) = 'CORRECT_BMR_SIZE';

  select exists (
    select 1 from public.batch_plan_batches b where b.bmr_id = old.id
  ) into v_mapped;

  if tg_op = 'DELETE' then
    if v_mapped then
      raise exception using
        errcode='23503',
        message=format('BMR id=%s cannot be deleted: it is linked to batch_plan_batches', old.id);
    end if;
    return old;
  end if;

  if v_mapped and new.bn is distinct from old.bn then
    raise exception using
      errcode='23514',
      message=format('BMR % is mapped to a plan; its batch number is immutable. Create the correct BMR and remap instead.', old.id);
  end if;

  if v_mapped
     and new.batch_size is distinct from old.batch_size
     and not v_admin_size_gate then
    raise exception using
      errcode='23514',
      message=format('BMR % is mapped to a plan; size cannot be changed directly', old.id);
  end if;

  return new;
end;
$$;

create or replace function public.rpc_preview_bmr_admin_correction(p_batch_plan_batch_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, lab, pg_temp
as $$
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
      'CORRECT_BMR_NUMBER', jsonb_build_object(
        'allowed', false,
        'retired', true,
        'replacement_workflow', 'CREATE_BMR_THEN_REMAP',
        'reason', 'BMR batch number is an identity and must not be changed in place'
      ),
      'CORRECT_BMR_SIZE', jsonb_build_object(
        'allowed', true,
        'snapshot_sync', v_operational,
        'process_output_preserved', true
      ),
      'UNLINK_BMR', jsonb_build_object(
        'allowed', not v_operational,
        'blocked_by_operational_evidence', v_operational
      ),
      'REMAP_BMR', jsonb_build_object(
        'allowed', not v_operational,
        'blocked_by_operational_evidence', v_operational
      )
    ),
    'permissions', jsonb_build_object(
      'can_view_manager_bmr', public.app_has_permission('module:manage-bmr','view'),
      'can_admin_correct', public.app_has_permission('role:manager-bmr-admin-correction','edit')
    ),
    'rules', jsonb_build_object(
      'bmr_number_is_immutable', true,
      'number_correction_replacement_workflow', 'CREATE_BMR_THEN_REMAP',
      'plan_batch_size_is_immutable', true,
      'size_mismatch_auto_unlinks', true,
      'operational_snapshot_sync', true,
      'process_output_quantities_preserved', true,
      'eligible_plan_statuses', jsonb_build_array('draft','submitted','applied')
    )
  );
end;
$$;