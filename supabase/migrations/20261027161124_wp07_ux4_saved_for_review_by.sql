-- WP-07 UX-4 saved_for_review_by (DRAFT 2026-10-27 IST, NOT APPLIED).
-- Fixes known hole (h): rpc_eaushadhi_product_portal_text_save (and other non-stage writers) rewrite updated_by,
-- and the four-eyes guard compared the approver with OLD.updated_by. A saves details, B saves portal text,
-- then A could approve A's own details.
-- Fix: a dedicated saver column (saved_for_review_by, saved_for_review_at) on the five four-eyes tables,
-- maintained ONLY by triggers, read by the four-eyes guards and by rpc_eaushadhi_stage_review_state_v1.
-- No existing RPC body is changed.
-- Saver rules (product_review, classification_review, line_review, qc_preparation):
--   R1 INSERT: saver = caller if a signed-in caller inserts a non-PENDING, non-VERIFIED row, else NULL.
--   R2 Reopen (OLD VERIFIED -> NEW not VERIFIED): saver cleared. Someone must save again.
--      R2 also blocks R5: a reopen never claims, even though reopen RPCs set the status column.
--   R3 NEW status PENDING (e.g. working-source correction): saver cleared.
--   R4 Attested content changed by a signed-in caller (NEW not VERIFIED): saver = caller.
--      Notes, portal text, suggestions and audit columns are NOT attested content.
--   R5 Stage save (status column in the UPDATE SET list) with no saver yet: saver = caller (first claim),
--      even if content is unchanged (accepting prefilled values is an attestation).
--   R6 Anything else: saver kept (portal text save, notes-only re-save by someone else = rubber stamp).
--   R7 Approval (into VERIFIED): saver kept; guard refuses if saver null, saver = approver,
--      or attested content changes in the same approving write (FOUR_EYES_CHANGED_ON_APPROVE).
-- Actions (DELETE+INSERT set): saver = whoever saved the set (non-VERIFIED insert); carried across the
-- delete for the approving insert. Content compare is not done for actions (residual, see plan).
-- Server jobs (auth.uid() null) never claim; they can clear (R2/R3) and keep.
-- Backfill: rows IN_REVIEW / REVIEW_REQUIRED / VERIFIED with updated_by get saver = updated_by,
-- saved_for_review_at = updated_at. PENDING rows stay NULL.
-- Grandfathering: triggers act only on new writes; no VERIFIED row changes status.

