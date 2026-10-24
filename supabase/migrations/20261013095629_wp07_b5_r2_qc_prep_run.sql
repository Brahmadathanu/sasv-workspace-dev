-- WP-07 B5 R2.4 (candidate; NOT applied; R2.1 = frozen values keyed exactly as portal qcdetails; R2.2 = compact batchNo, derived-fact flag + arm acknowledgement; R2.3 = single-use pre-save token, row vs document verification, qualification in every event; R2.4 = no client document evidence; FULLY_VERIFIED only via service-role trusted-fetch recorder). Proposed name: <apply-version>_wp07_b5_r2_qc_prep_run.sql
-- A. Audited correction of operator-asserted fact acceptances (originals retained; head of chain governs readiness).
--    Adds basis category OPERATOR_DERIVATION (fact derived by the operator by a stated rule from documentary data).
-- B. Governed VERIFY for QC_PROTOCOL term->portal mappings (the existing reference verify RPC refuses QC_PROTOCOL).
-- C. Preparation-based portal QC run: preflight (read-only), arm, pre-save recheck, record save (Save only, Submit
--    refused), operator resolution of AMBIGUOUS (no automatic retry), row verification. Append-only fill log.
-- No data changes, no canonical stability-study writes, no portal actions, no qc_stage writes.

do $pre$
begin
  if to_regprocedure('regulatory.eaushadhi_qc_readiness_v1(uuid)') is null then raise exception 'B5R2 preflight: B4 missing'; end if;
  if to_regclass('regulatory.eaushadhi_qc_prep_run') is not null then raise exception 'B5R2 preflight: already applied'; end if;
end
$pre$;

-- A1. Correction chain on fact acceptance (ALTER only; existing rows untouched; immutability trigger unchanged)
alter table regulatory.eaushadhi_qc_fact_acceptance
  add column supersedes_acceptance_id bigint references regulatory.eaushadhi_qc_fact_acceptance(acceptance_id) on delete restrict,
  add column correction_reason text;
alter table regulatory.eaushadhi_qc_fact_acceptance drop constraint eaushadhi_qc_fact_acceptance_basis_category_check;
alter table regulatory.eaushadhi_qc_fact_acceptance add constraint eaushadhi_qc_fact_acceptance_basis_category_check
  check (basis_category in ('MANUFACTURING_RECORDS','PHARMACOPOEIA_OR_MONOGRAPH','REGULATORY_GUIDANCE','LABORATORY_CORRESPONDENCE','OPERATOR_DETERMINATION','OPERATOR_DERIVATION'));
alter table regulatory.eaushadhi_qc_fact_acceptance add constraint qc_fact_acceptance_correction_ck
  check ((supersedes_acceptance_id is null) = (correction_reason is null)
         and (correction_reason is null or length(btrim(correction_reason)) between 10 and 2000));
alter table regulatory.eaushadhi_qc_fact_acceptance drop constraint qc_fact_acceptance_uk;
create unique index qc_fact_acceptance_one_original_uk on regulatory.eaushadhi_qc_fact_acceptance(binding_id, fact_key) where supersedes_acceptance_id is null;
create unique index qc_fact_acceptance_single_successor_uk on regulatory.eaushadhi_qc_fact_acceptance(supersedes_acceptance_id) where supersedes_acceptance_id is not null;

-- A2. Original acceptance: same contract as B4, plus OPERATOR_DERIVATION
create or replace function regulatory.eaushadhi_qc_fact_accept_v1(
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
  if p_basis_category is null or p_basis_category not in ('MANUFACTURING_RECORDS','PHARMACOPOEIA_OR_MONOGRAPH','REGULATORY_GUIDANCE','LABORATORY_CORRESPONDENCE','OPERATOR_DETERMINATION','OPERATOR_DERIVATION') then
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

-- A3. Correction: a NEW row that supersedes the current head on the CURRENT binding. Never updates the original.
--     Lock: preparation FOR SHARE only (same as accept). Forks are impossible (unique successor index -> 40001).
create function regulatory.eaushadhi_qc_fact_acceptance_correct_v1(
  p_preparation_id uuid, p_expected_row_version bigint, p_supersedes_acceptance_id bigint, p_basis_category text,
  p_basis_note text, p_correction_reason text, p_attest boolean, p_actor uuid)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_row regulatory.eaushadhi_qc_preparation%rowtype; b regulatory.eaushadhi_qc_evidence_binding%rowtype;
  o regulatory.eaushadhi_qc_fact_acceptance%rowtype; v_id bigint; v_recheck jsonb;
begin
  if p_actor is null or p_preparation_id is null or p_expected_row_version is null or p_supersedes_acceptance_id is null then
    raise exception using errcode='22023', message='Actor, draft ID, version and superseded acceptance required'; end if;
  select * into v_row from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id for share;
  if not found then raise exception using errcode='P0002', message='QC draft missing'; end if;
  if v_row.row_version is distinct from p_expected_row_version then
    raise exception using errcode='40001', message='Stale QC draft version'; end if;
  if p_attest is distinct from true then raise exception using errcode='23514', message='ATTESTATION_REQUIRED'; end if;
  if length(btrim(coalesce(p_basis_note,''))) not between 10 and 2000 then
    raise exception using errcode='23514', message='BASIS_NOTE_REQUIRED'; end if;
  if length(btrim(coalesce(p_correction_reason,''))) not between 10 and 2000 then
    raise exception using errcode='23514', message='CORRECTION_REASON_REQUIRED'; end if;
  if p_basis_category is null or p_basis_category not in ('MANUFACTURING_RECORDS','PHARMACOPOEIA_OR_MONOGRAPH','REGULATORY_GUIDANCE','LABORATORY_CORRESPONDENCE','OPERATOR_DETERMINATION','OPERATOR_DERIVATION') then
    raise exception using errcode='23514', message='BASIS_CATEGORY_INVALID'; end if;
  v_recheck := regulatory.eaushadhi_qc_evidence_recheck_v1(p_preparation_id);
  if (v_recheck->>'valid')::boolean is distinct from true then
    raise exception using errcode='23514', message='EVIDENCE_NOT_VALID'; end if;
  select * into b from regulatory.eaushadhi_qc_evidence_binding where binding_id=(v_recheck->>'binding_id')::bigint;
  if b.preparation_row_version <> v_row.row_version then raise exception using errcode='40001', message='EVIDENCE_NOT_CURRENT'; end if;
  select * into o from regulatory.eaushadhi_qc_fact_acceptance where acceptance_id=p_supersedes_acceptance_id;
  if not found or o.preparation_id <> p_preparation_id then raise exception using errcode='P0002', message='ACCEPTANCE_NOT_FOUND'; end if;
  if o.binding_id <> b.binding_id then raise exception using errcode='23514', message='ACCEPTANCE_NOT_ON_CURRENT_BINDING'; end if;
  if exists(select 1 from regulatory.eaushadhi_qc_fact_acceptance n where n.supersedes_acceptance_id=o.acceptance_id) then
    raise exception using errcode='40001', message='ACCEPTANCE_ALREADY_SUPERSEDED'; end if;
  begin
    insert into regulatory.eaushadhi_qc_fact_acceptance(binding_id, preparation_id, fact_key, basis_category, basis_note, attested, accepted_by,
      supersedes_acceptance_id, correction_reason)
    values (b.binding_id, v_row.preparation_id, o.fact_key, p_basis_category, btrim(p_basis_note), true, p_actor,
      o.acceptance_id, btrim(p_correction_reason))
    returning acceptance_id into v_id;
  exception when unique_violation then
    raise exception using errcode='40001', message='ACCEPTANCE_ALREADY_SUPERSEDED';
  end;
  return jsonb_build_object('acceptance_id', v_id, 'supersedes_acceptance_id', o.acceptance_id, 'binding_id', b.binding_id,
    'fact_key', o.fact_key, 'self_accepted', b.bound_by = p_actor);
end $f$;
revoke all on function regulatory.eaushadhi_qc_fact_acceptance_correct_v1(uuid,bigint,bigint,text,text,text,boolean,uuid) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_fact_acceptance_correct_v1(uuid,bigint,bigint,text,text,text,boolean,uuid) to service_role;

create function public.rpc_eaushadhi_qc_fact_acceptance_correct_v1(
  p_preparation_id uuid, p_expected_row_version bigint, p_supersedes_acceptance_id bigint, p_basis_category text,
  p_basis_note text, p_correction_reason text, p_attest boolean)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_actor uuid;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  return regulatory.eaushadhi_qc_fact_acceptance_correct_v1(p_preparation_id, p_expected_row_version, p_supersedes_acceptance_id,
    p_basis_category, p_basis_note, p_correction_reason, p_attest, v_actor);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_fact_acceptance_correct_v1(uuid,bigint,bigint,text,text,text,boolean) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_fact_acceptance_correct_v1(uuid,bigint,bigint,text,text,text,boolean) to authenticated, service_role;

-- A4. Readiness: head of each acceptance chain governs; output exposes note, correction link and chain length
create or replace function regulatory.eaushadhi_qc_readiness_v1(p_preparation_id uuid) returns jsonb
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
        -- B5 R2: the HEAD of the correction chain governs (originals retained, never overwritten)
        select * into v_acc from regulatory.eaushadhi_qc_fact_acceptance a where a.binding_id=b.binding_id and a.fact_key=v_fact
          and not exists(select 1 from regulatory.eaushadhi_qc_fact_acceptance n where n.supersedes_acceptance_id=a.acceptance_id)
          order by a.acceptance_id desc limit 1;
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
            'accepted_by',v_acc.accepted_by,'accepted_at',v_acc.accepted_at,'basis_note',v_acc.basis_note,
            'supersedes_acceptance_id',v_acc.supersedes_acceptance_id,'correction_reason',v_acc.correction_reason,
            'chain_length',(select count(*) from regulatory.eaushadhi_qc_fact_acceptance c where c.binding_id=b.binding_id and c.fact_key=v_fact)));
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

