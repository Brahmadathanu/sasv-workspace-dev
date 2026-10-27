-- =====================================================================================================
-- CI-042 v2.2  Lock = state change only (official date derived), quarterly batch lock, month-end finalise without
--            lock, status views with approved/official date and per-run labels
-- PREPARED 26 Oct 2026 (IST). NOT APPLIED. v2.2 (27 Oct 2026, independent review): batch-lock input validation added (W2_BATCH_* codes); rest of the body unchanged from v2.1. Owner decisions 26 Oct 2026: D1 YES (no align-at-lock), D7 (lock only
-- before formal Close, quarterly batches), additional req 4. Requires CI-040 v2.
--
-- POLICY RECORD (named, wording changed from v1): COSTING-LOCK-BEFORE-CLOSE-POLICY-2026-10-26
--   Held as the COMMENT on public.rpc_costing_lock_periods_for_close (no table row).
--   Text: approval alone freezes the numbers; months are locked only to prepare a formal Close, normally in
--   quarterly batches (all-or-nothing); lock changes only the month state; the official date of a month is its
--   APPROVED run's own valuation date (derived); month-end finalise approves (with preview acknowledgement) but
--   does not lock.
--
-- OBJECTS TOUCHED
--   REPLACE public.rpc_costing_lock_period(date,text,text)  same signature/ACL; W2_LOCK_VALUATION_DATE_MISMATCH removed;
--           NO date alignment (v1 ALIGN_AT_LOCK dropped); active-run and fingerprint checks kept.
--   NEW     public.rpc_costing_lock_periods_for_close(date[],text,text)  all-or-nothing batch lock (authenticated); v2.2 refuses
--           NULL/empty array, NULL element, duplicate, not-first-of-month, mixed-quarter and unknown months before locking
--   REPLACE public.rpc_costing_finalize_monthend_run(bigint,text,text)  -> W2_USE_NEW_APPROVAL_ROUTE (writes nothing)
--   NEW     public.rpc_costing_finalize_monthend_run_with_preview(bigint,text,text,bigint,boolean)  run date = month end,
--           month finished; approves via CI-040 v2 core with the preview acknowledgement; no lock
--   REPLACE VIEW costing.v_costing_period_run_status  existing 18 columns unchanged; APPENDED (9):
--           approved_run_valuation_date, official_valuation_date, latest_draft_run_id, latest_draft_valuation_date,
--           newer_draft_count, superseded_run_ids, superseded_run_count, pricing_use_label, display_label_v2
--           (v1's two extra month-date columns are dropped: redundant date, D1)
--   REPLACE VIEW public.v_costing_pricing_period_run_status  same 18 columns + the 9 appended, same filter
--   NEW VIEW costing.v_costing_run_display_status, public.v_costing_pricing_run_display_status (as v1)
-- NOT TOUCHED: close/reopen, open-next, cost_periods constraints and data, triggers, fingerprints, price feed,
--   runs 119/122/143, September (already LOCKED), cron. No row inserted/updated.
-- =====================================================================================================
BEGIN;

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
  if exists (select 1 from costing.costing_refresh_run where period_start = p_period_start and overall_status in ('QUEUED','RUNNING')) then
    raise exception 'W2_ACTIVE_RUN: period % has a queued/running run', p_period_start using errcode = 'P0001';
  end if;
  select count(*) into v_drift from costing.fn_verify_run_fingerprint(v_run) where not matches;
  if v_drift > 0 then raise exception 'W2_FINGERPRINT_DRIFT: run % has % drifted tables', v_run, v_drift using errcode = 'P0001'; end if;
  -- CI-042 v2 (D1): lock only changes the state. The official date is the approved run's own date (derived, not stored);
  -- the stored month date (compatibility field) is left as it is.
  update costing.cost_periods set status = 'LOCKED', valuation_date_status = 'LOCKED', locked_at = statement_timestamp(), locked_by = auth.uid(),
         lock_reason = btrim(p_reason), lock_approval_reference = btrim(p_approval_reference), updated_at = statement_timestamp()
   where period_start = p_period_start returning * into v_new;
  v_audit := costing.fn_w2_audit(p_period_start, 'PERIOD_LOCKED', v_old, v_new, p_reason, p_approval_reference,
    jsonb_build_object('action','LOCK','ci','CI-042','approved_run', v_run, 'official_valuation_date', v_rvd, 'stored_month_date', v_old.valuation_date));
  return jsonb_build_object('period_start', p_period_start, 'status', 'LOCKED', 'approved_run', v_run, 'official_valuation_date', v_rvd, 'audit_id', v_audit);
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_costing_lock_periods_for_close(p_period_starts date[], p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v_p date; v_out jsonb := '[]'::jsonb; v_n int; v_bad text;
begin
  perform public.require_permission('module:costing-control-center', true);
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  -- CI-042 v2.2 input validation (before any lock; any failure locks nothing)
  if p_period_starts is null then raise exception 'W2_BATCH_NULL_ARRAY: a list of months is required' using errcode = 'P0001'; end if;
  v_n := coalesce(cardinality(p_period_starts), 0);
  if v_n = 0 then raise exception 'W2_BATCH_EMPTY: the list of months is empty' using errcode = 'P0001'; end if;
  if array_position(p_period_starts, null) is not null then raise exception 'W2_BATCH_NULL_ELEMENT: the list contains an empty (NULL) month' using errcode = 'P0001'; end if;
  select string_agg(x::text, ', ' order by x) into v_bad from (select x from unnest(p_period_starts) x group by x having count(*) > 1) d;
  if v_bad is not null then raise exception 'W2_BATCH_DUPLICATE_MONTH: % listed more than once', v_bad using errcode = 'P0001'; end if;
  select string_agg(x::text, ', ' order by x) into v_bad from unnest(p_period_starts) x where x <> date_trunc('month', x)::date;
  if v_bad is not null then raise exception 'W2_BATCH_NOT_FIRST_OF_MONTH: % (use the first day of each month)', v_bad using errcode = 'P0001'; end if;
  if (select count(distinct date_trunc('quarter', x)) from unnest(p_period_starts) x) > 1 then
    select string_agg(x::text, ', ' order by x) into v_bad from unnest(p_period_starts) x;
    raise exception 'W2_BATCH_MIXED_QUARTER: % span more than one calendar quarter; lock one quarter per batch (use rpc_costing_lock_period for an authorised single-month exception)', v_bad using errcode = 'P0001'; end if;
  select string_agg(x::text, ', ' order by x) into v_bad from unnest(p_period_starts) x where not exists (select 1 from costing.cost_periods c where c.period_start = x);
  if v_bad is not null then raise exception 'W2_BATCH_UNKNOWN_MONTH: % not found in costing.cost_periods', v_bad using errcode = 'P0001'; end if;
  -- all-or-nothing: any per-month lock failure (active run, drift, no approved run, not OPEN) rolls back every lock in the batch
  for v_p in select x from unnest(p_period_starts) x order by 1 loop
    v_out := v_out || public.rpc_costing_lock_period(v_p, 'Pre-close batch lock: ' || btrim(p_reason), p_approval_reference);
  end loop;
  return jsonb_build_object('locked', v_out, 'count', jsonb_array_length(v_out));
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_costing_finalize_monthend_run_with_preview(p_refresh_run_id bigint, p_reason text, p_approval_reference text,
   p_preview_ack_id bigint, p_acknowledge_stale boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v_run costing.costing_refresh_run%rowtype; v_period costing.cost_periods%rowtype; v_approved bigint; v_result jsonb;
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
  -- CI-042: only the run's own date must be the month end (the month's stored date no longer matters, D1)
  if v_run.valuation_date is distinct from v_period.period_end then raise exception 'MONTHEND_VALUATION_DATE_MISMATCH: run % is dated %, month end is %', v_run.id, v_run.valuation_date, v_period.period_end; end if;
  select refresh_run_id into v_approved from costing.v_costing_run_effective_designation where period_start=v_run.period_start and designation='APPROVED' order by designated_at desc limit 1;
  if v_approved=p_refresh_run_id then
    v_result:=jsonb_build_object('already_approved',p_refresh_run_id);
  else
    v_result:=costing.fn_w2_approve_unified(p_refresh_run_id,p_reason,p_approval_reference,p_preview_ack_id,p_acknowledge_stale,'FINALIZE_MONTHEND');
  end if;
  -- D7: no automatic lock; lock only before formal Close (rpc_costing_lock_periods_for_close)
  return jsonb_build_object('approval',v_result,'lock',null,'lock_note','Not locked: lock only before formal Close (D7).');
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_costing_finalize_monthend_run(p_refresh_run_id bigint, p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
begin
  raise exception 'W2_USE_NEW_APPROVAL_ROUTE: rpc_costing_finalize_monthend_run is retired (CI-042). Open rpc_costing_preview_approval_impact(%) and use rpc_costing_finalize_monthend_run_with_preview(run, reason, reference, preview_ack_id[, acknowledge_stale]). Month-end finalise no longer locks; lock separately before formal Close (rpc_costing_lock_periods_for_close or rpc_costing_lock_period).', p_refresh_run_id
    using errcode = 'P0001';
end $function$;

CREATE OR REPLACE VIEW costing.v_costing_period_run_status AS
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
    ((approved_run_id IS NOT NULL) AND (period_start = max(period_start) FILTER (WHERE (approved_run_id IS NOT NULL)) OVER ())) AS is_latest_approved_period,
    x.approved_run_valuation_date,
    x.approved_run_valuation_date AS official_valuation_date,
    x.latest_draft_run_id,
    x.latest_draft_valuation_date,
    x.newer_draft_count,
    x.superseded_run_ids,
    COALESCE(cardinality(x.superseded_run_ids), 0) AS superseded_run_count,
        CASE
            WHEN ((approved_run_id IS NOT NULL) AND (period_start = max(period_start) FILTER (WHERE (approved_run_id IS NOT NULL)) OVER ())) THEN concat('In use for pricing: approved run ', approved_run_id, ' (', to_char(x.approved_run_valuation_date, 'DD Mon YYYY'), ')')
            WHEN (approved_run_id IS NOT NULL) THEN concat('Approved run ', approved_run_id, ' (', to_char(x.approved_run_valuation_date, 'DD Mon YYYY'), '); a later month is in use for pricing')
            ELSE 'Not for pricing: no approved run'::text
        END AS pricing_use_label,
        CASE
            WHEN (displayed_run_id IS NULL) THEN 'No successful run'::text
            WHEN (approved_run_id IS NOT NULL AND x.newer_draft_count > 0) THEN concat('Approved run ', approved_run_id, ' (', to_char(x.approved_run_valuation_date, 'DD Mon'), ') in use; newer draft ', x.latest_draft_run_id, ' (', to_char(x.latest_draft_valuation_date, 'DD Mon'), ') for review - not for pricing')
            WHEN (approved_run_id IS NOT NULL) THEN concat('Approved run ', approved_run_id, ' (', to_char(x.approved_run_valuation_date, 'DD Mon'), ')')
            WHEN (displayed_run_basis = 'REFERENCE_FALLBACK'::text) THEN (('Reference run '::text || displayed_run_id) || ' - not for pricing'::text)
            ELSE (('Draft run '::text || displayed_run_id) || ' - not for pricing'::text)
        END AS display_label_v2
   FROM (base b
     LEFT JOIN LATERAL ( SELECT ( SELECT rr.valuation_date FROM costing.costing_refresh_run rr WHERE (rr.id = b.approved_run_id)) AS approved_run_valuation_date,
            ld.id AS latest_draft_run_id,
            ld.valuation_date AS latest_draft_valuation_date,
            ( SELECT count(*) AS count
                   FROM (costing.costing_refresh_run d
                     LEFT JOIN costing.v_costing_run_effective_designation de ON ((de.refresh_run_id = d.id)))
                  WHERE ((d.period_start = b.period_start) AND (d.overall_status = 'SUCCESS'::text) AND (d.valuation_context_source = 'CAPTURED_AT_REQUEST'::text) AND (de.designation IS NULL)
                    AND ((b.approved_run_id IS NULL) OR (d.finished_at > ( SELECT ar.finished_at FROM costing.costing_refresh_run ar WHERE (ar.id = b.approved_run_id)))))) AS newer_draft_count,
            ( SELECT array_agg(s.refresh_run_id ORDER BY s.refresh_run_id) AS array_agg
                   FROM costing.v_costing_run_effective_designation s
                  WHERE ((s.period_start = b.period_start) AND (s.designation = 'REVOKED'::text))) AS superseded_run_ids
           FROM ( SELECT NULL::integer AS dummy) one
             LEFT JOIN LATERAL ( SELECT d.id, d.valuation_date
                   FROM (costing.costing_refresh_run d
                     LEFT JOIN costing.v_costing_run_effective_designation de ON ((de.refresh_run_id = d.id)))
                  WHERE ((d.period_start = b.period_start) AND (d.overall_status = 'SUCCESS'::text) AND (d.valuation_context_source = 'CAPTURED_AT_REQUEST'::text) AND (de.designation IS NULL))
                  ORDER BY d.finished_at DESC NULLS LAST, d.id DESC
                 LIMIT 1) ld ON (true)) x ON (true));

CREATE OR REPLACE VIEW public.v_costing_pricing_period_run_status AS
 SELECT period_start, period_status, valuation_date, valuation_date_status, displayed_run_id, displayed_run_basis, approved_run_id,
    approved_at, approved_by, latest_success_run_id, latest_success_finished_at, newer_draft_run_id, active_run_id, active_run_status,
    active_run_stage, display_state, display_label, is_latest_approved_period,
    approved_run_valuation_date, official_valuation_date, latest_draft_run_id, latest_draft_valuation_date,
    newer_draft_count, superseded_run_ids, superseded_run_count, pricing_use_label, display_label_v2
   FROM costing.v_costing_period_run_status
  WHERE ((CURRENT_USER = ANY (ARRAY['service_role'::name, 'postgres'::name])) OR app_has_permission('module:costing-control-center'::text, 'view'::text));

CREATE VIEW costing.v_costing_run_display_status AS
 WITH latest_appr AS (
   SELECT max(e.period_start) AS period_start FROM costing.v_costing_run_effective_designation e WHERE e.designation = 'APPROVED')
 SELECT r.id AS refresh_run_id, r.period_start, r.valuation_date, r.overall_status, r.source_trigger, r.requested_at, r.finished_at,
    e.designation AS stored_designation,
    CASE
      WHEN e.designation = 'APPROVED' THEN 'Approved'
      WHEN e.designation = 'REVOKED' THEN 'Superseded'
      WHEN e.designation = 'REFERENCE' THEN 'Reference'
      WHEN r.overall_status = 'SUCCESS' THEN 'Draft'
      WHEN r.overall_status = 'QUEUED' THEN 'Queued'
      WHEN r.overall_status = 'RUNNING' THEN 'Running'
      WHEN r.overall_status = 'FAILED' THEN 'Failed'
      WHEN r.overall_status = 'CANCELLED' THEN 'Cancelled'
      ELSE initcap(replace(r.overall_status, '_', ' '))
    END AS display_status,
    (e.designation = 'APPROVED' AND r.period_start = (SELECT period_start FROM latest_appr)) AS in_use_for_pricing,
    CASE WHEN e.designation = 'APPROVED' AND r.period_start = (SELECT period_start FROM latest_appr) THEN 'In use for pricing'
         WHEN e.designation = 'APPROVED' THEN 'Approved (a later month is in use for pricing)'
         ELSE 'Not for pricing' END AS pricing_use_label,
    CASE WHEN e.designation = 'REVOKED' THEN (substring(e.reason FROM 'Superseded by[^:;.]*run ?([0-9]+)'))::bigint END AS superseded_by_run_id,
    e.designated_at, e.designated_by, e.reason AS designation_reason,
    CASE
      WHEN e.designation = 'APPROVED' THEN 'Approved run ' || r.id || ' (' || to_char(r.valuation_date, 'DD Mon YYYY') || ')'
      WHEN e.designation = 'REVOKED' THEN 'Superseded' || coalesce(' by run ' || substring(e.reason FROM 'Superseded by[^:;.]*run ?([0-9]+)'), '') || ' (dated ' || to_char(r.valuation_date, 'DD Mon YYYY') || ')'
      WHEN e.designation = 'REFERENCE' THEN 'Reference run - not for pricing'
      WHEN r.overall_status = 'SUCCESS' THEN 'Draft (' || to_char(r.valuation_date, 'DD Mon YYYY') || ') - not for pricing'
      ELSE initcap(replace(r.overall_status, '_', ' ')) || ' - not for pricing'
    END AS display_label
   FROM costing.costing_refresh_run r
   LEFT JOIN costing.v_costing_run_effective_designation e ON e.refresh_run_id = r.id;

CREATE VIEW public.v_costing_pricing_run_display_status AS
 SELECT * FROM costing.v_costing_run_display_status
  WHERE ((CURRENT_USER = ANY (ARRAY['service_role'::name, 'postgres'::name])) OR app_has_permission('module:costing-control-center'::text, 'view'::text));

ALTER VIEW costing.v_costing_run_display_status OWNER TO postgres;
ALTER VIEW public.v_costing_pricing_run_display_status OWNER TO postgres;
REVOKE ALL ON costing.v_costing_run_display_status FROM PUBLIC;
REVOKE ALL ON public.v_costing_pricing_run_display_status FROM PUBLIC;
ALTER FUNCTION public.rpc_costing_lock_periods_for_close(date[],text,text) OWNER TO postgres;
ALTER FUNCTION public.rpc_costing_finalize_monthend_run_with_preview(bigint,text,text,bigint,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_costing_lock_periods_for_close(date[],text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_costing_finalize_monthend_run_with_preview(bigint,text,text,bigint,boolean) FROM PUBLIC;
DO $$ BEGIN
  EXECUTE 'REVOKE ALL ON costing.v_costing_run_display_status FROM anon, authenticated, service_role';
  EXECUTE 'GRANT SELECT ON costing.v_costing_run_display_status TO service_role';
  -- v2.2: Supabase default privileges give anon/authenticated/service_role ALL on new public views; reset to SELECT only, no anon
  EXECUTE 'REVOKE ALL ON public.v_costing_pricing_run_display_status FROM anon, authenticated, service_role';
  EXECUTE 'GRANT SELECT ON public.v_costing_pricing_run_display_status TO authenticated, service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_costing_lock_periods_for_close(date[],text,text) FROM anon';
  EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_costing_finalize_monthend_run_with_preview(bigint,text,text,bigint,boolean) FROM anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_costing_lock_periods_for_close(date[],text,text) TO authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_costing_finalize_monthend_run_with_preview(bigint,text,text,bigint,boolean) TO authenticated, service_role';
END $$;

COMMENT ON FUNCTION public.rpc_costing_lock_periods_for_close(date[],text,text) IS
 'COSTING-LOCK-BEFORE-CLOSE-POLICY-2026-10-26 (CI-042 v2; D1, D7): approval alone freezes the numbers; lock months only to prepare a formal Close, normally in quarterly batches (all-or-nothing). Lock changes only the month state; the official date is the approved run''s own date (derived, never moved). Month-end finalise approves with a preview acknowledgement and does not lock.';
COMMENT ON VIEW costing.v_costing_run_display_status IS 'CI-042: per-run display labels. Stored REVOKED is shown as Superseded (D4); drafts are not for pricing.';
COMMIT;
