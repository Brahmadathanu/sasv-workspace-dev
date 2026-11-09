-- WP05-W506-SEC-FIX-01 -- minimum server-side authorisation guard for the Staff Governance writer.
-- PROPOSED / FOR REVIEW ONLY. NOT APPLIED. Owner authorisation covers this DRAFT PR only; applying it to
-- production is a separate, explicit owner decision (see docs/master-data-costing/WP05_W506_SEC_FIX_01_*.md).
--
-- Finding (live SELECT-only catalogue review recorded in issue #234, 9 Nov 2026):
--   costing.rpc_set_staff_costing_classification(...) is SECURITY DEFINER, VOLATILE, UPDATEs/INSERTs
--   costing.staff_costing_classification and contains NO require_permission / auth.uid() guard.
--   It is reachable by every authenticated user through the SECURITY DEFINER public wrapper
--   public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)  (SQL body, md5 6ba709477ecc7755fb6005b6e2203a2b).
--
-- Fix (minimum): make the FIRST statement after the main BEGIN of the INTERNAL function
--   PERFORM public.require_permission('module:cost-build-manager', true);
-- (can_view AND can_edit). The public wrapper is NOT modified: it delegates to the internal function, so
-- every path is guarded, and re-writing a live SQL wrapper would add drift surface without extra protection.
--
-- Safety design:
--  * The live definition is read with pg_get_functiondef(); this file contains NO copy of the function body.
--  * Fail closed unless the live function matches the recorded fingerprint (md5 of prosrc OR of the full
--    pg_get_functiondef text -- the issue record does not say which form was used), or is already guarded.
--  * The patch is a single, regexp-located insertion; the result is re-verified (guard present exactly once,
--    before any write token) and every catalogue property the migration must not change (signature, return
--    type, volatility, SECURITY DEFINER, config incl. search_path, ACL, owner, language) is compared before/after.
--  * No GRANT / REVOKE / DROP / wrapper change. CREATE OR REPLACE keeps the function OID and ACL.
--  * Whole file is one transaction; any assertion failure rolls everything back.
-- Rollback: docs/master-data-costing/prepared/WP05_W506_SEC_FIX_01_ROLLBACK.sql (not executed).
begin;

do $migration$
declare
  c_internal_fp constant text := '553d103a5afedda3191c1aa62c33be7c';
  c_wrapper_fp  constant text := '6ba709477ecc7755fb6005b6e2203a2b';
  c_guard       constant text := 'perform public.require_permission(''module:cost-build-manager'', true);';
  c_insert      constant text := E'\n  ' || c_guard || E'\n';
  c_begin_re    constant text := '(^|[^[:alnum:]_])(begin)([^[:alnum:]_]|$)';
  c_write_re    constant text := '(insert[[:space:]]+into|update[[:space:]]|delete[[:space:]]+from)';
  v_oid oid;  v_wrap oid;
  v_def text; v_src text; v_patched text; v_new_def text;
  v_pre record; v_post record;
  v_pos int;  v_before text;  v_n int;
