-- WP05-W506-SEC-FIX-01 ROLLBACK PROCEDURE -- PREPARED, NOT EXECUTED. Do not run without explicit owner EMERGENCY approval.
--
-- !! SECURITY REGRESSION !! Running this removes the server-side guard and RE-OPENS a confirmed missing-authorisation
-- finding (any authenticated user can invoke the writer through the public wrapper). Containment-first policy:
-- prefer a forward fix or an equivalent protective control (e.g. a reviewed alternative guard) over restoring the
-- unguarded writer. Use only if the guard itself breaks a legitimate workflow AND an alternative control is in place.
-- No successful privilege bypass in production has been demonstrated; the finding is the missing guard.
--
-- Interlock: the session must set  w506.rollback_owner_emergency_approval  to the exact phrase below, otherwise abort:
--   set w506.rollback_owner_emergency_approval = 'I-HAVE-OWNER-EMERGENCY-APPROVAL-AND-AN-ALTERNATIVE-CONTROL';
--
-- Fail-closed: the wrapper must hash to the verified definition; the live internal function must be EXACTLY the verified
-- original definition plus the single deterministic guard insertion (same proof as the migration's idempotent path);
-- the restored definition must hash to the verified original; properties/ACL/OID/wrapper unchanged.
begin;

create function pg_temp.w506_guard_patch(p_src text, p_expect_len int, p_expect_begin int) returns text
language plpgsql set search_path = pg_catalog, pg_temp as $f$
declare
  c_guard  constant text := 'perform public.require_permission(''module:cost-build-manager'', true);';
  c_insert constant text := E'\n  ' || c_guard || E'\n';
  c_begin_re constant text := '(^|[^[:alnum:]_])(begin)([[:space:]])';
  v_pos int; v_before text; v_out text; v_check text; v_re text;
  -- The ONLY quote characters tolerated before the main BEGIN: the three exact empty-string initialisers observed in the
  -- live declaration (independent SELECT-only review, 9 Nov 2026), whitespace-flexible, each required exactly once, and
  -- only when the body length and BEGIN position match the verified live values passed in by the caller (the caller
  -- itself has already verified the full-definition md5).
  c_live_decls constant text[] := array[
    'v_costing_class[[:space:]]+text[[:space:]]*:=[[:space:]]*upper\([[:space:]]*nullif\([[:space:]]*trim\([[:space:]]*p_costing_class[[:space:]]*\)[[:space:]]*,[[:space:]]*''''[[:space:]]*\)[[:space:]]*\)[[:space:]]*;',
    'v_allocation_pool[[:space:]]+text[[:space:]]*:=[[:space:]]*upper\([[:space:]]*nullif\([[:space:]]*trim\([[:space:]]*p_allocation_pool[[:space:]]*\)[[:space:]]*,[[:space:]]*''''[[:space:]]*\)[[:space:]]*\)[[:space:]]*;',
    'v_remarks[[:space:]]+text[[:space:]]*:=[[:space:]]*nullif\([[:space:]]*trim\([[:space:]]*p_remarks[[:space:]]*\)[[:space:]]*,[[:space:]]*''''[[:space:]]*\)[[:space:]]*;'];
begin
  v_pos := regexp_instr(p_src, c_begin_re, 1, 1, 0, 'i');
  if v_pos = 0 then
    raise exception 'W506-SEC-FIX-01 aborted: no BEGIN followed by whitespace found in function body';
  end if;
  v_before := substr(p_src, 1, v_pos - 1);
  -- only an optional plain DECLARE section may precede the main BEGIN: no comments, quotes, dollar quotes or labels
  if not (v_before ~* '^[[:space:]]*$' or v_before ~* '^[[:space:]]*declare[[:space:]]') then
    raise exception 'W506-SEC-FIX-01 aborted: unexpected text before the first BEGIN (label or other construct); refusing to guess';
  end if;
  v_check := v_before;
  if length(p_src) = p_expect_len and v_pos = p_expect_begin then
    foreach v_re in array c_live_decls loop
      if (select count(*) from regexp_matches(v_check, v_re, 'gi')) <> 1 then
        raise exception 'W506-SEC-FIX-01 aborted: expected live declaration initialiser not found exactly once before the first BEGIN';
      end if;
      v_check := regexp_replace(v_check, v_re, ' ', 'i');
    end loop;
  end if;
  if v_check ~ '(--|/\*|\$|<<|'')' then
    raise exception 'W506-SEC-FIX-01 aborted: comment, quote or label before the first BEGIN; refusing to guess';
  end if;
  v_out := regexp_replace(p_src, c_begin_re, '\1\2' || c_insert || '\3', 'i');   -- no g flag: first match only
  if length(v_out) - length(p_src) <> length(c_insert) or replace(v_out, c_insert, '') <> p_src then
    raise exception 'W506-SEC-FIX-01 aborted: patch is not a single pure insertion';
  end if;
  return v_out;
end
$f$;

do $rollback$
declare
  c_internal_def_fp constant text := '553d103a5afedda3191c1aa62c33be7c';
  c_wrapper_def_fp  constant text := '6ba709477ecc7755fb6005b6e2203a2b';
  c_live_src_len    constant int  := 4288;   -- length(prosrc) of the verified live internal function
  c_live_begin_pos  constant int  := 508;    -- regexp position of its first BEGIN under the helper's pattern
  c_ack constant text := 'I-HAVE-OWNER-EMERGENCY-APPROVAL-AND-AN-ALTERNATIVE-CONTROL';
  c_guard  constant text := 'perform public.require_permission(''module:cost-build-manager'', true);';
  c_insert constant text := E'\n  ' || c_guard || E'\n';
  v_oid oid; v_wrap oid; v_n int; v_def text; v_src text; v_orig_def text; v_orig_src text; v_live text;
  v_pre record; v_post record;
begin
  if coalesce(current_setting('w506.rollback_owner_emergency_approval', true), '') <> c_ack then
    raise exception 'rollback aborted: owner emergency approval interlock not set';
  end if;
  v_oid  := to_regprocedure('costing.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)');
  v_wrap := to_regprocedure('public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)');
  if v_oid is null or v_wrap is null then raise exception 'rollback aborted: signature not found'; end if;
  select count(*) into v_n from pg_proc p where p.pronamespace = 'costing'::regnamespace and p.proname = 'rpc_set_staff_costing_classification';
  if v_n <> 1 then raise exception 'rollback aborted: expected one internal overload, found %', v_n; end if;
  if md5(pg_get_functiondef(v_wrap)) <> c_wrapper_def_fp then
    raise exception 'rollback aborted: public wrapper definition differs from the verified one';
  end if;
  v_def := pg_get_functiondef(v_oid);
  select prosrc into v_src from pg_proc where oid = v_oid;
  if md5(v_def) = c_internal_def_fp then
    raise notice 'rollback: function is already the verified unguarded original; nothing to do';
    return;
  end if;
  if (length(v_def) - length(replace(v_def, c_insert, ''))) <> length(c_insert)
     or (length(v_src) - length(replace(v_src, c_insert, ''))) <> length(c_insert) then
    raise exception 'rollback aborted: guard text not found exactly once (unexpected guarded-definition drift)';
  end if;
  v_orig_def := replace(v_def, c_insert, '');
  v_orig_src := replace(v_src, c_insert, '');
  if md5(v_orig_def) <> c_internal_def_fp then
    raise exception 'rollback aborted: definition minus guard does not hash to the verified original (drift)';
  end if;
  if pg_temp.w506_guard_patch(v_orig_src, c_live_src_len, c_live_begin_pos) <> v_src then
    raise exception 'rollback aborted: guarded definition is not the expected deterministic insertion (drift)';
  end if;
  select p.proargtypes::text a, p.prorettype r, p.proretset s, p.provolatile v, p.prosecdef d, p.proconfig c, p.proacl l,
         p.proowner o, p.prolang g, p.proisstrict t, p.proparallel pl, p.proleakproof k, p.prokind kd, p.pronargdefaults nd
    into v_pre from pg_proc p where p.oid = v_oid;
  execute v_orig_def;
  select p.proargtypes::text a, p.prorettype r, p.proretset s, p.provolatile v, p.prosecdef d, p.proconfig c, p.proacl l,
         p.proowner o, p.prolang g, p.proisstrict t, p.proparallel pl, p.proleakproof k, p.prokind kd, p.pronargdefaults nd, p.oid x
    into v_post from pg_proc p where p.pronamespace = 'costing'::regnamespace and p.proname = 'rpc_set_staff_costing_classification';
  v_live := pg_get_functiondef(v_oid);
  if md5(v_live) <> c_internal_def_fp then raise exception 'rollback aborted: restored definition does not hash to the verified original'; end if;
  if v_post.x <> v_oid
     or v_pre.a is distinct from v_post.a or v_pre.r is distinct from v_post.r or v_pre.s is distinct from v_post.s
     or v_pre.v is distinct from v_post.v or v_pre.d is distinct from v_post.d or v_pre.c is distinct from v_post.c
     or v_pre.l is distinct from v_post.l or v_pre.o is distinct from v_post.o or v_pre.g is distinct from v_post.g
     or v_pre.t is distinct from v_post.t or v_pre.pl is distinct from v_post.pl or v_pre.k is distinct from v_post.k
     or v_pre.kd is distinct from v_post.kd or v_pre.nd is distinct from v_post.nd then
    raise exception 'rollback aborted: function properties changed unexpectedly';
  end if;
  if md5(pg_get_functiondef(v_wrap)) <> c_wrapper_def_fp then raise exception 'rollback aborted: wrapper changed'; end if;
end
$rollback$;
commit;
