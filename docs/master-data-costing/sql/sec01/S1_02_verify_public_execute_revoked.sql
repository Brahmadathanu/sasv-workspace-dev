-- SEC-01 / STEP 2 of 3 -- READ-ONLY verification after S1_01 (also safe to run before/instead for status).
-- Run as administrator. Changes nothing. Fails (exception) unless the post-change state is exactly right.
-- The c_pinned array must be IDENTICAL to S1_01 / S1_99.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';
DO $s1v$
DECLARE
  c_pinned constant text[] := ARRAY[]::text[];
  c_expected constant int := 10;
  c_api constant text[] := ARRAY['anon','authenticated','service_role','postgres'];
  e text; v_oid oid; fn record; r text; n int; v_other text;
BEGIN
  IF coalesce(array_length(c_pinned, 1), 0) <> c_expected THEN RAISE EXCEPTION 'S1_02 HOLD: pinned list not populated with % entries', c_expected; END IF;
  FOREACH e IN ARRAY c_pinned LOOP
    v_oid := to_regprocedure(split_part(e, '|', 1));
    IF v_oid IS NULL THEN RAISE EXCEPTION 'S1_02 FAIL: pinned function missing: %', split_part(e, '|', 1); END IF;
    SELECT p.* INTO fn FROM pg_proc p WHERE p.oid = v_oid;
    IF md5(pg_get_functiondef(v_oid)) <> split_part(e, '|', 2) THEN RAISE EXCEPTION 'S1_02 FAIL: definition drift for %', e; END IF;
    IF NOT fn.prosecdef THEN RAISE EXCEPTION 'S1_02 FAIL: not SECURITY DEFINER: %', e; END IF;
    IF EXISTS (SELECT 1 FROM aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a WHERE a.grantee = 0) THEN
      RAISE EXCEPTION 'S1_02 FAIL: PUBLIC still holds a privilege on %', e;
    END IF;
    FOREACH r IN ARRAY c_api LOOP
      IF NOT has_function_privilege(r, v_oid, 'EXECUTE') THEN RAISE EXCEPTION 'S1_02 FAIL: API role % lost EXECUTE on % (application impact)', r, e; END IF;
      IF NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a
                      WHERE a.grantee = (SELECT oid FROM pg_roles WHERE rolname = r) AND a.privilege_type = 'EXECUTE') THEN
        RAISE EXCEPTION 'S1_02 FAIL: % has no explicit EXECUTE for %', e, r;
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sasv_archive_ro') AND has_function_privilege('sasv_archive_ro', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'S1_02 FAIL: sasv_archive_ro can execute %', e;
    END IF;
  END LOOP;
  -- Non-superuser, non-API roles that can still execute any pinned function (should be none, or
  -- members of an API role that keep access through inheritance).
  SELECT string_agg(DISTINCT ro.rolname, ' ') INTO v_other
    FROM pg_roles ro, unnest(c_pinned) x
   WHERE NOT ro.rolsuper AND ro.rolname !~ '^pg_' AND ro.rolname <> ALL (c_api)
     AND has_function_privilege(ro.oid, to_regprocedure(split_part(x, '|', 1)), 'EXECUTE');
  RAISE NOTICE 'S1_02 other roles still able to execute (inherit from an API role): [%]', coalesce(v_other, '');
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
     AND EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE');
  RAISE NOTICE 'S1_02 INFO: other PUBLIC-executable SECURITY DEFINER functions left in schema public (out of scope): %', n;
  RAISE NOTICE 'S1_02 PASS: ten pinned functions not PUBLIC-executable; anon/authenticated/service_role/postgres retain explicit EXECUTE; archive role cannot execute any';
END
$s1v$;
COMMIT;
