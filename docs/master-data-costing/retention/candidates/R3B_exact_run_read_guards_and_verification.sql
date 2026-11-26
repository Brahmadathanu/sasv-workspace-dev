-- R3B: exact-run server read protection, evidence-based verification, approval gate, stale-label fix. PostgreSQL 17.
-- Apply after R1 and R3. Installs: (1) costing_retention.fn_assert_run_details_not_purged for READ paths, (2) a reviewed manifest
-- + fail-closed installer that patches exact signatures (nothing is patched by this file itself), (3) bounded evidence-based
-- verification UNVERIFIED -> AVAILABLE, (4) DETAILS_VERIFIED approval check, (5) newer_draft_run_id fix for purged/purging drafts.
-- Read paths block only REMOVED detail (PURGED / PURGE_IN_PROGRESS): in-progress and failed runs keep readable partial data and
-- metadata; they are never a valid COST BASIS, which approval/selection enforce via the strict availability check.
BEGIN;
SET LOCAL lock_timeout='5s';

ALTER TABLE costing.costing_run_retention_ledger
  ADD COLUMN IF NOT EXISTS detail_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS detail_verification_evidence jsonb;

-- (1) READ assertion. Unknown/unregistered run ids pass (the guarded function's own validation reports a missing run).
CREATE FUNCTION costing.fn_assert_run_details_not_purged(p_refresh_run_id bigint) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,costing,costing_retention AS $$
DECLARE a record;
BEGIN
 IF p_refresh_run_id IS NULL THEN RETURN; END IF;
 SELECT * INTO a FROM costing_retention.fn_run_detail_availability(p_refresh_run_id);
 IF a.state IN ('DETAILS_PURGED','PURGE_IN_PROGRESS') THEN
  RAISE EXCEPTION 'RUN_DETAILS_UNAVAILABLE: run % is %: %',p_refresh_run_id,a.state,coalesce(a.reason,'details removed') USING errcode='P0001';
 END IF;
END $$;
REVOKE ALL ON FUNCTION costing.fn_assert_run_details_not_purged(bigint) FROM PUBLIC,anon,authenticated,service_role;

-- (2) Reviewed manifest. expected_md5 is the md5 of pg_get_functiondef of the LIVE function and must be supplied from the live
-- read-only packet (preflight/PREFLIGHT_06) - the installer refuses NULL unless called with p_allow_unpinned (tests only).
CREATE TABLE costing_retention.read_guard_manifest (
 schema_name text NOT NULL, function_name text NOT NULL, run_param text NOT NULL DEFAULT 'p_refresh_run_id',
 mode text NOT NULL CHECK (mode IN ('AFTER_BEGIN','AFTER_PERMISSIONS')),
 status text NOT NULL CHECK (status IN ('INSTALL','DEFERRED')),
 reason text NOT NULL, expected_md5 text CHECK (expected_md5 IS NULL OR expected_md5 ~ '^[0-9a-f]{32}$'),
 PRIMARY KEY (schema_name,function_name)
);
CREATE TABLE costing_retention.read_guard_receipt (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, schema_name text NOT NULL, function_name text NOT NULL, identity_args text NOT NULL,
 md5_before text NOT NULL, md5_after text NOT NULL, outcome text NOT NULL, installed_at timestamptz NOT NULL DEFAULT clock_timestamp(), installed_by text NOT NULL DEFAULT session_user
);
CREATE TRIGGER read_guard_receipt_append_only BEFORE UPDATE OR DELETE ON costing_retention.read_guard_receipt FOR EACH ROW EXECUTE FUNCTION costing_retention.fn_reject_evidence_mutation();
REVOKE ALL ON ALL TABLES IN SCHEMA costing_retention FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA costing_retention FROM PUBLIC,anon,authenticated,service_role;

-- Proposed rows from repository review (R3_CONSUMER_AUDIT.md). One resolver guard covers every public caller of that resolver.
INSERT INTO costing_retention.read_guard_manifest(schema_name,function_name,mode,status,reason) VALUES
 ('costing','fn_resolve_material_trace_selected_run','AFTER_BEGIN','INSTALL','Single choke point for the six RM/PM material trace list/filter/export RPCs; internal helper (API roles revoked), called after each caller''s permission checks; exact-run branch only.'),
 ('costing','fn_resolve_materials_stores_explain_selected_run','AFTER_BEGIN','INSTALL','Choke point for product/SKU Materials-Stores explain RPCs (permission checked by callers first).'),
 ('costing','fn_resolve_qc_explain_selected_run','AFTER_BEGIN','INSTALL','Choke point for product/SKU QC explain RPCs (permission checked by callers first).'),
 ('public','rpc_get_exact_run_cost_pool_reconciliation','AFTER_PERMISSIONS','INSTALL','Exact-run read; module:cost-build-manager gate first.'),
 ('public','rpc_get_production_route_manager_exact_run_readiness','AFTER_PERMISSIONS','INSTALL','PRM exact-run readiness queue read.'),
 ('public','rpc_get_production_route_manager_workload_detail','AFTER_PERMISSIONS','INSTALL','PRM workload detail read.'),
 ('public','rpc_get_production_route_manager_workload_preview','AFTER_PERMISSIONS','INSTALL','PRM workload preview list read.'),
 ('public','rpc_get_production_route_pipeline_status','AFTER_PERMISSIONS','INSTALL','PRM pipeline status read (status metadata of a purged run is not meaningful).'),
 ('public','rpc_get_route_family_foundation_review','AFTER_PERMISSIONS','INSTALL','Route-family foundation review read.'),
 ('public','rpc_get_route_family_mapping_review_candidates','AFTER_PERMISSIONS','INSTALL','Mapping review candidates read.'),
 ('public','rpc_get_route_workload_management_explain','AFTER_PERMISSIONS','INSTALL','Route workload explain read.'),
 ('public','rpc_get_regional_marketing_evidence_review_queue','AFTER_PERMISSIONS','INSTALL','Review queue read for a run (module:costing-control-center gate first).'),
 ('public','rpc_preview_direct_labour_shadow_monetary_reconciliation','AFTER_PERMISSIONS','INSTALL','Read-only preview over an exact run.'),
 ('public','rpc_preview_direct_labour_shadow_workload','AFTER_PERMISSIONS','INSTALL','Read-only preview over an exact run.'),
 ('public','rpc_preview_production_overhead_workload','AFTER_PERMISSIONS','INSTALL','Read-only preview over an exact run.'),
 ('public','rpc_preview_shared_standard_batch_route_foundation','AFTER_PERMISSIONS','INSTALL','Read-only preview over an exact run.'),
 ('public','rpc_get_route_family_onboarding_status','AFTER_PERMISSIONS','DEFERRED','Repo shows its permission call only in the onboarding WRITER definition; confirm the live reader definition (PREFLIGHT_06) before install.'),
 ('public','rpc_get_product_sku_readiness','AFTER_PERMISSIONS','DEFERRED','No require_permission anchor in the repository definition; delegates to costing.fn_product_sku_readiness_* (language sql helper). Needs live definition review.');

-- Fail-closed installer: exact (schema,name,run param) must match exactly one function; plpgsql + SECURITY DEFINER only;
-- pin verified on the ORIGINAL bytes; CRLF normalised only afterwards; existing grants/owner/SET options preserved by CREATE OR REPLACE.
CREATE FUNCTION costing_retention.install_read_guards(p_allow_unpinned boolean DEFAULT false)
RETURNS TABLE(function_name text,outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,costing,costing_retention AS $$
DECLARE m record; f record; v_def text; v_new text; v_n int; v_guard text; v_before text; v_pat text;
BEGIN
 FOR m IN SELECT * FROM costing_retention.read_guard_manifest WHERE status='INSTALL' ORDER BY schema_name,function_name LOOP
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname=m.schema_name AND p.proname=m.function_name AND m.run_param=ANY(p.proargnames);
  IF v_n<>1 THEN RAISE EXCEPTION 'R3B: % overload(s) of %.% take %; reviewed signature is ambiguous or missing',v_n,m.schema_name,m.function_name,m.run_param; END IF;
  SELECT p.oid,p.prosecdef,p.prolang,pg_get_function_identity_arguments(p.oid) ia INTO f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname=m.schema_name AND p.proname=m.function_name AND m.run_param=ANY(p.proargnames);
  IF (SELECT lanname FROM pg_language WHERE oid=f.prolang)<>'plpgsql' THEN RAISE EXCEPTION 'R3B: %.% is not plpgsql; needs a reviewed wrapper',m.schema_name,m.function_name; END IF;
  IF NOT f.prosecdef THEN RAISE EXCEPTION 'R3B: %.% is SECURITY INVOKER; the guard function is not executable by API roles',m.schema_name,m.function_name; END IF;
  v_def:=pg_get_functiondef(f.oid); v_before:=md5(v_def);
  IF position('fn_assert_run_details_not_purged' IN v_def)>0 THEN function_name:=m.function_name; outcome:='ALREADY_GUARDED'; RETURN NEXT; CONTINUE; END IF;
  IF m.expected_md5 IS NULL AND NOT p_allow_unpinned THEN RAISE EXCEPTION 'R3B: no reviewed md5 pin for %.% (supply it from the live read-only packet)',m.schema_name,m.function_name; END IF;
  IF m.expected_md5 IS NOT NULL AND m.expected_md5<>v_before THEN RAISE EXCEPTION 'R3B: %.% drifted from the reviewed pin',m.schema_name,m.function_name; END IF;
  v_def:=replace(v_def,E'\r\n',E'\n');
  v_guard:=format('IF %1$s IS NOT NULL THEN PERFORM costing.fn_assert_run_details_not_purged(%1$s); END IF;',m.run_param);
  IF m.mode='AFTER_BEGIN' THEN
   v_pat:='(^[ \t]*BEGIN[ \t]*\n)';
   IF regexp_count(v_def,v_pat,1,'in')<1 THEN RAISE EXCEPTION 'R3B: BEGIN anchor not found in %.%',m.schema_name,m.function_name; END IF;
   v_new:=regexp_replace(v_def,v_pat,E'\\1  '||v_guard||E'\n','in');
  ELSE
   v_pat:='((perform[ \t]+public\.require_permission[ \t]*\([^;]*\)[ \t]*;[ \t\n]*)+)';
   IF regexp_count(v_def,v_pat,1,'i')<1 THEN RAISE EXCEPTION 'R3B: permission anchor not found in %.%',m.schema_name,m.function_name; END IF;
   v_new:=regexp_replace(v_def,v_pat,E'\\1'||v_guard||E'\n  ','i');
  END IF;
  IF v_new=v_def OR (length(v_new)-length(v_def))<>length(v_guard)+(CASE WHEN m.mode='AFTER_BEGIN' THEN 3 ELSE 3 END) THEN
   RAISE EXCEPTION 'R3B: unexpected patch delta for %.%',m.schema_name,m.function_name; END IF;
  EXECUTE v_new;
  INSERT INTO costing_retention.read_guard_receipt(schema_name,function_name,identity_args,md5_before,md5_after,outcome)
   VALUES(m.schema_name,m.function_name,f.ia,v_before,md5(pg_get_functiondef(f.oid)),'INSTALLED');
  function_name:=m.function_name; outcome:='INSTALLED'; RETURN NEXT;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION costing_retention.install_read_guards(boolean) FROM PUBLIC,anon,authenticated,service_role;

-- (3) Bounded evidence-based verification: status alone never verifies. Evidence = successful CAPTURED_AT_REQUEST run with a finish
-- time, a captured fingerprint, an exact fingerprint re-verification with zero drifted tables, and a non-empty cost sheet.
CREATE FUNCTION costing_retention.fn_verify_run_details(p_run bigint,p_mark boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,costing,costing_retention SET statement_timeout='180s' AS $$
DECLARE l costing.costing_run_retention_ledger; r costing.costing_refresh_run; v_fp bigint; v_tables int; v_drift int; v_rows bigint; v_ev jsonb; v_reason text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('costing-retention-verify:'||p_run::text,0));
 SELECT * INTO l FROM costing.costing_run_retention_ledger WHERE refresh_run_id=p_run FOR UPDATE;
 SELECT * INTO r FROM costing.costing_refresh_run WHERE id=p_run;
 IF l.refresh_run_id IS NULL OR r.id IS NULL THEN RETURN jsonb_build_object('verified',false,'run',p_run,'reason','run is not registered'); END IF;
 IF l.detail_state='DETAILS_AVAILABLE' THEN RETURN jsonb_build_object('verified',true,'run',p_run,'already',true,'evidence',l.detail_verification_evidence); END IF;
 IF l.detail_state<>'DETAILS_UNVERIFIED' THEN RETURN jsonb_build_object('verified',false,'run',p_run,'reason','state is '||l.detail_state||'; only unverified successful runs can be verified'); END IF;
 IF r.overall_status<>'SUCCESS' OR r.valuation_context_source IS DISTINCT FROM 'CAPTURED_AT_REQUEST' OR r.finished_at IS NULL THEN
  v_reason:='run is not a finished successful governed run (status='||r.overall_status||', context='||coalesce(r.valuation_context_source,'null')||')';
 ELSE
  SELECT f.id INTO v_fp FROM costing.costing_run_fingerprint f WHERE f.refresh_run_id=p_run ORDER BY f.captured_at DESC,f.id DESC LIMIT 1;
  IF v_fp IS NULL THEN v_reason:='NO_FINGERPRINT_EVIDENCE: no captured run fingerprint exists for this run';
  ELSE
   SELECT count(*),count(*) FILTER (WHERE NOT v.matches) INTO v_tables,v_drift FROM costing.fn_verify_run_fingerprint(p_run) v;
   SELECT count(*) INTO v_rows FROM costing.v_sku_detailed_cost_sheet WHERE refresh_run_id=p_run;
   IF v_tables=0 THEN v_reason:='fingerprint re-verification compared no tables';
   ELSIF v_drift>0 THEN v_reason:='FINGERPRINT_DRIFT: '||v_drift||' of '||v_tables||' tables differ from the captured fingerprint';
   ELSIF v_rows=0 THEN v_reason:='cost sheet has no rows for this run';
   END IF;
  END IF;
 END IF;
 v_ev:=jsonb_build_object('fingerprint_id',v_fp,'tables_compared',v_tables,'tables_drifted',v_drift,'cost_sheet_rows',v_rows,'run_finished_at',r.finished_at,'verified_by',session_user);
 IF v_reason IS NOT NULL THEN
  IF p_mark THEN UPDATE costing.costing_run_retention_ledger SET last_blocker='VERIFY_FAILED: '||v_reason,last_preflight_at=clock_timestamp() WHERE refresh_run_id=p_run; END IF;
  RETURN jsonb_build_object('verified',false,'run',p_run,'reason',v_reason,'evidence',v_ev);
 END IF;
 IF p_mark THEN UPDATE costing.costing_run_retention_ledger SET detail_state='DETAILS_AVAILABLE',detail_verified_at=clock_timestamp(),detail_verification_evidence=v_ev,last_blocker=NULL WHERE refresh_run_id=p_run; END IF;
 RETURN jsonb_build_object('verified',true,'run',p_run,'evidence',v_ev,'marked',p_mark);
END $$;
REVOKE ALL ON FUNCTION costing_retention.fn_verify_run_details(bigint,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_costing_verify_run_details(p_refresh_run_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,costing,costing_retention AS $$
BEGIN
 PERFORM public.require_permission('module:costing-control-center',true);
 RETURN costing_retention.fn_verify_run_details(p_refresh_run_id,true);
END $$;
REVOKE ALL ON FUNCTION public.rpc_costing_verify_run_details(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_costing_verify_run_details(bigint) TO authenticated;

-- (4) Approval gate: a NEW approval requires verified (evidence-based) detail. Legacy approved runs stay UNVERIFIED-but-readable.
DO $$ DECLARE v_oid oid; v_def text; v_anchor text:=$a$|| jsonb_build_object('code','REVIEW_REQUIRED_RECORDED'$a$; v_n int;
BEGIN
 SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='costing' AND p.proname='fn_w2_run_checks'
   AND pg_get_function_identity_arguments(p.oid)='p_run bigint, p_mode text';
 IF v_oid IS NULL THEN RAISE EXCEPTION 'R3B: costing.fn_w2_run_checks not found'; END IF;
 v_def:=replace(pg_get_functiondef(v_oid),E'\r\n',E'\n');
 IF position('DETAILS_VERIFIED' IN v_def)>0 THEN RETURN; END IF;
 -- CI-040 live governance uses NO_UNRESOLVED_REVIEWS; legacy fixture uses REVIEW_REQUIRED_RECORDED.
 IF position(v_anchor IN v_def)=0 THEN v_anchor:=$a$|| jsonb_build_object('code','NO_UNRESOLVED_REVIEWS'$a$; END IF;
 v_n:=(length(v_def)-length(replace(v_def,v_anchor,'')))/length(v_anchor);
 IF v_n<>1 THEN RAISE EXCEPTION 'R3B: expected exactly one anchor in fn_w2_run_checks, found %',v_n; END IF;
 EXECUTE replace(v_def,v_anchor,$r$|| jsonb_build_object('code','DETAILS_VERIFIED','pass',coalesce((SELECT a.state='AVAILABLE' FROM costing_retention.fn_run_detail_availability(p_run) a),false),
   'detail',coalesce((SELECT a.state FROM costing_retention.fn_run_detail_availability(p_run) a),'UNKNOWN_RUN')||' (run rpc_costing_verify_run_details; status alone is not evidence)')
         $r$||v_anchor);
END $$;

-- (5) Period status: a purged or purging draft is never offered as the "newer draft" (selection rank, pointer and pricing authority untouched;
-- every extended column is preserved because the live definition itself is re-issued).
DO $$ DECLARE v_def text; v_anchor text:=$a$(COALESCE(ls.designation, ''::text) <> ALL (ARRAY['APPROVED'::text, 'REFERENCE'::text]))$a$; v_n int;
 pin text:=coalesce(nullif(current_setting('costing_retention.period_status_md5',true),''),'4d728516b89a094376e60b95be12323d');
BEGIN
 v_def:=pg_get_viewdef('costing.v_costing_period_run_status'::regclass);
 IF position('costing_run_retention_ledger' IN v_def)>0 THEN RETURN; END IF;
 IF md5(v_def)<>pin THEN RAISE EXCEPTION 'R3B: period-status view drifted from the reviewed live pin'; END IF;
 v_def:=replace(v_def,E'\r\n',E'\n');
 v_n:=(length(v_def)-length(replace(v_def,v_anchor,'')))/length(v_anchor);
 IF v_n<>1 THEN RAISE EXCEPTION 'R3B: period-status anchor count %',v_n; END IF;
 EXECUTE 'CREATE OR REPLACE VIEW costing.v_costing_period_run_status AS '||replace(v_def,v_anchor,
   v_anchor||$r$ AND (NOT (EXISTS ( SELECT 1 FROM costing.costing_run_retention_ledger lg WHERE ((lg.refresh_run_id = ls.id) AND (lg.detail_state = ANY (ARRAY['PURGE_IN_PROGRESS'::text, 'DETAILS_PURGED'::text]))))))$r$);
END $$;
COMMIT;
-- ROLLBACK: restore saved definitions (functions listed in read_guard_receipt: md5_before identifies the original), re-run the saved
-- CREATE OR REPLACE VIEW for v_costing_period_run_status and fn_w2_run_checks; DROP the new functions/tables. Ledger columns are harmless.
