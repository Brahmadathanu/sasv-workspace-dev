-- ROUTE 2 / STEP 3 of 4 -- read-only permission verification. Run as administrator
-- after R2_01 and R2_02, BEFORE the archive. Changes nothing; raises on any deviation.
DO $r2v$
DECLARE
  c_role constant text := 'sasv_archive_ro';
  v_bad int; v_sel int; r pg_roles%ROWTYPE; v_expected_sel int;
BEGIN
  SELECT * INTO r FROM pg_roles WHERE rolname = c_role;
  IF NOT FOUND THEN RAISE EXCEPTION 'R2V FAIL: role missing'; END IF;
  IF r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolinherit OR r.rolconnlimit <> 2 THEN
    RAISE EXCEPTION 'R2V FAIL: role attributes too broad';
  END IF;
  IF NOT r.rolcanlogin THEN RAISE EXCEPTION 'R2V FAIL: login not enabled (run R2_02)'; END IF;
  IF r.rolvaliduntil IS NULL OR r.rolvaliduntil > now() + interval '8 days' THEN
    RAISE EXCEPTION 'R2V FAIL: role is not time-limited';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) THEN
    RAISE EXCEPTION 'R2V FAIL: role is a member of another role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_db_role_setting s
                 WHERE s.setrole = r.oid AND s.setconfig @> ARRAY['default_transaction_read_only=on']) THEN
    RAISE EXCEPTION 'R2V FAIL: default_transaction_read_only not set';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_shdepend d WHERE d.refobjid = r.oid AND d.deptype = 'o') THEN
    RAISE EXCEPTION 'R2V FAIL: role owns objects';
  END IF;

  -- No write-class privilege anywhere in the database.
  SELECT count(*) INTO v_bad FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind IN ('r','p','v','m','f')
     AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
     AND (has_table_privilege(c_role,c.oid,'INSERT') OR has_table_privilege(c_role,c.oid,'UPDATE')
       OR has_table_privilege(c_role,c.oid,'DELETE') OR has_table_privilege(c_role,c.oid,'TRUNCATE')
       OR has_table_privilege(c_role,c.oid,'REFERENCES') OR has_table_privilege(c_role,c.oid,'TRIGGER'));
  IF v_bad <> 0 THEN RAISE EXCEPTION 'R2V FAIL: % relations grant a write-class privilege', v_bad; END IF;
  SELECT count(*) INTO v_bad FROM pg_namespace n
   WHERE n.nspname NOT LIKE 'pg\_%' AND has_schema_privilege(c_role, n.oid, 'CREATE');
  IF v_bad <> 0 THEN RAISE EXCEPTION 'R2V FAIL: CREATE allowed on % schemas', v_bad; END IF;
  SELECT count(*) INTO v_bad FROM pg_class c
   WHERE c.relkind = 'S' AND (has_sequence_privilege(c_role,c.oid,'USAGE') OR has_sequence_privilege(c_role,c.oid,'UPDATE'));
  IF v_bad <> 0 THEN RAISE EXCEPTION 'R2V FAIL: sequence privileges present'; END IF;

  -- SELECT exactly on: the direct relations + header + designation (deduplicated) + status view.
  SELECT count(*) INTO v_expected_sel FROM (
    SELECT DISTINCT con.conrelid AS oid FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE con.contype = 'f' AND con.confrelid = 'costing.costing_refresh_run'::regclass
       AND n.nspname = 'costing' AND array_length(con.conkey,1) = 1
    UNION SELECT 'costing.costing_refresh_run'::regclass::oid
    UNION SELECT 'costing.costing_run_designation'::regclass::oid
    UNION SELECT 'costing.v_costing_period_run_status'::regclass::oid) d;
  SELECT count(*) INTO v_sel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind IN ('r','p','v','m','f')
     AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
     AND has_table_privilege(c_role, c.oid, 'SELECT');
  IF v_sel <> v_expected_sel THEN
    RAISE EXCEPTION 'R2V FAIL: SELECT on % relations, expected exactly %', v_sel, v_expected_sel;
  END IF;
  SELECT count(*) INTO v_bad FROM (
    SELECT DISTINCT con.conrelid AS oid FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE con.contype = 'f' AND con.confrelid = 'costing.costing_refresh_run'::regclass
       AND n.nspname = 'costing' AND array_length(con.conkey,1) = 1) d
   WHERE NOT has_table_privilege(c_role, d.oid, 'SELECT');
  IF v_bad <> 0 THEN RAISE EXCEPTION 'R2V FAIL: % direct relations not readable', v_bad; END IF;
  IF NOT r.rolbypassrls AND EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'costing' AND (c.relrowsecurity OR c.relforcerowsecurity)
         AND has_table_privilege(c_role, c.oid, 'SELECT')) THEN
    RAISE EXCEPTION 'R2V FAIL: RLS enabled on a granted relation but role lacks BYPASSRLS (partial-data risk)';
  END IF;
  RAISE NOTICE 'R2_03 PASS: role is read-only, time-limited, SELECT scoped to % relations', v_sel;
END
$r2v$;

-- Independent control number for the archive: total run-87 rows across the direct relations
-- (administrator view). Compare with the archive manifest total; any difference is a HOLD.
-- Count only, no business data.
DO $r2c$
DECLARE rel record; v_total bigint := 0; n bigint;
BEGIN
  FOR rel IN
    SELECT DISTINCT nn.nspname AS s, c.relname AS t, att.attname AS col
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace nn ON nn.oid = c.relnamespace
      JOIN pg_attribute att ON att.attrelid = c.oid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f' AND con.confrelid = 'costing.costing_refresh_run'::regclass
       AND nn.nspname = 'costing' AND array_length(con.conkey,1) = 1
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = 87', rel.s, rel.t, rel.col) INTO n;
    v_total := v_total + n;
  END LOOP;
  RAISE NOTICE 'R2_03 CONTROL: run 87 rows across direct relations (admin view) = %', v_total;
END
$r2c$;