begin
  -- 1. exactly one internal function, exactly one public wrapper with the expected signature
  select count(*), min(p.oid) into v_n, v_oid
  from pg_proc p where p.pronamespace = 'costing'::regnamespace and p.proname = 'rpc_set_staff_costing_classification';
  if v_n <> 1 then
    raise exception 'W506-SEC-FIX-01 aborted: expected exactly one costing.rpc_set_staff_costing_classification, found %', v_n;
  end if;
  v_wrap := to_regprocedure('public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)');
  if v_wrap is null then
    raise exception 'W506-SEC-FIX-01 aborted: public wrapper signature not found';
  end if;
  -- the wrapper must still delegate to the internal function and must not be changed here
  if position('costing.rpc_set_staff_costing_classification' in pg_get_functiondef(v_wrap)) = 0 then
    raise exception 'W506-SEC-FIX-01 aborted: public wrapper no longer delegates to the internal function (drift)';
  end if;
  if md5((select prosrc from pg_proc where oid = v_wrap)) <> c_wrapper_fp and md5(pg_get_functiondef(v_wrap)) <> c_wrapper_fp then
    raise warning 'W506-SEC-FIX-01: public wrapper fingerprint differs from the recorded value (wrapper is not modified by this migration)';
  end if;

  select p.prosrc into v_src from pg_proc p where p.oid = v_oid;
  v_def := pg_get_functiondef(v_oid);

  -- 2. idempotency: already guarded -> verify placement and stop
  if position(c_guard in v_src) > 0 then
    v_pos := position(c_guard in v_src);
    if (length(v_src) - length(replace(v_src, c_guard, ''))) <> length(c_guard) then
      raise exception 'W506-SEC-FIX-01 aborted: guard statement present more than once';
    end if;
    v_before := substr(v_src, 1, v_pos - 1);
    if v_before ~* c_write_re then
      raise exception 'W506-SEC-FIX-01 aborted: existing guard is placed after a write token';
    end if;
    raise notice 'W506-SEC-FIX-01: internal function already guarded; nothing to do';
    return;
  end if;

  -- 3. fingerprint precondition (fail closed on live drift)
  if md5(v_src) <> c_internal_fp and md5(v_def) <> c_internal_fp then
    raise exception 'W506-SEC-FIX-01 aborted: live costing.rpc_set_staff_costing_classification fingerprint (src %, def %) does not match the recorded %',
      md5(v_src), md5(v_def), c_internal_fp;
  end if;
  if v_src ~* 'require_permission' then
    raise exception 'W506-SEC-FIX-01 aborted: unexpected existing require_permission reference in fingerprint-matched body';
  end if;

  -- 4. locate the main BEGIN (first block keyword) and sanity-check the declaration section before it
  if v_src !~* c_begin_re then
    raise exception 'W506-SEC-FIX-01 aborted: no BEGIN found in function body';
  end if;
  v_pos := regexp_instr(v_src, c_begin_re, 1, 1, 0, 'i');
  v_before := substr(v_src, 1, v_pos + 1);           -- up to and including the char that precedes/at BEGIN
  if v_before ~ '(--|/\*)' or (length(v_before) - length(replace(v_before, '''', ''))) % 2 <> 0 then
    raise exception 'W506-SEC-FIX-01 aborted: comment or unbalanced quote before the first BEGIN; refusing to guess';
  end if;

  -- 5. single insertion: guard becomes the first statement after the first BEGIN
  v_patched := regexp_replace(v_src, c_begin_re, '\1\2' || c_insert || '\3', 'i');   -- no 'g' flag: first match only
  if (length(v_patched) - length(v_src)) <> length(c_insert) then
    raise exception 'W506-SEC-FIX-01 aborted: patch changed the body by an unexpected length';
  end if;
  if (length(v_patched) - length(replace(v_patched, c_guard, ''))) <> length(c_guard) then
    raise exception 'W506-SEC-FIX-01 aborted: guard must appear exactly once after patch';
  end if;
  if substr(v_patched, 1, position(c_guard in v_patched) - 1) ~* c_write_re then
    raise exception 'W506-SEC-FIX-01 aborted: a write token precedes the guard';
  end if;
  if replace(v_patched, c_insert, '') <> v_src then
    raise exception 'W506-SEC-FIX-01 aborted: removing the inserted guard does not restore the original body';
  end if;

  -- 6. rebuild the full definition from the LIVE definition text (keeps language, SECURITY DEFINER, SET clauses, return type)
  if (length(v_def) - length(replace(v_def, v_src, ''))) <> length(v_src) then
    raise exception 'W506-SEC-FIX-01 aborted: live body text does not occur exactly once in pg_get_functiondef output';
  end if;
  v_new_def := replace(v_def, v_src, v_patched);

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
  if (select prosrc from pg_proc where oid = v_oid) <> v_patched then
    raise exception 'W506-SEC-FIX-01 aborted: installed body differs from the verified patched body';
  end if;
end
$migration$;

commit;
