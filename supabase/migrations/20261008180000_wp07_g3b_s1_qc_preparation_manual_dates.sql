-- WP-07 G3B / S1: QC preparation only. Never creates a stability study or QC execution authority.
-- Date rule: BOTH study dates are manually entered and human-confirmed; no derivation or prefilling.
create table regulatory.eaushadhi_qc_preparation (
  preparation_id uuid primary key default gen_random_uuid(),
  product_id integer not null references regulatory.product_dossier(product_id) on delete restrict,
  source_key text not null check (length(btrim(source_key)) between 1 and 160),
  draft_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_payload)='object'),
  preparation_status text not null default 'PREPARING'
    check (preparation_status in ('PREPARING','REVIEW_REQUIRED','VERIFIED')),
  row_version bigint not null default 1 check (row_version>0),
  verified_payload_hash text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  constraint qc_prep_source_identity unique (product_id,source_key),
  constraint qc_prep_verification_consistency check (
    (preparation_status='VERIFIED' and verified_by is not null and verified_at is not null and verified_payload_hash is not null)
    or (preparation_status<>'VERIFIED' and verified_by is null and verified_at is null and verified_payload_hash is null))
);
create table regulatory.eaushadhi_qc_preparation_event (
  event_id bigint generated always as identity primary key,
  preparation_id uuid not null references regulatory.eaushadhi_qc_preparation(preparation_id) on delete restrict,
  event_type text not null check (event_type in ('DRAFT_CREATED','DRAFT_SAVED','SOURCE_VERIFIED')),
  from_row_version bigint,
  to_row_version bigint not null,
  previous_payload jsonb,
  next_payload jsonb not null,
  actor uuid not null,
  recorded_at timestamptz not null default now()
);
create index eaushadhi_qc_preparation_product_idx on regulatory.eaushadhi_qc_preparation(product_id,preparation_status);
create index eaushadhi_qc_preparation_event_history_idx on regulatory.eaushadhi_qc_preparation_event(preparation_id,event_id);
alter table regulatory.eaushadhi_qc_preparation enable row level security;
alter table regulatory.eaushadhi_qc_preparation_event enable row level security;
revoke all on regulatory.eaushadhi_qc_preparation, regulatory.eaushadhi_qc_preparation_event from public,anon,authenticated;
-- No direct table grants: even service_role must use the audited RPC surface.
revoke all on regulatory.eaushadhi_qc_preparation, regulatory.eaushadhi_qc_preparation_event from service_role;
revoke all on sequence regulatory.eaushadhi_qc_preparation_event_event_id_seq from public,anon,authenticated,service_role;

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
    if v_date is null or v_date !~ '^\\d{4}-\\d{2}-\\d{2}$' then
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

create or replace function regulatory.eaushadhi_qc_preparation_read_v1(p_product_id integer)
returns jsonb language sql stable security definer set search_path=public,regulatory,extensions,pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'preparation_id',p.preparation_id,'product_id',p.product_id,'source_key',p.source_key,
    'draft_payload',p.draft_payload,'preparation_status',p.preparation_status,
    'row_version',p.row_version,'verified_at',p.verified_at,
    'review',regulatory.eaushadhi_qc_preparation_review_v1(p.draft_payload)
  ) order by p.created_at,p.preparation_id),'[]'::jsonb)
  from regulatory.eaushadhi_qc_preparation p where p.product_id=p_product_id
$$;

