-- SEC-01 / STEP 1 of 3 -- REVOKE EXECUTE FROM PUBLIC on exactly ten SECURITY DEFINER functions.
-- SEPARATE security change from Route 2 (role creation). NOT APPROVED FOR PRODUCTION until the owner
-- reviews the exact pinned list below. Run as the function owner (postgres) in one transaction.
--
-- What it does:  REVOKE EXECUTE ON FUNCTION <each pinned signature> FROM PUBLIC.   Nothing else.
-- What it keeps: explicit EXECUTE grants to anon, authenticated, service_role, postgres (verified, unchanged).
-- Fail-closed:   any drift (list not populated, signature missing, definition fingerprint changed, owner or
--                SECURITY DEFINER changed, set of PUBLIC-executable rpc_eaushadhi_* definers differs from the
--                pin, an API role lacking its explicit grant, a role that would lose access only because it
--                relied on PUBLIC, any unexpected ACL change) raises an exception and the whole transaction
--                rolls back with no change.
-- Rollback:      S1_99_rollback_restore_public_execute.sql (re-grants EXECUTE to PUBLIC on the same ten).
--
-- Pin entries: 'schema.name(identity args)|md5(pg_get_functiondef)'. Produce them with S1_00 (read-only).
-- The c_pinned array must be IDENTICAL in S1_01, S1_02 and S1_99 (a repository test enforces this).
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
DO $s1$
DECLARE
  c_pinned constant text[] := ARRAY['public.rpc_eaushadhi_document_upload_contract(integer, text, text)|5bb91bb60e9d344183e725bf6f20d0f0', 'public.rpc_eaushadhi_pharmacological_action_options()|d649fb13c4336c5c5b054898155dc9cd', 'public.rpc_eaushadhi_product_actions_get(integer)|193586dcc0acfaa157a6b9fc7f24f33f', 'public.rpc_eaushadhi_product_classification_options(text, bigint)|e4145cc0dc0188c47bbfedddbbdb9da7', 'public.rpc_eaushadhi_product_classification_review_get(integer)|37183e238f164ae8990ed9e3ff82716f', 'public.rpc_eaushadhi_product_classification_review_save(integer, bigint, bigint, bigint, bigint, text, text, boolean)|7fe6eb30177bb55c46bd80718eebdd92', 'public.rpc_eaushadhi_product_evidence_status(integer)|8fb70200b1f5bd9bd325d9e2eff79999', 'public.rpc_eaushadhi_product_review_get(integer)|b7694fd45e9793cf043c4675bed914fa', 'public.rpc_eaushadhi_promote_verified_formulation(integer, bigint, text)|3a905e04a6b2347e83a1340abe128050', 'public.rpc_eaushadhi_register_approved_product_copy(integer, text, text, text, text, bigint, text, text)|6a7cbc866262ab1cdf644a9a8ab54d9e']::text[];
  c_expected constant int := 10;
  c_api constant text[] := ARRAY['anon','authenticated','service_role','postgres'];
  -- Roles the OWNER explicitly accepts losing EXECUTE (they relied solely on PUBLIC). Default: none.
  c_accepted_losers constant text[] := ARRAY[]::text[];
  e text; sig text; fp text; v_oid oid; fn record; ro record; r text; n int;
  v_unpinned text; v_nonpub_acl text;
  v_before_acl jsonb := '{}'::jsonb; v_after_acl text;
  v_losers text := ''; v_covered text := '';
  v_can_set boolean; v_b boolean;
  -- PG16+ has a per-membership SET option; before that, membership implies SET ROLE.
  v_setpriv text := CASE WHEN current_setting('server_version_num')::int >= 160000 THEN 'SET' ELSE 'MEMBER' END;
