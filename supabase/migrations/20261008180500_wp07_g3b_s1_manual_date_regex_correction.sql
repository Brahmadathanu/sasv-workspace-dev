-- WP-07 S1 validation correction: use portable explicit digit classes.
create or replace function regulatory.eaushadhi_qc_preparation_review_v1(p_payload jsonb)
returns jsonb language plpgsql stable security definer
set search_path=public,regulatory,extensions,pg_temp
as $$
declare
  v_reasons text[]:=array[]::text[];
  v_key text;
  v_date text;
  v_date_value date;
  v_start date;
  v_end date;
  v_report date;
  v_term_code text;
  v_batch jsonb;
  v_seen text[]:=array[]::text[];
  v_number text;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then
    return jsonb_build_object('source_verified_eligible',false,'reasons',jsonb_build_array('PAYLOAD_NOT_OBJECT'));
  end if;
  for v_key in select jsonb_object_keys(p_payload) loop
    if v_key <> all(array['testing_protocol_term_id','other_testing_protocol_text','study_start_date','study_end_date','date_basis','date_evidence_note','shelf_life_months','batches','report_date','report_date_evidence_note','quality_control_mode','source_report_issuer','source_report_approval_no','portal_laboratory_candidate','report_filename','report_sha256','report_evidence_note']) then
      v_reasons:=array_append(v_reasons,'UNSUPPORTED_KEY_'||v_key);
    end if;
  end loop;
  if nullif(btrim(p_payload->>'testing_protocol_term_id'),'') is null or (p_payload->>'testing_protocol_term_id') !~ '^[0-9]+$' then
    v_reasons:=array_append(v_reasons,'PROTOCOL_REQUIRED');
  else
    select code into v_term_code from regulatory.controlled_term
    where id=(p_payload->>'testing_protocol_term_id')::bigint and domain_code='QC_PROTOCOL' and is_active;
    if v_term_code is null then v_reasons:=array_append(v_reasons,'PROTOCOL_INVALID'); end if;
  end if;
  if v_term_code='OTHER' and nullif(btrim(p_payload->>'other_testing_protocol_text'),'') is null then
    v_reasons:=array_append(v_reasons,'OTHER_PROTOCOL_TEXT_REQUIRED');
  elsif v_term_code is not null and v_term_code<>'OTHER' and nullif(btrim(p_payload->>'other_testing_protocol_text'),'') is not null then
    v_reasons:=array_append(v_reasons,'OTHER_PROTOCOL_TEXT_UNEXPECTED');
  end if;
  for v_key in select unnest(array['study_start_date','study_end_date','report_date']) loop
    v_date:=p_payload->>v_key;
    if v_date is null or v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      v_reasons:=array_append(v_reasons,upper(v_key)||'_REQUIRED_OR_INVALID');
    else
      begin
        v_date_value:=to_date(v_date,'YYYY-MM-DD');
        if to_char(v_date_value,'YYYY-MM-DD')<>v_date then
          v_reasons:=array_append(v_reasons,upper(v_key)||'_INVALID');
        elsif v_key='study_start_date' then v_start:=v_date_value;
        elsif v_key='study_end_date' then v_end:=v_date_value;
        else v_report:=v_date_value;
        end if;
      exception when others then
        v_reasons:=array_append(v_reasons,upper(v_key)||'_INVALID');
      end;
    end if;
  end loop;
  if v_start is not null and v_end is not null and v_end<v_start then
    v_reasons:=array_append(v_reasons,'STUDY_DATE_ORDER_INVALID');
  end if;
  if v_start is not null and v_report is not null and v_report<v_start then
    v_reasons:=array_append(v_reasons,'REPORT_DATE_BEFORE_STUDY_START');
  end if;
  if p_payload->>'date_basis' is distinct from 'OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN'
    and v_term_code='OTHER' and lower(coalesce(p_payload->>'other_testing_protocol_text','')) like '%cross sectional%' then
    v_reasons:=array_append(v_reasons,'CROSS_SECTIONAL_DATE_BASIS_REQUIRED');
  end if;
  if nullif(btrim(p_payload->>'date_evidence_note'),'') is null then
    v_reasons:=array_append(v_reasons,'MANUAL_DATE_EVIDENCE_REQUIRED');
  end if;
  if nullif(btrim(p_payload->>'report_date_evidence_note'),'') is null then
    v_reasons:=array_append(v_reasons,'REPORT_DATE_CONFIRMATION_REQUIRED');
  end if;
  if (p_payload->>'shelf_life_months') is null or (p_payload->>'shelf_life_months') !~ '^[0-9]{1,4}$'
     or (p_payload->>'shelf_life_months')::integer=0 then
    v_reasons:=array_append(v_reasons,'SHELF_LIFE_REQUIRED');
  end if;
  if jsonb_typeof(p_payload->'batches') is distinct from 'array' or jsonb_array_length(coalesce(p_payload->'batches','[]'::jsonb))=0 then
    v_reasons:=array_append(v_reasons,'BATCHES_REQUIRED');
  else
    for v_batch in select value from jsonb_array_elements(p_payload->'batches') loop
      if jsonb_typeof(v_batch)<>'object' or nullif(btrim(v_batch->>'batch_no'),'') is null then
        v_reasons:=array_append(v_reasons,'BATCH_NUMBER_REQUIRED');
      else
        v_number:=btrim(v_batch->>'batch_no');
        if v_number=any(v_seen) then v_reasons:=array_append(v_reasons,'DUPLICATE_BATCH_NUMBER'); end if;
        v_seen:=array_append(v_seen,v_number);
      end if;
    end loop;
  end if;
  if p_payload->>'quality_control_mode' not in ('IN','OUT') or p_payload->>'quality_control_mode' is null then
    v_reasons:=array_append(v_reasons,'QC_MODE_REQUIRED');
  elsif p_payload->>'quality_control_mode'='OUT' and nullif(btrim(p_payload->>'source_report_issuer'),'') is null then
    v_reasons:=array_append(v_reasons,'SOURCE_REPORT_ISSUER_REQUIRED');
  end if;
  if nullif(btrim(p_payload->>'report_filename'),'') is null then
    v_reasons:=array_append(v_reasons,'REPORT_FILENAME_REQUIRED');
  end if;
  if coalesce(p_payload->>'report_sha256','') !~ '^[0-9a-f]{64}$' then
    v_reasons:=array_append(v_reasons,'REPORT_SHA256_REQUIRED');
  end if;
  if nullif(btrim(p_payload->>'report_evidence_note'),'') is null then
    v_reasons:=array_append(v_reasons,'REPORT_EVIDENCE_REQUIRED');
  end if;
  return jsonb_build_object('source_verified_eligible',coalesce(array_length(v_reasons,1),0)=0,'reasons',to_jsonb(v_reasons));