create or replace function regulatory.eaushadhi_qc_preparation_save_v1(
  p_preparation_id uuid, p_product_id integer, p_source_key text,
  p_expected_row_version bigint, p_payload jsonb, p_actor uuid
) returns jsonb language plpgsql security definer
set search_path=public,regulatory,extensions,pg_temp as $$
declare v_row regulatory.eaushadhi_qc_preparation%rowtype; v_new uuid; v_review jsonb;
begin
  if p_actor is null or p_product_id is null or p_product_id<=0 or
     nullif(btrim(p_source_key),'') is null or length(p_source_key)>160 or
     p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception using errcode='22023',message='Invalid QC draft identity, actor or payload';
  end if;
  v_review:=regulatory.eaushadhi_qc_preparation_review_v1(p_payload);
  if exists (select 1 from jsonb_array_elements_text(v_review->'reasons') reason where reason like 'UNSUPPORTED_KEY_%') then
    raise exception using errcode='22023',message='Unsupported QC draft field';
  end if;
  if p_preparation_id is null then
    if p_expected_row_version is distinct from 0 then raise exception using errcode='40001',message='Draft create requires expected version zero'; end if;
    insert into regulatory.eaushadhi_qc_preparation(product_id,source_key,draft_payload,created_by,updated_by)
    values(p_product_id,btrim(p_source_key),p_payload,p_actor,p_actor)
    returning * into v_row;
    insert into regulatory.eaushadhi_qc_preparation_event(preparation_id,event_type,to_row_version,next_payload,actor)
      values(v_row.preparation_id,'DRAFT_CREATED',v_row.row_version,v_row.draft_payload,p_actor);
  else
    select * into v_row from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id for update;
    if not found or v_row.product_id<>p_product_id or v_row.source_key<>btrim(p_source_key) then
      raise exception using errcode='P0002',message='QC draft identity not found';
    end if;
    if v_row.row_version is distinct from p_expected_row_version then
      raise exception using errcode='40001',message='Stale QC draft version';
    end if;
    insert into regulatory.eaushadhi_qc_preparation_event(preparation_id,event_type,from_row_version,to_row_version,previous_payload,next_payload,actor)
      values(v_row.preparation_id,'DRAFT_SAVED',v_row.row_version,v_row.row_version+1,v_row.draft_payload,p_payload,p_actor);
    update regulatory.eaushadhi_qc_preparation
      set draft_payload=p_payload,preparation_status='REVIEW_REQUIRED',row_version=row_version+1,
          verified_payload_hash=null,verified_at=null,verified_by=null,
          updated_at=now(),updated_by=p_actor where preparation_id=p_preparation_id
    returning * into v_row;
  end if;
  return jsonb_build_object('preparation_id',v_row.preparation_id,'row_version',v_row.row_version,
    'preparation_status',v_row.preparation_status,'review',v_review);
end $$;

create or replace function regulatory.eaushadhi_qc_preparation_verify_v1(
  p_preparation_id uuid,p_expected_row_version bigint,p_actor uuid
) returns jsonb language plpgsql security definer
set search_path=public,regulatory,extensions,pg_temp as $$
declare v_row regulatory.eaushadhi_qc_preparation%rowtype; v_review jsonb; v_hash text;
begin
  if p_actor is null or p_preparation_id is null then
    raise exception using errcode='22023',message='Actor and draft ID required';
  end if;
  select * into v_row from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id for update;
  if not found then raise exception using errcode='P0002',message='QC draft missing'; end if;
  if v_row.row_version is distinct from p_expected_row_version then
    raise exception using errcode='40001',message='Stale QC draft version';
  end if;
  if v_row.preparation_status='VERIFIED' then
    raise exception using errcode='23514',message='QC draft already source verified';
  end if;
  v_review:=regulatory.eaushadhi_qc_preparation_review_v1(v_row.draft_payload);
  if (v_review->>'source_verified_eligible')::boolean is distinct from true then
    raise exception using errcode='23514',message='QC draft source verification requires complete human-entered fields';
  end if;
  v_hash:=encode(extensions.digest(convert_to(v_row.draft_payload::text,'UTF8'),'sha256'),'hex');
  update regulatory.eaushadhi_qc_preparation
    set preparation_status='VERIFIED',verified_payload_hash=v_hash,verified_by=p_actor,
        verified_at=now(),row_version=row_version+1,updated_at=now(),updated_by=p_actor
    where preparation_id=p_preparation_id returning * into v_row;
  insert into regulatory.eaushadhi_qc_preparation_event(preparation_id,event_type,from_row_version,to_row_version,previous_payload,next_payload,actor)
    values(v_row.preparation_id,'SOURCE_VERIFIED',v_row.row_version-1,v_row.row_version,v_row.draft_payload,v_row.draft_payload,p_actor);
  return jsonb_build_object('preparation_id',v_row.preparation_id,'row_version',v_row.row_version,
    'preparation_status',v_row.preparation_status,'verified_payload_hash',v_hash);
end $$;
revoke all on function regulatory.eaushadhi_qc_preparation_review_v1(jsonb) from public,anon,authenticated;
revoke all on function regulatory.eaushadhi_qc_preparation_read_v1(integer) from public,anon,authenticated;
revoke all on function regulatory.eaushadhi_qc_preparation_save_v1(uuid,integer,text,bigint,jsonb,uuid) from public,anon,authenticated;
revoke all on function regulatory.eaushadhi_qc_preparation_verify_v1(uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function regulatory.eaushadhi_qc_preparation_review_v1(jsonb) to service_role;
grant execute on function regulatory.eaushadhi_qc_preparation_read_v1(integer) to service_role;
grant execute on function regulatory.eaushadhi_qc_preparation_save_v1(uuid,integer,text,bigint,jsonb,uuid) to service_role;
grant execute on function regulatory.eaushadhi_qc_preparation_verify_v1(uuid,bigint,uuid) to service_role;
