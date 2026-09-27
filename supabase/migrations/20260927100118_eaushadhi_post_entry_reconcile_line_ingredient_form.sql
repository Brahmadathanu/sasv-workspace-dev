create or replace function public.rpc_eaushadhi_post_entry_reconcile_line_ingredient_form(
  p_source_composition_line_id bigint,
  p_expected_line_row_version bigint,
  p_expected_workflow_row_version bigint,
  p_ingredient_form_option_id bigint,
  p_reason text
)
returns table (
  source_composition_line_id bigint,
  product_id integer,
  review_status text,
  line_row_version bigint,
  workflow_row_version bigint,
  entry_status text,
  old_ingredient_form_option_id bigint,
  old_ingredient_form_external_id text,
  old_ingredient_form_label text,
  new_ingredient_form_option_id bigint,
  new_ingredient_form_external_id text,
  new_ingredient_form_label text
)
language plpgsql
security definer
set search_path to 'public', 'regulatory', 'pg_temp'
as $$
declare
  v_user uuid;
  v_line regulatory.eaushadhi_line_review%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_old regulatory.portal_option%rowtype;
  v_new regulatory.portal_option%rowtype;
  v_note text;
begin
  v_user := public.rpc_eaushadhi_require_permission(true);

  if p_source_composition_line_id is null or p_source_composition_line_id <= 0 then
    raise exception using
      errcode = '22023',
      message = 'p_source_composition_line_id must be a positive integer';
  end if;
  if p_expected_line_row_version is null or p_expected_line_row_version <= 0 then
    raise exception using
      errcode = '22023',
      message = 'p_expected_line_row_version must be a positive integer';
  end if;
  if p_expected_workflow_row_version is null or p_expected_workflow_row_version <= 0 then
    raise exception using
      errcode = '22023',
      message = 'p_expected_workflow_row_version must be a positive integer';
  end if;
  if p_ingredient_form_option_id is null or p_ingredient_form_option_id <= 0 then
    raise exception using
      errcode = '22023',
      message = 'p_ingredient_form_option_id must be a positive integer';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Reconciliation reason is required';
  end if;

  select r.*
  into v_line
  from regulatory.eaushadhi_line_review r
  where r.source_composition_line_id = p_source_composition_line_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'e-Aushadhi Composition review line not found';
  end if;
  if v_line.product_id <> 262 then
    raise exception using
      errcode = '55000',
      message = 'Post-entry Composition line reconciliation V1 is restricted to controlled Product 262';
  end if;
  if v_line.row_version <> p_expected_line_row_version then
    raise exception using
      errcode = '40001',
      message = format(
        'Composition review row changed; expected version %s, current version %s',
        p_expected_line_row_version,
        v_line.row_version
      );
  end if;
  if v_line.review_status <> 'VERIFIED' then
    raise exception using
      errcode = '55000',
      message = 'Only a VERIFIED Composition line can be reconciled post-entry';
  end if;

  select w.*
  into v_workflow
  from regulatory.eaushadhi_product_workflow w
  where w.product_id = v_line.product_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'e-Aushadhi product workflow not found';
  end if;
  if v_workflow.row_version <> p_expected_workflow_row_version then
    raise exception using
      errcode = '40001',
      message = format(
        'Product workflow changed; expected version %s, current version %s',
        p_expected_workflow_row_version,
        v_workflow.row_version
      );
  end if;
  if nullif(btrim(coalesce(v_workflow.entry_status, '')), '') is null then
    raise exception using
      errcode = '55000',
      message = 'Portal entry status is unavailable; post-entry reconciliation is blocked';
  end if;
  if v_workflow.entry_status not in ('IN_PROGRESS', 'ENTERED', 'PORTAL_VERIFIED') then
    if v_workflow.entry_status = 'NOT_STARTED' then
      raise exception using
        errcode = '55000',
        message = 'Portal entry has not started. Use the pre-entry review correction workflow instead';
    elsif v_workflow.entry_status = 'SUBMITTED' then
      raise exception using
        errcode = '55000',
        message = 'Submitted products cannot be reconciled through the post-entry Composition V1 workflow';
    else
      raise exception using
        errcode = '55000',
        message = 'Current portal entry status is not eligible for post-entry Composition reconciliation';
    end if;
  end if;
  if nullif(btrim(coalesce(v_workflow.portal_product_ref, '')), '') is null then
    raise exception using
      errcode = '55000',
      message = 'Portal product identity is missing; post-entry reconciliation is blocked';
  end if;

  if exists (
    select 1
    from regulatory.eaushadhi_worker_run wr
    where wr.product_id = v_line.product_id
      and wr.run_status in ('RUNNING', 'ENTERED')
  ) then
    raise exception using
      errcode = '55000',
      message = 'An active e-Aushadhi worker run exists; post-entry reconciliation is blocked';
  end if;

  if v_line.selected_ingredient_form_option_id is not null then
    select po.*
    into v_old
    from regulatory.portal_option po
    where po.id = v_line.selected_ingredient_form_option_id;
  end if;

  select po.*
  into v_new
  from regulatory.portal_option po
  where po.id = p_ingredient_form_option_id
    and po.portal_code = 'E_AUSHADHI'
    and po.domain_code = 'INGREDIENT_FORM'
    and po.is_active = true
    and nullif(btrim(coalesce(po.external_id, '')), '') is not null
    and po.external_id <> '-1';

  if not found then
    raise exception using
      errcode = '22023',
      message = 'Selected Ingredient Form is not an active e-Aushadhi portal option';
  end if;
  if v_line.selected_ingredient_form_option_id is not distinct from p_ingredient_form_option_id then
    raise exception using
      errcode = '55000',
      message = 'Ingredient Form is unchanged; reconciliation requires an actual governed change';
  end if;

  v_note := format(
    '[POST-ENTRY RECONCILIATION] Ingredient Form: %s [%s] -> %s [%s]. Reason: %s',
    coalesce(v_old.label, 'UNSET'),
    coalesce(v_old.external_id, '-'),
    v_new.label,
    v_new.external_id,
    btrim(p_reason)
  );

  update regulatory.eaushadhi_line_review r
  set selected_ingredient_form_option_id = p_ingredient_form_option_id,
      review_status = 'VERIFIED',
      review_notes = concat_ws(
        E'\n',
        nullif(btrim(r.review_notes), ''),
        v_note
      ),
      reviewed_by = v_user,
      reviewed_at = now(),
      row_version = r.row_version + 1,
      updated_by = v_user
  where r.source_composition_line_id = p_source_composition_line_id
  returning r.* into v_line;

  update regulatory.eaushadhi_product_workflow w
  set row_version = w.row_version + 1,
      workflow_notes = concat_ws(
        E'\n',
        nullif(btrim(w.workflow_notes), ''),
        format(
          '[POST-ENTRY COMPOSITION RECONCILIATION] Source line %s Ingredient Form: %s [%s] -> %s [%s]. Reason: %s',
          p_source_composition_line_id,
          coalesce(v_old.label, 'UNSET'),
          coalesce(v_old.external_id, '-'),
          v_new.label,
          v_new.external_id,
          btrim(p_reason)
        )
      ),
      updated_by = v_user
  where w.product_id = v_line.product_id
  returning w.* into v_workflow;

  return query
  select
    v_line.source_composition_line_id,
    v_line.product_id,
    v_line.review_status,
    v_line.row_version,
    v_workflow.row_version,
    v_workflow.entry_status,
    v_old.id,
    v_old.external_id,
    v_old.label,
    v_new.id,
    v_new.external_id,
    v_new.label;
end;
$$;

revoke execute on function public.rpc_eaushadhi_post_entry_reconcile_line_ingredient_form(
  bigint, bigint, bigint, bigint, text
) from public, anon;

grant execute on function public.rpc_eaushadhi_post_entry_reconcile_line_ingredient_form(
  bigint, bigint, bigint, bigint, text
) to authenticated, service_role;
