-- WP10 G2 PROPOSAL 03 — UNAPPLIED. DO NOT RUN without separate, exact, owner-authorised operational approval.
-- public.rpc_wp10_get_operational_expiry_horizon(p_horizon_days, p_after_sku_id, p_limit)
--
-- A READ-ONLY, STABLE, paged "current-operational" lens, SEPARATE from governed-period LIVE_AS_OF. It evaluates the five-essential contract
-- at an EXPLICIT date basis = today's IST calendar date (costing.fn_wp10_today_ist) and at every effective boundary inside
-- (today, today + horizon]. It does NOT call or change costing.fn_sku_activation_missing_items (whose date is internal), CI-038a, the
-- fingerprint, the portfolio read or the five-essential list, and it stores nothing (no duplicate readiness system, no build/refresh call).
--
-- Population = OPERATIONAL (active SKU, Active product, not sample) — the same predicate the governed build uses.
-- Per essential and per SKU it reports: today_state, first_issue_date/issue_state (first in-window date the state is not RESOLVED),
-- recovers_on (first later in-window date it is RESOLVED again — a gap/overlap that recovers before the horizon ends is still reported),
-- classification TODAY_* / LAPSES_IN_WINDOW / GAP_RECOVERS_IN_WINDOW / AMBIGUOUS_IN_WINDOW / UNKNOWN. effective_to is INCLUSIVE: a row with
-- effective_to = D still covers D; the first uncovered day is D + 1.
-- Budgets: horizon 1..90 days (default 30), limit 1..100 flagged rows (default 50), at most 200 SKUs scanned per call; keyset paging by SKU id.
-- Fail-closed: any evaluation error is UNKNOWN and is REPORTED (a row), never omitted and never RESOLVED.
-- Permission (existing targets only, no new target): module:manage-products view OR module:costing-control-center view.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PROVENANCE PREFLIGHT (R5): refuses to run when any object this file creates already exists (it never overwrites or adopts), when a live dependency
-- differs from the definition that was reviewed (md5 of pg_get_functiondef), or when a prerequisite proposal is missing or was modified after it was
-- applied. Re-running this file therefore FAILS at this block by design; a partial apply is impossible because the file is one transaction.
do $wp10_preflight$
declare t text; r record; v oid; c text;
begin
  foreach t in array array['public.rpc_wp10_get_operational_expiry_horizon(integer, bigint, integer)'] loop
    if to_regprocedure(t) is not null then
      raise exception 'WP10-G2 preflight: % already exists; refusing to overwrite or adopt it (review the existing definition separately).', t;
    end if;
  end loop;
  if to_regprocedure('public.app_has_permission(text, text)') is null then raise exception 'WP10-G2 preflight: required function public.app_has_permission(text, text) is missing.'; end if;
  foreach t in array array['costing.fn_wp10_today_ist()', 'costing.fn_wp10_batch_size_state_as_of(bigint, date)'] loop
    v := to_regprocedure(t);
    c := case when v is null then null else obj_description(v, 'pg_proc') end;
    if v is null or c is null or c not like 'WP10-G2 01\_%' or split_part(c, 'md5:', 2) <> md5(pg_get_functiondef(v)) then
      raise exception 'WP10-G2 preflight: prerequisite % (proposal 01) is missing, not applied by this procedure, or modified since.', t;
    end if;
  end loop;
  foreach t in array array['costing.fn_wp10_essential_states_as_of(bigint, bigint, date)', 'costing.fn_wp10_boundary_dates(bigint, bigint, date, date)'] loop
    v := to_regprocedure(t);
    c := case when v is null then null else obj_description(v, 'pg_proc') end;
    if v is null or c is null or c not like 'WP10-G2 02\_%' or split_part(c, 'md5:', 2) <> md5(pg_get_functiondef(v)) then
      raise exception 'WP10-G2 preflight: prerequisite % (proposal 02) is missing, not applied by this procedure, or modified since.', t;
    end if;
  end loop;
end $wp10_preflight$;

