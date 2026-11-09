-- WP05-W506-SEC-FIX-02 -- minimum server-side authorisation guard for the Staff Governance CLOSE writer (companion to
-- WP05-W506-SEC-FIX-01 / PR #254, which guards the Save writer). PROPOSED / FOR REVIEW ONLY. NOT APPLIED. Applying it to
-- production is a separate, explicit owner decision (see docs/master-data-costing/WP05_W506_SEC_FIX_02_*.md).
--
-- Finding (independent SELECT-only readback of production PostgreSQL 17.4, 9 Nov 2026):
--   costing.rpc_close_staff_costing_classification(bigint,date,text) is SECURITY DEFINER, UPDATEs
--   costing.staff_costing_classification (effective_to, is_active, remarks, updated_at) and contains NO require_permission /
--   auth.uid() guard. It is reachable by authenticated and service_role through the SECURITY DEFINER wrapper
--   public.rpc_close_staff_costing_classification(bigint,date,text).
--
-- Fix (minimum, same temporary policy as PR #254): make the FIRST executable statement after the main BEGIN of the INTERNAL function
--   PERFORM public.require_permission('module:cost-build-manager', true);        -- can_view AND can_edit
-- The public wrapper is NOT modified; it must be byte-identical (full definition) to the reviewed live wrapper or this
-- migration aborts. No identity is hard-coded; no service-role bypass.
--
-- Verified live fingerprints (md5 of pg_get_functiondef(oid) -- FULL DEFINITION ONLY; PostgreSQL 17.4 readback):
--   internal  1c9884c0ca0321eda6055feaa6bd64de   (prosrc md5 82f1b8b699f078505f1fd7211d9d2741 informational only)
--   wrapper   a8254681b64a6e78b59f1d2b00d9a7df   (prosrc md5 af0b4c4dfb69a6349a6e88ec433f2af9 informational only)
--   declaration prefix: substr(prosrc,1,174) (CRLF, ends with CR), md5 255b487148e29e51fa841048e8d248c9; first BEGIN match at 175.
--
-- Fail-closed design (identical architecture to PR #254): exact regprocedure lookups and a single internal overload; wrapper
-- full-definition md5 must match (EXCEPTION); preimage path patches ONE pure insertion and re-verifies; the idempotent path
-- accepts an already-guarded function only if removing the guard restores the verified original AND re-patching the original
-- reproduces the live body byte for byte; the declaration section must equal the verified live prefix byte for byte (else the
-- strict generic check rejects comments/quotes/dollar quotes/labels); post-install proof that definition minus guard hashes to
-- the original and that signature, return type, volatility, SECURITY DEFINER, config, ACL, owner, language, OID and the wrapper
-- definition are unchanged. No GRANT / REVOKE / DROP / wrapper change.
-- Rollback (a SECURITY REGRESSION, containment-first): docs/master-data-costing/prepared/WP05_W506_SEC_FIX_02_ROLLBACK.sql (not executed).
begin;

create function pg_temp.w506_close_guard_patch(p_src text, p_prefix_len int, p_prefix_md5 text) returns text
language plpgsql set search_path = pg_catalog, pg_temp as $f$
declare
  c_guard  constant text := 'perform public.require_permission(''module:cost-build-manager'', true);';
  c_insert constant text := E'\n  ' || c_guard || E'\n';
  c_begin_re constant text := '(^|[^[:alnum:]_])(begin)([[:space:]])';
  v_pos int; v_before text; v_out text;
begin
  v_pos := regexp_instr(p_src, c_begin_re, 1, 1, 0, 'i');
  if v_pos = 0 then
    raise exception 'W506-SEC-FIX-02 aborted: no BEGIN followed by whitespace found in function body';
  end if;
  v_before := substr(p_src, 1, v_pos - 1);
  if p_prefix_len is not null and v_pos = p_prefix_len + 1 and md5(substr(p_src, 1, p_prefix_len)) = p_prefix_md5 then
    -- The ENTIRE declaration prefix (every byte before the first BEGIN match) equals the independently verified live
    -- prefix (length and md5 supplied by the caller, which has already verified the full-definition md5). No individual
    -- quote/comment exceptions exist: any difference falls through to the strict generic check below.
    null;
  else
    -- generic strict path: only an optional plain DECLARE section may precede the main BEGIN: no comments, quotes,
    -- dollar quotes or labels
    if not (v_before ~* '^[[:space:]]*$' or v_before ~* '^[[:space:]]*declare[[:space:]]') then
      raise exception 'W506-SEC-FIX-02 aborted: unexpected text before the first BEGIN (label or other construct); refusing to guess';
    end if;
    if v_before ~ '(--|/\*|\$|<<|'')' then
      raise exception 'W506-SEC-FIX-02 aborted: comment, quote or label before the first BEGIN; refusing to guess';
    end if;
  end if;
  v_out := regexp_replace(p_src, c_begin_re, '\1\2' || c_insert || '\3', 'i');   -- no g flag: first match only
  if length(v_out) - length(p_src) <> length(c_insert) or replace(v_out, c_insert, '') <> p_src then
    raise exception 'W506-SEC-FIX-02 aborted: patch is not a single pure insertion';
  end if;
  return v_out;
end
$f$;

do $migration$
declare
  c_internal_def_fp constant text := '1c9884c0ca0321eda6055feaa6bd64de';
  c_wrapper_def_fp  constant text := 'a8254681b64a6e78b59f1d2b00d9a7df';
  -- Exact live declaration prefix = substr(prosrc, 1, 174) (CRLF; leading CRLF through the CR preceding the LF that the
  -- BEGIN pattern consumes), md5 from the owner's 17.4 readback; the first BEGIN match therefore starts at 175.
  c_live_prefix_len constant int  := 174;
  c_live_prefix_md5 constant text := '255b487148e29e51fa841048e8d248c9';
  c_guard  constant text := 'perform public.require_permission(''module:cost-build-manager'', true);';
  c_insert constant text := E'\n  ' || c_guard || E'\n';
  v_oid oid; v_wrap oid; v_n int;
  v_def text; v_src text; v_patched text; v_new_def text; v_live_def text; v_orig_def text; v_orig_src text;
  v_pre record; v_post record; v_wrap_pre text;
begin
  -- 1. exact targets
  v_oid  := to_regprocedure('costing.rpc_close_staff_costing_classification(bigint,date,text)');
  v_wrap := to_regprocedure('public.rpc_close_staff_costing_classification(bigint,date,text)');
  if v_oid is null or v_wrap is null then
    raise exception 'W506-SEC-FIX-02 aborted: internal or public wrapper signature not found';
  end if;
  select count(*) into v_n from pg_proc p
   where p.pronamespace = 'costing'::regnamespace and p.proname = 'rpc_close_staff_costing_classification';
  if v_n <> 1 then
    raise exception 'W506-SEC-FIX-02 aborted: expected exactly one costing.rpc_close_staff_costing_classification overload, found %', v_n;
  end if;

  -- 2. wrapper must be exactly the verified definition (fail closed; substring checks are not sufficient)
  v_wrap_pre := pg_get_functiondef(v_wrap);
  if md5(v_wrap_pre) <> c_wrapper_def_fp then
    raise exception 'W506-SEC-FIX-02 aborted: public wrapper full-definition md5 % differs from verified %', md5(v_wrap_pre), c_wrapper_def_fp;
  end if;

  v_def := pg_get_functiondef(v_oid);
  select p.prosrc into v_src from pg_proc p where p.oid = v_oid;
  if (length(v_def) - length(replace(v_def, v_src, ''))) <> length(v_src) then
    raise exception 'W506-SEC-FIX-02 aborted: live body text does not occur exactly once in its definition';
  end if;

  -- 3. choose path by the FULL-DEFINITION fingerprint only
  if md5(v_def) <> c_internal_def_fp then
    -- 3a. possibly already fixed: must be exactly (verified original + the single deterministic insertion)
    if position(c_insert in v_def) = 0
       or (length(v_def) - length(replace(v_def, c_insert, ''))) <> length(c_insert)
       or (length(v_src) - length(replace(v_src, c_insert, ''))) <> length(c_insert) then
      raise exception 'W506-SEC-FIX-02 aborted: live definition md5 % is neither the verified original nor a verified guarded form', md5(v_def);
    end if;
    v_orig_def := replace(v_def, c_insert, '');
    v_orig_src := replace(v_src, c_insert, '');
    if md5(v_orig_def) <> c_internal_def_fp then
      raise exception 'W506-SEC-FIX-02 aborted: removing the guard does not restore the verified original definition (drift)';
    end if;
    if pg_temp.w506_close_guard_patch(v_orig_src, c_live_prefix_len, c_live_prefix_md5) <> v_src then
      raise exception 'W506-SEC-FIX-02 aborted: existing guard is not the expected first-statement insertion';
    end if;
    raise notice 'W506-SEC-FIX-02: internal function verified as already guarded (original + exact insertion); nothing to do';
    return;
  end if;

  -- 4. preimage path: single verified insertion
  if v_src ~* 'require_permission' then
    raise exception 'W506-SEC-FIX-02 aborted: unexpected require_permission reference in fingerprint-matched body';
  end if;
  v_patched := pg_temp.w506_close_guard_patch(v_src, c_live_prefix_len, c_live_prefix_md5);
  v_new_def := replace(v_def, v_src, v_patched);
  if replace(v_new_def, c_insert, '') <> v_def then
    raise exception 'W506-SEC-FIX-02 aborted: patched definition minus guard does not equal the live definition';
  end if;

  select p.proargtypes::text a, p.prorettype r, p.proretset s, p.provolatile v, p.prosecdef d, p.proconfig c, p.proacl l,
         p.proowner o, p.prolang g, p.proisstrict t, p.proparallel pl, p.proleakproof k, p.prokind kd, p.pronargdefaults nd
    into v_pre from pg_proc p where p.oid = v_oid;

  execute v_new_def;

  select p.proargtypes::text a, p.prorettype r, p.proretset s, p.provolatile v, p.prosecdef d, p.proconfig c, p.proacl l,
         p.proowner o, p.prolang g, p.proisstrict t, p.proparallel pl, p.proleakproof k, p.prokind kd, p.pronargdefaults nd, p.oid x
    into v_post from pg_proc p where p.pronamespace = 'costing'::regnamespace and p.proname = 'rpc_close_staff_costing_classification';

  if v_post.x <> v_oid
     or v_pre.a is distinct from v_post.a or v_pre.r is distinct from v_post.r or v_pre.s is distinct from v_post.s
     or v_pre.v is distinct from v_post.v or v_pre.d is distinct from v_post.d or v_pre.c is distinct from v_post.c
     or v_pre.l is distinct from v_post.l or v_pre.o is distinct from v_post.o or v_pre.g is distinct from v_post.g
     or v_pre.t is distinct from v_post.t or v_pre.pl is distinct from v_post.pl or v_pre.k is distinct from v_post.k
     or v_pre.kd is distinct from v_post.kd or v_pre.nd is distinct from v_post.nd then
    raise exception 'W506-SEC-FIX-02 aborted: function properties (signature/return/volatility/definer/config/ACL/owner) changed unexpectedly';
  end if;
  v_live_def := pg_get_functiondef(v_oid);
  if md5(replace(v_live_def, c_insert, '')) <> c_internal_def_fp
     or (length(v_live_def) - length(replace(v_live_def, c_insert, ''))) <> length(c_insert) then
    raise exception 'W506-SEC-FIX-02 aborted: installed definition minus the guard does not hash to the verified original';
  end if;
  if (select prosrc from pg_proc where oid = v_oid) <> v_patched then
    raise exception 'W506-SEC-FIX-02 aborted: installed body differs from the verified patched body';
  end if;
  if md5(pg_get_functiondef(v_wrap)) <> c_wrapper_def_fp then
    raise exception 'W506-SEC-FIX-02 aborted: wrapper definition changed during migration';
  end if;
end
$migration$;

commit;
