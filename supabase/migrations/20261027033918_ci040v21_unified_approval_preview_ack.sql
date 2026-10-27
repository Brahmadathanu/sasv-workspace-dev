-- =====================================================================================================
-- CI-040 v2.1  Unified approval (approve = supersede in one step) + recorded preview acknowledgement
--            + corrected profit preview (CI-037) + staleness list
-- PREPARED 26 Oct 2026 (IST), v2.1 corrections 26 Oct 2026. NOT APPLIED. Owner decisions of 26 Oct 2026: D2 YES (server-recorded, short-lived
-- preview acknowledgement tied to the authenticated reviewer, the candidate run and the current approved-run state,
-- revalidated atomically at approval under the governance lock), additional requirement 3 (profit from CI-037).
--
-- POLICY RECORD (named, wording changed from v1): COSTING-APPROVAL-POLICY-2026-10-26
--   Held as the COMMENT on public.rpc_costing_approve_run_with_preview (no table row).
--   Text: approval needs reason (>=10 chars), approval reference and a preview acknowledgement recorded by
--   rpc_costing_preview_approval_impact for the SAME authenticated user and run, unexpired (default 15 minutes,
--   setting approval_preview_ack_ttl_minutes), unused, and matching the current approved-run state at approval
--   time; stale drafts need p_acknowledge_stale = true (audited STALE_APPROVAL_ACKNOWLEDGED); a run dated before
--   the month's approved run is refused; an existing APPROVED run is superseded in the same transaction (stored
--   REVOKED, shown Superseded). The old 3-argument approve/supersede calls are refused with W2_USE_NEW_APPROVAL_ROUTE.
--   There is no emergency route inside this API; any emergency route would be a separate, future, audited admin action.
--   WORDING (v2.1): the acknowledgement records that the preview was GENERATED/OPENED by the server for this user,
--   run and approved-run state. It does not and cannot show that the preview was read, reviewed or understood.
--   SETTINGS (v2.1): every costing_automation_setting key has an allowed range (CHECK costing_automation_setting_range_chk;
--   unknown keys refused). Both new tables: no grants to anon/authenticated/service_role; read and write only by the
--   table owner (postgres), the same as costing_governance_owner and effective_date_guard_config. Changes are made by
--   the owner through a reviewed migration/SQL session, never from the app.
--
-- OBJECTS TOUCHED
--   ALTER  constraint cost_period_governance_audit_event_type_chk  WIDEN ONLY: + STALE_APPROVAL_ACKNOWLEDGED
--   NEW    table costing.costing_automation_setting        small settings table (key -> whole number), used by CI-040/041/043
--          row inserted: approval_preview_ack_ttl_minutes = 15
--   NEW    table costing.costing_approval_preview_ack      one row per preview opened (who, which run, state hash, expiry);
--          guard trigger: no delete; the only update allowed is marking it used, once
--   NEW    function costing.fn_costing_run_input_staleness(bigint)          read-only (unchanged from v1)
--   NEW    function costing.fn_costing_run_profit_availability(bigint)      read-only (CI-037 rows present or not)
--   NEW    function costing.fn_costing_approval_preview_core(bigint)         read-only
--   NEW    function public.rpc_costing_preview_approval_impact(bigint)       RPC; records the acknowledgement row
--   NEW    function costing.fn_w2_approve_unified(bigint,text,text,bigint,boolean,text)  internal writer
--   NEW    function public.rpc_costing_approve_run_with_preview(bigint,text,text,bigint,boolean)  RPC
--   REPLACE costing.fn_w2_run_checks(bigint,text)    as v1 (modes APPROVE/SUPERSEDE accepted; date-match dropped;
--          RUN_DATE_NOT_BEFORE_APPROVED added)
--   REPLACE public.rpc_costing_approve_run(bigint,text,text)            -> W2_USE_NEW_APPROVAL_ROUTE (writes nothing)
--   REPLACE public.rpc_costing_supersede_approved_run(bigint,text,text) -> W2_USE_NEW_APPROVAL_ROUTE (writes nothing)
-- NOT TOUCHED: designation/immutability/fingerprint triggers and functions, rpc_designate_costing_run, price feed views,
--   runs 119/122/143, cron, scheduler (CI-041), lock/finalise (CI-042). No business row is inserted or updated.
-- =====================================================================================================
BEGIN;

