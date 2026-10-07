create or replace function lab.fn_validate_spec_value_rules(
  p_action_type text,
  p_spec_type text,
  p_min_value numeric,
  p_max_value numeric,
  p_text_value text,
  p_target_value numeric,
  p_tolerance_value numeric,
  p_tolerance_uom_id bigint,
  p_display_text text,
  p_allow_placeholder boolean default false
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_action text := upper(btrim(coalesce(p_action_type, '')));
  v_type text := upper(btrim(coalesce(p_spec_type, '')));
  v_all_values_null boolean :=
    p_min_value is null
    and p_max_value is null
    and p_text_value is null
    and p_target_value is null
    and p_tolerance_value is null
    and p_tolerance_uom_id is null;
begin
  if v_action = 'DISABLE' then
    if p_spec_type is not null
       or not v_all_values_null
       or nullif(btrim(coalesce(p_display_text, '')), '') is not null then
      return jsonb_build_object(
        'ok', false,
        'code', 'DISABLE_VALUES_NOT_ALLOWED',
        'message', 'A disabled specification override cannot contain specification values.'
      );
    end if;
    return jsonb_build_object('ok', true, 'code', 'OK', 'message', 'Valid.');
  end if;

  if v_action not in ('ADD', 'MODIFY', 'BASE', 'SNAPSHOT') then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_ACTION_TYPE',
      'message', 'Invalid specification action type.'
    );
  end if;

  if v_type not in ('RANGE','MIN_ONLY','MAX_ONLY','EXACT_NUMERIC','TEXT','PASS_FAIL','TOLERANCE') then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_SPEC_TYPE',
      'message', 'Invalid or unsupported specification type.'
    );
  end if;

  if nullif(btrim(coalesce(p_display_text, '')), '') is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'DISPLAY_TEXT_REQUIRED',
      'message', 'Specification display text is required.'
    );
  end if;

  if coalesce(p_allow_placeholder, false) and v_all_values_null then
    return jsonb_build_object('ok', true, 'code', 'PLACEHOLDER', 'message', 'Valid placeholder specification.');
  end if;

  if v_type = 'RANGE' then
    if p_min_value is null or p_max_value is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'RANGE_VALUES_REQUIRED',
        'message', 'Both minimum and maximum values are required for a range specification.'
      );
    end if;
    if p_min_value > p_max_value then
      return jsonb_build_object(
        'ok', false,
        'code', 'INVALID_RANGE_ORDER',
        'message', 'Minimum value cannot be greater than maximum value.'
      );
    end if;
    if p_text_value is not null or p_target_value is not null
       or p_tolerance_value is not null or p_tolerance_uom_id is not null then
      return jsonb_build_object(
        'ok', false,
        'code', 'RANGE_EXTRA_VALUES',
        'message', 'Range specification contains incompatible value fields.'
      );
    end if;

  elsif v_type = 'MIN_ONLY' then
    if p_min_value is null then
      return jsonb_build_object('ok', false, 'code', 'MIN_VALUE_REQUIRED', 'message', 'Minimum value is required.');
    end if;
    if p_max_value is not null or p_text_value is not null or p_target_value is not null
       or p_tolerance_value is not null or p_tolerance_uom_id is not null then
      return jsonb_build_object('ok', false, 'code', 'MIN_ONLY_EXTRA_VALUES', 'message', 'Minimum-only specification contains incompatible value fields.');
    end if;

  elsif v_type = 'MAX_ONLY' then
    if p_max_value is null then
      return jsonb_build_object('ok', false, 'code', 'MAX_VALUE_REQUIRED', 'message', 'Maximum value is required.');
    end if;
    if p_min_value is not null or p_text_value is not null or p_target_value is not null
       or p_tolerance_value is not null or p_tolerance_uom_id is not null then
      return jsonb_build_object('ok', false, 'code', 'MAX_ONLY_EXTRA_VALUES', 'message', 'Maximum-only specification contains incompatible value fields.');
    end if;

  elsif v_type = 'EXACT_NUMERIC' then
    if p_min_value is null then
      return jsonb_build_object('ok', false, 'code', 'EXACT_VALUE_REQUIRED', 'message', 'Exact numeric value is required.');
    end if;
    if p_max_value is not null or p_text_value is not null or p_target_value is not null
       or p_tolerance_value is not null or p_tolerance_uom_id is not null then
      return jsonb_build_object('ok', false, 'code', 'EXACT_EXTRA_VALUES', 'message', 'Exact numeric specification contains incompatible value fields.');
    end if;

  elsif v_type in ('TEXT','PASS_FAIL') then
    if p_text_value is null then
      return jsonb_build_object('ok', false, 'code', 'TEXT_VALUE_REQUIRED', 'message', 'Text specification value is required.');
    end if;
    if p_min_value is not null or p_max_value is not null or p_target_value is not null
       or p_tolerance_value is not null or p_tolerance_uom_id is not null then
      return jsonb_build_object('ok', false, 'code', 'TEXT_EXTRA_VALUES', 'message', 'Text specification contains incompatible numeric value fields.');
    end if;

  elsif v_type = 'TOLERANCE' then
    if p_target_value is null or p_tolerance_value is null or p_tolerance_uom_id is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'TOLERANCE_VALUES_REQUIRED',
        'message', 'Target value, tolerance value, and tolerance unit are required.'
      );
    end if;
    if p_tolerance_value < 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'INVALID_TOLERANCE',
        'message', 'Tolerance value cannot be negative.'
      );
    end if;
    if p_min_value is not null or p_max_value is not null or p_text_value is not null then
      return jsonb_build_object(
        'ok', false,
        'code', 'TOLERANCE_EXTRA_VALUES',
        'message', 'Tolerance specification contains incompatible value fields.'
      );
    end if;
  end if;

  return jsonb_build_object('ok', true, 'code', 'OK', 'message', 'Valid.');
