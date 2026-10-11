-- WP-07 B3 R3: QC evidence binding (minimal). Proposed name: 20261011HHMMSS_wp07_b3_qc_evidence_binding.sql
-- (final timestamp = the version recorded by apply_migration; repo file then made byte-exact to stored statements).
-- Scope: append-only binding table; source verify v2 (atomic bind); read-only recheck; legacy verify_v1 closure;
-- 2 MB at registration; narrow storage lock for REGISTERED QC report paths. No data changes to V01 / prep 262.

do $pre$
begin
  if to_regclass('regulatory.eaushadhi_qc_evidence_binding') is not null then raise exception 'B3 preflight: binding table exists'; end if;
  if to_regprocedure('public.rpc_eaushadhi_qc_preparation_verify_v2(uuid,bigint,boolean,jsonb)') is not null then raise exception 'B3 preflight: verify_v2 exists'; end if;
  if to_regprocedure('regulatory.eaushadhi_qc_report_record_byte_check_v1(uuid,uuid,uuid,text,text,bigint,boolean)') is null then raise exception 'B3 preflight: B2 missing'; end if;
  if to_regprocedure('public.rpc_eaushadhi_require_permission(boolean)') is null then raise exception 'B3 preflight: permission helper missing'; end if;
end
$pre$;

-- 1. Binding table (append-only, RLS on, no client access)
create table regulatory.eaushadhi_qc_evidence_binding (
  binding_id bigint generated always as identity primary key,
  preparation_id uuid not null references regulatory.eaushadhi_qc_preparation(preparation_id) on delete restrict,
  preparation_row_version bigint not null check (preparation_row_version > 0),
  verified_payload_hash text not null check (verified_payload_hash ~ '^[0-9a-f]{64}$'),
  reservation_id uuid not null references regulatory.eaushadhi_qc_report_reservation(reservation_id) on delete restrict,
  report_version_no integer not null check (report_version_no > 0),
  document_asset_id bigint not null references regulatory.document_asset(id) on delete restrict,
  storage_bucket text not null,
  storage_path text not null,
  storage_object_id uuid not null,
  storage_object_version text not null,
  verified_sha256 text not null check (verified_sha256 ~ '^[0-9a-f]{64}$'),
  verified_size_bytes bigint not null check (verified_size_bytes > 0 and verified_size_bytes <= 2097152),
  bytes_checked_at timestamptz not null,
  byte_event_id bigint not null references regulatory.eaushadhi_qc_report_event(event_id) on delete restrict,
  attested_reviewed_against_report boolean not null check (attested_reviewed_against_report),
  fact_evidence jsonb not null check (jsonb_typeof(fact_evidence) = 'object'),
  bound_by uuid not null,
  bound_at timestamptz not null default now(),
  constraint qc_evidence_binding_prep_version_uk unique (preparation_id, preparation_row_version)
);
alter table regulatory.eaushadhi_qc_evidence_binding enable row level security;
revoke all on table regulatory.eaushadhi_qc_evidence_binding from public, anon, authenticated;
revoke all on sequence regulatory.eaushadhi_qc_evidence_binding_binding_id_seq from public, anon, authenticated;

create function regulatory.eaushadhi_qc_evidence_binding_immutable() returns trigger
language plpgsql set search_path to 'pg_temp' as $f$
begin raise exception using errcode='55000', message='QC evidence binding is append-only'; end $f$;
create trigger eaushadhi_qc_evidence_binding_immutable before update or delete or truncate
  on regulatory.eaushadhi_qc_evidence_binding for each statement
  execute function regulatory.eaushadhi_qc_evidence_binding_immutable();
revoke all on function regulatory.eaushadhi_qc_evidence_binding_immutable() from public, anon, authenticated;

-- 2. SOURCE_VERIFIED event references its binding
alter table regulatory.eaushadhi_qc_preparation_event
  add column binding_id bigint references regulatory.eaushadhi_qc_evidence_binding(binding_id) on delete restrict;

