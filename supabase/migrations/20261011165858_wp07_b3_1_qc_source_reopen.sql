-- WP-07 B3.1: attested reopen for re-verification (supersede binding, append-only).
-- Proposed name: <apply-version>_wp07_b3_1_qc_reopen_reverify.sql
-- Scope: supersession table; SOURCE_REOPENED event type; reopen RPC (editor); recheck reports superseded binding
-- and returns the current binding's fact_evidence (read-only). Bindings are never updated or deleted.
-- Lock order: preparation row only (no reservation lock), consistent with verify_v2/register_v1.

do $pre$
begin
  if to_regclass('regulatory.eaushadhi_qc_evidence_binding') is null then raise exception 'B3.1 preflight: B3 missing'; end if;
  if to_regclass('regulatory.eaushadhi_qc_evidence_supersession') is not null then raise exception 'B3.1 preflight: supersession exists'; end if;
  if to_regprocedure('public.rpc_eaushadhi_qc_preparation_reopen_v1(uuid,bigint,boolean,text)') is not null then raise exception 'B3.1 preflight: reopen exists'; end if;
end
$pre$;

-- 1. Supersession record (append-only, RLS on, no client access). One per binding.
create table regulatory.eaushadhi_qc_evidence_supersession (
  supersession_id bigint generated always as identity primary key,
  binding_id bigint not null references regulatory.eaushadhi_qc_evidence_binding(binding_id) on delete restrict,
  preparation_id uuid not null references regulatory.eaushadhi_qc_preparation(preparation_id) on delete restrict,
  from_row_version bigint not null check (from_row_version > 0),
  to_row_version bigint not null check (to_row_version = from_row_version + 1),
  reason_note text not null check (length(btrim(reason_note)) between 10 and 2000),
  attested boolean not null check (attested),
  superseded_by uuid not null,
  superseded_at timestamptz not null default now(),
  constraint qc_evidence_supersession_binding_uk unique (binding_id)
);
alter table regulatory.eaushadhi_qc_evidence_supersession enable row level security;
revoke all on table regulatory.eaushadhi_qc_evidence_supersession from public, anon, authenticated;
revoke all on sequence regulatory.eaushadhi_qc_evidence_supersession_supersession_id_seq from public, anon, authenticated;
create trigger eaushadhi_qc_evidence_supersession_immutable before update or delete or truncate
  on regulatory.eaushadhi_qc_evidence_supersession for each statement
  execute function regulatory.eaushadhi_qc_evidence_binding_immutable();

-- 2. New event type
alter table regulatory.eaushadhi_qc_preparation_event drop constraint eaushadhi_qc_preparation_event_event_type_check;
alter table regulatory.eaushadhi_qc_preparation_event add constraint eaushadhi_qc_preparation_event_event_type_check
  check (event_type = any (array['DRAFT_CREATED','DRAFT_SAVED','SOURCE_VERIFIED','SOURCE_REOPENED']));

-- 3. Reopen (internal + editor wrapper)
create function regulatory.eaushadhi_qc_preparation_reopen_v1(
  p_preparation_id uuid, p_expected_row_version bigint, p_attest boolean, p_reason_note text, p_actor uuid)
returns jsonb language plpgsql security definer
set search_path to 'public','regulatory','pg_temp' as $f$
declare v_row regulatory.eaushadhi_qc_preparation%rowtype; b regulatory.eaushadhi_qc_evidence_binding%rowtype;
  v_sup bigint; v_note text := btrim(coalesce(p_reason_note,''));
begin
  if p_actor is null or p_preparation_id is null or p_expected_row_version is null then
    raise exception using errcode='22023', message='Actor, draft ID and version required'; end if;
  select * into v_row from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id for update;
  if not found then raise exception using errcode='P0002', message='QC draft missing'; end if;
  if v_row.row_version is distinct from p_expected_row_version then
    raise exception using errcode='40001', message='Stale QC draft version'; end if;
  if v_row.preparation_status <> 'VERIFIED' then
    raise exception using errcode='23514', message='REOPEN_NOT_VERIFIED'; end if;
  if p_attest is distinct from true then
    raise exception using errcode='23514', message='ATTESTATION_REQUIRED'; end if;
  if length(v_note) < 10 or length(v_note) > 2000 then
    raise exception using errcode='23514', message='REOPEN_REASON_REQUIRED'; end if;
  select * into b from regulatory.eaushadhi_qc_evidence_binding
   where preparation_id=v_row.preparation_id order by preparation_row_version desc limit 1;
  if not found or b.preparation_row_version <> v_row.row_version then
    raise exception using errcode='23514', message='REOPEN_BINDING_MISSING'; end if;
  if exists(select 1 from regulatory.eaushadhi_qc_evidence_supersession s where s.binding_id=b.binding_id) then
    raise exception using errcode='23514', message='REOPEN_ALREADY_SUPERSEDED'; end if;

  update regulatory.eaushadhi_qc_preparation
     set preparation_status='REVIEW_REQUIRED', verified_payload_hash=null, verified_by=null, verified_at=null,
         row_version=row_version+1, updated_at=now(), updated_by=p_actor
   where preparation_id=p_preparation_id returning * into v_row;
  insert into regulatory.eaushadhi_qc_evidence_supersession(binding_id, preparation_id, from_row_version,
     to_row_version, reason_note, attested, superseded_by)
  values (b.binding_id, v_row.preparation_id, v_row.row_version-1, v_row.row_version, v_note, true, p_actor)
  returning supersession_id into v_sup;
  insert into regulatory.eaushadhi_qc_preparation_event(preparation_id, event_type, from_row_version, to_row_version,
     previous_payload, next_payload, actor, binding_id)
  values (v_row.preparation_id, 'SOURCE_REOPENED', v_row.row_version-1, v_row.row_version,
     v_row.draft_payload, v_row.draft_payload, p_actor, b.binding_id);
  return jsonb_build_object('preparation_id', v_row.preparation_id, 'row_version', v_row.row_version,
     'preparation_status', v_row.preparation_status, 'superseded_binding_id', b.binding_id,
     'supersession_id', v_sup);
