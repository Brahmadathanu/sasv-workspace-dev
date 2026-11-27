-- SEC-01 / STEP 3 (read-only evidence, run BEFORE S1_01) -- which roles would lose EXECUTE when PUBLIC is removed,
-- and how each one stands on the four questions the owner asked. Changes nothing. Run as administrator.
-- For every non-superuser role that can execute at least one pinned function, per role prints:
--   direct     : pinned functions where the role itself has an explicit EXECUTE ACL entry (of 10)
--   inherited  : pinned functions reachable through INHERITed membership of an explicit-grant role
--                (anon/authenticated/service_role/postgres) (of 10)
--   public_only: pinned functions the role reaches ONLY because of PUBLIC (of 10) -> these are lost by S1_01
--   set_role   : whether the role may SET ROLE into anon/authenticated/service_role/postgres
--                (PG16+ per-membership SET option; PG15 and older: any membership)
-- and one of: KEEPS_ACCESS | COVERED_BY_SET_ROLE | LOSES_ACCESS_NO_PATH.
-- The fifth question - ACTUAL functional dependence on the eAushadhi RPCs - cannot be derived from the catalog;
-- this script prints the evidence that exists (function call statistics, current sessions) and states what is missing.
-- The c_pinned array is the same as S1_01 (a repository test enforces identity).
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';
DO $s1a$
DECLARE
  c_pinned constant text[] := ARRAY['public.rpc_eaushadhi_document_upload_contract(integer, text, text)|5bb91bb60e9d344183e725bf6f20d0f0', 'public.rpc_eaushadhi_pharmacological_action_options()|d649fb13c4336c5c5b054898155dc9cd', 'public.rpc_eaushadhi_product_actions_get(integer)|193586dcc0acfaa157a6b9fc7f24f33f', 'public.rpc_eaushadhi_product_classification_options(text, bigint)|e4145cc0dc0188c47bbfedddbbdb9da7', 'public.rpc_eaushadhi_product_classification_review_get(integer)|37183e238f164ae8990ed9e3ff82716f', 'public.rpc_eaushadhi_product_classification_review_save(integer, bigint, bigint, bigint, bigint, text, text, boolean)|7fe6eb30177bb55c46bd80718eebdd92', 'public.rpc_eaushadhi_product_evidence_status(integer)|8fb70200b1f5bd9bd325d9e2eff79999', 'public.rpc_eaushadhi_product_review_get(integer)|b7694fd45e9793cf043c4675bed914fa', 'public.rpc_eaushadhi_promote_verified_formulation(integer, bigint, text)|3a905e04a6b2347e83a1340abe128050', 'public.rpc_eaushadhi_register_approved_product_copy(integer, text, text, text, text, bigint, text, text)|6a7cbc866262ab1cdf644a9a8ab54d9e']::text[];
  c_api constant text[] := ARRAY['anon','authenticated','service_role','postgres'];
  -- Roles the owner asked to see even if the catalog says they are fine (production review of 25 Nov 2026).
  c_review constant text[] := ARRAY['authenticator','cli_login_postgres','dashboard_user','pgbouncer','supabase_auth_admin','supabase_functions_admin','supabase_privileged_role','supabase_read_only_user','supabase_realtime_admin','supabase_replication_admin','supabase_storage_admin'];
  v_setpriv text := CASE WHEN current_setting('server_version_num')::int >= 160000 THEN 'SET' ELSE 'MEMBER' END;
  ro record; e text; v_oid oid; g text; b boolean;
  n_direct int; n_inh int; n_pub int; n_exec int; can_set boolean; set_to text; inh_from text; cls text;
  n_loses int := 0; v_calls bigint; sess int;