do $pre$
declare v_md5 text; r record;
begin
  if exists(select 1 from information_schema.columns where table_schema='regulatory' and column_name='saved_for_review_by') then
    raise exception 'UX4 preflight: already applied'; end if;
  for r in select * from (values
    ('regulatory.eaushadhi_four_eyes_guard()','e7338436fc3373bb63e3a06566f2d5eb'),
    ('regulatory.eaushadhi_four_eyes_action_guard()','e91cd834b2ac1d58a428d0bdec758f21'),
    ('regulatory.eaushadhi_four_eyes_check_v1(uuid,uuid)','7eeba4c6b5845f8d0d95156d39acad3c'),
    ('public.rpc_eaushadhi_stage_review_state_v1(integer)','2e83747b1fc96aae54a57d635b22f8bb'),
    ('public.rpc_eaushadhi_product_review_save(integer,bigint,bigint,text,text,boolean,boolean,boolean,boolean,boolean,text,boolean)','5f25142d5299730f945423a8a0cbbe39'),
    ('public.rpc_eaushadhi_product_classification_review_save(integer,bigint,bigint,bigint,bigint,text,text,boolean)','7fe6eb30177bb55c46bd80718eebdd92'),
    ('public.rpc_eaushadhi_save_line_review(bigint,bigint,bigint,bigint,bigint,bigint,boolean,text)','e914319811d6e8398c259e13baf174dd'),
    ('public.rpc_eaushadhi_product_actions_save(integer,bigint,text[],boolean)','72bdd5608dd39828339cd5bdd7ddd7fc'),
    ('public.rpc_eaushadhi_product_portal_text_save(integer,bigint,text,boolean,text)','cfd0bc2b227d82a239c286f2c208b8bc'),
    ('public.rpc_eaushadhi_prefill_diseases_from_therapeutic_master(integer)','22f46f672c33e8cc6267055e055f3840'),
    ('public.rpc_eaushadhi_correct_working_source_line(bigint,text,text,text,text,numeric,text,text)','1648c3cd6711e92a2f7e3c111a8409d3'),
    ('public.rpc_eaushadhi_post_entry_reconcile_line_ingredient_form(bigint,bigint,bigint,bigint,text)','c48f70bf38688c732a1a3b8e5dbaba4d'),
    ('public.rpc_eaushadhi_reopen_product_review(integer,bigint,text)','c76769a986a58f3e72cbd3c605663645'),
    ('public.rpc_eaushadhi_reopen_product_classification(integer,bigint,text)','2a768111c617cf50915ba86661fcb84b'),
    ('public.rpc_eaushadhi_reopen_line_review(bigint,bigint,text)','f1602608b1e0c2b40a865ddc9c7b09ce'),
    ('public.rpc_eaushadhi_reopen_product_actions(integer,bigint,text)','58552535a7720e506e6d1422d4a9ad95'),
    ('regulatory.eaushadhi_qc_preparation_save_v1(uuid,integer,text,bigint,jsonb,uuid)','9f189656ed938d2eedb46e4c309a6f22'),
    ('regulatory.eaushadhi_qc_preparation_verify_v2(uuid,bigint,boolean,jsonb,uuid)','516629d2fb4c31187d3e72d671c37f5e'),
    ('regulatory.eaushadhi_qc_preparation_reopen_v1(uuid,bigint,boolean,text,uuid)','1e768b2c1f1057af9cf6530919fbe061')
  ) v(sig, want) loop
    select md5(pg_get_functiondef(r.sig::regprocedure)) into v_md5;
    if v_md5 is distinct from r.want then raise exception 'UX4 preflight: % changed (%)', r.sig, v_md5; end if;
  end loop;
  -- No other function may write these tables (list checked 2026-10-27 IST: 15 writers).
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','regulatory') and p.prokind='f'
        and pg_get_functiondef(p.oid) ~* '(update|insert into|delete from)\s+(regulatory\.)?eaushadhi_(product_review|product_classification_review|line_review|product_action_review|qc_preparation)\M') <> 15 then
    raise exception 'UX4 preflight: writer set changed'; end if;
end
$pre$;

-- 1. Columns
alter table regulatory.eaushadhi_product_review                add column saved_for_review_by uuid, add column saved_for_review_at timestamptz;
alter table regulatory.eaushadhi_product_classification_review add column saved_for_review_by uuid, add column saved_for_review_at timestamptz;
alter table regulatory.eaushadhi_line_review                   add column saved_for_review_by uuid, add column saved_for_review_at timestamptz;
alter table regulatory.eaushadhi_product_action_review         add column saved_for_review_by uuid, add column saved_for_review_at timestamptz;
alter table regulatory.eaushadhi_qc_preparation                add column saved_for_review_by uuid, add column saved_for_review_at timestamptz;

-- 2. Backfill (before any new trigger exists). Only 10 rows qualify on 2026-10-27; line updated_at trigger
--    is suspended for this statement so updated_at is not bumped.
update regulatory.eaushadhi_product_review set saved_for_review_by=updated_by, saved_for_review_at=updated_at
 where review_status in ('IN_REVIEW','REVIEW_REQUIRED','VERIFIED') and updated_by is not null;
update regulatory.eaushadhi_product_classification_review set saved_for_review_by=updated_by, saved_for_review_at=updated_at
 where review_status in ('IN_REVIEW','REVIEW_REQUIRED','VERIFIED') and updated_by is not null;
