-- ROUTE 2 / STEP 4 of 4 -- revoke and DROP the temporary archive role.
-- STATUS: PREPARED, NOT EXECUTED. Run after the archive + recovery verification, or
-- immediately if the role/credential is ever suspected to be exposed.
--
-- Two statements. Statement A (guards + NOLOGIN) is the safe direction on its own; if
-- statement B refuses, login stays disabled and the script can simply be re-run.
-- Fail-closed guards (statement A):
--   * role exists and carries the R2_01 comment, has no superuser/createdb/createrole/replication,
--   * role OWNS nothing (otherwise DROP OWNED would destroy those objects),
--   * the ONLY shared dependencies are privilege entries ('a'); an RLS policy naming the role
--     ('r'), tablespace/initial-privilege entries or default ACLs make it HOLD, because
--     DROP OWNED would silently delete them.
-- Statement B terminates the role's sessions, waits (max ~10 s) until none remain, then drops.
DO $r2d$
DECLARE
  c_role constant text := 'sasv_archive_ro';
  r pg_roles%ROWTYPE; v_n int; v_comment text;
BEGIN
  SELECT * INTO r FROM pg_roles WHERE rolname = c_role;
  IF NOT FOUND THEN RAISE EXCEPTION 'R2D HOLD: role % does not exist (already dropped?)', c_role; END IF;
  IF r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication THEN
    RAISE EXCEPTION 'R2D HOLD: role has unexpected privileges; investigate manually';
  END IF;
  v_comment := shobj_description(r.oid, 'pg_authid');
  IF v_comment IS NULL OR v_comment NOT LIKE 'TEMPORARY SELECT-only SASV run-87 archive role%' THEN
    RAISE EXCEPTION 'R2D HOLD: role comment does not match the role created by R2_01';
  END IF;
  SELECT count(*) INTO v_n FROM pg_shdepend d WHERE d.refobjid = r.oid AND d.deptype = 'o';
  IF v_n <> 0 THEN RAISE EXCEPTION 'R2D HOLD: role owns % objects', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_shdepend d WHERE d.refobjid = r.oid AND d.deptype <> 'a';
  IF v_n <> 0 THEN RAISE EXCEPTION 'R2D HOLD: role has % non-privilege dependencies (policies/other)', v_n; END IF;
  IF EXISTS (SELECT 1 FROM pg_policy p WHERE r.oid = ANY (p.polroles)) THEN
    RAISE EXCEPTION 'R2D HOLD: an RLS policy names the role (DROP OWNED would delete it)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_default_acl WHERE r.oid = ANY (SELECT (aclexplode(defaclacl)).grantee)) THEN
    RAISE EXCEPTION 'R2D HOLD: a default ACL names the role';
  END IF;
  EXECUTE format('ALTER ROLE %I NOLOGIN', c_role);
END
$r2d$;

DO $r2e$
DECLARE
  v_role constant text := 'sasv_archive_ro';
  v_try int := 0; v_left int;
BEGIN
  PERFORM pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = v_role AND pid <> pg_backend_pid();
  LOOP
    PERFORM pg_stat_clear_snapshot();   -- pg_stat_activity is cached per transaction
    SELECT count(*) INTO v_left FROM pg_stat_activity WHERE usename = v_role;
    EXIT WHEN v_left = 0 OR v_try >= 20;
    PERFORM pg_sleep(0.5); v_try := v_try + 1;
    PERFORM pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = v_role;
  END LOOP;
  IF v_left <> 0 THEN RAISE EXCEPTION 'R2D HOLD: % session(s) of % still active after 10 s; login is disabled, re-run', v_left, v_role; END IF;
  EXECUTE format('DROP OWNED BY %I', v_role);   -- removes only its privileges (it owns nothing)
  EXECUTE format('DROP ROLE %I', v_role);
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN RAISE EXCEPTION 'R2D FAIL: role still exists'; END IF;
  RAISE NOTICE 'R2_99 OK: role % dropped', v_role;
END
$r2e$;
