-- wp07_b2_qc_report_byte_verification (FINAL, NOT APPLIED)
alter table regulatory.eaushadhi_qc_report_reservation
  drop constraint eaushadhi_qc_report_reservation_integrity_status_check,
  add constraint eaushadhi_qc_report_reservation_integrity_status_check
    check (integrity_status in ('UNVERIFIED_BYTES','VERIFIED_BYTES','BYTES_MISMATCH')),
  add column bytes_checked_at timestamptz,
  add column bytes_checked_by uuid,
  add column verified_sha256 text check (verified_sha256 is null or verified_sha256 ~ '^[0-9a-f]{64}$'),
  add column verified_size_bytes bigint check (verified_size_bytes is null or verified_size_bytes >= 0),
  add constraint qc_report_bytes_check_consistency check (
    (integrity_status = 'UNVERIFIED_BYTES' and bytes_checked_at is null)
    or (integrity_status <> 'UNVERIFIED_BYTES' and status = 'REGISTERED'
        and bytes_checked_at is not null and bytes_checked_by is not null
        and verified_sha256 is not null and verified_size_bytes is not null));

alter table regulatory.eaushadhi_qc_report_event
  drop constraint eaushadhi_qc_report_event_event_type_check,
  add constraint eaushadhi_qc_report_event_event_type_check
    check (event_type in ('RESERVED','REGISTERED','BYTES_VERIFIED','BYTES_MISMATCH'));

-- Internal: called ONLY by the edge function (service_role) after it hashed the real object bytes.
create or replace function regulatory.eaushadhi_qc_report_record_byte_check_v1(
  p_reservation_id uuid, p_actor uuid, p_object_id uuid, p_object_version text,
  p_computed_sha256 text, p_computed_size bigint, p_pdf_header_ok boolean)
returns jsonb language plpgsql security definer
set search_path = regulatory, public, pg_temp as $$
declare r regulatory.eaushadhi_qc_report_reservation%rowtype;
        v_obj_size bigint; v_obj_version text; v_reasons text[] := '{}'; v_ok boolean; v_status text;
begin
  if p_actor is null or p_computed_sha256 !~ '^[0-9a-f]{64}$' or p_computed_size is null then
    raise exception 'invalid byte-check input' using errcode='22023'; end if;
  select * into r from regulatory.eaushadhi_qc_report_reservation
   where reservation_id = p_reservation_id for update;
  if not found then raise exception 'reservation not found' using errcode='P0002'; end if;
  if r.status <> 'REGISTERED' then raise exception 'reservation not REGISTERED' using errcode='55000'; end if;
  if r.integrity_status <> 'UNVERIFIED_BYTES' then  -- single-shot: idempotent return, no new event
    return jsonb_build_object('reservation_id',r.reservation_id,'integrity_status',r.integrity_status,
      'document_asset_id',r.document_asset_id,'already_checked',true,'verified_sha256',r.verified_sha256,
      'verified_size_bytes',r.verified_size_bytes); end if;
  if p_object_id is distinct from r.storage_object_id then
    raise exception 'object id differs from registered object' using errcode='40001'; end if;
  select (o.metadata->>'size')::bigint, o.version into v_obj_size, v_obj_version
    from storage.objects o
   where o.id = r.storage_object_id and o.bucket_id = r.expected_bucket and o.name = r.expected_storage_path;
  if not found then raise exception 'registered object missing' using errcode='P0002'; end if;
  if v_obj_version is distinct from r.storage_object_version or p_object_version is distinct from r.storage_object_version then
    raise exception 'object version changed since registration' using errcode='40001'; end if;

  if p_computed_sha256 <> r.claimed_sha256 then v_reasons := array_append(v_reasons, 'SHA256_MISMATCH'::text); end if;
  if p_computed_size <> v_obj_size then v_reasons := array_append(v_reasons, 'SIZE_MISMATCH_STORAGE_METADATA'::text); end if;
  if p_computed_size = 0 or p_computed_size > 2097152 then v_reasons := array_append(v_reasons, 'SIZE_OUT_OF_RANGE_2MB'::text); end if;
  if not coalesce(p_pdf_header_ok,false) then v_reasons := array_append(v_reasons, 'NOT_PDF_HEADER'::text); end if;
  v_ok := cardinality(v_reasons) = 0;
  v_status := case when v_ok then 'VERIFIED_BYTES' else 'BYTES_MISMATCH' end;

  update regulatory.eaushadhi_qc_report_reservation set integrity_status = v_status,
     bytes_checked_at = now(), bytes_checked_by = p_actor,
     verified_sha256 = p_computed_sha256, verified_size_bytes = p_computed_size
   where reservation_id = r.reservation_id;
  update regulatory.document_asset set
     generation_status = case when v_ok then 'VERIFIED' else 'FAILED' end,
     metadata_json = metadata_json || jsonb_build_object('integrity_status', v_status,
        'bytes_checked_at', now(), 'verified_sha256', p_computed_sha256,
        'verified_size_bytes', p_computed_size, 'byte_check_reasons', to_jsonb(v_reasons))
   where id = r.document_asset_id;
  insert into regulatory.eaushadhi_qc_report_event(reservation_id, event_type, event_payload, actor)
  values (r.reservation_id, case when v_ok then 'BYTES_VERIFIED' else 'BYTES_MISMATCH' end,
     jsonb_build_object('computed_sha256',p_computed_sha256,'claimed_sha256',r.claimed_sha256,
       'computed_size',p_computed_size,'storage_size',v_obj_size,'object_version',v_obj_version,
       'reasons',to_jsonb(v_reasons),'method','edge:eaushadhi-qc-report-verify'), p_actor);
  return jsonb_build_object('reservation_id',r.reservation_id,'integrity_status',v_status,
     'document_asset_id',r.document_asset_id,'reasons',to_jsonb(v_reasons),'already_checked',false,
     'verified_sha256',p_computed_sha256,'verified_size_bytes',p_computed_size);