alter table regulatory.eaushadhi_line_review disable trigger eaushadhi_line_review_set_updated_at;
update regulatory.eaushadhi_line_review set saved_for_review_by=updated_by, saved_for_review_at=updated_at
 where review_status in ('IN_REVIEW','REVIEW_REQUIRED','VERIFIED') and updated_by is not null;
alter table regulatory.eaushadhi_line_review enable trigger eaushadhi_line_review_set_updated_at;
update regulatory.eaushadhi_product_action_review set saved_for_review_by=updated_by, saved_for_review_at=updated_at
 where review_status in ('IN_REVIEW','REVIEW_REQUIRED','VERIFIED') and updated_by is not null;
update regulatory.eaushadhi_qc_preparation set saved_for_review_by=updated_by, saved_for_review_at=updated_at
 where preparation_status in ('IN_REVIEW','REVIEW_REQUIRED','VERIFIED') and updated_by is not null;

-- 3. Attested content per table (what a saver vouches for).
create function regulatory.eaushadhi_review_content_v1(p_table text, p_row jsonb) returns jsonb
language sql immutable set search_path to 'pg_temp' as $f$
  select case p_table
    when 'eaushadhi_product_review' then jsonb_build_array(
      p_row->'selected_permission_purpose_term_id', p_row->'selected_composition_title',
      p_row->'selected_diseases_conditions_text', p_row->'selected_contains_bhang', p_row->'selected_contains_opium',
      p_row->'selected_contains_other_narcotic', p_row->'selected_contains_schedule_e1',
      p_row->'selected_contains_self_generated_alcohol')
    when 'eaushadhi_product_classification_review' then jsonb_build_array(
      p_row->'selected_product_type_option_id', p_row->'selected_product_category_option_id',
      p_row->'selected_product_subtype_option_id', p_row->'selected_subtype_mode')
    when 'eaushadhi_line_review' then jsonb_build_array(
      p_row->'selected_ingredient_type_option_id', p_row->'selected_ingredient_form_option_id',
      p_row->'selected_part_used_option_id', p_row->'selected_measurement_option_id',
      p_row->'selected_reference_work_term_id')
    when 'eaushadhi_qc_preparation' then jsonb_build_array(p_row->'draft_payload')
  end
$f$;

-- 4. Saver maintenance. TG_ARGV[0] = status column, TG_ARGV[1] = 'track' (all writes) or 'claim' (UPDATE OF status).
create function regulatory.eaushadhi_saver_track() returns trigger
language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_uid uuid := auth.uid(); v_new text; v_old text;
begin
  v_new := to_jsonb(new)->>TG_ARGV[0];
  if TG_OP = 'INSERT' then
    if v_uid is not null and v_new not in ('PENDING','VERIFIED') then
      new.saved_for_review_by := v_uid; new.saved_for_review_at := now();
    else
      new.saved_for_review_by := null; new.saved_for_review_at := null;
    end if;
    return new;
  end if;
  v_old := to_jsonb(old)->>TG_ARGV[0];
  if TG_ARGV[1] = 'claim' then
    -- R5: runs after 'track' (name order); first stage save claims an empty saver.
    -- A reopen (OLD VERIFIED) never claims: all reopen paths require OLD VERIFIED (R2 wins).
    if v_uid is not null and v_new not in ('PENDING','VERIFIED') and v_old is distinct from 'VERIFIED'
       and new.saved_for_review_by is null then
      new.saved_for_review_by := v_uid; new.saved_for_review_at := now();
    end if;
    return new;
  end if;
  -- 'track': pin first, then apply R2/R3/R4.
  new.saved_for_review_by := old.saved_for_review_by; new.saved_for_review_at := old.saved_for_review_at;
  if v_new = 'VERIFIED' then return new; end if;                                     -- R7 handled by guard
  if v_old = 'VERIFIED' or v_new = 'PENDING' then                                    -- R2, R3
    new.saved_for_review_by := null; new.saved_for_review_at := null; return new;
  end if;
  if v_uid is not null and regulatory.eaushadhi_review_content_v1(TG_TABLE_NAME, to_jsonb(new))
       is distinct from regulatory.eaushadhi_review_content_v1(TG_TABLE_NAME, to_jsonb(old)) then  -- R4
    new.saved_for_review_by := v_uid; new.saved_for_review_at := now();
  end if;
  return new;                                                                         -- R6