-- 3. Fact-evidence validator (pure)
create function regulatory.eaushadhi_qc_fact_evidence_reasons_v1(p_fact_evidence jsonb) returns text[]
language plpgsql immutable set search_path to 'pg_temp' as $f$
declare v_reasons text[] := '{}'; v_fact text; v_item jsonb;
begin
  if p_fact_evidence is null or jsonb_typeof(p_fact_evidence) <> 'object' then return array['FACT_EVIDENCE_REQUIRED']; end if;
  for v_fact in select jsonb_object_keys(p_fact_evidence) loop
    if v_fact <> all(array['study_start_date','study_end_date','report_date','testing_protocol','batches','shelf_life_months']) then
      v_reasons := array_append(v_reasons, 'FACT_UNKNOWN_'||upper(v_fact)); end if;
  end loop;
  foreach v_fact in array array['study_start_date','study_end_date','report_date','testing_protocol','batches','shelf_life_months'] loop
    v_item := p_fact_evidence->v_fact;
    if v_item is null or jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item->'supported_by_report') <> 'boolean' then
      v_reasons := array_append(v_reasons, 'FACT_STATUS_REQUIRED_'||upper(v_fact));
    elsif (v_item->>'supported_by_report')::boolean = true
      and length(btrim(coalesce(v_item->>'source_reference',''))) < 5 then
      v_reasons := array_append(v_reasons, 'SUPPORTED_FACT_REFERENCE_REQUIRED_'||upper(v_fact));
    elsif (v_item->>'supported_by_report')::boolean = false
      and length(btrim(coalesce(v_item->>'evidence_note',''))) < 10 then
      v_reasons := array_append(v_reasons, 'UNSUPPORTED_FACT_NOTE_REQUIRED_'||upper(v_fact));
    end if;
  end loop;
  return v_reasons;
end $f$;
revoke all on function regulatory.eaushadhi_qc_fact_evidence_reasons_v1(jsonb) from public, anon, authenticated;

-- 4. Source verify v2 (atomic: verify + binding + event)
create function regulatory.eaushadhi_qc_preparation_verify_v2(
  p_preparation_id uuid, p_expected_row_version bigint, p_attest boolean, p_fact_evidence jsonb, p_actor uuid)
returns jsonb language plpgsql security definer
set search_path to 'public','regulatory','extensions','pg_temp' as $f$
declare v_row regulatory.eaushadhi_qc_preparation%rowtype; r regulatory.eaushadhi_qc_report_reservation%rowtype;
  v_review jsonb; v_hash text; v_evt bigint; v_binding bigint; v_fact text[]; v_obj_ok boolean;
