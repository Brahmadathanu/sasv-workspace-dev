-- Repository sync of already-applied authoritative server contract:
-- portal Diseases/Conditions dual representation, worker payload gate,
-- VERIFY gate, durable SAVE_AMBIGUOUS marker, and same-run authority rebase.
-- Idempotent. Do NOT treat this as a second live mutation when objects exist.

begin;

alter table regulatory.eaushadhi_product_review
  add column if not exists suggested_diseases_conditions_portal_text text;
alter table regulatory.eaushadhi_product_review
  add column if not exists selected_diseases_conditions_portal_text text;
alter table regulatory.eaushadhi_product_review
  add column if not exists diseases_conditions_portal_generation_version text;
alter table regulatory.eaushadhi_product_review
  add column if not exists diseases_conditions_portal_review_status text;
alter table regulatory.eaushadhi_product_review
  add column if not exists diseases_conditions_portal_reviewed_by uuid;
alter table regulatory.eaushadhi_product_review
  add column if not exists diseases_conditions_portal_reviewed_at timestamptz;
alter table regulatory.eaushadhi_product_review
  add column if not exists diseases_conditions_portal_review_notes text;

update regulatory.eaushadhi_product_review
set diseases_conditions_portal_review_status = 'PENDING'
where diseases_conditions_portal_review_status is null;

alter table regulatory.eaushadhi_product_review
  alter column diseases_conditions_portal_review_status set default 'PENDING';
alter table regulatory.eaushadhi_product_review
  alter column diseases_conditions_portal_review_status set not null;

alter table regulatory.eaushadhi_product_review
  drop constraint if exists eaushadhi_product_review_portal_status_check;
alter table regulatory.eaushadhi_product_review
  add constraint eaushadhi_product_review_portal_status_check
  check (
    diseases_conditions_portal_review_status = any (
      array['PENDING'::text, 'REVIEW_REQUIRED'::text, 'VERIFIED'::text]
    )
  );

alter table regulatory.eaushadhi_product_review
  drop constraint if exists eaushadhi_product_review_portal_suggested_nonblank;
alter table regulatory.eaushadhi_product_review
  add constraint eaushadhi_product_review_portal_suggested_nonblank
  check (
    suggested_diseases_conditions_portal_text is null
    or btrim(suggested_diseases_conditions_portal_text) <> ''
  );

alter table regulatory.eaushadhi_product_review
  drop constraint if exists eaushadhi_product_review_portal_selected_nonblank;
alter table regulatory.eaushadhi_product_review
  add constraint eaushadhi_product_review_portal_selected_nonblank
  check (
    selected_diseases_conditions_portal_text is null
    or btrim(selected_diseases_conditions_portal_text) <> ''
  );

comment on column regulatory.eaushadhi_product_review.selected_diseases_conditions_text is
  'Canonical scholarly/transliteration Diseases and Conditions text (may include Unicode diacritics).';
comment on column regulatory.eaushadhi_product_review.suggested_diseases_conditions_portal_text is
  'Automatically generated e-Aushadhi-compatible portal candidate (EAUSHADHI_ASCII_V1). Never auto-VERIFIED.';
comment on column regulatory.eaushadhi_product_review.selected_diseases_conditions_portal_text is
  'Human-verified portal execution value. Worker fill/compare consume only this when VERIFIED.';
comment on column regulatory.eaushadhi_product_review.diseases_conditions_portal_generation_version is
  'Portal candidate generator profile, e.g. EAUSHADHI_ASCII_V1.';
comment on column regulatory.eaushadhi_product_review.diseases_conditions_portal_review_status is
  'PENDING | REVIEW_REQUIRED | VERIFIED for the portal Diseases projection.';

alter table regulatory.eaushadhi_worker_run
  add column if not exists last_save_outcome text;
alter table regulatory.eaushadhi_worker_run
  add column if not exists last_save_observed_at timestamptz;
alter table regulatory.eaushadhi_worker_run
  add column if not exists last_save_evidence jsonb;

comment on column regulatory.eaushadhi_worker_run.last_save_outcome is
  'Durable native-save classifier outcome on this run (e.g. AMBIGUOUS). Authority for rebase.';
