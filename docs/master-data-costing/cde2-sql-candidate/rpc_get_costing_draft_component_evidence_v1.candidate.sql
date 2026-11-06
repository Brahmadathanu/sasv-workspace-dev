-- ============================================================================================================
-- CDE-2 CANDIDATE (UNAPPLIED, NOT A MIGRATION). Supersedes the proposal in CDE2_RPC_PROPOSED_SQL_FOR_SERVER_REVIEW_2026-11-06.md.
-- Lives outside supabase/migrations/ on purpose. Validated only against an ISOLATED PostgreSQL 16 with a stub schema
-- (see ./test). Never executed against production. Every "[VERIFY]" is an assumption to be read back from the live schema.
--
-- D3 (which runs may be read) is UNRESOLVED, so the owner gate below is FALSE: as written EVERY call returns the single
-- denial envelope. Flipping that one line is a separate, owner-authorised act and is not part of this candidate.
-- ============================================================================================================
create or replace function public.rpc_get_costing_draft_component_evidence_v1(
  p_period_start date,
  p_refresh_run_id bigint,
  p_sku_id bigint)
returns jsonb
language plpgsql
stable                                     -- read-only by construction: any write attempt errors (and is swallowed into the denial envelope)
security definer
set search_path = pg_catalog, pg_temp      -- every object below is schema-qualified
as $fn$
declare
  -- ONE outward answer for: unauthorised, malformed input, missing run, wrong-period run, approved/reference/revoked run, failed run,
  -- non-selected run, closed period, missing SKU, missing/duplicate/inconsistent source rows and any internal error.
  v_deny   constant jsonb := '{"status":"empty"}'::jsonb;
  v_code   constant text  := '^[A-Z][A-Z0-9_]{0,79}$';   -- machine codes only; anything else is returned as null (UNKNOWN), never as text
  v_d3_decided boolean := false;                          -- D3 OWNER GATE. Must stay false until the owner decides D3 and a migration is separately authorised.
  v_run record; v_n int;
  v_prime record; v_ctl record; v_dl record; v_conv record; v_ik record; v_ok record;
