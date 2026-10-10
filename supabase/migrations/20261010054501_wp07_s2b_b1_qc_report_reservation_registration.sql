-- WP-07 G3B/S2B/B1: isolated QC report reservation/registration only.
-- Does NOT verify PDF bytes, promote stability studies, or authorize portal operations.
create table regulatory.eaushadhi_qc_report_reservation (
  reservation_id uuid primary key default gen_random_uuid(),
  preparation_id uuid not null references regulatory.eaushadhi_qc_preparation(preparation_id) on delete restrict,
  product_id integer not null references regulatory.product_dossier(product_id) on delete restrict,
  version_no integer not null check(version_no>0),
  preparation_row_version bigint not null check(preparation_row_version>0),
  expected_bucket text not null default 'eaushadhi-evidence' check(expected_bucket='eaushadhi-evidence'),
  expected_storage_path text not null,
  expected_file_name text not null check(expected_file_name ~ '^EAUSHADHI_P[0-9]+_[A-Z0-9_]+_QC_TEST_REPORT_V[0-9]+[.]pdf$'),
  status text not null default 'RESERVED' check(status in ('RESERVED','REGISTERED','REVOKED')),
  document_asset_id bigint unique references regulatory.document_asset(id) on delete restrict,
  storage_object_id uuid,
  storage_object_version text,
  original_upload_file_name text,
  claimed_sha256 text check(claimed_sha256 is null or claimed_sha256 ~ '^[0-9a-f]{64}$'),
  integrity_status text not null default 'UNVERIFIED_BYTES' check(integrity_status='UNVERIFIED_BYTES'),
  reserved_by uuid not null,
  reserved_at timestamptz not null default now(),
  registered_by uuid,
  registered_at timestamptz,
  constraint qc_report_prep_version_uk unique(preparation_id,version_no),
  constraint qc_report_storage_path_uk unique(expected_bucket,expected_storage_path),
  constraint qc_report_registered_consistency check(
    (status='REGISTERED' and document_asset_id is not null and storage_object_id is not null and registered_by is not null and registered_at is not null)
    or (status<>'REGISTERED' and document_asset_id is null and registered_by is null and registered_at is null)
  )
);
create index eaushadhi_qc_report_product_idx on regulatory.eaushadhi_qc_report_reservation(product_id,preparation_id,version_no desc);
create table regulatory.eaushadhi_qc_report_event (
  event_id bigint generated always as identity primary key,
  reservation_id uuid not null references regulatory.eaushadhi_qc_report_reservation(reservation_id) on delete restrict,
  event_type text not null check(event_type in ('RESERVED','REGISTERED')),
  event_payload jsonb not null,
  actor uuid not null,
  recorded_at timestamptz not null default now()
);
alter table regulatory.eaushadhi_qc_report_reservation enable row level security;
alter table regulatory.eaushadhi_qc_report_event enable row level security;
revoke all on regulatory.eaushadhi_qc_report_reservation,regulatory.eaushadhi_qc_report_event from public,anon,authenticated,service_role;
revoke all on sequence regulatory.eaushadhi_qc_report_event_event_id_seq from public,anon,authenticated,service_role;

create function regulatory.eaushadhi_qc_report_reserve_v1(
 p_product_id integer,p_preparation_id uuid,p_expected_row_version bigint,p_actor uuid
) returns jsonb language plpgsql security definer
set search_path=public,regulatory,extensions,pg_temp as $$
declare v_prep regulatory.eaushadhi_qc_preparation%rowtype;
 v_name text;v_slug text;v_version integer;v_file text;v_path text;v_new regulatory.eaushadhi_qc_report_reservation%rowtype;
begin
 if p_actor is null or p_preparation_id is null or p_expected_row_version is null then
   raise exception using errcode='22023',message='QC reservation identity required';
 end if;
 select * into v_prep from regulatory.eaushadhi_qc_preparation
 where preparation_id=p_preparation_id for update;
 if not found or v_prep.product_id is distinct from p_product_id then
   raise exception using errcode='P0002',message='QC preparation not found for product';
 end if;
 if v_prep.row_version is distinct from p_expected_row_version then
   raise exception using errcode='40001',message='Stale QC preparation version';
 end if;
 if not exists(select 1 from regulatory.product_dossier
   where product_id=p_product_id and scope_decision='IN_SCOPE') then
   raise exception using errcode='23514',message='Product is not in scope';
 end if;
 select coalesce(nullif(btrim(d.portal_product_name),''),p.item)
 into v_name from regulatory.product_dossier d join public.products p on p.id=d.product_id
 where d.product_id=p_product_id;
 v_slug:=regulatory.eaushadhi_document_filename_slug(v_name);
 if nullif(v_slug,'') is null then v_slug:='PRODUCT'; end if;
 if v_slug !~ '^[A-Z0-9_]+$' then
   raise exception using errcode='23514',message='Invalid governed QC report filename slug';
 end if;
 -- Serialize reservations for one preparation, including concurrent callers.
 perform pg_advisory_xact_lock(hashtextextended('eaushadhi:qc-report:'||p_preparation_id::text,0));
 select coalesce(max(version_no),0)+1 into v_version
 from regulatory.eaushadhi_qc_report_reservation where preparation_id=p_preparation_id;
 v_file:=format('EAUSHADHI_P%s_%s_QC_TEST_REPORT_V%s.pdf',
   lpad(p_product_id::text,4,'0'),v_slug,lpad(v_version::text,2,'0'));
 v_path:=format('qc-test-report/%s/%s/%s',p_product_id,p_preparation_id,v_file);
 insert into regulatory.eaushadhi_qc_report_reservation(
   preparation_id,product_id,version_no,preparation_row_version,
   expected_storage_path,expected_file_name,reserved_by)
 values(p_preparation_id,p_product_id,v_version,p_expected_row_version,v_path,v_file,p_actor)
 returning * into v_new;
 insert into regulatory.eaushadhi_qc_report_event(reservation_id,event_type,event_payload,actor)
 values(v_new.reservation_id,'RESERVED',
 jsonb_build_object('product_id',p_product_id,'version_no',v_version,'path',v_path),p_actor);
 return jsonb_build_object('reservation_id',v_new.reservation_id,'product_id',p_product_id,
 'preparation_id',p_preparation_id,'version_no',v_version,'bucket','eaushadhi-evidence',
 'expected_file_name',v_file,'expected_storage_path',v_path,'extension','pdf',
 'integrity_status','UNVERIFIED_BYTES','preparation_row_version',p_expected_row_version);