comment on column regulatory.eaushadhi_worker_run.last_save_observed_at is
  'When last_save_outcome was recorded.';
comment on column regulatory.eaushadhi_worker_run.last_save_evidence is
  'Bounded non-sensitive save classification evidence.';

create or replace function regulatory.eaushadhi_diseases_ascii_v1(p_text text)
returns text
language plpgsql
immutable
strict
set search_path to 'pg_catalog'
as $function$
declare
  v text := p_text;
begin
  v := replace(v, 'R̥', 'Ri');
  v := replace(v, 'r̥', 'ri');
  v := replace(v, 'Ś', 'Sh');
  v := replace(v, 'ś', 'sh');
  v := replace(v, 'Ṣ', 'Sh');
  v := replace(v, 'ṣ', 'sh');
  v := replace(v, 'Ā', 'A');
  v := replace(v, 'ā', 'a');
  v := replace(v, 'Ī', 'I');
  v := replace(v, 'ī', 'i');
  v := replace(v, 'Ū', 'U');
  v := replace(v, 'ū', 'u');
  v := replace(v, 'Ē', 'E');
  v := replace(v, 'ē', 'e');
  v := replace(v, 'Ō', 'O');
  v := replace(v, 'ō', 'o');
  v := replace(v, 'Ṛ', 'Ri');
  v := replace(v, 'ṛ', 'ri');
  v := replace(v, 'Ṭ', 'T');
  v := replace(v, 'ṭ', 't');
  v := replace(v, 'Ḍ', 'D');
  v := replace(v, 'ḍ', 'd');
  v := replace(v, 'Ṇ', 'N');
  v := replace(v, 'ṇ', 'n');
  v := replace(v, 'Ḷ', 'L');
  v := replace(v, 'ḷ', 'l');
  v := replace(v, 'Ñ', 'Ny');
  v := replace(v, 'ñ', 'ny');
  v := replace(v, 'Ṅ', 'Ng');
  v := replace(v, 'ṅ', 'ng');
  v := replace(v, 'ṉ', 'n');
  v := replace(v, 'Ḥ', 'H');
  v := replace(v, 'ḥ', 'h');
  v := replace(v, 'Ṃ', 'M');
  v := replace(v, 'ṃ', 'm');
  v := replace(v, 'Ṁ', 'M');
  v := replace(v, 'ṁ', 'm');

  if v ~ '[^\x00-\x7F]' then
    return null;
  end if;

  v := regexp_replace(v, '[^A-Za-z0-9 ,;:/@.''-]+', ' ', 'g');
  v := regexp_replace(v, '[[:space:]]+', ' ', 'g');
  v := regexp_replace(v, '[[:space:]]+([,;:/.])', '\1', 'g');
  v := btrim(v);

  if v = '' then
    return null;
  end if;

  return v;
end;
$function$;

revoke all on function regulatory.eaushadhi_diseases_ascii_v1(text) from public;
grant execute on function regulatory.eaushadhi_diseases_ascii_v1(text) to authenticated, service_role;

create or replace function regulatory.trg_eaushadhi_product_review_portal_projection()
returns trigger
language plpgsql
set search_path to 'regulatory', 'pg_catalog'
as $function$
declare
  v_candidate text;
begin
  if new.selected_diseases_conditions_text is null
     or btrim(new.selected_diseases_conditions_text) = '' then
    new.suggested_diseases_conditions_portal_text := null;
    new.selected_diseases_conditions_portal_text := null;
    new.diseases_conditions_portal_generation_version := null;
    new.diseases_conditions_portal_review_status := 'PENDING';
    new.diseases_conditions_portal_reviewed_by := null;
    new.diseases_conditions_portal_reviewed_at := null;
    return new;
  end if;

  v_candidate := regulatory.eaushadhi_diseases_ascii_v1(new.selected_diseases_conditions_text);

  new.suggested_diseases_conditions_portal_text := v_candidate;
  new.selected_diseases_conditions_portal_text := null;
  new.diseases_conditions_portal_generation_version := 'EAUSHADHI_ASCII_V1';
  new.diseases_conditions_portal_review_status :=
    case when v_candidate is null then 'REVIEW_REQUIRED' else 'PENDING' end;
  new.diseases_conditions_portal_reviewed_by := null;
  new.diseases_conditions_portal_reviewed_at := null;

  return new;