end
$f$;

-- 5. Guards now read the saver column; approving write may not change attested content.
create or replace function regulatory.eaushadhi_four_eyes_guard() returns trigger
language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return new; end if;
  if (to_jsonb(new)->>TG_ARGV[0]) = 'VERIFIED' and (to_jsonb(old)->>TG_ARGV[0]) is distinct from 'VERIFIED' then
    perform regulatory.eaushadhi_four_eyes_check_v1(v_uid, old.saved_for_review_by);
    if regulatory.eaushadhi_review_content_v1(TG_TABLE_NAME, to_jsonb(new))
         is distinct from regulatory.eaushadhi_review_content_v1(TG_TABLE_NAME, to_jsonb(old)) then
      raise exception using errcode='42501', message='FOUR_EYES_CHANGED_ON_APPROVE',
        hint='You changed this step while approving it. Save your changes for review first; a different person then approves.';
    end if;
  end if;
  return new;
end
$f$;

create or replace function regulatory.eaushadhi_four_eyes_action_guard() returns trigger
language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_uid uuid := auth.uid(); v_key text;
begin
  if v_uid is null then
    if TG_OP = 'INSERT' then new.saved_for_review_by := null; new.saved_for_review_at := null; return new; end if;
    return old;
  end if;
  if TG_OP = 'DELETE' then
    v_key := 'eaushadhi_four_eyes.action_' || old.product_id;
    if old.review_status <> 'VERIFIED' and old.saved_for_review_by is not null then
      perform set_config(v_key, old.saved_for_review_by::text, true);
    end if;
    return old;
  end if;
  if new.review_status = 'VERIFIED' then
    new.saved_for_review_by := nullif(current_setting('eaushadhi_four_eyes.action_' || new.product_id, true), '')::uuid;
    perform regulatory.eaushadhi_four_eyes_check_v1(v_uid, new.saved_for_review_by);
    new.saved_for_review_at := null;
  elsif new.review_status = 'PENDING' then
    new.saved_for_review_by := null; new.saved_for_review_at := null;
  else
    new.saved_for_review_by := v_uid; new.saved_for_review_at := now();
  end if;
  return new;
end
$f$;

-- Action reopen (UPDATE VERIFIED -> IN_REVIEW) and any other action UPDATE: pin, clear on reopen.
create function regulatory.eaushadhi_action_saver_track() returns trigger
language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
begin
  new.saved_for_review_by := old.saved_for_review_by; new.saved_for_review_at := old.saved_for_review_at;
  if old.review_status = 'VERIFIED' and new.review_status <> 'VERIFIED' then
    new.saved_for_review_by := null; new.saved_for_review_at := null;
  end if;
  return new;
end
$f$;

revoke all on function regulatory.eaushadhi_review_content_v1(text,jsonb) from public, anon, authenticated;
revoke all on function regulatory.eaushadhi_saver_track() from public, anon, authenticated;
revoke all on function regulatory.eaushadhi_action_saver_track() from public, anon, authenticated;
revoke all on function regulatory.eaushadhi_four_eyes_guard() from public, anon, authenticated;
revoke all on function regulatory.eaushadhi_four_eyes_action_guard() from public, anon, authenticated;

-- Names sort so 'saver_1_track' runs before 'saver_2_claim' (BEFORE triggers fire in name order).
create trigger eaushadhi_product_review_saver_1_track before insert or update on regulatory.eaushadhi_product_review
  for each row execute function regulatory.eaushadhi_saver_track('review_status','track');
create trigger eaushadhi_product_review_saver_2_claim before update of review_status on regulatory.eaushadhi_product_review
  for each row execute function regulatory.eaushadhi_saver_track('review_status','claim');
create trigger eaushadhi_product_classification_review_saver_1_track before insert or update on regulatory.eaushadhi_product_classification_review
  for each row execute function regulatory.eaushadhi_saver_track('review_status','track');