end $$;

create function regulatory.eaushadhi_qc_report_register_v1(
 p_reservation_id uuid,p_expected_row_version bigint,p_object_id uuid,
 p_original_upload_file_name text,p_claimed_sha256 text,p_actor uuid
) returns jsonb language plpgsql security definer
set search_path=public,regulatory,storage,extensions,pg_temp as $$
declare v_res regulatory.eaushadhi_qc_report_reservation%rowtype;
 v_prep regulatory.eaushadhi_qc_preparation%rowtype;
 v_object storage.objects%rowtype;v_asset_id bigint;
 v_size bigint;v_mime text;
begin
 if p_actor is null or p_reservation_id is null or p_object_id is null
   or p_expected_row_version is null or nullif(btrim(p_original_upload_file_name),'') is null
   or p_claimed_sha256 !~ '^[0-9a-f]{64}$' or p_claimed_sha256 is null then
   raise exception using errcode='22023',message='Invalid QC report registration arguments';
 end if;
 select * into v_res from regulatory.eaushadhi_qc_report_reservation
 where reservation_id=p_reservation_id for update;
 if not found then raise exception using errcode='P0002',message='QC report reservation missing'; end if;
 select * into v_prep from regulatory.eaushadhi_qc_preparation
 where preparation_id=v_res.preparation_id for update;
 if not found or v_prep.product_id<>v_res.product_id or
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
 if v_size<=0 or v_size>20971520 then
   raise exception using errcode='23514',message='QC PDF size outside approved range';
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
       'document_asset_id',v_res.document_asset_id,'integrity_status','UNVERIFIED_BYTES',
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
end $$;
create function regulatory.eaushadhi_qc_report_read_v1(p_product_id integer)
returns jsonb language sql stable security definer set search_path=public,regulatory,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('reservation_id',r.reservation_id,
 'preparation_id',r.preparation_id,'version_no',r.version_no,
 'expected_file_name',r.expected_file_name,'expected_storage_path',r.expected_storage_path,
 'status',r.status,'document_asset_id',r.document_asset_id,
 'integrity_status',r.integrity_status) order by r.preparation_id,r.version_no),'[]'::jsonb)
 from regulatory.eaushadhi_qc_report_reservation r where r.product_id=p_product_id
$$;
revoke all on function regulatory.eaushadhi_qc_report_reserve_v1(integer,uuid,bigint,uuid) from public,anon,authenticated;
revoke all on function regulatory.eaushadhi_qc_report_register_v1(uuid,bigint,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function regulatory.eaushadhi_qc_report_read_v1(integer) from public,anon,authenticated;
grant execute on function regulatory.eaushadhi_qc_report_reserve_v1(integer,uuid,bigint,uuid) to service_role;
grant execute on function regulatory.eaushadhi_qc_report_register_v1(uuid,bigint,uuid,text,text,uuid) to service_role;
grant execute on function regulatory.eaushadhi_qc_report_read_v1(integer) to service_role;

create function public.rpc_eaushadhi_qc_report_reserve_v1(
 p_product_id integer,p_preparation_id uuid,p_expected_row_version bigint
) returns jsonb language plpgsql security definer
set search_path=public,regulatory,pg_temp as $$
begin
 return regulatory.eaushadhi_qc_report_reserve_v1(p_product_id,p_preparation_id,
 p_expected_row_version,public.rpc_eaushadhi_require_permission(true));
end $$;
create function public.rpc_eaushadhi_qc_report_register_v1(
 p_reservation_id uuid,p_expected_row_version bigint,p_object_id uuid,
 p_original_upload_file_name text,p_claimed_sha256 text
) returns jsonb language plpgsql security definer
set search_path=public,regulatory,pg_temp as $$
begin
 return regulatory.eaushadhi_qc_report_register_v1(p_reservation_id,
 p_expected_row_version,p_object_id,p_original_upload_file_name,p_claimed_sha256,
 public.rpc_eaushadhi_require_permission(true));
end $$;
create function public.rpc_eaushadhi_qc_report_read_v1(p_product_id integer)
returns jsonb language plpgsql stable security definer
set search_path=public,regulatory,pg_temp as $$
begin
 perform public.rpc_eaushadhi_require_permission(false);
 return regulatory.eaushadhi_qc_report_read_v1(p_product_id);
end $$;
revoke all on function public.rpc_eaushadhi_qc_report_reserve_v1(integer,uuid,bigint) from public,anon;
revoke all on function public.rpc_eaushadhi_qc_report_register_v1(uuid,bigint,uuid,text,text) from public,anon;
revoke all on function public.rpc_eaushadhi_qc_report_read_v1(integer) from public,anon;
grant execute on function public.rpc_eaushadhi_qc_report_reserve_v1(integer,uuid,bigint) to authenticated;
grant execute on function public.rpc_eaushadhi_qc_report_register_v1(uuid,bigint,uuid,text,text) to authenticated;
grant execute on function public.rpc_eaushadhi_qc_report_read_v1(integer) to authenticated;
