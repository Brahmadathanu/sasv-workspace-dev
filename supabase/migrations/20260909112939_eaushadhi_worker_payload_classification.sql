-- Bind verified portal classification into the governed worker payload / hashes.
-- Read-only snapshot change only. No run_begin, entry_status, or portal mutation.

begin;

create or replace function regulatory.eaushadhi_worker_content_hash(p_payload jsonb)
returns text
language sql
immutable
set search_path to 'public', 'regulatory', 'extensions', 'pg_temp'
as $function$
with action_items as (
  select coalesce(
    jsonb_agg((e.value - array['review_status','is_verified','row_version']::text[]) order by e.ord),
    '[]'::jsonb
  ) as value
  from jsonb_array_elements(coalesce(p_payload->'actions','[]'::jsonb)) with ordinality as e(value, ord)
), composition_items as (
  select coalesce(
    jsonb_agg((e.value - array['review_status','is_verified','row_version','source_composition_line_id']::text[]) order by e.ord),
    '[]'::jsonb
  ) as value
  from jsonb_array_elements(coalesce(p_payload->'composition','[]'::jsonb)) with ordinality as e(value, ord)
), classification_item as (
  select case
    when jsonb_typeof(p_payload->'classification') = 'object' then
      (p_payload->'classification') - array['review_status','is_verified','row_version']::text[]
    else '{}'::jsonb
  end as value
), canonical as (
  select jsonb_build_object(
    'product', coalesce(p_payload->'product','{}'::jsonb),
    'details', coalesce(p_payload->'details','{}'::jsonb) - array['review_status','is_verified','row_version']::text[],
    'actions', action_items.value,
    'composition', composition_items.value,
    'evidence', coalesce(p_payload->'evidence','{}'::jsonb),
    'classification', classification_item.value
  ) as value
  from action_items, composition_items, classification_item
)
select encode(digest(convert_to(canonical.value::text,'UTF8'),'sha256'),'hex')
from canonical;
$function$;