begin
  begin
    -- 1. CCC VIEW permission. Live signature is (p_target text, p_need_edit boolean); false = view only. It raises when denied: caught below.
    perform public.require_permission('module:costing-control-center', false);

    -- 2. Input shape. Same envelope as every other refusal: no malformed-vs-missing oracle.
    if p_period_start is null or p_refresh_run_id is null or p_sku_id is null
       or p_refresh_run_id <= 0 or p_sku_id <= 0
       or p_period_start <> date_trunc('month', p_period_start)::date then
      return v_deny;
    end if;

    -- 3. Run identity: the run table key is "id" (not refresh_run_id). Exact (id, period_start); never "latest" substitution.
    select r.id, r.period_start, r.valuation_date, r.finished_at into v_run
      from costing.costing_refresh_run r
     where r.id = p_refresh_run_id
       and r.period_start = p_period_start
       and r.overall_status = 'SUCCESS'
       and r.valuation_context_source = 'CAPTURED_AT_REQUEST'
       and r.finished_at is not null
       and r.valuation_date is not null;
    if not found then return v_deny; end if;

    -- 4. Structural eligibility (necessary, NOT sufficient: see D3).
    --    a) not an APPROVED / REFERENCE / REVOKED run (the draft evidence RPC never serves an approved run: D2)
    if exists (select 1 from costing.v_costing_run_effective_designation e
                where e.refresh_run_id = v_run.id and e.designation in ('APPROVED', 'REFERENCE', 'REVOKED')) then
      return v_deny;
    end if;
    --    b) period is OPEN
    if not exists (select 1 from costing.cost_periods cp where cp.period_start = v_run.period_start and cp.status = 'OPEN') then
      return v_deny;
    end if;
    --    c) the run is the draft the governed period status currently surfaces for review (latest successful run of the period).
    --       NOTE: this alone also admits retained old drafts such as 80/82 while their periods are OPEN. Excluding them is part of D3.
    if not exists (select 1 from costing.v_costing_period_run_status s
                    where s.period_start = v_run.period_start and s.latest_success_run_id = v_run.id) then
      return v_deny;
    end if;
    --    d) OWNER GATE
    if not v_d3_decided then return v_deny; end if;

    -- 5. Sources. Every join uses the complete identity (period_start, valuation_date, refresh_run_id, sku_id[, region_code]) and must match
    --    EXACTLY ONE row (zero or many => deny). Explicit column lists only. [VERIFY] all five tables expose period_start and valuation_date.
    select count(*) into v_n from costing.sku_prime_cost_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id;
    if v_n <> 1 then return v_deny; end if;
    select t.material_costing_status, t.internal_material_conversion_status, t.refreshed_at into v_prime from costing.sku_prime_cost_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id;

    select count(*) into v_n from costing.sku_costing_control_status_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id;
    if v_n <> 1 then return v_deny; end if;
    select t.first_control_status, t.control_severity, t.material_costing_status, t.snapshot_refreshed_at into v_ctl from costing.sku_costing_control_status_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id;

    select count(*) into v_n from costing.sku_direct_labour_allocation_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id;
    if v_n <> 1 then return v_deny; end if;
    select t.direct_labour_allocation_status, t.allocation_reason_code, t.allocation_basis_status, t.allocation_resolution_status,
           t.direct_labour_component_model_code, t.refreshed_at into v_dl from costing.sku_direct_labour_allocation_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id;

    select count(*) into v_n from costing.sku_internal_material_conversion_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id;
    if v_n <> 1 then return v_deny; end if;
    select t.conversion_status into v_conv from costing.sku_internal_material_conversion_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id;

    -- Regional: exactly one IK row and exactly one OK row, nothing else required. Absence of either => deny (v1 does not map a missing region to UNKNOWN).
    select count(*) into v_n from costing.sku_regional_marketing_expense_allocation_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id and t.region_code = 'IK';
    if v_n <> 1 then return v_deny; end if;
    select count(*) into v_n from costing.sku_regional_marketing_expense_allocation_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id and t.region_code = 'OK';
    if v_n <> 1 then return v_deny; end if;
    select t.regional_basis_source, t.regional_basis_status, t.marketing_expense_allocation_status, t.refreshed_at into v_ik from costing.sku_regional_marketing_expense_allocation_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id and t.region_code = 'IK';
    select t.regional_basis_source, t.regional_basis_status, t.marketing_expense_allocation_status, t.refreshed_at into v_ok from costing.sku_regional_marketing_expense_allocation_snapshot t
     where t.period_start = v_run.period_start and t.valuation_date = v_run.valuation_date and t.refresh_run_id = v_run.id and t.sku_id = p_sku_id and t.region_code = 'OK';

    -- 6. Cross-source parity: disagreement fails closed (never prefer one source).
    if v_prime.material_costing_status is distinct from v_ctl.material_costing_status then return v_deny; end if;
    if v_prime.internal_material_conversion_status is distinct from v_conv.conversion_status then return v_deny; end if;

    -- 7. Integrity defence-in-depth (NOT proof of immutability; see the audit): every stage timestamp must precede the run's frozen finish time.
    --    A row rewritten after the run finished is refused. [VERIFY] holds for all rows of every eligible run before relying on it.
    if v_prime.refreshed_at > v_run.finished_at or v_ctl.snapshot_refreshed_at > v_run.finished_at or v_dl.refreshed_at > v_run.finished_at
       or v_ik.refreshed_at > v_run.finished_at or v_ok.refreshed_at > v_run.finished_at then
      return v_deny;
    end if;

    -- 8. Projection in SQL. Whitelist; no select *, no row_to_json/to_jsonb of a row, no amounts. Free-text notes are NOT returned (null).
    --    Status/code fields pass only if they look like machine codes, otherwise null (UNKNOWN).
    return jsonb_build_object('status', 'ok', 'record', jsonb_build_object(
      'period_start', to_char(v_run.period_start, 'YYYY-MM-DD'),
      'refresh_run_id', v_run.id,
      'sku_id', p_sku_id,
      'valuation_date', to_char(v_run.valuation_date, 'YYYY-MM-DD'),
      'refreshed_at', to_char(v_run.finished_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),     -- D4: the run's frozen finish time, not a stage time
      'material_costing_status',               case when v_prime.material_costing_status ~ v_code then v_prime.material_costing_status end,
      'direct_labour_allocation_status',       case when v_dl.direct_labour_allocation_status ~ v_code then v_dl.direct_labour_allocation_status end,
      'allocation_reason_code',                case when v_dl.allocation_reason_code ~ v_code then v_dl.allocation_reason_code end,
      'allocation_basis_status',               case when v_dl.allocation_basis_status ~ v_code then v_dl.allocation_basis_status end,
      'allocation_resolution_status',          case when v_dl.allocation_resolution_status ~ v_code then v_dl.allocation_resolution_status end,
      'allocation_resolution_note',            null,
      'direct_labour_component_model_code',    case when v_dl.direct_labour_component_model_code ~ v_code then v_dl.direct_labour_component_model_code end,
      'internal_material_conversion_status',   case when v_prime.internal_material_conversion_status ~ v_code then v_prime.internal_material_conversion_status end,
      'first_control_status',                  case when v_ctl.first_control_status ~ v_code then v_ctl.first_control_status end,
      'control_severity',                      case when v_ctl.control_severity ~ v_code then v_ctl.control_severity end,
      'blocker_note',                          null,
      'regional', jsonb_build_object(
        'IK', jsonb_build_object('regional_basis_source', case when v_ik.regional_basis_source ~ v_code then v_ik.regional_basis_source end,
                                 'regional_basis_status', case when v_ik.regional_basis_status ~ v_code then v_ik.regional_basis_status end,
                                 'marketing_expense_allocation_status', case when v_ik.marketing_expense_allocation_status ~ v_code then v_ik.marketing_expense_allocation_status end,
                                 'note', null),
        'OK', jsonb_build_object('regional_basis_source', case when v_ok.regional_basis_source ~ v_code then v_ok.regional_basis_source end,
                                 'regional_basis_status', case when v_ok.regional_basis_status ~ v_code then v_ok.regional_basis_status end,
                                 'marketing_expense_allocation_status', case when v_ok.marketing_expense_allocation_status ~ v_code then v_ok.marketing_expense_allocation_status end,
                                 'note', null))));
  exception when others then
    return v_deny;      -- never leak sqlerrm or an error class (permission failure, bad cast, missing object, ...)
  end;
end
$fn$;

revoke all on function public.rpc_get_costing_draft_component_evidence_v1(date, bigint, bigint) from public;
revoke all on function public.rpc_get_costing_draft_component_evidence_v1(date, bigint, bigint) from anon;
grant execute on function public.rpc_get_costing_draft_component_evidence_v1(date, bigint, bigint) to authenticated;
-- No table grants, no policy, no trigger, no other object is created or altered by this file.
-- Rollback (complete): drop function public.rpc_get_costing_draft_component_evidence_v1(date, bigint, bigint);
