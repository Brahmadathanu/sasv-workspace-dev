-- ROUTE 2 / STEP 1 of 4 -- create the dedicated, temporary, SELECT-only archive role.
-- STATUS: PREPARED, NOT EXECUTED. Requires explicit owner approval of THIS file.
-- Run once, as the project administrator, in the Supabase SQL editor (or psql).
--
-- Everything happens inside ONE anonymous DO block, so the script is atomic:
-- any failed expectation raises an exception and NOTHING is created.
-- It never reads business rows, never writes to costing tables, never touches
-- triggers, run status, policies or existing roles. The role is created NOLOGIN;
-- step 2 (generated locally, contains only a SCRAM verifier) enables login for 7 days.
--
-- Granted: USAGE on schema costing; SELECT on exactly
--   * the direct run-linked relations (single-column FK -> costing.costing_refresh_run,
--     the same catalog rule used by archive-run87-direct-fks.mjs; must be exactly 64),
--   * costing.costing_refresh_run (run header) and costing.costing_run_designation
--     (both read by the exporter; the designation table is normally one of the 64).
-- NOT granted (revision after review): the definer-rights status view
-- costing.v_costing_period_run_status. The exporter does not need it to copy data; the
-- "run 87 is not displayed/approved" eligibility gate is an ADMINISTRATOR-only step (R2_05)
-- whose reference token is passed to the exporter (--admin-eligibility-ref).
-- BYPASSRLS DECISION (reviewed). The live database has RLS on 29 of the 65 granted tables.
-- A role that matches no policy sees ZERO rows there, so a complete archive needs one of:
--   (a) BYPASSRLS on this role  -- chosen: affects only relations the role can already
--       SELECT (65), grants no access by itself, and R2_03 proves the effective-access set;
--   (b) new RLS policies on 29 production tables -- rejected: 29 production DDL changes to
--       the very protection layer we must not touch, and they would outlive the role;
--   (c) membership in service_role/another BYPASSRLS role -- rejected: inherits broad ALL
--       privileges far beyond SELECT on 65 relations;
--   (d) the administrator credential -- rejected by the owner.
-- BYPASSRLS is added ONLY IF a granted relation has RLS enabled. If the administrator is
-- not allowed to grant it (PG16+: CREATEROLE may only grant attributes it holds) this script
-- fails closed BEFORE creating anything.
DO $r2$
DECLARE
  c_role constant text := 'sasv_archive_ro';
  c_expected constant int := 64;
  v_status text; v_period text;
  rel record; v_rels oid[] := '{}'; v_pairs int := 0; v_rls boolean := false; v_grants int := 0;
  v_extra text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = c_role) THEN
    RAISE EXCEPTION 'R2 HOLD: role % already exists; run R2_99 first or investigate', c_role;
  END IF;
  IF to_regclass('costing.costing_refresh_run') IS NULL
     OR to_regclass('costing.costing_run_designation') IS NULL THEN
    RAISE EXCEPTION 'R2 HOLD: header or designation table missing';
  END IF;
  SELECT overall_status, period_start::text INTO v_status, v_period
    FROM costing.costing_refresh_run WHERE id = 87;
  IF NOT FOUND OR v_status <> 'SUCCESS' OR v_period <> '2026-09-01' THEN
    RAISE EXCEPTION 'R2 HOLD: run 87 identity drift (%, %)', v_status, v_period;
  END IF;
  FOR rel IN
    SELECT c.oid AS relid, n.nspname AS s, c.relname AS t, c.relkind AS k,
           (c.relrowsecurity OR c.relforcerowsecurity) AS rls, att.attname AS col
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute att ON att.attrelid = c.oid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND con.confrelid = 'costing.costing_refresh_run'::regclass
      AND n.nspname = 'costing' AND array_length(con.conkey, 1) = 1
    ORDER BY n.nspname, c.relname, att.attname
  LOOP
    v_pairs := v_pairs + 1;
    IF rel.k NOT IN ('r','p') OR rel.s <> 'costing' OR rel.t !~ '^[a-z_][a-z0-9_]*$' THEN
      RAISE EXCEPTION 'R2 HOLD: unexpected relation kind/name in direct-FK inventory';
    END IF;
    IF NOT rel.relid = ANY (v_rels) THEN v_rels := v_rels || rel.relid; END IF;
    v_rls := v_rls OR rel.rls;
  END LOOP;
  IF v_pairs <> c_expected THEN
    RAISE EXCEPTION 'R2 HOLD: direct FK inventory drift: % vs expected %', v_pairs, c_expected;
  END IF;
  FOREACH v_extra IN ARRAY ARRAY['costing.costing_refresh_run','costing.costing_run_designation'] LOOP
    IF NOT v_extra::regclass::oid = ANY (v_rels) THEN v_rels := v_rels || v_extra::regclass::oid; END IF;
    v_rls := v_rls OR (SELECT relrowsecurity OR relforcerowsecurity FROM pg_class WHERE oid = v_extra::regclass);
  END LOOP;

  IF v_rls AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR (rolbypassrls AND rolcreaterole))) THEN
    RAISE EXCEPTION 'R2 HOLD: granted relations use RLS but current_user cannot grant BYPASSRLS; nothing created';
  END IF;
  RAISE NOTICE 'R2_01 info: % of % relations in the grant set have RLS enabled',
    (SELECT count(*) FROM pg_class WHERE oid = ANY (v_rels) AND (relrowsecurity OR relforcerowsecurity)), cardinality(v_rels);
  EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION %s CONNECTION LIMIT 2',
                 c_role, CASE WHEN v_rls THEN 'BYPASSRLS' ELSE 'NOBYPASSRLS' END);
  EXECUTE format('ALTER ROLE %I SET default_transaction_read_only = on', c_role);
  EXECUTE format('ALTER ROLE %I SET statement_timeout = ''15min''', c_role);
  EXECUTE format('ALTER ROLE %I SET idle_in_transaction_session_timeout = ''5min''', c_role);
  EXECUTE format('COMMENT ON ROLE %I IS %L', c_role,
                 'TEMPORARY SELECT-only SASV run-87 archive role; approved by owner; drop with R2_99');
  EXECUTE format('GRANT USAGE ON SCHEMA costing TO %I', c_role);
  FOR rel IN SELECT n.nspname s, c.relname t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE c.oid = ANY (v_rels) LOOP
    EXECUTE format('GRANT SELECT ON TABLE %I.%I TO %I', rel.s, rel.t, c_role);
    v_grants := v_grants + 1;
  END LOOP;
  RAISE NOTICE 'R2_01 OK: role % created NOLOGIN, % SELECT grants, bypassrls=%', c_role, v_grants, v_rls;
END
$r2$;
