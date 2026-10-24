-- WP-07 B4 R3: QC readiness (derived, read-only, fail-closed). Proposed name: <apply-version>_wp07_b4_qc_readiness.sql
-- Adds: operator-asserted fact acceptance (append-only), lab-basis record (append-only, PENDING only; no approval path),
-- read-only readiness on top of the B3.1 recheck, and a guard in eaushadhi_qc_snapshot_v1 so a claimed content_sha256
-- can never count as a frozen test report. No canonical study writes, no portal actions, no data changes.

do $pre$
begin
  if to_regprocedure('regulatory.eaushadhi_qc_preparation_reopen_v1(uuid,bigint,boolean,text,uuid)') is null then raise exception 'B4 preflight: B3.1 missing'; end if;
  if to_regclass('regulatory.eaushadhi_qc_fact_acceptance') is not null then raise exception 'B4 preflight: already applied'; end if;
end
$pre$;

-- 1. Operator-asserted fact acceptance: one per (binding, fact). Invalidated automatically by any new binding.
create table regulatory.eaushadhi_qc_fact_acceptance (
  acceptance_id bigint generated always as identity primary key,
  binding_id bigint not null references regulatory.eaushadhi_qc_evidence_binding(binding_id) on delete restrict,
  preparation_id uuid not null references regulatory.eaushadhi_qc_preparation(preparation_id) on delete restrict,
  fact_key text not null check (fact_key in ('study_start_date','study_end_date','report_date','testing_protocol','batches','shelf_life_months')),
  basis_category text not null check (basis_category in ('MANUFACTURING_RECORDS','PHARMACOPOEIA_OR_MONOGRAPH','REGULATORY_GUIDANCE','LABORATORY_CORRESPONDENCE','OPERATOR_DETERMINATION')),
  basis_note text not null check (length(btrim(basis_note)) between 10 and 2000),
  attested boolean not null check (attested),
  accepted_by uuid not null,
  accepted_at timestamptz not null default now(),
  constraint qc_fact_acceptance_uk unique (binding_id, fact_key)
);

-- 2. Lab decision (issuer -> portal laboratory). Append-only chain per preparation; each new row supersedes the head.
--    R3: PROVISIONALLY_APPROVED is an internal selection only. Legal lab identity and portal eligibility stay unverified
--    (columns pinned false by CHECK; a later gate must add new columns/rows, never flip these).
create table regulatory.eaushadhi_qc_lab_basis (
  lab_basis_id bigint generated always as identity primary key,
  preparation_id uuid not null references regulatory.eaushadhi_qc_preparation(preparation_id) on delete restrict,
  preparation_row_version bigint not null check (preparation_row_version > 0),
  binding_id bigint not null references regulatory.eaushadhi_qc_evidence_binding(binding_id) on delete restrict,
  decision_action text not null check (decision_action in ('INITIAL','CORRECTION','REPLACEMENT','WITHDRAWAL')),
  supersedes_lab_basis_id bigint references regulatory.eaushadhi_qc_lab_basis(lab_basis_id) on delete restrict,
  basis_status text not null check (basis_status in ('PROVISIONALLY_APPROVED','WITHDRAWN')),
  basis_type text not null check (basis_type in ('CROSS_LABORATORY_TIE_UP')),
  issuer_name text not null check (length(btrim(issuer_name)) >= 3),
  portal_option_id bigint not null references regulatory.portal_option(id) on delete restrict,
  portal_external_id text not null,
  portal_lab_label text not null,
  legal_lab_identity_verified boolean not null default false check (legal_lab_identity_verified = false),
  portal_eligibility_verified boolean not null default false check (portal_eligibility_verified = false),
  document_reference text not null check (length(btrim(document_reference)) >= 5),
  document_asset_id bigint references regulatory.document_asset(id) on delete restrict,
  basis_note text not null check (length(btrim(basis_note)) between 10 and 2000),
  attested boolean not null check (attested),
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  constraint qc_lab_basis_chain_ck check ((decision_action='INITIAL') = (supersedes_lab_basis_id is null)),
  constraint qc_lab_basis_withdraw_ck check ((decision_action='WITHDRAWAL') = (basis_status='WITHDRAWN')),
  constraint qc_lab_basis_single_successor_uk unique (supersedes_lab_basis_id)
);
create unique index qc_lab_basis_one_initial_uk on regulatory.eaushadhi_qc_lab_basis(preparation_id) where decision_action='INITIAL';

