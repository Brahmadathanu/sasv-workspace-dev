-- CI-043 v2.2 rev b MANDATORY POST-CHECK, part 2 (read-only): exercise the PUBLIC RPC as a real caller would.
-- Runs inside one transaction and ends with ROLLBACK; SET LOCAL only; the RPC is STABLE and writes nothing.
-- (1) role authenticated with simulated JWT of the governance owner -> RPC returns rows with valid severities;
-- LIMITATION: this is a DATABASE-LEVEL SIMULATION (rolled-back transaction, simulated JWT claims); it does not test the application's Supabase auth path.
-- (2) role anon -> permission denied (42501). Result: one row per check with pass true/false.
BEGIN;
CREATE TEMP TABLE IF NOT EXISTS ci043_rpc_check(check_name text, actual text, pass boolean) ON COMMIT DROP;
GRANT ALL ON ci043_rpc_check TO PUBLIC;
DO $$
DECLARE v_uid uuid; v_n bigint; v_ok boolean; v_anon text;
BEGIN
  SELECT user_id INTO v_uid FROM costing.costing_governance_owner ORDER BY user_id LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  PERFORM set_config('test.uid', v_uid::text, true);           -- local test fixture equivalent of auth.uid()
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*), coalesce(bool_and(severity IN ('ERROR','WARN','INFO')), true) INTO v_n, v_ok FROM public.rpc_costing_health_check();
  INSERT INTO ci043_rpc_check VALUES ('R1 authenticated owner can call rpc_costing_health_check; severities valid', v_n || ' rows', v_ok);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM count(*) FROM public.rpc_costing_health_check();
    v_anon := 'NOT REFUSED';
  EXCEPTION WHEN insufficient_privilege THEN v_anon := 'refused 42501';
  END;
  EXECUTE 'RESET ROLE';
  INSERT INTO ci043_rpc_check VALUES ('R2 anon is refused', v_anon, v_anon = 'refused 42501');
END $$;
SELECT check_name, actual, pass FROM ci043_rpc_check
UNION ALL SELECT 'ALL RPC CHECKS PASS', '', bool_and(pass) FROM ci043_rpc_check;
ROLLBACK;