DO $ci040$ BEGIN   -- widen only; skipped when already widened (re-apply after a mode-B rollback that kept a wider constraint)
  IF position('STALE_APPROVAL_ACKNOWLEDGED' in coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conname = 'cost_period_governance_audit_event_type_chk' AND conrelid = 'costing.cost_period_governance_audit'::regclass), '')) = 0 THEN
    ALTER TABLE costing.cost_period_governance_audit DROP CONSTRAINT cost_period_governance_audit_event_type_chk;
    ALTER TABLE costing.cost_period_governance_audit ADD CONSTRAINT cost_period_governance_audit_event_type_chk
      CHECK (event_type = ANY (ARRAY['MIGRATION_BACKFILL'::text,'PERIOD_CREATED'::text,'VALUATION_DATE_CHANGED'::text,'PERIOD_LOCKED'::text,
        'PERIOD_REOPENED'::text,'PERIOD_CLOSED'::text,'RUN_APPROVED'::text,'SUPERSESSION_AUTHORISED'::text,'RUN_SUPERSEDED'::text,
        'STALE_APPROVAL_ACKNOWLEDGED'::text]));
  END IF;
END $ci040$;

CREATE TABLE IF NOT EXISTS costing.costing_automation_setting(
  setting_key text PRIMARY KEY,
  int_value integer NOT NULL CHECK (int_value >= 0),
  CONSTRAINT costing_automation_setting_range_chk CHECK (CASE setting_key
    WHEN 'approval_preview_ack_ttl_minutes'   THEN int_value BETWEEN 5 AND 60
    WHEN 'scheduler_max_retries'              THEN int_value BETWEEN 0 AND 3
    WHEN 'scheduler_catch_up_max_runs'        THEN int_value BETWEEN 0 AND 1
    WHEN 'health_quarter_lock_warn_days'      THEN int_value BETWEEN 30 AND 120
    WHEN 'health_quarter_lock_info_days'      THEN int_value BETWEEN 7 AND 90
    WHEN 'health_draft_freshness_days'        THEN int_value BETWEEN 7 AND 31
    WHEN 'health_draft_review_days'           THEN int_value BETWEEN 1 AND 60
    WHEN 'health_queued_stuck_hours'          THEN int_value BETWEEN 1 AND 48
    WHEN 'health_running_stuck_hours'         THEN int_value BETWEEN 1 AND 48
    WHEN 'health_preview_ack_unused_warn_count' THEN int_value BETWEEN 10 AND 100000
    WHEN 'health_preview_ack_unused_min_age_days' THEN int_value BETWEEN 1 AND 365
    WHEN 'health_retry_overdue_minutes'       THEN int_value BETWEEN 10 AND 240
    ELSE false END),
  unit text NOT NULL,
  description text NOT NULL,
  introduced_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO costing.costing_automation_setting VALUES
 ('approval_preview_ack_ttl_minutes', 15, 'minutes', 'How long an opened approval preview stays valid for approval', 'CI-040', now())
 ON CONFLICT (setting_key) DO NOTHING;   -- re-apply after a non-destructive rollback keeps the owner's value

CREATE TABLE IF NOT EXISTS costing.costing_approval_preview_ack(
  id bigserial PRIMARY KEY,
  refresh_run_id bigint NOT NULL REFERENCES costing.costing_refresh_run(id),
  period_start date NOT NULL,
  reviewer_uid uuid NOT NULL,
  approved_run_at_preview bigint,
  last_designation_id_at_preview bigint,
  state_md5 text NOT NULL,
  can_approve boolean NOT NULL,
  is_stale boolean NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_audit_id bigint);
CREATE INDEX IF NOT EXISTS costing_approval_preview_ack_run_idx ON costing.costing_approval_preview_ack(refresh_run_id, reviewer_uid);

CREATE OR REPLACE FUNCTION costing.fn_guard_preview_ack() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'costing','pg_temp' AS $function$
begin
  if tg_op = 'DELETE' then raise exception 'W2_PREVIEW_ACK_APPEND_ONLY: delete prohibited' using errcode = 'P0001'; end if;
  if old.consumed_at is not null
     or (row(new.id,new.refresh_run_id,new.period_start,new.reviewer_uid,new.approved_run_at_preview,new.last_designation_id_at_preview,
             new.state_md5,new.can_approve,new.is_stale,new.opened_at,new.expires_at)
         is distinct from
         row(old.id,old.refresh_run_id,old.period_start,old.reviewer_uid,old.approved_run_at_preview,old.last_designation_id_at_preview,
             old.state_md5,old.can_approve,old.is_stale,old.opened_at,old.expires_at))
     or new.consumed_at is null then
    raise exception 'W2_PREVIEW_ACK_APPEND_ONLY: only marking an unused acknowledgement as used is allowed' using errcode = 'P0001';
  end if;
  return new;
end $function$;
DROP TRIGGER IF EXISTS trg_preview_ack_guard ON costing.costing_approval_preview_ack;
CREATE TRIGGER trg_preview_ack_guard BEFORE UPDATE OR DELETE ON costing.costing_approval_preview_ack
  FOR EACH ROW EXECUTE FUNCTION costing.fn_guard_preview_ack();

-- ---------- staleness: master-data entries made AFTER the run captured its context, effective ON/BEFORE its date
CREATE OR REPLACE FUNCTION costing.fn_costing_run_input_staleness(p_run bigint)
 RETURNS TABLE(source text, table_name text, guard_mode text, scannable boolean, changed_rows bigint,
               latest_change_at timestamptz, min_effective date, max_effective date)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare r costing.costing_refresh_run%rowtype; g record; v_ts text[]; v_eff text; v_tsexpr text;
begin
  select * into r from costing.costing_refresh_run where id = p_run;
  if not found or r.valuation_context_captured_at is null then return; end if;
  for g in select c.table_name, c.mode from costing.effective_date_guard_config c order by c.table_name::text loop
    select array_agg(a.attname::text order by a.attname) into v_ts from pg_attribute a
     where a.attrelid = g.table_name and a.attnum > 0 and not a.attisdropped and a.attname in ('updated_at','created_at','inserted_at','created_on');
    select a.attname::text into v_eff from pg_attribute a
     where a.attrelid = g.table_name and a.attnum > 0 and not a.attisdropped and a.attname in ('effective_from','effective_date','valid_from')
     order by array_position(array['effective_from','effective_date','valid_from'], a.attname::text) limit 1;
    source := 'TABLE_SCAN'; table_name := g.table_name::text; guard_mode := g.mode;
    changed_rows := null; latest_change_at := null; min_effective := null; max_effective := null;
    if v_ts is null or v_eff is null then
      scannable := false; return next; continue;
    end if;
    scannable := true;
    v_tsexpr := case when array_length(v_ts,1) = 1 then quote_ident(v_ts[1])
                     else 'greatest(' || (select string_agg(quote_ident(x), ',') from unnest(v_ts) x) || ')' end;
    begin
      execute format('select count(*), max(%1$s), min(%2$I)::date, max(%2$I)::date from %3$s where %1$s > $1 and %2$I <= $2',
                     v_tsexpr, v_eff, g.table_name)
        into changed_rows, latest_change_at, min_effective, max_effective
        using r.valuation_context_captured_at, r.valuation_date;
    exception when others then scannable := false; changed_rows := null;
    end;
    if not scannable or changed_rows > 0 then return next; end if;
  end loop;
  -- back-dating log (AUDIT_ONLY tables log every back-dated entry)
  return query select 'BACKDATE_LOG'::text, l.table_name, l.mode, true, count(*)::bigint, max(l.logged_at), min(l.new_date), max(l.new_date)
    from costing.effective_date_backdate_log l
   where l.logged_at > r.valuation_context_captured_at and l.new_date <= r.valuation_date
   group by l.table_name, l.mode;
end $function$;

-- ---------- unified checks (identical to v1) (same signature; old modes accepted)
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
end $function$;

-- ---------- CI-037 profit availability for a run
CREATE OR REPLACE FUNCTION costing.fn_costing_run_profit_availability(p_run bigint)
 RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
  with s as (select count(*) n, count(*) filter (where profit_calculation_status like 'CALCULATED%') calc,
                    count(*) filter (where profit_calculation_status not like 'CALCULATED%') not_calc
               from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id = p_run)
  select jsonb_build_object('run', p_run, 'rows', s.n, 'calculated_rows', s.calc, 'not_calculated_rows', s.not_calc,
    'available', s.n > 0,
    'label', case when p_run is null then null
                  when s.n > 0 then 'Estimated profit (CI-037)'
                  when not exists (select 1 from costing.sku_pricing_bridge_profit_snapshot)
                       or (select finished_at from costing.costing_refresh_run where id = p_run)
                          < (select min(calculated_at) from costing.sku_pricing_bridge_profit_snapshot)
                    then 'Not available for historical run'
                  else 'Not available: estimated profit was not calculated for this run' end)
  from s
$function$;

-- ---------- preview core (read-only). state_md5 binds an acknowledgement to exactly this state.
CREATE OR REPLACE FUNCTION costing.fn_costing_approval_preview_core(p_run bigint)
 RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare v_chk jsonb; v_appr bigint; r costing.costing_refresh_run%rowtype; v_frozen date; v_after date;
  v_changes jsonb; v_summary jsonb; v_stale jsonb; v_stale_rows bigint; v_stale_latest timestamptz; v_unscannable jsonb;
  v_last_des bigint; v_state text; v_fwd int; v_aud int; v_pa_new jsonb; v_pa_old jsonb;
begin
  select * into r from costing.costing_refresh_run where id = p_run;
  if not found then raise exception 'W2_RUN_NOT_FOUND: %', p_run using errcode = 'P0001'; end if;
  v_chk := costing.fn_w2_run_checks(p_run, 'APPROVE');
  v_appr := (v_chk->>'approved_run')::bigint;
  v_frozen := costing.fn_frozen_valuation_through();
  v_after := greatest(v_frozen, r.valuation_date);
  select count(*) filter (where mode = 'FORWARD_ONLY'), count(*) filter (where mode = 'AUDIT_ONLY') into v_fwd, v_aud from costing.effective_date_guard_config;
  v_pa_new := costing.fn_costing_run_profit_availability(p_run);
  v_pa_old := case when v_appr is not null then costing.fn_costing_run_profit_availability(v_appr) end;

  with n as (select * from costing.v_sku_detailed_cost_sheet where refresh_run_id = p_run),
       o as (select * from costing.v_sku_detailed_cost_sheet where refresh_run_id = v_appr),
       pn as (select * from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id = p_run),
       po as (select * from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id = v_appr),
       j as (
    select coalesce(n.sku_id, o.sku_id) sku_id, coalesce(n.product_name, o.product_name) product_name,
      case when o.sku_id is null then 'ADDED' when n.sku_id is null then 'REMOVED' else 'BOTH' end presence,
      n.cost_sheet_status new_status, o.cost_sheet_status old_status,
      o.material_cost_per_sku old_material, n.material_cost_per_sku new_material,
      o.internal_material_conversion_cost_per_sku old_conversion, n.internal_material_conversion_cost_per_sku new_conversion,
      o.manufacturing_cop_per_sku old_mfg, n.manufacturing_cop_per_sku new_mfg,
      o.internal_loaded_cost_per_sku old_loaded, n.internal_loaded_cost_per_sku new_loaded,
      o.pricing_cost_per_sku old_pricing, n.pricing_cost_per_sku new_pricing,
      o.ik_selling_price old_ik_sp, n.ik_selling_price new_ik_sp, o.ok_selling_price old_ok_sp, n.ok_selling_price new_ok_sp,
      -- CI-037 estimated profit: shown only when its status is CALCULATED*; otherwise null with the status/label (never zero)
      case when poi.profit_calculation_status like 'CALCULATED%' then poi.estimated_profit_per_sku end old_ik_estimated_profit,
      case when pni.profit_calculation_status like 'CALCULATED%' then pni.estimated_profit_per_sku end new_ik_estimated_profit,
      case when poo.profit_calculation_status like 'CALCULATED%' then poo.estimated_profit_per_sku end old_ok_estimated_profit,
      case when pno.profit_calculation_status like 'CALCULATED%' then pno.estimated_profit_per_sku end new_ok_estimated_profit,
      coalesce(poi.profit_calculation_status, case when v_appr is not null then v_pa_old->>'label' end) old_ik_profit_status,
      coalesce(pni.profit_calculation_status, v_pa_new->>'label') new_ik_profit_status,
      coalesce(poo.profit_calculation_status, case when v_appr is not null then v_pa_old->>'label' end) old_ok_profit_status,
      coalesce(pno.profit_calculation_status, v_pa_new->>'label') new_ok_profit_status,
      n.pricing_cost_per_sku - o.pricing_cost_per_sku delta_pricing,
      case when o.pricing_cost_per_sku <> 0 then round(100 * (n.pricing_cost_per_sku - o.pricing_cost_per_sku) / o.pricing_cost_per_sku, 2) end pct_pricing
    from n full join o on o.sku_id = n.sku_id
    left join pn pni on pni.sku_id = coalesce(n.sku_id, o.sku_id) and pni.region_code = 'IK'
    left join pn pno on pno.sku_id = coalesce(n.sku_id, o.sku_id) and pno.region_code = 'OK'
    left join po poi on poi.sku_id = coalesce(n.sku_id, o.sku_id) and poi.region_code = 'IK'
    left join po poo on poo.sku_id = coalesce(n.sku_id, o.sku_id) and poo.region_code = 'OK'),
       ch as (select * from j where v_appr is null or presence <> 'BOTH'
              or row(old_material,old_conversion,old_mfg,old_loaded,old_pricing,old_ik_sp,old_ok_sp,old_ik_estimated_profit,old_ok_estimated_profit,old_ik_profit_status,old_ok_profit_status)
                 is distinct from row(new_material,new_conversion,new_mfg,new_loaded,new_pricing,new_ik_sp,new_ok_sp,new_ik_estimated_profit,new_ok_estimated_profit,new_ik_profit_status,new_ok_profit_status))
  select coalesce((select jsonb_agg(to_jsonb(ch) order by abs(coalesce(delta_pricing,0)) desc, sku_id) from ch), '[]'::jsonb),
         jsonb_build_object(
           'skus_in_draft', (select count(*) from n), 'skus_in_approved', (select count(*) from o),
           'skus_changed', (select count(*) from ch where presence = 'BOTH'),
           'skus_added', (select count(*) from ch where presence = 'ADDED' and v_appr is not null), 'skus_removed', (select count(*) from ch where presence = 'REMOVED'),
           'top_by_amount', coalesce((select jsonb_agg(x) from (select sku_id, product_name, old_pricing, new_pricing, delta_pricing, pct_pricing from ch
                where presence = 'BOTH' order by abs(delta_pricing) desc nulls last, sku_id limit 10) x), '[]'::jsonb),
           'top_by_percent', coalesce((select jsonb_agg(x) from (select sku_id, product_name, old_pricing, new_pricing, delta_pricing, pct_pricing from ch
                where presence = 'BOTH' and pct_pricing is not null order by abs(pct_pricing) desc, sku_id limit 10) x), '[]'::jsonb),
           'profit', jsonb_build_object('source', 'costing.sku_pricing_bridge_profit_snapshot (CI-037)',
                'draft', v_pa_new, 'approved', v_pa_old,
                'note', 'Estimated profit per unit from CI-037, shown only where its calculation status is CALCULATED; otherwise blank with the status. Not added up across SKUs (no volumes). The old MRP-based margin before scheme is not shown as profit.'),
           'diff_md5', md5(coalesce((select string_agg(to_jsonb(ch)::text, '|' order by sku_id) from ch), '')))
    into v_changes, v_summary;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.source, s.table_name) filter (where s.scannable), '[]'::jsonb),
         coalesce(sum(s.changed_rows) filter (where s.scannable), 0), max(s.latest_change_at),
         coalesce(jsonb_agg(s.table_name order by s.table_name) filter (where not s.scannable), '[]'::jsonb)
    into v_stale, v_stale_rows, v_stale_latest, v_unscannable
    from costing.fn_costing_run_input_staleness(p_run) s;

  select max(id) into v_last_des from costing.costing_run_designation where period_start = r.period_start;
  v_state := md5(jsonb_build_object('v', 2, 'run', p_run, 'approved_run', v_appr, 'run_date', r.valuation_date, 'counts', v_chk->'counts',
                  'ok', v_chk->'ok', 'diff_md5', v_summary->>'diff_md5', 'stale_rows', v_stale_rows, 'stale_latest', v_stale_latest,
                  'last_designation_id', v_last_des, 'frozen_after', v_after)::text);
  return jsonb_build_object(
    'state_md5', v_state, 'last_designation_id', v_last_des, 'generated_at', statement_timestamp(),
    'run', p_run, 'period_start', r.period_start, 'run_valuation_date', r.valuation_date, 'run_costed_at', r.valuation_context_captured_at,
    'current_approved_run', v_appr, 'current_approved_valuation_date', v_chk->'approved_run_valuation_date',
    'action', case when v_appr is null then 'APPROVE' else 'APPROVE_AND_SUPERSEDE' end,
    'superseded_label', case when v_appr is null then null else 'Superseded' end,
    'can_approve', (v_chk->>'ok')::boolean, 'checks', v_chk->'checks', 'counts', v_chk->'counts',
    'cutoff', jsonb_build_object('frozen_through_now', v_frozen, 'frozen_through_after', v_after, 'moves', v_after > v_frozen,
               'forward_only_tables', v_fwd, 'audit_only_tables', v_aud,
               'message', case when v_after > v_frozen then format('Back-dating cut-off moves from %s to %s. After this, rates and policies effective on or before %s can no longer be entered in the %s forward-only tables; the %s audit-only tables will log instead of refusing.', v_frozen, v_after, v_after, v_fwd, v_aud)
                               else format('Back-dating cut-off stays at %s.', v_frozen) end),
    'impact', v_summary - 'diff_md5', 'sku_changes', v_changes,
    'staleness', jsonb_build_object('is_stale', v_stale_rows > 0, 'changed_rows', v_stale_rows, 'latest_change_at', v_stale_latest,
                 'items', v_stale, 'not_scannable_tables', v_unscannable, 'acknowledgement_required', v_stale_rows > 0,
                 'message', case when v_stale_rows > 0 then format('%s master-data entries effective on or before %s were made after this draft was costed (%s). Approve anyway only with acknowledgement, or wait for the next draft.', v_stale_rows, r.valuation_date, r.valuation_context_captured_at) else 'No later entries found in the guarded master-data tables.' end));