do $sec$
declare t text;
begin
  foreach t in array array['eaushadhi_qc_fact_acceptance','eaushadhi_qc_lab_basis'] loop
    execute format('alter table regulatory.%I enable row level security', t);
    execute format('revoke all on table regulatory.%I from public, anon, authenticated', t);
    execute format('create trigger %I before update or delete or truncate on regulatory.%I for each statement execute function regulatory.eaushadhi_qc_evidence_binding_immutable()', t||'_immutable', t);
  end loop;
end
$sec$;
revoke all on sequence regulatory.eaushadhi_qc_fact_acceptance_acceptance_id_seq from public, anon, authenticated;
revoke all on sequence regulatory.eaushadhi_qc_lab_basis_lab_basis_id_seq from public, anon, authenticated;

-- 3. Accept an operator-asserted fact (editor). Lock: preparation FOR SHARE only (serialises with verify/reopen).
create function regulatory.eaushadhi_qc_fact_accept_v1(
  p_preparation_id uuid, p_expected_row_version bigint, p_fact_key text, p_basis_category text, p_basis_note text,
  p_attest boolean, p_actor uuid)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_row regulatory.eaushadhi_qc_preparation%rowtype; b regulatory.eaushadhi_qc_evidence_binding%rowtype;
  v_id bigint; v_recheck jsonb;
begin
  if p_actor is null or p_preparation_id is null or p_expected_row_version is null then
    raise exception using errcode='22023', message='Actor, draft ID and version required'; end if;
  select * into v_row from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id for share;
  if not found then raise exception using errcode='P0002', message='QC draft missing'; end if;
  if v_row.row_version is distinct from p_expected_row_version then
    raise exception using errcode='40001', message='Stale QC draft version'; end if;
  if p_attest is distinct from true then raise exception using errcode='23514', message='ATTESTATION_REQUIRED'; end if;
  if length(btrim(coalesce(p_basis_note,''))) not between 10 and 2000 then
    raise exception using errcode='23514', message='BASIS_NOTE_REQUIRED'; end if;
  if p_basis_category is null or p_basis_category not in ('MANUFACTURING_RECORDS','PHARMACOPOEIA_OR_MONOGRAPH','REGULATORY_GUIDANCE','LABORATORY_CORRESPONDENCE','OPERATOR_DETERMINATION') then
    raise exception using errcode='23514', message='BASIS_CATEGORY_INVALID'; end if;
  v_recheck := regulatory.eaushadhi_qc_evidence_recheck_v1(p_preparation_id);
  if (v_recheck->>'valid')::boolean is distinct from true then
    raise exception using errcode='23514', message='EVIDENCE_NOT_VALID'; end if;
  select * into b from regulatory.eaushadhi_qc_evidence_binding where binding_id=(v_recheck->>'binding_id')::bigint;
  if b.preparation_row_version <> v_row.row_version then raise exception using errcode='40001', message='EVIDENCE_NOT_CURRENT'; end if;
  if (b.fact_evidence->p_fact_key) is null then raise exception using errcode='23514', message='FACT_UNKNOWN'; end if;
  if (b.fact_evidence->p_fact_key->>'supported_by_report')::boolean then
    raise exception using errcode='23514', message='FACT_IS_REPORT_SUPPORTED'; end if;
  if exists(select 1 from regulatory.eaushadhi_qc_fact_acceptance a where a.binding_id=b.binding_id and a.fact_key=p_fact_key) then
    raise exception using errcode='23514', message='FACT_ALREADY_ACCEPTED'; end if;
  insert into regulatory.eaushadhi_qc_fact_acceptance(binding_id, preparation_id, fact_key, basis_category, basis_note, attested, accepted_by)
  values (b.binding_id, v_row.preparation_id, p_fact_key, p_basis_category, btrim(p_basis_note), true, p_actor)
  returning acceptance_id into v_id;
  return jsonb_build_object('acceptance_id', v_id, 'binding_id', b.binding_id, 'fact_key', p_fact_key,
    'self_accepted', b.bound_by = p_actor);
end $f$;
revoke all on function regulatory.eaushadhi_qc_fact_accept_v1(uuid,bigint,text,text,text,boolean,uuid) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_fact_accept_v1(uuid,bigint,text,text,text,boolean,uuid) to service_role;

