-- WP05-W506-SEC-FIX-01 -- minimum server-side authorisation guard for the Staff Governance writer.
-- PROPOSED / FOR REVIEW ONLY. NOT APPLIED. Owner authorisation covers this DRAFT PR only; applying it to
-- production is a separate, explicit owner decision (see docs/master-data-costing/WP05_W506_SEC_FIX_01_*.md).
--
-- Finding (live SELECT-only catalogue review recorded in issue #234, 9 Nov 2026):
--   costing.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text) is SECURITY DEFINER, VOLATILE,
--   UPDATEs/INSERTs costing.staff_costing_classification and contains NO require_permission / auth.uid() guard.
--   It is reachable by every authenticated user through the SECURITY DEFINER wrapper
--   public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text).
--
-- Fix (minimum): make the FIRST executable statement after the main BEGIN of the INTERNAL function
--   PERFORM public.require_permission('module:cost-build-manager', true);        -- can_view AND can_edit
-- The public wrapper is NOT modified; it must, however, be byte-identical (full definition) to the reviewed live
-- wrapper or this migration aborts, because the delegation path is a precondition of the fix.
--
-- Verified live fingerprints (independent review, 9 Nov 2026, md5 of pg_get_functiondef(oid) -- FULL DEFINITION ONLY):
--   internal  553d103a5afedda3191c1aa62c33be7c   (prosrc md5 d80f2103c83428083e2d1902837317e6 is informational only)
--   wrapper   6ba709477ecc7755fb6005b6e2203a2b   (prosrc md5 2878e20495d1be6baabd980feecb8918 is informational only)
--
-- Fail-closed design:
--  * Exact regprocedure lookups, exactly one overload of the internal name, no name-only matching.
--  * Wrapper full-definition md5 must equal the verified value (EXCEPTION, not a warning).
--  * Preimage path: internal full-definition md5 must equal the verified value; the body is patched by ONE pure
--    insertion (pg_temp.w506_guard_patch); the result is re-verified.
--  * Idempotent path: an already-guarded function is accepted ONLY if removing the exact guard text restores the verified
--    original full-definition md5 AND re-applying the deterministic patch to that original reproduces the live body
--    byte for byte (so the guard is the expected first statement and nothing else differs). Otherwise abort.
--  * Shape: only an optional plain DECLARE section may precede the main BEGIN; comments, quotes, dollar quotes or labels
--    there abort (a regexp is not a PL/pgSQL parser, so unknown shapes are refused rather than guessed).
--    The ONE controlled exception is the live declaration: the three exact quoted empty-string initialisers
--    (v_costing_class / v_allocation_pool / v_remarks := ... nullif(trim(p_...), '')) are tolerated, each required exactly
--    once, and ONLY when the body length (4288) and first-BEGIN position (508) match the independently verified live
--    values AND the full-definition md5 has already been verified. After stripping those three statements the remainder
--    is still checked for comments, quotes, dollar quotes and labels. CRLF is handled (whitespace classes).
--  * After execution: full definition minus the guard must again hash to the verified original; signature, return type,
--    volatility, SECURITY DEFINER, config (search_path), ACL, owner, language, OID, and the wrapper full definition hash
--    are unchanged. Any failure rolls the single transaction back.
--  * No GRANT / REVOKE / DROP / wrapper change.
-- Rollback (a SECURITY REGRESSION, containment-first policy applies): docs/master-data-costing/prepared/WP05_W506_SEC_FIX_01_ROLLBACK.sql (not executed).
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

do $migration$
declare
  c_internal_def_fp constant text := '553d103a5afedda3191c1aa62c33be7c';
  c_wrapper_def_fp  constant text := '6ba709477ecc7755fb6005b6e2203a2b';
  c_live_src_len    constant int  := 4288;   -- length(prosrc) of the verified live internal function
  c_live_begin_pos  constant int  := 508;    -- regexp position of its first BEGIN under the helper's pattern
  c_guard  constant text := 'perform public.require_permission(''module:cost-build-manager'', true);';
  c_insert constant text := E'\n  ' || c_guard || E'\n';
  v_oid oid; v_wrap oid; v_n int;
  v_def text; v_src text; v_patched text; v_new_def text; v_live_def text; v_orig_def text; v_orig_src text;
  v_pre record; v_post record; v_wrap_pre text;
