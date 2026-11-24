-- ROUTE 2 / STEP 4 of 4 -- revoke and DROP the temporary archive role.
-- STATUS: PREPARED, NOT EXECUTED. Run after the archive + recovery verification, or
-- immediately if the role/credential is ever suspected to be exposed.
-- Atomic and fail closed: refuses if the role owns anything (DROP OWNED would then
-- destroy objects) or if the role is not the one R2_01 created.
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
  EXECUTE format('ALTER ROLE %I NOLOGIN', c_role);
  PERFORM pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = c_role;
  EXECUTE format('DROP OWNED BY %I', c_role);   -- removes only its privileges (it owns nothing)
  EXECUTE format('DROP ROLE %I', c_role);
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = c_role) THEN
    RAISE EXCEPTION 'R2D FAIL: role still exists';
  END IF;
  RAISE NOTICE 'R2_99 OK: role % dropped', c_role;
END
$r2d$;