comment on function regulatory.eaushadhi_worker_content_hash(jsonb) is
  'Execution content hash. Includes classification fill values (subtype_mode + selected options) but strips classification review bookkeeping.';

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
  v_class regulatory.eaushadhi_product_classification_review%rowtype;
  v_type regulatory.portal_option%rowtype;
  v_category regulatory.portal_option%rowtype;
  v_subtype regulatory.portal_option%rowtype;
  v_has_type boolean := false;
  v_has_category boolean := false;
  v_has_subtype boolean := false;
  v_type_json jsonb;
  v_category_json jsonb;
  v_subtype_json jsonb;
  v_classification jsonb;
  v_canonical jsonb;
  v_hash text;
  v_bhang boolean;
  v_opium boolean;
  v_narcotic boolean;
  v_e1 boolean;
  v_alcohol boolean;
  v_combined text;
  v_mode text;
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

  select * into v_class
  from regulatory.eaushadhi_product_classification_review cr
  where cr.product_id = p_product_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'e-Aushadhi classification review not found';
  end if;

  v_mode := upper(btrim(coalesce(v_class.selected_subtype_mode, 'UNRESOLVED')));

  if v_class.selected_product_type_option_id is not null then
    select * into v_type
    from regulatory.portal_option po
    where po.id = v_class.selected_product_type_option_id
      and po.portal_code = 'E_AUSHADHI'
      and po.domain_code = 'PRODUCT_TYPE'
      and po.is_active = true;
    v_has_type := found;
  end if;

  if v_class.selected_product_category_option_id is not null then
    select * into v_category
    from regulatory.portal_option po
    where po.id = v_class.selected_product_category_option_id
      and po.portal_code = 'E_AUSHADHI'
      and po.domain_code = 'PRODUCT_CATEGORY'
      and po.is_active = true;
    v_has_category := found;
  end if;

  if v_class.selected_product_subtype_option_id is not null then
    select * into v_subtype
    from regulatory.portal_option po
    where po.id = v_class.selected_product_subtype_option_id
      and po.portal_code = 'E_AUSHADHI'
      and po.domain_code = 'PRODUCT_SUBTYPE'
      and po.is_active = true;
    v_has_subtype := found;
  end if;

  if v_class.review_status = 'VERIFIED' then
    if v_class.selected_product_type_option_id is null or not v_has_type then
      raise exception using
        errcode = '22023',
        message = 'Verified classification is missing a resolvable Product Type option';
    end if;
    if coalesce(v_type.source_context->>'fill_eligible', 'true') <> 'true' then
      raise exception using
        errcode = '22023',
        message = 'Verified Product Type option is not fill-eligible';
    end if;

    if v_class.selected_product_category_option_id is null or not v_has_category then
      raise exception using
        errcode = '22023',
        message = 'Verified classification is missing a resolvable Product Category option';
    end if;
    if coalesce(v_category.source_context->>'fill_eligible', 'true') <> 'true' then
      raise exception using
        errcode = '22023',
        message = 'Verified Product Category option is not fill-eligible';
    end if;
    if v_category.parent_domain_code is distinct from 'PRODUCT_TYPE'
       or v_category.parent_external_id is distinct from v_type.external_id then
      raise exception using
        errcode = '22023',
        message = 'Verified Product Category is not scoped to selected Product Type';
    end if;

    if v_mode = 'UNRESOLVED' then
      raise exception using
        errcode = '22023',
        message = 'Verified classification cannot remain UNRESOLVED for Product Sub Type';
    elsif v_mode = 'OPTION' then
      if v_class.selected_product_subtype_option_id is null or not v_has_subtype then
        raise exception using
          errcode = '22023',
          message = 'Verified OPTION classification is missing a resolvable Product Sub Type option';
      end if;
      if coalesce(v_subtype.source_context->>'fill_eligible', 'true') <> 'true' then
        raise exception using
          errcode = '22023',
          message = 'Verified Product Sub Type option is not fill-eligible';
      end if;
      if v_subtype.parent_domain_code is distinct from 'PRODUCT_TYPE'
         or v_subtype.parent_external_id is distinct from v_type.external_id then
        raise exception using
          errcode = '22023',
          message = 'Verified Product Sub Type is not scoped to selected Product Type';
      end if;
    elsif v_mode = 'BLANK' then
      if v_class.selected_product_subtype_option_id is not null then
        raise exception using
          errcode = '22023',
          message = 'Verified BLANK classification must not select a Product Sub Type option';
      end if;
    else
      raise exception using
        errcode = '22023',
        message = 'Verified classification has an invalid subtype mode';
    end if;
  end if;

  if v_has_type then
    v_type_json := jsonb_build_object(
      'sasv_option_id', v_type.id,
      'label', v_type.label,
      'portal_option_value', v_type.external_id,
      'portal_value_mapped', (nullif(btrim(coalesce(v_type.external_id, '')), '') is not null),
      'parent_domain_code', nullif(btrim(coalesce(v_type.parent_domain_code, '')), ''),
      'parent_external_id', nullif(btrim(coalesce(v_type.parent_external_id, '')), '')
    );
  else
    v_type_json := null;
  end if;

  if v_has_category then
    v_category_json := jsonb_build_object(
      'sasv_option_id', v_category.id,
      'label', v_category.label,
      'portal_option_value', v_category.external_id,
      'portal_value_mapped', (nullif(btrim(coalesce(v_category.external_id, '')), '') is not null),
      'parent_domain_code', nullif(btrim(coalesce(v_category.parent_domain_code, '')), ''),
      'parent_external_id', nullif(btrim(coalesce(v_category.parent_external_id, '')), '')
    );
  else
    v_category_json := null;
  end if;

  if v_mode = 'BLANK' then
    v_subtype_json := null;
  elsif v_has_subtype then
    v_subtype_json := jsonb_build_object(
      'sasv_option_id', v_subtype.id,
      'label', v_subtype.label,
      'portal_option_value', v_subtype.external_id,
      'portal_value_mapped', (nullif(btrim(coalesce(v_subtype.external_id, '')), '') is not null),
      'parent_domain_code', nullif(btrim(coalesce(v_subtype.parent_domain_code, '')), ''),
      'parent_external_id', nullif(btrim(coalesce(v_subtype.parent_external_id, '')), '')
    );
  else
    v_subtype_json := null;
  end if;

  -- Selected classification only. Never emit suggested_* or dossier System/Class/Dosage/Subtype.
  v_classification := jsonb_build_object(
    'review_status', v_class.review_status,
    'is_verified', v_class.review_status = 'VERIFIED',
    'row_version', v_class.row_version,
    'subtype_mode', v_mode,
    'product_type', v_type_json,
    'product_category', v_category_json,
    'product_subtype', v_subtype_json
  );

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
    'classification', v_classification,
    'versions', jsonb_build_object(
      'workflow_row_version', v_workflow.row_version,
      'review_row_version', pr.row_version,
      'actions_row_version', (
        select max(ar.row_version)
        from regulatory.eaushadhi_product_action_review ar
        where ar.product_id = p_product_id
      ),
      'classification_row_version', v_class.row_version
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

comment on function public.rpc_eaushadhi_worker_payload_get(integer, bigint) is
  'Read-only governed snapshot. Includes selected portal classification (never suggested/dossier fallback). Classification participates in payload_hash.';

revoke all on function public.rpc_eaushadhi_worker_payload_get(integer, bigint) from public;
revoke all on function public.rpc_eaushadhi_worker_payload_get(integer, bigint) from anon;
grant execute on function public.rpc_eaushadhi_worker_payload_get(integer, bigint) to authenticated, service_role;

commit;
