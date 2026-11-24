-- ROUTE 2 / STEP 3 of 4 -- permission audit. Run as administrator after R2_01 + R2_02 and
-- BEFORE the archive. Read-only and cheap (catalog only, never reads business rows).
-- Raises on any deviation. The expensive row-count control is a separate script (R2_04).
--
-- Method: derive the allowlist from the catalog, derive the role's EFFECTIVE privileges
-- (direct grants + PUBLIC + any inheritance) from has_*_privilege(), and compare the exact
-- SETS in both directions. Relation names are reported on failure (never row data).
DO $r2v$
DECLARE
  c_role constant text := 'sasv_archive_ro';
  r pg_roles%ROWTYPE;
  v_allow oid[]; v_eff oid[]; v_pairs int; v_view oid := 'costing.v_costing_period_run_status'::regclass;
  v_missing text; v_unexpected text; v_n int; v_txt text;
BEGIN
  SELECT * INTO r FROM pg_roles WHERE rolname = c_role;
  IF NOT FOUND THEN RAISE EXCEPTION 'R2V FAIL: role missing'; END IF;

  -- 1. Role attributes.
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
  IF NOT EXISTS (SELECT 1 FROM pg_db_role_setting s WHERE s.setrole = r.oid AND s.setdatabase = 0
                 AND s.setconfig @> ARRAY['default_transaction_read_only=on']) THEN
    RAISE EXCEPTION 'R2V FAIL: default_transaction_read_only not set';
  END IF;
  SELECT count(*) INTO v_n FROM pg_shdepend d WHERE d.refobjid = r.oid AND d.deptype = 'o';
  IF v_n <> 0 THEN RAISE EXCEPTION 'R2V FAIL: role owns % objects', v_n; END IF;
  IF EXISTS (SELECT 1 FROM pg_shdepend d WHERE d.refobjid = r.oid AND d.deptype NOT IN ('a')) THEN
    RAISE EXCEPTION 'R2V FAIL: role has dependencies other than privileges (e.g. policies)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_default_acl WHERE r.oid = ANY (SELECT (aclexplode(defaclacl)).grantee)) THEN
    RAISE EXCEPTION 'R2V FAIL: default ACL mentions the role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy p WHERE r.oid = ANY (p.polroles)) THEN
    RAISE EXCEPTION 'R2V FAIL: an RLS policy names the role';
  END IF;

  -- 2. Catalog-derived allowlist (direct run-linked relations + header + designation + status view).
  SELECT count(*) INTO v_pairs FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE con.contype = 'f' AND con.confrelid = 'costing.costing_refresh_run'::regclass
     AND n.nspname = 'costing' AND array_length(con.conkey,1) = 1;
  IF v_pairs <> 64 THEN RAISE EXCEPTION 'R2V FAIL: direct FK inventory drift: % vs 64', v_pairs; END IF;
  SELECT array_agg(DISTINCT x) INTO v_allow FROM (
    SELECT con.conrelid AS x FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE con.contype = 'f' AND con.confrelid = 'costing.costing_refresh_run'::regclass
       AND n.nspname = 'costing' AND array_length(con.conkey,1) = 1
    UNION SELECT 'costing.costing_refresh_run'::regclass::oid
    UNION SELECT 'costing.costing_run_designation'::regclass::oid
    UNION SELECT v_view) a;

  -- 3. EFFECTIVE SELECT (table- or column-level, via direct grant, PUBLIC or inheritance) over every
  --    non-system relation, compared as an exact set with the allowlist.
  SELECT array_agg(c.oid) INTO v_eff FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind IN ('r','p','v','m','f','S')
     AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
     AND (has_any_column_privilege(c_role, c.oid, 'SELECT') OR has_table_privilege(c_role, c.oid, 'SELECT'));
  v_eff := coalesce(v_eff, '{}');
  SELECT string_agg(x::regclass::text, ', ') INTO v_missing FROM unnest(v_allow) x WHERE NOT x = ANY (v_eff);
  SELECT string_agg(x::regclass::text, ', ') INTO v_unexpected FROM unnest(v_eff) x WHERE NOT x = ANY (v_allow);
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'R2V FAIL: allowlisted relations NOT effectively readable: %', v_missing; END IF;
  IF v_unexpected IS NOT NULL THEN RAISE EXCEPTION 'R2V FAIL: UNEXPECTED effective SELECT (grant, PUBLIC, column or inherited) on: %', v_unexpected; END IF;
  SELECT string_agg(x::regclass::text, ', ') INTO v_missing FROM unnest(v_allow) x WHERE NOT has_table_privilege(c_role, x, 'SELECT');
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'R2V FAIL: SELECT is column-level only (archive would be partial) on: %', v_missing; END IF;

  -- 4. No effective write-class privilege on anything (tables, columns, sequences).
  SELECT string_agg(c.oid::regclass::text, ', ') INTO v_txt FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind IN ('r','p','v','m','f','S') AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
     AND (has_table_privilege(c_role,c.oid,'INSERT') OR has_table_privilege(c_role,c.oid,'UPDATE')
       OR has_table_privilege(c_role,c.oid,'DELETE') OR has_table_privilege(c_role,c.oid,'TRUNCATE')
       OR has_table_privilege(c_role,c.oid,'REFERENCES') OR has_table_privilege(c_role,c.oid,'TRIGGER')
       OR has_any_column_privilege(c_role,c.oid,'INSERT') OR has_any_column_privilege(c_role,c.oid,'UPDATE')
       OR has_any_column_privilege(c_role,c.oid,'REFERENCES')
       OR (c.relkind = 'S' AND (has_sequence_privilege(c_role,c.oid,'USAGE') OR has_sequence_privilege(c_role,c.oid,'UPDATE'))));
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'R2V FAIL: write-class privilege on: %', v_txt; END IF;

  -- 5. Direct ACL entries naming the role must be EXACTLY: SELECT (no grant option) on the allowlist,
  --    USAGE on schema costing, nothing at database, function, language, type, FDW, server or column level.
  SELECT count(*) INTO v_n FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
   WHERE a.grantee = r.oid AND NOT (a.privilege_type = 'SELECT' AND NOT a.is_grantable AND c.oid = ANY (v_allow));
  IF v_n <> 0 THEN RAISE EXCEPTION 'R2V FAIL: % direct relation grants outside SELECT-on-allowlist', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_attribute at CROSS JOIN LATERAL aclexplode(at.attacl) a WHERE a.grantee = r.oid;
  IF v_n <> 0 THEN RAISE EXCEPTION 'R2V FAIL: % column-level grants', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_namespace s CROSS JOIN LATERAL aclexplode(s.nspacl) a
   WHERE a.grantee = r.oid AND NOT (s.nspname = 'costing' AND a.privilege_type = 'USAGE' AND NOT a.is_grantable);
  IF v_n <> 0 THEN RAISE EXCEPTION 'R2V FAIL: % direct schema grants outside USAGE on costing', v_n; END IF;
  SELECT count(*) INTO v_n FROM (
    SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(d.datacl) a WHERE a.grantee = r.oid
    UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee = r.oid
    UNION ALL SELECT 1 FROM pg_language l CROSS JOIN LATERAL aclexplode(l.lanacl) a WHERE a.grantee = r.oid
    UNION ALL SELECT 1 FROM pg_type t CROSS JOIN LATERAL aclexplode(t.typacl) a WHERE a.grantee = r.oid
    UNION ALL SELECT 1 FROM pg_foreign_data_wrapper f CROSS JOIN LATERAL aclexplode(f.fdwacl) a WHERE a.grantee = r.oid
    UNION ALL SELECT 1 FROM pg_foreign_server f CROSS JOIN LATERAL aclexplode(f.srvacl) a WHERE a.grantee = r.oid) z;
  IF v_n <> 0 THEN RAISE EXCEPTION 'R2V FAIL: % direct database/function/language/type/FDW grants', v_n; END IF;

  -- 6. Database- and schema-level EFFECTIVE privileges.
  IF NOT has_database_privilege(c_role, current_database(), 'CONNECT') THEN
    RAISE EXCEPTION 'R2V FAIL: role cannot CONNECT to this database'; END IF;
  IF has_database_privilege(c_role, current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'R2V FAIL: role holds CREATE on the database'; END IF;
  SELECT string_agg(s.nspname, ', ') INTO v_txt FROM pg_namespace s
   WHERE s.nspname NOT LIKE 'pg\_%' AND s.nspname <> 'information_schema' AND has_schema_privilege(c_role, s.oid, 'CREATE');
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'R2V FAIL: CREATE (objects) allowed in schemas: %', v_txt; END IF;
  IF has_database_privilege(c_role, current_database(), 'TEMPORARY') THEN
    IF EXISTS (SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(d.datacl) a
               WHERE d.datname = current_database() AND a.grantee = r.oid AND a.privilege_type = 'TEMPORARY') THEN
      RAISE EXCEPTION 'R2V FAIL: TEMPORARY granted directly to the role';
    END IF;
    RAISE NOTICE 'R2_03 RESIDUAL (owner to accept): role can create session-local TEMP tables only through the default PUBLIC TEMPORARY privilege; they hold no persistent state and every write to real tables is denied by grants';
  END IF;
  SELECT string_agg(s.nspname, ', ') INTO v_txt FROM pg_namespace s
   WHERE s.nspname NOT LIKE 'pg\_%' AND s.nspname <> 'information_schema' AND has_schema_privilege(c_role, s.oid, 'USAGE');
  RAISE NOTICE 'R2_03 info: schemas with effective USAGE: %', v_txt;

  -- 7. Executable functions: no SECURITY DEFINER function reachable by the role (default PUBLIC
  --    EXECUTE would let it run with the definer's rights), no untrusted language, no file/server-admin functions
  --    (replication-slot functions are PUBLIC-executable but require REPLICATION, which is checked above).
  SELECT string_agg(n.nspname || '.' || p.proname, ', ') INTO v_txt FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema')
     AND has_function_privilege(c_role, p.oid, 'EXECUTE') AND has_schema_privilege(c_role, n.oid, 'USAGE');
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'R2V FAIL: SECURITY DEFINER functions executable by the role (review, then revoke EXECUTE from PUBLIC on them): %', left(v_txt, 1500);
  END IF;
  SELECT string_agg(l.lanname, ', ') INTO v_txt FROM pg_language l
   WHERE NOT l.lanpltrusted AND l.lanname NOT IN ('internal','c')  -- C/internal functions can only be created by superusers
     AND has_language_privilege(c_role, l.oid, 'USAGE');
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'R2V FAIL: USAGE on untrusted language(s): %', v_txt; END IF;
  SELECT string_agg(n.nspname || '.' || p.proname, ', ') INTO v_txt FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.proname ~ '^(pg_read_(binary_)?file|pg_ls_.*|pg_stat_file|lo_import|lo_export|pg_reload_conf|pg_rotate_logfile|pg_switch_wal|pg_create_restore_point|pg_promote|pg_backup_.*|pg_start_backup|pg_stop_backup|pg_wal_replay_.*|pg_execute_server_program|dblink.*|pg_file_.*|set_config_file)$'
     AND has_function_privilege(c_role, p.oid, 'EXECUTE') AND has_schema_privilege(c_role, n.oid, 'USAGE');
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'R2V FAIL: dangerous server/file functions executable by the role: %', left(v_txt, 1500); END IF;

  -- 8. The one intentional view: report what it exposes (definer rights) so the owner can accept it.
  SELECT string_agg(DISTINCT d.refobjid::regclass::text, ', ') INTO v_txt
    FROM pg_rewrite rw JOIN pg_depend d ON d.objid = rw.oid AND d.classid = 'pg_rewrite'::regclass AND d.refclassid = 'pg_class'::regclass
   WHERE rw.ev_class = v_view AND d.refobjid <> v_view;
  RAISE NOTICE 'R2_03 VIEW EXPOSURE: costing.v_costing_period_run_status (owner %, %) reads: %',
    (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = v_view), 'definer rights', v_txt;
  RAISE NOTICE 'R2_03 VIEW DEFINITION: %', pg_get_viewdef(v_view, true);

  RAISE NOTICE 'R2_03 PASS: exact effective SELECT set = % allowlisted relations; read-only, time-limited, no dangerous privileges', cardinality(v_allow);
END
$r2v$;
