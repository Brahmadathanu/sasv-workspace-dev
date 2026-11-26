-- Live approval definition MD5 7706991cb85cf3b13932685b30ba87b9
CREATE OR REPLACE FUNCTION costing.fn_w2_run_checks(p_run bigint, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare r costing.costing_refresh_run%rowtype; p costing.cost_periods%rowtype; v_des text; v_appr bigint; v_appr_fin timestamptz; v_appr_vd date;
  v_active bigint; v_fp bigint; v_drift bigint; v_total bigint; v_blocked bigint; v_review bigint; v_ready bigint;
  c jsonb := '[]'::jsonb;
begin
  -- CI-040: APPROVE and SUPERSEDE both run the unified approval checks (old callers keep working).
  if p_mode not in ('APPROVE','SUPERSEDE') then raise exception 'W2_BAD_MODE: %', p_mode; end if;
  select * into r from costing.costing_refresh_run where id = p_run;
  if not found then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'run', p_run, 'checks', jsonb_build_array(jsonb_build_object('code','RUN_EXISTS','pass',false,'detail','Run not found')));
  end if;
  select * into p from costing.cost_periods where period_start = r.period_start;
  select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id = p_run;
  select e.refresh_run_id, rr.finished_at, rr.valuation_date into v_appr, v_appr_fin, v_appr_vd
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
         || jsonb_build_object('code','NO_ACTIVE_RUN','pass', v_active = 0, 'detail', v_active || ' queued/running')
         || jsonb_build_object('code','FINGERPRINT_CAPTURED','pass', v_fp is not null, 'detail', coalesce('capture ' || v_fp, 'none'))
         || jsonb_build_object('code','FINGERPRINT_CLEAN','pass', v_fp is not null and v_drift = 0, 'detail', coalesce(v_drift || ' drifted tables', 'not verifiable'))
         || jsonb_build_object('code','HAS_COST_SHEET','pass', v_total > 0, 'detail', v_total || ' SKUs')
         || jsonb_build_object('code','NO_BLOCKED_SKUS','pass', v_blocked = 0, 'detail', v_blocked || ' BLOCKED')
         || jsonb_build_object('code','NO_UNRESOLVED_REVIEWS','pass', v_review = 0, 'detail', v_review || ' unresolved REVIEW_REQUIRED; zero required before approval')
         || jsonb_build_object('code','RUN_DATE_NOT_BEFORE_APPROVED','pass', v_appr is null or r.valuation_date >= v_appr_vd,
                               'detail', case when v_appr is null then 'no approved run in month'
                                              else format('run date %s vs approved run %s date %s', r.valuation_date, v_appr, v_appr_vd) end)
         || jsonb_build_object('code','NEWER_THAN_APPROVED','pass', v_appr is null or r.finished_at > v_appr_fin,
                               'detail', case when v_appr is null then 'no approved run in month' else format('finished %s vs %s', r.finished_at, v_appr_fin) end);
  if p_mode = 'SUPERSEDE' then   -- old caller asked explicitly to supersede: there must be something to supersede
    c := c || jsonb_build_object('code','HAS_APPROVED_RUN_TO_SUPERSEDE','pass', v_appr is not null, 'detail', coalesce('run ' || v_appr, 'none'));
  end if;
  return jsonb_build_object('ok', not exists (select 1 from jsonb_array_elements(c) x where not (x->>'pass')::boolean),
    'mode', p_mode, 'run', p_run, 'period_start', r.period_start, 'run_valuation_date', r.valuation_date,
    'working_valuation_date', p.valuation_date, 'approved_run', v_appr, 'approved_run_valuation_date', v_appr_vd,
    'will_supersede', v_appr is not null, 'fingerprint_id', v_fp, 'authorisation_id', null,
    'counts', jsonb_build_object('total', v_total, 'ready', v_ready, 'review_required', v_review, 'blocked', v_blocked), 'checks', c);
end $function$
;