end;
$function$;

drop trigger if exists trg_eaushadhi_product_review_portal_projection
  on regulatory.eaushadhi_product_review;

create trigger trg_eaushadhi_product_review_portal_projection
  before insert or update of selected_diseases_conditions_text
  on regulatory.eaushadhi_product_review
  for each row
  execute function regulatory.trg_eaushadhi_product_review_portal_projection();

-- Backfill suggestions without auto-VERIFY.
do $$
declare
  r record;
  v_candidate text;
begin
  for r in
    select product_id, selected_diseases_conditions_text
    from regulatory.eaushadhi_product_review
    where nullif(btrim(selected_diseases_conditions_text), '') is not null
      and suggested_diseases_conditions_portal_text is null
      and diseases_conditions_portal_review_status is distinct from 'VERIFIED'
  loop
    v_candidate := regulatory.eaushadhi_diseases_ascii_v1(r.selected_diseases_conditions_text);
    update regulatory.eaushadhi_product_review
    set suggested_diseases_conditions_portal_text = v_candidate,
        selected_diseases_conditions_portal_text = null,
        diseases_conditions_portal_generation_version = 'EAUSHADHI_ASCII_V1',
        diseases_conditions_portal_review_status =
          case when v_candidate is null then 'REVIEW_REQUIRED' else 'PENDING' end,
        diseases_conditions_portal_reviewed_by = null,
        diseases_conditions_portal_reviewed_at = null
    where product_id = r.product_id
      and diseases_conditions_portal_review_status is distinct from 'VERIFIED';
  end loop;
end $$;

do $$
begin
  if to_regprocedure('public.rpc_eaushadhi_worker_payload_get_legacy_v1(integer,bigint)') is null
     and to_regprocedure('public.rpc_eaushadhi_worker_payload_get(integer,bigint)') is not null then
    execute 'alter function public.rpc_eaushadhi_worker_payload_get(integer, bigint) rename to rpc_eaushadhi_worker_payload_get_legacy_v1';
  end if;
  if to_regprocedure('public.rpc_eaushadhi_verify_product_legacy_v1(integer,bigint,text)') is null
     and to_regprocedure('public.rpc_eaushadhi_verify_product(integer,bigint,text)') is not null then
    execute 'alter function public.rpc_eaushadhi_verify_product(integer, bigint, text) rename to rpc_eaushadhi_verify_product_legacy_v1';
  end if;
end $$;