end $$;

revoke all on function regulatory.eaushadhi_qc_report_record_byte_check_v1(uuid,uuid,uuid,text,text,bigint,boolean) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_report_record_byte_check_v1(uuid,uuid,uuid,text,text,bigint,boolean) to service_role;

-- Public wrapper reachable via PostgREST only by service_role (edge fn); keeps regulatory schema unexposed.
create or replace function public.rpc_eaushadhi_qc_report_record_byte_check_v1(
  p_reservation_id uuid, p_actor uuid, p_object_id uuid, p_object_version text,
  p_computed_sha256 text, p_computed_size bigint, p_pdf_header_ok boolean)
returns jsonb language sql security definer set search_path = public, pg_temp as $$
  select regulatory.eaushadhi_qc_report_record_byte_check_v1($1,$2,$3,$4,$5,$6,$7) $$;
revoke all on function public.rpc_eaushadhi_qc_report_record_byte_check_v1(uuid,uuid,uuid,text,text,bigint,boolean) from public, anon, authenticated;
grant execute on function public.rpc_eaushadhi_qc_report_record_byte_check_v1(uuid,uuid,uuid,text,text,bigint,boolean) to service_role;

-- Service-only lookup used by the edge function to resolve the object server-side.
create or replace function public.rpc_eaushadhi_qc_report_byte_check_target_v1(p_reservation_id uuid)
returns jsonb language sql stable security definer set search_path = regulatory, public, pg_temp as $$
  select jsonb_build_object('reservation_id',r.reservation_id,'product_id',r.product_id,
    'preparation_id',r.preparation_id,'version_no',r.version_no,'status',r.status,
    'integrity_status',r.integrity_status,'bucket',r.expected_bucket,'path',r.expected_storage_path,
    'storage_object_id',r.storage_object_id,'storage_object_version',r.storage_object_version,
    'document_asset_id',r.document_asset_id,'verified_sha256',r.verified_sha256,
    'verified_size_bytes',r.verified_size_bytes)
  from regulatory.eaushadhi_qc_report_reservation r where r.reservation_id = p_reservation_id $$;
revoke all on function public.rpc_eaushadhi_qc_report_byte_check_target_v1(uuid) from public, anon, authenticated;
grant execute on function public.rpc_eaushadhi_qc_report_byte_check_target_v1(uuid) to service_role;