create function public.rpc_eaushadhi_qc_fact_accept_v1(
  p_preparation_id uuid, p_expected_row_version bigint, p_fact_key text, p_basis_category text, p_basis_note text, p_attest boolean)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_actor uuid;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  return regulatory.eaushadhi_qc_fact_accept_v1(p_preparation_id, p_expected_row_version, p_fact_key, p_basis_category, p_basis_note, p_attest, v_actor);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_fact_accept_v1(uuid,bigint,text,text,text,boolean) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_fact_accept_v1(uuid,bigint,text,text,text,boolean) to authenticated, service_role;

-- 4. Record a lab decision (editor). INITIAL / CORRECTION / REPLACEMENT -> PROVISIONALLY_APPROVED; WITHDRAWAL -> WITHDRAWN.
--    Non-initial rows must supersede the current head (no forks). Bound to current prep id + row version + binding.
--    Lock: preparation FOR SHARE, then lab_basis head FOR UPDATE (new table last).
create function regulatory.eaushadhi_qc_lab_decision_record_v1(
  p_preparation_id uuid, p_expected_row_version bigint, p_action text, p_supersedes_lab_basis_id bigint,
  p_basis_type text, p_document_reference text, p_document_asset_id bigint, p_rationale text, p_attest boolean, p_actor uuid)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_row regulatory.eaushadhi_qc_preparation%rowtype; v_opt regulatory.portal_option%rowtype; v_id bigint;
  v_issuer text; v_lab text; v_recheck jsonb; v_bid bigint; v_head regulatory.eaushadhi_qc_lab_basis%rowtype; v_status text;
begin
  if p_actor is null or p_preparation_id is null or p_expected_row_version is null then
    raise exception using errcode='22023', message='Actor, draft ID and version required'; end if;
  select * into v_row from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id for share;
  if not found then raise exception using errcode='P0002', message='QC draft missing'; end if;
  if v_row.row_version is distinct from p_expected_row_version then
    raise exception using errcode='40001', message='Stale QC draft version'; end if;
  if p_attest is distinct from true then raise exception using errcode='23514', message='ATTESTATION_REQUIRED'; end if;
  if p_action is null or p_action not in ('INITIAL','CORRECTION','REPLACEMENT','WITHDRAWAL') then
    raise exception using errcode='23514', message='DECISION_ACTION_INVALID'; end if;
  if p_basis_type is distinct from 'CROSS_LABORATORY_TIE_UP' then raise exception using errcode='23514', message='BASIS_TYPE_INVALID'; end if;
  if length(btrim(coalesce(p_document_reference,''))) < 5 then raise exception using errcode='23514', message='DOCUMENT_REFERENCE_REQUIRED'; end if;
  if length(btrim(coalesce(p_rationale,''))) not between 10 and 2000 then raise exception using errcode='23514', message='RATIONALE_REQUIRED'; end if;
  if p_document_asset_id is not null and not exists(select 1 from regulatory.document_asset da where da.id=p_document_asset_id and da.is_active) then
    raise exception using errcode='23514', message='DOCUMENT_ASSET_INVALID'; end if;
  v_recheck := regulatory.eaushadhi_qc_evidence_recheck_v1(p_preparation_id);
  if (v_recheck->>'valid')::boolean is distinct from true then
    raise exception using errcode='23514', message='EVIDENCE_NOT_VALID'; end if;
  v_bid := (v_recheck->>'binding_id')::bigint;
  if not exists(select 1 from regulatory.eaushadhi_qc_evidence_binding x where x.binding_id=v_bid and x.preparation_row_version=v_row.row_version) then
    raise exception using errcode='40001', message='EVIDENCE_NOT_CURRENT'; end if;
  -- chain head (row without successor), locked
  select * into v_head from regulatory.eaushadhi_qc_lab_basis l
   where l.preparation_id=p_preparation_id
     and not exists(select 1 from regulatory.eaushadhi_qc_lab_basis n where n.supersedes_lab_basis_id=l.lab_basis_id)
   order by l.lab_basis_id desc limit 1 for update;
  if p_action='INITIAL' then
    if v_head.lab_basis_id is not null then raise exception using errcode='23514', message='DECISION_EXISTS_USE_CORRECTION_REPLACEMENT_OR_WITHDRAWAL'; end if;
    if p_supersedes_lab_basis_id is not null then raise exception using errcode='23514', message='INITIAL_CANNOT_SUPERSEDE'; end if;
  else
    if v_head.lab_basis_id is null or p_supersedes_lab_basis_id is distinct from v_head.lab_basis_id then
      raise exception using errcode='40001', message='SUPERSEDES_NOT_CURRENT_HEAD'; end if;
    if p_action='WITHDRAWAL' and v_head.basis_status='WITHDRAWN' then
      raise exception using errcode='23514', message='ALREADY_WITHDRAWN'; end if;
  end if;
  v_status := case when p_action='WITHDRAWAL' then 'WITHDRAWN' else 'PROVISIONALLY_APPROVED' end;
  v_issuer := btrim(coalesce(v_row.draft_payload->>'source_report_issuer',''));
  v_lab := btrim(coalesce(v_row.draft_payload->>'portal_laboratory_candidate',''));
  if v_issuer = '' or v_lab = '' then raise exception using errcode='23514', message='LAB_FIELDS_MISSING'; end if;
  select * into v_opt from regulatory.portal_option o where o.portal_code='E_AUSHADHI' and o.domain_code='QC_LABORATORY'
    and o.is_active and btrim(o.label)=v_lab order by o.id limit 1;
  if not found then raise exception using errcode='23514', message='PORTAL_LAB_NOT_FOUND'; end if;
  insert into regulatory.eaushadhi_qc_lab_basis(preparation_id, preparation_row_version, binding_id, decision_action,
     supersedes_lab_basis_id, basis_status, basis_type, issuer_name, portal_option_id, portal_external_id, portal_lab_label,
     document_reference, document_asset_id, basis_note, attested, recorded_by)
  values (v_row.preparation_id, v_row.row_version, v_bid, p_action, p_supersedes_lab_basis_id, v_status, p_basis_type,
     v_issuer, v_opt.id, v_opt.external_id, v_opt.label, btrim(p_document_reference), p_document_asset_id, btrim(p_rationale), true, p_actor)
  returning lab_basis_id into v_id;
  return jsonb_build_object('lab_basis_id', v_id, 'decision_action', p_action, 'basis_status', v_status,
    'supersedes_lab_basis_id', p_supersedes_lab_basis_id, 'preparation_row_version', v_row.row_version, 'binding_id', v_bid,
    'report_issuer', v_issuer, 'portal_laboratory', v_opt.label, 'portal_external_id', v_opt.external_id,
    'legal_lab_identity_verified', false, 'portal_eligibility_verified', false);