revoke all on function public.rpc_eaushadhi_worker_payload_get_legacy_v1(integer, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.rpc_eaushadhi_verify_product_legacy_v1(integer, bigint, text)
  from public, anon, authenticated, service_role;

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
  v_base jsonb;
  v_without_hash jsonb;
  v_portal_text text;
  v_portal_status text;
  v_hash text;
begin
  perform public.rpc_eaushadhi_require_permission(true);

  select
    pr.selected_diseases_conditions_portal_text,
    pr.diseases_conditions_portal_review_status
  into v_portal_text, v_portal_status
  from regulatory.eaushadhi_product_review pr
  where pr.product_id = p_product_id;

  if v_portal_status is distinct from 'VERIFIED'
     or nullif(btrim(v_portal_text), '') is null then
    raise exception using errcode = '55000',
      message = 'Verified e-Aushadhi-compatible Diseases and Conditions text is required before worker execution';
  end if;

  v_base := public.rpc_eaushadhi_worker_payload_get_legacy_v1(
    p_product_id,
    p_expected_workflow_row_version
  );

  v_without_hash := v_base - 'payload_hash';
  v_without_hash := jsonb_set(
    v_without_hash,
    '{details,diseases_conditions}',
    to_jsonb(v_portal_text),
    true
  );

  v_hash := encode(
    digest(convert_to(v_without_hash::text, 'UTF8'), 'sha256'),
    'hex'
  );

  return v_without_hash || jsonb_build_object('payload_hash', v_hash);
end;
$function$;

create or replace function public.rpc_eaushadhi_verify_product(
  p_product_id integer,
  p_expected_row_version bigint,
  p_notes text default null
)
returns table(product_id integer, review_status text, row_version bigint, verified_at timestamptz)
language plpgsql
security definer
set search_path to 'public', 'regulatory', 'pg_temp'
as $function$
declare
  v_status text;
  v_selected text;
begin
  perform public.rpc_eaushadhi_require_permission(true);

  select
    pr.diseases_conditions_portal_review_status,
    pr.selected_diseases_conditions_portal_text
  into v_status, v_selected
  from regulatory.eaushadhi_product_review pr
  where pr.product_id = p_product_id;

  if v_status is distinct from 'VERIFIED'
     or nullif(btrim(v_selected), '') is null then
    raise exception using errcode = '55000',
      message = 'e-Aushadhi-compatible Diseases and Conditions must be VERIFIED before product verification';
  end if;

  return query
  select *
  from public.rpc_eaushadhi_verify_product_legacy_v1(
    p_product_id,
    p_expected_row_version,
    p_notes
  );
end;
$function$;

create or replace function public.rpc_eaushadhi_product_portal_text_get(p_product_id integer)
returns table(
  product_id integer,
  canonical_text text,
  suggested_portal_text text,
  selected_portal_text text,
  generation_version text,
  portal_review_status text,
  portal_review_notes text,
  row_version bigint,
  reviewed_by uuid,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'regulatory', 'auth', 'pg_temp'
as $function$
begin
  perform public.rpc_eaushadhi_require_permission(false);

  return query
  select
    pr.product_id,
    pr.selected_diseases_conditions_text,
    pr.suggested_diseases_conditions_portal_text,
    pr.selected_diseases_conditions_portal_text,
    pr.diseases_conditions_portal_generation_version,
    pr.diseases_conditions_portal_review_status,
    pr.diseases_conditions_portal_review_notes,
    pr.row_version,
    pr.diseases_conditions_portal_reviewed_by,
    pr.diseases_conditions_portal_reviewed_at
  from regulatory.eaushadhi_product_review pr
  where pr.product_id = p_product_id;
end;
$function$;

create or replace function public.rpc_eaushadhi_product_portal_text_save(
  p_product_id integer,
  p_expected_row_version bigint,
  p_portal_text text,
  p_verify boolean default false,
  p_reason text default null
)
returns regulatory.eaushadhi_product_review
language plpgsql
security definer
set search_path to 'public', 'regulatory', 'auth', 'pg_temp'
as $function$
declare
  v_user uuid;
  v_row regulatory.eaushadhi_product_review%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_text text;
  v_active_run_count integer;
  v_old_selected text;
  v_old_status text;
  v_old_notes text;
begin
  v_user := public.rpc_eaushadhi_require_permission(true);
  v_text := nullif(btrim(p_portal_text), '');

  select * into v_row
  from regulatory.eaushadhi_product_review
  where product_id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Product review row not found';
  end if;

  if v_row.row_version is distinct from p_expected_row_version then
    raise exception using errcode = '40001',
      message = format(
        'Product review row changed; expected version %s, current version %s',
        p_expected_row_version,
        v_row.row_version
      );
  end if;

  if nullif(btrim(v_row.selected_diseases_conditions_text), '') is null then
    raise exception using errcode = '22023',
      message = 'Canonical Diseases and Conditions text is required before portal projection review';
  end if;

  if v_text is null then
    raise exception using errcode = '22023',
      message = 'Portal-compatible Diseases and Conditions text is required';
  end if;

  if v_text !~ '^[A-Za-z0-9 ,;:/@.''-]+$' then
    raise exception using errcode = '22023',
      message = 'Portal-compatible Diseases and Conditions contains unsupported characters';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow
  where product_id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Product workflow row not found';
  end if;

  if v_workflow.entry_status in ('ENTERED', 'PORTAL_VERIFIED', 'SUBMITTED') then
    raise exception using errcode = '55000',
      message = 'Portal-compatible Diseases and Conditions cannot be changed after portal entry has been proven';
  end if;

  if v_workflow.entry_status = 'IN_PROGRESS' then
    if nullif(btrim(p_reason), '') is null then
      raise exception using errcode = '22023',
        message = 'Reason is required to review portal text after portal entry has started';
    end if;

    if v_workflow.portal_product_ref is not null or v_workflow.entered_at is not null then
      raise exception using errcode = '55000',
        message = 'In-progress portal text correction is blocked because portal entry may already be proven';
    end if;

    select count(*)::integer into v_active_run_count
    from regulatory.eaushadhi_worker_run wr
    where wr.product_id = p_product_id and wr.run_status = 'RUNNING';

    if v_active_run_count <> 1 then
      raise exception using errcode = '55000',
        message = 'In-progress portal text correction requires exactly one RUNNING worker run';
    end if;
  end if;

  v_old_selected := v_row.selected_diseases_conditions_portal_text;
  v_old_status := v_row.diseases_conditions_portal_review_status;
  v_old_notes := v_row.diseases_conditions_portal_review_notes;

  update regulatory.eaushadhi_product_review
  set selected_diseases_conditions_portal_text = v_text,
      diseases_conditions_portal_review_status =
        case when p_verify then 'VERIFIED' else 'REVIEW_REQUIRED' end,
      diseases_conditions_portal_review_notes = nullif(btrim(p_reason), ''),
      diseases_conditions_portal_reviewed_by =
        case when p_verify then v_user else null end,
      diseases_conditions_portal_reviewed_at =
        case when p_verify then now() else null end,
      row_version = row_version + 1,
      updated_at = now(),
      updated_by = v_user
  where product_id = p_product_id
  returning * into v_row;

  insert into regulatory.audit_event(
    entity_schema, entity_table, entity_key, action,
    old_data, new_data, actor_user_id, application_name, occurred_at
  )
  values(
    'regulatory',
    'eaushadhi_product_review',
    p_product_id::text,
    case when p_verify then 'VERIFY_PORTAL_DISEASES_TEXT' else 'SAVE_PORTAL_DISEASES_TEXT' end,
    jsonb_build_object(
      'selected_portal_text', v_old_selected,
      'portal_review_status', v_old_status,
      'portal_review_notes', v_old_notes
    ),
    jsonb_build_object(
      'canonical_text', v_row.selected_diseases_conditions_text,
      'suggested_portal_text', v_row.suggested_diseases_conditions_portal_text,
      'selected_portal_text', v_row.selected_diseases_conditions_portal_text,
      'generation_version', v_row.diseases_conditions_portal_generation_version,
      'portal_review_status', v_row.diseases_conditions_portal_review_status,
      'reason', nullif(btrim(p_reason), '')
    ),
    v_user,
    'e-aushadhi-automation',
    now()
  );

  return v_row;
end;
$function$;

create or replace function public.rpc_eaushadhi_worker_mark_save_ambiguous(
  p_run_id uuid,
  p_expected_workflow_row_version bigint,
  p_expected_content_hash text,
  p_save_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'regulatory', 'auth', 'pg_temp'
as $function$
declare
  v_actor uuid;
  v_run regulatory.eaushadhi_worker_run%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_now timestamptz := now();
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);

  select * into v_run
  from regulatory.eaushadhi_worker_run
  where run_id = p_run_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Worker run not found'; end if;
  if v_run.product_id <> 262 then
    raise exception using errcode = '42501',
      message = 'SAVE_AMBIGUOUS marker is restricted to Product 262 during the controlled pilot';
  end if;
  if v_run.run_status <> 'RUNNING' or v_run.portal_product_ref is not null or v_run.entered_at is not null then
    raise exception using errcode = '55000',
      message = 'Only an unentered RUNNING worker run can be marked SAVE_AMBIGUOUS';
  end if;
  if p_expected_content_hash is distinct from v_run.start_content_hash then
    raise exception using errcode = '40001',
      message = 'SAVE_AMBIGUOUS marker content hash does not match run authority';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow
  where product_id = v_run.product_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Workflow row not found'; end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then
    raise exception using errcode = '40001', message = 'Stale workflow row version';
  end if;
  if v_workflow.entry_status <> 'IN_PROGRESS'
     or v_workflow.portal_product_ref is not null
     or v_workflow.entered_at is not null then
    raise exception using errcode = '55000',
      message = 'Workflow is not eligible for SAVE_AMBIGUOUS marking';
  end if;

  update regulatory.eaushadhi_worker_run
  set last_save_outcome = 'AMBIGUOUS',
      last_save_observed_at = v_now,
      last_save_evidence = coalesce(p_save_evidence, '{}'::jsonb),
      updated_at = v_now
  where run_id = p_run_id;

  insert into regulatory.audit_event(
    entity_schema, entity_table, entity_key, action,
    old_data, new_data, actor_user_id, application_name, occurred_at
  )
  values(
    'regulatory', 'eaushadhi_worker_run', p_run_id::text, 'UPDATE',
    jsonb_build_object(
      'event_kind', 'SAVE_AMBIGUOUS_MARKER',
      'last_save_outcome', v_run.last_save_outcome,
      'last_save_observed_at', v_run.last_save_observed_at
    ),
    jsonb_build_object(
      'event_kind', 'SAVE_AMBIGUOUS_MARKER',
      'last_save_outcome', 'AMBIGUOUS',
      'last_save_observed_at', v_now,
      'save_evidence', coalesce(p_save_evidence, '{}'::jsonb)
    ),
    v_actor, 'e-aushadhi-automation', v_now
  );

  return jsonb_build_object(
    'run_id', p_run_id,
    'product_id', v_run.product_id,
    'run_status', 'RUNNING',
    'entry_status', 'IN_PROGRESS',
    'workflow_row_version', v_workflow.row_version,
    'content_hash', v_run.start_content_hash,
    'last_save_outcome', 'AMBIGUOUS',
    'last_save_observed_at', v_now
  );
end;
$function$;

create or replace function public.rpc_eaushadhi_worker_run_rebase_portal_projection(
  p_run_id uuid,
  p_expected_workflow_row_version bigint,
  p_reconciliation_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'regulatory', 'extensions', 'pg_temp'
as $function$
declare
  v_actor uuid;
  v_run regulatory.eaushadhi_worker_run%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_review regulatory.eaushadhi_product_review%rowtype;
  v_current_payload jsonb;
  v_legacy_payload jsonb;
  v_current_content_hash text;
  v_legacy_content_hash text;
  v_duplicate_outcome text;
  v_coverage_complete boolean;
  v_source text;
  v_now timestamptz := now();
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);

  if jsonb_typeof(p_reconciliation_evidence) <> 'object' then
    raise exception using errcode = '22023', message = 'Reconciliation evidence object is required';
  end if;

  v_duplicate_outcome := upper(coalesce(p_reconciliation_evidence->>'duplicate_outcome', ''));
  v_coverage_complete := coalesce((p_reconciliation_evidence->>'coverage_complete')::boolean, false);
  v_source := coalesce(p_reconciliation_evidence->>'source', '');

  if v_duplicate_outcome <> 'NONE'
     or v_coverage_complete is not true
     or v_source <> 'LoadProductDataforLegacy' then
    raise exception using errcode = '22023',
      message = 'Rebase requires coverage-complete duplicate NONE evidence';
  end if;

  select * into v_run
  from regulatory.eaushadhi_worker_run
  where run_id = p_run_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Worker run not found'; end if;
  if v_run.product_id <> 262 then
    raise exception using errcode = '42501',
      message = 'Portal-projection authority rebase is restricted to Product 262 during the controlled pilot';
  end if;
  if v_run.run_status <> 'RUNNING'
     or v_run.portal_product_ref is not null
     or v_run.entered_at is not null then
    raise exception using errcode = '55000',
      message = 'Only an unentered RUNNING worker run can be rebased';
  end if;
  if v_run.last_save_outcome is distinct from 'AMBIGUOUS'
     or v_run.last_save_observed_at is null then
    raise exception using errcode = '55000',
      message = 'Authority rebase requires server-recorded SAVE_AMBIGUOUS on the same run';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow
  where product_id = v_run.product_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Workflow row not found'; end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then
    raise exception using errcode = '40001', message = 'Stale workflow row version';
  end if;
  if v_workflow.entry_status <> 'IN_PROGRESS'
     or v_workflow.portal_product_ref is not null
     or v_workflow.entered_at is not null then
    raise exception using errcode = '55000',
      message = 'Workflow is not eligible for same-run authority rebase';
  end if;

  select * into v_review
  from regulatory.eaushadhi_product_review
  where product_id = v_run.product_id;
  if v_review.diseases_conditions_portal_review_status <> 'VERIFIED'
     or nullif(btrim(v_review.selected_diseases_conditions_portal_text), '') is null then
    raise exception using errcode = '55000',
      message = 'Portal Diseases and Conditions projection must be VERIFIED before rebase';
  end if;

  v_current_payload := public.rpc_eaushadhi_worker_payload_get(v_run.product_id, v_workflow.row_version);
  v_current_content_hash := regulatory.eaushadhi_worker_content_hash(v_current_payload);

  v_legacy_payload := jsonb_set(
    v_current_payload,
    '{details,diseases_conditions}',
    to_jsonb(v_review.selected_diseases_conditions_text),
    true
  );
  v_legacy_content_hash := regulatory.eaushadhi_worker_content_hash(v_legacy_payload);

  if v_legacy_content_hash is distinct from v_run.start_content_hash then
    raise exception using errcode = '55000',
      message = 'Authority rebase rejected: prior run hash is not explained solely by the Diseases and Conditions portal projection';
  end if;

  update regulatory.eaushadhi_worker_run
  set start_content_hash = v_current_content_hash,
      start_payload_hash = v_current_payload->>'payload_hash',
      start_context = coalesce(start_context, '{}'::jsonb) || jsonb_build_object(
        'authority_rebase',
        jsonb_build_object(
          'kind', 'DISEASES_CONDITIONS_PORTAL_PROJECTION',
          'previous_content_hash', v_run.start_content_hash,
          'new_content_hash', v_current_content_hash,
          'generation_version', v_review.diseases_conditions_portal_generation_version,
          'save_ambiguous_observed_at', v_run.last_save_observed_at,
          'reconciliation_evidence', p_reconciliation_evidence,
          'rebased_by', v_actor,
          'rebased_at', v_now
        )
      ),
      updated_at = v_now
  where run_id = p_run_id;

  insert into regulatory.audit_event(
    entity_schema, entity_table, entity_key, action,
    old_data, new_data, actor_user_id, application_name, occurred_at
  )
  values(
    'regulatory', 'eaushadhi_worker_run', p_run_id::text, 'UPDATE',
    jsonb_build_object(
      'event_kind', 'REBASE_PORTAL_DISEASES_AUTHORITY',
      'start_content_hash', v_run.start_content_hash,
      'last_save_outcome', v_run.last_save_outcome,
      'last_save_observed_at', v_run.last_save_observed_at
    ),
    jsonb_build_object(
      'event_kind', 'REBASE_PORTAL_DISEASES_AUTHORITY',
      'start_content_hash', v_current_content_hash,
      'product_id', v_run.product_id,
      'reconciliation_evidence', p_reconciliation_evidence
    ),
    v_actor, 'e-aushadhi-automation', v_now
  );

  return jsonb_build_object(
    'run_id', p_run_id,
    'product_id', v_run.product_id,
    'run_status', 'RUNNING',
    'entry_status', 'IN_PROGRESS',
    'workflow_row_version', v_workflow.row_version,
    'previous_content_hash', v_run.start_content_hash,
    'content_hash', v_current_content_hash,
    'payload_hash', v_current_payload->>'payload_hash',
    'last_save_outcome', v_run.last_save_outcome,
    'rebased', true
  );
end;
$function$;

grant execute on function public.rpc_eaushadhi_worker_payload_get(integer, bigint)
  to authenticated, service_role;
grant execute on function public.rpc_eaushadhi_verify_product(integer, bigint, text)
  to authenticated, service_role;
grant execute on function public.rpc_eaushadhi_product_portal_text_get(integer)
  to authenticated, service_role;
grant execute on function public.rpc_eaushadhi_product_portal_text_save(integer, bigint, text, boolean, text)
  to authenticated, service_role;
grant execute on function public.rpc_eaushadhi_worker_mark_save_ambiguous(uuid, bigint, text, jsonb)
  to authenticated, service_role;
grant execute on function public.rpc_eaushadhi_worker_run_rebase_portal_projection(uuid, bigint, jsonb)
  to authenticated, service_role;

revoke all on function public.rpc_eaushadhi_worker_payload_get_legacy_v1(integer, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.rpc_eaushadhi_verify_product_legacy_v1(integer, bigint, text)
  from public, anon, authenticated, service_role;

commit;
