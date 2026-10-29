-- WP-07 PKG3a: per-product portal-entry gate and Approver check before the Product Details portal Save.
-- DRAFT 2026-10-29 IST. NOT APPLIED. Drafted version 20261029192000 (live apply assigns its own version).
-- Scope: Product Details portal entry path only (7 worker functions). Composition (6 functions) is PKG3b, design only.
-- QC (3 functions) stays Product 262 only. Final portal Submit is not touched and stays excluded (no function marks SUBMITTED).
-- Default state after apply: only Product 262 enabled. 262 is already PORTAL_VERIFIED, so no product can start a new
-- portal run until the owner enables one. Behaviour change for everyone else: none until a product is enabled.
-- Run as ONE transaction.

-- 0. Preflight: the 7 bodies are exactly as fingerprinted 29 Oct 2026 IST; new objects do not exist yet.
do $pre$
declare r record;
begin
  for r in select * from (values
      ('public.rpc_eaushadhi_worker_run_begin(integer,bigint,text,text,jsonb)', '7d94505e6f182b889f5ec302570c49a9'),
      ('public.rpc_eaushadhi_worker_run_resume(uuid,bigint,text)', 'b54420d7f122f88fe7070f166dff9e03'),
      ('public.rpc_eaushadhi_worker_mark_entered(uuid,bigint,text,text,jsonb)', 'ed9857743ab7291756ca273ee511d5eb'),
      ('public.rpc_eaushadhi_worker_mark_portal_verified(uuid,bigint,text,jsonb)', 'a3b16580e7843155778cee7963e04e5e'),
      ('public.rpc_eaushadhi_worker_mark_save_ambiguous(uuid,bigint,text,jsonb)', 'df666ead7af1182f3f582510d4cfa126'),
      ('public.rpc_eaushadhi_worker_run_rebase_portal_projection(uuid,bigint,jsonb)', 'd854e36441ce347d01872aeac623313a'),
      ('public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(uuid,bigint,text,text,jsonb)', 'fe26bae4e6c9d7f315dbbb3477ab6b50')
    ) v(sig, md5) loop
    if md5(pg_get_functiondef(r.sig::regprocedure)) is distinct from r.md5 then
      raise exception 'PKG3A_PREFLIGHT_FAILED: % changed since fingerprint', r.sig; end if;
  end loop;
  if to_regclass('regulatory.eaushadhi_portal_entry_gate') is not null then raise exception 'PKG3A_ALREADY_APPLIED'; end if;
  if (select entry_status from regulatory.eaushadhi_product_workflow where product_id=262) <> 'PORTAL_VERIFIED' then
    raise exception 'PKG3A_PREFLIGHT_FAILED: Product 262 not PORTAL_VERIFIED'; end if;
  if exists (select 1 from regulatory.eaushadhi_worker_run where run_status in ('RUNNING','ENTERED')) then
    raise exception 'PKG3A_PREFLIGHT_FAILED: an active worker run exists'; end if;
end $pre$;

