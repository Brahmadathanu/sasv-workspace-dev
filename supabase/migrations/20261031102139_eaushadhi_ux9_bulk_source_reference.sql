-- =====================================================================================================
-- CANDIDATE - NOT APPLIED.  WP-07 UX-9: bulk "Set source reference" (governed working-source correction)
-- Prepared 31 Oct 2026 IST by Jarvis. Needs owner approval. Live apply assigns its own migration version.
-- Run as ONE transaction (apply_migration does this). Nothing here changes an existing function body.
--
-- Modelled on live public.rpc_eaushadhi_correct_working_source_line (md5 e6951e2c27a6dd5dea9a13e0bec64202,
-- read 31 Oct 2026 IST): SECURITY DEFINER, search_path 'public','regulatory','pg_temp', starts with
-- public.rpc_eaushadhi_require_permission(true), locks source line then line review FOR UPDATE, refuses
-- VERIFIED lines and products with an APPROVED formulation_version (55000), sets the line review back to
-- PENDING, clears reviewed_by/reviewed_at, row_version+1, appends the reason to review_notes, updated_by=caller.
-- History: row audit trigger source_composition_line_audit / eaushadhi_line_review_audit (regulatory.trg_audit_row)
-- plus one request row per call in the new table (also audited). Saver is cleared by the existing UX-4 saver
-- trigger (rule R3: NEW status PENDING).
--
-- Owner-locked rules (30-31 Oct 2026):
--   * explicit line ids, each with expected current wording and expected line-review row_version
--   * request id idempotency: same actor + identical payload -> stored result; anything else -> refused
--   * 1..200 lines per call, all-or-nothing (no partial apply)
--   * VERIFIER (or APPROVER) role fills BLANK lines; APPROVER needed to replace a different wording and
--     to introduce a wording that is not already among the known wordings
--   * reason required; refuse VERIFIED lines, products whose portal entry has started, products with an
--     APPROVED formulation; same-wording lines are UNCHANGED (not written)
--   * never saves for review, approves, verifies, or touches portal / worker / composition-stage state
--   * a blank target (clearing a wording) is refused until the owner confirms the portal accepts blank
-- =====================================================================================================

-- 0. Preflight: dependencies are exactly as read on 31 Oct 2026 IST; new objects do not exist.
do $pre$
declare r record;
begin
  for r in select * from (values
      ('public.rpc_eaushadhi_correct_working_source_line(bigint,text,text,text,text,numeric,text,text)', 'e6951e2c27a6dd5dea9a13e0bec64202'),
      ('public.rpc_eaushadhi_require_permission(boolean)', 'daa4d6c1f4a29de2685febe93103b3c4'),
      ('regulatory.eaushadhi_has_role_v1(uuid,text)', '25284d0fadc4b6b8eb1b830b1b1d1b2b')
    ) v(sig, md5) loop
    if md5(pg_get_functiondef(r.sig::regprocedure)) is distinct from r.md5 then
      raise exception 'UX9_PREFLIGHT_FAILED: % changed since fingerprint', r.sig; end if;
  end loop;
  if to_regclass('regulatory.source_reference_bulk_request') is not null then raise exception 'UX9_ALREADY_APPLIED'; end if;
  if to_regprocedure('public.rpc_eaushadhi_set_source_reference_bulk_v1(integer,uuid,text,boolean,text,jsonb)') is not null
    then raise exception 'UX9_ALREADY_APPLIED'; end if;
end $pre$;

-- 1. Request log: idempotency + one audit record per bulk action. No client access (RLS on, no policies, no grants).
create table regulatory.source_reference_bulk_request (
  request_id      uuid primary key,
  product_id      integer not null references regulatory.eaushadhi_product_workflow(product_id) on delete restrict,
  actor_user_id   uuid not null references auth.users(id),
  payload_md5     text not null,
  target_reference_text text not null,
  is_new_wording  boolean not null,
  reason          text not null check (length(btrim(reason)) between 10 and 500),
  line_count      integer not null check (line_count between 1 and 200),
  applied_count   integer not null,
  unchanged_count integer not null,
  result          jsonb not null,
  created_at      timestamptz not null default now()
);
alter table regulatory.source_reference_bulk_request enable row level security;
revoke all on regulatory.source_reference_bulk_request from public, anon, authenticated;
create trigger source_reference_bulk_request_audit after insert or delete or update on regulatory.source_reference_bulk_request
  for each row execute function regulatory.trg_audit_row();