end;
$$;

create or replace function lab.trg_validate_spec_override_values()
returns trigger
language plpgsql
set search_path to 'lab','public','pg_temp'
as $$
declare
  v_result jsonb;
begin
  v_result := lab.fn_validate_spec_value_rules(
    new.action_type,
    new.override_spec_type,
    new.override_min_value,
    new.override_max_value,
    new.override_text_value,
    new.override_target_value,
    new.override_tolerance_value,
    new.override_tolerance_uom_id,
    new.override_display_text,
    false
  );

  if coalesce((v_result->>'ok')::boolean, false) is not true then
    raise exception using
      errcode = '22023',
      message = coalesce(v_result->>'message', 'Invalid specification override values.'),
      detail = 'code=' || coalesce(v_result->>'code', 'SPEC_VALUE_RULE_VIOLATION');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_spec_override_values on lab.spec_override;
create trigger trg_validate_spec_override_values
before insert or update of action_type, override_spec_type, override_min_value, override_max_value,
  override_text_value, override_target_value, override_tolerance_value,
  override_tolerance_uom_id, override_display_text
on lab.spec_override
for each row
execute function lab.trg_validate_spec_override_values();

alter table lab.spec_override
  drop constraint if exists chk_lab_spec_override_value_rules;

alter table lab.spec_override
  add constraint chk_lab_spec_override_value_rules
  check (
    (
      action_type = 'DISABLE'
      and override_spec_type is null
      and override_min_value is null
      and override_max_value is null
      and override_text_value is null
      and override_target_value is null
      and override_tolerance_value is null
      and override_tolerance_uom_id is null
      and override_display_text is null
    )
    or
    (
      action_type in ('ADD','MODIFY')
      and btrim(coalesce(override_display_text,'')) <> ''
      and (
        (
          override_spec_type = 'RANGE'
          and override_min_value is not null
          and override_max_value is not null
          and override_min_value <= override_max_value
          and override_text_value is null
          and override_target_value is null
          and override_tolerance_value is null
          and override_tolerance_uom_id is null
        )
        or
        (
          override_spec_type = 'MIN_ONLY'
          and override_min_value is not null
          and override_max_value is null
          and override_text_value is null
          and override_target_value is null
          and override_tolerance_value is null
          and override_tolerance_uom_id is null
        )
        or
        (
          override_spec_type = 'MAX_ONLY'
          and override_max_value is not null
          and override_min_value is null
          and override_text_value is null
          and override_target_value is null
          and override_tolerance_value is null
          and override_tolerance_uom_id is null
        )
        or
        (
          override_spec_type = 'EXACT_NUMERIC'
          and override_min_value is not null
          and override_max_value is null
          and override_text_value is null
          and override_target_value is null
          and override_tolerance_value is null
          and override_tolerance_uom_id is null
        )
        or
        (
          override_spec_type in ('TEXT','PASS_FAIL')
          and override_text_value is not null
          and override_min_value is null
          and override_max_value is null
          and override_target_value is null
          and override_tolerance_value is null
          and override_tolerance_uom_id is null
        )
        or
        (
          override_spec_type = 'TOLERANCE'
          and override_target_value is not null
          and override_tolerance_value is not null
          and override_tolerance_value >= 0
          and override_tolerance_uom_id is not null
          and override_min_value is null
          and override_max_value is null
          and override_text_value is null
        )
      )
    )
  );