-- 1. Gate table. No client access at all (RLS on, no policies, no grants). Audited by trg_audit_row.
create table regulatory.eaushadhi_portal_entry_gate (
  product_id integer primary key references regulatory.eaushadhi_product_workflow(product_id) on delete restrict,
  enabled boolean not null,
  enabled_by uuid references auth.users(id),
  enabled_at timestamptz,
  notes text not null check (length(btrim(notes)) between 10 and 1000),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table regulatory.eaushadhi_portal_entry_gate enable row level security;
revoke all on regulatory.eaushadhi_portal_entry_gate from public, anon, authenticated;
create trigger eaushadhi_portal_entry_gate_audit after insert or delete or update on regulatory.eaushadhi_portal_entry_gate
  for each row execute function regulatory.trg_audit_row();
comment on table regulatory.eaushadhi_portal_entry_gate is
  'WP-07 PKG3a per-product portal-entry gate. Written only by rpc_eaushadhi_portal_entry_gate_set_v1 (APPROVER plus reason). Absent row = disabled.';

-- 2. Seed: Product 262 enabled (it was the hardcoded pilot product). Enabled_by = the person who ran the 262 entry.
insert into regulatory.eaushadhi_portal_entry_gate(product_id, enabled, enabled_by, enabled_at, notes, updated_by)
select 262, true, w.entry_started_by, now(), 'Seeded by PKG3a: controlled pilot product, previously hardcoded in server functions.', w.entry_started_by
from regulatory.eaushadhi_product_workflow w where w.product_id = 262;

-- 3. Gate helpers.
create function regulatory.eaushadhi_portal_entry_enabled_v1(p_product_id integer) returns boolean
language sql stable security definer set search_path to 'public', 'regulatory', 'pg_temp' as $f$
  select coalesce((select g.enabled from regulatory.eaushadhi_portal_entry_gate g where g.product_id = p_product_id), false);
$f$;
create function regulatory.eaushadhi_portal_entry_require_v1(p_product_id integer) returns void
language plpgsql stable security definer set search_path to 'public', 'regulatory', 'pg_temp' as $f$
begin
  if not regulatory.eaushadhi_portal_entry_enabled_v1(p_product_id) then
    raise exception using errcode='42501', message='PORTAL_ENTRY_NOT_ENABLED',
      hint='Portal entry is not enabled for this product. An Approver must enable it first.';
  end if;
end
$f$;

-- 4. Approver check before a native portal Save (Product Details). Returns the server-built authorization record.
--    Refusal codes (SQLSTATE 42501 unless noted): PORTAL_ENTRY_NOT_ENABLED, APPROVER_ROLE_REQUIRED,
--    PORTAL_STAGE_NOT_VERIFIED (hint names the stage), FOUR_EYES_SAME_PERSON, PORTAL_SAVE_AUTHORIZATION_REQUIRED (22023).
create function regulatory.eaushadhi_portal_save_authorize_v1(p_actor uuid, p_product_id integer, p_start_context jsonb)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'regulatory', 'pg_temp' as $f$
declare v_pr regulatory.eaushadhi_product_review%rowtype; v_cr regulatory.eaushadhi_product_classification_review%rowtype;
        v_lines int; v_lines_open int; v_actions_open int; v_action_savers uuid[]; v_typed text;
begin
  perform regulatory.eaushadhi_portal_entry_require_v1(p_product_id);
  if not regulatory.eaushadhi_has_role_v1(p_actor, 'APPROVER') then
    raise exception using errcode='42501', message='APPROVER_ROLE_REQUIRED',
      hint='Only a colleague with the Approver role can authorize a portal Save.'; end if;
  select * into v_pr from regulatory.eaushadhi_product_review where product_id = p_product_id;
  if not found or v_pr.review_status <> 'VERIFIED' then
    raise exception using errcode='42501', message='PORTAL_STAGE_NOT_VERIFIED', hint='Product Details is not approved yet.'; end if;
  select * into v_cr from regulatory.eaushadhi_product_classification_review where product_id = p_product_id;
  if not found or v_cr.review_status <> 'VERIFIED' then
    raise exception using errcode='42501', message='PORTAL_STAGE_NOT_VERIFIED', hint='Portal Classification is not approved yet.'; end if;
  select count(*), count(*) filter (where review_status <> 'VERIFIED') into v_lines, v_lines_open
    from regulatory.eaushadhi_line_review where product_id = p_product_id;
  if v_lines = 0 or v_lines_open > 0 then
    raise exception using errcode='42501', message='PORTAL_STAGE_NOT_VERIFIED', hint='Not every Composition line is approved yet.'; end if;
  select count(*) filter (where review_status <> 'VERIFIED'), array_agg(distinct saved_for_review_by) filter (where saved_for_review_by is not null)
    into v_actions_open, v_action_savers from regulatory.eaushadhi_product_action_review where product_id = p_product_id;
  if v_actions_open > 0 then
    raise exception using errcode='42501', message='PORTAL_STAGE_NOT_VERIFIED', hint='Pharmacological actions are not approved yet.'; end if;
  if p_actor = v_pr.saved_for_review_by or p_actor = v_cr.saved_for_review_by or p_actor = any(coalesce(v_action_savers, '{}'::uuid[])) then
    raise exception using errcode='42501', message='FOUR_EYES_SAME_PERSON',
      hint='You saved a step that this portal Save would enter. A different Approver must authorize it.'; end if;
  v_typed := btrim(coalesce(p_start_context->'save_authorization'->>'typed_confirmation', ''));
  if coalesce(p_start_context->'save_authorization'->>'confirmed', '') <> 'true' or v_typed <> 'SAVE PRODUCT ' || p_product_id then
    raise exception using errcode='22023', message='PORTAL_SAVE_AUTHORIZATION_REQUIRED',
      hint='Tick the confirmation and type SAVE PRODUCT followed by the product number.'; end if;
  return jsonb_build_object('authorized_by', p_actor, 'authorized_at', now(), 'role', 'APPROVER', 'scope', 'PRODUCT_DETAILS_NATIVE_SAVE_ONCE',
    'typed_confirmation', v_typed, 'details_saver', v_pr.saved_for_review_by, 'classification_saver', v_cr.saved_for_review_by,
    'verified_lines', v_lines, 'final_submit', 'EXCLUDED');
end
$f$;
revoke all on function regulatory.eaushadhi_portal_entry_enabled_v1(integer) from public, anon, authenticated;
revoke all on function regulatory.eaushadhi_portal_entry_require_v1(integer) from public, anon, authenticated;
revoke all on function regulatory.eaushadhi_portal_save_authorize_v1(uuid, integer, jsonb) from public, anon, authenticated;

-- 5. Client RPCs: read the gate; set the gate (Approver plus reason). The only writer of the gate table.
create function public.rpc_eaushadhi_portal_entry_gate_get_v1(p_product_id integer)
returns table(product_id integer, enabled boolean, enabled_by uuid, enabled_at timestamptz, notes text, updated_at timestamptz)
language plpgsql stable security definer set search_path to 'public', 'regulatory', 'pg_temp' as $f$
begin
  perform public.rpc_eaushadhi_require_permission(false);
  return query select p_product_id, coalesce(g.enabled, false), g.enabled_by, g.enabled_at, g.notes, g.updated_at
    from (select 1) one left join regulatory.eaushadhi_portal_entry_gate g on g.product_id = p_product_id;
end
$f$;
create function public.rpc_eaushadhi_portal_entry_gate_set_v1(p_product_id integer, p_enabled boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path to 'public', 'regulatory', 'pg_temp' as $f$
declare v_actor uuid := public.rpc_eaushadhi_require_permission(true); v_old boolean;
begin
  if not regulatory.eaushadhi_has_role_v1(v_actor, 'APPROVER') then
    raise exception using errcode='42501', message='APPROVER_ROLE_REQUIRED', hint='Only an Approver can change portal entry for a product.'; end if;
  if p_product_id is null or p_enabled is null or length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception using errcode='22023', message='GATE_REASON_REQUIRED', hint='Give the product, on or off, and a reason of at least 10 characters.'; end if;
  if not exists (select 1 from regulatory.eaushadhi_product_workflow where product_id = p_product_id) then
    raise exception using errcode='P0002', message='e-Aushadhi product workflow not found'; end if;
  if not p_enabled and exists (select 1 from regulatory.eaushadhi_worker_run where product_id = p_product_id and run_status in ('RUNNING','ENTERED')) then
    raise exception using errcode='55000', message='GATE_ACTIVE_RUN', hint='Finish or recover the active portal run before disabling.'; end if;
  select enabled into v_old from regulatory.eaushadhi_portal_entry_gate where product_id = p_product_id for update;
  insert into regulatory.eaushadhi_portal_entry_gate as g(product_id, enabled, enabled_by, enabled_at, notes, updated_by, updated_at)
  values (p_product_id, p_enabled, case when p_enabled then v_actor end, case when p_enabled then now() end, btrim(p_reason), v_actor, now())
  on conflict (product_id) do update set enabled = excluded.enabled,
    enabled_by = case when excluded.enabled then v_actor else g.enabled_by end,
    enabled_at = case when excluded.enabled then now() else g.enabled_at end,
    notes = excluded.notes, updated_by = v_actor, updated_at = now();
  return jsonb_build_object('ok', true, 'product_id', p_product_id, 'enabled', p_enabled, 'changed', v_old is distinct from p_enabled);
end
$f$;
revoke all on function public.rpc_eaushadhi_portal_entry_gate_get_v1(integer) from public, anon;
revoke all on function public.rpc_eaushadhi_portal_entry_gate_set_v1(integer, boolean, text) from public, anon;
grant execute on function public.rpc_eaushadhi_portal_entry_gate_get_v1(integer) to authenticated, service_role;
grant execute on function public.rpc_eaushadhi_portal_entry_gate_set_v1(integer, boolean, text) to authenticated, service_role;

-- 6. The 7 Product Details worker functions: the hardcoded 262 check becomes the gate check (diff in BODY_DIFFS.txt).
--    run_begin also calls the Approver check and records the server-built authorization in the run's start_context.
--    CREATE OR REPLACE keeps the existing grants (postgres, authenticated, service_role).

CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_worker_run_begin(p_product_id integer, p_expected_workflow_row_version bigint, p_expected_content_hash text, p_expected_payload_hash text DEFAULT NULL::text, p_start_context jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_ready regulatory.v_eaushadhi_product_readiness%rowtype;
  v_payload jsonb;
  v_content_hash text;
  v_payload_hash text;
  v_run_id uuid;
  v_now timestamptz := now();
  v_auth jsonb;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  v_auth := regulatory.eaushadhi_portal_save_authorize_v1(v_actor, p_product_id, p_start_context);
  if p_expected_content_hash is null or p_expected_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023', message='Expected content hash is required';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow w
  where w.product_id = p_product_id
  for update;
  if not found then
    raise exception using errcode='P0002', message='e-Aushadhi product workflow not found';
  end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then
    raise exception using errcode='40001', message='Stale workflow row version';
  end if;
  if v_workflow.review_status <> 'VERIFIED' then
    raise exception using errcode='P0001', message='Product must be internally VERIFIED before worker entry';
  end if;
  if v_workflow.entry_status <> 'NOT_STARTED' then
    raise exception using errcode='P0001', message='Worker run can begin only from NOT_STARTED';
  end if;

  select * into v_ready
  from regulatory.v_eaushadhi_product_readiness r
  where r.product_id = p_product_id;
  if not found or coalesce(v_ready.is_ready_for_entry,false) is not true then
    raise exception using errcode='P0001', message='Product is not ready for portal entry';
  end if;

  if exists (
    select 1 from regulatory.eaushadhi_worker_run wr
    where wr.product_id = p_product_id and wr.run_status in ('RUNNING','ENTERED')
  ) then
    raise exception using errcode='23505', message='An active e-Aushadhi worker run already exists for this product';
  end if;

  v_payload := public.rpc_eaushadhi_worker_content_get(p_product_id, p_expected_workflow_row_version);
  v_content_hash := v_payload->>'content_hash';
  v_payload_hash := v_payload->>'payload_hash';
  if v_content_hash is distinct from p_expected_content_hash then
    raise exception using errcode='40001', message='Worker content hash changed before run start';
  end if;
  if p_expected_payload_hash is not null and v_payload_hash is distinct from p_expected_payload_hash then
    raise exception using errcode='40001', message='Worker payload hash changed before run start';
  end if;

  insert into regulatory.eaushadhi_worker_run(
    product_id, run_status, start_workflow_row_version, current_workflow_row_version,
    start_content_hash, start_payload_hash, start_context, started_by, started_at, created_at, updated_at
  ) values (
    p_product_id, 'RUNNING', v_workflow.row_version, v_workflow.row_version,
    v_content_hash, v_payload_hash, coalesce(p_start_context,'{}'::jsonb) || jsonb_build_object('save_authorization', v_auth), v_actor, v_now, v_now, v_now
  ) returning run_id into v_run_id;

  update regulatory.eaushadhi_product_workflow w
  set entry_status='IN_PROGRESS',
      entry_started_by=v_actor,
      entry_started_at=v_now,
      row_version=w.row_version+1,
      updated_by=v_actor,
      updated_at=v_now
  where w.product_id=p_product_id;

  update regulatory.eaushadhi_worker_run wr
  set current_workflow_row_version=v_workflow.row_version+1,
      updated_at=v_now
  where wr.run_id=v_run_id;

  return jsonb_build_object(
    'run_id',v_run_id,
    'product_id',p_product_id,
    'run_status','RUNNING',
    'entry_status','IN_PROGRESS',
    'workflow_row_version',v_workflow.row_version+1,
    'content_hash',v_content_hash,
    'payload_hash',v_payload_hash,
    'started_at',v_now
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_worker_run_resume(p_run_id uuid, p_expected_workflow_row_version bigint, p_expected_content_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_run regulatory.eaushadhi_worker_run%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_payload jsonb;
  v_content_hash text;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  select * into v_run from regulatory.eaushadhi_worker_run wr where wr.run_id=p_run_id for update;
  if not found then raise exception using errcode='P0002', message='Worker run not found'; end if;
  perform regulatory.eaushadhi_portal_entry_require_v1(v_run.product_id);
  if v_run.run_status not in ('RUNNING','ENTERED') then raise exception using errcode='P0001', message='Worker run is not resumable'; end if;

  select * into v_workflow from regulatory.eaushadhi_product_workflow w where w.product_id=v_run.product_id for update;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then raise exception using errcode='40001', message='Stale workflow row version'; end if;
  if (v_run.run_status='RUNNING' and v_workflow.entry_status<>'IN_PROGRESS') or
     (v_run.run_status='ENTERED' and v_workflow.entry_status<>'ENTERED') then
    raise exception using errcode='P0001', message='Worker run state does not match workflow state';
  end if;

  v_payload := public.rpc_eaushadhi_worker_content_get(v_run.product_id, v_workflow.row_version);
  v_content_hash := v_payload->>'content_hash';
  if v_content_hash is distinct from v_run.start_content_hash or v_content_hash is distinct from p_expected_content_hash then
    raise exception using errcode='40001', message='Worker content changed; resume is blocked';
  end if;

  update regulatory.eaushadhi_worker_run wr set updated_at=now() where wr.run_id=p_run_id;
  return jsonb_build_object(
    'run_id',v_run.run_id,
    'product_id',v_run.product_id,
    'run_status',v_run.run_status,
    'entry_status',v_workflow.entry_status,
    'workflow_row_version',v_workflow.row_version,
    'content_hash',v_content_hash,
    'portal_product_ref',coalesce(v_workflow.portal_product_ref,v_run.portal_product_ref)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_worker_mark_entered(p_run_id uuid, p_expected_workflow_row_version bigint, p_expected_content_hash text, p_portal_product_ref text DEFAULT NULL::text, p_entered_audit jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_run regulatory.eaushadhi_worker_run%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_payload jsonb;
  v_content_hash text;
  v_ref text;
  v_now timestamptz := now();
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  select * into v_run from regulatory.eaushadhi_worker_run wr where wr.run_id=p_run_id for update;
  if not found then raise exception using errcode='P0002', message='Worker run not found'; end if;
  perform regulatory.eaushadhi_portal_entry_require_v1(v_run.product_id);
  if v_run.run_status <> 'RUNNING' then raise exception using errcode='P0001', message='Worker run must be RUNNING before marking ENTERED'; end if;

  select * into v_workflow from regulatory.eaushadhi_product_workflow w where w.product_id=v_run.product_id for update;
  if v_workflow.entry_status <> 'IN_PROGRESS' then raise exception using errcode='P0001', message='Workflow must be IN_PROGRESS before marking ENTERED'; end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then raise exception using errcode='40001', message='Stale workflow row version'; end if;

  v_payload := public.rpc_eaushadhi_worker_content_get(v_run.product_id, v_workflow.row_version);
  v_content_hash := v_payload->>'content_hash';
  if v_content_hash is distinct from v_run.start_content_hash or v_content_hash is distinct from p_expected_content_hash then
    raise exception using errcode='40001', message='Worker content changed before ENTERED';
  end if;

  v_ref := nullif(btrim(p_portal_product_ref),'');
  if v_workflow.portal_product_ref is not null and v_ref is not null and v_workflow.portal_product_ref <> v_ref then
    raise exception using errcode='P0001', message='Portal product reference conflicts with existing workflow reference';
  end if;
  v_ref := coalesce(v_ref, v_workflow.portal_product_ref, v_run.portal_product_ref);

  update regulatory.eaushadhi_product_workflow w
  set entry_status='ENTERED',
      entered_by=v_actor,
      entered_at=v_now,
      portal_product_ref=v_ref,
      row_version=w.row_version+1,
      updated_by=v_actor,
      updated_at=v_now
  where w.product_id=v_run.product_id;

  update regulatory.eaushadhi_worker_run wr
  set run_status='ENTERED',
      current_workflow_row_version=v_workflow.row_version+1,
      portal_product_ref=v_ref,
      entered_audit=coalesce(p_entered_audit,'{}'::jsonb),
      entered_by=v_actor,
      entered_at=v_now,
      updated_at=v_now
  where wr.run_id=p_run_id;

  return jsonb_build_object(
    'run_id',p_run_id,
    'product_id',v_run.product_id,
    'run_status','ENTERED',
    'entry_status','ENTERED',
    'workflow_row_version',v_workflow.row_version+1,
    'content_hash',v_content_hash,
    'portal_product_ref',v_ref,
    'entered_at',v_now
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_worker_mark_portal_verified(p_run_id uuid, p_expected_workflow_row_version bigint, p_expected_content_hash text, p_compare_report jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_run regulatory.eaushadhi_worker_run%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_payload jsonb;
  v_content_hash text;
  v_now timestamptz := now();
  v_items jsonb;
  v_item jsonb;
  v_special boolean := false;
  v_exception_count integer := 0;
  v_shelfmonth_count integer := 0;
  v_item_evidence jsonb;
  v_save jsonb;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  select * into v_run from regulatory.eaushadhi_worker_run wr where wr.run_id=p_run_id for update;
  if not found then raise exception using errcode='P0002', message='Worker run not found'; end if;
  perform regulatory.eaushadhi_portal_entry_require_v1(v_run.product_id);
  if v_run.run_status<>'ENTERED' then raise exception using errcode='P0001', message='Worker run must be ENTERED before portal verification'; end if;
  select * into v_workflow from regulatory.eaushadhi_product_workflow w where w.product_id=v_run.product_id for update;
  if v_workflow.entry_status<>'ENTERED' then raise exception using errcode='P0001', message='Workflow must be ENTERED before portal verification'; end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then raise exception using errcode='40001', message='Stale workflow row version'; end if;
  v_payload := public.rpc_eaushadhi_worker_content_get(v_run.product_id,v_workflow.row_version);
  v_content_hash := v_payload->>'content_hash';
  if v_content_hash is distinct from v_run.start_content_hash or v_content_hash is distinct from p_expected_content_hash then
    raise exception using errcode='40001', message='Worker content changed before portal verification';
  end if;

  if jsonb_typeof(p_compare_report)<>'object' then raise exception using errcode='22023', message='Compare report object is required'; end if;
  v_special := coalesce(p_compare_report->>'overall','')='MATCH_WITH_TRUSTED_UNAVAILABLE';
  if v_special then
    if jsonb_typeof(p_compare_report->'equal')<>'boolean' or (p_compare_report->>'equal')::boolean is not false
       or jsonb_typeof(p_compare_report->'verificationAcceptable')<>'boolean'
       or (p_compare_report->>'verificationAcceptable')::boolean is not true then
      raise exception using errcode='22023', message='Special compare report summary is invalid';
    end if;
  elsif coalesce((p_compare_report->>'equal')::boolean,false) is not true then
    raise exception using errcode='22023', message='Compare report must declare equal=true';
  end if;
  v_items := p_compare_report->'items';
  if jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception using errcode='22023', message='Compare report items are required'; end if;
  for v_item in select value from jsonb_array_elements(v_items) loop
    if coalesce(v_item->>'path','')='shelfmonth' then v_shelfmonth_count:=v_shelfmonth_count+1; end if;
    if coalesce(v_item->>'result','')='PORTAL_REREAD_UNAVAILABLE_TRUSTED' then
      v_exception_count:=v_exception_count+1;
      v_item_evidence:=v_item->'evidence';
      if not v_special or coalesce(v_item->>'path','')<>'shelfmonth'
         or coalesce(v_item->>'expected','')<>'RegularAsPerClause'
         or not (v_item ? 'actual') or jsonb_typeof(v_item->'actual')<>'null'
         or jsonb_typeof(v_item_evidence)<>'object'
         or (select array_agg(k order by k) from jsonb_object_keys(v_item_evidence) k)
              is distinct from array['domCheckedValue','domMonth','responseMonth','responseValue','source']::text[]
         or v_item_evidence->>'source'<>'GetproductDataUpdate_response'
         or jsonb_typeof(v_item_evidence->'responseValue')<>'null'
         or jsonb_typeof(v_item_evidence->'domCheckedValue')<>'null'
         or coalesce(jsonb_typeof(v_item_evidence->'responseMonth'),'null') not in ('null','string','number')
         or coalesce(jsonb_typeof(v_item_evidence->'domMonth'),'null') not in ('null','string','number')
         or (jsonb_typeof(v_item_evidence->'responseMonth')='string' and length(v_item_evidence->>'responseMonth')>128)
         or (jsonb_typeof(v_item_evidence->'domMonth')='string' and length(v_item_evidence->>'domMonth')>128) then
        raise exception using errcode='22023', message='Trusted shelfmonth unavailable item is invalid';
      end if;
    elsif coalesce(v_item->>'result','')<>'MATCH' then
      raise exception using errcode='22023', message='Compare report contains MISMATCH or unaccepted results';
    end if;
  end loop;
  if (v_special and (v_exception_count<>1 or v_shelfmonth_count<>1)) or (not v_special and v_exception_count<>0) then
    raise exception using errcode='22023', message='Compare report exceptional item count is invalid';
  end if;
  if v_special then
    v_save:=v_run.last_save_evidence;
    if v_run.last_save_outcome is distinct from 'AMBIGUOUS'
       or v_run.last_save_observed_at is null
       or jsonb_typeof(v_save)<>'object'
       or upper(coalesce(v_save->>'outcome',''))<>'AMBIGUOUS'
       or jsonb_typeof(v_save->'invoked')<>'boolean' or (v_save->>'invoked')::boolean is not true
       or jsonb_typeof(v_save->'invokeCount')<>'number' or (v_save->>'invokeCount')::numeric<>1
       or jsonb_typeof(v_save->'settled')<>'boolean' or (v_save->>'settled')::boolean is not true
       or jsonb_typeof(v_save->'businessSuccess')<>'boolean' or (v_save->>'businessSuccess')::boolean is not true
       or coalesce(v_save->>'phase','') not in ('SAVE_CONFIRMED','RUN_RESUME') then
      raise exception using errcode='22023', message='Trusted shelfmonth unavailable mode requires strong same-run save evidence';
    end if;
  end if;

  update regulatory.eaushadhi_product_workflow w set entry_status='PORTAL_VERIFIED',portal_verified_by=v_actor,portal_verified_at=v_now,row_version=w.row_version+1,updated_by=v_actor,updated_at=v_now where w.product_id=v_run.product_id;
  update regulatory.eaushadhi_worker_run wr set run_status='PORTAL_VERIFIED',current_workflow_row_version=v_workflow.row_version+1,compare_report=p_compare_report,portal_verified_by=v_actor,portal_verified_at=v_now,updated_at=v_now where wr.run_id=p_run_id;
  return jsonb_build_object('run_id',p_run_id,'product_id',v_run.product_id,'run_status','PORTAL_VERIFIED','entry_status','PORTAL_VERIFIED','workflow_row_version',v_workflow.row_version+1,'content_hash',v_content_hash,'portal_product_ref',coalesce(v_workflow.portal_product_ref,v_run.portal_product_ref),'portal_verified_at',v_now);
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_worker_mark_save_ambiguous(p_run_id uuid, p_expected_workflow_row_version bigint, p_expected_content_hash text, p_save_evidence jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'auth', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_run regulatory.eaushadhi_worker_run%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_now timestamptz := now();
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);

  select * into v_run
  from regulatory.eaushadhi_worker_run
  where run_id=p_run_id
  for update;
  if not found then raise exception using errcode='P0002', message='Worker run not found'; end if;
  perform regulatory.eaushadhi_portal_entry_require_v1(v_run.product_id);
  if v_run.run_status <> 'RUNNING' or v_run.portal_product_ref is not null or v_run.entered_at is not null then
    raise exception using errcode='55000', message='Only an unentered RUNNING worker run can be marked SAVE_AMBIGUOUS';
  end if;
  if p_expected_content_hash is distinct from v_run.start_content_hash then
    raise exception using errcode='40001', message='SAVE_AMBIGUOUS marker content hash does not match run authority';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow
  where product_id=v_run.product_id
  for update;
  if not found then raise exception using errcode='P0002', message='Workflow row not found'; end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then
    raise exception using errcode='40001', message='Stale workflow row version';
  end if;
  if v_workflow.entry_status <> 'IN_PROGRESS' or v_workflow.portal_product_ref is not null or v_workflow.entered_at is not null then
    raise exception using errcode='55000', message='Workflow is not eligible for SAVE_AMBIGUOUS marking';
  end if;

  update regulatory.eaushadhi_worker_run
  set last_save_outcome='AMBIGUOUS',
      last_save_observed_at=v_now,
      last_save_evidence=coalesce(p_save_evidence,'{}'::jsonb),
      updated_at=v_now
  where run_id=p_run_id;

  insert into regulatory.audit_event(
    entity_schema,entity_table,entity_key,action,
    old_data,new_data,actor_user_id,application_name,occurred_at
  )
  values(
    'regulatory','eaushadhi_worker_run',p_run_id::text,'UPDATE',
    jsonb_build_object(
      'event_kind','SAVE_AMBIGUOUS_MARKER',
      'last_save_outcome',v_run.last_save_outcome,
      'last_save_observed_at',v_run.last_save_observed_at
    ),
    jsonb_build_object(
      'event_kind','SAVE_AMBIGUOUS_MARKER',
      'last_save_outcome','AMBIGUOUS',
      'last_save_observed_at',v_now,
      'save_evidence',coalesce(p_save_evidence,'{}'::jsonb)
    ),
    v_actor,'e-aushadhi-automation',v_now
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'product_id',v_run.product_id,
    'run_status','RUNNING',
    'entry_status','IN_PROGRESS',
    'workflow_row_version',v_workflow.row_version,
    'content_hash',v_run.start_content_hash,
    'last_save_outcome','AMBIGUOUS',
    'last_save_observed_at',v_now
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_worker_run_rebase_portal_projection(p_run_id uuid, p_expected_workflow_row_version bigint, p_reconciliation_evidence jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'extensions', 'pg_temp'
AS $function$
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
    raise exception using errcode='22023', message='Reconciliation evidence object is required';
  end if;

  v_duplicate_outcome := upper(coalesce(p_reconciliation_evidence->>'duplicate_outcome',''));
  v_coverage_complete := coalesce((p_reconciliation_evidence->>'coverage_complete')::boolean,false);
  v_source := coalesce(p_reconciliation_evidence->>'source','');

  if v_duplicate_outcome <> 'NONE' or v_coverage_complete is not true or v_source <> 'LoadProductDataforLegacy' then
    raise exception using errcode='22023', message='Rebase requires coverage-complete duplicate NONE evidence';
  end if;

  select * into v_run
  from regulatory.eaushadhi_worker_run
  where run_id=p_run_id
  for update;
  if not found then raise exception using errcode='P0002', message='Worker run not found'; end if;
  perform regulatory.eaushadhi_portal_entry_require_v1(v_run.product_id);
  if v_run.run_status <> 'RUNNING' or v_run.portal_product_ref is not null or v_run.entered_at is not null then
    raise exception using errcode='55000', message='Only an unentered RUNNING worker run can be rebased';
  end if;
  if v_run.last_save_outcome is distinct from 'AMBIGUOUS' or v_run.last_save_observed_at is null then
    raise exception using errcode='55000', message='Authority rebase requires server-recorded SAVE_AMBIGUOUS on the same run';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow
  where product_id=v_run.product_id
  for update;
  if not found then raise exception using errcode='P0002', message='Workflow row not found'; end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then
    raise exception using errcode='40001', message='Stale workflow row version';
  end if;
  if v_workflow.entry_status <> 'IN_PROGRESS' or v_workflow.portal_product_ref is not null or v_workflow.entered_at is not null then
    raise exception using errcode='55000', message='Workflow is not eligible for same-run authority rebase';
  end if;

  select * into v_review
  from regulatory.eaushadhi_product_review
  where product_id=v_run.product_id;
  if v_review.diseases_conditions_portal_review_status <> 'VERIFIED'
     or nullif(btrim(v_review.selected_diseases_conditions_portal_text),'') is null then
    raise exception using errcode='55000', message='Portal Diseases and Conditions projection must be VERIFIED before rebase';
  end if;

  v_current_payload := public.rpc_eaushadhi_worker_payload_get(v_run.product_id,v_workflow.row_version);
  v_current_content_hash := regulatory.eaushadhi_worker_content_hash(v_current_payload);

  v_legacy_payload := jsonb_set(
    v_current_payload,
    '{details,diseases_conditions}',
    to_jsonb(v_review.selected_diseases_conditions_text),
    true
  );
  v_legacy_content_hash := regulatory.eaushadhi_worker_content_hash(v_legacy_payload);

  if v_legacy_content_hash is distinct from v_run.start_content_hash then
    raise exception using errcode='55000',
      message='Authority rebase rejected: prior run hash is not explained solely by the Diseases and Conditions portal projection';
  end if;

  update regulatory.eaushadhi_worker_run
  set start_content_hash=v_current_content_hash,
      start_payload_hash=v_current_payload->>'payload_hash',
      start_context=coalesce(start_context,'{}'::jsonb) || jsonb_build_object(
        'authority_rebase',
        jsonb_build_object(
          'kind','DISEASES_CONDITIONS_PORTAL_PROJECTION',
          'previous_content_hash',v_run.start_content_hash,
          'new_content_hash',v_current_content_hash,
          'generation_version',v_review.diseases_conditions_portal_generation_version,
          'save_ambiguous_observed_at',v_run.last_save_observed_at,
          'reconciliation_evidence',p_reconciliation_evidence,
          'rebased_by',v_actor,
          'rebased_at',v_now
        )
      ),
      updated_at=v_now
  where run_id=p_run_id;

  insert into regulatory.audit_event(
    entity_schema,entity_table,entity_key,action,
    old_data,new_data,actor_user_id,application_name,occurred_at
  )
  values(
    'regulatory','eaushadhi_worker_run',p_run_id::text,'UPDATE',
    jsonb_build_object(
      'event_kind','REBASE_PORTAL_DISEASES_AUTHORITY',
      'start_content_hash',v_run.start_content_hash,
      'last_save_outcome',v_run.last_save_outcome,
      'last_save_observed_at',v_run.last_save_observed_at
    ),
    jsonb_build_object(
      'event_kind','REBASE_PORTAL_DISEASES_AUTHORITY',
      'start_content_hash',v_current_content_hash,
      'product_id',v_run.product_id,
      'reconciliation_evidence',p_reconciliation_evidence
    ),
    v_actor,'e-aushadhi-automation',v_now
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'product_id',v_run.product_id,
    'run_status','RUNNING',
    'entry_status','IN_PROGRESS',
    'workflow_row_version',v_workflow.row_version,
    'previous_content_hash',v_run.start_content_hash,
    'content_hash',v_current_content_hash,
    'payload_hash',v_current_payload->>'payload_hash',
    'last_save_outcome',v_run.last_save_outcome,
    'rebased',true
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(p_run_id uuid, p_expected_workflow_row_version bigint, p_expected_content_hash text, p_portal_product_ref text, p_recovery_evidence jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'extensions', 'auth', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_run regulatory.eaushadhi_worker_run%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_now timestamptz := now();
  v_portal_ref text;
  v_source text;
  v_duplicate_outcome text;
  v_coverage_complete boolean;
  v_exact_match_count integer;
  v_evidence_portal_ref text;
  v_reread_source text;
  v_reread_id_match boolean;
  v_compare_equal boolean;
  v_compare_report jsonb;
  v_items jsonb;
  v_item jsonb;
  v_current_hash text;
  v_payload jsonb;
  v_special boolean := false;
  v_exception_count integer := 0;
  v_shelfmonth_count integer := 0;
  v_item_evidence jsonb;
  v_save jsonb;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  if jsonb_typeof(p_recovery_evidence) <> 'object' then
    raise exception using errcode='22023', message='Recovery evidence object is required';
  end if;
  v_portal_ref := nullif(btrim(coalesce(p_portal_product_ref,'')), '');
  if v_portal_ref is null or v_portal_ref in ('0','-1','262') then
    raise exception using errcode='22023', message='Adoption requires a valid portal product ref distinct from Product 262';
  end if;

  v_source := coalesce(p_recovery_evidence->>'source','');
  v_duplicate_outcome := upper(coalesce(p_recovery_evidence->>'duplicate_outcome',''));
  v_coverage_complete := coalesce((p_recovery_evidence->>'coverage_complete')::boolean,false);
  v_exact_match_count := coalesce((p_recovery_evidence->>'exact_match_count')::integer,0);
  v_evidence_portal_ref := nullif(btrim(coalesce(p_recovery_evidence->>'portal_product_ref','')), '');
  v_reread_source := coalesce(p_recovery_evidence->>'reread_source','');
  v_reread_id_match := coalesce((p_recovery_evidence->>'reread_id_match')::boolean,false);
  v_compare_equal := coalesce((p_recovery_evidence->>'compare_equal')::boolean,false);
  v_compare_report := coalesce(p_recovery_evidence->'compare_report','{}'::jsonb);
  if v_source <> 'LoadProductDataforLegacy'
     or v_duplicate_outcome <> 'EXACT_ONE'
     or v_coverage_complete is not true
     or v_exact_match_count <> 1
     or v_evidence_portal_ref is distinct from v_portal_ref
     or v_reread_source <> 'GetproductDataUpdate'
     or v_reread_id_match is not true then
    raise exception using errcode='22023', message='Adoption requires coverage-complete EXACT_ONE recovery evidence with matching reread';
  end if;

  if jsonb_typeof(v_compare_report) <> 'object' then
    raise exception using errcode='22023', message='Adoption compare report object is required';
  end if;
  v_special := coalesce(v_compare_report->>'overall','') = 'MATCH_WITH_TRUSTED_UNAVAILABLE';
  if v_special then
    if jsonb_typeof(p_recovery_evidence->'compare_equal') <> 'boolean'
       or v_compare_equal is not false
       or coalesce(p_recovery_evidence->>'compare_overall','') <> 'MATCH_WITH_TRUSTED_UNAVAILABLE'
       or jsonb_typeof(p_recovery_evidence->'compare_verification_acceptable') <> 'boolean'
       or (p_recovery_evidence->>'compare_verification_acceptable')::boolean is not true
       or jsonb_typeof(v_compare_report->'equal') <> 'boolean'
       or (v_compare_report->>'equal')::boolean is not false
       or jsonb_typeof(v_compare_report->'verificationAcceptable') <> 'boolean'
       or (v_compare_report->>'verificationAcceptable')::boolean is not true then
      raise exception using errcode='22023', message='Special adoption compare summary is invalid';
    end if;
  elsif v_compare_equal is not true
     or coalesce((v_compare_report->>'equal')::boolean,false) is not true then
    raise exception using errcode='22023', message='Ordinary adoption compare report must be equal=true';
  end if;

  v_items := v_compare_report->'items';
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items)=0 then
    raise exception using errcode='22023', message='Adoption compare report items are required';
  end if;
  for v_item in select value from jsonb_array_elements(v_items) loop
    if coalesce(v_item->>'path','') = 'shelfmonth' then
      v_shelfmonth_count := v_shelfmonth_count + 1;
    end if;
    if coalesce(v_item->>'result','') = 'PORTAL_REREAD_UNAVAILABLE_TRUSTED' then
      v_exception_count := v_exception_count + 1;
      v_item_evidence := v_item->'evidence';
      if not v_special
         or coalesce(v_item->>'path','') <> 'shelfmonth'
         or coalesce(v_item->>'expected','') <> 'RegularAsPerClause'
         or not (v_item ? 'actual')
         or jsonb_typeof(v_item->'actual') <> 'null'
         or jsonb_typeof(v_item_evidence) <> 'object'
         or (select array_agg(k order by k) from jsonb_object_keys(v_item_evidence) k)
              is distinct from array['domCheckedValue','domMonth','responseMonth','responseValue','source']::text[]
         or v_item_evidence->>'source' <> 'GetproductDataUpdate_response'
         or jsonb_typeof(v_item_evidence->'responseValue') <> 'null'
         or jsonb_typeof(v_item_evidence->'domCheckedValue') <> 'null'
         or coalesce(jsonb_typeof(v_item_evidence->'responseMonth'),'null') not in ('null','string','number')
         or coalesce(jsonb_typeof(v_item_evidence->'domMonth'),'null') not in ('null','string','number')
         or (jsonb_typeof(v_item_evidence->'responseMonth')='string' and length(v_item_evidence->>'responseMonth')>128)
         or (jsonb_typeof(v_item_evidence->'domMonth')='string' and length(v_item_evidence->>'domMonth')>128) then
        raise exception using errcode='22023', message='Trusted shelfmonth unavailable item is invalid';
      end if;
    elsif coalesce(v_item->>'result','') <> 'MATCH' then
      raise exception using errcode='22023', message='Compare report contains an unaccepted result';
    end if;
  end loop;
  if (v_special and (v_exception_count<>1 or v_shelfmonth_count<>1))
     or (not v_special and v_exception_count<>0) then
    raise exception using errcode='22023', message='Compare report exceptional item count is invalid';
  end if;

  select * into v_run from regulatory.eaushadhi_worker_run where run_id=p_run_id for update;
  if not found then raise exception using errcode='P0002', message='Worker run not found'; end if;
  perform regulatory.eaushadhi_portal_entry_require_v1(v_run.product_id);
  if v_run.run_status<>'RUNNING' or v_run.portal_product_ref is not null or v_run.entered_at is not null then
    raise exception using errcode='55000', message='Only an unentered RUNNING worker run can adopt an ambiguous-save portal identity';
  end if;
  if v_run.last_save_outcome is distinct from 'AMBIGUOUS' or v_run.last_save_observed_at is null then
    raise exception using errcode='55000', message='Adoption requires server-recorded SAVE_AMBIGUOUS on the same run';
  end if;
  if v_special then
    v_save := v_run.last_save_evidence;
    if jsonb_typeof(v_save)<>'object'
       or upper(coalesce(v_save->>'outcome',''))<>'AMBIGUOUS'
       or jsonb_typeof(v_save->'invoked')<>'boolean' or (v_save->>'invoked')::boolean is not true
       or jsonb_typeof(v_save->'invokeCount')<>'number' or (v_save->>'invokeCount')::numeric<>1
       or jsonb_typeof(v_save->'settled')<>'boolean' or (v_save->>'settled')::boolean is not true
       or jsonb_typeof(v_save->'businessSuccess')<>'boolean' or (v_save->>'businessSuccess')::boolean is not true
       or coalesce(v_save->>'phase','') not in ('SAVE_CONFIRMED','RUN_RESUME') then
      raise exception using errcode='22023', message='Trusted shelfmonth unavailable mode requires strong same-run save evidence';
    end if;
  end if;
  if p_expected_content_hash is distinct from v_run.start_content_hash then
    raise exception using errcode='40001', message='Adoption content hash does not match run authority';
  end if;

  select * into v_workflow from regulatory.eaushadhi_product_workflow where product_id=v_run.product_id for update;
  if not found then raise exception using errcode='P0002', message='Workflow row not found'; end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then raise exception using errcode='40001', message='Stale workflow row version'; end if;
  if v_workflow.entry_status<>'IN_PROGRESS' or v_workflow.portal_product_ref is not null or v_workflow.entered_at is not null then
    raise exception using errcode='55000', message='Workflow is not eligible for ambiguous-save identity adoption';
  end if;
  v_payload := public.rpc_eaushadhi_worker_content_get(v_run.product_id,v_workflow.row_version);
  v_current_hash := v_payload->>'content_hash';
  if v_current_hash is null or v_current_hash is distinct from v_run.start_content_hash or v_current_hash is distinct from p_expected_content_hash then
    raise exception using errcode='40001', message='Adoption refused: fresh governed content hash does not match run start and expected hash';
  end if;

  update regulatory.eaushadhi_worker_run set
    run_status='ENTERED', portal_product_ref=v_portal_ref,
    current_workflow_row_version=v_workflow.row_version+1,
    entered_by=v_actor, entered_at=v_now, updated_at=v_now
  where run_id=p_run_id;
  update regulatory.eaushadhi_product_workflow set
    entry_status='ENTERED', portal_product_ref=v_portal_ref,
    entered_by=v_actor, entered_at=v_now, row_version=v_workflow.row_version+1,
    updated_by=v_actor, updated_at=v_now
  where product_id=v_run.product_id;
  insert into regulatory.audit_event(entity_schema,entity_table,entity_key,action,old_data,new_data,actor_user_id,application_name,occurred_at)
  values('regulatory','eaushadhi_worker_run',p_run_id::text,'UPDATE',
    jsonb_build_object('event_kind','ADOPT_AMBIGUOUS_SAVE_PORTAL_IDENTITY','run_status',v_run.run_status,'portal_product_ref',v_run.portal_product_ref,'last_save_outcome',v_run.last_save_outcome),
    jsonb_build_object('event_kind','ADOPT_AMBIGUOUS_SAVE_PORTAL_IDENTITY','run_status','ENTERED','portal_product_ref',v_portal_ref,'last_save_outcome','AMBIGUOUS','recovery_evidence',p_recovery_evidence,'current_workflow_row_version',v_workflow.row_version+1,'content_hash',v_current_hash),
    v_actor,'e-aushadhi-automation',v_now);
  return jsonb_build_object('run_id',p_run_id,'product_id',v_run.product_id,'run_status','ENTERED','entry_status','ENTERED','portal_product_ref',v_portal_ref,'workflow_row_version',v_workflow.row_version+1,'content_hash',v_current_hash,'last_save_outcome','AMBIGUOUS');
end;
$function$;
