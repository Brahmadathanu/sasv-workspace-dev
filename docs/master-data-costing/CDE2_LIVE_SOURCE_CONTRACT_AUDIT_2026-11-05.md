# CDE-2 protected draft-run component evidence — live source-contract audit
**Date:** 5 November 2026 · **Method:** read-only Supabase schema, privilege, index, run and bounded aggregate checks, reconciled to merged CDE-1a client provider contract.

**Status: SOURCE MAPPING AUDITED; RUN ELIGIBILITY AND OWNER POLICY DECISIONS STILL OPEN.** No RPC, migration, grants, client adapter or release is authorised or implemented. Formal Costing Suite work-pack closure **5/13 (38%)**.

This audit advances the existing [CDE-2 owner-review package](CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md) and [unified workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md). It is not a new work pack.

## Confirmed client contract
Merged CDE-1a module `public/shared/js/costing-draft-run-evidence.js` holds a **null** production evidence provider. It expects a provider method `readSkuEvidence({periodStart,runId,skuId})`, an envelope with `status: ok|empty|forbidden|stale|foreign-run|error` and, for `ok`, matching `record.period_start`, `record.refresh_run_id`, `record.sku_id`. The whitelist of safe fields includes `valuation_date`, `refreshed_at`, material/direct-labour/conversion/control statuses and a **regional object** keyed `IK` and `OK`. It never maps a missing value to READY. The UI disallows approved run-context for this draft component panel; **that client-side condition is not server authorisation**.

## Live field mapping: verified source columns, transformations still subject to test

| Client response field | Live costing source | Resolution |
|---|---|---|
| `period_start`, `refresh_run_id`, `sku_id`, `valuation_date` | All five sources checked | Require exact identity tuple; no latest-run substitution |
| `material_costing_status` | `sku_prime_cost_snapshot.material_costing_status` or `sku_costing_control_status_snapshot.material_costing_status` | Choose and pin one authoritative source, compare parity |
| `direct_labour_allocation_status` | `sku_direct_labour_allocation_snapshot.direct_labour_allocation_status` | Direct field |
| `allocation_reason_code`, `allocation_basis_status`, `allocation_resolution_status`, `allocation_resolution_note`, `direct_labour_component_model_code` | `sku_direct_labour_allocation_snapshot` | Direct fields |
| `internal_material_conversion_status` | `sku_prime_cost_snapshot.internal_material_conversion_status`; alternative conversion snapshot has `conversion_status` | Choose authoritative projection; no silent aliases |
| `first_control_status`, `control_severity` | `sku_costing_control_status_snapshot` | Direct fields |
| `blocker_note` | `sku_costing_control_status_snapshot.control_note` | **Explicit rename** `control_note AS blocker_note` only after confirming safe, non-monetary text contents; do not expose whole row or a freeform sensitive note |
| `refreshed_at` | `sku_prime_cost_snapshot.refreshed_at`, direct labour `refreshed_at`, regional `refreshed_at`; control source has `snapshot_refreshed_at` | Define run-frozen timestamp precedence and mismatch handling |
| `regional.IK/OK.regional_basis_source`, `regional_basis_status`, `marketing_expense_allocation_status`, `note` | `sku_regional_marketing_expense_allocation_snapshot` by `region_code` | Build **exact IK and OK object**, explicitly rename `regional_basis_note AS note`; require unique row for each permitted region, handle legitimately absent region as UNKNOWN |
 
**Security-critical:** Source tables also carry rates, costs, marketing sales values and other monetary data. An eventual RPC must select the *explicit text/identity-only whitelist* above. No `SELECT *`, whole-row JSONB or monetary/numeric value may be returned. Even apparently descriptive freeform text must be screened for embedded financial figures or identifiers before authorising release.

## Actual uniqueness and access controls

