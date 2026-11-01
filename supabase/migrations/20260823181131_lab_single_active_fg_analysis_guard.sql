-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function lab.fn_analysis_status_is_terminal(p_status text)
returns boolean
language sql
immutable
set search_path = pg_catalog, lab, public, pg_temp
as $$
  select upper(btrim(coalesce(p_status,''))) in ('APPROVED_FOR_COA','COA_GENERATED','CANCELLED');
$$;

create or replace function lab.trg_enforce_single_active_analysis()
returns trigger
language plpgsql
set search_path = pg_catalog, lab, public, pg_temp
as $$
declare
  v_existing record;
  v_should_check boolean := false;
begin
  if new.analysis_subject_type <> 'FG_BATCH' then
    return new;
  end if;

  if lab.fn_analysis_status_is_terminal(new.status) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_should_check := true;
  elsif tg_op = 'UPDATE' then
    v_should_check :=
      lab.fn_analysis_status_is_terminal(old.status)
      or old.analysis_subject_type is distinct from new.analysis_subject_type
      or old.bmr_id is distinct from new.bmr_id;
  end if;

  if not v_should_check then
    return new;
  end if;

  if new.bmr_id is null then
    raise exception using
      errcode = '23514',
      message = 'FG analysis requires a canonical BMR identity before active-analysis validation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('LAB_ACTIVE_FG_BMR:' || new.bmr_id::text, 0));

  select ar.id, ar.analysis_register_no, ar.status
    into v_existing
  from lab.analysis_record ar
  where ar.analysis_subject_type = 'FG_BATCH'
    and ar.bmr_id = new.bmr_id
    and ar.id <> coalesce(new.id, -1)
    and not lab.fn_analysis_status_is_terminal(ar.status)
  order by ar.created_at, ar.id
  limit 1;

  if v_existing.id is not null then
    raise exception using
      errcode = '23505',
      message = format(
        'Active analysis already exists for this FG batch: %s (%s)',
        coalesce(v_existing.analysis_register_no, 'analysis_id ' || v_existing.id::text),
        v_existing.status
      ),
      detail = format('existing_analysis_id=%s; bmr_id=%s', v_existing.id, new.bmr_id),
      hint = 'Complete, approve for COA, generate COA, or cancel the existing analysis before creating/reopening another analysis for the same batch.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_analysis_record_zz_active_guard on lab.analysis_record;
create trigger trg_analysis_record_zz_active_guard
before insert or update on lab.analysis_record
for each row execute function lab.trg_enforce_single_active_analysis();

create or replace function lab.fn_receive_sample_and_create_analysis(
  p_user_id uuid,
  p_analysis_subject_type text,
  p_sample_received_date date,
  p_physical_register_ref text,
  p_analysed_by_staff_id bigint,
  p_person_in_charge_staff_id bigint,
  p_product_id bigint default null::bigint,
  p_batch_no_snapshot text default null::text,
  p_stock_item_id bigint default null::bigint,
  p_system_lot_no text default null::text,
  p_remarks text default null::text
)
returns table(analysis_id bigint, analysis_register_no text, status text)
language plpgsql
security definer
set search_path to 'lab', 'public'
as $$
declare
  v_staff_id bigint;
  v_spec_profile_id bigint;
  v_analysis_id bigint;
  v_analysis_register_no text;
  v_status text;
  v_stream_code text;
  v_bmr record;
  v_analyst record;
  v_pic record;
  v_existing record;
