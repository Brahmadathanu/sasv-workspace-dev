-- Synchronise scrutiny, approval and COA completeness with the queue's multi-observation tolerance rule.
-- Keep existing authorization, source-traceability and evaluation safeguards unchanged.

-- fn_submit_analysis_for_scrutiny (first numeric completeness predicate only)
CREATE OR REPLACE FUNCTION lab.fn_submit_analysis_for_scrutiny(p_user_id uuid, p_analysis_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'lab', 'public'
AS $function$
declare
  v_staff_id bigint;
  v_can_submit boolean;
  v_old_status text;
  v_missing_count integer;
  v_ref_missing_count integer;
  v_fail_count integer;
  v_not_eval_count integer;
begin
  select public.fn_get_staff_id_for_user(p_user_id)
    into v_staff_id;

  if v_staff_id is null then
    raise exception 'No staff mapping found for user %', p_user_id;
  end if;

  select status
    into v_old_status
  from lab.analysis_record
  where id = p_analysis_id;

  if v_old_status is null then
    raise exception 'Analysis % not found', p_analysis_id;
  end if;

  select lab.fn_staff_may_perform_analysis_action(
    v_staff_id,
    p_analysis_id,
    'SUBMIT_FOR_SCRUTINY'
  )
  into v_can_submit;

  if v_can_submit is not true then
    raise exception
      'Staff % is not permitted to submit analysis % for scrutiny',
      v_staff_id,
      p_analysis_id;
  end if;

  if exists (
    select 1
    from lab.fn_get_analysis_spec_locks(p_analysis_id) l
    where l.is_locked = true
  ) then
    raise exception
      'This analysis has pending specification approval locks. Submit for scrutiny is blocked until QA review is completed.';
  end if;

  select count(*)
    into v_missing_count
  from lab.analysis_result r
  where r.analysis_id = p_analysis_id
    and (
      (r.result_kind_snapshot = 'NUMERIC' and r.result_numeric is null
        and not (
          r.spec_type_snapshot = 'TOLERANCE'
          and r.compliance_status in ('PASS', 'FAIL')
          and nullif(btrim(r.result_text), '') is not null
          and exists (
            select 1 from lab.analysis_result_observation o
            where o.analysis_result_id = r.id and o.is_excluded is not true
          )
        ))
      or
      (
        r.result_kind_snapshot in ('TEXT', 'PASS_FAIL', 'BOOLEAN')
        and (r.result_text is null or btrim(r.result_text) = '')
      )
    );

  if v_missing_count > 0 then
    raise exception
      'Analysis % has % missing result(s)',
      p_analysis_id,
      v_missing_count;
  end if;

  select count(*)
    into v_ref_missing_count
  from lab.v_analysis_result_entry v
  where v.analysis_id = p_analysis_id
    and v.reference_capture_required = true;

  if v_ref_missing_count > 0 then
    raise exception
      'Analysis % has % line(s) requiring reference capture',
      p_analysis_id,
      v_ref_missing_count;
  end if;

  select count(*)
    into v_not_eval_count
  from lab.analysis_result r
  where r.analysis_id = p_analysis_id
    and coalesce(r.compliance_status, 'NOT_EVALUATED') = 'NOT_EVALUATED';

  if v_not_eval_count > 0 then
    raise exception
      'Analysis % has % not-evaluated result(s)',
      p_analysis_id,
      v_not_eval_count;
  end if;

  select count(*)
    into v_fail_count
  from lab.analysis_result r
  where r.analysis_id = p_analysis_id
    and r.compliance_status = 'FAIL';

  if v_fail_count > 0 then
    raise exception
      'Analysis % has % failed result(s). Return/correct results before scrutiny.',
      p_analysis_id,
      v_fail_count;
  end if;

  if exists (
    select 1
    from lab.analysis_result r
    where r.analysis_id = p_analysis_id
      and r.result_source_type = 'OUTSOURCED'
      and (
        r.outsourced_report_id is null
        or nullif(btrim(r.source_lab_name_snapshot), '') is null
        or nullif(btrim(r.source_coa_no_snapshot), '') is null
        or r.source_coa_date_snapshot is null
        or (
          r.result_kind_snapshot = 'NUMERIC'
          and r.result_numeric is null
        )
        or (
          r.result_kind_snapshot in ('TEXT', 'PASS_FAIL')
          and nullif(btrim(r.result_text), '') is null
        )
      )
  ) then
    raise exception
      'Outsourced result lines are incomplete. Complete lab name, COA number, COA date, and result value before scrutiny.';
  end if;

  update lab.analysis_record
  set
    status = 'PENDING_SCRUTINY',
    updated_at = now()
  where id = p_analysis_id;

  insert into lab.analysis_status_history (
    analysis_id,
    old_status,
    new_status,
    remarks,
    changed_at,
    changed_by,
    changed_by_staff_id
  )
  values (
    p_analysis_id,
    v_old_status,
    'PENDING_SCRUTINY',
    null,
    now(),
    p_user_id,
    v_staff_id
  );

  return true;
end;
$function$
;

-- fn_pass_analysis_scrutiny (first numeric completeness predicate only)
CREATE OR REPLACE FUNCTION lab.fn_pass_analysis_scrutiny(p_user_id uuid, p_analysis_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'lab', 'public', 'pg_temp'
AS $function$
declare
  v_staff_id bigint;
  v_can_pass boolean;
  v_old_status text;
  v_missing_count integer;
  v_fail_count integer;
  v_not_evaluated_count integer;
  v_ref_missing_count integer;
begin
  select public.fn_get_staff_id_for_user(p_user_id)
    into v_staff_id;

  if v_staff_id is null then
    raise exception 'No staff mapping found for user %', p_user_id;
  end if;

  select status
    into v_old_status
  from lab.analysis_record
  where id = p_analysis_id;

  if v_old_status is null then
    raise exception 'Analysis % not found', p_analysis_id;
  end if;

  select lab.fn_staff_may_perform_analysis_action(
    v_staff_id,
    p_analysis_id,
    'PASS_SCRUTINY'
  )
  into v_can_pass;

  if v_can_pass is not true then
    raise exception 'Staff % is not permitted to pass scrutiny for analysis %', v_staff_id, p_analysis_id;
  end if;

  select count(*)
    into v_missing_count
  from lab.analysis_result r
  where r.analysis_id = p_analysis_id
    and (
      (r.result_kind_snapshot = 'NUMERIC' and r.result_numeric is null
        and not (
          r.spec_type_snapshot = 'TOLERANCE'
          and r.compliance_status in ('PASS', 'FAIL')
          and nullif(btrim(r.result_text), '') is not null
          and exists (
            select 1 from lab.analysis_result_observation o
            where o.analysis_result_id = r.id and o.is_excluded is not true
          )
        ))
      or
      (r.result_kind_snapshot in ('TEXT', 'PASS_FAIL') and (r.result_text is null or btrim(r.result_text) = ''))
    );

  if v_missing_count > 0 then
    raise exception 'Analysis % has % missing result(s)', p_analysis_id, v_missing_count;
  end if;

  select count(*)
    into v_fail_count
  from lab.analysis_result r
  where r.analysis_id = p_analysis_id
    and r.compliance_status = 'FAIL';

  if v_fail_count > 0 then
    raise exception 'Analysis % has % failed result(s)', p_analysis_id, v_fail_count;
  end if;

  select count(*)
    into v_not_evaluated_count
  from lab.analysis_result r
  where r.analysis_id = p_analysis_id
    and r.compliance_status = 'NOT_EVALUATED';

  if v_not_evaluated_count > 0 then
    raise exception 'Analysis % has % not-evaluated result(s)', p_analysis_id, v_not_evaluated_count;
  end if;

  select count(*)
    into v_ref_missing_count
  from lab.v_analysis_result_entry v
  where v.analysis_id = p_analysis_id
    and v.reference_capture_required = true;

  if v_ref_missing_count > 0 then
    raise exception 'Analysis % has % line(s) requiring reference capture', p_analysis_id, v_ref_missing_count;
  end if;

  update lab.analysis_record
  set
    status = 'SCRUTINY_PASSED',
    updated_at = now()
  where id = p_analysis_id;

  insert into lab.analysis_status_history (
    analysis_id,
    old_status,
    new_status,
    remarks,
    changed_at,
    changed_by,
    changed_by_staff_id
  )
  values (
    p_analysis_id,
    v_old_status,
    'SCRUTINY_PASSED',
    null,
    now(),
    p_user_id,
    v_staff_id
  );

  return true;
end;
$function$
;

-- fn_validate_analysis_ready_for_approval (first numeric completeness predicate only)
CREATE OR REPLACE FUNCTION lab.fn_validate_analysis_ready_for_approval(p_analysis_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'lab', 'public', 'pg_temp'
AS $function$
declare
  v_missing_count integer;
  v_bad_outsource_count integer;
begin
  select count(*)
    into v_missing_count
  from lab.analysis_result r
  where r.analysis_id = p_analysis_id
    and (
      (r.result_kind_snapshot = 'NUMERIC' and r.result_numeric is null
        and not (
          r.spec_type_snapshot = 'TOLERANCE'
          and r.compliance_status in ('PASS', 'FAIL')
          and nullif(btrim(r.result_text), '') is not null
          and exists (
            select 1 from lab.analysis_result_observation o
            where o.analysis_result_id = r.id and o.is_excluded is not true
          )
        ))
      or
      (r.result_kind_snapshot in ('TEXT', 'PASS_FAIL') and (r.result_text is null or btrim(r.result_text) = ''))
    );

  if v_missing_count > 0 then
    raise exception 'Analysis % has % missing result(s)', p_analysis_id, v_missing_count;
  end if;

  select count(*)
    into v_bad_outsource_count
  from lab.analysis_result r
  where r.analysis_id = p_analysis_id
    and r.result_source_type = 'OUTSOURCED'
    and (
      r.outsourced_report_id is null
      or r.source_lab_name_snapshot is null
      or btrim(r.source_lab_name_snapshot) = ''
      or r.source_coa_no_snapshot is null
      or btrim(r.source_coa_no_snapshot) = ''
      or r.source_coa_date_snapshot is null
    );

  if v_bad_outsource_count > 0 then
    raise exception 'Analysis % has % outsourced result(s) with incomplete source trace', p_analysis_id, v_bad_outsource_count;
  end if;
end;
$function$
;

-- fn_validate_analysis_ready_for_coa_issue (first numeric completeness predicate only)
CREATE OR REPLACE FUNCTION lab.fn_validate_analysis_ready_for_coa_issue(p_analysis_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'lab', 'public', 'pg_temp'
AS $function$
declare
  v_status text;
  v_missing_count integer;
  v_fail_count integer;
  v_strict_mode boolean;
  v_not_evaluated_count integer;
begin
  select ar.status
    into v_status
  from lab.analysis_record ar
  where ar.id = p_analysis_id;

  if v_status is null then
    raise exception 'Analysis % not found', p_analysis_id;
  end if;

  if v_status <> 'APPROVED_FOR_COA' then
    raise exception 'Analysis % is not approved for COA. Current status: %', p_analysis_id, v_status;
  end if;

  select count(*)
    into v_missing_count
  from lab.analysis_result r
  where r.analysis_id = p_analysis_id
    and (
      (r.result_kind_snapshot = 'NUMERIC' and r.result_numeric is null
        and not (
          r.spec_type_snapshot = 'TOLERANCE'
          and r.compliance_status in ('PASS', 'FAIL')
          and nullif(btrim(r.result_text), '') is not null
          and exists (
            select 1 from lab.analysis_result_observation o
            where o.analysis_result_id = r.id and o.is_excluded is not true
          )
        ))
      or
      (r.result_kind_snapshot in ('TEXT', 'PASS_FAIL') and (r.result_text is null or btrim(r.result_text) = ''))
    );

  if v_missing_count > 0 then
    raise exception 'Analysis % has % missing result(s)', p_analysis_id, v_missing_count;
  end if;

  select count(*)
    into v_fail_count
  from lab.analysis_result r
  where r.analysis_id = p_analysis_id
    and r.compliance_status = 'FAIL';

  if v_fail_count > 0 then
    raise exception 'Analysis % has % failed result(s)', p_analysis_id, v_fail_count;
  end if;

  select (value = 'true')
    into v_strict_mode
  from lab.system_config
  where key = 'coa_strict_mode';

  if coalesce(v_strict_mode, false) then
    select count(*)
      into v_not_evaluated_count
    from lab.analysis_result r
    where r.analysis_id = p_analysis_id
      and r.compliance_status = 'NOT_EVALUATED';

    if v_not_evaluated_count > 0 then
      raise exception 'Analysis % has % non-evaluated result(s)', p_analysis_id, v_not_evaluated_count;
    end if;
  end if;
end;
$function$
;

-- Read-only regression checks; never advance a workflow state in a migration.
do $$
declare v_missing bigint; v_invalid bigint;
begin
  select missing_result_count into v_missing from lab.v_analysis_pending_scrutiny where analysis_id=453;
  if v_missing is distinct from 0 then raise exception 'analysis 453 queue still missing %',v_missing; end if;
  select count(*) into v_invalid
  from lab.analysis_result r where r.analysis_id=453
    and ( (r.result_kind_snapshot='NUMERIC' and r.result_numeric is null
       and not (r.spec_type_snapshot='TOLERANCE' and r.compliance_status in ('PASS','FAIL')
        and nullif(btrim(r.result_text),'') is not null
        and exists(select 1 from lab.analysis_result_observation o where o.analysis_result_id=r.id and o.is_excluded is not true)))
      or (r.result_kind_snapshot in ('TEXT','PASS_FAIL') and nullif(btrim(r.result_text),'') is null));
  if v_invalid<>0 then raise exception 'analysis 453 still has % missing result(s)',v_invalid; end if;
end $$;
