# CDE-2 — proposed SQL for server-session review (PROPOSAL ONLY) — 6 Nov 2026

**Not a migration. Not in `supabase/migrations/`. Not compiled, not executed, not applied, no grants.** Production Supabase is untouched. This is a reviewable draft that turns the [owner package](CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md) §3 and the 5 Nov [live source audit](CDE2_LIVE_SOURCE_CONTRACT_AUDIT_2026-11-05.md) into concrete SQL, so the server session has something specific to read back, correct and test. Client counterpart (unconnected): `public/shared/js/costing-draft-run-evidence-provider.js` (CDE-1b adapter, draft PR).

## Built-in safety property
Eligibility (decision **D3**) is **not decided**, so the draft hard-codes `v_eligible := false`. If applied as written the function can only answer `forbidden`; it cannot disclose anything until the owner decides D3 and the server session replaces that one line and proves it. Nothing below is verified against the live schema beyond the column list in the 5 Nov audit.

## Draft
```sql
-- PROPOSAL ONLY. VERIFY every item marked [VERIFY] against live schema before any use.
create or replace function public.rpc_get_costing_draft_component_evidence_v1(
  p_period_start date, p_refresh_run_id bigint, p_sku_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, costing          -- [VERIFY] match the repo's SECURITY DEFINER convention
as $$
declare
  v_eligible boolean := false;   -- D2/D3 OWNER DECISION. Until decided this stays false => only 'forbidden' can be returned.
  v_run      costing.costing_refresh_run%rowtype;
  v_ctl      costing.sku_costing_control_status_snapshot%rowtype;
  v_dl       costing.sku_direct_labour_allocation_snapshot%rowtype;
  v_prime    costing.sku_prime_cost_snapshot%rowtype;
  v_conv     costing.sku_internal_material_conversion_snapshot%rowtype;
  v_ik jsonb; v_ok jsonb;
begin
  -- 1. Permission: canonical CCC VIEW. [VERIFY] the exact helper name/signature (the 5 Nov audit only says live require_permission checks can_view).
  perform public.require_permission('module:costing-control-center', 'view');

  -- 2. Argument sanity. Same envelope for every refusal so existence of a run/SKU is not disclosed.
  if p_period_start is null or p_refresh_run_id is null or p_sku_id is null
     or p_refresh_run_id <= 0 or p_sku_id <= 0
     or p_period_start <> date_trunc('month', p_period_start)::date then
    return jsonb_build_object('status', 'empty');
  end if;

  -- 3. Run identity, exact. Never substitute "latest". [VERIFY] column names on costing_refresh_run.
  select * into v_run from costing.costing_refresh_run
   where refresh_run_id = p_refresh_run_id and period_start = p_period_start;
  if not found then return jsonb_build_object('status', 'empty'); end if;

  -- 4. Eligibility (D2 approved-run behaviour, D3 which statuses/periods, FAILED run 150 must never qualify).
  --    v_eligible := <predicate decided by owner>;   -- intentionally NOT implemented in this proposal
  if not v_eligible then return jsonb_build_object('status', 'forbidden'); end if;

  -- 5. Sources, each joined on the FULL identity actually present in that table (uniqueness per the 5 Nov audit).
  select * into v_ctl   from costing.sku_costing_control_status_snapshot
   where period_start = p_period_start and refresh_run_id = p_refresh_run_id and valuation_date = v_run.valuation_date and sku_id = p_sku_id;
  select * into v_dl    from costing.sku_direct_labour_allocation_snapshot  where refresh_run_id = p_refresh_run_id and sku_id = p_sku_id;
  select * into v_prime from costing.sku_prime_cost_snapshot                where refresh_run_id = p_refresh_run_id and sku_id = p_sku_id;
  select * into v_conv  from costing.sku_internal_material_conversion_snapshot where refresh_run_id = p_refresh_run_id and sku_id = p_sku_id;
  -- Fail closed on any missing required source (never partial-as-READY): the client shows missing as UNKNOWN.
  if v_ctl.sku_id is null or v_dl.sku_id is null or v_prime.sku_id is null or v_conv.sku_id is null then
    return jsonb_build_object('status', 'empty');
  end if;

  -- 6. Regional: exactly one row per permitted region, TEXT COLUMNS ONLY (no amounts). Absent region => key omitted => UNKNOWN.
  select jsonb_build_object('regional_basis_source', regional_basis_source, 'regional_basis_status', regional_basis_status,
                            'marketing_expense_allocation_status', marketing_expense_allocation_status, 'note', regional_basis_note)
    into v_ik from costing.sku_regional_marketing_expense_allocation_snapshot
   where refresh_run_id = p_refresh_run_id and sku_id = p_sku_id and region_code = 'IK';
  select jsonb_build_object('regional_basis_source', regional_basis_source, 'regional_basis_status', regional_basis_status,
                            'marketing_expense_allocation_status', marketing_expense_allocation_status, 'note', regional_basis_note)
    into v_ok from costing.sku_regional_marketing_expense_allocation_snapshot
   where refresh_run_id = p_refresh_run_id and sku_id = p_sku_id and region_code = 'OK';

  -- 7. Projection IN SQL. Explicit whitelist; no row_to_json, no SELECT * passthrough, no numeric except identity.
  return jsonb_build_object('status', 'ok', 'record', jsonb_build_object(
    'period_start', p_period_start, 'refresh_run_id', p_refresh_run_id, 'sku_id', p_sku_id,
    'valuation_date', v_run.valuation_date,
    'refreshed_at', v_prime.refreshed_at,                                   -- D4: precedence to be decided
    'material_costing_status', v_prime.material_costing_status,             -- [VERIFY] authoritative source vs control snapshot
    'direct_labour_allocation_status', v_dl.direct_labour_allocation_status,
    'allocation_reason_code', v_dl.allocation_reason_code,
    'allocation_basis_status', v_dl.allocation_basis_status,
    'allocation_resolution_status', v_dl.allocation_resolution_status,
    'allocation_resolution_note', v_dl.allocation_resolution_note,          -- [VERIFY] screen free text for embedded figures
    'direct_labour_component_model_code', v_dl.direct_labour_component_model_code,
    'internal_material_conversion_status', v_prime.internal_material_conversion_status,
    'first_control_status', v_ctl.first_control_status,
    'control_severity', v_ctl.control_severity,
    'blocker_note', v_ctl.control_note,                                     -- [VERIFY] free text must be non-monetary
    'regional', jsonb_strip_nulls(jsonb_build_object('IK', v_ik, 'OK', v_ok))));
end $$;

revoke all on function public.rpc_get_costing_draft_component_evidence_v1(date, bigint, bigint) from public, anon;
grant execute on function public.rpc_get_costing_draft_component_evidence_v1(date, bigint, bigint) to authenticated;
-- Rollback (complete): drop function public.rpc_get_costing_draft_component_evidence_v1(date, bigint, bigint);
```

## Known gaps a reviewer must close (none are resolved here)
1. D1–D5 owner decisions (D3 is the one that gates any positive answer).
2. [VERIFY] markers: permission helper signature, `costing_refresh_run` column names, which table is authoritative for `material_costing_status` and `internal_material_conversion_status`, free-text columns (`control_note`, `allocation_resolution_note`, `regional_basis_note`) screened for embedded monetary figures.
3. The client rejects an answer containing any numeric value except `refresh_run_id` and `sku_id`, any key containing amount/rate/price/cost/sales/etc., so SQL must not add such fields. A `valuation_date`/`refreshed_at` is serialised as text by jsonb; confirm.
4. Fail-closed inside the function should use the repo's SECURITY DEFINER hardening pattern, including a source-hash guard if that is the repo convention (SEC-A1/A2 precedent).
5. Server test matrix: owner package §5 (isolation of runs 143/148/149, 80/82, role matrix, grants/`search_path` read-back, no money field).

## What this does not do
No migration, grant, deployment, flag, client wiring or acceptance. CDE-1b stays unconnected; formal closure remains 5/13.
