# CDE-2 — protected draft-run component evidence read contract: owner-review package — 4 Nov 2026

**Status: PROPOSAL FOR OWNER REVIEW. Documentation only.** No SQL, RPC, grant, migration, provider adapter, flag, Supabase read or write is created or authorised by this file. It does not approve CDE-1b or CDE-3.

Baseline: `main` `18cee23`. The earlier proposal is draft PR #148 (`CDE2_PROTECTED_COMPONENT_READ_CONTRACT_2026-11-04.md`, not merged). This package keeps that proposal's security principles and **adds what #148 could not know**: the exact record shape the merged client (CDE-1a, #149, `public/shared/js/costing-draft-run-evidence.js`) already consumes. Where the two differ, §3 lists the reconciliation for the server owner. Nothing here is verified against live schema; column and table names are the client's and #148's, to be confirmed by the server session.

## 1. Why a server contract is needed
- The Review Worklist drawer (flag `COSTING_REVIEW_WORKLIST_V1`) shows run-scoped SKU control status, but the per-component causes of a draft-run review (direct-labour foundation, internal conversion, regional Marketing IK/OK, PM blocker) are not readable by the browser: `costing.sku_prime_cost_snapshot` has no authenticated SELECT, the regional allocation snapshot has no RLS and no SELECT, and the existing regional queue RPC returns monetary amounts.
- CDE-1a is merged and safe: with no provider connected it shows "Draft-run component evidence unavailable — provider not connected" and every component UNKNOWN. A provider must satisfy `readSkuEvidence({ periodStart, runId, skuId })`.

## 2. Contract (principles unchanged from #148)
One read-only, versioned RPC, one SKU per call, name for review: `public.rpc_get_costing_draft_component_evidence_v1(p_period_start date, p_refresh_run_id bigint, p_sku_id bigint)`.

Server must, before returning anything:
1. Require the audited CCC **view** permission (`module:costing-control-center`); no `service_role` path from the browser; `EXECUTE` granted to `authenticated` only, revoked from `anon`/`public`.
2. Validate that the run is a successful, immutable refresh run **of that period** and is one the run picker may offer (draft or newer than approved; selector to be confirmed against `v_costing_pricing_period_run_status`). Never "latest".
3. Join on `period_start + refresh_run_id + valuation_date + sku_id` everywhere; fail closed on absent, multiple or inconsistent rows.
4. Return **no monetary amount, rate, sales figure or PII**. Projection happens in SQL, not in the browser. No arbitrary `jsonb` pass-through of whole rows. No mutation, no acceptance side effect.
5. Error text must not reveal whether an inaccessible run/SKU exists.

## 3. Response shape the client expects, and open reconciliation
Envelope (client reads `answer.status`): `ok | empty | forbidden | stale | foreign-run | error`.

| Client field (`COMPONENT_FIELDS` / `REGION_FIELDS`) | In #148 projection? | Reconciliation for the server owner |
|---|---|---|
| `period_start`, `refresh_run_id`, `sku_id` (identity echo, compared as trimmed strings) | yes | **Mandatory.** A mismatch is shown as "foreign run" and the data discarded. |
| `valuation_date` | yes | keep |
| `refreshed_at` ("Frozen …" line) | **no** | add the run's frozen timestamp, or the client drops that line (owner choice) |
| `material_costing_status` | yes | keep |
| `direct_labour_allocation_status`, `allocation_reason_code`, `allocation_basis_status`, `allocation_resolution_status`, `allocation_resolution_note`, `direct_labour_component_model_code` | yes | keep; `allocation_reason_code` values the client labels today: `REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION`, `NO_SKU_SALES_IN_LOOKBACK`, `NO_PRODUCT_SALES_IN_LOOKBACK`; unknown codes render as raw code, never as READY |
| `internal_material_conversion_status` | yes | keep |
| `first_control_status`, `control_severity` | yes | keep |
| `blocker_note` | #148 calls it `control_note` (+ `pm_blocking_line_count`) | **pick one name.** Recommendation: `blocker_note`, server-authored text only (the SKU 105 PM-rate cause must come from the server, never be derived in the browser) |
| `regional` | #148: "bounded regions array" | **object keyed `IK` / `OK`** (fixed keys) is what the client reads; if the server prefers an array the client adapter must convert — decide before CDE-1b |
| per region: `regional_basis_source`, `regional_basis_status`, `marketing_expense_allocation_status`, `note` | yes (`regional_basis_note` in #148) | rename `regional_basis_note` → `note` or adapt; **no regional amounts** |
| `pm_blocking_line_count` | yes | client does not read it; drop unless a use is approved |

Anything absent must be `null`/omitted so the client shows UNKNOWN; **null is never mapped to READY**.

## 4. Decisions required from the owner
| ID | Decision | Recommendation |
|---|---|---|
| CDE2-D1 | Approve the *principle* of a single per-run, per-SKU, non-monetary, CCC-view read RPC (design only) | Approve; implementation needs a second, separate authorisation |
| CDE2-D2 | Behaviour for an **approved** run | Client never requests it (Cost Sheet is governed-run pinned). Server should return `foreign-run`/`empty`, not data, so the two surfaces cannot disagree |
| CDE2-D3 | Is the run-selector rule "draft or newer than approved" the right authorisation boundary, or must the server also restrict to the open period? | Server session to confirm against live run semantics, then owner decides |
| CDE2-D4 | Add `refreshed_at`, or drop the "Frozen" line | Add (non-sensitive) |
| CDE2-D5 | Rate limit / audit logging of reads | Log caller and (period, run, SKU) in the existing audit pattern if one exists; do not invent a new table |

## 5. Server-side test matrix (for the implementation plan, not run here)
Positive: run 148 representative SKUs — a 52-case direct-labour foundation review, a 32 `NO_SKU_SALES` and a 25 `NO_PRODUCT_SALES` case, the conversion-only review, Dhanyamlam SKU 41 (IK ready / OK review), SKU 105 PM blocker. Isolation: run 143 vs 148 vs 149 never mixed; period/run mismatch; run of another period; approved run; non-existent SKU. Inputs: null/negative/oversized ids. Security: anonymous, authenticated without CCC, CCC view-only (allowed), CCC edit (allowed, no write side effect); `pg_get_functiondef`, effective grants and `search_path` read back; response contains no numeric money field (column whitelist test). Rollback: `DROP FUNCTION` of the single new function is the complete rollback.

## 6. After approval (order, each separately gated)
1. Server session: live schema read-back and a written implementation plan (function body, return type, grants, rollback) → owner review.
2. Owner authorises the migration; server session applies and verifies with real role contexts.
3. **CDE-1b** (client): a thin provider adapter that calls only this RPC, maps the envelope above, and is connected behind `COSTING_REVIEW_WORKLIST_V1`; client tests with the injected mock stay; no fixture data in production.
4. **CDE-3** (regional review acceptance UI, using the existing `rpc_accept_regional_marketing_review`) is a separate owner decision and is **not** part of CDE-2.

## 7. Explicitly out of scope
No change to approved-run pricing or the Cost Sheet; no new table; no direct browser access to `costing.*`; no run approval, no acceptance write, no flag activation, deployment, cache bump, Electron version or release.
