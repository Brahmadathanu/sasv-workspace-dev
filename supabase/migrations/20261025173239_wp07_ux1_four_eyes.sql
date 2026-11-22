-- WP-07 UX-1.3 four-eyes rule (PREPARED 2026-10-25 IST, NOT APPLIED).
-- Rule: a stage may move INTO 'VERIFIED' (the approval) only when
--   (a) the caller holds an active APPROVER grant in regulatory.eaushadhi_role_grant, and
--   (b) the caller is NOT the person who last saved that stage for review (the verifier).
-- The "verifier" of a stage is the user in OLD.updated_by at the moment of approval, i.e. whoever last saved it
-- as IN_REVIEW / REVIEW_REQUIRED. A stage that nobody has saved for review (updated_by null) cannot be approved
-- in one step: someone must save it for review first.
-- Covered stages and the live write path (checked 2026-10-25):
--   eaushadhi_product_review                 UPDATE  rpc_eaushadhi_product_review_save(p_verify=true)
--   eaushadhi_product_classification_review  UPDATE  rpc_eaushadhi_product_classification_review_save(p_verify=true)
--   eaushadhi_line_review                    UPDATE  rpc_eaushadhi_save_line_review(p_verify=true)
--   eaushadhi_product_action_review          DELETE+INSERT  rpc_eaushadhi_product_actions_save(p_verify=true)
--   eaushadhi_qc_preparation                 UPDATE  regulatory.eaushadhi_qc_preparation_verify_v2 (via public v2)
-- Server jobs (no auth.uid(), e.g. service_role) are not affected.
-- Legacy approvals are grandfathered: the triggers fire only on a NEW transition into VERIFIED. No existing row is
-- read-modified or rewritten. Product 262 (all stages VERIFIED, portal saved and confirmed) is untouched; only if it
-- were reopened and re-approved later would the rule apply to it.
-- Not covered (needs changes inside those RPCs, separate package): APPROVER check before portal Save
-- (rpc_eaushadhi_qc_prep_run_arm_v1 / record_save, composition/qc run arm), promote_verified_formulation,
-- reference/protocol mapping verifies.
-- Reversible: see DOWN at the bottom (drop 6 triggers and 3 functions). Additive only.

do $pre$
declare v_md5 text;
begin
  if to_regclass('regulatory.eaushadhi_role_grant') is null then raise exception 'FOUR_EYES preflight: role table missing'; end if;
  if to_regprocedure('regulatory.eaushadhi_four_eyes_guard()') is not null then raise exception 'FOUR_EYES preflight: already applied'; end if;
  if exists(select 1 from pg_trigger where tgname like '%four_eyes%' and not tgisinternal) then raise exception 'FOUR_EYES preflight: trigger already present'; end if;
  if not exists(select 1 from supabase_migrations.schema_migrations where version='20261025163252') then
    raise exception 'FOUR_EYES preflight: UX-1.2 migration 20261025163252 not recorded'; end if;
  -- Write paths this rule was designed against must be unchanged.
  select md5(pg_get_functiondef(p)) into v_md5 from (select 'public.rpc_eaushadhi_product_review_save(integer,bigint,bigint,text,text,boolean,boolean,boolean,boolean,boolean,text,boolean)'::regprocedure p) s;
  if v_md5 is distinct from '5f25142d5299730f945423a8a0cbbe39' then raise exception 'FOUR_EYES preflight: product_review_save changed (%)', v_md5; end if;
  select md5(pg_get_functiondef(p)) into v_md5 from (select 'public.rpc_eaushadhi_product_classification_review_save(integer,bigint,bigint,bigint,bigint,text,text,boolean)'::regprocedure p) s;
  if v_md5 is distinct from '7fe6eb30177bb55c46bd80718eebdd92' then raise exception 'FOUR_EYES preflight: classification_review_save changed (%)', v_md5; end if;
  select md5(pg_get_functiondef(p)) into v_md5 from (select 'public.rpc_eaushadhi_save_line_review(bigint,bigint,bigint,bigint,bigint,bigint,boolean,text)'::regprocedure p) s;
  if v_md5 is distinct from 'e914319811d6e8398c259e13baf174dd' then raise exception 'FOUR_EYES preflight: save_line_review changed (%)', v_md5; end if;
  select md5(pg_get_functiondef(p)) into v_md5 from (select 'public.rpc_eaushadhi_product_actions_save(integer,bigint,text[],boolean)'::regprocedure p) s;
  if v_md5 is distinct from '72bdd5608dd39828339cd5bdd7ddd7fc' then raise exception 'FOUR_EYES preflight: product_actions_save changed (%)', v_md5; end if;
  select md5(pg_get_functiondef(p)) into v_md5 from (select 'regulatory.eaushadhi_qc_preparation_verify_v2(uuid,bigint,boolean,jsonb,uuid)'::regprocedure p) s;
  if v_md5 is distinct from '516629d2fb4c31187d3e72d671c37f5e' then raise exception 'FOUR_EYES preflight: qc_preparation_verify_v2 changed (%)', v_md5; end if;
  select md5(pg_get_functiondef(p)) into v_md5 from (select 'regulatory.eaushadhi_has_role_v1(uuid,text)'::regprocedure p) s;
  if v_md5 is distinct from '25284d0fadc4b6b8eb1b830b1b1d1b2b' then raise exception 'FOUR_EYES preflight: has_role_v1 changed (%)', v_md5; end if;
  select md5(pg_get_functiondef('public.rpc_eaushadhi_worklist_v1()'::regprocedure)) into v_md5;
  if v_md5 is distinct from '5473c66cb3d5648259a5d3430a21d590' then raise exception 'FOUR_EYES preflight: worklist is not the 20261025163252 version (%)', v_md5; end if;