Live indexes:
- `sku_prime_cost_snapshot`: unique `(refresh_run_id,sku_id)` when run ID nonnull; legacy `(period_start,sku_id)` on null-run records.
- `sku_direct_labour_allocation_snapshot`: same run+SKU uniqueness.
- `sku_internal_material_conversion_snapshot`: unique `(refresh_run_id,sku_id)`.
- `sku_costing_control_status_snapshot`: unique `(period_start,valuation_date,refresh_run_id,sku_id)` when run ID nonnull.
- `sku_regional_marketing_expense_allocation_snapshot`: unique `(refresh_run_id,sku_id,region_code)`.

**Joins should still constrain run/period/valuation/SKU/region together** wherever present; do not weaken them merely because an index's key is shorter. Fail closed on inconsistent identity or missing required component, and do not mix `NULL`-run legacy snapshots with genuine governed runs.

Authenticated privilege metadata: `sku_prime_cost_snapshot` **no SELECT**; `sku_regional_marketing_expense_allocation_snapshot` **no SELECT**; `sku_costing_control_status_snapshot` **SELECT granted**, with an authenticated SELECT policy. Merely granting new direct access to the protected sources to support a client adapter is **not approved**. The proposed server projection needs explicit canonical `module:costing-control-center` view-permission enforcement and audited `anon/PUBLIC` EXECUTE revocation.

The proposed `public.rpc_get_costing_draft_component_evidence_v1` does **not exist** in production at this audit. No function was created.

## Bounded source-coverage evidence

For each of runs **148** (October 2026, valuation 2026-10-31) and **149** (November 2026, valuation 2026-11-02), the five source snapshot tables have:
- Prime Cost: 628 rows, 628 distinct SKUs.
- Direct Labour: 628, 628.
- Internal Conversion: 628, 628.
- Costing Control: 628, 628.
- Regional Marketing: 1256 rows, 628 distinct SKUs (two per SKU overall).

These aggregate counts do **not** prove every source has the exact same SKU set, region list, consistent valuation identity, correct content, or that any draft run is eligible to be read by a given user. Those require explicit per-run and per-SKU proof at the next implementation-test gate.

## Authorisation/eligibility remains a hard policy gate

Live `costing.costing_refresh_run`: run **143** October SUCCESS (approved separately), **148** October SUCCESS, **149** November SUCCESS, and **150** November **FAILED** (historical valuation cutoff; PM BOM effective-date issue). Do not infer that all SUCCESS rows are permitted draft evidence targets, or that run 149 should be considered approved; only the selected designation and server authorisation contract can determine visibility.

**Required owner/server decisions from CDE-2 package remain:**
1. **D1**: approve *principle only* of one non-monetary, CCC-view, run-scoped read RPC; deployment requires separate approval.
2. **D2**: explicit behaviour for approved runs, including whether to refuse and what outward status/error to use without information leakage.
3. **D3**: precise permitted run selection, period-open/closed rules, and immutability of retained successful snapshots after later refreshes; ensure no failed run 150 eligibility.
4. **D4**: whether and which frozen timestamp is displayed; recommendation to keep safe `refreshed_at` with defined precedence.
5. **D5**: audit/read throttling based on existing governance infrastructure, not an invented audit side table.

After those decisions: reviewed SQL/return type and permission plan; owner authorises migration; authenticated positive/negative tests; only then CDE-1b client adapter behind the existing flag. **No implementation or grant was applied by this audit.**

## Programme and release boundary

WP05/WP06/WP12 signed-in 11-flag tests require an authorised integrated preview build with exact source SHA and served bundle/cache evidence. Existing PR #160 Chromium/mock suite demonstrates 13 flag states × 6 pages (78 loads) under an inert backend, **not** genuine live-user acceptance. A passing CSR read retest on the existing PWA does not qualify as that integrated-build gate. Release remains blocked; formal closure **5/13 (38%)**.

Read-only investigation and docs only; no Supabase writes, application code, flag toggle, deployment, Electron release or rollback operation.