create or replace function lab.trg_validate_spec_line_values_friendly()
returns trigger
language plpgsql
set search_path to 'lab','public','pg_temp'
as $$
declare
  v_result jsonb;
begin
  v_result := lab.fn_validate_spec_value_rules(
    'SNAPSHOT',
    new.spec_type,
    new.min_value,
    new.max_value,
    new.text_value,
    new.target_value,
    new.tolerance_value,
    new.tolerance_uom_id,
    new.display_text,
    true
  );

  if coalesce((v_result->>'ok')::boolean, false) is not true then
    raise exception using
      errcode = '22023',
      message = coalesce(v_result->>'message', 'Invalid laboratory specification values.'),
      detail = 'code=' || coalesce(v_result->>'code', 'SPEC_VALUE_RULE_VIOLATION');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_spec_line_values_friendly on lab.spec_line;
create trigger trg_validate_spec_line_values_friendly
before insert or update of spec_type, min_value, max_value, text_value, target_value,
  tolerance_value, tolerance_uom_id, display_text
on lab.spec_line
for each row
execute function lab.trg_validate_spec_line_values_friendly();

create or replace function lab.fn_validate_current_active_spec(
  p_subject_type text,
  p_product_id bigint default null,
  p_stock_item_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'lab','public','pg_temp'
as $$
declare
  r record;
  v_target_value numeric;
  v_tolerance_value numeric;
  v_tolerance_uom_id bigint;
  v_validation jsonb;
  v_invalid jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  for r in
    select *
    from lab.fn_resolve_current_active_spec_lines(
      p_subject_type,
      p_product_id,
      p_stock_item_id
    )
    order by seq_no
  loop
    v_target_value := null;
    v_tolerance_value := null;
    v_tolerance_uom_id := null;

    if r.source_override_id is not null then
      select so.override_target_value, so.override_tolerance_value, so.override_tolerance_uom_id
        into v_target_value, v_tolerance_value, v_tolerance_uom_id
      from lab.spec_override so
      where so.id = r.source_override_id;
    else
      select sl.target_value, sl.tolerance_value, sl.tolerance_uom_id
        into v_target_value, v_tolerance_value, v_tolerance_uom_id
      from lab.spec_line sl
      where sl.spec_profile_id = r.base_spec_profile_id
        and sl.test_id = r.test_id
        and sl.is_active = true
      order by sl.id desc
      limit 1;
    end if;

    v_validation := lab.fn_validate_spec_value_rules(
      'SNAPSHOT',
      r.spec_type,
      r.min_value,
      r.max_value,
      r.text_value,
      v_target_value,
      v_tolerance_value,
      v_tolerance_uom_id,
      r.display_text,
      true
    );

    if coalesce((v_validation->>'ok')::boolean, false) is not true then
      v_count := v_count + 1;
      v_invalid := v_invalid || jsonb_build_array(
        jsonb_build_object(
          'seq_no', r.seq_no,
          'test_id', r.test_id,
          'test_name', r.test_name,
          'spec_type', r.spec_type,
          'source_type', r.source_type,
          'source_override_id', r.source_override_id,
          'code', v_validation->>'code',
          'message', v_validation->>'message'
        )
      );
    end if;
  end loop;

  if v_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_EFFECTIVE_SPEC',
      'message', 'The applicable laboratory specification contains an invalid value or range.',
      'invalid_count', v_count,
      'invalid_lines', v_invalid
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'READY',
    'message', 'The applicable laboratory specification is valid.',
    'invalid_count', 0,
    'invalid_lines', '[]'::jsonb
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'SPEC_RESOLUTION_FAILED',
      'message', sqlerrm,
      'invalid_count', null,
      'invalid_lines', '[]'::jsonb
    );
end;
$$;

grant execute on function lab.fn_validate_current_active_spec(text,bigint,bigint) to authenticated;
