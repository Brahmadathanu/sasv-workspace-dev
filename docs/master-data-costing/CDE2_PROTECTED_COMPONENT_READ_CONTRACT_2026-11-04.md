# CDE-2 — Protected Single-SKU, Run-Scoped Costing Evidence Read Contract
Date: 4 November 2026. **PROPOSAL FOR OWNER REVIEW; no Supabase implementation authorised.**

## Grounded baseline and release scope
- Git main after A7 test-only PR #146: `195b13c4df32a5fdcf22ee304066e96c1b138481`. Worklist already offers run-scoped control statuses, but Cost Sheet detail is governed-run pinned. Do not change approved-run pricing contracts.
- In October draft run 148, 110 prime reviews trace to 109 direct-labour component-foundation reviews and one conversion-only review; Dhanyamlam SKU 41 has a region-OK review; SKU 105 has historical PM missing-required-rate blocker. Frozen run-specific evidence must remain distinct from current master.
- `public.v_costing_pricing_sku_control_status_by_run` has CCC-view permission and run-specific source filtering. `costing.sku_direct_labour_allocation_snapshot` is RLS+authenticated SELECT, `costing.sku_prime_cost_snapshot` is RLS with no authenticated SELECT, and `costing.sku_regional_marketing_expense_allocation_snapshot` has no RLS nor authenticated SELECT. These are not acceptable blanket browser reads.
- Live regional Marketing RPC `public.rpc_get_regional_marketing_evidence_review_queue` requires CCC view, but returns sensitive monetary amounts. Do not invoke it for a summary then hide those columns in the browser.

## Proposed service contract — exact meaning before SQL
Create ONE narrowly filtered, **read-only**, versioned API RPC (example name `public.rpc_get_costing_draft_component_evidence_v1`; name subject to contract review). Parameters: `p_period_start date`, `p_refresh_run_id bigint`, `p_sku_id bigint`. It returns either one record keyed by these values or an explicit no-data status. Do not rely on caller-provided output labels.

Server validates **all** of:
1. Authenticated identity with `public.require_permission('module:costing-control-center', false)` or equivalent audited view permission. Do not accept `service_role` bypass from browser.
2. Positive valid SKU/run and period. The run is an actual successful immutable costing refresh belonging to that period. The run must be **authorised for review** under the current run-picker semantics (e.g. approved, displayed or newer draft) and must not be arbitrary cross-period/historical evidence; exact selector needs verification against `v_costing_pricing_period_run_status` and the client run selector.
3. Exact source match across `period_start + refresh_run_id + valuation_date + sku_id`; joins must not use latest snapshot or omit the run dimension. Fail closed on absent/multiple/inconsistent source rows rather than silently returning a different run.
4. One-SKU limit, deterministic small result, bounded compute, no caller-supplied arbitrary `sku_ids[]` in v1; no SQL string concatenation or dynamic identifier. No mutation or acceptance side effects.
5. No monetary amounts, sales evidence figures, source-level PII, internal rates or unrelated records; projection happens in SQL before data crosses API boundary. Even errors must not reveal details of inaccessible runs.

### Minimal projection to validate against actual schema
`period_start, valuation_date, refresh_run_id, sku_id, product_name`; `first_control_status, control_severity`; `material_costing_status`; `direct_labour_allocation_status, allocation_reason_code, allocation_basis_status, allocation_resolution_status, allocation_resolution_note, direct_labour_component_model_code`; `internal_material_conversion_status`; per-region `region_code, regional_basis_source, regional_basis_status, marketing_expense_allocation_status, regional_basis_note`; optionally `pm_blocking_line_count` and exact server `control_note` from run-scoped control snapshot to explain SKU105 without deriving a cause from the client.

Use existing run/SKU snapshot keys. If any requested source is absent, return `UNKNOWN` for that component; do not map null to READY. Untrusted notes must be HTML-escaped in the client. A single JSON object with a bounded regions array is acceptable, but avoid an untyped arbitrary `jsonb` pass-through of whole rows.

## Implementation safety and test plan (pending separate owner permission)
- Inspect live columns, constraints, row uniqueness, existing RLS policy expressions and current data API exposure. Choose `SECURITY INVOKER` where it can safely read permitted projections; if internal tables require a `SECURITY DEFINER` RPC, lock `search_path`, use fully qualified names, require explicit permission, grant `EXECUTE` selectively and test denials under view-only, no-CCC and anonymous sessions.
- Verify correct one-SKU run 148 response for representative 52/32/25 labour cases, the conversion-only case, Dhanyamlam SKU41 IK/OK split, SKU105 PM blocker; compare 143 vs 148 independently to show no mixing. Test run 149 and invalid period/run mismatch, nonexistent SKU, arbitrary previous run ID, null inputs, forbidden role, wrong region and stale request.
- Verify `pg_get_functiondef` and effective grants after deployment, negative security tests with actual authenticated contexts, row counts and no additional monetary fields. Keep SQL migration/rollback evidence only after owner authorises the operation; no broad grant changes and no direct table access added.
- Expose only a minimal provider adapter for CDE-1b after live read-back passes. The CDE-1a mock-only panel remains safe/no-provider in production.
- Do not attach a write action to CDE-2. Regional review acceptance is separate, already existing `public.rpc_accept_regional_marketing_review`, with CCC edit permission and evidence-fingerprint eligibility; UI/write activation is distinct owner-approved CDE-3.

## Suggested review decision
Approve the principle of **one per-run, per-SKU, permission-checked, non-monetary read RPC** as a design only, then permit a separate implementation plan with live function definition, explicit return types, row-source joins, rollback/security checklist and role tests. No automatic deployment, flag switch, run approval or Electron release.
