-- Gate A audit correction: approval separation of duties.
-- Registers role:pm-bom-revision-approve and retargets approve RPC auth.
-- Does not grant the role to any user. No bootstrap / costing / UI changes.

insert into public.permission_targets (
  key,
  kind,
  label,
  sort_order,
  is_assignable,
  meta
) values (
  'role:pm-bom-revision-approve',
  'role',
  'PM BOM Revision — Approve',
  960,
  true,
  jsonb_build_object(
    'domain', 'plm',
    'capability', 'pm_bom_revision_approve',
    'module_key', 'pm-templates',
    'confidential', true,
    'governed', true
  )
)
on conflict (key) do update
set
  kind = excluded.kind,
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_assignable = excluded.is_assignable,
  meta = excluded.meta;

create or replace function public.rpc_plm_bom_revision_approve(
  p_revision_id bigint,
  p_effective_from date,
  p_change_reason text,
  p_approval_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_draft public.plm_bom_revision%rowtype;
  v_prior public.plm_bom_revision%rowtype;
  v_reason text := nullif(btrim(p_change_reason), '');
  v_ref text := nullif(btrim(p_approval_reference), '');
  v_hash text;
  v_line_count integer;
  v_actor uuid := auth.uid();
begin
  perform public.require_permission('role:pm-bom-revision-approve', true);

  if p_revision_id is null then
    raise exception 'p_revision_id is required';
  end if;
  if p_effective_from is null then
    raise exception 'p_effective_from is required';
  end if;
  if v_reason is null then
    raise exception 'change_reason is required';
  end if;
  if v_ref is not null and upper(v_ref) in ('-', '—', 'NA', 'N/A', 'AUTO', 'MIGRATION') then
    raise exception 'A meaningful approval_reference is required when provided';
  end if;

  select * into v_draft
  from public.plm_bom_revision
  where id = p_revision_id
  for update;

  if not found then
    raise exception 'Revision % not found', p_revision_id;
  end if;

  perform pg_advisory_xact_lock(87201401, (abs(v_draft.sku_id) % 2147483647)::integer);

  -- Re-lock draft after sku lock
  select * into v_draft
  from public.plm_bom_revision
  where id = p_revision_id
  for update;

  if v_draft.status <> 'DRAFT' then
    raise exception 'Only DRAFT revisions may be approved (revision % is %)', p_revision_id, v_draft.status;
  end if;

  select count(*)::integer into v_line_count
  from public.plm_bom_revision_line l
  where l.revision_id = p_revision_id;

  if v_line_count = 0 then
    raise exception 'Draft revision % has no lines', p_revision_id;
  end if;

  -- Lock all revisions for this SKU against concurrent approval
  perform 1
  from public.plm_bom_revision r
  where r.sku_id = v_draft.sku_id
  for update;

  select * into v_prior
  from public.plm_bom_revision r
  where r.sku_id = v_draft.sku_id
    and r.status = 'APPROVED'
    and r.effective_to is null
  for update;

  if found then
    if p_effective_from <= v_prior.effective_from then
      raise exception 'Successor effective_from (%) must be after prior open APPROVED effective_from (%)',
        p_effective_from, v_prior.effective_from;
    end if;
  end if;

  -- Prevalidate successor open window vs other governed rows
  -- (prior open APPROVED is excluded; it will be closed in this transaction)
  if exists (
    select 1
    from public.plm_bom_revision r
    where r.sku_id = v_draft.sku_id
      and r.id <> p_revision_id
      and (v_prior.id is null or r.id <> v_prior.id)
      and r.status in ('APPROVED', 'SUPERSEDED')
      and daterange(r.effective_from, coalesce(r.effective_to, 'infinity'::date), '[]')
          && daterange(p_effective_from, 'infinity'::date, '[]')
  ) then
    raise exception 'Governed PM-BOM revision overlap would occur for sku_id=% from %',
      v_draft.sku_id, p_effective_from;
  end if;

  perform set_config('app.plm_bom_revision_mutate_context', 'GOVERNED', true);

  if v_prior.id is not null then
    update public.plm_bom_revision
    set status = 'SUPERSEDED',
        effective_to = p_effective_from - 1,
        superseded_at = clock_timestamp(),
        superseded_by = v_actor
    where id = v_prior.id;
  end if;

  -- Apply effective_from before hash so hash matches stored approved content
  update public.plm_bom_revision
  set effective_from = p_effective_from,
      change_reason = v_reason,
      approval_reference = v_ref
  where id = p_revision_id;

  v_hash := public.fn_plm_bom_revision_compute_content_hash(p_revision_id);

  update public.plm_bom_revision
  set status = 'APPROVED',
      approved_at = clock_timestamp(),
      approved_by = v_actor,
      frozen_at = clock_timestamp(),
      content_hash = v_hash,
      supersedes_revision_id = v_prior.id
  where id = p_revision_id;

  perform set_config('app.plm_bom_revision_mutate_context', '', true);

  return jsonb_build_object(
    'revision_id', p_revision_id,
    'sku_id', v_draft.sku_id,
    'status', 'APPROVED',
    'effective_from', p_effective_from,
    'content_hash', v_hash,
    'superseded_revision_id', v_prior.id,
    'prior_effective_to', case when v_prior.id is not null then p_effective_from - 1 else null end
  );
exception
  when others then
    perform set_config('app.plm_bom_revision_mutate_context', '', true);
    raise;
end;
$function$;

-- Preserve hardened client RPC execute surface after replace
revoke all on function public.rpc_plm_bom_revision_approve(bigint, date, text, text)
  from public, anon;
grant execute on function public.rpc_plm_bom_revision_approve(bigint, date, text, text)
  to authenticated, service_role;
