-- Corrective hardening for e-Aushadhi browser-worker foundation.
-- Does not rewrite 20260904084132. Read-only RPCs. No lifecycle mutations.

begin;

create or replace function public.rpc_eaushadhi_worker_preflight(p_product_id integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'regulatory', 'pg_temp'
as $function$
declare
  v_ready regulatory.v_eaushadhi_product_readiness%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_reasons text[] := array[]::text[];
  v_eligible boolean := false;
  v_has_readiness boolean := false;
begin
  perform public.rpc_eaushadhi_require_permission(true);

  if p_product_id is null or p_product_id <= 0 then
    raise exception using errcode = '22023', message = 'p_product_id must be a positive integer';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow w
  where w.product_id = p_product_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'e-Aushadhi product workflow not found';
  end if;

  select * into v_ready
  from regulatory.v_eaushadhi_product_readiness r
  where r.product_id = p_product_id;
  v_has_readiness := found;

  if not v_has_readiness then
    v_reasons := array_append(v_reasons, 'Readiness row is missing');
  else
    if coalesce(v_ready.is_ready_for_entry, false) is not true then
      v_reasons := array_append(v_reasons, 'Product is not ready for portal entry');
    end if;
    if coalesce(v_ready.composition_review_complete, false) is not true then
      v_reasons := array_append(v_reasons, 'Composition review is incomplete');
    end if;
    if coalesce(v_ready.dossier_ready, false) is not true then
      v_reasons := array_append(v_reasons, 'Dossier is not ready');
    end if;
    if coalesce(v_ready.open_blockers, 0) > 0 then
      v_reasons := array_append(
        v_reasons,
        format('Open blockers: %s', v_ready.open_blockers)
      );
    end if;
    if coalesce(v_ready.open_portal_issues, 0) > 0 then
      v_reasons := array_append(
        v_reasons,
        format('Open portal issues: %s', v_ready.open_portal_issues)
      );
    end if;
  end if;

  if coalesce(v_workflow.entry_status, 'NOT_STARTED') is distinct from 'NOT_STARTED' then
    v_reasons := array_append(
      v_reasons,
      format('ENTRY_STATUS_NOT_STARTABLE: %s', coalesce(v_workflow.entry_status, 'NOT_STARTED'))
    );
  end if;

  v_eligible :=
    v_has_readiness
    and coalesce(v_ready.is_ready_for_entry, false) is true
    and coalesce(v_workflow.entry_status, 'NOT_STARTED') = 'NOT_STARTED';

  return jsonb_build_object(
    'product_id', p_product_id,
    'eligible', v_eligible,
    'reasons', to_jsonb(v_reasons),
    'is_ready_for_entry', coalesce(v_ready.is_ready_for_entry, false),
    'review_status', coalesce(v_ready.review_status, v_workflow.review_status),
    'entry_status', v_workflow.entry_status,
    'composition_lines', v_ready.composition_lines,
    'verified_lines', v_ready.verified_lines,
    'pending_lines', v_ready.pending_lines,
    'open_blockers', v_ready.open_blockers,
    'open_portal_issues', v_ready.open_portal_issues,
    'dossier_ready', v_ready.dossier_ready,
    'composition_review_complete', v_ready.composition_review_complete,
    'workflow_row_version', v_workflow.row_version,
    'portal_product_ref', v_workflow.portal_product_ref
  );
end;
$function$;

create or replace function public.rpc_eaushadhi_worker_payload_get(
  p_product_id integer,
  p_expected_workflow_row_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'regulatory', 'extensions', 'pg_temp'
as $function$
declare
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_canonical jsonb;
  v_hash text;
  v_bhang boolean;
  v_opium boolean;
  v_narcotic boolean;
  v_e1 boolean;
  v_alcohol boolean;
  v_combined text;
begin
  perform public.rpc_eaushadhi_require_permission(true);

  if p_product_id is null or p_product_id <= 0 then
    raise exception using errcode = '22023', message = 'p_product_id must be a positive integer';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow w
  where w.product_id = p_product_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'e-Aushadhi product workflow not found';
  end if;

  if p_expected_workflow_row_version is distinct from v_workflow.row_version then
    raise exception using errcode = '40001', message = 'Stale workflow row version';
  end if;

  select
    pr.selected_contains_bhang,
    pr.selected_contains_opium,
    pr.selected_contains_other_narcotic,
    pr.selected_contains_schedule_e1,
    pr.selected_contains_self_generated_alcohol
  into v_bhang, v_opium, v_narcotic, v_e1, v_alcohol
  from regulatory.eaushadhi_product_review pr
  where pr.product_id = p_product_id;

  if v_bhang is true or v_opium is true or v_narcotic is true or v_e1 is true or v_alcohol is true then
    v_combined := 'YES';
  elsif v_bhang is false and v_opium is false and v_narcotic is false and v_e1 is false and v_alcohol is false then
    v_combined := 'NO';
  else
    v_combined := 'UNREVIEWED';
  end if;

  select jsonb_build_object(
    'product', jsonb_build_object(
      'product_id', p_product_id,
      'canonical_product_name', vpd.product_name,
      'portal_product_name', d.portal_product_name,
      'system', sys.label,
      'medicine_class', mc.label,
      'dosage_form', df.label,
      'subtype', st.label
    ),
    'details', jsonb_build_object(
      'permission_purpose_term_id', pr.selected_permission_purpose_term_id,
      'permission_purpose_label', selpp.label,
      'composition_title', pr.selected_composition_title,
      'diseases_conditions', pr.selected_diseases_conditions_text,
      'contains_bhang', pr.selected_contains_bhang,
      'contains_opium', pr.selected_contains_opium,
      'contains_other_narcotic', pr.selected_contains_other_narcotic,
      'contains_schedule_e1', pr.selected_contains_schedule_e1,
      'contains_self_generated_alcohol', pr.selected_contains_self_generated_alcohol,
      'combined_restricted_declaration', v_combined,
      'review_status', pr.review_status,
      'is_verified', pr.review_status = 'VERIFIED',
      'row_version', pr.row_version
    ),
    'actions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'sequence_no', a.sequence_no,
          'label', a.action_text,
          'governed_term_id', a.matched_term_id,
          'review_status', a.review_status,
          'is_verified', a.review_status = 'VERIFIED',
          'portal_option_value', a.portal_external_id,
          'portal_value_mapped', a.portal_value_mapped
        )
        order by a.sequence_no
      )
      from (
        select
          r.sequence_no,
          r.action_text,
          r.review_status,
          ct.id as matched_term_id,
          po.external_id as portal_external_id,
          (nullif(btrim(coalesce(po.external_id, '')), '') is not null) as portal_value_mapped
        from regulatory.eaushadhi_product_action_review r
        left join regulatory.controlled_term ct
          on ct.domain_code = 'PHARMACOLOGICAL_ACTION'
         and lower(btrim(ct.label)) = lower(btrim(r.action_text))
         and ct.is_active = true
        left join regulatory.portal_option po
          on po.domain_code = 'PHARMACOLOGICAL_ACTION'
         and lower(btrim(po.label)) = lower(btrim(r.action_text))
         and po.is_active = true
        where r.product_id = p_product_id
      ) a
    ), '[]'::jsonb),
    'composition', coalesce((
      select jsonb_agg(line.obj order by line.sort_key, line.source_composition_line_id)
      from (
        select
          scl.id as source_composition_line_id,
          coalesce(scl.source_row_no, 0) as sort_key,
          jsonb_build_object(
            'source_composition_line_id', scl.id,
            'sequence', scl.source_row_no,
            'ingredient_name', scl.raw_ingredient_name,
            'scientific_name', scl.raw_scientific_name,
            'ingredient_type', jsonb_build_object(
              'sasv_option_id', type_opt.id,
              'label', type_opt.label,
              'portal_option_value', type_opt.external_id,
              'portal_value_mapped', (nullif(btrim(coalesce(type_opt.external_id, '')), '') is not null)
            ),
            'ingredient_form', jsonb_build_object(
              'sasv_option_id', form_opt.id,
              'label', form_opt.label,
              'portal_option_value', form_opt.external_id,
              'portal_value_mapped', (nullif(btrim(coalesce(form_opt.external_id, '')), '') is not null)
            ),
            'part_used', jsonb_build_object(
              'sasv_option_id', part_opt.id,
              'label', part_opt.label,
              'portal_option_value', part_opt.external_id,
              'portal_value_mapped', (nullif(btrim(coalesce(part_opt.external_id, '')), '') is not null)
            ),
            'quantity_value', scl.raw_quantity_value,
            'quantity_text', scl.raw_quantity_text,
            'unit_text', scl.raw_unit_text,
            'measurement', jsonb_build_object(
              'sasv_option_id', meas_opt.id,
              'label', meas_opt.label,
              'portal_option_value', meas_opt.external_id,
              'portal_value_mapped', (nullif(btrim(coalesce(meas_opt.external_id, '')), '') is not null)
            ),
            'reference_source', scl.raw_reference_text,
            'review_status', lr.review_status,
            'is_verified', lr.review_status = 'VERIFIED',
            'row_version', lr.row_version
          ) as obj
        from regulatory.eaushadhi_line_review lr
        join regulatory.source_composition_line scl
          on scl.id = lr.source_composition_line_id
        left join regulatory.portal_option type_opt
          on type_opt.id = lr.selected_ingredient_type_option_id
        left join regulatory.portal_option form_opt
          on form_opt.id = lr.selected_ingredient_form_option_id
        left join regulatory.portal_option part_opt
          on part_opt.id = lr.selected_part_used_option_id
        left join regulatory.portal_option meas_opt
          on meas_opt.id = lr.selected_measurement_option_id
        where lr.product_id = p_product_id
      ) line
    ), '[]'::jsonb),
    'evidence', jsonb_build_object(
      'approved_product_copy_present', exists(
        select 1
        from regulatory.product_document d
        where d.product_id = p_product_id
          and d.is_current = true
          and d.document_purpose = 'APPROVED_PRODUCT_COPY'
      ),
      'approved_product_copy_required', null,
      'storage_bucket', da.storage_bucket,
      'storage_path', da.storage_path,
      'content_sha256', da.content_sha256,
      'original_file_name', da.original_file_name
    ),
    'versions', jsonb_build_object(
      'workflow_row_version', v_workflow.row_version,
      'review_row_version', pr.row_version,
      'actions_row_version', (
        select max(ar.row_version)
        from regulatory.eaushadhi_product_action_review ar
        where ar.product_id = p_product_id
      )
    ),
    'portal_product_ref', v_workflow.portal_product_ref,
    'entry_status', v_workflow.entry_status
  )
  into v_canonical
  from regulatory.eaushadhi_product_review pr
  join public.v_product_details vpd on vpd.product_id = pr.product_id
  join regulatory.product_dossier d on d.product_id = pr.product_id
  left join regulatory.controlled_term sys on sys.id = d.system_term_id
  left join regulatory.controlled_term mc on mc.id = d.medicine_class_term_id
  left join regulatory.controlled_term df on df.id = d.dosage_form_term_id
  left join regulatory.controlled_term st on st.id = d.subtype_term_id
  left join regulatory.controlled_term selpp on selpp.id = pr.selected_permission_purpose_term_id
  left join regulatory.product_document pd
    on pd.product_id = pr.product_id
   and pd.is_current = true
   and pd.document_purpose = 'APPROVED_PRODUCT_COPY'
  left join regulatory.document_asset da on da.id = pd.document_asset_id
  where pr.product_id = p_product_id;

  if v_canonical is null then
    raise exception using errcode = 'P0002', message = 'e-Aushadhi product review not found';
  end if;

  v_hash := encode(digest(convert_to(v_canonical::text, 'UTF8'), 'sha256'), 'hex');

  return v_canonical || jsonb_build_object('payload_hash', v_hash);
end;
$function$;

comment on function public.rpc_eaushadhi_worker_preflight(integer) is
  'Read-only worker preflight. Eligible only when entry_status is NOT_STARTED and readiness passes. No writes.';
comment on function public.rpc_eaushadhi_worker_payload_get(integer, bigint) is
  'Read-only governed snapshot. portal_product_name comes from product_dossier and is included in payload_hash.';

revoke all on function public.rpc_eaushadhi_worker_preflight(integer) from public;
revoke all on function public.rpc_eaushadhi_worker_payload_get(integer, bigint) from public;
revoke all on function public.rpc_eaushadhi_worker_preflight(integer) from anon;
revoke all on function public.rpc_eaushadhi_worker_payload_get(integer, bigint) from anon;
grant execute on function public.rpc_eaushadhi_worker_preflight(integer) to authenticated, service_role;
grant execute on function public.rpc_eaushadhi_worker_payload_get(integer, bigint) to authenticated, service_role;

commit;
