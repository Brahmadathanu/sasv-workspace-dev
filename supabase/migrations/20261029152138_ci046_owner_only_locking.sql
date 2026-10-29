-- CI-046 owner-only locking (prepared 29 Oct 2026, NOT APPLIED). Production project qhmoqtxpeasamtlxaoak.
-- Change: both lock routes now call costing.fn_w2_owner_name() right after the edit-permission check, exactly as
-- public.rpc_costing_finalize_monthend_run_with_preview does (refusal: 'W2_OWNER_ONLY: this action is reserved for the costing owner').
-- Nothing else changes: bodies are otherwise verbatim from live; state-only lock, all-or-nothing batch, validation, return shape,
-- SECURITY DEFINER, search_path, owner, function comments (incl. COSTING-LOCK-BEFORE-CLOSE-POLICY-2026-10-26) and ACLs are kept.
-- System callers: none exist (no cron/function calls the lock routes except the batch -> single call); require_permission already
-- refuses a NULL auth.uid() ('Not authenticated'), so service_role/postgres without a user JWT were already refused before CI-046.
-- Guard: aborts (changes nothing) unless each live definition is the captured pre-image or already the CI-046 version (re-apply is a no-op).
BEGIN;
DO $g$
DECLARE a text := md5(pg_get_functiondef('public.rpc_costing_lock_period(date,text,text)'::regprocedure)); b text := md5(pg_get_functiondef('public.rpc_costing_lock_periods_for_close(date[],text,text)'::regprocedure));
BEGIN
  IF to_regprocedure('costing.fn_w2_owner_name()') IS NULL THEN RAISE EXCEPTION 'CI046_PREREQ: costing.fn_w2_owner_name() missing'; END IF;
  IF a NOT IN ('327fd575c8251c2b876bab8f18878911','f96ef786e1a89e005e040a5bd5971b1c') OR b NOT IN ('81b841e8c4a5abf3fa3c48884898bdab','cd18ca28a62772792be0806ec030c062') THEN
    RAISE EXCEPTION 'CI046_DEFINITION_CHANGED: lock functions differ from the captured definitions (got %, %); nothing changed - investigate', a, b;
  END IF;
END $g$;

CREATE OR REPLACE FUNCTION public.rpc_costing_lock_period(p_period_start date, p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v_old costing.cost_periods; v_new costing.cost_periods; v_run bigint; v_rvd date; v_drift bigint; v_audit bigint;
begin
  perform public.require_permission('module:costing-control-center', true);
  perform costing.fn_w2_owner_name();  -- CI-046: owner-only, same check and message as approve/finalise (W2_OWNER_ONLY)
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
end $function$
;

CREATE OR REPLACE FUNCTION public.rpc_costing_lock_periods_for_close(p_period_starts date[], p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v_p date; v_out jsonb := '[]'::jsonb; v_n int; v_bad text;
begin
  perform public.require_permission('module:costing-control-center', true);
  perform costing.fn_w2_owner_name();  -- CI-046: owner-only, same check and message as approve/finalise (W2_OWNER_ONLY)
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
end $function$
;

-- explicit grants = the live ACL {postgres=X,authenticated=X,service_role=X}, no PUBLIC, no anon
REVOKE ALL ON FUNCTION public.rpc_costing_lock_period(date,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_costing_lock_period(date,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_costing_lock_period(date,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_costing_lock_periods_for_close(date[],text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_costing_lock_periods_for_close(date[],text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_costing_lock_periods_for_close(date[],text,text) TO authenticated, service_role;
COMMIT;
