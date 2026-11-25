-- SEC-01 / ROLLBACK -- re-grant EXECUTE TO PUBLIC on exactly the same ten pinned functions.
-- Restores the pre-S1_01 ACL shape (PUBLIC entry granted by the owner). Separately reviewed; run as the
-- function owner. Fail-closed: refuses unless every pinned function is currently NOT PUBLIC-executable,
-- unchanged (fingerprint), and the four API roles still hold explicit EXECUTE. The c_pinned array must be
-- IDENTICAL to S1_01 / S1_02. Rolling back re-opens the exposure the Route 2 permission audit detects; do it only to
-- restore an application dependency that S1_02 proved broken.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
DO $s1r$
DECLARE
  c_pinned constant text[] := ARRAY[]::text[];
  c_expected constant int := 10;
  c_api constant text[] := ARRAY['anon','authenticated','service_role','postgres'];
  e text; sig text; v_oid oid; fn record; r text;
BEGIN
  IF coalesce(array_length(c_pinned, 1), 0) <> c_expected THEN RAISE EXCEPTION 'SEC-01 ROLLBACK HOLD: pinned list not populated with % entries', c_expected; END IF;
  FOREACH e IN ARRAY c_pinned LOOP
    v_oid := to_regprocedure(split_part(e, '|', 1));
    IF v_oid IS NULL THEN RAISE EXCEPTION 'SEC-01 ROLLBACK HOLD: pinned signature not found: %', split_part(e, '|', 1); END IF;
    SELECT p.*, ns.nspname INTO fn FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace WHERE p.oid = v_oid;
    IF md5(pg_get_functiondef(v_oid)) <> split_part(e, '|', 2) THEN RAISE EXCEPTION 'SEC-01 ROLLBACK HOLD: definition drift for %', e; END IF;
    IF pg_get_userbyid(fn.proowner) <> 'postgres' OR NOT fn.prosecdef THEN RAISE EXCEPTION 'SEC-01 ROLLBACK HOLD: owner/definer drift for %', e; END IF;
    IF EXISTS (SELECT 1 FROM aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a WHERE a.grantee = 0) THEN
      RAISE EXCEPTION 'SEC-01 ROLLBACK HOLD: % already PUBLIC-executable (rollback already applied?)', e;
    END IF;
    FOREACH r IN ARRAY c_api LOOP
      IF NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) a
                      WHERE a.grantee = (SELECT oid FROM pg_roles WHERE rolname = r) AND a.privilege_type = 'EXECUTE') THEN
        RAISE EXCEPTION 'SEC-01 ROLLBACK HOLD: % lacks explicit EXECUTE for % (unexpected state)', e, r;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH e IN ARRAY c_pinned LOOP
    v_oid := to_regprocedure(split_part(e, '|', 1));
    SELECT format('%I.%I(%s)', ns.nspname, p.proname, oidvectortypes(p.proargtypes)) INTO sig
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace WHERE p.oid = v_oid;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', sig);
  END LOOP;
  FOREACH e IN ARRAY c_pinned LOOP
    v_oid := to_regprocedure(split_part(e, '|', 1));
    IF NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                    WHERE p.oid = v_oid AND a.grantee = 0 AND a.privilege_type = 'EXECUTE' AND NOT a.is_grantable AND a.grantor = p.proowner) THEN
      RAISE EXCEPTION 'SEC-01 ROLLBACK FAIL: PUBLIC EXECUTE not restored on %', e;
    END IF;
    IF md5(pg_get_functiondef(v_oid)) <> split_part(e, '|', 2) THEN RAISE EXCEPTION 'SEC-01 ROLLBACK FAIL: definition changed for %', e; END IF;
  END LOOP;
  RAISE NOTICE 'S1_99 OK: PUBLIC EXECUTE restored on % functions (pre-SEC-01 state)', c_expected;
END
$s1r$;
COMMIT;