BEGIN
  IF coalesce(array_length(c_pinned, 1), 0) <> 10 THEN RAISE EXCEPTION 'S1_03 HOLD: pinned list not populated with 10 entries'; END IF;
  RAISE NOTICE 'S1_03 server_version=% SET-check=%', current_setting('server_version'), v_setpriv;
  FOR ro IN
    SELECT r.oid, r.rolname, r.rolinherit, r.rolcanlogin FROM pg_roles r
     WHERE NOT r.rolsuper AND r.rolname !~ '^pg_'
       AND (r.rolname = ANY (c_review)
            OR EXISTS (SELECT 1 FROM unnest(c_pinned) x WHERE has_function_privilege(r.oid, to_regprocedure(split_part(x, '|', 1)), 'EXECUTE')))
     ORDER BY r.rolname
  LOOP
    n_direct := 0; n_inh := 0; n_pub := 0; n_exec := 0; can_set := false; set_to := ''; inh_from := '';
    FOREACH e IN ARRAY c_pinned LOOP
      v_oid := to_regprocedure(split_part(e, '|', 1));
      IF v_oid IS NULL THEN RAISE EXCEPTION 'S1_03 HOLD: pinned signature not found: %', split_part(e, '|', 1); END IF;
      b := has_function_privilege(ro.oid, v_oid, 'EXECUTE');
      IF b THEN n_exec := n_exec + 1; END IF;
      IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                  WHERE p.oid = v_oid AND a.grantee = ro.oid AND a.privilege_type = 'EXECUTE') THEN
        n_direct := n_direct + 1;
      ELSIF EXISTS (SELECT 1 FROM unnest(c_api) x WHERE x <> ro.rolname AND pg_has_role(ro.oid, x::name, 'USAGE')) THEN
        n_inh := n_inh + 1;
      ELSIF b THEN
        n_pub := n_pub + 1;
      END IF;
    END LOOP;
    FOREACH g IN ARRAY c_api LOOP
      IF g <> ro.rolname THEN
        EXECUTE format('SELECT pg_has_role(%L, %L, %L)', ro.rolname, g, v_setpriv) INTO b;
        IF b THEN can_set := true; set_to := set_to || g || ' '; END IF;
        IF pg_has_role(ro.oid, g::name, 'USAGE') THEN inh_from := inh_from || g || ' '; END IF;
      END IF;
    END LOOP;
    cls := CASE WHEN n_pub = 0 THEN 'KEEPS_ACCESS'
                WHEN can_set THEN 'COVERED_BY_SET_ROLE'
                ELSE 'LOSES_ACCESS_NO_PATH' END;
    IF n_exec = 0 AND n_direct = 0 THEN cls := 'NO_CURRENT_EXECUTE'; END IF;
    IF cls = 'LOSES_ACCESS_NO_PATH' THEN n_loses := n_loses + 1; END IF;
    SELECT count(*) INTO sess FROM pg_stat_activity WHERE usename = ro.rolname;
    RAISE NOTICE 'role % [%]: login=% inherit=% | direct=%/10 inherited=%/10 public_only=%/10 | inherits-from=[%] set_role_to=[%] | sessions_now=%',
      ro.rolname, cls, ro.rolcanlogin, ro.rolinherit, n_direct, n_inh, n_pub, trim(inh_from), trim(set_to), sess;
  END LOOP;
  FOR ro IN SELECT unnest(c_review) AS rn EXCEPT SELECT rolname FROM pg_roles ORDER BY 1 LOOP
    RAISE NOTICE 'role % : not present in this database cluster', ro.rn;
  END LOOP;
  RAISE NOTICE 'S1_03 roles with LOSES_ACCESS_NO_PATH: % (S1_01 stops on each unless the owner lists it in c_accepted_losers)', n_loses;
  RAISE NOTICE 'S1_03 function-level evidence: track_functions=%', current_setting('track_functions');
  FOREACH e IN ARRAY c_pinned LOOP
    SELECT coalesce(sum(f.calls), 0) INTO v_calls FROM pg_stat_user_functions f WHERE f.funcid = to_regprocedure(split_part(e, '|', 1))::oid;
    RAISE NOTICE '   calls recorded since stats reset: % -> %', v_calls, split_part(e, '|', 1);
  END LOOP;
  RAISE NOTICE 'S1_03 NOTE: actual per-role functional dependence is NOT derivable from the catalog; use Supabase API/Postgres logs or enable track_functions/pg_stat_statements on staging.';
END
$s1a$;
COMMIT;
