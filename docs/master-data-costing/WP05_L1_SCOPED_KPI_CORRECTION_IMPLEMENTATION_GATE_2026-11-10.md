# WP05 L1 — Scoped run-pinned coverage KPI correction: implementation gate

**Prepared:** 10 November 2026. **State: DESIGN/ACCEPTANCE CONTRACT READY, IMPLEMENTATION NOT APPROVED.** This document is the concrete handoff for a narrow server + client correction; it is **not executable SQL** or an instruction to deploy. [Live run-143/149/151 evidence](WP05_R7_L1_FROZEN_SCHEME_COVERAGE_LIVE_READBACK_2026-11-10.md) establishes that the existing business KPI currently cross-joins **current-policy** counts to period-specific run rows. User remains final approver. WP05 OPEN, 6/13.

## Problem and verified target

Live `public.v_costing_pricing_business_kpi_summary` returned for **both** 2026-10 and 2026-11:
- Selling policy complete/missing **627/2**;
- Scheme policy complete/missing **601/28**.

These are live current-policy counts, not run-scoped. Current dashboard's denominator is scoped to historical selected run, therefore mixed-period coverage cards can misrepresent historical policy. The distinct frozen sources are:
- **Selling:** `costing.sku_selling_price_bridge_snapshot` (selected run, one SKU per row), `selling_price_policy_id`, `policy_resolution_status='RESOLVED'`.
- **Scheme:** `costing.sku_selected_scheme_policy_context_snapshot` (selected run, one IK + one OK row per SKU), two `resolution_status='RESOLVED_POLICY'`, not simply `scheme_id NOT NULL`.

| Acceptance context | Denominator SKU count | Historical selling-policy coverage | Historical *explicit bilateral* scheme policy coverage |
|---|---:|---:|---:|
| Oct 2026 APPROVED run **143**, valuation 2026-10-22 | 627 | **627/627** | **600/627** |
| Nov 2026 run **149**, valuation 2026-11-02 | 628 | **628/628** | **601/628** |
| Nov 2026 run **151**, valuation 2026-11-09 | 629 | **629/629** | **601/629** |

**Semantics:** a valid default/no-scheme record is not a resolved selected-scheme policy. Structural IK/OK row completeness is a separate metric (all SKUs in these runs). Selling-price bridge `READY` status is not a policy-coverage surrogate.

## Server design (review before writing SQL)

1. Baseline live view full DDL, owner and grants; verify `public.v_costing_pricing_business_kpi_summary` and `costing.v_current_successful_costing_refresh_run` definitions and dependent object/column contracts. Preserve existing output column names/types/grants and downstream consumers.
2. In the business KPI feed, form run-scoped `cur` with `period_start,valuation_date,refresh_run_id`. Aggregate selling from the exact `sku_selling_price_bridge_snapshot` matching all **three keys**; aggregate scheme from `sku_selected_scheme_policy_context_snapshot` grouped by SKU+run and regional statuses, counting only exact IK+OK `RESOLVED_POLICY`; denominator count from matching `sku_pricing_bridge_snapshot` distinct SKU IDs, not current overview count or snapshot row count.
3. Join policy counts by the exact run tuple; do not `CROSS JOIN` a single latest-policy count into all periods. Preserve `selling_policy_complete_count`, `selling_policy_missing_count`, `scheme_policy_complete_count`, `scheme_policy_missing_count` as run-frozen coverage if owner approves this interpretation, and ensure complete/missing partition the correct denominator.
4. Preserve all other costing/readiness, scheme risk, material/workbench, refresh and period context columns and run-selection logic. Never recompute historical runs or alter any snapshot.
5. If the business needs **current-as-of policy coverage**, provide a separately and clearly named readout; do not silently retain present current-as-of values under historical labels.
6. Prepared migration must include idempotent DDL diff, precondition definition fingerprint, exact SQL permission invariant and rollback plan. Apply to production **only** after owner authorization and isolated validation.

## Client compatibility

The existing `public/shared/js/costing-suite-control-center.js` uses the four KPI count fields in the Scheme/Selling coverage cards and colour state, taking the denominator from period/run-scoped cost controls. With server fields corrected to run-frozen semantics, retain card layout and existing labels only if supported; preferably use labels/tooltips explicitly saying **“at selected costing valuation/run”**. Audit both the dashboard card and drilldown/table row; do not change other S9 readiness and scheme-margin risk calculations.

## Isolated and live acceptance procedure

- Synthetic fixture with two historical runs of differing SKU populations and policy coverage, plus current-policy data intentionally different, to expose cross-period mixing.
- Assert all six complete/missing counts above for the three real known runs in a SELECT-only owner-provided verification (only *after* migration is authorised). Confirm `complete+missing=denominator` for each relevant measure/run.
- Verify historical Oct run **143** stays approved and the Nov feed follows the governed pointer by period; a selected explicit older run 149 is a historical test fixture only, not necessarily an active dashboard default.
- Confirm zero changes to persisted `costing` snapshots, pricing, scheme selections and approved run locks; UI screen 1280/390 no stale old-current numerator after period switch.
- Check 6-module read-only shared consumers do not break from output schema/permission changes; no additional feature flag, client cache bump or Electron release unless separately approved.
- Preserve old observed KPI mismatch as historical **F**, record new correction evidence separately; never rewrite earlier snapshots.
- A failed/untested run is **F/NT**, not claimed PASS. Stop on production write, unexpected RPC or history drift.

## Owner approval required, scoped exactly

**Q-L1-PATCH:** approve implementing *only* the run-scoped selling/explicit scheme coverage correction and its necessary compatibility UI wording, conditioned on isolated proof and production review. No blanket Costing Suite release, permission-grant change, historical recalculation, preview RPC or Electron rollout is implied.

Before approval: drafting and review only. Upon approval, server implementation/review first, Claude Code client compatibility only if actual view changes require it, with minimal token use and one consolidated review.

**No code, production, auth, flag or deployment changes performed by this design.**