comment on table regulatory.source_reference_bulk_request is
  'WP-07 UX-9. One row per successful rpc_eaushadhi_set_source_reference_bulk_v1 call (idempotency key + stored result). Written only by that RPC.';

-- 2. The write RPC.
-- p_lines: [{"source_composition_line_id": 931, "expected_raw_reference_text": null, "expected_row_version": 7,
--            "confirm_replace_different": false}, ...]
-- Refusals: see UX9_CLIENT_CONTRACT.md. Message = stable code; hint = human sentence; detail = affected line ids.
create function public.rpc_eaushadhi_set_source_reference_bulk_v1(
  p_product_id        integer,
  p_request_id        uuid,
  p_reference_text    text,
  p_allow_new_wording boolean,
  p_reason            text,
  p_lines             jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'regulatory', 'pg_temp'
as $function$
declare
  v_user uuid;
  v_is_verifier boolean;
  v_is_approver boolean;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_target text;
  v_target_key text;
  v_known_text text;
  v_is_new boolean := false;
  v_payload_md5 text;
  v_prev regulatory.source_reference_bulk_request%rowtype;
  v_entry_status text;
  v_count integer;
  v_bad bigint[];
  v_need_approver_replace boolean;
  v_applied integer := 0;
  v_unchanged integer := 0;
  v_out jsonb := '[]'::jsonb;
  v_result jsonb;
  r record;
begin
  v_user := public.rpc_eaushadhi_require_permission(true);
  v_is_approver := regulatory.eaushadhi_has_role_v1(v_user, 'APPROVER');
  v_is_verifier := v_is_approver or regulatory.eaushadhi_has_role_v1(v_user, 'VERIFIER');
  if not v_is_verifier then
    raise exception using errcode='42501', message='VERIFIER_ROLE_REQUIRED',
      hint='Setting a source reference needs the Verifier or Approver role.';
  end if;

  if p_request_id is null then
    raise exception using errcode='22023', message='REQUEST_ID_REQUIRED', hint='A request id is required.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception using errcode='22023', message='INVALID_PAYLOAD', hint='p_lines must be a JSON array.';
  end if;

  -- Canonical target wording: trim, collapse internal whitespace (same key as regulatory.normalize_controlled_term_alias).
  v_target := nullif(regexp_replace(btrim(coalesce(p_reference_text, '')), '[[:space:]]+', ' ', 'g'), '');

  -- Payload fingerprint for idempotency (line order does not matter).
  v_payload_md5 := md5(jsonb_build_object(
      'product_id', p_product_id, 'reference_text', v_target, 'allow_new', coalesce(p_allow_new_wording, false),
      'reason', v_reason,
      'lines', coalesce((select jsonb_agg(e order by (e->>'source_composition_line_id')) from jsonb_array_elements(p_lines) e), '[]'::jsonb)
    )::text);

  -- Idempotent replay is checked before anything else can refuse (after apply, the expectations are stale by design).
  select * into v_prev from regulatory.source_reference_bulk_request q where q.request_id = p_request_id;
  if found then
    if v_prev.actor_user_id = v_user and v_prev.payload_md5 = v_payload_md5 then
      return v_prev.result || jsonb_build_object('replayed', true);
    end if;
    raise exception using errcode='22023', message='REQUEST_ID_REUSE_MISMATCH',
      hint='This request id was already used for a different change. Refresh the preview and try again.';
  end if;

  if length(v_reason) < 10 or length(v_reason) > 500 then
    raise exception using errcode='22023', message='REASON_REQUIRED', hint='Give a reason of 10 to 500 characters.';
  end if;
  if v_target is null then
    raise exception using errcode='22023', message='BLANK_REFERENCE_NOT_ALLOWED',
      hint='Clearing a source reference is not allowed. Choose a wording.';
  end if;
  if length(v_target) > 300 then
    raise exception using errcode='22023', message='WORDING_TOO_LONG', hint='The wording must be at most 300 characters.';
  end if;

  v_count := jsonb_array_length(p_lines);
  if v_count < 1 or v_count > 200 then
    raise exception using errcode='22023', message='LINE_COUNT_INVALID', hint='Choose between 1 and 200 lines.';
  end if;

  -- Shape check of every line item.
  if exists (select 1 from jsonb_array_elements(p_lines) e
             where jsonb_typeof(e) <> 'object'
                or jsonb_typeof(e->'source_composition_line_id') is distinct from 'number'
                or jsonb_typeof(e->'expected_row_version') is distinct from 'number'
                or coalesce(jsonb_typeof(e->'expected_raw_reference_text'), 'null') not in ('string','null')
                or coalesce(jsonb_typeof(e->'confirm_replace_different'), 'boolean') <> 'boolean') then
    raise exception using errcode='22023', message='INVALID_PAYLOAD',
      hint='Each line needs source_composition_line_id, expected_row_version and expected_raw_reference_text.';
  end if;
  if (select count(distinct (e->>'source_composition_line_id')::bigint) from jsonb_array_elements(p_lines) e) <> v_count then
    raise exception using errcode='22023', message='DUPLICATE_LINE', hint='A line appears more than once.';
  end if;

  -- Known wording = any wording already present on a source line (the list the client shows), same normalised key.
  v_target_key := regulatory.normalize_controlled_term_alias(v_target);
  select k.raw_reference_text into v_known_text
  from (select scl.raw_reference_text, count(*) n
        from regulatory.source_composition_line scl
        where nullif(btrim(scl.raw_reference_text), '') is not null
          and regulatory.normalize_controlled_term_alias(scl.raw_reference_text) = v_target_key
        group by scl.raw_reference_text order by count(*) desc, scl.raw_reference_text limit 1) k;
  if v_known_text is not null then
    v_target := btrim(v_known_text);          -- reuse the existing spelling, so no near-duplicate wording appears
  else
    v_is_new := true;
    if not coalesce(p_allow_new_wording, false) then
      raise exception using errcode='22023', message='WORDING_NOT_KNOWN',
        hint='This wording is not among the known wordings. Tick "Enter a new wording" to add it (Approver only).';
    end if;
    if not v_is_approver then
      raise exception using errcode='42501', message='APPROVER_ROLE_REQUIRED',
        hint='Only an Approver can introduce a new reference wording.', detail='NEW_WORDING';
    end if;
  end if;

  -- Product-level freezes (same as the single-line correction, plus portal entry).
  select w.entry_status into v_entry_status from regulatory.eaushadhi_product_workflow w where w.product_id = p_product_id;
  if not found then
    raise exception using errcode='P0002', message='PRODUCT_NOT_FOUND', hint='No e-Aushadhi workflow exists for this product.';
  end if;
  if v_entry_status is distinct from 'NOT_STARTED' then
    raise exception using errcode='55000', message='PORTAL_ENTRY_STARTED',
      hint='Source references cannot be changed after portal entry has started for this product.';
  end if;
  if exists (select 1 from regulatory.formulation_version fv where fv.product_id = p_product_id and fv.status = 'APPROVED') then
    raise exception using errcode='55000', message='FORMULATION_APPROVED',
      hint='Working source cannot be corrected after an approved formulation exists.';
  end if;

  -- Lock order as the sibling RPC: source lines (id order), then their line reviews (id order).
  perform 1 from regulatory.source_composition_line scl
  where scl.id in (select (e->>'source_composition_line_id')::bigint from jsonb_array_elements(p_lines) e)
  order by scl.id for update;
  perform 1 from regulatory.eaushadhi_line_review er
  where er.source_composition_line_id in (select (e->>'source_composition_line_id')::bigint from jsonb_array_elements(p_lines) e)
  order by er.source_composition_line_id for update;

  create temporary table if not exists pg_temp.ux9_lines (
    line_id bigint primary key, exp_text text, exp_rv bigint, confirm boolean,
    found_product integer, cur_text text, review_status text, cur_rv bigint, kind text
  ) on commit drop;
  truncate pg_temp.ux9_lines;
  insert into pg_temp.ux9_lines(line_id, exp_text, exp_rv, confirm, found_product, cur_text, review_status, cur_rv)
  select (e->>'source_composition_line_id')::bigint,
         nullif(btrim(e->>'expected_raw_reference_text'), ''),
         (e->>'expected_row_version')::bigint,
         coalesce((e->>'confirm_replace_different')::boolean, false),
         scl.matched_product_id, nullif(btrim(scl.raw_reference_text), ''), er.review_status, er.row_version
  from jsonb_array_elements(p_lines) e
  left join regulatory.source_composition_line scl on scl.id = (e->>'source_composition_line_id')::bigint
  left join regulatory.eaushadhi_line_review er on er.source_composition_line_id = scl.id;

  select array_agg(line_id order by line_id) into v_bad from pg_temp.ux9_lines
  where found_product is distinct from p_product_id or review_status is null;
  if v_bad is not null then
    raise exception using errcode='22023', message='LINE_NOT_IN_PRODUCT',
      hint='One or more lines do not belong to this product.', detail=array_to_string(v_bad, ',');
  end if;

  select array_agg(line_id order by line_id) into v_bad from pg_temp.ux9_lines
  where cur_text is distinct from exp_text or cur_rv is distinct from exp_rv;
  if v_bad is not null then
    raise exception using errcode='40001', message='SOURCE_CHANGED_SINCE_PREVIEW',
      hint='Some lines changed after the preview was built. Refresh the preview.', detail=array_to_string(v_bad, ',');
  end if;

  select array_agg(line_id order by line_id) into v_bad from pg_temp.ux9_lines where review_status = 'VERIFIED';
  if v_bad is not null then
    raise exception using errcode='55000', message='LINE_VERIFIED',
      hint='Working source cannot be corrected after the ingredient line is VERIFIED.', detail=array_to_string(v_bad, ',');
  end if;

  update pg_temp.ux9_lines set kind = case
      when cur_text is not distinct from v_target then 'UNCHANGED'
      when cur_text is null then 'FILL_BLANK'
      when regulatory.normalize_controlled_term_alias(cur_text) = v_target_key then 'RESPELL'   -- same key, spelling tidied
      else 'REPLACE_DIFFERENT' end;

  select array_agg(line_id order by line_id) into v_bad from pg_temp.ux9_lines where kind = 'REPLACE_DIFFERENT' and not confirm;
  if v_bad is not null then
    raise exception using errcode='22023', message='DIFFERENT_REFERENCE_NOT_CONFIRMED',
      hint='Some lines hold a different wording and were not explicitly ticked for replacement.', detail=array_to_string(v_bad, ',');
  end if;
  v_need_approver_replace := exists (select 1 from pg_temp.ux9_lines where kind = 'REPLACE_DIFFERENT');
  if v_need_approver_replace and not v_is_approver then
    raise exception using errcode='42501', message='APPROVER_ROLE_REQUIRED',
      hint='Only an Approver can replace a different existing wording.', detail='REPLACE_DIFFERENT';
  end if;

  -- Writes (only changed lines). Audit trigger records old/new on both tables.
  update regulatory.source_composition_line scl
  set raw_reference_text = v_target
  from pg_temp.ux9_lines t
  where t.line_id = scl.id and t.kind <> 'UNCHANGED';

  update regulatory.eaushadhi_line_review er
  set review_status = 'PENDING',
      review_notes = concat_ws(E'\n', nullif(er.review_notes, ''), 'Source reference set: ' || v_reason),
      reviewed_by = null,
      reviewed_at = null,
      row_version = er.row_version + 1,
      updated_at = now(),
      updated_by = v_user
  from pg_temp.ux9_lines t
  where t.line_id = er.source_composition_line_id and t.kind <> 'UNCHANGED';

  select count(*) filter (where kind <> 'UNCHANGED'), count(*) filter (where kind = 'UNCHANGED')
    into v_applied, v_unchanged from pg_temp.ux9_lines;

  select coalesce(jsonb_agg(jsonb_build_object(
           'source_composition_line_id', t.line_id,
           'outcome', case when t.kind = 'UNCHANGED' then 'UNCHANGED' else 'UPDATED' end,
           'change_kind', t.kind,
           'old_raw_reference_text', t.cur_text,
           'raw_reference_text', scl.raw_reference_text,
           'review_status', er.review_status,
           'row_version', er.row_version) order by t.line_id), '[]'::jsonb)
    into v_out
  from pg_temp.ux9_lines t
  join regulatory.source_composition_line scl on scl.id = t.line_id
  join regulatory.eaushadhi_line_review er on er.source_composition_line_id = t.line_id;

  v_result := jsonb_build_object(
    'request_id', p_request_id, 'product_id', p_product_id,
    'raw_reference_text', v_target, 'is_new_wording', v_is_new,
    'approver_used', (v_is_new or v_need_approver_replace),
    'applied_count', v_applied, 'unchanged_count', v_unchanged,
    'lines', v_out, 'replayed', false);

  insert into regulatory.source_reference_bulk_request(request_id, product_id, actor_user_id, payload_md5,
      target_reference_text, is_new_wording, reason, line_count, applied_count, unchanged_count, result)
  values (p_request_id, p_product_id, v_user, v_payload_md5, v_target, v_is_new, v_reason, v_count, v_applied, v_unchanged, v_result);

  drop table if exists pg_temp.ux9_lines;
  return v_result;
end;
$function$;

revoke all on function public.rpc_eaushadhi_set_source_reference_bulk_v1(integer,uuid,text,boolean,text,jsonb) from public, anon;
grant execute on function public.rpc_eaushadhi_set_source_reference_bulk_v1(integer,uuid,text,boolean,text,jsonb) to authenticated, service_role;
comment on function public.rpc_eaushadhi_set_source_reference_bulk_v1(integer,uuid,text,boolean,text,jsonb) is
  'WP-07 UX-9. Governed bulk correction of raw_reference_text on explicit lines of one product. All-or-nothing; idempotent by request id. Never saves for review, approves, verifies or touches portal state.';

-- 3. Read-only companion for the preview dialog.
create function public.rpc_eaushadhi_source_reference_preview_v1(p_product_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'regulatory', 'pg_temp'
as $function$
declare
  v_user uuid;
  v_entry text;
  v_product_lock text;
begin
  v_user := public.rpc_eaushadhi_require_permission(false);
  select w.entry_status into v_entry from regulatory.eaushadhi_product_workflow w where w.product_id = p_product_id;
  if not found then
    raise exception using errcode='P0002', message='PRODUCT_NOT_FOUND', hint='No e-Aushadhi workflow exists for this product.';
  end if;
  v_product_lock := case
    when v_entry is distinct from 'NOT_STARTED' then 'PORTAL_ENTRY_STARTED'
    when exists (select 1 from regulatory.formulation_version fv where fv.product_id = p_product_id and fv.status = 'APPROVED')
      then 'FORMULATION_APPROVED'
    else null end;

  return jsonb_build_object(
    'product_id', p_product_id,
    'caller', jsonb_build_object(
        'is_verifier', regulatory.eaushadhi_has_role_v1(v_user,'VERIFIER') or regulatory.eaushadhi_has_role_v1(v_user,'APPROVER'),
        'is_approver', regulatory.eaushadhi_has_role_v1(v_user,'APPROVER')),
    'product_lock_reason', v_product_lock,
    'max_lines', 200,
    'known_wordings', coalesce((
        select jsonb_agg(jsonb_build_object('raw_reference_text', k.txt, 'line_count', k.n, 'product_line_count', k.pn)
                         order by k.n desc, k.txt)
        from (select btrim(scl.raw_reference_text) txt, count(*) n,
                     count(*) filter (where scl.matched_product_id = p_product_id) pn
              from regulatory.source_composition_line scl
              where nullif(btrim(scl.raw_reference_text), '') is not null
              group by btrim(scl.raw_reference_text)) k), '[]'::jsonb),
    'lines', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'source_composition_line_id', scl.id,
                 'source_row_no', scl.source_row_no,
                 'raw_ingredient_name', scl.raw_ingredient_name,
                 'raw_reference_text', nullif(btrim(scl.raw_reference_text), ''),
                 'row_version', er.row_version,
                 'review_status', er.review_status,
                 'lock_reason', coalesce(v_product_lock, case when er.review_status = 'VERIFIED' then 'LINE_VERIFIED' end))
               order by scl.source_row_no nulls last, scl.id)
        from regulatory.source_composition_line scl
        join regulatory.eaushadhi_line_review er on er.source_composition_line_id = scl.id
        where scl.matched_product_id = p_product_id), '[]'::jsonb));
end;
$function$;

revoke all on function public.rpc_eaushadhi_source_reference_preview_v1(integer) from public, anon;
grant execute on function public.rpc_eaushadhi_source_reference_preview_v1(integer) to authenticated, service_role;
comment on function public.rpc_eaushadhi_source_reference_preview_v1(integer) is
  'WP-07 UX-9. Read-only preview data: known wordings with counts, product lines with current wording, row_version and lock reason, caller roles.';

-- 4. Undo (only if the owner asks; see UX9_OWNER_APPROVAL_SHEET.md):
--   drop function public.rpc_eaushadhi_source_reference_preview_v1(integer);
--   drop function public.rpc_eaushadhi_set_source_reference_bulk_v1(integer,uuid,text,boolean,text,jsonb);
--   (archive rows first) drop table regulatory.source_reference_bulk_request;
--   Data written by the RPC is reversed by calling it again with the old wordings (new request id), which keeps the audit trail.