begin
  if p_actor is null or p_preparation_id is null or p_expected_row_version is null then
    raise exception using errcode='22023', message='Actor, draft ID and version required'; end if;
  select * into v_row from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id for update;
  if not found then raise exception using errcode='P0002', message='QC draft missing'; end if;
  if v_row.row_version is distinct from p_expected_row_version then
    raise exception using errcode='40001', message='Stale QC draft version'; end if;
  if v_row.preparation_status='VERIFIED' then
    raise exception using errcode='23514', message='QC draft already source verified'; end if;
  v_review := regulatory.eaushadhi_qc_preparation_review_v1(v_row.draft_payload);
  if (v_review->>'source_verified_eligible')::boolean is distinct from true then
    raise exception using errcode='23514', message='QC draft source verification requires complete human-entered fields'; end if;
  if p_attest is distinct from true then
    raise exception using errcode='23514', message='ATTESTATION_REQUIRED'; end if;
  v_fact := regulatory.eaushadhi_qc_fact_evidence_reasons_v1(p_fact_evidence);
  if cardinality(v_fact) > 0 then
    raise exception using errcode='23514', message='FACT_EVIDENCE_INCOMPLETE: '||array_to_string(v_fact, ','); end if;
  -- latest REGISTERED report (RESERVED newer versions are ignored)
  select * into r from regulatory.eaushadhi_qc_report_reservation
   where preparation_id=v_row.preparation_id and status='REGISTERED'
   order by version_no desc limit 1 for share;
  if not found then raise exception using errcode='23514', message='REPORT_NOT_REGISTERED'; end if;
  if r.product_id <> v_row.product_id then raise exception using errcode='23514', message='REPORT_PRODUCT_MISMATCH'; end if;
  if r.integrity_status <> 'VERIFIED_BYTES' then
    raise exception using errcode='23514', message='REPORT_BYTES_NOT_VERIFIED'; end if;
  if (v_row.draft_payload->>'report_sha256') is distinct from r.verified_sha256 then
    raise exception using errcode='23514', message='PAYLOAD_SHA_NOT_VERIFIED_BYTES'; end if;
  if (v_row.draft_payload->>'report_filename') is distinct from r.expected_file_name then
    raise exception using errcode='23514', message='PAYLOAD_FILENAME_MISMATCH'; end if;
  select exists(select 1 from storage.objects o
     where o.id=r.storage_object_id and o.bucket_id=r.expected_bucket and o.name=r.expected_storage_path
       and o.version=r.storage_object_version and o.archived_at is null
       and coalesce(o.is_delete_marker,false)=false
       and (o.metadata->>'size') = r.verified_size_bytes::text) into v_obj_ok;
  if not v_obj_ok then raise exception using errcode='40001', message='OBJECT_CHANGED_OR_MISSING'; end if;
  if not exists(select 1 from regulatory.document_asset da where da.id=r.document_asset_id and da.is_active
       and da.generation_status='VERIFIED' and da.metadata_json->>'verified_sha256'=r.verified_sha256) then
    raise exception using errcode='23514', message='ASSET_NOT_VERIFIED'; end if;
  select event_id into v_evt from regulatory.eaushadhi_qc_report_event
   where reservation_id=r.reservation_id and event_type='BYTES_VERIFIED' order by event_id desc limit 1;
  if v_evt is null then raise exception using errcode='23514', message='BYTE_EVENT_MISSING'; end if;

  v_hash := encode(extensions.digest(convert_to(v_row.draft_payload::text,'UTF8'),'sha256'),'hex');
  update regulatory.eaushadhi_qc_preparation
     set preparation_status='VERIFIED', verified_payload_hash=v_hash, verified_by=p_actor,
         verified_at=now(), row_version=row_version+1, updated_at=now(), updated_by=p_actor
   where preparation_id=p_preparation_id returning * into v_row;
  insert into regulatory.eaushadhi_qc_evidence_binding(preparation_id, preparation_row_version, verified_payload_hash,
     reservation_id, report_version_no, document_asset_id, storage_bucket, storage_path, storage_object_id,
     storage_object_version, verified_sha256, verified_size_bytes, bytes_checked_at, byte_event_id,
     attested_reviewed_against_report, fact_evidence, bound_by)
  values (v_row.preparation_id, v_row.row_version, v_hash, r.reservation_id, r.version_no, r.document_asset_id,
     r.expected_bucket, r.expected_storage_path, r.storage_object_id, r.storage_object_version, r.verified_sha256,
     r.verified_size_bytes, r.bytes_checked_at, v_evt, true, p_fact_evidence, p_actor)
  returning binding_id into v_binding;
  insert into regulatory.eaushadhi_qc_preparation_event(preparation_id, event_type, from_row_version, to_row_version,
     previous_payload, next_payload, actor, binding_id)
  values (v_row.preparation_id, 'SOURCE_VERIFIED', v_row.row_version-1, v_row.row_version,
     v_row.draft_payload, v_row.draft_payload, p_actor, v_binding);
  return jsonb_build_object('preparation_id', v_row.preparation_id, 'row_version', v_row.row_version,
     'preparation_status', v_row.preparation_status, 'verified_payload_hash', v_hash, 'binding_id', v_binding,
     'reservation_id', r.reservation_id, 'verified_sha256', r.verified_sha256);
end $f$;
revoke all on function regulatory.eaushadhi_qc_preparation_verify_v2(uuid,bigint,boolean,jsonb,uuid) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_preparation_verify_v2(uuid,bigint,boolean,jsonb,uuid) to service_role;