end $$;

 then
      v_reasons:=array_append(v_reasons,upper(v_key)||'_REQUIRED_OR_INVALID');
    else
      begin
        v_date_value:=to_date(v_date,'YYYY-MM-DD');
        if to_char(v_date_value,'YYYY-MM-DD')<>v_date then
          v_reasons:=array_append(v_reasons,upper(v_key)||'_INVALID');
        elsif v_key='study_start_date' then v_start:=v_date_value;
        elsif v_key='study_end_date' then v_end:=v_date_value;
        else v_report:=v_date_value;
        end if;
      exception when others then
        v_reasons:=array_append(v_reasons,upper(v_key)||'_INVALID');
      end;
    end if;
  end loop;
  if v_start is not null and v_end is not null and v_end<v_start then
    v_reasons:=array_append(v_reasons,'STUDY_DATE_ORDER_INVALID');
  end if;
  if v_start is not null and v_report is not null and v_report<v_start then
    v_reasons:=array_append(v_reasons,'REPORT_DATE_BEFORE_STUDY_START');
  end if;
  if p_payload->>'date_basis' is distinct from 'OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN'
    and v_term_code='OTHER' and lower(coalesce(p_payload->>'other_testing_protocol_text','')) like '%cross sectional%' then
    v_reasons:=array_append(v_reasons,'CROSS_SECTIONAL_DATE_BASIS_REQUIRED');
  end if;
  if nullif(btrim(p_payload->>'date_evidence_note'),'') is null then
    v_reasons:=array_append(v_reasons,'MANUAL_DATE_EVIDENCE_REQUIRED');
  end if;
  if nullif(btrim(p_payload->>'report_date_evidence_note'),'') is null then
    v_reasons:=array_append(v_reasons,'REPORT_DATE_CONFIRMATION_REQUIRED');
  end if;
  if (p_payload->>'shelf_life_months') is null or (p_payload->>'shelf_life_months') !~ '^[0-9]{1,4}$'
     or (p_payload->>'shelf_life_months')::integer=0 then
    v_reasons:=array_append(v_reasons,'SHELF_LIFE_REQUIRED');
  end if;
  if jsonb_typeof(p_payload->'batches') is distinct from 'array' or jsonb_array_length(coalesce(p_payload->'batches','[]'::jsonb))=0 then
    v_reasons:=array_append(v_reasons,'BATCHES_REQUIRED');
  else
    for v_batch in select value from jsonb_array_elements(p_payload->'batches') loop
      if jsonb_typeof(v_batch)<>'object' or nullif(btrim(v_batch->>'batch_no'),'') is null then
        v_reasons:=array_append(v_reasons,'BATCH_NUMBER_REQUIRED');
      else
        v_number:=btrim(v_batch->>'batch_no');
        if v_number=any(v_seen) then v_reasons:=array_append(v_reasons,'DUPLICATE_BATCH_NUMBER'); end if;
        v_seen:=array_append(v_seen,v_number);
      end if;
    end loop;
  end if;
  if p_payload->>'quality_control_mode' not in ('IN','OUT') or p_payload->>'quality_control_mode' is null then
    v_reasons:=array_append(v_reasons,'QC_MODE_REQUIRED');
  elsif p_payload->>'quality_control_mode'='OUT' and nullif(btrim(p_payload->>'source_report_issuer'),'') is null then
    v_reasons:=array_append(v_reasons,'SOURCE_REPORT_ISSUER_REQUIRED');
  end if;
  if nullif(btrim(p_payload->>'report_filename'),'') is null then
    v_reasons:=array_append(v_reasons,'REPORT_FILENAME_REQUIRED');
  end if;
  if coalesce(p_payload->>'report_sha256','') !~ '^[0-9a-f]{64}$' then
    v_reasons:=array_append(v_reasons,'REPORT_SHA256_REQUIRED');
  end if;
  if nullif(btrim(p_payload->>'report_evidence_note'),'') is null then
    v_reasons:=array_append(v_reasons,'REPORT_EVIDENCE_REQUIRED');
  end if;
  return jsonb_build_object('source_verified_eligible',coalesce(array_length(v_reasons,1),0)=0,'reasons',to_jsonb(v_reasons));
end $$;

