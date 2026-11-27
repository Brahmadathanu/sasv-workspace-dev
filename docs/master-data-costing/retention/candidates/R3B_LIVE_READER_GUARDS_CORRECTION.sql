-- Production-specific corrective candidate. Apply only after PG17 regression and permission acceptance.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.rpc_assert_regional_run_details(p_refresh_run_id bigint) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,costing AS $$
BEGIN
 PERFORM public.require_permission('module:costing-control-center',false);
 PERFORM costing.fn_assert_run_details_not_purged(p_refresh_run_id);
END $$;
REVOKE ALL ON FUNCTION public.rpc_assert_regional_run_details(bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_assert_regional_run_details(bigint) TO authenticated,service_role;

DO $patch$
DECLARE m record; f record; d text; original text; a text; b text; pat text; guard text; n int;
BEGIN
 INSERT INTO costing_retention.read_guard_manifest(schema_name,function_name,mode,status,reason,expected_md5) VALUES
 ('public','rpc_get_monthly_allocation_driver_trace','AFTER_PERMISSIONS','INSTALL','Exact-run allocation trace; after explicit authentication','73bf765e81783d8af334c1fc98ec2385'),
 ('public','rpc_get_route_workload_management_explain_core','AFTER_PERMISSIONS','INSTALL','Directly executable exact-run core','3ceafef4104a79997aa1085c9b825a43');
 UPDATE costing_retention.read_guard_manifest SET status='INSTALL' WHERE status='DEFERRED';
 IF (SELECT count(*) FROM costing_retention.read_guard_manifest)<>20 THEN RAISE EXCEPTION 'Unexpected manifest size'; END IF;
 FOR m IN SELECT * FROM costing_retention.read_guard_manifest ORDER BY schema_name,function_name LOOP
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname=m.schema_name AND p.proname=m.function_name AND m.run_param=ANY(p.proargnames);
  IF n<>1 THEN RAISE EXCEPTION 'Ambiguous signature: %',m.function_name; END IF;
  SELECT p.oid,p.proacl,p.proowner,p.prosecdef,p.proconfig,p.provolatile,pg_get_function_identity_arguments(p.oid) ia INTO f FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname=m.schema_name AND p.proname=m.function_name AND m.run_param=ANY(p.proargnames);
  original:=pg_get_functiondef(f.oid);
  IF md5(original) IS DISTINCT FROM m.expected_md5 THEN RAISE EXCEPTION 'Definition drift: %',m.function_name; END IF;
  d:=replace(original,E'\r\n',E'\n');
  guard:='PERFORM costing.fn_assert_run_details_not_purged(p_refresh_run_id);';
  IF m.schema_name='costing' THEN
   -- Preserve rank-before-availability. Inspect the original winner only when the governed selector returns no row.
   pat:='(LIMIT 1;[ \t\n]*)(RETURN;)';
   IF regexp_count(d,pat,1,'i')<>1 THEN RAISE EXCEPTION 'Implicit resolver anchor: %',m.function_name; END IF;
   d:=regexp_replace(d,pat,E'\\1'||$body$
    IF NOT FOUND THEN
     PERFORM costing.fn_assert_run_details_not_purged((
      SELECT r.id FROM costing.costing_refresh_run r
      LEFT JOIN costing.v_costing_run_effective_designation e ON e.refresh_run_id=r.id AND e.designation IN ('APPROVED','REFERENCE')
      WHERE r.period_start=v_period AND r.overall_status='SUCCESS' AND r.valuation_context_source='CAPTURED_AT_REQUEST'
      ORDER BY CASE e.designation WHEN 'APPROVED' THEN 1 WHEN 'REFERENCE' THEN 3 ELSE 2 END,r.finished_at DESC NULLS LAST,r.id DESC LIMIT 1
     ));
    END IF;
    $body$||E'\\2','i');
   pat:='(RETURN QUERY[ \t\n]+SELECT[ \t\n]+r.period_start,[ \t\n]+r.valuation_date,[ \t\n]+r.id)';
   IF regexp_count(d,pat,1,'i')<>1 THEN RAISE EXCEPTION 'Exact resolver anchor: %',m.function_name; END IF;
   d:=regexp_replace(d,pat,guard||E'\n  \\1','i');
  ELSIF m.function_name='rpc_get_product_sku_readiness' THEN
   a:='if p_refresh_run_id is null then raise exception ''Refresh run ID is required for EXACT_RUN''; end if;';
   IF regexp_count(d,a,1,'q')<>1 THEN RAISE EXCEPTION 'Readiness anchor'; END IF;
   d:=replace(d,a,a||E'\n  '||guard);
  ELSE
   IF m.function_name='rpc_get_regional_marketing_evidence_review_queue' THEN
    IF f.prosecdef THEN RAISE EXCEPTION 'Regional invoker changed'; END IF;
    guard:='PERFORM public.rpc_assert_regional_run_details(p_refresh_run_id);';
   ELSIF NOT f.prosecdef THEN RAISE EXCEPTION 'Unexpected invoker: %',m.function_name;
   END IF;
   IF m.function_name='rpc_get_monthly_allocation_driver_trace' THEN
    pat:='(if auth\.uid\(\) is null then[ \t\n]+raise exception[ \t\n]+''Authenticated user context is required\.'';[ \t\n]+end if;)';
   ELSE
    pat:='(perform[ \t\n]+public\.require_permission[ \t\n]*\([^;]*\)[ \t\n]*;)';
   END IF;
   IF regexp_count(d,pat,1,'i')<>1 THEN RAISE EXCEPTION 'Permission anchor: %',m.function_name; END IF;
   d:=regexp_replace(d,pat,E'\\1\n  '||guard,'i');
  END IF;
  EXECUTE d;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=f.oid AND p.proacl IS NOT DISTINCT FROM f.proacl AND p.proowner=f.proowner AND p.prosecdef=f.prosecdef AND p.proconfig IS NOT DISTINCT FROM f.proconfig AND p.provolatile=f.provolatile) THEN RAISE EXCEPTION 'Security metadata drift: %',m.function_name; END IF;
  INSERT INTO costing_retention.read_guard_receipt(schema_name,function_name,identity_args,md5_before,md5_after,outcome) VALUES(m.schema_name,m.function_name,f.ia,md5(original),md5(pg_get_functiondef(f.oid)),'INSTALLED');
 END LOOP;
 SELECT pg_get_functiondef('costing_retention.fn_verify_run_details(bigint,boolean)'::regprocedure) INTO d;
 IF md5(d)<>'4e15d21a7ce711906d58c7b477b1e2b9' THEN RAISE EXCEPTION 'Verifier drift'; END IF;
 a:='WHERE NOT v.matches';
 IF strpos(d,a)=0 THEN RAISE EXCEPTION 'Verifier anchor missing'; END IF;
 EXECUTE replace(d,a,'WHERE v.matches IS DISTINCT FROM TRUE');
END $patch$;
COMMIT;