end
$pre$;

-- 1. Shared check
create function regulatory.eaushadhi_four_eyes_check_v1(p_actor uuid, p_verifier uuid) returns void
language plpgsql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
begin
  if not regulatory.eaushadhi_has_role_v1(p_actor,'APPROVER') then
    raise exception using errcode='42501', message='APPROVER_ROLE_REQUIRED',
      hint='Only a colleague with the Approver role can approve this step.'; end if;
  if p_verifier is null then
    raise exception using errcode='42501', message='FOUR_EYES_NOT_SAVED_FOR_REVIEW',
      hint='Save this step for review first; a different person then approves it.'; end if;
  if p_verifier = p_actor then
    raise exception using errcode='42501', message='FOUR_EYES_SAME_PERSON',
      hint='You saved this step for review. A different approver must approve it.'; end if;
end
$f$;

-- 2. UPDATE guard (product, classification, line, QC preparation). TG_ARGV[0] = status column.
create function regulatory.eaushadhi_four_eyes_guard() returns trigger
language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return new; end if;
  if (to_jsonb(new)->>TG_ARGV[0]) = 'VERIFIED' and (to_jsonb(old)->>TG_ARGV[0]) is distinct from 'VERIFIED' then
    perform regulatory.eaushadhi_four_eyes_check_v1(v_uid, (to_jsonb(old)->>'updated_by')::uuid);
  end if;
  return new;
end
$f$;

-- 3. Actions are replaced as a set (DELETE then INSERT). Remember who last saved the set, then check on INSERT.
create function regulatory.eaushadhi_four_eyes_action_guard() returns trigger
language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_uid uuid := auth.uid(); v_key text;
begin
  if v_uid is null then return coalesce(new, old); end if;
  if TG_OP = 'DELETE' then
    v_key := 'eaushadhi_four_eyes.action_' || old.product_id;
    if old.review_status <> 'VERIFIED' and old.updated_by is not null then
      perform set_config(v_key, old.updated_by::text, true);
    end if;
    return old;
  end if;
  if new.review_status = 'VERIFIED' then
    perform regulatory.eaushadhi_four_eyes_check_v1(v_uid,
      nullif(current_setting('eaushadhi_four_eyes.action_' || new.product_id, true), '')::uuid);
  end if;
  return new;
end
$f$;

revoke all on function regulatory.eaushadhi_four_eyes_check_v1(uuid,uuid) from public, anon, authenticated;
revoke all on function regulatory.eaushadhi_four_eyes_guard() from public, anon, authenticated;
revoke all on function regulatory.eaushadhi_four_eyes_action_guard() from public, anon, authenticated;

create trigger eaushadhi_product_review_four_eyes before update on regulatory.eaushadhi_product_review
  for each row execute function regulatory.eaushadhi_four_eyes_guard('review_status');
create trigger eaushadhi_product_classification_review_four_eyes before update on regulatory.eaushadhi_product_classification_review
  for each row execute function regulatory.eaushadhi_four_eyes_guard('review_status');
create trigger eaushadhi_line_review_four_eyes before update on regulatory.eaushadhi_line_review
  for each row execute function regulatory.eaushadhi_four_eyes_guard('review_status');
create trigger eaushadhi_qc_preparation_four_eyes before update on regulatory.eaushadhi_qc_preparation
  for each row execute function regulatory.eaushadhi_four_eyes_guard('preparation_status');
create trigger eaushadhi_product_action_review_four_eyes_del before delete on regulatory.eaushadhi_product_action_review
  for each row execute function regulatory.eaushadhi_four_eyes_action_guard();
create trigger eaushadhi_product_action_review_four_eyes_ins before insert on regulatory.eaushadhi_product_action_review
  for each row execute function regulatory.eaushadhi_four_eyes_action_guard();

-- DOWN (manual rollback, run as one transaction if ever needed):
-- drop trigger eaushadhi_product_review_four_eyes on regulatory.eaushadhi_product_review;
-- drop trigger eaushadhi_product_classification_review_four_eyes on regulatory.eaushadhi_product_classification_review;
-- drop trigger eaushadhi_line_review_four_eyes on regulatory.eaushadhi_line_review;
-- drop trigger eaushadhi_qc_preparation_four_eyes on regulatory.eaushadhi_qc_preparation;
-- drop trigger eaushadhi_product_action_review_four_eyes_del on regulatory.eaushadhi_product_action_review;
-- drop trigger eaushadhi_product_action_review_four_eyes_ins on regulatory.eaushadhi_product_action_review;
-- drop function regulatory.eaushadhi_four_eyes_action_guard(); drop function regulatory.eaushadhi_four_eyes_guard();
-- drop function regulatory.eaushadhi_four_eyes_check_v1(uuid,uuid);
