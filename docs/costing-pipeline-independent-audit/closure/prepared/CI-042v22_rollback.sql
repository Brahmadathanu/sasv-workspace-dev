-- CI-042 v2.2 ROLLBACK. Self-contained SQL. Pre-images as live on 26 Oct 2026 (re-confirmed 27 Oct 2026 17:00 IST):
-- rpc_costing_lock_period 95612aa4..., rpc_costing_finalize_monthend_run 1b221c05..., views d38be6e4.../49034542...
-- (grants as live). Roll back CI-043 first (it is not live on production).
--
-- MODE SELECTION (v2.2, independent review correction 1):
--  * DEFAULT = MODE B whenever CI-040 is live (costing.fn_w2_approve_unified exists), i.e. the normal standalone
--    "roll back CI-042 while CI-040 stays" case, with or without prior CI-042 use. Nothing needs to be set.
--  * MODE A is reserved for the full reverse-order chain 043 -> 042 -> 041 -> 040 and is selectable ONLY with the
--    explicit flag   SET costing.ci042_rollback_mode = 'A_FULL_CHAIN';   run in the same session immediately before
--    this file, AND only when no CI-042 audit row exists (never used). Any other value (including the old 'A') is
--    refused (CI042_ROLLBACK_MODE_INVALID); 'A_FULL_CHAIN' after CI-042 use is refused (CI042_ROLLBACK_MODE_A_AFTER_USE).
--    If CI-040 is already gone (not a supported order), mode A is used.
--  MODE B end state (a supported operating mode while CI-040 stays):
--      * approval: only CI-040's preview route (rpc_costing_approve_run_with_preview); untouched;
--      * month-end finalise: rpc_costing_finalize_monthend_run_with_preview is KEPT and keeps working (approves through
--        CI-040's fn_w2_approve_unified with a preview acknowledgement); the old 3-argument rpc_costing_finalize_monthend_run
--        is KEPT in its CI-042 strict refusing form (W2_USE_NEW_APPROVAL_ROUTE), never restored to the pre-image;
--      * lock: the pre-CI-042 rpc_costing_lock_period is restored (stored month date must equal the approved run's date);
--        where they differ the owner aligns with the governed, audited rpc_set_cost_period_valuation_date, then locks.
--        Months already locked stay LOCKED;
--      * removed: the batch lock RPC, the per-run display views, the extra view columns (views back to pre-image).
--    Nothing is deleted. A later CI-040 rollback returns finalise to its pre-CI-042 body and drops the preview finalise.
--  MODE A (full chain only): every CI-042 object exactly as before CI-042; the restored old finalise fails closed
--    (W2_USE_NEW_APPROVAL_ROUTE) until CI-040 is rolled back next in the same chain.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('costing.fn_costing_health_check(date)') IS NOT NULL THEN
    RAISE EXCEPTION 'CI042_ROLLBACK_ORDER: roll back CI-043 first'; END IF;
  DECLARE v_req text := coalesce(current_setting('costing.ci042_rollback_mode', true), '');
          v_ci040 boolean := to_regprocedure('costing.fn_w2_approve_unified(bigint,text,text,bigint,boolean,text)') IS NOT NULL;
          v_used boolean := EXISTS (SELECT 1 FROM costing.cost_period_governance_audit WHERE evidence_json->>'ci' = 'CI-042');
          v_mode text;
  BEGIN
    IF v_req NOT IN ('', 'B', 'A_FULL_CHAIN') THEN
      RAISE EXCEPTION 'CI042_ROLLBACK_MODE_INVALID: costing.ci042_rollback_mode=% is not allowed; leave it unset (default mode B) or use A_FULL_CHAIN only inside the full 043->042->041->040 rollback', v_req; END IF;
    IF v_req = 'A_FULL_CHAIN' AND v_used THEN
      RAISE EXCEPTION 'CI042_ROLLBACK_MODE_A_AFTER_USE: CI-042 has been used (audit rows exist); only mode B is allowed'; END IF;
    v_mode := CASE WHEN v_req = 'A_FULL_CHAIN' OR NOT v_ci040 THEN 'A' ELSE 'B' END;
    PERFORM set_config('costing.ci042_rollback_mode_effective', v_mode, true);
  END;
  RAISE NOTICE 'CI-042 v2.2 rollback mode %', current_setting('costing.ci042_rollback_mode_effective');
END $$;
DROP VIEW public.v_costing_pricing_run_display_status;
DROP VIEW costing.v_costing_run_display_status;
DROP FUNCTION public.rpc_costing_lock_periods_for_close(date[],text,text);
DO $$ BEGIN
  IF current_setting('costing.ci042_rollback_mode_effective') = 'A' THEN
    DROP FUNCTION public.rpc_costing_finalize_monthend_run_with_preview(bigint,text,text,bigint,boolean);
  END IF;
END $$;
DROP VIEW public.v_costing_pricing_period_run_status;
DROP VIEW costing.v_costing_period_run_status;
CREATE OR REPLACE FUNCTION public.rpc_costing_lock_period(p_period_start date, p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v_old costing.cost_periods; v_new costing.cost_periods; v_run bigint; v_rvd date; v_drift bigint; v_audit bigint;
begin
  perform public.require_permission('module:costing-control-center', true);
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:' || p_period_start::text, 0));
  select * into v_old from costing.cost_periods where period_start = p_period_start for update;
  if not found then raise exception 'W2_PERIOD_NOT_FOUND: %', p_period_start; end if;
  if v_old.status <> 'OPEN' then raise exception 'W2_LOCK_REQUIRES_OPEN: period % is %', p_period_start, v_old.status using errcode = 'P0001'; end if;
  select refresh_run_id, valuation_date into v_run, v_rvd from costing.v_current_successful_costing_refresh_run
   where period_start = p_period_start and selection_basis = 'APPROVED';
  if v_run is null then raise exception 'W2_LOCK_REQUIRES_APPROVED_RUN: period % has no APPROVED run', p_period_start using errcode = 'P0001'; end if;
  if v_rvd is distinct from v_old.valuation_date then
    raise exception 'W2_LOCK_VALUATION_DATE_MISMATCH: approved run % uses %, period uses %; supersede first', v_run, v_rvd, v_old.valuation_date using errcode = 'P0001';
  end if;
  if exists (select 1 from costing.costing_refresh_run where period_start = p_period_start and overall_status in ('QUEUED','RUNNING')) then
    raise exception 'W2_ACTIVE_RUN: period % has a queued/running run', p_period_start using errcode = 'P0001';
  end if;
  select count(*) into v_drift from costing.fn_verify_run_fingerprint(v_run) where not matches;
  if v_drift > 0 then raise exception 'W2_FINGERPRINT_DRIFT: run % has % drifted tables', v_run, v_drift using errcode = 'P0001'; end if;
  update costing.cost_periods set status = 'LOCKED', valuation_date_status = 'LOCKED', locked_at = statement_timestamp(), locked_by = auth.uid(),
         lock_reason = btrim(p_reason), lock_approval_reference = btrim(p_approval_reference), updated_at = statement_timestamp()
   where period_start = p_period_start returning * into v_new;
  v_audit := costing.fn_w2_audit(p_period_start, 'PERIOD_LOCKED', v_old, v_new, p_reason, p_approval_reference,
    jsonb_build_object('action','LOCK','approved_run', v_run));
  return jsonb_build_object('period_start', p_period_start, 'status', 'LOCKED', 'approved_run', v_run, 'audit_id', v_audit);
end $function$;

-- old 3-argument finalise: pre-image only in mode A (mode B keeps the CI-042 form, which refuses with W2_USE_NEW_APPROVAL_ROUTE)
DO $do$ BEGIN
  IF current_setting('costing.ci042_rollback_mode_effective') = 'A' THEN
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
  END IF;
END $do$;

CREATE VIEW costing.v_costing_period_run_status AS
WITH periods AS (
         SELECT cost_periods.period_start
           FROM costing.cost_periods
        UNION
         SELECT costing_refresh_run.period_start
           FROM costing.costing_refresh_run
        ), ptr AS (
         SELECT v_current_successful_costing_refresh_run.refresh_run_id,
            v_current_successful_costing_refresh_run.period_start,
            v_current_successful_costing_refresh_run.valuation_date,
            v_current_successful_costing_refresh_run.overall_status,
            v_current_successful_costing_refresh_run.valuation_context_source,
            v_current_successful_costing_refresh_run.source_trigger,
            v_current_successful_costing_refresh_run.requested_scope,
            v_current_successful_costing_refresh_run.requested_at,
            v_current_successful_costing_refresh_run.started_at,
            v_current_successful_costing_refresh_run.finished_at,
            v_current_successful_costing_refresh_run.selection_basis
           FROM costing.v_current_successful_costing_refresh_run
        ), latest_success AS (
         SELECT DISTINCT ON (r.period_start) r.period_start,
            r.id,
            r.finished_at,
            e.designation
           FROM (costing.costing_refresh_run r
             LEFT JOIN costing.v_costing_run_effective_designation e ON ((e.refresh_run_id = r.id)))
          WHERE ((r.overall_status = 'SUCCESS'::text) AND (r.valuation_context_source = 'CAPTURED_AT_REQUEST'::text))
          ORDER BY r.period_start, r.finished_at DESC NULLS LAST, r.id DESC
        ), active AS (
         SELECT DISTINCT ON (r.period_start) r.period_start,
            r.id,
            r.overall_status,
            r.current_stage_code
           FROM costing.costing_refresh_run r
          WHERE (r.overall_status = ANY (ARRAY['QUEUED'::text, 'RUNNING'::text]))
          ORDER BY r.period_start, r.requested_at DESC, r.id DESC
        ), base AS (
         SELECT p.period_start,
            cp.status AS period_status,
            cp.valuation_date,
            cp.valuation_date_status,
            ptr.refresh_run_id AS displayed_run_id,
            ptr.selection_basis AS displayed_run_basis,
                CASE
                    WHEN (ptr.selection_basis = 'APPROVED'::text) THEN ptr.refresh_run_id
                    ELSE NULL::bigint
                END AS approved_run_id,
            e.designated_at AS approved_at,
            e.designated_by AS approved_by,
            ls.id AS latest_success_run_id,
            ls.finished_at AS latest_success_finished_at,
                CASE
                    WHEN ((ptr.selection_basis = 'APPROVED'::text) AND (ls.id IS DISTINCT FROM ptr.refresh_run_id) AND (COALESCE(ls.designation, ''::text) <> ALL (ARRAY['APPROVED'::text, 'REFERENCE'::text]))) THEN ls.id
                    ELSE NULL::bigint
                END AS newer_draft_run_id,
            a.id AS active_run_id,
            a.overall_status AS active_run_status,
            a.current_stage_code AS active_run_stage
           FROM (((((periods p
             LEFT JOIN costing.cost_periods cp ON ((cp.period_start = p.period_start)))
             LEFT JOIN ptr ON ((ptr.period_start = p.period_start)))
             LEFT JOIN costing.v_costing_run_effective_designation e ON (((e.refresh_run_id = ptr.refresh_run_id) AND (ptr.selection_basis = 'APPROVED'::text))))
             LEFT JOIN latest_success ls ON ((ls.period_start = p.period_start)))
             LEFT JOIN active a ON ((a.period_start = p.period_start)))
        )
 SELECT period_start,
    period_status,
    valuation_date,
    valuation_date_status,
    displayed_run_id,
    displayed_run_basis,
    approved_run_id,
    approved_at,
    approved_by,
    latest_success_run_id,
    latest_success_finished_at,
    newer_draft_run_id,
    active_run_id,
    active_run_status,
    active_run_stage,
        CASE
            WHEN (displayed_run_id IS NULL) THEN 'NO_SUCCESSFUL_RUN'::text
            WHEN ((displayed_run_basis = 'APPROVED'::text) AND (newer_draft_run_id IS NOT NULL)) THEN 'APPROVED_NEWER_DRAFT'::text
            WHEN (displayed_run_basis = 'APPROVED'::text) THEN 'APPROVED'::text
            WHEN (displayed_run_basis = 'REFERENCE_FALLBACK'::text) THEN 'REFERENCE_NOT_APPROVED'::text
            ELSE 'DRAFT'::text
        END AS display_state,
        CASE
            WHEN (displayed_run_id IS NULL) THEN 'No successful run'::text
            WHEN ((displayed_run_basis = 'APPROVED'::text) AND (newer_draft_run_id IS NOT NULL)) THEN (((('Approved run '::text || displayed_run_id) || ' (newer DRAFT run '::text) || newer_draft_run_id) || ' - not approved)'::text)
            WHEN (displayed_run_basis = 'APPROVED'::text) THEN ('Approved run '::text || displayed_run_id)
            WHEN (displayed_run_basis = 'REFERENCE_FALLBACK'::text) THEN (('Reference run '::text || displayed_run_id) || ' - not approved'::text)
            ELSE (('DRAFT run '::text || displayed_run_id) || ' - not approved'::text)
        END AS display_label,
    ((approved_run_id IS NOT NULL) AND (period_start = max(period_start) FILTER (WHERE (approved_run_id IS NOT NULL)) OVER ())) AS is_latest_approved_period
   FROM base b;; 

CREATE VIEW public.v_costing_pricing_period_run_status AS
SELECT period_start,
    period_status,
    valuation_date,
    valuation_date_status,
    displayed_run_id,
    displayed_run_basis,
    approved_run_id,
    approved_at,
    approved_by,
    latest_success_run_id,
    latest_success_finished_at,
    newer_draft_run_id,
    active_run_id,
    active_run_status,
    active_run_stage,
    display_state,
    display_label,
    is_latest_approved_period
   FROM costing.v_costing_period_run_status
  WHERE ((CURRENT_USER = ANY (ARRAY['service_role'::name, 'postgres'::name])) OR app_has_permission('module:costing-control-center'::text, 'view'::text));

ALTER VIEW costing.v_costing_period_run_status OWNER TO postgres;
ALTER VIEW public.v_costing_pricing_period_run_status OWNER TO postgres;
REVOKE ALL ON costing.v_costing_period_run_status FROM PUBLIC;
REVOKE ALL ON public.v_costing_pricing_period_run_status FROM PUBLIC;
-- v2.2: the view is re-created, so Supabase default privileges would give anon/authenticated ALL; reset to the exact live ACL
REVOKE ALL ON public.v_costing_pricing_period_run_status FROM anon, authenticated, service_role;
REVOKE ALL ON costing.v_costing_period_run_status FROM anon, authenticated, service_role;
GRANT SELECT ON costing.v_costing_period_run_status TO service_role;
GRANT SELECT ON public.v_costing_pricing_period_run_status TO authenticated;
GRANT ALL ON public.v_costing_pricing_period_run_status TO service_role;
COMMIT;
