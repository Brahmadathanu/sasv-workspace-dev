
create or replace function regulatory.eaushadhi_qc_snapshot_v1(
  p_product_id integer,
  p_expected_workflow_row_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','regulatory','extensions','pg_temp'
as $$
declare
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_comp regulatory.eaushadhi_composition_stage%rowtype;
  v_records jsonb := '[]'::jsonb;
  v_record jsonb;
  v_reasons text[] := array[]::text[];
  v_ids jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_hash text;
begin
  if p_product_id is null or p_product_id<=0 then
    raise exception using errcode='22023',message='Product ID must be positive';
  end if;
  if p_expected_workflow_row_version is null or p_expected_workflow_row_version<=0 then
    raise exception using errcode='22023',message='Expected workflow row version must be positive';
  end if;

  select * into v_workflow from regulatory.eaushadhi_product_workflow where product_id=p_product_id;
  if not found then raise exception using errcode='P0002',message='e-Aushadhi product workflow not found'; end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then raise exception using errcode='40001',message='Stale workflow row version'; end if;
  if v_workflow.entry_status is distinct from 'PORTAL_VERIFIED' then v_reasons:=array_append(v_reasons,'PRODUCT_DETAILS_NOT_PORTAL_VERIFIED'); end if;
  if nullif(btrim(coalesce(v_workflow.portal_product_ref,'')),'') is null then v_reasons:=array_append(v_reasons,'PORTAL_PRODUCT_REF_MISSING'); end if;

  select * into v_comp from regulatory.eaushadhi_composition_stage where product_id=p_product_id;
  if not found or v_comp.stage_status is distinct from 'PORTAL_VERIFIED' then v_reasons:=array_append(v_reasons,'COMPOSITION_NOT_PORTAL_VERIFIED'); end if;

  for v_record in
    select jsonb_build_object(
      'stability_study_id',s.id,
      'product_id',s.product_id,
      'protocol',jsonb_build_object(
        'controlled_term_id',ct.id,'code',ct.code,'label',ct.label,
        'mapping_status',coalesce(pm.mapping_status,'MISSING'),
        'portal_option_id',po.id,'portal_external_id',po.external_id,'portal_label',po.label
      ),
      'other_testing_protocol_text',s.other_testing_protocol_text,
      'study_start_date',s.study_start_date,
      'study_end_date',s.study_end_date,
      'shelf_life_months',s.shelf_life_months,
      'batch_numbers',coalesce(b.batches,'[]'::jsonb),
      'portal_batch_text',s.portal_batch_text,
      'report_date',s.report_date,
      'quality_control_mode',s.quality_control_mode,
      'approved_laboratory_id',s.approved_laboratory_id,
      'laboratory_mapping',case when s.quality_control_mode='OUT' then
        jsonb_build_object('mapping_status',coalesce(lm.mapping_status,'MISSING'),'portal_external_id',lm.portal_external_id,'portal_label',lm.portal_label)
        else null end,
      'document',case when d.document_count=1 then d.document_payload else null end,
      'document_count',coalesce(d.document_count,0),
      'source_status',s.status
    )
    from regulatory.stability_study s
    join regulatory.controlled_term ct on ct.id=s.testing_protocol_term_id
    left join lateral (
      select m.mapping_status,m.portal_option_id
      from regulatory.term_portal_mapping m
      where m.controlled_term_id=ct.id and m.portal_code='E_AUSHADHI'
        and m.mapping_status='VERIFIED'
        and (m.effective_from is null or m.effective_from<=current_date)
        and (m.effective_to is null or m.effective_to>=current_date)
      order by m.verified_at desc nulls last,m.id desc limit 1
    ) pm on true
    left join regulatory.portal_option po on po.id=pm.portal_option_id and po.portal_code='E_AUSHADHI'
      and po.domain_code='QC_PROTOCOL' and po.is_active=true
    left join lateral (
      select jsonb_agg(jsonb_build_object('sequence_no',sb.sequence_no,'bmr_id',sb.bmr_id,'batch_no',sb.batch_no) order by sb.sequence_no) batches
      from regulatory.stability_study_batch sb where sb.study_id=s.id
    ) b on true
    left join lateral (
      select count(*)::integer document_count,
             case when count(*)=1 then (jsonb_agg(jsonb_build_object(
               'document_asset_id',da.id,'document_purpose',sd.document_purpose,'storage_bucket',da.storage_bucket,
               'storage_path',da.storage_path,'original_file_name',da.original_file_name,'mime_type',da.mime_type,
               'content_sha256',da.content_sha256,'generation_status',da.generation_status,'is_active',da.is_active
             )) -> 0) else null end document_payload
      from regulatory.stability_study_document sd
      join regulatory.document_asset da on da.id=sd.document_asset_id
      where sd.study_id=s.id and sd.is_current=true and da.is_active=true
        and sd.document_purpose in ('TEST_REPORT','PORTAL_UPLOAD_ARTIFACT')
    ) d on true
    left join lateral (
      select m.mapping_status,m.portal_external_id,m.portal_label
      from regulatory.eaushadhi_qc_laboratory_mapping m
      where m.approved_laboratory_id=s.approved_laboratory_id and m.mapping_status='VERIFIED'
      order by m.verified_at desc nulls last,m.id desc limit 1
    ) lm on true
    where s.product_id=p_product_id and s.status in ('VERIFIED','READY','PORTAL_ENTERED')
    order by s.id
  loop
    v_count:=v_count+1;
    v_ids:=v_ids||jsonb_build_array((v_record->>'stability_study_id')::bigint);
    if coalesce(v_record#>>'{protocol,mapping_status}','')<>'VERIFIED'
       or nullif(v_record#>>'{protocol,portal_external_id}','') is null then
      v_reasons:=array_append(v_reasons,format('STUDY_%s_PROTOCOL_MAPPING_NOT_VERIFIED',v_record->>'stability_study_id'));
    end if;
    if coalesce(v_record#>>'{protocol,code}','')='OTHER'
       and nullif(btrim(coalesce(v_record->>'other_testing_protocol_text','')),'') is null then
      v_reasons:=array_append(v_reasons,format('STUDY_%s_OTHER_PROTOCOL_TEXT_MISSING',v_record->>'stability_study_id'));
    end if;
    if jsonb_array_length(coalesce(v_record->'batch_numbers','[]'::jsonb))=0
       and nullif(btrim(coalesce(v_record->>'portal_batch_text','')),'') is null then
      v_reasons:=array_append(v_reasons,format('STUDY_%s_BATCH_MISSING',v_record->>'stability_study_id'));
    end if;
    if coalesce((v_record->>'document_count')::integer,0)<>1
       or nullif(v_record#>>'{document,content_sha256}','') is null then
      v_reasons:=array_append(v_reasons,format('STUDY_%s_TEST_REPORT_NOT_FROZEN',v_record->>'stability_study_id'));
    end if;
    if coalesce(v_record->>'quality_control_mode','')='OUT'
       and coalesce(v_record#>>'{laboratory_mapping,mapping_status}','')<>'VERIFIED' then
      v_reasons:=array_append(v_reasons,format('STUDY_%s_LAB_MAPPING_NOT_VERIFIED',v_record->>'stability_study_id'));
    end if;
    v_records:=v_records||jsonb_build_array(v_record);
  end loop;

  if v_count=0 then v_reasons:=array_append(v_reasons,'NO_GOVERNED_QC_RECORDS'); end if;

  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'product_id',p_product_id,'workflow_row_version',v_workflow.row_version,
    'composition_stage_row_version',case when v_comp.product_id is null then null else v_comp.row_version end,
    'records',v_records
  )::text,'UTF8'),'sha256'),'hex');

  return jsonb_build_object(
    'product_id',p_product_id,'workflow_row_version',v_workflow.row_version,
    'product_entry_status',v_workflow.entry_status,
    'composition_stage_status',case when v_comp.product_id is null then null else v_comp.stage_status end,
    'composition_stage_row_version',case when v_comp.product_id is null then null else v_comp.row_version end,
    'portal_product_ref',v_workflow.portal_product_ref,'content_hash',v_hash,
    'qc_records',v_records,'governed_record_ids',v_ids,'governed_record_count',v_count,
    'ready',coalesce(array_length(v_reasons,1),0)=0,'reasons',to_jsonb(v_reasons)
  );
end
$$;

revoke all on function regulatory.eaushadhi_qc_snapshot_v1(integer,bigint) from public,anon,authenticated;
grant execute on function regulatory.eaushadhi_qc_snapshot_v1(integer,bigint) to service_role;