begin
  select lab.fn_get_staff_id_for_user(p_user_id)
    into v_staff_id;

  if v_staff_id is null then
    raise exception 'User not mapped to staff';
  end if;

  if not lab.fn_user_has_workflow_action(p_user_id, 'RECEIVE_SAMPLE') then
    raise exception 'Not permitted to receive sample';
  end if;

  select s.full_name, s.designation
    into v_analyst
  from hr.staff s
  where s.id = p_analysed_by_staff_id;

  if v_analyst.full_name is null then
    raise exception 'Invalid analysed_by staff id %', p_analysed_by_staff_id;
  end if;

  select s.full_name, s.designation
    into v_pic
  from hr.staff s
  where s.id = p_person_in_charge_staff_id;

  if v_pic.full_name is null then
    raise exception 'Invalid person_in_charge staff id %', p_person_in_charge_staff_id;
  end if;

  if p_analysis_subject_type = 'FG_BATCH' then
    if p_product_id is null then
      raise exception 'Product required for FG';
    end if;

    if p_batch_no_snapshot is null or btrim(p_batch_no_snapshot) = '' then
      raise exception 'Batch No required for FG';
    end if;

    select bd.id, bd.product_id, bd.bn, bd.batch_size, bd.uom
      into v_bmr
    from public.bmr_details bd
    where bd.product_id = p_product_id
      and bd.bn = p_batch_no_snapshot
    limit 1;

    if v_bmr.id is null then
      raise exception 'No BMR found for product_id % and batch %', p_product_id, p_batch_no_snapshot;
    end if;

    perform pg_advisory_xact_lock(hashtextextended('LAB_ACTIVE_FG_BMR:' || v_bmr.id::text, 0));

    select ar.id, ar.analysis_register_no, ar.status
      into v_existing
    from lab.analysis_record ar
    where ar.analysis_subject_type = 'FG_BATCH'
      and ar.bmr_id = v_bmr.id
      and not lab.fn_analysis_status_is_terminal(ar.status)
    order by ar.created_at, ar.id
    limit 1;

    if v_existing.id is not null then
      raise exception using
        errcode = '23505',
        message = format('Active analysis already exists for this FG batch: %s (%s)', coalesce(v_existing.analysis_register_no, 'analysis_id ' || v_existing.id::text), v_existing.status),
        detail = format('existing_analysis_id=%s; bmr_id=%s', v_existing.id, v_bmr.id),
        hint = 'Complete, approve for COA, generate COA, or cancel the existing analysis before creating another analysis for the same batch.';
    end if;

    v_stream_code := 'AY';

    v_spec_profile_id := lab.fn_create_current_active_spec_snapshot_for_analysis(
      'FG', p_product_id, null,
      'Frozen FG current active spec snapshot during analysis entry'
    );

    insert into lab.analysis_record (
      analysis_subject_type, stream_code, spec_profile_id, bmr_id, product_id,
      sample_received_date, batch_no_snapshot, batch_size_snapshot, batch_uom_id,
      physical_register_ref, analysed_by_staff_id, person_in_charge_staff_id,
      analysed_by_name_snapshot, analysed_by_designation_snapshot,
      person_in_charge_name_snapshot, person_in_charge_designation_snapshot,
      status, remarks, created_by, updated_by
    ) values (
      'FG_BATCH', v_stream_code, v_spec_profile_id, v_bmr.id, p_product_id,
      p_sample_received_date, v_bmr.bn, v_bmr.batch_size,
      (select u.id from public.inv_uom u where u.code = v_bmr.uom limit 1),
      p_physical_register_ref, p_analysed_by_staff_id, p_person_in_charge_staff_id,
      v_analyst.full_name, v_analyst.designation,
      v_pic.full_name, v_pic.designation,
      'DRAFT', p_remarks, p_user_id, p_user_id
    ) returning id into v_analysis_id;

  elsif p_analysis_subject_type = 'RM_LOT' then
    if p_stock_item_id is null then
      raise exception 'Stock item required for RM';
    end if;

    v_stream_code := 'RM';

    v_spec_profile_id := lab.fn_create_current_active_spec_snapshot_for_analysis(
      'RM', null, p_stock_item_id,
      'Frozen RM current active spec snapshot during analysis entry'
    );

    insert into lab.analysis_record (
      analysis_subject_type, stream_code, spec_profile_id, stock_item_id,
      system_lot_no, sample_received_date, physical_register_ref,
      analysed_by_staff_id, person_in_charge_staff_id,
      analysed_by_name_snapshot, analysed_by_designation_snapshot,
      person_in_charge_name_snapshot, person_in_charge_designation_snapshot,
      status, remarks, created_by, updated_by
    ) values (
      'RM_LOT', v_stream_code, v_spec_profile_id, p_stock_item_id,
      p_system_lot_no, p_sample_received_date, p_physical_register_ref,
      p_analysed_by_staff_id, p_person_in_charge_staff_id,
      v_analyst.full_name, v_analyst.designation,
      v_pic.full_name, v_pic.designation,
      'DRAFT', p_remarks, p_user_id, p_user_id
    ) returning id into v_analysis_id;

  elsif p_analysis_subject_type = 'PM_LOT' then
    if p_stock_item_id is null then
      raise exception 'Packing material item required for PM';
    end if;

    v_stream_code := 'PM';

    v_spec_profile_id := lab.fn_create_current_active_spec_snapshot_for_analysis(
      'PM', null, p_stock_item_id,
      'Frozen PM current active spec snapshot during analysis entry'
    );

    insert into lab.analysis_record (
      analysis_subject_type, stream_code, spec_profile_id, stock_item_id,
      system_lot_no, sample_received_date, physical_register_ref,
      analysed_by_staff_id, person_in_charge_staff_id,
      analysed_by_name_snapshot, analysed_by_designation_snapshot,
      person_in_charge_name_snapshot, person_in_charge_designation_snapshot,
      status, remarks, created_by, updated_by
    ) values (
      'PM_LOT', v_stream_code, v_spec_profile_id, p_stock_item_id,
      p_system_lot_no, p_sample_received_date, p_physical_register_ref,
      p_analysed_by_staff_id, p_person_in_charge_staff_id,
      v_analyst.full_name, v_analyst.designation,
      v_pic.full_name, v_pic.designation,
      'DRAFT', p_remarks, p_user_id, p_user_id
    ) returning id into v_analysis_id;

  else
    raise exception 'Invalid subject type %', p_analysis_subject_type;
  end if;

  select ar.analysis_register_no, ar.status
    into v_analysis_register_no, v_status
  from lab.analysis_record ar
  where ar.id = v_analysis_id;

  analysis_id := v_analysis_id;
  analysis_register_no := v_analysis_register_no;
  status := v_status;
  return next;
end;
$$;