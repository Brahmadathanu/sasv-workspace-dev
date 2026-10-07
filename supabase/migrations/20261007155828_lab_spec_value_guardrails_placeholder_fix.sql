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
  v_value_payload_null boolean :=
    p_min_value is null
    and p_max_value is null
    and p_text_value is null
    and p_target_value is null
    and p_tolerance_value is null;
  v_all_override_values_null boolean :=
    v_value_payload_null
    and p_tolerance_uom_id is null;
begin
  if v_action = 'DISABLE' then
    if p_spec_type is not null
       or not v_all_override_values_null
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

  if coalesce(p_allow_placeholder, false) and v_value_payload_null then
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