create trigger eaushadhi_product_classification_review_saver_2_claim before update of review_status on regulatory.eaushadhi_product_classification_review
  for each row execute function regulatory.eaushadhi_saver_track('review_status','claim');
create trigger eaushadhi_line_review_saver_1_track before insert or update on regulatory.eaushadhi_line_review
  for each row execute function regulatory.eaushadhi_saver_track('review_status','track');
create trigger eaushadhi_line_review_saver_2_claim before update of review_status on regulatory.eaushadhi_line_review
  for each row execute function regulatory.eaushadhi_saver_track('review_status','claim');
create trigger eaushadhi_qc_preparation_saver_1_track before insert or update on regulatory.eaushadhi_qc_preparation
  for each row execute function regulatory.eaushadhi_saver_track('preparation_status','track');
create trigger eaushadhi_qc_preparation_saver_2_claim before update of preparation_status on regulatory.eaushadhi_qc_preparation
  for each row execute function regulatory.eaushadhi_saver_track('preparation_status','claim');
create trigger eaushadhi_product_action_review_saver_1_track before update on regulatory.eaushadhi_product_action_review
  for each row execute function regulatory.eaushadhi_action_saver_track();

-- 6. Stage state RPC reads the saver column (same signature and columns; client unchanged).
create or replace function public.rpc_eaushadhi_stage_review_state_v1(p_product_id integer)
returns table(stage text, item_key text, review_status text, saved_by uuid, saved_by_name text,
              saved_at timestamptz, saved_by_me boolean, can_approve boolean, block_code text)
language sql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
  with me as (
    select auth.uid() uid,
           coalesce(regulatory.eaushadhi_has_role_v1(auth.uid(),'APPROVER'), false) is_approver
    where auth.uid() is not null
      and exists(select 1 from public.user_permissions_canonical up
                 where up.user_id=auth.uid() and up.target='module:e-aushadhi-automation'
                   and (up.can_view or up.can_edit))
  ), s as (
    select 'details'::text stage, null::text item_key, pr.review_status, pr.saved_for_review_by sb, pr.saved_for_review_at sa
      from regulatory.eaushadhi_product_review pr where pr.product_id=p_product_id
    union all
    select 'classification', null, c.review_status, c.saved_for_review_by, c.saved_for_review_at
      from regulatory.eaushadhi_product_classification_review c where c.product_id=p_product_id
    union all
    select 'line', l.source_composition_line_id::text, l.review_status, l.saved_for_review_by, l.saved_for_review_at
      from regulatory.eaushadhi_line_review l where l.product_id=p_product_id
    union all
    select 'actions', null, a.review_status, a.saved_for_review_by, a.saved_for_review_at
      from (select distinct on (product_id) * from regulatory.eaushadhi_product_action_review
            where product_id=p_product_id order by product_id, updated_at desc nulls last, sequence_no) a
    union all
    select 'qc', q.preparation_id::text, q.preparation_status, q.saved_for_review_by, q.saved_for_review_at
      from regulatory.eaushadhi_qc_preparation q where q.product_id=p_product_id
  )
  select s.stage, s.item_key, s.review_status, s.sb, p.full_name, s.sa,
         coalesce(s.sb = me.uid, false),
         (s.review_status <> 'VERIFIED' and me.is_approver and s.sb is not null and s.sb <> me.uid),
         case when s.review_status = 'VERIFIED' then null
              when not me.is_approver then 'APPROVER_ROLE_REQUIRED'
              when s.sb is null then 'FOUR_EYES_NOT_SAVED_FOR_REVIEW'
              when s.sb = me.uid then 'FOUR_EYES_SAME_PERSON' end
  from s cross join me
  left join public.profiles p on p.id = s.sb;
$f$;

revoke all on function public.rpc_eaushadhi_stage_review_state_v1(integer) from public, anon;
grant execute on function public.rpc_eaushadhi_stage_review_state_v1(integer) to authenticated;
