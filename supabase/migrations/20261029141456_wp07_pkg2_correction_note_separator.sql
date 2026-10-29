-- WP-07 PKG2: correction-note separator fix. DRAFT 2026-10-29 IST. NOT APPLIED.
-- Drafted version 20261029190000 (live apply assigns its own version; rename the repo file afterwards).
-- One-line change in public.rpc_eaushadhi_correct_working_source_line: the note joiner E'\\n'
-- (stores backslash + n, 2 characters) becomes E'\n' (a real line break, chr(10)).
-- Everything else is byte-identical to the live body (live md5 1648c3cd6711e92a2f7e3c111a8409d3, see BODY_DIFF.txt).
-- CREATE OR REPLACE keeps the owner, the ACL (postgres, authenticated, service_role EXECUTE; no PUBLIC, no anon),
-- SECURITY DEFINER and the search_path setting, which are restated in the body as live.
-- Existing stored notes are NOT changed here (see OPTIONAL_CLEANUP_LINE_107.sql).
do $pre$ begin
  if md5(pg_get_functiondef('public.rpc_eaushadhi_correct_working_source_line(bigint,text,text,text,text,numeric,text,text)'::regprocedure))
     is distinct from '1648c3cd6711e92a2f7e3c111a8409d3' then
    raise exception 'PKG2_PREFLIGHT_FAILED: live body changed since 2026-10-29 fingerprint';
  end if;
end $pre$;

CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_correct_working_source_line(p_source_composition_line_id bigint, p_raw_ingredient_name text, p_raw_scientific_name text, p_raw_part_used text, p_raw_quantity_text text, p_raw_quantity_value numeric, p_raw_unit_text text, p_correction_reason text)
 RETURNS TABLE(source_composition_line_id bigint, product_id integer, review_status text, resolution_status text, invalidated_identity boolean, invalidated_part boolean, invalidated_measurement boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'pg_temp'
AS $function$
declare
  v_user uuid;
  v_line regulatory.source_composition_line%rowtype;
  v_review regulatory.eaushadhi_line_review%rowtype;
  v_latest regulatory.source_line_resolution%rowtype;
  v_identity_changed boolean := false;
  v_part_changed boolean := false;
  v_unit_changed boolean := false;
  v_new_resolution_id bigint;
  v_product_id integer;
begin
  v_user := public.rpc_eaushadhi_require_permission(true);

  if nullif(btrim(coalesce(p_correction_reason,'')), '') is null then
    raise exception using errcode='22023', message='Correction reason is required';
  end if;
  if nullif(btrim(coalesce(p_raw_ingredient_name,'')), '') is null then
    raise exception using errcode='22023', message='Ingredient name cannot be blank';
  end if;
  if p_raw_quantity_value is not null and p_raw_quantity_value < 0 then
    raise exception using errcode='22023', message='Quantity cannot be negative';
  end if;

  select scl.* into v_line
  from regulatory.source_composition_line scl
  where scl.id = p_source_composition_line_id
  for update;
  if not found then
    raise exception using errcode='P0002', message='Source composition line not found';
  end if;

  v_product_id := v_line.matched_product_id;

  select er.* into v_review
  from regulatory.eaushadhi_line_review er
  where er.source_composition_line_id = p_source_composition_line_id
  for update;

  if found and v_review.review_status = 'VERIFIED' then
    raise exception using errcode='55000', message='Working source cannot be corrected after the ingredient line is VERIFIED';
  end if;

  if v_product_id is not null and exists (
    select 1
    from regulatory.formulation_version fv
    where fv.product_id = v_product_id and fv.status = 'APPROVED'
  ) then
    raise exception using errcode='55000', message='Working source cannot be corrected after an approved formulation exists';
  end if;

  v_identity_changed :=
    coalesce(btrim(v_line.raw_ingredient_name),'') is distinct from coalesce(btrim(p_raw_ingredient_name),'')
    or coalesce(btrim(v_line.raw_scientific_name),'') is distinct from coalesce(btrim(p_raw_scientific_name),'');
  v_part_changed := coalesce(btrim(v_line.raw_part_used),'') is distinct from coalesce(btrim(p_raw_part_used),'');
  v_unit_changed := coalesce(btrim(v_line.raw_unit_text),'') is distinct from coalesce(btrim(p_raw_unit_text),'');

  update regulatory.source_composition_line scl
  set raw_ingredient_name = btrim(p_raw_ingredient_name),
      raw_scientific_name = nullif(btrim(coalesce(p_raw_scientific_name,'')), ''),
      raw_part_used = nullif(btrim(coalesce(p_raw_part_used,'')), ''),
      raw_quantity_text = nullif(btrim(coalesce(p_raw_quantity_text,'')), ''),
      raw_quantity_value = p_raw_quantity_value,
      raw_unit_text = nullif(btrim(coalesce(p_raw_unit_text,'')), '')
  where scl.id = p_source_composition_line_id;

  select slr.* into v_latest
  from regulatory.source_line_resolution slr
  where slr.source_composition_line_id = p_source_composition_line_id
  order by slr.id desc
  limit 1;

  if found and (v_identity_changed or v_part_changed or v_unit_changed) then
    insert into regulatory.source_line_resolution(
      source_composition_line_id,product_id,ingredient_identity_id,inv_stock_item_id,inv_uom_id,
      ingredient_type_term_id,ingredient_form_term_id,part_used_term_id,reference_publication_id,
      resolution_status,match_method,confidence,rationale,supersedes_id,resolved_by,resolved_at,measurement_unit_term_id
    ) values (
      p_source_composition_line_id,
      v_latest.product_id,
      case when v_identity_changed then null else v_latest.ingredient_identity_id end,
      null,null,
      v_latest.ingredient_type_term_id,
      v_latest.ingredient_form_term_id,
      case when v_identity_changed or v_part_changed then null else v_latest.part_used_term_id end,
      v_latest.reference_publication_id,
      'REVIEW_REQUIRED','WORKING_SOURCE_CORRECTION',null,
      'Working source corrected before Supabase approval. Reason: ' || btrim(p_correction_reason),
      v_latest.id,v_user,now(),
      case when v_unit_changed then null else v_latest.measurement_unit_term_id end
    ) returning id into v_new_resolution_id;
  end if;

  if v_review.source_composition_line_id is not null then
    update regulatory.eaushadhi_line_review er
    set review_status='PENDING',
        selected_part_used_option_id=case when v_identity_changed or v_part_changed then null else er.selected_part_used_option_id end,
        suggested_part_used_option_id=case when v_identity_changed or v_part_changed then null else er.suggested_part_used_option_id end,
        selected_measurement_option_id=case when v_unit_changed then null else er.selected_measurement_option_id end,
        suggested_measurement_option_id=case when v_unit_changed then null else er.suggested_measurement_option_id end,
        review_notes=concat_ws(E'\n',nullif(er.review_notes,''),'Working source corrected: ' || btrim(p_correction_reason)),
        reviewed_by=null,
        reviewed_at=null,
        row_version=er.row_version+1,
        updated_at=now(),
        updated_by=v_user
    where er.source_composition_line_id=p_source_composition_line_id;
  end if;

  update regulatory.reconciliation_issue ri
  set status='RESOLVED',
      resolution_text='Resolved by pre-approval working source correction: ' || btrim(p_correction_reason),
      resolved_by=v_user,
      resolved_at=now(),
      updated_by=v_user,
      updated_at=now()
  where ri.status in ('OPEN','IN_REVIEW')
    and ri.product_id = v_product_id
    and (ri.left_source_line_id = p_source_composition_line_id or ri.right_source_line_id = p_source_composition_line_id)
    and (
      (ri.issue_code='SOURCE_SCIENTIFIC_IDENTITY_MISSING' and nullif(btrim(coalesce(p_raw_scientific_name,'')),'') is not null)
      or (ri.issue_code='SOURCE_PART_USED_MISSING' and nullif(btrim(coalesce(p_raw_part_used,'')),'') is not null)
      or (ri.issue_code='SOURCE_PER_DOSE_QUANTITY_MISSING' and nullif(btrim(coalesce(p_raw_quantity_text,'')),'') is not null)
    );

  return query
  select p_source_composition_line_id,
         v_product_id,
         coalesce((select er.review_status from regulatory.eaushadhi_line_review er where er.source_composition_line_id=p_source_composition_line_id),'PENDING'),
         coalesce((select slr.resolution_status from regulatory.source_line_resolution slr where slr.source_composition_line_id=p_source_composition_line_id order by slr.id desc limit 1),'UNMAPPED'),
         v_identity_changed,
         v_identity_changed or v_part_changed,
         v_unit_changed;
end;
$function$;