BEGIN
  IF current_user = 'sasv_archive_ro' THEN RAISE EXCEPTION 'SEC-01 HOLD: must run as the function owner, not the archive role'; END IF;
  IF coalesce(array_length(c_pinned, 1), 0) <> c_expected THEN
    RAISE EXCEPTION 'SEC-01 HOLD: pinned list not populated with exactly % entries (found %); run S1_00 and have the owner review it', c_expected, coalesce(array_length(c_pinned, 1), 0);
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(c_pinned) x) <> c_expected THEN RAISE EXCEPTION 'SEC-01 HOLD: duplicate pin entries'; END IF;
  FOREACH r IN ARRAY c_api LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN RAISE EXCEPTION 'SEC-01 HOLD: API role % does not exist', r; END IF;
  END LOOP;

  CREATE TEMP TABLE s1_before(role_name name, fn_oid oid, can_exec boolean) ON COMMIT DROP;

  -- 1. Each pinned function: exact identity, owner, definer, fingerprint, explicit API grants, PUBLIC present.
  FOREACH e IN ARRAY c_pinned LOOP
    sig := split_part(e, '|', 1); fp := split_part(e, '|', 2);
    v_oid := to_regprocedure(sig);
    IF v_oid IS NULL THEN RAISE EXCEPTION 'SEC-01 HOLD: pinned signature not found: %', sig; END IF;
    SELECT p.*, ns.nspname INTO fn FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace WHERE p.oid = v_oid;
    IF fn.nspname <> 'public' OR fn.proname NOT LIKE 'rpc\_eaushadhi\_%' OR fn.prokind <> 'f' THEN RAISE EXCEPTION 'SEC-01 HOLD: % is outside the public.rpc_eaushadhi_* scope', sig; END IF;
    IF NOT fn.prosecdef THEN RAISE EXCEPTION 'SEC-01 HOLD: % is no longer SECURITY DEFINER (drift)', sig; END IF;
    IF pg_get_userbyid(fn.proowner) <> 'postgres' THEN RAISE EXCEPTION 'SEC-01 HOLD: % owner drift (%)', sig, pg_get_userbyid(fn.proowner); END IF;
    IF md5(pg_get_functiondef(v_oid)) <> fp THEN RAISE EXCEPTION 'SEC-01 HOLD: definition fingerprint drift for %', sig; END IF;
    IF NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
      RAISE EXCEPTION 'SEC-01 HOLD: % is not PUBLIC-executable (already applied or drifted)', sig;
    END IF;
    FOREACH r IN ARRAY c_api LOOP
      IF NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a
                      WHERE a.grantee = (SELECT oid FROM pg_roles WHERE rolname = r) AND a.privilege_type = 'EXECUTE') THEN
        RAISE EXCEPTION 'SEC-01 HOLD: % has no EXPLICIT EXECUTE grant to % (revoking PUBLIC would remove its access)', sig, r;
      END IF;
    END LOOP;
    SELECT string_agg(a.grantee::text || ':' || a.privilege_type || ':' || a.is_grantable::text || ':' || a.grantor::text, ',' ORDER BY a.grantee, a.privilege_type, a.grantor)
      INTO v_nonpub_acl FROM aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a WHERE a.grantee <> 0;
    v_before_acl := v_before_acl || jsonb_build_object(v_oid::text, coalesce(v_nonpub_acl, ''));
    INSERT INTO s1_before SELECT pr.rolname, v_oid, has_function_privilege(pr.oid, v_oid, 'EXECUTE')
      FROM pg_roles pr WHERE NOT pr.rolsuper AND pr.rolname !~ '^pg_';
  END LOOP;

  -- 2. Drift in the other direction: no OTHER PUBLIC-executable SECURITY DEFINER rpc_eaushadhi_* function.
  SELECT string_agg(format('%I.%I(%s)', ns.nspname, p.proname, oidvectortypes(p.proargtypes)), '; ') INTO v_unpinned
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname LIKE 'rpc\_eaushadhi\_%' AND p.prokind = 'f' AND p.prosecdef
     AND EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
     AND NOT (p.oid = ANY (ARRAY(SELECT to_regprocedure(split_part(x, '|', 1))::oid FROM unnest(c_pinned) x)));
  IF v_unpinned IS NOT NULL THEN RAISE EXCEPTION 'SEC-01 HOLD: PUBLIC-executable SECURITY DEFINER function(s) NOT in the pinned set: %', v_unpinned; END IF;

  -- 3. The change itself.
  FOREACH e IN ARRAY c_pinned LOOP
    v_oid := to_regprocedure(split_part(e, '|', 1));
    SELECT format('%I.%I(%s)', ns.nspname, p.proname, oidvectortypes(p.proargtypes)) INTO sig
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace WHERE p.oid = v_oid;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', sig);
  END LOOP;

  -- 4. Verify after-state: PUBLIC gone, fingerprint and every non-PUBLIC ACL entry untouched,
  --    API roles unchanged, nobody gained access, losers are either covered or owner-accepted.
  FOREACH e IN ARRAY c_pinned LOOP
    v_oid := to_regprocedure(split_part(e, '|', 1));
    SELECT p.* INTO fn FROM pg_proc p WHERE p.oid = v_oid;
    IF EXISTS (SELECT 1 FROM aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a WHERE a.grantee = 0) THEN
      RAISE EXCEPTION 'SEC-01 FAIL: PUBLIC still holds a privilege on %', e;
    END IF;
    IF md5(pg_get_functiondef(v_oid)) <> split_part(e, '|', 2) THEN RAISE EXCEPTION 'SEC-01 FAIL: definition changed for %', e; END IF;
    SELECT string_agg(a.grantee::text || ':' || a.privilege_type || ':' || a.is_grantable::text || ':' || a.grantor::text, ',' ORDER BY a.grantee, a.privilege_type, a.grantor)
      INTO v_after_acl FROM aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a WHERE a.grantee <> 0;
    IF coalesce(v_after_acl, '') <> (v_before_acl ->> v_oid::text) THEN RAISE EXCEPTION 'SEC-01 FAIL: a non-PUBLIC ACL entry changed on %', e; END IF;
  END LOOP;
  FOR ro IN SELECT b.role_name, b.fn_oid, b.can_exec,
                   has_function_privilege(b.role_name, b.fn_oid, 'EXECUTE') AS now_exec
              FROM s1_before b ORDER BY 1, 2
  LOOP
    IF ro.role_name = ANY (c_api) AND ro.can_exec IS DISTINCT FROM ro.now_exec THEN
      RAISE EXCEPTION 'SEC-01 FAIL: effective EXECUTE changed for API role % on %', ro.role_name, ro.fn_oid::regprocedure;
    END IF;
    IF NOT ro.can_exec AND ro.now_exec THEN RAISE EXCEPTION 'SEC-01 FAIL: % GAINED execute on %', ro.role_name, ro.fn_oid::regprocedure; END IF;
    IF ro.can_exec AND NOT ro.now_exec AND NOT (ro.role_name = ANY (c_api)) THEN
      v_can_set := false;
      FOREACH r IN ARRAY c_api LOOP
        EXECUTE format('SELECT pg_has_role(%L, %L, %L)', ro.role_name, r, v_setpriv) INTO v_b;
        v_can_set := v_can_set OR v_b;
      END LOOP;
      IF v_can_set THEN
        IF position(ro.role_name || ' ' IN v_covered) = 0 THEN v_covered := v_covered || ro.role_name || ' '; END IF;
      ELSIF ro.role_name = 'sasv_archive_ro' THEN
        NULL; -- intended: the temporary archive role must NOT reach these functions
      ELSIF ro.role_name = ANY (c_accepted_losers) THEN
        IF position(ro.role_name || '(accepted) ' IN v_losers) = 0 THEN v_losers := v_losers || ro.role_name || '(accepted) '; END IF;
      ELSE
        RAISE EXCEPTION 'SEC-01 HOLD: role % relied solely on PUBLIC for % and would lose access; owner must review (c_accepted_losers) - nothing changed', ro.role_name, ro.fn_oid::regprocedure;
      END IF;
    END IF;
  END LOOP;
  -- 5. The temporary archive role (if it exists yet) must not reach any pinned function.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sasv_archive_ro') THEN
    SELECT count(*) INTO n FROM unnest(c_pinned) x WHERE has_function_privilege('sasv_archive_ro', to_regprocedure(split_part(x, '|', 1)), 'EXECUTE');
    IF n <> 0 THEN RAISE EXCEPTION 'SEC-01 FAIL: sasv_archive_ro can still execute % pinned function(s)', n; END IF;
  END IF;
  RAISE NOTICE 'S1_01 OK: PUBLIC EXECUTE revoked on % functions; API roles anon/authenticated/service_role/postgres unchanged', c_expected;
  RAISE NOTICE 'S1_01 roles that lost PUBLIC-derived access but retain it by membership/SET ROLE: [%]', trim(v_covered);
  RAISE NOTICE 'S1_01 owner-accepted losers: [%]', trim(v_losers);
END
$s1$;
COMMIT;