end $function$;

-- ---------- preview RPC: returns the preview and records who opened it (the acknowledgement)
CREATE OR REPLACE FUNCTION public.rpc_costing_preview_approval_impact(p_refresh_run_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare v jsonb; v_uid uuid := auth.uid(); v_ttl int; v_ack costing.costing_approval_preview_ack;
begin
  perform public.require_permission('module:costing-control-center', false);
  if v_uid is null then raise exception 'W2_AUTH_REQUIRED: an authenticated user is required to open an approval preview' using errcode = 'P0001'; end if;
  v := costing.fn_costing_approval_preview_core(p_refresh_run_id);
  select int_value into v_ttl from costing.costing_automation_setting where setting_key = 'approval_preview_ack_ttl_minutes';
  insert into costing.costing_approval_preview_ack(refresh_run_id, period_start, reviewer_uid, approved_run_at_preview, last_designation_id_at_preview,
      state_md5, can_approve, is_stale, expires_at)
  values (p_refresh_run_id, (v->>'period_start')::date, v_uid, (v->>'current_approved_run')::bigint, (v->>'last_designation_id')::bigint,
      v->>'state_md5', (v->>'can_approve')::boolean, (v->'staleness'->>'is_stale')::boolean, clock_timestamp() + make_interval(mins => coalesce(v_ttl, 15)))
  returning * into v_ack;
  return (v - 'state_md5') || jsonb_build_object('preview_ack_id', v_ack.id, 'ack_expires_at', v_ack.expires_at, 'reviewer_uid', v_uid);
end $function$;

-- ---------- unified writer: revalidates the acknowledgement atomically under the governance lock
CREATE OR REPLACE FUNCTION costing.fn_w2_approve_unified(p_run bigint, p_reason text, p_approval_reference text,
   p_preview_ack_id bigint, p_acknowledge_stale boolean, p_entry_point text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare v_name text; v_uid uuid := auth.uid(); v_chk jsonb; v_prev jsonb; v_period date; v_old bigint; v_rev bigint; v_des bigint; v_p costing.cost_periods;
  v_audit bigint; v_ack_audit bigint; v_evidence jsonb; v_ack costing.costing_approval_preview_ack;
begin
  v_name := costing.fn_w2_owner_name();
  perform costing.fn_w2_require_text(p_reason, p_approval_reference);
  select period_start into v_period from costing.costing_refresh_run where id = p_run;
  if v_period is null then raise exception 'W2_RUN_NOT_FOUND: %', p_run; end if;
  perform pg_advisory_xact_lock(hashtextextended('cost-period-governance:' || v_period::text, 0));
  v_chk := costing.fn_w2_run_checks(p_run, 'APPROVE');
  if not (v_chk->>'ok')::boolean then
    raise exception 'W2_APPROVAL_CHECKS_FAILED: run %: %', p_run,
      (select string_agg((x->>'code') || ' (' || (x->>'detail') || ')', '; ') from jsonb_array_elements(v_chk->'checks') x where not (x->>'pass')::boolean)
      using errcode = 'P0001';
  end if;
  if p_preview_ack_id is null then
    raise exception 'W2_PREVIEW_REQUIRED: open the impact preview (rpc_costing_preview_approval_impact(%)) and pass its preview_ack_id', p_run using errcode = 'P0001';
  end if;
  select * into v_ack from costing.costing_approval_preview_ack where id = p_preview_ack_id for update;
  if not found or v_ack.refresh_run_id <> p_run then
    raise exception 'W2_PREVIEW_ACK_NOT_FOR_RUN: acknowledgement % does not belong to run %', p_preview_ack_id, p_run using errcode = 'P0001';
  end if;
  if v_uid is null or v_ack.reviewer_uid <> v_uid then
    raise exception 'W2_PREVIEW_ACK_OTHER_USER: the preview must be opened by the approving user' using errcode = 'P0001';
  end if;
  if v_ack.consumed_at is not null then
    raise exception 'W2_PREVIEW_ACK_ALREADY_USED: acknowledgement % was used at %', p_preview_ack_id, v_ack.consumed_at using errcode = 'P0001';
  end if;
  if v_ack.expires_at <= clock_timestamp() then
    raise exception 'W2_PREVIEW_ACK_EXPIRED: the preview expired at %; open it again', v_ack.expires_at using errcode = 'P0001';
  end if;
  v_prev := costing.fn_costing_approval_preview_core(p_run);
  if v_prev->>'state_md5' <> v_ack.state_md5 then
    raise exception 'W2_PREVIEW_OUTDATED: the approved-run state or the data changed since the preview was opened (approved run then %, now %); open the preview again',
      v_ack.approved_run_at_preview, v_prev->>'current_approved_run' using errcode = 'P0001';
  end if;
  if (v_prev->'staleness'->>'is_stale')::boolean and not coalesce(p_acknowledge_stale, false) then
    raise exception 'W2_STALE_DRAFT_ACK_REQUIRED: % entries were made after run % was costed; acknowledge to approve anyway', v_prev->'staleness'->>'changed_rows', p_run using errcode = 'P0001';
  end if;
  v_old := (v_chk->>'approved_run')::bigint;
  if v_old is not null then
    v_rev := costing.rpc_designate_costing_run(v_old, 'REVOKED', v_name,
               'Superseded by run ' || p_run || ': ' || btrim(p_reason) || ' [' || btrim(p_approval_reference) || ']');
  end if;
  v_des := costing.rpc_designate_costing_run(p_run, 'APPROVED', v_name,
             case when v_old is null then btrim(p_reason) || ' [' || btrim(p_approval_reference) || ']'
                  else 'Supersedes run ' || v_old || ': ' || btrim(p_reason) || ' [' || btrim(p_approval_reference) || ']' end);
  select * into v_p from costing.cost_periods where period_start = v_period;
  v_evidence := jsonb_build_object('ci', 'CI-040', 'entry_point', p_entry_point, 'refresh_run_id', p_run, 'new_run', p_run, 'old_run', v_old,
      'superseded_label', case when v_old is null then null else 'Superseded' end,
      'revoke_designation_id', v_rev, 'approve_designation_id', v_des, 'designation_id', v_des,
      'designation_fingerprint_id', (select fingerprint_id from costing.costing_run_designation where id = v_des),
      'preview_ack_id', v_ack.id, 'preview_opened_at', v_ack.opened_at, 'preview_state_md5', v_ack.state_md5,
      'cutoff', v_prev->'cutoff', 'impact', v_prev->'impact',
      'staleness', (v_prev->'staleness') - 'items', 'stale_acknowledged', coalesce(p_acknowledge_stale, false) and (v_prev->'staleness'->>'is_stale')::boolean,
      'counts', v_chk->'counts', 'checks', v_chk->'checks');
  v_audit := costing.fn_w2_audit(v_period, case when v_old is null then 'RUN_APPROVED' else 'RUN_SUPERSEDED' end, v_p, v_p,
                                 p_reason, p_approval_reference, v_evidence);
  if (v_prev->'staleness'->>'is_stale')::boolean then
    v_ack_audit := costing.fn_w2_audit(v_period, 'STALE_APPROVAL_ACKNOWLEDGED', v_p, v_p, p_reason, p_approval_reference,
      jsonb_build_object('ci', 'CI-040', 'refresh_run_id', p_run, 'approval_audit_id', v_audit, 'preview_ack_id', v_ack.id, 'staleness', v_prev->'staleness'));
  end if;
  update costing.costing_approval_preview_ack set consumed_at = clock_timestamp(), consumed_audit_id = v_audit where id = v_ack.id;
  return jsonb_build_object('refresh_run_id', p_run, 'new_run', p_run, 'old_run', v_old, 'superseded', v_old is not null,
    'designation_id', v_des, 'revoke_designation_id', v_rev, 'audit_id', v_audit, 'stale_ack_audit_id', v_ack_audit,
    'preview_ack_id', v_ack.id, 'counts', v_chk->'counts');
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_costing_approve_run_with_preview(p_refresh_run_id bigint, p_reason text, p_approval_reference text,
   p_preview_ack_id bigint, p_acknowledge_stale boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
begin
  perform public.require_permission('module:costing-control-center', true);
  return costing.fn_w2_approve_unified(p_refresh_run_id, p_reason, p_approval_reference, p_preview_ack_id, p_acknowledge_stale, 'APPROVE_WITH_PREVIEW');
end $function$;

-- ---------- old 3-argument RPCs: same signatures/ACL, informative refusal, no bypass, nothing written
CREATE OR REPLACE FUNCTION public.rpc_costing_approve_run(p_refresh_run_id bigint, p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
begin
  raise exception 'W2_USE_NEW_APPROVAL_ROUTE: rpc_costing_approve_run is retired (CI-040). Open rpc_costing_preview_approval_impact(%) and approve with rpc_costing_approve_run_with_preview(run, reason, reference, preview_ack_id[, acknowledge_stale]).', p_refresh_run_id
    using errcode = 'P0001', hint = 'Approval and supersession are one step now; the preview must be opened by the approving user.';
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_costing_supersede_approved_run(p_new_refresh_run_id bigint, p_reason text, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
begin
  raise exception 'W2_USE_NEW_APPROVAL_ROUTE: rpc_costing_supersede_approved_run is retired (CI-040). Approving a newer run supersedes the current one: open rpc_costing_preview_approval_impact(%) and approve with rpc_costing_approve_run_with_preview.', p_new_refresh_run_id
    using errcode = 'P0001', hint = 'Approval and supersession are one step now; the preview must be opened by the approving user.';
end $function$;

-- ---------- ownership and grants
ALTER TABLE costing.costing_automation_setting OWNER TO postgres;
ALTER TABLE costing.costing_approval_preview_ack OWNER TO postgres;
ALTER TABLE costing.costing_automation_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE costing.costing_approval_preview_ack ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON costing.costing_automation_setting FROM PUBLIC;
REVOKE ALL ON costing.costing_approval_preview_ack FROM PUBLIC;
ALTER FUNCTION costing.fn_guard_preview_ack() OWNER TO postgres;
ALTER FUNCTION costing.fn_costing_run_input_staleness(bigint) OWNER TO postgres;
ALTER FUNCTION costing.fn_costing_run_profit_availability(bigint) OWNER TO postgres;
ALTER FUNCTION costing.fn_costing_approval_preview_core(bigint) OWNER TO postgres;
ALTER FUNCTION costing.fn_w2_approve_unified(bigint,text,text,bigint,boolean,text) OWNER TO postgres;
ALTER FUNCTION public.rpc_costing_preview_approval_impact(bigint) OWNER TO postgres;
ALTER FUNCTION public.rpc_costing_approve_run_with_preview(bigint,text,text,bigint,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_guard_preview_ack() FROM PUBLIC;
REVOKE ALL ON FUNCTION costing.fn_costing_run_input_staleness(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION costing.fn_costing_run_profit_availability(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION costing.fn_costing_approval_preview_core(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION costing.fn_w2_approve_unified(bigint,text,text,bigint,boolean,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_costing_preview_approval_impact(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_costing_approve_run_with_preview(bigint,text,text,bigint,boolean) FROM PUBLIC;
DO $$ BEGIN
  EXECUTE 'REVOKE ALL ON costing.costing_automation_setting FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON costing.costing_approval_preview_ack FROM anon, authenticated';
  -- v2.1: owner-only (postgres), mirroring costing_governance_owner / effective_date_guard_config; no service_role grant
  EXECUTE 'REVOKE ALL ON costing.costing_automation_setting FROM service_role';
  EXECUTE 'REVOKE ALL ON costing.costing_approval_preview_ack FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION costing.fn_costing_run_input_staleness(bigint) FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON FUNCTION costing.fn_costing_run_profit_availability(bigint) FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON FUNCTION costing.fn_costing_approval_preview_core(bigint) FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON FUNCTION costing.fn_w2_approve_unified(bigint,text,text,bigint,boolean,text) FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_costing_preview_approval_impact(bigint) FROM anon';
  EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_costing_approve_run_with_preview(bigint,text,text,bigint,boolean) FROM anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_costing_preview_approval_impact(bigint) TO authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_costing_approve_run_with_preview(bigint,text,text,bigint,boolean) TO authenticated, service_role';
END $$;

COMMENT ON FUNCTION public.rpc_costing_approve_run_with_preview(bigint,text,text,bigint,boolean) IS
 'COSTING-APPROVAL-POLICY-2026-10-26 (CI-040 v2; owner decisions 26 Oct 2026, Dr. Brahmadathan U): approval needs reason (>=10 chars), approval reference and a preview acknowledgement (preview_ack_id: proof the preview was generated/opened, not that it was reviewed or understood) recorded by rpc_costing_preview_approval_impact for the same authenticated user and run, unexpired (setting approval_preview_ack_ttl_minutes, default 15), unused and matching the current approved-run state, revalidated under the governance lock; stale drafts need p_acknowledge_stale=true (audited STALE_APPROVAL_ACKNOWLEDGED); a run dated before the month''s approved run is refused; an existing APPROVED run is superseded in the same transaction (stored REVOKED, shown Superseded). Old 3-argument approve/supersede calls are refused (W2_USE_NEW_APPROVAL_ROUTE); no emergency route exists in this API.';
COMMENT ON FUNCTION public.rpc_costing_preview_approval_impact(bigint) IS
 'CI-040 v2 approval impact preview: checks, cut-off move, per-SKU change vs current approved run incl. CI-037 estimated profit and its status, staleness. Records one acknowledgement row (that the preview was generated/opened: who, for which run and state, expiry) and returns preview_ack_id. Changes no costing data.';
COMMENT ON TABLE costing.costing_approval_preview_ack IS 'CI-040 v2.1: approval preview acknowledgements (D2): evidence that the preview was generated/opened for this user, run and state (not that it was reviewed or understood). Append-only except marking an acknowledgement used once. Not auto-deleted; CI-043 reports accumulation.';
COMMENT ON TABLE costing.costing_automation_setting IS 'CI-040/041/043 v2.1: owner-only, range-checked whole-number settings for costing automation (retries, catch-up, preview expiry, reminders).';
COMMIT;