create function public.rpc_eaushadhi_qc_preparation_verify_v2(
  p_preparation_id uuid, p_expected_row_version bigint, p_attest boolean, p_fact_evidence jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_actor uuid;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  return regulatory.eaushadhi_qc_preparation_verify_v2(p_preparation_id, p_expected_row_version, p_attest, p_fact_evidence, v_actor);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_preparation_verify_v2(uuid,bigint,boolean,jsonb) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_preparation_verify_v2(uuid,bigint,boolean,jsonb) to authenticated, service_role;

-- 5. Read-only recheck
create function regulatory.eaushadhi_qc_evidence_recheck_v1(p_preparation_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare p regulatory.eaushadhi_qc_preparation%rowtype; b regulatory.eaushadhi_qc_evidence_binding%rowtype;
  r regulatory.eaushadhi_qc_report_reservation%rowtype; o record; v_reasons text[] := '{}';
begin
  select * into p from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id;
  if not found then return jsonb_build_object('valid',false,'reasons',jsonb_build_array('PREPARATION_MISSING'),'checked_at',now()); end if;
  if p.preparation_status <> 'VERIFIED' then v_reasons := array_append(v_reasons,'NOT_SOURCE_VERIFIED'); end if;
  select * into b from regulatory.eaushadhi_qc_evidence_binding
   where preparation_id=p.preparation_id order by preparation_row_version desc limit 1;
  if not found then
    v_reasons := array_append(v_reasons,'NO_BINDING');
  else
    if b.preparation_row_version <> p.row_version then v_reasons := array_append(v_reasons,'BINDING_STALE_PREPARATION_VERSION'); end if;
    if b.verified_payload_hash is distinct from p.verified_payload_hash then v_reasons := array_append(v_reasons,'PAYLOAD_HASH_CHANGED'); end if;
    if (p.draft_payload->>'report_sha256') is distinct from b.verified_sha256 then v_reasons := array_append(v_reasons,'PAYLOAD_REPORT_MISMATCH'); end if;
    if cardinality(regulatory.eaushadhi_qc_fact_evidence_reasons_v1(b.fact_evidence)) > 0 then v_reasons := array_append(v_reasons,'FACT_EVIDENCE_INCOMPLETE'); end if;
    -- complete frozen tuple vs reservation (every bound identity field)
    select * into r from regulatory.eaushadhi_qc_report_reservation where reservation_id=b.reservation_id;
    if not found then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_RESERVATION_ID');
    else
      if r.status is distinct from 'REGISTERED' or r.integrity_status is distinct from 'VERIFIED_BYTES' then
        v_reasons := array_append(v_reasons,'RESERVATION_NOT_VERIFIED_BYTES'); end if;
      if r.preparation_id is distinct from b.preparation_id then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_PREPARATION_ID'); end if;
      if r.product_id is distinct from p.product_id then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_PRODUCT_ID'); end if;
      if r.version_no is distinct from b.report_version_no then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_REPORT_VERSION'); end if;
      if r.expected_bucket is distinct from b.storage_bucket then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_STORAGE_BUCKET'); end if;
      if r.expected_storage_path is distinct from b.storage_path then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_STORAGE_PATH'); end if;
      if r.storage_object_id is distinct from b.storage_object_id then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_STORAGE_OBJECT_ID'); end if;
      if r.storage_object_version is distinct from b.storage_object_version then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_STORAGE_OBJECT_VERSION'); end if;
      if r.document_asset_id is distinct from b.document_asset_id then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_DOCUMENT_ASSET_ID'); end if;
      if r.verified_sha256 is distinct from b.verified_sha256 then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_VERIFIED_SHA256'); end if;
      if r.verified_size_bytes is distinct from b.verified_size_bytes then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_VERIFIED_SIZE'); end if;
      if r.bytes_checked_at is distinct from b.bytes_checked_at then v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_BYTES_CHECKED_AT'); end if;
    end if;
    -- byte-check event: must be this reservation's BYTES_VERIFIED event for the same sha/object version
    if not exists(select 1 from regulatory.eaushadhi_qc_report_event e where e.event_id=b.byte_event_id
         and e.reservation_id=b.reservation_id and e.event_type='BYTES_VERIFIED'
         and e.event_payload->>'computed_sha256'=b.verified_sha256
         and e.event_payload->>'object_version'=b.storage_object_version) then
      v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_BYTE_EVENT'); end if;
    -- live storage object: by bound id AND by bound bucket/path
    select so.id, so.bucket_id, so.name, so.version, so.metadata->>'size' sz, so.archived_at, coalesce(so.is_delete_marker,false) del into o
      from storage.objects so where so.id=b.storage_object_id;
    if not found or o.del or o.archived_at is not null then
      v_reasons := array_append(v_reasons,'OBJECT_MISSING');
    else
      if o.bucket_id is distinct from b.storage_bucket or o.name is distinct from b.storage_path then v_reasons := array_append(v_reasons,'OBJECT_LOCATION_CHANGED'); end if;
      if o.version is distinct from b.storage_object_version then v_reasons := array_append(v_reasons,'OBJECT_CHANGED'); end if;
      if o.sz is distinct from b.verified_size_bytes::text then v_reasons := array_append(v_reasons,'SIZE_CHANGED'); end if;
    end if;
    if exists(select 1 from storage.objects so where so.bucket_id=b.storage_bucket and so.name=b.storage_path and so.id is distinct from b.storage_object_id) then
      v_reasons := array_append(v_reasons,'OBJECT_CHANGED'); end if;
    -- document asset identity
    if not exists(select 1 from regulatory.document_asset da where da.id=b.document_asset_id and da.is_active
         and da.document_type='QC_TEST_REPORT' and da.storage_bucket=b.storage_bucket and da.storage_path=b.storage_path) then
      v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_DOCUMENT_ASSET'); end if;
    if not exists(select 1 from regulatory.document_asset da where da.id=b.document_asset_id and da.is_active
         and da.generation_status='VERIFIED' and da.metadata_json->>'verified_sha256'=b.verified_sha256) then
      v_reasons := array_append(v_reasons,'ASSET_NOT_VERIFIED'); end if;
    -- any newer REGISTERED report (even before its byte check) supersedes; RESERVED does not
    if exists(select 1 from regulatory.eaushadhi_qc_report_reservation x where x.preparation_id=p.preparation_id
         and x.status='REGISTERED' and x.version_no > b.report_version_no) then
      v_reasons := array_append(v_reasons,'SUPERSEDED_BY_NEWER_REPORT'); end if;
  end if;
  return jsonb_build_object('valid', cardinality(v_reasons)=0, 'reasons', to_jsonb(v_reasons),
    'binding_id', b.binding_id, 'reservation_id', b.reservation_id, 'verified_sha256', b.verified_sha256,
    'portal_laboratory_candidate_status', 'CANDIDATE_ONLY_NOT_GOVERNED_BY_B3', 'checked_at', now());
end $f$;
revoke all on function regulatory.eaushadhi_qc_evidence_recheck_v1(uuid) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_evidence_recheck_v1(uuid) to service_role;

create function public.rpc_eaushadhi_qc_evidence_recheck_v1(p_product_id integer, p_preparation_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
begin
  perform public.rpc_eaushadhi_require_permission(false);
  if not exists(select 1 from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id and product_id=p_product_id) then
    raise exception using errcode='P0002', message='QC draft not found for product'; end if;
  return regulatory.eaushadhi_qc_evidence_recheck_v1(p_preparation_id);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_evidence_recheck_v1(integer,uuid) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_evidence_recheck_v1(integer,uuid) to authenticated, service_role;

-- 6. Legacy verify_v1 closure (all routes)
revoke all on function public.rpc_eaushadhi_qc_preparation_verify_v1(uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function regulatory.eaushadhi_qc_preparation_verify_v1(uuid,bigint,uuid) from public, anon, authenticated, service_role;
create or replace function regulatory.eaushadhi_qc_preparation_verify_v1(p_preparation_id uuid, p_expected_row_version bigint, p_actor uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_temp' as $f$
begin raise exception using errcode='0A000', message='QC source verify v1 is retired; use rpc_eaushadhi_qc_preparation_verify_v2'; end $f$;
create or replace function public.rpc_eaushadhi_qc_preparation_verify_v1(p_preparation_id uuid, p_expected_row_version bigint)
returns jsonb language plpgsql security definer set search_path to 'pg_temp' as $f$
begin raise exception using errcode='0A000', message='QC source verify v1 is retired; use rpc_eaushadhi_qc_preparation_verify_v2'; end $f$;

-- 7. 2 MB limit at registration (only the size bound and its message change)
CREATE OR REPLACE FUNCTION regulatory.eaushadhi_qc_report_register_v1(p_reservation_id uuid, p_expected_row_version bigint, p_object_id uuid, p_original_upload_file_name text, p_claimed_sha256 text, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'storage', 'extensions', 'pg_temp'
AS $function$
declare v_res regulatory.eaushadhi_qc_report_reservation%rowtype;
 v_prep regulatory.eaushadhi_qc_preparation%rowtype;
 v_object storage.objects%rowtype;v_asset_id bigint;
 v_size bigint;v_mime text;v_prep_id uuid;
begin
 if p_actor is null or p_reservation_id is null or p_object_id is null
   or p_expected_row_version is null or nullif(btrim(p_original_upload_file_name),'') is null
   or p_claimed_sha256 !~ '^[0-9a-f]{64}$' or p_claimed_sha256 is null then
   raise exception using errcode='22023',message='Invalid QC report registration arguments';
 end if;
 -- R3 lock order: preparation FOR UPDATE first, then reservation FOR UPDATE (same order as verify_v2/reserve_v1).
 select r.preparation_id into v_prep_id from regulatory.eaushadhi_qc_report_reservation r
 where r.reservation_id=p_reservation_id;
 if not found then raise exception using errcode='P0002',message='QC report reservation missing'; end if;
 select * into v_prep from regulatory.eaushadhi_qc_preparation
 where preparation_id=v_prep_id for update;
 select * into v_res from regulatory.eaushadhi_qc_report_reservation
 where reservation_id=p_reservation_id for update;
 if not found then raise exception using errcode='P0002',message='QC report reservation missing'; end if;
 if v_res.preparation_id is distinct from v_prep_id or v_prep.product_id<>v_res.product_id or
   v_prep.row_version is distinct from p_expected_row_version or
   v_res.preparation_row_version is distinct from p_expected_row_version then
   raise exception using errcode='40001',message='Stale or mismatched QC preparation';
 end if;
 select * into v_object from storage.objects
 where id=p_object_id and bucket_id=v_res.expected_bucket
 and name=v_res.expected_storage_path and archived_at is null
 and coalesce(is_delete_marker,false)=false;
 if not found then raise exception using errcode='23514',message='Reserved QC storage object missing'; end if;
 v_mime:=lower(coalesce(v_object.metadata->>'mimetype',''));
 if v_mime<>'application/pdf' then
   raise exception using errcode='23514',message='QC report must be PDF';
 end if;
 if coalesce(v_object.metadata->>'size','') !~ '^[0-9]+$' then
   raise exception using errcode='23514',message='QC report object size is unavailable';
 end if;
 v_size:=(v_object.metadata->>'size')::bigint;
 if v_size<=0 or v_size>2097152 then
   raise exception using errcode='23514',message='QC PDF must be 2 MB or smaller';
 end if;
 if v_res.status='REGISTERED' then
   if v_res.storage_object_id=p_object_id and v_res.claimed_sha256=p_claimed_sha256
     and v_res.original_upload_file_name=p_original_upload_file_name
     and v_res.storage_object_version is not distinct from v_object.version
     and exists(select 1 from regulatory.document_asset da
       where da.id=v_res.document_asset_id and da.is_active
       and da.document_type='QC_TEST_REPORT' and da.file_size_bytes=v_size
       and da.mime_type='application/pdf' and da.storage_bucket=v_res.expected_bucket
       and da.storage_path=v_res.expected_storage_path
       and da.content_sha256=p_claimed_sha256) then
     return jsonb_build_object('reservation_id',v_res.reservation_id,
       'document_asset_id',v_res.document_asset_id,'integrity_status',v_res.integrity_status,
       'idempotent',true);
   end if;
   raise exception using errcode='23505',message='Conflicting QC report registration';
 end if;
 if v_res.status<>'RESERVED' then
   raise exception using errcode='23514',message='QC reservation is not active';
 end if;
 -- Important: this is unverified caller-supplied SHA, NOT a hash of stored bytes.
 insert into regulatory.document_asset(document_type,storage_bucket,storage_path,
 original_file_name,mime_type,file_size_bytes,content_sha256,generation_status,is_active,
 metadata_json,created_by)
 values('QC_TEST_REPORT',v_res.expected_bucket,v_res.expected_storage_path,
 v_res.expected_file_name,'application/pdf',v_size,p_claimed_sha256,'PENDING',true,
 jsonb_build_object('qc_preparation_id',v_res.preparation_id,
 'qc_reservation_id',v_res.reservation_id,'original_upload_file_name',p_original_upload_file_name,
 'storage_object_id',v_object.id,'storage_object_version',v_object.version,
 'integrity_status','UNVERIFIED_BYTES'),p_actor)
 returning id into v_asset_id;
 update regulatory.eaushadhi_qc_report_reservation set status='REGISTERED',
 document_asset_id=v_asset_id,storage_object_id=v_object.id,
 storage_object_version=v_object.version,
 original_upload_file_name=p_original_upload_file_name,claimed_sha256=p_claimed_sha256,
 registered_by=p_actor,registered_at=now()
 where reservation_id=p_reservation_id;
 insert into regulatory.eaushadhi_qc_report_event(reservation_id,event_type,event_payload,actor)
 values(p_reservation_id,'REGISTERED',jsonb_build_object(
 'document_asset_id',v_asset_id,'storage_object_id',v_object.id,
 'storage_object_version',v_object.version,'integrity_status','UNVERIFIED_BYTES'),p_actor);
 return jsonb_build_object('reservation_id',p_reservation_id,'document_asset_id',v_asset_id,
 'integrity_status','UNVERIFIED_BYTES','idempotent',false);
end $function$;

-- 8. Narrow storage lock: REGISTERED QC report paths cannot be updated or deleted by clients
create function public.eaushadhi_qc_report_path_locked(p_bucket text, p_name text) returns boolean
language sql stable security definer set search_path to '' as $f$
  select p_bucket = 'eaushadhi-evidence' and p_name like 'qc-test-report/%' and exists(
    select 1 from regulatory.eaushadhi_qc_report_reservation r
     where r.expected_bucket = p_bucket and r.expected_storage_path = p_name and r.status = 'REGISTERED')
$f$;
revoke all on function public.eaushadhi_qc_report_path_locked(text,text) from public, anon;
grant execute on function public.eaushadhi_qc_report_path_locked(text,text) to authenticated, service_role;

alter policy eaushadhi_evidence_update on storage.objects
  using ((bucket_id = 'eaushadhi-evidence'::text) AND (EXISTS ( SELECT 1 FROM user_permissions_canonical up
    WHERE ((up.user_id = auth.uid()) AND (up.target = 'module:e-aushadhi-automation'::text) AND (up.can_edit = true))))
    AND NOT public.eaushadhi_qc_report_path_locked(bucket_id, name))
  with check ((bucket_id = 'eaushadhi-evidence'::text) AND (EXISTS ( SELECT 1 FROM user_permissions_canonical up
    WHERE ((up.user_id = auth.uid()) AND (up.target = 'module:e-aushadhi-automation'::text) AND (up.can_edit = true))))
    AND NOT public.eaushadhi_qc_report_path_locked(bucket_id, name));
alter policy eaushadhi_evidence_delete on storage.objects
  using ((bucket_id = 'eaushadhi-evidence'::text) AND (EXISTS ( SELECT 1 FROM user_permissions_canonical up
    WHERE ((up.user_id = auth.uid()) AND (up.target = 'module:e-aushadhi-automation'::text) AND (up.can_edit = true))))
    AND NOT public.eaushadhi_qc_report_path_locked(bucket_id, name));