create function public.rpc_wp10_get_operational_expiry_horizon(
  p_horizon_days integer default 30,
  p_after_sku_id bigint default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, costing, pg_temp
as $fn$
declare
  c_scan_cap constant integer := 200;
  v_today date;
  v_days integer;
  v_limit integer;
  v_end date;
  rec record;
  v_dates date[];
  v_d date;
  v_states jsonb;
  v_today_states jsonb;
  v_codes text[] := array['PM_BOM_REVISION','BATCH_SIZE_REFERENCE','MANUFACTURING_ROUTE','MRP_POLICY','SELLING_PRICE_POLICY'];
  v_code text;
  v_state text;
  v_today_state text;
  v_first date;
  v_first_state text;
  v_recovers date;
  v_class text;
  v_ess jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_row_ess jsonb;
  v_scanned integer := 0;
  v_flagged integer := 0;
  v_last bigint := null;
  v_budget_hit boolean := false;
  v_more boolean;
  v_owner jsonb := jsonb_build_object(
    'PM_BOM_REVISION', 'PM BOM Manager',
    'BATCH_SIZE_REFERENCE', 'Batch Sizes (Supply / Batch Plan)',
    'MANUFACTURING_ROUTE', 'Production Route Manager',
    'MRP_POLICY', 'Pricing Policy Manager > MRP',
    'SELLING_PRICE_POLICY', 'Pricing Policy Manager > Selling & scheme policies');
  v_timeline jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (public.app_has_permission('module:manage-products', 'view') or public.app_has_permission('module:costing-control-center', 'view')) then
    raise exception 'Permission denied';
  end if;

  v_today := costing.fn_wp10_today_ist();
  v_days := least(greatest(coalesce(p_horizon_days, 30), 1), 90);
  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_end := v_today + v_days;

  for rec in
    select s.id as sku_id, s.product_id
    from public.product_skus s
    join public.products p on p.id = s.product_id
    where s.is_active and p.status = 'Active' and not coalesce(s.is_sample, false)
      and (p_after_sku_id is null or s.id > p_after_sku_id)
    order by s.id
    limit c_scan_cap + 1
  loop
    if v_scanned >= c_scan_cap then v_budget_hit := true; exit; end if;
    v_scanned := v_scanned + 1;
    v_last := rec.sku_id;

    v_dates := array[v_today] || costing.fn_wp10_boundary_dates(rec.sku_id, rec.product_id, v_today, v_end);
    v_timeline := '{}'::jsonb;
    foreach v_d in array v_dates loop
      v_timeline := v_timeline || jsonb_build_object(v_d::text, costing.fn_wp10_essential_states_as_of(rec.sku_id, rec.product_id, v_d));
    end loop;
    v_today_states := v_timeline -> v_today::text;

    v_row_ess := '[]'::jsonb;
    foreach v_code in array v_codes loop
      v_today_state := v_today_states ->> v_code;
      v_first := null; v_first_state := null; v_recovers := null;
      if v_today_state <> 'RESOLVED' then
        v_first := v_today; v_first_state := v_today_state;
      end if;
      foreach v_d in array v_dates loop
        v_state := (v_timeline -> v_d::text) ->> v_code;
        if v_first is null then
          if v_state <> 'RESOLVED' then v_first := v_d; v_first_state := v_state; end if;
        elsif v_recovers is null and v_d > v_first and v_state = 'RESOLVED' then
          v_recovers := v_d;
        end if;
      end loop;
      if v_first is not null then
        v_class := case
          when v_first_state = 'UNKNOWN' then 'UNKNOWN'
          when v_first = v_today then 'TODAY_' || v_first_state
          when v_first_state = 'AMBIGUOUS' then 'AMBIGUOUS_IN_WINDOW'
          when v_recovers is not null then 'GAP_RECOVERS_IN_WINDOW'
          else 'LAPSES_IN_WINDOW' end;
        v_row_ess := v_row_ess || jsonb_build_object(
          'code', v_code, 'owner_screen', v_owner ->> v_code, 'today_state', v_today_state,
          'first_issue_date', v_first, 'issue_state', v_first_state, 'recovers_on', v_recovers, 'classification', v_class);
      end if;
    end loop;

    if jsonb_array_length(v_row_ess) > 0 then
      v_flagged := v_flagged + 1;
      v_rows := v_rows || jsonb_build_object('sku_id', rec.sku_id, 'product_id', rec.product_id, 'essentials', v_row_ess, 'evaluated_dates', to_jsonb(v_dates));
      if v_flagged >= v_limit then exit; end if;
    end if;
  end loop;

  select exists (
    select 1 from public.product_skus s join public.products p on p.id = s.product_id
    where s.is_active and p.status = 'Active' and not coalesce(s.is_sample, false) and v_last is not null and s.id > v_last
  ) into v_more;

  return jsonb_build_object(
    'assessment_kind', 'OPERATIONAL_EXPIRY_HORIZON',
    'context', jsonb_build_object(
      'date_basis', 'CURRENT_IST_DATE',
      'evaluated_from', v_today, 'evaluated_through', v_end, 'horizon_days', v_days,
      'effective_to_semantics', 'INCLUSIVE (first uncovered day = effective_to + 1)',
      'governed_period_semantics_unchanged', true,
      'is_governed_period_valuation', false,
      'amounts_evaluated', false,
      'route_boundary_coverage', 'COMPLETE',
      'route_closure', 'SELECTOR_WINDOWS_PLUS_REAL_VALIDATOR (see proposal 02)'),
    'rows', v_rows,
    'statistics', jsonb_build_object('scanned_count', v_scanned, 'flagged_count', v_flagged, 'scan_cap', c_scan_cap, 'limit', v_limit, 'budget_exhausted', v_budget_hit),
    'has_more', coalesce(v_more, false),
    'next_after_sku_id', case when coalesce(v_more, false) then v_last else null end
  );
end
$fn$;

revoke all on function public.rpc_wp10_get_operational_expiry_horizon(integer, bigint, integer) from public, anon, authenticated, service_role;
grant execute on function public.rpc_wp10_get_operational_expiry_horizon(integer, bigint, integer) to authenticated;

-- RECEIPT (R5): stamps each created object with this file name and the md5 of its definition as created. 99_rollback_all.sql removes ONLY objects
-- whose receipt is present and whose definition still matches; anything changed or unowned makes the rollback fail closed without dropping anything.
do $wp10_receipt$
declare t text; v oid; r record;
begin
  foreach t in array array['public.rpc_wp10_get_operational_expiry_horizon(integer, bigint, integer)'] loop
    v := to_regprocedure(t);
    execute format('comment on function %s is %L', v::regprocedure, 'WP10-G2 03_operational_expiry_horizon_rpc.sql md5:' || md5(pg_get_functiondef(v)));
  end loop;
end $wp10_receipt$;
commit;