-- B. Governed VERIFY of a QC_PROTOCOL term -> e-Aushadhi portal option mapping (DRAFT -> VERIFIED only; editor; attested).
--    The existing rpc_eaushadhi_reference_mapping_verify only accepts REFERENCE_WORK terms. The captured option is
--    verified as-is (no re-pointing). One current VERIFIED mapping per QC_PROTOCOL term (checked under a term lock).
--    The table's existing audit trigger records the change.
create function public.rpc_eaushadhi_qc_protocol_mapping_verify_v1(
  p_mapping_id bigint, p_expected_status text, p_expected_portal_option_id bigint, p_mapping_reason text, p_attest boolean)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_actor uuid; m regulatory.term_portal_mapping%rowtype; t regulatory.controlled_term%rowtype; o regulatory.portal_option%rowtype;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  if p_attest is distinct from true then raise exception using errcode='23514', message='ATTESTATION_REQUIRED'; end if;
  if length(btrim(coalesce(p_mapping_reason,''))) not between 10 and 2000 then
    raise exception using errcode='23514', message='MAPPING_REASON_REQUIRED'; end if;
  select * into m from regulatory.term_portal_mapping where id=p_mapping_id for update;
  if not found then raise exception using errcode='P0002', message='MAPPING_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext('eaushadhi_qc_protocol_mapping'), m.controlled_term_id::int);
  if m.mapping_status is distinct from upper(btrim(coalesce(p_expected_status,''))) then
    raise exception using errcode='40001', message='MAPPING_STATE_CHANGED'; end if;
  if m.mapping_status <> 'DRAFT' then raise exception using errcode='22023', message='ONLY_DRAFT_CAN_BE_VERIFIED'; end if;
  if m.portal_option_id is distinct from p_expected_portal_option_id then
    raise exception using errcode='40001', message='MAPPING_OPTION_CHANGED'; end if;
  if m.portal_code <> 'E_AUSHADHI' or (m.effective_from is not null and m.effective_from > now())
     or (m.effective_to is not null and m.effective_to <= now()) then
    raise exception using errcode='22023', message='MAPPING_NOT_CURRENT'; end if;
  select * into t from regulatory.controlled_term where id=m.controlled_term_id;
  if t.domain_code <> 'QC_PROTOCOL' or not t.is_active then raise exception using errcode='22023', message='TERM_NOT_ACTIVE_QC_PROTOCOL'; end if;
  select * into o from regulatory.portal_option where id=m.portal_option_id;
  if o.portal_code <> 'E_AUSHADHI' or o.domain_code <> 'QC_PROTOCOL' or not o.is_active or o.external_id = '-1' then
    raise exception using errcode='22023', message='OPTION_NOT_ACTIVE_QC_PROTOCOL'; end if;
  if exists(select 1 from regulatory.term_portal_mapping x where x.controlled_term_id=m.controlled_term_id and x.id<>m.id
            and x.portal_code='E_AUSHADHI' and x.mapping_status='VERIFIED'
            and (x.effective_from is null or x.effective_from <= now()) and (x.effective_to is null or x.effective_to > now())) then
    raise exception using errcode='23505', message='TERM_ALREADY_HAS_VERIFIED_MAPPING'; end if;
  update regulatory.term_portal_mapping set mapping_status='VERIFIED', verified_by=v_actor, verified_at=now(),
    mapping_reason=btrim(p_mapping_reason),
    comparison_evidence=coalesce(comparison_evidence,'{}'::jsonb)||jsonb_build_object('verification_mode','QC_PROTOCOL_GOVERNED_V1','attested',true)
  where id=m.id;
  return jsonb_build_object('mapping_id',m.id,'mapping_status','VERIFIED','term_code',t.code,'portal_external_id',o.external_id,
    'portal_label',o.label,'verified_by',v_actor);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_protocol_mapping_verify_v1(bigint,text,bigint,text,boolean) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_protocol_mapping_verify_v1(bigint,text,bigint,text,boolean) to authenticated, service_role;

