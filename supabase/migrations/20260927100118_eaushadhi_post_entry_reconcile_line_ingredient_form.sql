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
set search_path = public, regulatory, pg_temp
as $$
declare
  v_actor uuid := public.rpc_eaushadhi_require_permission(true);
  v_now timestamptz := now();
  v_reason text := nullif(btrim(p_reason), '');
  v_entry_status text;
  v_line regulatory.eaushadhi_line_review%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_old_option regulatory.portal_option%rowtype;
  v_new_option regulatory.portal_option%rowtype;
  v_line_note text;
  v_workflow_note text;
begin
  if p_source_composition_line_id is null or p_source_composition_line_id <= 0 then
    raise exception 'p_source_composition_line_id must be a positive bigint';
  end if;
  if p_expected_line_row_version is null or p_expected_line_row_version <= 0 then
    raise exception 'p_expected_line_row_version must be a positive bigint';
  end if;
  if p_expected_workflow_row_version is null or p_expected_workflow_row_version <= 0 then
    raise exception 'p_expected_workflow_row_version must be a positive bigint';
  end if;
  if p_ingredient_form_option_id is null or p_ingredient_form_option_id <= 0 then
    raise exception 'p_ingredient_form_option_id must be a positive bigint';
  end if;
  if v_reason is null then
    raise exception 'A nonblank reconciliation reason is required';
  end if;

  select lr.*
  into v_line
  from regulatory.eaushadhi_line_review lr
  where lr.source_composition_line_id = p_source_composition_line_id
  for update;

  if not found then
    raise exception 'Composition line % was not found', p_source_composition_line_id;
  end if;
  if v_line.product_id <> 262 then
    raise exception 'Post-entry Ingredient Form reconciliation is restricted to product 262';
  end if;
  if v_line.row_version <> p_expected_line_row_version then
    raise exception 'Stale Composition line row_version: expected %, current %',
      p_expected_line_row_version, v_line.row_version;
  end if;
  if upper(btrim(coalesce(v_line.review_status, ''))) <> 'VERIFIED' then
    raise exception 'Composition line must remain VERIFIED';
  end if;

  select w.*
  into v_workflow
  from regulatory.eaushadhi_product_workflow w
  where w.product_id = v_line.product_id
  for update;

  if not found then
    raise exception 'e-Aushadhi workflow for product % was not found', v_line.product_id;
  end if;
  if v_workflow.row_version <> p_expected_workflow_row_version then
    raise exception 'Stale workflow row_version: expected %, current %',
      p_expected_workflow_row_version, v_workflow.row_version;
  end if;

  v_entry_status := upper(btrim(coalesce(v_workflow.entry_status, '')));
  if v_entry_status = '' then
    raise exception 'Workflow entry_status is required for post-entry reconciliation';
  end if;
  if v_entry_status = 'NOT_STARTED' then
    raise exception 'Use the pre-entry correction workflow before portal entry starts';
  end if;
  if v_entry_status = 'SUBMITTED' then
    raise exception 'Post-entry reconciliation is blocked after SUBMITTED';
  end if;
  if v_entry_status not in ('IN_PROGRESS', 'ENTERED', 'PORTAL_VERIFIED') then
    raise exception 'Post-entry reconciliation is not allowed for entry_status %', v_entry_status;
  end if;
  if nullif(btrim(v_workflow.portal_product_ref), '') is null then
    raise exception 'A portal product identity is required for post-entry reconciliation';
  end if;

  if exists (
    select 1
    from regulatory.eaushadhi_worker_run wr
    where wr.product_id = v_line.product_id
      and wr.run_status in ('RUNNING', 'ENTERED')
  ) then
    raise exception 'Post-entry reconciliation is blocked while a worker run is active';
  end if;

  select po.*
  into v_new_option
  from regulatory.portal_option po
  where po.id = p_ingredient_form_option_id
    and po.portal_code = 'E_AUSHADHI'
    and po.domain_code = 'INGREDIENT_FORM'
    and po.is_active = true
    and nullif(btrim(po.external_id), '') is not null
    and btrim(po.external_id) <> '-1';

  if not found then
    raise exception 'Requested Ingredient Form option is not an active usable E_AUSHADHI option';
  end if;
  if v_line.selected_ingredient_form_option_id is not distinct from p_ingredient_form_option_id then
    raise exception 'Requested Ingredient Form is already selected';
  end if;

  select po.*
  into v_old_option
  from regulatory.portal_option po
  where po.id = v_line.selected_ingredient_form_option_id;

  v_line_note := format(
    '[POST-ENTRY RECONCILIATION] Ingredient Form: %s [%s] -> %s [%s]. Reason: %s',
    coalesce(v_old_option.label, 'Unmapped'),
    coalesce(v_old_option.external_id, ''),
    v_new_option.label,
    v_new_option.external_id,
    v_reason
  );
  v_workflow_note := format(
    '[POST-ENTRY COMPOSITION RECONCILIATION] Source line %s Ingredient Form: %s [%s] -> %s [%s]. Reason: %s',
    v_line.source_composition_line_id,
    coalesce(v_old_option.label, 'Unmapped'),
    coalesce(v_old_option.external_id, ''),
    v_new_option.label,
    v_new_option.external_id,
    v_reason
  );

  update regulatory.eaushadhi_line_review lr
  set selected_ingredient_form_option_id = v_new_option.id,
      review_status = 'VERIFIED',
      review_notes = case
        when nullif(btrim(coalesce(lr.review_notes, '')), '') is null then v_line_note
        else rtrim(lr.review_notes) || E'\n' || v_line_note
      end,
      reviewed_by = v_actor,
      reviewed_at = v_now,
      row_version = lr.row_version + 1,
      updated_by = v_actor
  where lr.source_composition_line_id = v_line.source_composition_line_id
  returning lr.* into v_line;

  update regulatory.eaushadhi_product_workflow w
  set workflow_notes = case
        when nullif(btrim(coalesce(w.workflow_notes, '')), '') is null then v_workflow_note
        else rtrim(w.workflow_notes) || E'\n' || v_workflow_note
      end,
      row_version = w.row_version + 1,
      updated_by = v_actor
  where w.product_id = v_workflow.product_id
  returning w.* into v_workflow;

  return query
  select
    v_line.source_composition_line_id,
    v_line.product_id,
    v_line.review_status,
    v_line.row_version,
    v_workflow.row_version,
    v_workflow.entry_status,
    v_old_option.id,
    v_old_option.external_id,
    v_old_option.label,
    v_new_option.id,
    v_new_option.external_id,
    v_new_option.label;
end;
$$;

revoke execute on function public.rpc_eaushadhi_post_entry_reconcile_line_ingredient_form(
  bigint, bigint, bigint, bigint, text
) from public, anon;

grant execute on function public.rpc_eaushadhi_post_entry_reconcile_line_ingredient_form(
  bigint, bigint, bigint, bigint, text
) to authenticated, service_role;
