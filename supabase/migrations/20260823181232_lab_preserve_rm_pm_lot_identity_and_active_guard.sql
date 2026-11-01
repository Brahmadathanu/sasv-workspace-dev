-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function lab.trg_analysis_record_biu()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'lab', 'public', 'pg_temp'
as $$
declare
  v_reg record;
  v_shelf_life integer;
  v_bmr record;
  v_staff record;
begin
  if tg_op = 'INSERT'
     and (new.analysis_register_no is null or btrim(new.analysis_register_no) = '') then
    select *
      into v_reg
    from lab.fn_next_analysis_register_no(
      new.stream_code,
      coalesce(new.sample_received_date, current_date)
    );

    new.register_year := v_reg.register_year;
    new.register_sequence := v_reg.register_sequence;
    new.analysis_register_no := v_reg.analysis_register_no;
  end if;

  if new.analysis_subject_type = 'FG_BATCH' then
    select b.id, b.product_id, b.bn, b.batch_size, u.id as uom_id
      into v_bmr
    from public.bmr_details b
    left join public.inv_uom u on u.code = b.uom
    where b.id = new.bmr_id;

    if v_bmr.id is null then
      raise exception 'Invalid bmr_id: %', new.bmr_id;
    end if;

    if new.product_id is distinct from v_bmr.product_id then
      raise exception 'product_id does not match bmr_details.product_id for bmr_id %', new.bmr_id;
    end if;

    new.batch_no_snapshot := v_bmr.bn;
    new.batch_size_snapshot := v_bmr.batch_size;
    new.batch_uom_id := v_bmr.uom_id;
    new.mfg_date := new.sample_received_date;

    v_shelf_life := lab.fn_get_active_shelf_life_months(new.product_id, new.sample_received_date);
    if v_shelf_life is null then
      raise exception 'No active shelf life found for product_id %', new.product_id;
    end if;

    new.exp_date := (new.mfg_date + make_interval(months => v_shelf_life))::date;

    if new.spec_profile_id is null then
      new.spec_profile_id := lab.fn_create_effective_spec_snapshot_for_analysis(
        'FG', new.product_id, null, new.sample_received_date,
        'Frozen FG effective spec snapshot in analysis_record trigger fallback'
      );
    end if;
  end if;

  if new.analysis_subject_type = 'RM_LOT' then
    if new.stock_item_id is null then
      raise exception 'Stock item required for RM lot analysis';
    end if;

    if tg_op = 'INSERT'
       and nullif(btrim(new.system_lot_no), '') is null then
      new.system_lot_no := lab.fn_next_inventory_lot_no(
        'RM_LOT', new.stock_item_id,
        coalesce(new.received_date, new.sample_received_date)
      );
    end if;

    if new.spec_profile_id is null then
      new.spec_profile_id := lab.fn_create_effective_spec_snapshot_for_analysis(
        'RM', null, new.stock_item_id, new.sample_received_date,
        'Frozen RM effective spec snapshot in analysis_record trigger fallback'
      );
    end if;
  end if;

  if new.analysis_subject_type = 'PM_LOT' then
    if new.stock_item_id is null then
      raise exception 'Packing material item required for PM lot analysis';
    end if;

    if tg_op = 'INSERT'
       and nullif(btrim(new.system_lot_no), '') is null then
      new.system_lot_no := lab.fn_next_inventory_lot_no(
        'PM_LOT', new.stock_item_id,
        coalesce(new.received_date, new.sample_received_date)
      );
    end if;

    if new.spec_profile_id is null then
      new.spec_profile_id := lab.fn_create_effective_spec_snapshot_for_analysis(
        'PM', null, new.stock_item_id, new.sample_received_date,
        'Frozen PM effective spec snapshot in analysis_record trigger fallback'
      );
    end if;
  end if;

  if new.analysed_by_staff_id is not null then
    select full_name, designation into v_staff
    from hr.staff where id = new.analysed_by_staff_id;
    new.analysed_by_name_snapshot := v_staff.full_name;
    new.analysed_by_designation_snapshot := v_staff.designation;
  end if;

  if new.person_in_charge_staff_id is not null then
    select full_name, designation into v_staff
    from hr.staff where id = new.person_in_charge_staff_id;
    new.person_in_charge_name_snapshot := v_staff.full_name;
    new.person_in_charge_designation_snapshot := v_staff.designation;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function lab.trg_enforce_single_active_analysis()
returns trigger
language plpgsql
set search_path = pg_catalog, lab, public, pg_temp
as $$
declare
  v_existing record;
  v_should_check boolean := false;
  v_lock_key text;
begin
  if lab.fn_analysis_status_is_terminal(new.status) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_should_check := true;
  elsif tg_op = 'UPDATE' then
    v_should_check :=
      lab.fn_analysis_status_is_terminal(old.status)
      or old.analysis_subject_type is distinct from new.analysis_subject_type
      or old.bmr_id is distinct from new.bmr_id
      or old.stock_item_id is distinct from new.stock_item_id
      or old.system_lot_no is distinct from new.system_lot_no;
  end if;

  if not v_should_check then
    return new;
  end if;

  if new.analysis_subject_type = 'FG_BATCH' then
    if new.bmr_id is null then
      raise exception using errcode='23514', message='FG analysis requires a canonical BMR identity before active-analysis validation';
    end if;

    v_lock_key := 'LAB_ACTIVE_FG_BMR:' || new.bmr_id::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key,0));

    select ar.id, ar.analysis_register_no, ar.status into v_existing
    from lab.analysis_record ar
    where ar.analysis_subject_type='FG_BATCH'
      and ar.bmr_id=new.bmr_id
      and ar.id <> coalesce(new.id,-1)
      and not lab.fn_analysis_status_is_terminal(ar.status)
    order by ar.created_at, ar.id
    limit 1;

  elsif new.analysis_subject_type in ('RM_LOT','PM_LOT') then
    if new.stock_item_id is null or nullif(btrim(new.system_lot_no),'') is null then
      return new;
    end if;

    v_lock_key := 'LAB_ACTIVE_' || new.analysis_subject_type || ':' || new.stock_item_id::text || ':' || btrim(new.system_lot_no);
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key,0));

    select ar.id, ar.analysis_register_no, ar.status into v_existing
    from lab.analysis_record ar
    where ar.analysis_subject_type=new.analysis_subject_type
      and ar.stock_item_id=new.stock_item_id
      and btrim(ar.system_lot_no)=btrim(new.system_lot_no)
      and ar.id <> coalesce(new.id,-1)
      and not lab.fn_analysis_status_is_terminal(ar.status)
    order by ar.created_at, ar.id
    limit 1;
  else
    return new;
  end if;

  if v_existing.id is not null then
    raise exception using
      errcode='23505',
      message=format('Active analysis already exists for this %s: %s (%s)',
        case when new.analysis_subject_type='FG_BATCH' then 'FG batch' else 'inventory lot' end,
        coalesce(v_existing.analysis_register_no,'analysis_id '||v_existing.id::text),
        v_existing.status),
      detail=format('existing_analysis_id=%s; subject_type=%s',v_existing.id,new.analysis_subject_type),
      hint='Finish the existing analysis to a terminal state (APPROVED_FOR_COA, COA_GENERATED or CANCELLED) before creating/reopening another analysis for the same batch or lot.';
  end if;

  return new;
end;
$$;