-- C1. Preparation-based run (state machine) and append-only fill log. No client table access.
create table regulatory.eaushadhi_qc_prep_run (
  run_id uuid primary key default gen_random_uuid(),
  product_id integer not null,
  preparation_id uuid not null references regulatory.eaushadhi_qc_preparation(preparation_id) on delete restrict,
  preparation_row_version bigint not null,
  binding_id bigint not null references regulatory.eaushadhi_qc_evidence_binding(binding_id) on delete restrict,
  readiness_status text not null check (readiness_status in ('READY_PROVISIONAL','READY')),
  readiness_tuple text not null check (readiness_tuple ~ '^[0-9a-f]{64}$'),
  readiness_snapshot jsonb not null,
  lab_basis_id bigint references regulatory.eaushadhi_qc_lab_basis(lab_basis_id) on delete restrict,
  provisional_lab boolean not null,
  provisional_ack_note text,
  protocol_mapping_id bigint not null references regulatory.term_portal_mapping(id) on delete restrict,
  projection jsonb not null,
  projection_sha256 text not null,
  run_status text not null check (run_status in ('SAVE_ARMED','PRE_SAVE_ABORTED','SAVE_CONFIRMED','SAVE_AMBIGUOUS','SAVE_UNAUTHORIZED','SAVE_FOUND_UNAUTHORIZED',
    'SAVE_REJECTED','SAVE_NOT_SAVED','ROW_MISMATCH','ROW_VERIFIED_DOCUMENT_NOT_VERIFIED','DOCUMENT_MISMATCH','FULLY_VERIFIED')),
  -- R2.3: lab/readiness qualification copied into every log entry and every RPC result
  qualification jsonb not null,
  page_identity_evidence jsonb not null,
  before_list_evidence jsonb not null,
  pre_save_ok_at timestamptz,
  pre_save_token uuid,                      -- R2.3: single-use; latest pre-save only
  pre_save_tuple text,
  pre_save_token_consumed_at timestamptz,
  document_evidence jsonb,
  save_outcome text check (save_outcome in ('CONFIRMED','AMBIGUOUS','REJECTED')),
  resolved_portal_row_id text,
  armed_by uuid not null, armed_at timestamptz not null default now(),
  updated_by uuid not null, updated_at timestamptz not null default now(),
  derived_facts jsonb not null default '[]'::jsonb,
  derived_fact_ack_note text,
  constraint qc_prep_run_derived_ack_ck check (jsonb_array_length(derived_facts) = 0 or length(btrim(coalesce(derived_fact_ack_note,''))) between 10 and 2000),
  constraint qc_prep_run_provisional_ack_ck check (provisional_lab = false or length(btrim(coalesce(provisional_ack_note,''))) between 10 and 2000)
);
create unique index qc_prep_run_one_active_uk on regulatory.eaushadhi_qc_prep_run(product_id)
  where run_status in ('SAVE_ARMED','SAVE_CONFIRMED','SAVE_AMBIGUOUS','SAVE_UNAUTHORIZED','SAVE_FOUND_UNAUTHORIZED','ROW_MISMATCH','DOCUMENT_MISMATCH');

create table regulatory.eaushadhi_qc_prep_fill_log (
  log_id bigint generated always as identity primary key,
  run_id uuid not null references regulatory.eaushadhi_qc_prep_run(run_id) on delete restrict,
  step text not null check (step in ('ARMED','PRE_SAVE_OK','PRE_SAVE_REFUSED','SAVE_RECORDED','SAVE_RECORDED_UNAUTHORIZED','AMBIGUOUS_RESOLVED','ROW_MISMATCH','ROW_VERIFIED_DOCUMENT_NOT_VERIFIED','DOCUMENT_MISMATCH','FULLY_VERIFIED')),
  run_status_after text not null,
  payload jsonb not null,
  payload_sha256 text not null,
  actor uuid not null,
  logged_at timestamptz not null default now()
);
create index qc_prep_fill_log_run_ix on regulatory.eaushadhi_qc_prep_fill_log(run_id, log_id);

do $sec$
begin
  alter table regulatory.eaushadhi_qc_prep_run enable row level security;
  alter table regulatory.eaushadhi_qc_prep_fill_log enable row level security;
  revoke all on table regulatory.eaushadhi_qc_prep_run from public, anon, authenticated;
  revoke all on table regulatory.eaushadhi_qc_prep_fill_log from public, anon, authenticated;
  create trigger eaushadhi_qc_prep_fill_log_immutable before update or delete or truncate on regulatory.eaushadhi_qc_prep_fill_log
    for each statement execute function regulatory.eaushadhi_qc_evidence_binding_immutable();
  create trigger eaushadhi_qc_prep_run_no_delete before delete or truncate on regulatory.eaushadhi_qc_prep_run
    for each statement execute function regulatory.eaushadhi_qc_evidence_binding_immutable();
end
$sec$;
revoke all on sequence regulatory.eaushadhi_qc_prep_fill_log_log_id_seq from public, anon, authenticated;

create function regulatory.eaushadhi_qc_prep_log_v1(p_run_id uuid, p_step text, p_status text, p_payload jsonb, p_actor uuid)
returns void language plpgsql security definer set search_path to 'public','regulatory','extensions','pg_temp' as $f$
declare v jsonb;
begin
  -- R2.3: every entry carries the run's readiness/lab qualification (never implies legal lab verification)
  v := coalesce(p_payload,'{}'::jsonb) || jsonb_build_object('qualification',
         (select qualification from regulatory.eaushadhi_qc_prep_run where run_id=p_run_id));
  insert into regulatory.eaushadhi_qc_prep_fill_log(run_id, step, run_status_after, payload, payload_sha256, actor)
  values (p_run_id, p_step, p_status, v, encode(extensions.digest(convert_to(v::text,'UTF8'),'sha256'),'hex'), p_actor);