end $f$;
revoke all on function regulatory.eaushadhi_qc_lab_decision_record_v1(uuid,bigint,text,bigint,text,text,bigint,text,boolean,uuid) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_lab_decision_record_v1(uuid,bigint,text,bigint,text,text,bigint,text,boolean,uuid) to service_role;

create function public.rpc_eaushadhi_qc_lab_decision_record_v1(
  p_preparation_id uuid, p_expected_row_version bigint, p_action text, p_supersedes_lab_basis_id bigint,
  p_basis_type text, p_document_reference text, p_document_asset_id bigint, p_rationale text, p_attest boolean)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_actor uuid;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  return regulatory.eaushadhi_qc_lab_decision_record_v1(p_preparation_id, p_expected_row_version, p_action, p_supersedes_lab_basis_id,
    p_basis_type, p_document_reference, p_document_asset_id, p_rationale, p_attest, v_actor);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_lab_decision_record_v1(uuid,bigint,text,bigint,text,text,bigint,text,boolean) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_lab_decision_record_v1(uuid,bigint,text,bigint,text,text,bigint,text,boolean) to authenticated, service_role;

-- 5. Readiness (read-only, derived every call; nothing stored)
create function regulatory.eaushadhi_qc_readiness_v1(p_preparation_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public','regulatory','extensions','pg_temp' as $f$
declare p regulatory.eaushadhi_qc_preparation%rowtype; v_re jsonb; b regulatory.eaushadhi_qc_evidence_binding%rowtype;
  v_reasons text[] := '{}'; v_supported text[] := '{}'; v_asserted jsonb := '[]'; v_fact text; v_acc regulatory.eaushadhi_qc_fact_acceptance%rowtype;
  lb regulatory.eaushadhi_qc_lab_basis%rowtype; v_lab jsonb := null; v_acc_ids bigint[] := '{}'; v_flags text[] := '{}';
  v_provisional boolean := false;
begin
  select * into p from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id;
  if not found then return jsonb_build_object('status','NOT_READY','reasons',jsonb_build_array('PREPARATION_MISSING'),'checked_at',now()); end if;
  v_re := regulatory.eaushadhi_qc_evidence_recheck_v1(p_preparation_id);
  if (v_re->>'valid')::boolean is distinct from true then
    select array_agg('EVIDENCE_'||x) into v_reasons from jsonb_array_elements_text(v_re->'reasons') x;
    v_reasons := coalesce(v_reasons, array['EVIDENCE_NOT_VALID']);
  else
    select * into b from regulatory.eaushadhi_qc_evidence_binding where binding_id=(v_re->>'binding_id')::bigint;
    if encode(extensions.digest(convert_to(p.draft_payload::text,'UTF8'),'sha256'),'hex') is distinct from b.verified_payload_hash then
      v_reasons := array_append(v_reasons,'PAYLOAD_DRIFT_SINCE_VERIFY'); end if;
    foreach v_fact in array array['study_start_date','study_end_date','report_date','testing_protocol','batches','shelf_life_months'] loop
      if (b.fact_evidence->v_fact->>'supported_by_report')::boolean then
        v_supported := array_append(v_supported, v_fact);
      else
        select * into v_acc from regulatory.eaushadhi_qc_fact_acceptance a where a.binding_id=b.binding_id and a.fact_key=v_fact;
        if not found then
          v_reasons := array_append(v_reasons, 'FACT_ACCEPTANCE_MISSING_'||upper(v_fact));
          v_asserted := v_asserted || jsonb_build_array(jsonb_build_object('fact',v_fact,'accepted',false,'note',b.fact_evidence->v_fact->>'evidence_note'));
        else
          v_acc_ids := array_append(v_acc_ids, v_acc.acceptance_id);
          if v_acc.accepted_by = b.bound_by then
            v_flags := array_append(v_flags, 'SELF_ACCEPTED_'||upper(v_fact));
            v_reasons := array_append(v_reasons, 'FACT_SELF_ACCEPTED_'||upper(v_fact));  -- R2: blocking; needs a distinct editor
          end if;
          v_asserted := v_asserted || jsonb_build_array(jsonb_build_object('fact',v_fact,'accepted',true,
            'acceptance_id',v_acc.acceptance_id,'basis_category',v_acc.basis_category,'self_accepted',v_acc.accepted_by=b.bound_by,
            'accepted_by',v_acc.accepted_by,'accepted_at',v_acc.accepted_at));
        end if;
      end if;
    end loop;
  end if;
  -- lab governance (outsourced QC only). Head of the decision chain governs.
  if coalesce(p.draft_payload->>'quality_control_mode','') = 'OUT' then
    select * into lb from regulatory.eaushadhi_qc_lab_basis l where l.preparation_id=p.preparation_id
      and not exists(select 1 from regulatory.eaushadhi_qc_lab_basis n where n.supersedes_lab_basis_id=l.lab_basis_id)
      order by l.lab_basis_id desc limit 1;
    if not found then v_reasons := array_append(v_reasons,'LAB_DECISION_MISSING');
    else
      v_lab := jsonb_build_object('lab_basis_id',lb.lab_basis_id,'decision_action',lb.decision_action,
        'supersedes_lab_basis_id',lb.supersedes_lab_basis_id,'internal_selection',lb.basis_status,'basis_type',lb.basis_type,
        'report_issuer',lb.issuer_name,'portal_laboratory',lb.portal_lab_label,'portal_external_id',lb.portal_external_id,
        'legal_lab_identity_verified',lb.legal_lab_identity_verified,'portal_eligibility_verified',lb.portal_eligibility_verified,
        'issuer_equals_portal_laboratory', null,
        'statement','Portal laboratory is an internal provisional selection. It is not the report issuer, and the two have not been verified as the same legal laboratory.',
        'binding_id',lb.binding_id,'preparation_row_version',lb.preparation_row_version,'recorded_by',lb.recorded_by,'recorded_at',lb.recorded_at,
        'rationale',lb.basis_note,'document_reference',lb.document_reference);
      if lb.basis_status = 'WITHDRAWN' then v_reasons := array_append(v_reasons,'LAB_DECISION_WITHDRAWN');
      elsif lb.basis_status = 'PROVISIONALLY_APPROVED' then v_provisional := true; end if;
      if b.binding_id is null or lb.binding_id is distinct from b.binding_id or lb.preparation_row_version is distinct from p.row_version then
        v_reasons := array_append(v_reasons,'LAB_DECISION_STALE_BINDING'); end if;
      if lb.issuer_name is distinct from btrim(coalesce(p.draft_payload->>'source_report_issuer',''))
         or lb.portal_lab_label is distinct from btrim(coalesce(p.draft_payload->>'portal_laboratory_candidate','')) then
        v_reasons := array_append(v_reasons,'LAB_DECISION_STALE_FIELDS'); end if;
      if not exists(select 1 from regulatory.portal_option o where o.id=lb.portal_option_id and o.is_active
           and btrim(o.label)=lb.portal_lab_label and o.external_id=lb.portal_external_id) then
        v_reasons := array_append(v_reasons,'LAB_PORTAL_OPTION_INACTIVE'); end if;
      if lb.document_asset_id is not null and not exists(select 1 from regulatory.document_asset da where da.id=lb.document_asset_id and da.is_active) then
        v_reasons := array_append(v_reasons,'LAB_BASIS_DOCUMENT_INACTIVE'); end if;
    end if;
  end if;
  if v_provisional then v_flags := array_append(v_flags,'LAB_PROVISIONAL_LEGAL_IDENTITY_UNVERIFIED'); end if;
  return jsonb_build_object(
    'status', case when cardinality(v_reasons)>0 then 'NOT_READY' when v_provisional then 'READY_PROVISIONAL' else 'READY' end,
    'reasons', to_jsonb(v_reasons), 'flags', to_jsonb(v_flags),
    'preparation_id', p.preparation_id, 'preparation_row_version', p.row_version,
    'binding_id', b.binding_id, 'verified_by', b.bound_by, 'verified_at', b.bound_at, 'evidence_valid', (v_re->>'valid')::boolean,
    'report_supported_facts', to_jsonb(v_supported), 'operator_asserted_facts', v_asserted,
    'lab_basis', v_lab,
    'readiness_tuple', encode(extensions.digest(convert_to(jsonb_build_object('p',p.preparation_id,'rv',p.row_version,'b',b.binding_id,
       'acc',to_jsonb(v_acc_ids),'lab',lb.lab_basis_id,'sha',b.verified_sha256,'objver',b.storage_object_version)::text,'UTF8'),'sha256'),'hex'),
    'canonical_promotion', 'BLOCKED_OUT_OF_SCOPE_B4', 'portal_submission', 'NOT_PART_OF_READINESS',
    'checked_at', now());
end $f$;
revoke all on function regulatory.eaushadhi_qc_readiness_v1(uuid) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_readiness_v1(uuid) to service_role;

create function public.rpc_eaushadhi_qc_readiness_v1(p_product_id integer, p_preparation_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
begin
  perform public.rpc_eaushadhi_require_permission(false);
  if not exists(select 1 from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id and product_id=p_product_id) then
    raise exception using errcode='P0002', message='QC draft not found for product'; end if;
  return regulatory.eaushadhi_qc_readiness_v1(p_preparation_id);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_readiness_v1(integer,uuid) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_readiness_v1(integer,uuid) to authenticated, service_role;

-- 6a. Snapshot document guard (R2): safe cast; only the CURRENT, non-superseded binding of a B4-READY preparation counts
create function regulatory.eaushadhi_qc_snapshot_doc_guard_v1(p_document jsonb) returns text
language plpgsql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_id_txt text := btrim(coalesce(p_document->>'document_asset_id','')); v_id bigint; v_sha text;
  qb regulatory.eaushadhi_qc_evidence_binding%rowtype; v_r jsonb;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object' then return 'QC_DOCUMENT_MISSING'; end if;
  if v_id_txt !~ '^[0-9]{1,18}$' then return 'QC_DOCUMENT_ID_INVALID'; end if;
  v_id := v_id_txt::bigint;
  v_sha := btrim(coalesce(p_document->>'content_sha256',''));
  if v_sha !~ '^[0-9a-f]{64}$' then return 'QC_DOCUMENT_SHA_INVALID'; end if;
  for qb in select * from regulatory.eaushadhi_qc_evidence_binding x
            where x.document_asset_id=v_id and x.verified_sha256=v_sha
              and not exists(select 1 from regulatory.eaushadhi_qc_evidence_supersession s where s.binding_id=x.binding_id)
            order by x.binding_id desc loop
    v_r := regulatory.eaushadhi_qc_readiness_v1(qb.preparation_id);
    if (v_r->>'status')='READY' and (v_r->>'binding_id')::bigint=qb.binding_id then return null; end if;
  end loop;
  return 'QC_EVIDENCE_NOT_B4_READY';
exception when others then
  return 'QC_EVIDENCE_GUARD_ERROR';
end $f$;
revoke all on function regulatory.eaushadhi_qc_snapshot_doc_guard_v1(jsonb) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_snapshot_doc_guard_v1(jsonb) to service_role;

-- 6. Correct the legacy QC snapshot: a claimed content_sha256 no longer counts as a frozen report
CREATE OR REPLACE FUNCTION regulatory.eaushadhi_qc_snapshot_v1(p_product_id integer, p_expected_workflow_row_version bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'extensions', 'pg_temp'
AS $function$
declare
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_comp regulatory.eaushadhi_composition_stage%rowtype;
  v_records jsonb := '[]'::jsonb;
  v_record jsonb;
  v_reasons text[] := array[]::text[];
  v_ids jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_hash text;
  v_guard text;
begin
  if p_product_id is null or p_product_id<=0 then
    raise exception using errcode='22023',message='Product ID must be positive';
  end if;
  if p_expected_workflow_row_version is null or p_expected_workflow_row_version<=0 then
    raise exception using errcode='22023',message='Expected workflow row version must be positive';
  end if;

  select * into v_workflow from regulatory.eaushadhi_product_workflow where product_id=p_product_id;
  if not found then raise exception using errcode='P0002',message='e-Aushadhi product workflow not found'; end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then raise exception using errcode='40001',message='Stale workflow row version'; end if;
  if v_workflow.entry_status is distinct from 'PORTAL_VERIFIED' then v_reasons:=array_append(v_reasons,'PRODUCT_DETAILS_NOT_PORTAL_VERIFIED'); end if;
  if nullif(btrim(coalesce(v_workflow.portal_product_ref,'')),'') is null then v_reasons:=array_append(v_reasons,'PORTAL_PRODUCT_REF_MISSING'); end if;

  select * into v_comp from regulatory.eaushadhi_composition_stage where product_id=p_product_id;
  if not found or v_comp.stage_status is distinct from 'PORTAL_VERIFIED' then v_reasons:=array_append(v_reasons,'COMPOSITION_NOT_PORTAL_VERIFIED'); end if;

  for v_record in
    select jsonb_build_object(
      'stability_study_id',s.id,
      'product_id',s.product_id,
      'protocol',jsonb_build_object(
        'controlled_term_id',ct.id,'code',ct.code,'label',ct.label,
        'mapping_status',coalesce(pm.mapping_status,'MISSING'),
        'portal_option_id',po.id,'portal_external_id',po.external_id,'portal_label',po.label
      ),
      'other_testing_protocol_text',s.other_testing_protocol_text,
      'study_start_date',s.study_start_date,
      'study_end_date',s.study_end_date,
      'shelf_life_months',s.shelf_life_months,
      'batch_numbers',coalesce(b.batches,'[]'::jsonb),
      'portal_batch_text',s.portal_batch_text,
      'report_date',s.report_date,
      'quality_control_mode',s.quality_control_mode,
      'approved_laboratory_id',s.approved_laboratory_id,
      'laboratory_mapping',case when s.quality_control_mode='OUT' then
        jsonb_build_object('mapping_status',coalesce(lm.mapping_status,'MISSING'),'portal_external_id',lm.portal_external_id,'portal_label',lm.portal_label)
        else null end,
      'document',case when d.document_count=1 then d.document_payload else null end,
      'document_count',coalesce(d.document_count,0),
      'source_status',s.status
    )
    from regulatory.stability_study s
    join regulatory.controlled_term ct on ct.id=s.testing_protocol_term_id
    left join lateral (
      select m.mapping_status,m.portal_option_id
      from regulatory.term_portal_mapping m
      where m.controlled_term_id=ct.id and m.portal_code='E_AUSHADHI'
        and m.mapping_status='VERIFIED'
        and (m.effective_from is null or m.effective_from<=current_date)
        and (m.effective_to is null or m.effective_to>=current_date)
      order by m.verified_at desc nulls last,m.id desc limit 1
    ) pm on true
    left join regulatory.portal_option po on po.id=pm.portal_option_id and po.portal_code='E_AUSHADHI'
      and po.domain_code='QC_PROTOCOL' and po.is_active=true
    left join lateral (
      select jsonb_agg(jsonb_build_object('sequence_no',sb.sequence_no,'bmr_id',sb.bmr_id,'batch_no',sb.batch_no) order by sb.sequence_no) batches
      from regulatory.stability_study_batch sb where sb.study_id=s.id
    ) b on true
    left join lateral (
      select count(*)::integer document_count,
             case when count(*)=1 then (jsonb_agg(jsonb_build_object(
               'document_asset_id',da.id,'document_purpose',sd.document_purpose,'storage_bucket',da.storage_bucket,
               'storage_path',da.storage_path,'original_file_name',da.original_file_name,'mime_type',da.mime_type,
               'content_sha256',da.content_sha256,'generation_status',da.generation_status,'is_active',da.is_active
             )) -> 0) else null end document_payload
      from regulatory.stability_study_document sd
      join regulatory.document_asset da on da.id=sd.document_asset_id
      where sd.study_id=s.id and sd.is_current=true and da.is_active=true
        and sd.document_purpose in ('TEST_REPORT','PORTAL_UPLOAD_ARTIFACT')
    ) d on true
    left join lateral (
      select m.mapping_status,m.portal_external_id,m.portal_label
      from regulatory.eaushadhi_qc_laboratory_mapping m
      where m.approved_laboratory_id=s.approved_laboratory_id and m.mapping_status='VERIFIED'
      order by m.verified_at desc nulls last,m.id desc limit 1
    ) lm on true
    where s.product_id=p_product_id and s.status in ('VERIFIED','READY','PORTAL_ENTERED')
    order by s.id
  loop
    v_count:=v_count+1;
    v_ids:=v_ids||jsonb_build_array((v_record->>'stability_study_id')::bigint);
    if coalesce(v_record#>>'{protocol,mapping_status}','')<>'VERIFIED'
       or nullif(v_record#>>'{protocol,portal_external_id}','') is null then
      v_reasons:=array_append(v_reasons,format('STUDY_%s_PROTOCOL_MAPPING_NOT_VERIFIED',v_record->>'stability_study_id'));
    end if;
    if coalesce(v_record#>>'{protocol,code}','')='OTHER'
       and nullif(btrim(coalesce(v_record->>'other_testing_protocol_text','')),'') is null then
      v_reasons:=array_append(v_reasons,format('STUDY_%s_OTHER_PROTOCOL_TEXT_MISSING',v_record->>'stability_study_id'));
    end if;
    if jsonb_array_length(coalesce(v_record->'batch_numbers','[]'::jsonb))=0
       and nullif(btrim(coalesce(v_record->>'portal_batch_text','')),'') is null then
      v_reasons:=array_append(v_reasons,format('STUDY_%s_BATCH_MISSING',v_record->>'stability_study_id'));
    end if;
    if coalesce((v_record->>'document_count')::integer,0)<>1
       or nullif(v_record#>>'{document,content_sha256}','') is null then
      v_reasons:=array_append(v_reasons,format('STUDY_%s_TEST_REPORT_NOT_FROZEN',v_record->>'stability_study_id'));
    end if;
    -- B4 R2: a claimed content_sha256 is not enough (helper never raises; any doubt -> blocking reason)
    v_guard := regulatory.eaushadhi_qc_snapshot_doc_guard_v1(v_record->'document');
    if v_guard is not null then
      v_reasons:=array_append(v_reasons,format('STUDY_%s_%s',v_record->>'stability_study_id',v_guard));
    end if;
    if coalesce(v_record->>'quality_control_mode','')='OUT'
       and coalesce(v_record#>>'{laboratory_mapping,mapping_status}','')<>'VERIFIED' then
      v_reasons:=array_append(v_reasons,format('STUDY_%s_LAB_MAPPING_NOT_VERIFIED',v_record->>'stability_study_id'));
    end if;
    v_records:=v_records||jsonb_build_array(v_record);
  end loop;

  if v_count=0 then v_reasons:=array_append(v_reasons,'NO_GOVERNED_QC_RECORDS'); end if;

  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'product_id',p_product_id,'workflow_row_version',v_workflow.row_version,
    'composition_stage_row_version',case when v_comp.product_id is null then null else v_comp.row_version end,
    'records',v_records
  )::text,'UTF8'),'sha256'),'hex');

  return jsonb_build_object(
    'product_id',p_product_id,'workflow_row_version',v_workflow.row_version,
    'product_entry_status',v_workflow.entry_status,
    'composition_stage_status',case when v_comp.product_id is null then null else v_comp.stage_status end,
    'composition_stage_row_version',case when v_comp.product_id is null then null else v_comp.row_version end,
    'portal_product_ref',v_workflow.portal_product_ref,'content_hash',v_hash,
    'qc_records',v_records,'governed_record_ids',v_ids,'governed_record_count',v_count,
    'ready',coalesce(array_length(v_reasons,1),0)=0,'reasons',to_jsonb(v_reasons)
  );
end
$function$;
