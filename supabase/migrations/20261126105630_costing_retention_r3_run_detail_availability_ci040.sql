-- R3: detail-availability protection. Apply after R1 (and, before any purge, R4). PostgreSQL 17.
-- Single fail-closed notion of "run details are available", enforced at the choke points that exist in the live catalog:
--   1. costing.v_current_successful_costing_refresh_run (pointer view used by ~39 current-run projections) never selects a run
--      whose details are purged / being purged / incomplete. Ranking is unchanged and computed over all candidate runs; if the
--      top-ranked run's details are unavailable the period has NO current run (explicit), never a silent promotion of another draft.
--   2. approval / supersession preflight (costing.fn_w2_run_checks) gets a DETAILS_AVAILABLE check.
--   3. costing.fn_assert_run_details_available(run) for exact-run RPCs, and public.rpc_costing_run_detail_availability(run) for the UI.
-- Exact-run RPCs that are not yet wired are listed by PREFLIGHT_03_consumer_inventory.sql (see R3_CONSUMER_AUDIT.md).
BEGIN;
SET LOCAL lock_timeout='5s';

CREATE FUNCTION costing_retention.fn_run_detail_availability(p_refresh_run_id bigint)
RETURNS TABLE(refresh_run_id bigint,available boolean,state text,unverified boolean,period_start date,run_status text,reason text,details_purged_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,costing AS $$
 SELECT p_refresh_run_id,
   coalesce(l.detail_state IN ('DETAILS_AVAILABLE','DETAILS_UNVERIFIED') AND l.current_overall_status='SUCCESS',false),
   CASE WHEN l.refresh_run_id IS NULL THEN 'UNKNOWN_RUN'
        WHEN l.detail_state='DETAILS_AVAILABLE' THEN 'AVAILABLE'
        WHEN l.detail_state='DETAILS_UNVERIFIED' AND l.current_overall_status='SUCCESS' THEN 'AVAILABLE_UNVERIFIED'
        WHEN l.detail_state='DETAILS_UNVERIFIED' THEN 'INCOMPLETE'
        ELSE l.detail_state END,
   coalesce(l.detail_state='DETAILS_UNVERIFIED',false),
   l.period_start,l.current_overall_status,
   CASE WHEN l.refresh_run_id IS NULL THEN 'Run is not registered in the retention ledger'
        WHEN l.detail_state='DETAILS_PURGED' THEN 'Detailed snapshots of this run were removed by governed retention; summary and approval evidence are preserved'
        WHEN l.detail_state='PURGE_IN_PROGRESS' THEN 'Detail removal is in progress; details must not be used'
        WHEN l.detail_state='RUN_IN_PROGRESS' THEN 'Run has not finished'
        WHEN l.detail_state='DETAILS_INCOMPLETE' OR l.current_overall_status<>'SUCCESS' THEN 'Run did not complete successfully; partial rows may exist and are not a valid cost basis'
        ELSE NULL END,
   l.details_purged_at
 FROM (SELECT 1) x LEFT JOIN costing.costing_run_retention_ledger l ON l.refresh_run_id=p_refresh_run_id $$;
REVOKE ALL ON FUNCTION costing_retention.fn_run_detail_availability(bigint) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION costing.fn_assert_run_details_available(p_refresh_run_id bigint) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,costing,costing_retention AS $$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM costing_retention.fn_run_detail_availability(p_refresh_run_id);
 IF NOT a.available THEN
  RAISE EXCEPTION 'RUN_DETAILS_UNAVAILABLE: run % is %: %',p_refresh_run_id,a.state,coalesce(a.reason,'details unavailable') USING errcode='P0001';
 END IF;
END $$;
REVOKE ALL ON FUNCTION costing.fn_assert_run_details_available(bigint) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_costing_run_detail_availability(p_refresh_run_id bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,costing,costing_retention AS $$
DECLARE a record;
BEGIN
 PERFORM public.require_permission('module:costing-control-center',false);
 SELECT * INTO a FROM costing_retention.fn_run_detail_availability(p_refresh_run_id);
 RETURN jsonb_build_object('refresh_run_id',a.refresh_run_id,'available',a.available,'state',a.state,'unverified',a.unverified,
   'period_start',a.period_start,'run_status',a.run_status,'reason',a.reason,'details_purged_at',a.details_purged_at);
END $$;
REVOKE ALL ON FUNCTION public.rpc_costing_run_detail_availability(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_costing_run_detail_availability(bigint) TO authenticated;

-- 1. Pointer view: fail closed on drift (live md5 is pinned by W2; override only for isolated fixtures via GUC).
DO $$ DECLARE pin text:=coalesce(nullif(current_setting('costing_retention.pointer_view_md5',true),''),'5cc25791985abf5d336fb9311da3d6f1');
BEGIN
 IF md5(pg_get_viewdef('costing.v_current_successful_costing_refresh_run'::regclass))<>pin
 THEN RAISE EXCEPTION 'R3 precheck: pointer view definition drifted from the reviewed pin'; END IF;
END $$;
CREATE OR REPLACE VIEW costing.v_current_successful_costing_refresh_run AS
select refresh_run_id, period_start, valuation_date, overall_status, valuation_context_source, source_trigger,
       requested_scope, requested_at, started_at, finished_at, selection_basis
from (
  select r.id as refresh_run_id, r.period_start, r.valuation_date, r.overall_status, r.valuation_context_source,
         r.source_trigger, r.requested_scope, r.requested_at, r.started_at, r.finished_at, l.detail_state,
         case e.designation when 'APPROVED' then 'APPROVED' when 'REFERENCE' then 'REFERENCE_FALLBACK' else 'LATEST_SUCCESS' end as selection_basis,
         row_number() over (partition by r.period_start
           order by case e.designation when 'APPROVED' then 1 when 'REFERENCE' then 3 else 2 end,
                    r.finished_at desc nulls last, r.id desc) as governed_run_rank
  from costing.costing_refresh_run r
  left join costing.costing_run_retention_ledger l on l.refresh_run_id = r.id
  left join costing.v_costing_run_effective_designation e
         on e.refresh_run_id = r.id and e.designation in ('REFERENCE','APPROVED')
  where r.overall_status = 'SUCCESS' and r.valuation_context_source = 'CAPTURED_AT_REQUEST'
) ranked
-- rank over ALL candidate runs first, then require availability: a purged top-ranked run yields NO current run (explicit),
-- never a silent fallback to an older draft. A run missing from the ledger is also treated as unavailable (fail closed).
where governed_run_rank = 1 and detail_state in ('DETAILS_UNVERIFIED','DETAILS_AVAILABLE');

-- 2. Approval/supersession preflight: add DETAILS_AVAILABLE. Anchor-based patch of the CURRENT definition; fails closed.
DO $$ DECLARE v_oid oid; v_def text; v_anchor text:=$a$|| jsonb_build_object('code','REVIEW_REQUIRED_RECORDED'$a$; v_n int;
BEGIN
 SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='costing' AND p.proname='fn_w2_run_checks'
   AND pg_get_function_identity_arguments(p.oid)='p_run bigint, p_mode text';
 IF v_oid IS NULL THEN RAISE EXCEPTION 'R3: costing.fn_w2_run_checks not found'; END IF;
 v_def:=pg_get_functiondef(v_oid);
 IF position('DETAILS_AVAILABLE' IN v_def)>0 THEN RETURN; END IF;   -- idempotent
 -- CI-040 live governance uses NO_UNRESOLVED_REVIEWS; legacy fixture uses REVIEW_REQUIRED_RECORDED.
 IF position(v_anchor IN v_def)=0 THEN v_anchor:=$a$|| jsonb_build_object('code','NO_UNRESOLVED_REVIEWS'$a$; END IF;
 v_n:=(length(v_def)-length(replace(v_def,v_anchor,'')))/length(v_anchor);
 IF v_n<>1 THEN RAISE EXCEPTION 'R3: expected exactly one anchor in fn_w2_run_checks, found %',v_n; END IF;
 v_def:=replace(v_def,v_anchor,$r$|| jsonb_build_object('code','DETAILS_AVAILABLE','pass',(SELECT a.available FROM costing_retention.fn_run_detail_availability(p_run) a),
   'detail',(SELECT a.state FROM costing_retention.fn_run_detail_availability(p_run) a))
         $r$||v_anchor);
 v_def:=replace(v_def,'SET search_path TO ''costing'', ''public'', ''pg_temp''','SET search_path TO ''costing'', ''costing_retention'', ''public'', ''pg_temp''');
 EXECUTE v_def;
END $$;
COMMIT;
