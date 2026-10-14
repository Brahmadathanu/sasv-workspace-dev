-- WP-07 B5.1 candidate (NOT APPLIED): portal labName must be the laboratory NAME.
-- Evidence: addQCRegister getLaboratroyName() builds <option value='"+jdData.name+"'>; SaveData() posts labName = $('#lab_name').val().
-- Single change: projection fill_fields.labName = lab_basis.portal_laboratory (vocabulary-checked label) instead of portal_external_id.
CREATE OR REPLACE FUNCTION regulatory.eaushadhi_qc_prep_projection_v1(p_preparation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'extensions', 'pg_temp'
AS $function$
declare p regulatory.eaushadhi_qc_preparation%rowtype; r jsonb; b regulatory.eaushadhi_qc_evidence_binding%rowtype;
  t regulatory.controlled_term%rowtype; m regulatory.term_portal_mapping%rowtype; o regulatory.portal_option%rowtype;
  v_blockers text[] := '{}'; v_fill jsonb; v_term_id bigint; v_wf regulatory.eaushadhi_product_workflow%rowtype; v_comp text;
begin
  select * into p from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id;
  if not found then return jsonb_build_object('blockers',jsonb_build_array('PREPARATION_MISSING')); end if;
  r := regulatory.eaushadhi_qc_readiness_v1(p_preparation_id);
  if r->>'status' not in ('READY_PROVISIONAL','READY') then v_blockers := array_append(v_blockers,'READINESS_'||(r->>'status')); end if;
  select * into b from regulatory.eaushadhi_qc_evidence_binding where binding_id=(r->>'binding_id')::bigint;
  select * into v_wf from regulatory.eaushadhi_product_workflow where product_id=p.product_id;
  if not found or v_wf.entry_status <> 'PORTAL_VERIFIED' or coalesce(v_wf.portal_product_ref,'')='' then
    v_blockers := array_append(v_blockers,'PRODUCT_DETAILS_NOT_PORTAL_VERIFIED'); end if;
  select stage_status into v_comp from regulatory.eaushadhi_composition_stage where product_id=p.product_id;
  if v_comp is distinct from 'PORTAL_VERIFIED' then v_blockers := array_append(v_blockers,'COMPOSITION_NOT_PORTAL_VERIFIED'); end if;
  if coalesce(p.draft_payload->>'testing_protocol_term_id','') !~ '^[0-9]{1,18}$' then
    v_blockers := array_append(v_blockers,'PROTOCOL_TERM_MISSING');
  else
    v_term_id := (p.draft_payload->>'testing_protocol_term_id')::bigint;
    select * into t from regulatory.controlled_term where id=v_term_id and domain_code='QC_PROTOCOL' and is_active;
    if not found then v_blockers := array_append(v_blockers,'PROTOCOL_TERM_INVALID'); end if;
    select * into m from regulatory.term_portal_mapping x where x.controlled_term_id=v_term_id and x.portal_code='E_AUSHADHI'
      and (x.effective_from is null or x.effective_from <= now()) and (x.effective_to is null or x.effective_to > now())
      order by (x.mapping_status='VERIFIED') desc, x.id desc limit 1;
    if not found then v_blockers := array_append(v_blockers,'PROTOCOL_MAPPING_MISSING');
    else
      if m.mapping_status <> 'VERIFIED' then v_blockers := array_append(v_blockers,'PROTOCOL_MAPPING_NOT_VERIFIED'); end if;
      select * into o from regulatory.portal_option where id=m.portal_option_id and is_active and domain_code='QC_PROTOCOL';
      if not found then v_blockers := array_append(v_blockers,'PROTOCOL_OPTION_INACTIVE'); end if;
    end if;
    if t.code = 'OTHER' and length(btrim(coalesce(p.draft_payload->>'other_testing_protocol_text',''))) < 5 then
      v_blockers := array_append(v_blockers,'OTHER_PROTOCOL_TEXT_MISSING'); end if;
  end if;
  -- R2.1: keys and values exactly as the portal's SaveData() posts qcdetails (productId is bound by page identity, not typed).
  --   When the study type is Others the portal posts the #otherText value AS typeOfStudy (no separate key).
  -- R2.2: a study start date that the report does not state must be flagged as derived (OPERATOR_DERIVATION).
  if exists(select 1 from jsonb_array_elements(coalesce(r->'operator_asserted_facts','[]'::jsonb)) x
            where x->>'fact'='study_start_date' and coalesce(x->>'basis_category','') <> 'OPERATOR_DERIVATION') then
    v_blockers := array_append(v_blockers,'STUDY_START_NOT_FLAGGED_DERIVED'); end if;
  v_fill := jsonb_build_object(
    'typeOfStudy', case when t.code='OTHER' then btrim(p.draft_payload->>'other_testing_protocol_text') else o.external_id end,
    'startDate', p.draft_payload->>'study_start_date', 'endDate', p.draft_payload->>'study_end_date',
    'reportDate', p.draft_payload->>'report_date',
    'batchNo', (select string_agg(btrim(x->>'batch_no'), ',' order by n) from jsonb_array_elements(p.draft_payload->'batches') with ordinality e(x,n)),
    'duration', p.draft_payload->>'shelf_life_months',
    'labName', r->'lab_basis'->>'portal_laboratory',
    'qualityCntrl', case p.draft_payload->>'quality_control_mode' when 'OUT' then 'Out' when 'IN' then 'In' end);
  return jsonb_build_object('blockers', to_jsonb(v_blockers), 'readiness', r,
    'protocol_mapping', case when m.id is null then null else jsonb_build_object('mapping_id',m.id,'mapping_status',m.mapping_status,
       'portal_option_id',m.portal_option_id,'term_id',v_term_id,'term_code',t.code) end,
    'fill_fields', v_fill,
    'context', jsonb_build_object('product_id',p.product_id,'study_type_select_value',o.external_id,
       'study_type_other_text_control', case when t.code='OTHER' then '#otherText' end,'laboratory_label',r->'lab_basis'->>'portal_laboratory','portal_product_ref',v_wf.portal_product_ref,
       'report_issuer',r->'lab_basis'->>'report_issuer','provisional_lab',(r->>'status')='READY_PROVISIONAL',
       'document_asset_id',b.document_asset_id,'report_sha256',b.verified_sha256,'report_size_bytes',b.verified_size_bytes,
       'report_filename',p.draft_payload->>'report_filename','binding_id',b.binding_id,
       'portal_action','SAVE_ONLY_SUBMIT_OUT_OF_SCOPE',
       'derived_facts', coalesce((select jsonb_agg(jsonb_build_object('fact',x->>'fact','acceptance_id',(x->>'acceptance_id')::bigint,'basis_note',x->>'basis_note'))
          from jsonb_array_elements(coalesce(r->'operator_asserted_facts','[]'::jsonb)) x where x->>'basis_category'='OPERATOR_DERIVATION'),'[]'::jsonb)));
end $function$;
