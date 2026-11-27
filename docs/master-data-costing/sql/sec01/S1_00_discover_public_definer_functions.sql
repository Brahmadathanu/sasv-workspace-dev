-- SEC-01 / STEP 0 of 3 -- READ-ONLY discovery. Run as administrator. Changes nothing.
-- Prints, for every public.rpc_eaushadhi_* SECURITY DEFINER function that PUBLIC can execute:
--   * the exact pin entry 'schema.name(identity args)|md5(pg_get_functiondef)' to paste into the
--     c_pinned arrays of S1_01 / S1_02 / S1_99 (all three MUST carry the identical ten entries),
--   * owner, ACL, and which non-superuser roles reach the function ONLY through PUBLIC.
-- Expect exactly 10 entries. Any other count means the live catalog differs from the review; stop.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';
DO $s1d$
DECLARE
  fn record; r record; n int := 0; api text[] := ARRAY['anon','authenticated','service_role','postgres'];
  sole text;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proowner AS ownoid, pg_get_userbyid(p.proowner) AS owner, p.proacl AS aclarr, p.proacl::text AS acl,
           format('%I.%I(%s)', ns.nspname, p.proname, oidvectortypes(p.proargtypes)) AS sig,
           md5(pg_get_functiondef(p.oid)) AS fp
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname LIKE 'rpc\_eaushadhi\_%' AND p.prokind = 'f' AND p.prosecdef
       AND EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
     ORDER BY p.proname, oidvectortypes(p.proargtypes)
  LOOP
    n := n + 1;
    sole := '';
    FOR r IN
      SELECT rolname FROM pg_roles ro
       WHERE NOT ro.rolsuper AND ro.rolname !~ '^pg_' AND has_function_privilege(ro.oid, fn.oid, 'EXECUTE')
         AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(fn.aclarr, acldefault('f', fn.ownoid))) a
                          WHERE a.grantee = ro.oid AND a.privilege_type = 'EXECUTE')
       ORDER BY 1
    LOOP
      sole := sole || r.rolname || ' ';
    END LOOP;
    RAISE NOTICE 'entry: ''%|%''', fn.sig, fn.fp;
    RAISE NOTICE '   owner=% acl=% reached-only-via-PUBLIC/inheritance: [%]', fn.owner, fn.acl, trim(sole);
  END LOOP;
  RAISE NOTICE 'S1_00 RESULT: % PUBLIC-executable SECURITY DEFINER rpc_eaushadhi_* functions (review expects 10)', n;
END
$s1d$;
COMMIT;
