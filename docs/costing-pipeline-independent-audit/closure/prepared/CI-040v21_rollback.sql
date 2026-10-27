-- CI-040 v2.1 ROLLBACK (v2 body + one block: after a CI-042 mode-B rollback it also returns month-end finalise to its pre-CI-042 form). Self-contained SQL; pre-image bodies inlined (identical to live on 26 Oct 2026, md5 of
-- pg_get_functiondef checked against production: fn_w2_run_checks 9ee598ac..., rpc_costing_approve_run 1f6459ac...,
-- rpc_costing_supersede_approved_run 28f3b2cb...). Roll back CI-043, CI-042 and CI-041 first (guard refuses otherwise).
--  A IMMEDIATE STRUCTURAL rollback (no CI-040 audit row and no preview acknowledgement yet): restore the 3 bodies,
--    drop the 6 new functions and the 2 new tables, restore the 9-value event-type constraint -> exactly pre-CI-040.
--  B NON-DESTRUCTIVE rollback after use: restore the 3 bodies (old approve/supersede work again under the old rules)
--    and drop the 2 public RPCs; KEEP the widened constraint, costing_approval_preview_ack (its rows are evidence
--    referenced from audit rows), costing_automation_setting and the internal functions (not granted to clients).
--    Approvals already made stay APPROVED/REVOKED and immutable. Nothing is deleted.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.rpc_costing_lock_periods_for_close(date[],text,text)') IS NOT NULL
     OR to_regprocedure('costing.fn_request_costing_run_on_date(date,date,text,text,text,uuid,boolean)') IS NOT NULL
     OR to_regprocedure('costing.fn_costing_health_check(date)') IS NOT NULL THEN
    RAISE EXCEPTION 'CI040_ROLLBACK_ORDER: roll back CI-043, CI-042 and CI-041 first';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION costing.fn_w2_run_checks(p_run bigint, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare r costing.costing_refresh_run%rowtype; p costing.cost_periods%rowtype; v_des text; v_appr bigint; v_appr_fin timestamptz;
  v_active bigint; v_fp bigint; v_drift bigint; v_total bigint; v_blocked bigint; v_review bigint; v_ready bigint; v_auth bigint;
  c jsonb := '[]'::jsonb;
begin
  if p_mode not in ('APPROVE','SUPERSEDE') then raise exception 'W2_BAD_MODE: %', p_mode; end if;
  select * into r from costing.costing_refresh_run where id = p_run;
  if not found then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'run', p_run, 'checks', jsonb_build_array(jsonb_build_object('code','RUN_EXISTS','pass',false,'detail','Run not found')));
  end if;
  select * into p from costing.cost_periods where period_start = r.period_start;
  select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id = p_run;
  select e.refresh_run_id, rr.finished_at into v_appr, v_appr_fin
    from costing.v_costing_run_effective_designation e join costing.costing_refresh_run rr on rr.id = e.refresh_run_id
   where e.period_start = r.period_start and e.designation = 'APPROVED' and e.refresh_run_id <> p_run
   order by e.designated_at desc limit 1;
  select count(*) into v_active from costing.costing_refresh_run where period_start = r.period_start and overall_status in ('QUEUED','RUNNING');
  select id into v_fp from costing.costing_run_fingerprint where refresh_run_id = p_run order by captured_at desc, id desc limit 1;
  if v_fp is not null then select count(*) into v_drift from costing.fn_verify_run_fingerprint(p_run) where not matches; end if;
  select count(*), count(*) filter (where cost_sheet_status = 'BLOCKED'), count(*) filter (where cost_sheet_status = 'REVIEW_REQUIRED'),
         count(*) filter (where cost_sheet_status = 'READY')
    into v_total, v_blocked, v_review, v_ready from costing.v_sku_detailed_cost_sheet where refresh_run_id = p_run;
  c := c || jsonb_build_object('code','RUN_SUCCESS','pass', r.overall_status = 'SUCCESS' and r.valuation_context_source = 'CAPTURED_AT_REQUEST',
                               'detail', r.overall_status || ' / ' || r.valuation_context_source)
         || jsonb_build_object('code','NOT_ALREADY_DESIGNATED','pass', v_des is null, 'detail', coalesce(v_des, 'none'))
         || jsonb_build_object('code','PERIOD_OPEN','pass', p.status = 'OPEN', 'detail', coalesce(p.status, 'no period'))
         || jsonb_build_object('code','VALUATION_DATE_MATCHES','pass', r.valuation_date = p.valuation_date,
                               'detail', format('run %s / period %s', r.valuation_date, p.valuation_date))
         || jsonb_build_object('code','NO_ACTIVE_RUN','pass', v_active = 0, 'detail', v_active || ' queued/running')
         || jsonb_build_object('code','FINGERPRINT_CAPTURED','pass', v_fp is not null, 'detail', coalesce('capture ' || v_fp, 'none'))
         || jsonb_build_object('code','FINGERPRINT_CLEAN','pass', v_fp is not null and v_drift = 0, 'detail', coalesce(v_drift || ' drifted tables', 'not verifiable'))
         || jsonb_build_object('code','HAS_COST_SHEET','pass', v_total > 0, 'detail', v_total || ' SKUs')
         || jsonb_build_object('code','NO_BLOCKED_SKUS','pass', v_blocked = 0, 'detail', v_blocked || ' BLOCKED')
         || jsonb_build_object('code','NO_UNRESOLVED_REVIEWS','pass', v_review = 0, 'detail', v_review || ' unresolved REVIEW_REQUIRED; zero required before approval');
  if p_mode = 'APPROVE' then
    c := c || jsonb_build_object('code','NO_OTHER_APPROVED_RUN','pass', v_appr is null, 'detail', coalesce('approved run ' || v_appr || ' exists: use supersede', 'none'));
  else
    select a.id into v_auth from costing.costing_period_refresh_authorization a where a.period_start = r.period_start and a.consumed_by_run_id = p_run;
    c := c || jsonb_build_object('code','HAS_APPROVED_RUN_TO_SUPERSEDE','pass', v_appr is not null, 'detail', coalesce('run ' || v_appr, 'none'))
           || jsonb_build_object('code','NEWER_THAN_APPROVED','pass', v_appr is not null and r.finished_at > v_appr_fin,
                                 'detail', format('finished %s vs %s', r.finished_at, v_appr_fin))
           || jsonb_build_object('code','SUPERSESSION_AUTHORISATION_CONSUMED','pass', v_auth is not null, 'detail', coalesce('authorisation ' || v_auth, 'run was not created under a supersession authorisation'));
  end if;
  return jsonb_build_object('ok', not exists (select 1 from jsonb_array_elements(c) x where not (x->>'pass')::boolean),
    'mode', p_mode, 'run', p_run, 'period_start', r.period_start, 'approved_run', v_appr, 'fingerprint_id', v_fp, 'authorisation_id', v_auth,
    'counts', jsonb_build_object('total', v_total, 'ready', v_ready, 'review_required', v_review, 'blocked', v_blocked), 'checks', c);
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_costing_approve_run(p_refresh_run_id bigint, p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v_name text; v_chk jsonb; v_period date; v_des bigint; v_p costing.cost_periods; v_audit bigint;
begin
  v_name := costing.fn_w2_owner_name();
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  select period_start into v_period from costing.costing_refresh_run where id = p_refresh_run_id;
  if v_period is null then raise exception 'W2_RUN_NOT_FOUND: %', p_refresh_run_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:' || v_period::text, 0));
  v_chk := costing.fn_w2_run_checks(p_refresh_run_id, 'APPROVE');
  if not (v_chk->>'ok')::boolean then
    raise exception 'W2_APPROVAL_CHECKS_FAILED: run %: %', p_refresh_run_id,
      (select string_agg((x->>'code') || ' (' || (x->>'detail') || ')', '; ') from jsonb_array_elements(v_chk->'checks') x where not (x->>'pass')::boolean)
      using errcode = 'P0001';
  end if;
  v_des := costing.rpc_designate_costing_run(p_refresh_run_id, 'APPROVED', v_name, btrim(p_reason) || ' [' || btrim(p_approval_reference) || ']');
  select * into v_p from costing.cost_periods where period_start = v_period;
  v_audit := costing.fn_w2_audit(v_period, 'RUN_APPROVED', v_p, v_p, p_reason, p_approval_reference,
    jsonb_build_object('refresh_run_id', p_refresh_run_id, 'designation_id', v_des,
      'designation_fingerprint_id', (select fingerprint_id from costing.costing_run_designation where id = v_des),
      'counts', v_chk->'counts', 'checks', v_chk->'checks'));
  return jsonb_build_object('refresh_run_id', p_refresh_run_id, 'designation_id', v_des, 'audit_id', v_audit, 'counts', v_chk->'counts');
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_costing_supersede_approved_run(p_new_refresh_run_id bigint, p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v_name text; v_chk jsonb; v_period date; v_old bigint; v_rev bigint; v_des bigint; v_p costing.cost_periods; v_audit bigint;
begin
  v_name := costing.fn_w2_owner_name();
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  select period_start into v_period from costing.costing_refresh_run where id = p_new_refresh_run_id;
  if v_period is null then raise exception 'W2_RUN_NOT_FOUND: %', p_new_refresh_run_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:' || v_period::text, 0));
  v_chk := costing.fn_w2_run_checks(p_new_refresh_run_id, 'SUPERSEDE');
  if not (v_chk->>'ok')::boolean then
    raise exception 'W2_SUPERSEDE_CHECKS_FAILED: run %: %', p_new_refresh_run_id,
      (select string_agg((x->>'code') || ' (' || (x->>'detail') || ')', '; ') from jsonb_array_elements(v_chk->'checks') x where not (x->>'pass')::boolean)
      using errcode = 'P0001';
  end if;
  v_old := (v_chk->>'approved_run')::bigint;
  v_rev := costing.rpc_designate_costing_run(v_old, 'REVOKED', v_name,
             'Superseded by run ' || p_new_refresh_run_id || ': ' || btrim(p_reason) || ' [' || btrim(p_approval_reference) || ']');
  v_des := costing.rpc_designate_costing_run(p_new_refresh_run_id, 'APPROVED', v_name,
             'Supersedes run ' || v_old || ': ' || btrim(p_reason) || ' [' || btrim(p_approval_reference) || ']');
  select * into v_p from costing.cost_periods where period_start = v_period;
  v_audit := costing.fn_w2_audit(v_period, 'RUN_SUPERSEDED', v_p, v_p, p_reason, p_approval_reference,
    jsonb_build_object('old_run', v_old, 'new_run', p_new_refresh_run_id, 'revoke_designation_id', v_rev, 'approve_designation_id', v_des,
                       'authorisation_id', v_chk->'authorisation_id', 'counts', v_chk->'counts', 'checks', v_chk->'checks'));
  return jsonb_build_object('old_run', v_old, 'new_run', p_new_refresh_run_id, 'designation_id', v_des, 'audit_id', v_audit);
end $function$;


DROP FUNCTION public.rpc_costing_approve_run_with_preview(bigint,text,text,bigint,boolean);
DROP FUNCTION public.rpc_costing_preview_approval_impact(bigint);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM costing.cost_period_governance_audit WHERE evidence_json->>'ci' = 'CI-040' OR event_type = 'STALE_APPROVAL_ACKNOWLEDGED')
     OR EXISTS (SELECT 1 FROM costing.costing_approval_preview_ack) THEN
    RAISE NOTICE 'CI-040 rollback mode B (after use): constraint, acknowledgement table, settings table and internal functions kept';
  ELSE
    RAISE NOTICE 'CI-040 rollback mode A (immediate): full structural restore';
    DROP FUNCTION costing.fn_w2_approve_unified(bigint,text,text,bigint,boolean,text);
    DROP FUNCTION costing.fn_costing_run_profit_availability(bigint);
    DROP TABLE costing.costing_approval_preview_ack;
    DROP FUNCTION costing.fn_guard_preview_ack();
    DROP TABLE costing.costing_automation_setting;
    DROP FUNCTION costing.fn_costing_approval_preview_core(bigint);
    DROP FUNCTION costing.fn_costing_run_input_staleness(bigint);
    ALTER TABLE costing.cost_period_governance_audit DROP CONSTRAINT cost_period_governance_audit_event_type_chk;
    ALTER TABLE costing.cost_period_governance_audit ADD CONSTRAINT cost_period_governance_audit_event_type_chk
      CHECK (event_type = ANY (ARRAY['MIGRATION_BACKFILL'::text,'PERIOD_CREATED'::text,'VALUATION_DATE_CHANGED'::text,'PERIOD_LOCKED'::text,
        'PERIOD_REOPENED'::text,'PERIOD_CLOSED'::text,'RUN_APPROVED'::text,'SUPERSESSION_AUTHORISED'::text,'RUN_SUPERSEDED'::text]));
  END IF;
END $$;
-- v2.1: if CI-042 was rolled back in mode B (month-end finalise kept on the CI-040 route), return finalise to its
-- pre-CI-042 form now that the old approve route is back, and drop the preview-based finalise (its preview RPC is gone).
DO $do$ BEGIN
  IF to_regprocedure('public.rpc_costing_finalize_monthend_run_with_preview(bigint,text,text,bigint,boolean)') IS NOT NULL THEN
    DROP FUNCTION public.rpc_costing_finalize_monthend_run_with_preview(bigint,text,text,bigint,boolean);
    EXECUTE $pre$CREATE OR REPLACE FUNCTION public.rpc_costing_finalize_monthend_run(p_refresh_run_id bigint, p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v_run costing.costing_refresh_run%rowtype; v_period costing.cost_periods%rowtype; v_approved bigint; v_result jsonb; v_lock jsonb;
begin
 perform public.require_permission('module:costing-control-center',true);
 perform costing.fn_w2_owner_name();
 perform costing.fn_w2_require_text(p_reason,p_approval_reference);
 select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
 if not found then raise exception 'MONTHEND_RUN_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:'||v_run.period_start::text,0));
 select * into v_period from costing.cost_periods where period_start=v_run.period_start for update;
 if not found or v_period.status<>'OPEN' or v_period.valuation_date_status<>'DRAFT' then raise exception 'MONTHEND_PERIOD_NOT_OPEN'; end if;
 if costing.fn_india_business_date() <= v_period.period_end then raise exception 'MONTHEND_PERIOD_NOT_FINISHED'; end if;
 if v_run.valuation_date is distinct from v_period.period_end or v_period.valuation_date is distinct from v_period.period_end then raise exception 'MONTHEND_VALUATION_DATE_MISMATCH'; end if;
 select refresh_run_id into v_approved from costing.v_costing_run_effective_designation where period_start=v_run.period_start and designation='APPROVED' order by designated_at desc limit 1;
 if v_approved=p_refresh_run_id then
  v_result:=jsonb_build_object('already_approved',p_refresh_run_id);
 elsif v_approved is null then
  v_result:=public.rpc_costing_approve_run(p_refresh_run_id,p_reason,p_approval_reference);
 else
  v_result:=public.rpc_costing_supersede_approved_run(p_refresh_run_id,p_reason,p_approval_reference);
 end if;
 v_lock:=public.rpc_costing_lock_period(v_run.period_start,'Month-end approved closure: '||p_reason,p_approval_reference);
 return jsonb_build_object('approval',v_result,'lock',v_lock);
end $function$$pre$;
    RAISE NOTICE 'CI-040 v2.1 rollback: month-end finalise returned to its pre-CI-042 form (CI-042 had been rolled back in mode B)';
  END IF;
END $do$;
COMMIT;