begin
  -- 1. exact targets
  v_oid  := to_regprocedure('costing.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)');
  v_wrap := to_regprocedure('public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)');
  if v_oid is null or v_wrap is null then
    raise exception 'W506-SEC-FIX-01 aborted: internal or public wrapper signature not found';
  end if;
  select count(*) into v_n from pg_proc p
   where p.pronamespace = 'costing'::regnamespace and p.proname = 'rpc_set_staff_costing_classification';
  if v_n <> 1 then
    raise exception 'W506-SEC-FIX-01 aborted: expected exactly one costing.rpc_set_staff_costing_classification overload, found %', v_n;
  end if;

  -- 2. wrapper must be exactly the verified definition (fail closed; substring checks are not sufficient)
  v_wrap_pre := pg_get_functiondef(v_wrap);
  if md5(v_wrap_pre) <> c_wrapper_def_fp then
    raise exception 'W506-SEC-FIX-01 aborted: public wrapper full-definition md5 % differs from verified %', md5(v_wrap_pre), c_wrapper_def_fp;
  end if;

  v_def := pg_get_functiondef(v_oid);
  select p.prosrc into v_src from pg_proc p where p.oid = v_oid;
  if (length(v_def) - length(replace(v_def, v_src, ''))) <> length(v_src) then
    raise exception 'W506-SEC-FIX-01 aborted: live body text does not occur exactly once in its definition';
  end if;

  -- 3. choose path by the FULL-DEFINITION fingerprint only
  if md5(v_def) <> c_internal_def_fp then
    -- 3a. possibly already fixed: must be exactly (verified original + the single deterministic insertion)
    if position(c_insert in v_def) = 0
       or (length(v_def) - length(replace(v_def, c_insert, ''))) <> length(c_insert)
       or (length(v_src) - length(replace(v_src, c_insert, ''))) <> length(c_insert) then
      raise exception 'W506-SEC-FIX-01 aborted: live definition md5 % is neither the verified original nor a verified guarded form', md5(v_def);
    end if;
    v_orig_def := replace(v_def, c_insert, '');
    v_orig_src := replace(v_src, c_insert, '');
    if md5(v_orig_def) <> c_internal_def_fp then
      raise exception 'W506-SEC-FIX-01 aborted: removing the guard does not restore the verified original definition (drift)';
    end if;
    if pg_temp.w506_guard_patch(v_orig_src, c_live_src_len, c_live_begin_pos) <> v_src then
      raise exception 'W506-SEC-FIX-01 aborted: existing guard is not the expected first-statement insertion';
    end if;
    raise notice 'W506-SEC-FIX-01: internal function verified as already guarded (original + exact insertion); nothing to do';
    return;
  end if;

  -- 4. preimage path: single verified insertion
  if v_src ~* 'require_permission' then
    raise exception 'W506-SEC-FIX-01 aborted: unexpected require_permission reference in fingerprint-matched body';
  end if;
  v_patched := pg_temp.w506_guard_patch(v_src, c_live_src_len, c_live_begin_pos);
  v_new_def := replace(v_def, v_src, v_patched);
  if replace(v_new_def, c_insert, '') <> v_def then
    raise exception 'W506-SEC-FIX-01 aborted: patched definition minus guard does not equal the live definition';
  end if;

  select p.proargtypes::text a, p.prorettype r, p.proretset s, p.provolatile v, p.prosecdef d, p.proconfig c, p.proacl l,
         p.proowner o, p.prolang g, p.proisstrict t, p.proparallel pl, p.proleakproof k, p.prokind kd, p.pronargdefaults nd
    into v_pre from pg_proc p where p.oid = v_oid;

  execute v_new_def;

  select p.proargtypes::text a, p.prorettype r, p.proretset s, p.provolatile v, p.prosecdef d, p.proconfig c, p.proacl l,
         p.proowner o, p.prolang g, p.proisstrict t, p.proparallel pl, p.proleakproof k, p.prokind kd, p.pronargdefaults nd, p.oid x
    into v_post from pg_proc p where p.pronamespace = 'costing'::regnamespace and p.proname = 'rpc_set_staff_costing_classification';

  if v_post.x <> v_oid
     or v_pre.a is distinct from v_post.a or v_pre.r is distinct from v_post.r or v_pre.s is distinct from v_post.s
     or v_pre.v is distinct from v_post.v or v_pre.d is distinct from v_post.d or v_pre.c is distinct from v_post.c
     or v_pre.l is distinct from v_post.l or v_pre.o is distinct from v_post.o or v_pre.g is distinct from v_post.g
     or v_pre.t is distinct from v_post.t or v_pre.pl is distinct from v_post.pl or v_pre.k is distinct from v_post.k
     or v_pre.kd is distinct from v_post.kd or v_pre.nd is distinct from v_post.nd then
    raise exception 'W506-SEC-FIX-01 aborted: function properties (signature/return/volatility/definer/config/ACL/owner) changed unexpectedly';
  end if;
  v_live_def := pg_get_functiondef(v_oid);
  if md5(replace(v_live_def, c_insert, '')) <> c_internal_def_fp
     or (length(v_live_def) - length(replace(v_live_def, c_insert, ''))) <> length(c_insert) then
    raise exception 'W506-SEC-FIX-01 aborted: installed definition minus the guard does not hash to the verified original';
  end if;
  if (select prosrc from pg_proc where oid = v_oid) <> v_patched then
    raise exception 'W506-SEC-FIX-01 aborted: installed body differs from the verified patched body';
  end if;
  if md5(pg_get_functiondef(v_wrap)) <> c_wrapper_def_fp then
    raise exception 'W506-SEC-FIX-01 aborted: wrapper definition changed during migration';
  end if;
end
$migration$;

commit;