end $f$;
revoke all on function regulatory.eaushadhi_qc_prep_log_v1(uuid,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_prep_log_v1(uuid,text,text,jsonb,uuid) to service_role;

-- C2. Projection + blockers (read-only). Everything the filler may type comes from here, never from the client.
create function regulatory.eaushadhi_qc_prep_projection_v1(p_preparation_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public','regulatory','extensions','pg_temp' as $f$
declare p regulatory.eaushadhi_qc_preparation%rowtype; r jsonb; b regulatory.eaushadhi_qc_evidence_binding%rowtype;
  t regulatory.controlled_term%rowtype; m regulatory.term_portal_mapping%rowtype; o regulatory.portal_option%rowtype;
  v_blockers text[] := '{}'; v_fill jsonb; v_term_id bigint; v_wf regulatory.eaushadhi_product_workflow%rowtype; v_comp text;
begin
  select * into p from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id;
  if not found then return jsonb_build_object('blockers',jsonb_build_array('PREPARATION_MISSING')); end if;
  r := regulatory.eaushadhi_qc_readiness_v1(p_preparation_id);
  if r->>'status' not in ('READY_PROVISIONAL','READY') then v_blockers := array_append(v_blockers,'READINESS_'||(r->>'status')); end if;
  select * into b from regulatory.eaushadhi_qc_evidence_binding where binding_id=(r->>'binding_id')::bigint;
  select * into v_wf from regulatory.eaushadhi_product_workflow where product_id=p.product_id;
  if not found or v_wf.entry_status <> 'PORTAL_VERIFIED' or coalesce(v_wf.portal_product_ref,'')='' then
    v_blockers := array_append(v_blockers,'PRODUCT_DETAILS_NOT_PORTAL_VERIFIED'); end if;
  select stage_status into v_comp from regulatory.eaushadhi_composition_stage where product_id=p.product_id;
  if v_comp is distinct from 'PORTAL_VERIFIED' then v_blockers := array_append(v_blockers,'COMPOSITION_NOT_PORTAL_VERIFIED'); end if;
  if coalesce(p.draft_payload->>'testing_protocol_term_id','') !~ '^[0-9]{1,18}$' then
    v_blockers := array_append(v_blockers,'PROTOCOL_TERM_MISSING');
  else
    v_term_id := (p.draft_payload->>'testing_protocol_term_id')::bigint;
    select * into t from regulatory.controlled_term where id=v_term_id and domain_code='QC_PROTOCOL' and is_active;
    if not found then v_blockers := array_append(v_blockers,'PROTOCOL_TERM_INVALID'); end if;
    select * into m from regulatory.term_portal_mapping x where x.controlled_term_id=v_term_id and x.portal_code='E_AUSHADHI'
      and (x.effective_from is null or x.effective_from <= now()) and (x.effective_to is null or x.effective_to > now())
      order by (x.mapping_status='VERIFIED') desc, x.id desc limit 1;
    if not found then v_blockers := array_append(v_blockers,'PROTOCOL_MAPPING_MISSING');
    else
      if m.mapping_status <> 'VERIFIED' then v_blockers := array_append(v_blockers,'PROTOCOL_MAPPING_NOT_VERIFIED'); end if;
      select * into o from regulatory.portal_option where id=m.portal_option_id and is_active and domain_code='QC_PROTOCOL';
      if not found then v_blockers := array_append(v_blockers,'PROTOCOL_OPTION_INACTIVE'); end if;
    end if;
    if t.code = 'OTHER' and length(btrim(coalesce(p.draft_payload->>'other_testing_protocol_text',''))) < 5 then
      v_blockers := array_append(v_blockers,'OTHER_PROTOCOL_TEXT_MISSING'); end if;
  end if;
  -- R2.1: keys and values exactly as the portal's SaveData() posts qcdetails (productId is bound by page identity, not typed).
  --   When the study type is Others the portal posts the #otherText value AS typeOfStudy (no separate key).
  -- R2.2: a study start date that the report does not state must be flagged as derived (OPERATOR_DERIVATION).
  if exists(select 1 from jsonb_array_elements(coalesce(r->'operator_asserted_facts','[]'::jsonb)) x
            where x->>'fact'='study_start_date' and coalesce(x->>'basis_category','') <> 'OPERATOR_DERIVATION') then
    v_blockers := array_append(v_blockers,'STUDY_START_NOT_FLAGGED_DERIVED'); end if;
  v_fill := jsonb_build_object(
    'typeOfStudy', case when t.code='OTHER' then btrim(p.draft_payload->>'other_testing_protocol_text') else o.external_id end,
    'startDate', p.draft_payload->>'study_start_date', 'endDate', p.draft_payload->>'study_end_date',
    'reportDate', p.draft_payload->>'report_date',
    'batchNo', (select string_agg(btrim(x->>'batch_no'), ',' order by n) from jsonb_array_elements(p.draft_payload->'batches') with ordinality e(x,n)),
    'duration', p.draft_payload->>'shelf_life_months',
    'labName', r->'lab_basis'->>'portal_external_id',
    'qualityCntrl', case p.draft_payload->>'quality_control_mode' when 'OUT' then 'Out' when 'IN' then 'In' end);
  return jsonb_build_object('blockers', to_jsonb(v_blockers), 'readiness', r,
    'protocol_mapping', case when m.id is null then null else jsonb_build_object('mapping_id',m.id,'mapping_status',m.mapping_status,
       'portal_option_id',m.portal_option_id,'term_id',v_term_id,'term_code',t.code) end,
    'fill_fields', v_fill,
    'context', jsonb_build_object('product_id',p.product_id,'study_type_select_value',o.external_id,
       'study_type_other_text_control', case when t.code='OTHER' then '#otherText' end,'laboratory_label',r->'lab_basis'->>'portal_laboratory','portal_product_ref',v_wf.portal_product_ref,
       'report_issuer',r->'lab_basis'->>'report_issuer','provisional_lab',(r->>'status')='READY_PROVISIONAL',
       'document_asset_id',b.document_asset_id,'report_sha256',b.verified_sha256,'report_size_bytes',b.verified_size_bytes,
       'report_filename',p.draft_payload->>'report_filename','binding_id',b.binding_id,
       'portal_action','SAVE_ONLY_SUBMIT_OUT_OF_SCOPE',
       'derived_facts', coalesce((select jsonb_agg(jsonb_build_object('fact',x->>'fact','acceptance_id',(x->>'acceptance_id')::bigint,'basis_note',x->>'basis_note'))
          from jsonb_array_elements(coalesce(r->'operator_asserted_facts','[]'::jsonb)) x where x->>'basis_category'='OPERATOR_DERIVATION'),'[]'::jsonb)));
end $f$;
revoke all on function regulatory.eaushadhi_qc_prep_projection_v1(uuid) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_prep_projection_v1(uuid) to service_role;

-- C3. Preflight (read-only, view permission): projection, blockers, active/recent runs with their logs
create function public.rpc_eaushadhi_qc_prep_run_preflight_v1(p_product_id integer, p_preparation_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
begin
  perform public.rpc_eaushadhi_require_permission(false);
  if not exists(select 1 from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id and product_id=p_product_id) then
    raise exception using errcode='P0002', message='QC draft not found for product'; end if;
  return regulatory.eaushadhi_qc_prep_projection_v1(p_preparation_id) || jsonb_build_object('runs', coalesce((
    select jsonb_agg(jsonb_build_object('run_id',r.run_id,'run_status',r.run_status,'armed_by',r.armed_by,'armed_at',r.armed_at,
      'readiness_status',r.readiness_status,'provisional_lab',r.provisional_lab,'qualification',r.qualification,'save_outcome',r.save_outcome,
      'log',(select jsonb_agg(jsonb_build_object('step',l.step,'status',l.run_status_after,'actor',l.actor,'at',l.logged_at) order by l.log_id)
             from regulatory.eaushadhi_qc_prep_fill_log l where l.run_id=r.run_id)) order by r.armed_at desc)
    from (select * from regulatory.eaushadhi_qc_prep_run where product_id=p_product_id order by armed_at desc limit 5) r),'[]'::jsonb));
end $f$;
revoke all on function public.rpc_eaushadhi_qc_prep_run_preflight_v1(integer,uuid) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_prep_run_preflight_v1(integer,uuid) to authenticated, service_role;

-- C4. Arm (editor). Lock order: preparation FOR SHARE -> per-product advisory lock -> run rows.
create function public.rpc_eaushadhi_qc_prep_run_arm_v1(
  p_product_id integer, p_preparation_id uuid, p_expected_readiness_tuple text,
  p_provisional_lab_ack boolean, p_provisional_ack_note text,
  p_page_identity_evidence jsonb, p_before_list_evidence jsonb,
  p_derived_fact_ack boolean, p_derived_fact_ack_note text)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','extensions','pg_temp' as $f$
declare v_actor uuid; p regulatory.eaushadhi_qc_preparation%rowtype; pj jsonb; r jsonb; v_run uuid; v_prov boolean; v_hash text; v_derived jsonb; v_qual jsonb;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  if p_product_id <> 262 then raise exception using errcode='42501', message='QC prep run V1 is restricted to Product 262'; end if;
  select * into p from regulatory.eaushadhi_qc_preparation where preparation_id=p_preparation_id and product_id=p_product_id for share;
  if not found then raise exception using errcode='P0002', message='QC draft not found for product'; end if;
  perform pg_advisory_xact_lock(hashtext('eaushadhi_qc_prep_run'), p_product_id);
  pj := regulatory.eaushadhi_qc_prep_projection_v1(p_preparation_id);
  if jsonb_array_length(pj->'blockers') > 0 then
    raise exception using errcode='55000', message='ARM_BLOCKED: '||(pj->>'blockers'); end if;
  r := pj->'readiness';
  if r->>'readiness_tuple' is distinct from p_expected_readiness_tuple then
    raise exception using errcode='40001', message='READINESS_CHANGED'; end if;
  v_prov := (r->>'status') = 'READY_PROVISIONAL';
  if v_prov and (p_provisional_lab_ack is distinct from true or length(btrim(coalesce(p_provisional_ack_note,''))) not between 10 and 2000) then
    raise exception using errcode='23514', message='PROVISIONAL_LAB_ACK_REQUIRED'; end if;
  -- R2.2: every derived fact (e.g. study start = earliest batch manufacturing date) needs an explicit acknowledgement
  --       that the derived value is suitable for the portal field.
  v_derived := coalesce(pj->'context'->'derived_facts','[]'::jsonb);
  if jsonb_array_length(v_derived) > 0 and (p_derived_fact_ack is distinct from true
     or length(btrim(coalesce(p_derived_fact_ack_note,''))) not between 10 and 2000) then
    raise exception using errcode='23514', message='DERIVED_FACT_ACK_REQUIRED'; end if;
  if jsonb_typeof(p_page_identity_evidence)<>'object'
     or coalesce(p_page_identity_evidence->>'actualRoute','')<>'/admin/addQCRegister'
     or coalesce(p_page_identity_evidence->>'expectedRoute','')<>'/admin/addQCRegister'
     or coalesce(p_page_identity_evidence->>'actualProductId','')<>p_product_id::text
     or coalesce(p_page_identity_evidence->>'expectedProductId','')<>p_product_id::text then
    raise exception using errcode='22023', message='PAGE_IDENTITY_INVALID'; end if;
  if jsonb_typeof(p_before_list_evidence)<>'object'
     or coalesce((p_before_list_evidence->>'settled')::boolean,false) is not true
     or coalesce((p_before_list_evidence->>'success')::boolean,false) is not true
     or coalesce((p_before_list_evidence->>'coverageComplete')::boolean,false) is not true
     or jsonb_typeof(p_before_list_evidence->'rows')<>'array' then
    raise exception using errcode='22023', message='BEFORE_LIST_EVIDENCE_REQUIRED'; end if;
  if exists(select 1 from regulatory.eaushadhi_qc_prep_run where product_id=p_product_id
            and run_status in ('SAVE_ARMED','SAVE_CONFIRMED','SAVE_AMBIGUOUS','SAVE_UNAUTHORIZED','SAVE_FOUND_UNAUTHORIZED','ROW_MISMATCH','DOCUMENT_MISMATCH'))
     or exists(select 1 from regulatory.eaushadhi_qc_run where product_id=p_product_id and run_status in ('SAVE_ARMED','SAVE_CONFIRMED','SAVE_AMBIGUOUS')) then
    raise exception using errcode='23505', message='ACTIVE_RUN_EXISTS'; end if;
  if exists(select 1 from regulatory.eaushadhi_qc_prep_run where product_id=p_product_id and run_status in ('ROW_VERIFIED_DOCUMENT_NOT_VERIFIED','FULLY_VERIFIED')) then
    raise exception using errcode='55000', message='ALREADY_ROW_VERIFIED'; end if;
  v_qual := jsonb_build_object('readiness_status', r->>'status', 'provisional', v_prov,
    'lab_basis_id', (r->'lab_basis'->>'lab_basis_id')::bigint, 'report_issuer', r->'lab_basis'->>'report_issuer',
    'portal_laboratory', r->'lab_basis'->>'portal_laboratory', 'internal_selection', r->'lab_basis'->>'internal_selection',
    'legal_lab_identity_verified', false, 'portal_eligibility_verified', false,
    'statement', case when r->'lab_basis' is null then 'No laboratory decision applies.'
      else 'Portal laboratory is an internal provisional selection. It is not the report issuer, and legal laboratory identity and portal eligibility are not verified.' end);
  v_hash := encode(extensions.digest(convert_to((pj->'fill_fields')::text,'UTF8'),'sha256'),'hex');
  insert into regulatory.eaushadhi_qc_prep_run(product_id, preparation_id, preparation_row_version, binding_id, readiness_status,
    readiness_tuple, readiness_snapshot, lab_basis_id, provisional_lab, provisional_ack_note, derived_facts, derived_fact_ack_note, qualification, protocol_mapping_id, projection,
    projection_sha256, run_status, page_identity_evidence, before_list_evidence, armed_by, updated_by)
  values (p_product_id, p.preparation_id, p.row_version, (r->>'binding_id')::bigint, r->>'status', r->>'readiness_tuple', r,
    (r->'lab_basis'->>'lab_basis_id')::bigint, v_prov, case when v_prov then btrim(p_provisional_ack_note) end,
    v_derived, case when jsonb_array_length(v_derived) > 0 then btrim(p_derived_fact_ack_note) end, v_qual,
    (pj->'protocol_mapping'->>'mapping_id')::bigint, pj - 'readiness', v_hash, 'SAVE_ARMED',
    p_page_identity_evidence, p_before_list_evidence, v_actor, v_actor)
  returning run_id into v_run;
  perform regulatory.eaushadhi_qc_prep_log_v1(v_run,'ARMED','SAVE_ARMED',jsonb_build_object('readiness_tuple',r->>'readiness_tuple',
    'readiness_status',r->>'status','binding_id',r->>'binding_id','lab_basis_id',r->'lab_basis'->>'lab_basis_id',
    'provisional_lab',v_prov,'provisional_ack_note',p_provisional_ack_note,'derived_facts',v_derived,'derived_fact_ack_note',p_derived_fact_ack_note,'projection_sha256',v_hash,'fill_fields',pj->'fill_fields'),v_actor);
  return jsonb_build_object('run_id',v_run,'run_status','SAVE_ARMED','fill_fields',pj->'fill_fields','projection_sha256',v_hash,
    'provisional_lab',v_prov,'qualification',v_qual,'portal_action','SAVE_ONLY_SUBMIT_OUT_OF_SCOPE');
end $f$;
revoke all on function public.rpc_eaushadhi_qc_prep_run_arm_v1(integer,uuid,text,boolean,text,jsonb,jsonb,boolean,text) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_prep_run_arm_v1(integer,uuid,text,boolean,text,jsonb,jsonb,boolean,text) to authenticated, service_role;

-- C5. Pre-save recheck, called immediately before the operator presses the portal's native Save.
--     Recomputes readiness tuple, mapping, page identity and the exact filled values. Any difference => PRE_SAVE_ABORTED
--     (terminal; nothing was saved) and go=false. R2.3: a pass issues a SINGLE-USE token valid for 120 s; a newer pass
--     replaces (invalidates) the older token; the token is consumed by record_save.
create function public.rpc_eaushadhi_qc_prep_run_pre_save_v1(p_run_id uuid, p_page_identity_evidence jsonb, p_filled_values jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_actor uuid; run regulatory.eaushadhi_qc_prep_run%rowtype; v_prep uuid; pj jsonb; v_reasons text[] := '{}'; k text; v_tok uuid;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  select preparation_id into v_prep from regulatory.eaushadhi_qc_prep_run where run_id=p_run_id;
  if not found then raise exception using errcode='P0002', message='RUN_NOT_FOUND'; end if;
  perform 1 from regulatory.eaushadhi_qc_preparation where preparation_id=v_prep for share;
  select * into run from regulatory.eaushadhi_qc_prep_run where run_id=p_run_id for update;
  if run.run_status <> 'SAVE_ARMED' then raise exception using errcode='55000', message='RUN_NOT_SAVE_ARMED'; end if;
  pj := regulatory.eaushadhi_qc_prep_projection_v1(v_prep);
  if jsonb_array_length(pj->'blockers') > 0 then v_reasons := array_append(v_reasons,'BLOCKERS:'||(pj->>'blockers')); end if;
  if pj->'readiness'->>'readiness_tuple' is distinct from run.readiness_tuple then v_reasons := array_append(v_reasons,'READINESS_TUPLE_CHANGED'); end if;
  if (pj->'protocol_mapping'->>'mapping_id')::bigint is distinct from run.protocol_mapping_id then v_reasons := array_append(v_reasons,'PROTOCOL_MAPPING_CHANGED'); end if;
  if pj->'fill_fields' is distinct from run.projection->'fill_fields' then v_reasons := array_append(v_reasons,'PROJECTION_CHANGED'); end if;
  if jsonb_typeof(p_page_identity_evidence)<>'object'
     or coalesce(p_page_identity_evidence->>'actualRoute','')<>'/admin/addQCRegister'
     or coalesce(p_page_identity_evidence->>'actualProductId','')<>run.product_id::text then
    v_reasons := array_append(v_reasons,'PAGE_IDENTITY_INVALID'); end if;
  if jsonb_typeof(p_filled_values)<>'object' then v_reasons := array_append(v_reasons,'FILLED_VALUES_MISSING');
  else
    for k in select jsonb_object_keys(run.projection->'fill_fields') loop
      if (run.projection->'fill_fields'->>k) is distinct from (p_filled_values->>k) then
        v_reasons := array_append(v_reasons,'FILLED_VALUE_DIFFERS:'||k); end if;
    end loop;
    for k in select jsonb_object_keys(p_filled_values) loop
      if not (run.projection->'fill_fields') ? k then v_reasons := array_append(v_reasons,'FILLED_VALUE_UNEXPECTED:'||k); end if;
    end loop;
  end if;
  if cardinality(v_reasons) > 0 then
    update regulatory.eaushadhi_qc_prep_run set run_status='PRE_SAVE_ABORTED', pre_save_token=null, updated_by=v_actor, updated_at=now() where run_id=p_run_id;
    perform regulatory.eaushadhi_qc_prep_log_v1(p_run_id,'PRE_SAVE_REFUSED','PRE_SAVE_ABORTED',
      jsonb_build_object('reasons',to_jsonb(v_reasons),'filled_values',p_filled_values,'page',p_page_identity_evidence),v_actor);
    return jsonb_build_object('go',false,'run_status','PRE_SAVE_ABORTED','reasons',to_jsonb(v_reasons),'qualification',run.qualification);
  end if;
  v_tok := gen_random_uuid();
  update regulatory.eaushadhi_qc_prep_run set pre_save_ok_at=now(), pre_save_token=v_tok, pre_save_tuple=run.readiness_tuple,
    pre_save_token_consumed_at=null, updated_by=v_actor, updated_at=now() where run_id=p_run_id;
  perform regulatory.eaushadhi_qc_prep_log_v1(p_run_id,'PRE_SAVE_OK','SAVE_ARMED',
    jsonb_build_object('readiness_tuple',run.readiness_tuple,'token_issued',true,'filled_values',p_filled_values,'page',p_page_identity_evidence),v_actor);
  return jsonb_build_object('go',true,'run_status','SAVE_ARMED','pre_save_token',v_tok,'valid_until',now()+interval '120 seconds',
    'single_use',true,'qualification',run.qualification);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_prep_run_pre_save_v1(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_prep_run_pre_save_v1(uuid,jsonb,jsonb) to authenticated, service_role;

-- C6. Record the outcome of the operator's explicit native Save. Submit is refused.
--     R2.3: the pre-save token is consumed here. The outcome is always recorded (the Save may have happened), but if the
--     token is missing/mismatched/expired/consumed or the readiness fingerprint changed, the run becomes SAVE_UNAUTHORIZED:
--     never CONFIRMED, never retried, arm blocked until an editor resolves it after checking the portal list.
--     AMBIGUOUS is never retried automatically either.
create function public.rpc_eaushadhi_qc_prep_run_record_save_v1(p_run_id uuid, p_pre_save_token uuid, p_save_outcome text, p_save_evidence jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_actor uuid; run regulatory.eaushadhi_qc_prep_run%rowtype; v_prep uuid; v_status text; v_reasons text[] := '{}'; v_now_tuple text;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  if p_save_outcome is null or p_save_outcome not in ('CONFIRMED','AMBIGUOUS','REJECTED') then
    raise exception using errcode='22023', message='SAVE_OUTCOME_INVALID'; end if;
  if jsonb_typeof(p_save_evidence)<>'object' or coalesce(p_save_evidence->>'action','') <> 'SAVE'
     or coalesce((p_save_evidence->>'submitted')::boolean,false) then
    raise exception using errcode='22023', message='SAVE_ONLY_SUBMIT_REFUSED'; end if;
  select preparation_id into v_prep from regulatory.eaushadhi_qc_prep_run where run_id=p_run_id;
  if not found then raise exception using errcode='P0002', message='RUN_NOT_FOUND'; end if;
  perform 1 from regulatory.eaushadhi_qc_preparation where preparation_id=v_prep for share;   -- lock order: prep -> run
  select * into run from regulatory.eaushadhi_qc_prep_run where run_id=p_run_id for update;
  if run.run_status <> 'SAVE_ARMED' then raise exception using errcode='55000', message='RUN_NOT_SAVE_ARMED'; end if;
  if run.pre_save_token is null or p_pre_save_token is null or p_pre_save_token is distinct from run.pre_save_token then
    v_reasons := array_append(v_reasons,'PRE_SAVE_TOKEN_MISSING_OR_MISMATCH'); end if;
  if run.pre_save_token_consumed_at is not null then v_reasons := array_append(v_reasons,'PRE_SAVE_TOKEN_CONSUMED'); end if;
  if run.pre_save_ok_at is null or run.pre_save_ok_at < now() - interval '120 seconds' then
    v_reasons := array_append(v_reasons,'PRE_SAVE_TOKEN_EXPIRED'); end if;
  v_now_tuple := regulatory.eaushadhi_qc_readiness_v1(v_prep)->>'readiness_tuple';
  if v_now_tuple is distinct from run.readiness_tuple or run.pre_save_tuple is distinct from run.readiness_tuple then
    v_reasons := array_append(v_reasons,'READINESS_CHANGED_SINCE_PRE_SAVE'); end if;
  v_status := case when cardinality(v_reasons) > 0 then 'SAVE_UNAUTHORIZED'
                   when p_save_outcome='CONFIRMED' then 'SAVE_CONFIRMED' when p_save_outcome='AMBIGUOUS' then 'SAVE_AMBIGUOUS' else 'SAVE_REJECTED' end;
  update regulatory.eaushadhi_qc_prep_run set run_status=v_status, save_outcome=p_save_outcome, pre_save_token_consumed_at=now(),
    updated_by=v_actor, updated_at=now() where run_id=p_run_id;
  perform regulatory.eaushadhi_qc_prep_log_v1(p_run_id, case when cardinality(v_reasons) > 0 then 'SAVE_RECORDED_UNAUTHORIZED' else 'SAVE_RECORDED' end,
    v_status, jsonb_build_object('outcome',p_save_outcome,'evidence',p_save_evidence,'reasons',to_jsonb(v_reasons),'token_consumed',true),v_actor);
  return jsonb_build_object('run_id',p_run_id,'run_status',v_status,'reasons',to_jsonb(v_reasons),'auto_retry',false,'qualification',run.qualification);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_prep_run_record_save_v1(uuid,uuid,text,jsonb) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_prep_run_record_save_v1(uuid,uuid,text,jsonb) to authenticated, service_role;

-- C7. Operator resolution after checking the portal list by hand. AMBIGUOUS: FOUND_SAVED -> SAVE_CONFIRMED,
--     NOT_SAVED -> SAVE_NOT_SAVED. R2.3 UNAUTHORIZED: FOUND_SAVED -> SAVE_FOUND_UNAUTHORIZED (stays blocking; never
--     verified; portal clean-up is a later gate), NOT_SAVED -> SAVE_NOT_SAVED.
create function public.rpc_eaushadhi_qc_prep_run_resolve_ambiguous_v1(
  p_run_id uuid, p_resolution text, p_after_list_evidence jsonb, p_note text, p_attest boolean)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_actor uuid; run regulatory.eaushadhi_qc_prep_run%rowtype; v_status text;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  if p_attest is distinct from true then raise exception using errcode='23514', message='ATTESTATION_REQUIRED'; end if;
  if length(btrim(coalesce(p_note,''))) not between 10 and 2000 then raise exception using errcode='23514', message='NOTE_REQUIRED'; end if;
  if p_resolution is null or p_resolution not in ('FOUND_SAVED','NOT_SAVED') then raise exception using errcode='22023', message='RESOLUTION_INVALID'; end if;
  if jsonb_typeof(p_after_list_evidence)<>'object'
     or coalesce((p_after_list_evidence->>'settled')::boolean,false) is not true
     or coalesce((p_after_list_evidence->>'success')::boolean,false) is not true
     or coalesce((p_after_list_evidence->>'coverageComplete')::boolean,false) is not true then
    raise exception using errcode='22023', message='AFTER_LIST_EVIDENCE_REQUIRED'; end if;
  select * into run from regulatory.eaushadhi_qc_prep_run where run_id=p_run_id for update;
  if not found then raise exception using errcode='P0002', message='RUN_NOT_FOUND'; end if;
  if run.run_status not in ('SAVE_AMBIGUOUS','SAVE_UNAUTHORIZED') then raise exception using errcode='55000', message='RUN_NOT_AWAITING_RESOLUTION'; end if;
  v_status := case when p_resolution='NOT_SAVED' then 'SAVE_NOT_SAVED'
                   when run.run_status='SAVE_UNAUTHORIZED' then 'SAVE_FOUND_UNAUTHORIZED' else 'SAVE_CONFIRMED' end;
  update regulatory.eaushadhi_qc_prep_run set run_status=v_status, updated_by=v_actor, updated_at=now() where run_id=p_run_id;
  perform regulatory.eaushadhi_qc_prep_log_v1(p_run_id,'AMBIGUOUS_RESOLVED',v_status,
    jsonb_build_object('from',run.run_status,'resolution',p_resolution,'note',btrim(p_note),'after_list',p_after_list_evidence),v_actor);
  return jsonb_build_object('run_id',p_run_id,'run_status',v_status,'qualification',run.qualification);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_prep_run_resolve_ambiguous_v1(uuid,text,jsonb,text,boolean) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_prep_run_resolve_ambiguous_v1(uuid,text,jsonb,text,boolean) to authenticated, service_role;

-- C8. Row verification (portal row fields only). R2.4: no client-supplied document evidence is accepted anywhere.
--     Outcomes: ROW_MISMATCH | ROW_VERIFIED_DOCUMENT_NOT_VERIFIED. FULLY_VERIFIED / DOCUMENT_MISMATCH can only be set
--     by the service-role recorder (C9), i.e. by a future server component that fetched and hashed the portal-held bytes.
create function public.rpc_eaushadhi_qc_prep_run_verify_row_v1(
  p_run_id uuid, p_after_list_evidence jsonb, p_reread_values jsonb, p_resolved_portal_row_id text)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_actor uuid; run regulatory.eaushadhi_qc_prep_run%rowtype; v_diff text[] := '{}'; k text; v_status text;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  if jsonb_typeof(p_after_list_evidence)<>'object'
     or coalesce((p_after_list_evidence->>'settled')::boolean,false) is not true
     or coalesce((p_after_list_evidence->>'success')::boolean,false) is not true
     or coalesce((p_after_list_evidence->>'coverageComplete')::boolean,false) is not true then
    raise exception using errcode='22023', message='AFTER_LIST_EVIDENCE_REQUIRED'; end if;
  if jsonb_typeof(p_reread_values)<>'object' then raise exception using errcode='22023', message='REREAD_VALUES_REQUIRED'; end if;
  if length(btrim(coalesce(p_resolved_portal_row_id,''))) = 0 then raise exception using errcode='22023', message='PORTAL_ROW_ID_REQUIRED'; end if;
  select * into run from regulatory.eaushadhi_qc_prep_run where run_id=p_run_id for update;
  if not found then raise exception using errcode='P0002', message='RUN_NOT_FOUND'; end if;
  if run.run_status <> 'SAVE_CONFIRMED' then raise exception using errcode='55000', message='RUN_NOT_SAVE_CONFIRMED'; end if;
  for k in select jsonb_object_keys(run.projection->'fill_fields') loop
    if (run.projection->'fill_fields'->>k) is distinct from (p_reread_values->>k) then v_diff := array_append(v_diff,k); end if;
  end loop;
  v_status := case when cardinality(v_diff) > 0 then 'ROW_MISMATCH' else 'ROW_VERIFIED_DOCUMENT_NOT_VERIFIED' end;
  update regulatory.eaushadhi_qc_prep_run set run_status=v_status, resolved_portal_row_id=btrim(p_resolved_portal_row_id),
    updated_by=v_actor, updated_at=now() where run_id=p_run_id;
  perform regulatory.eaushadhi_qc_prep_log_v1(p_run_id, v_status, v_status, jsonb_build_object('differences',to_jsonb(v_diff),
    'reread',p_reread_values,'after_list',p_after_list_evidence,'portal_row_id',p_resolved_portal_row_id,
    'document_check','NOT_PERFORMED_REQUIRES_TRUSTED_SERVER_FETCH','binding_id',run.binding_id,'readiness_tuple',run.readiness_tuple),v_actor);
  return jsonb_build_object('run_id',p_run_id,'run_status',v_status,'differences',to_jsonb(v_diff),
    'row_fields_verified', cardinality(v_diff)=0, 'document_verified', false, 'fully_verified', false,
    'document_check','NOT_PERFORMED_REQUIRES_TRUSTED_SERVER_FETCH','qualification',run.qualification);
end $f$;
revoke all on function public.rpc_eaushadhi_qc_prep_run_verify_row_v1(uuid,jsonb,jsonb,text) from public, anon;
grant execute on function public.rpc_eaushadhi_qc_prep_run_verify_row_v1(uuid,jsonb,jsonb,text) to authenticated, service_role;

-- C9. Trusted document recorder (future hook). SERVICE_ROLE ONLY: never granted to authenticated/anon/PUBLIC and no public
--     wrapper exists. Intended caller: a future server component (B2-style edge function) that itself retrieved the
--     attachment of portal row p_portal_row_id and hashed the bytes. Not callable from the app. Today no such component
--     exists (portal attachment retrieval needs a portal session), so runs stop at ROW_VERIFIED_DOCUMENT_NOT_VERIFIED.
create function regulatory.eaushadhi_qc_prep_run_record_document_check_v1(
  p_run_id uuid, p_portal_row_id text, p_fetched_sha256 text, p_fetched_size_bytes bigint, p_fetch_evidence jsonb, p_actor uuid)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare run regulatory.eaushadhi_qc_prep_run%rowtype; b regulatory.eaushadhi_qc_evidence_binding%rowtype; v_status text;
begin
  if p_actor is null then raise exception using errcode='22023', message='ACTOR_REQUIRED'; end if;
  if coalesce(p_fetched_sha256,'') !~ '^[0-9a-f]{64}$' or p_fetched_size_bytes is null or p_fetched_size_bytes < 0
     or jsonb_typeof(p_fetch_evidence)<>'object' or coalesce(p_fetch_evidence->>'fetched_by','') = '' then
    raise exception using errcode='22023', message='TRUSTED_FETCH_EVIDENCE_INVALID'; end if;
  select * into run from regulatory.eaushadhi_qc_prep_run where run_id=p_run_id for update;
  if not found then raise exception using errcode='P0002', message='RUN_NOT_FOUND'; end if;
  if run.run_status <> 'ROW_VERIFIED_DOCUMENT_NOT_VERIFIED' then raise exception using errcode='55000', message='RUN_NOT_AWAITING_DOCUMENT'; end if;
  if run.resolved_portal_row_id is distinct from btrim(coalesce(p_portal_row_id,'')) then
    raise exception using errcode='22023', message='PORTAL_ROW_MISMATCH'; end if;
  select * into b from regulatory.eaushadhi_qc_evidence_binding where binding_id=run.binding_id;
  v_status := case when p_fetched_sha256 = b.verified_sha256 and p_fetched_size_bytes = b.verified_size_bytes
                   then 'FULLY_VERIFIED' else 'DOCUMENT_MISMATCH' end;
  update regulatory.eaushadhi_qc_prep_run set run_status=v_status,
    document_evidence=jsonb_build_object('source','TRUSTED_SERVER_FETCH','sha256',p_fetched_sha256,'size_bytes',p_fetched_size_bytes,
      'portal_row_id',run.resolved_portal_row_id,'fetch',p_fetch_evidence),
    updated_by=p_actor, updated_at=now() where run_id=p_run_id;
  perform regulatory.eaushadhi_qc_prep_log_v1(p_run_id, v_status, v_status, jsonb_build_object('document_check','TRUSTED_SERVER_FETCH',
    'portal_row_id',run.resolved_portal_row_id,'fetched_sha256',p_fetched_sha256,'fetched_size_bytes',p_fetched_size_bytes,
    'bound_sha256',b.verified_sha256,'bound_size_bytes',b.verified_size_bytes,'binding_id',b.binding_id,'fetch',p_fetch_evidence),p_actor);
  return jsonb_build_object('run_id',p_run_id,'run_status',v_status,'fully_verified',v_status='FULLY_VERIFIED','qualification',run.qualification);
end $f$;
revoke all on function regulatory.eaushadhi_qc_prep_run_record_document_check_v1(uuid,text,text,bigint,jsonb,uuid) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_qc_prep_run_record_document_check_v1(uuid,text,text,bigint,jsonb,uuid) to service_role;