end $f$;
revoke all on function regulatory.eaushadhi_qc_preparation_reopen_v1(uuid,bigint,boolean,text,uuid) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_preparation_reopen_v1(uuid,bigint,boolean,text,uuid) to service_role;

create function public.rpc_eaushadhi_qc_preparation_reopen_v1(
  p_preparation_id uuid, p_expected_row_version bigint, p_attest boolean, p_reason_note text)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_actor uuid;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  return regulatory.eaushadhi_qc_preparation_reopen_v1(p_preparation_id, p_expected_row_version, p_attest, p_reason_note, v_actor);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_preparation_reopen_v1(uuid,bigint,boolean,text) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_preparation_reopen_v1(uuid,bigint,boolean,text) to authenticated, service_role;

-- 4. Recheck: add BINDING_SUPERSEDED + expose current binding's fact_evidence/superseded flag (read-only; same signature)
create or replace function regulatory.eaushadhi_qc_evidence_recheck_v1(p_preparation_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare p regulatory.eaushadhi_qc_preparation%rowtype; b regulatory.eaushadhi_qc_evidence_binding%rowtype;
  r regulatory.eaushadhi_qc_report_reservation%rowtype; o record; v_reasons text[] := '{}'; v_sup boolean := false;
begin
  select * into p from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id;
  if not found then return jsonb_build_object('valid',false,'reasons',jsonb_build_array('PREPARATION_MISSING'),'checked_at',now()); end if;
  if p.preparation_status <> 'VERIFIED' then v_reasons := array_append(v_reasons,'NOT_SOURCE_VERIFIED'); end if;
  select * into b from regulatory.eaushadhi_qc_evidence_binding
   where preparation_id=p.preparation_id order by preparation_row_version desc limit 1;
  if not found then
    v_reasons := array_append(v_reasons,'NO_BINDING');
  else
    v_sup := exists(select 1 from regulatory.eaushadhi_qc_evidence_supersession s where s.binding_id=b.binding_id);
    if v_sup then v_reasons := array_append(v_reasons,'BINDING_SUPERSEDED'); end if;
    if b.preparation_row_version <> p.row_version then v_reasons := array_append(v_reasons,'BINDING_STALE_PREPARATION_VERSION'); end if;
    if b.verified_payload_hash is distinct from p.verified_payload_hash then v_reasons := array_append(v_reasons,'PAYLOAD_HASH_CHANGED'); end if;
    if (p.draft_payload->>'report_sha256') is distinct from b.verified_sha256 then v_reasons := array_append(v_reasons,'PAYLOAD_REPORT_MISMATCH'); end if;
    if cardinality(regulatory.eaushadhi_qc_fact_evidence_reasons_v1(b.fact_evidence)) > 0 then v_reasons := array_append(v_reasons,'FACT_EVIDENCE_INCOMPLETE'); end if;
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
    if not exists(select 1 from regulatory.eaushadhi_qc_report_event e where e.event_id=b.byte_event_id
         and e.reservation_id=b.reservation_id and e.event_type='BYTES_VERIFIED'
         and e.event_payload->>'computed_sha256'=b.verified_sha256
         and e.event_payload->>'object_version'=b.storage_object_version) then
      v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_BYTE_EVENT'); end if;
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
    if not exists(select 1 from regulatory.document_asset da where da.id=b.document_asset_id and da.is_active
         and da.document_type='QC_TEST_REPORT' and da.storage_bucket=b.storage_bucket and da.storage_path=b.storage_path) then
      v_reasons := array_append(v_reasons,'TUPLE_MISMATCH_DOCUMENT_ASSET'); end if;
    if not exists(select 1 from regulatory.document_asset da where da.id=b.document_asset_id and da.is_active
         and da.generation_status='VERIFIED' and da.metadata_json->>'verified_sha256'=b.verified_sha256) then
      v_reasons := array_append(v_reasons,'ASSET_NOT_VERIFIED'); end if;
    if exists(select 1 from regulatory.eaushadhi_qc_report_reservation x where x.preparation_id=p.preparation_id
         and x.status='REGISTERED' and x.version_no > b.report_version_no) then
      v_reasons := array_append(v_reasons,'SUPERSEDED_BY_NEWER_REPORT'); end if;
  end if;
  return jsonb_build_object('valid', cardinality(v_reasons)=0, 'reasons', to_jsonb(v_reasons),
    'binding_id', b.binding_id, 'reservation_id', b.reservation_id, 'verified_sha256', b.verified_sha256,
    'binding_superseded', v_sup, 'fact_evidence', b.fact_evidence,
    'portal_laboratory_candidate_status', 'CANDIDATE_ONLY_NOT_GOVERNED_BY_B3', 'checked_at', now());
end $f$;
revoke all on function regulatory.eaushadhi_qc_evidence_recheck_v1(uuid) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_evidence_recheck_v1(uuid) to service_role;
