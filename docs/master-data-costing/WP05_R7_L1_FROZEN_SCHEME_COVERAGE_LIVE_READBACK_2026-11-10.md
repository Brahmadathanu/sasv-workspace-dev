# WP05 R7 — L1 frozen selected-scheme coverage: live SELECT-only evidence

**Observed:** 10 November 2026. **Status: LIVE DATA/CATALOGUE PROOF, NOT YET OWNER-APPROVED KPI CHANGE.** Supabase project `qhmoqtxpeasamtlxaoak`. No DML, migrations, preview/RPC invocation, authenticated impersonation, application change or deployment. WP05 OPEN; programme **6/13**.

## Question

The existing Costing Suite **current** policy manager overview counts `scheme_policy_complete_count` from non-NULL `ik_selected_scheme_id AND ok_selected_scheme_id`. CLD3 identified an alternative **run-frozen** source `costing.sku_selected_scheme_policy_context_snapshot` with a *non-NULL* `scheme_id` even when `resolution_status='DEFAULT_NO_SCHEME'`. What definition can represent historical policy coverage without conflating structural completeness and an explicitly resolved policy?

[Earlier source trace](WP05_CLD3_STATIC_TRACE_2026-11-09.md) proposed candidate **S-A** (both regions RESOLVED_POLICY), **S-B** (both RESOLVED_POLICY or DEFAULT_NO_SCHEME), and **S-C** (both rows exist). This record executed the previously proposed read-only per-run aggregate and a row-grain cross-check.

## Live result: frozen selected-scheme status

| Run | Period / valuation | Distinct SKUs | Exactly one IK + OK per SKU | Both RESOLVED_POLICY (S-A) | Both DEFAULT_NO_SCHEME | Other mixed/blocked observed |
|---|---|---:|---:|---:|---:|---:|
| **143** | 2026-10-01 / 2026-10-22 | **627** | 627 | **600** | 27 | 0 |
| **149** | 2026-11-01 / 2026-11-02 | **628** | 628 | **601** | 27 | 0 |
| **151** | 2026-11-01 / 2026-11-09 | **629** | 629 | **601** | 28 | 0 |

Distribution checked by actual `refresh_run_id,region_code,resolution_status` aggregates: each run has bilateral symmetric statuses in these three instances. No `scheme_id IS NULL` rows in any IK/OK region. Thus `scheme_id IS NOT NULL` over snapshot is **not a policy-coverage measure**: it would call all 629 run-151 SKUs covered despite 28 bilateral default/no-scheme SKUs.

**Strong current-run validation:** Live `public.v_costing_policy_manager_sku_overview` has **629** SKUs, **601** both non-NULL and **28** missing. Joined all 629 IDs to frozen run 151 and compared boolean bilateral `RESOLVED_POLICY` with current `ik_selected_scheme_id IS NOT NULL AND ok_selected_scheme_id IS NOT NULL`: **629 matched / 0 mismatched; zero bad bilateral row cardinalities**. This establishes S-A as matching the present current-overview *classification* on this verified run and date; it does **not** prove S-A will always equal live current selection when policies are edited after refresh.

### Live table contract

The live snapshot has non-NULL columns `valuation_date`, `refresh_run_id`, `sku_id`, `region_code`, `scheme_id` and `resolution_status`. `selected_scheme_context_resolution_chk` accepts exactly **RESOLVED_POLICY, DEFAULT_NO_SCHEME, BLOCKED**. The `resolution_lineage_chk` enforces resolution-specific lineage, and unique constraint `uq_selected_scheme_context_run_sku_region` guarantees at most one row per run/SKU/region. The per-run full bilateral coverage above establishes the *observed* existence of both rows for these runs, even for run 143.

Catalogue-only object fingerprints at the time of readback:
- `costing.v_costing_policy_manager_sku_overview`: `md5(pg_get_viewdef(oid,true))=ded6fe135fe9d2cf32022230f30f3fd2`
- `costing.v_sku_selected_scheme_policy`: `9778d7d497e58a850cc046cdd4848d5f`
- `costing.rpc_refresh_sku_selected_scheme_policy_context_snapshot(date,date,bigint)`: `md5(pg_get_functiondef(oid))=ea9949960ed388fafee4bdc40f6999cc`

Function body was not invoked. Different hash formats (pretty-print view hash versus earlier evidence hash) must not automatically be called definition drift.

## Suggested owner decision — L1-S-A

**Recommended:** Define a distinct historical **“Both-region explicitly resolved scheme policy at valuation”** KPI for one precise `(period_start,valuation_date,refresh_run_id)` as:

`COUNT(DISTINCT sku_id)` having exactly one `IK` and one `OK` row **and both** `resolution_status='RESOLVED_POLICY'`, divided by count of distinct SKUs in that same run's pricing-bridge population. Name separately:
- **Scheme-policy coverage (resolved):** S-A bilateral RESOLVED_POLICY; 600/627, 601/628 and 601/629 in the three checked runs.
- **Regional policy-context snapshot completeness:** exactly one IK and one OK row per SKU, *regardless* of default/resolved/blocked: 627/627, 628/628 and 629/629 for these runs.
- **Default/no scheme:** explain separately, never group with `BLOCKED` without evidence. For these three runs, 27, 27, 28 SKUs respectively were bilateral default/no scheme.

**Implementation is NOT approved:** Do not replace the existing current-as-of overview KPI or the numerator's denominator without reviewing how actual UI modules label period/run and where `sku_selected_scheme_policy_context_snapshot` is joined. Owner must decide whether historical run-frozen coverage is displayed separately, and whether business language treats DEFAULT_NO_SCHEME as expected policy fallback rather than a remediation defect. A migration/client change would require a specifically authorised and tested plan.

## Current WP05 gate effect

This resolves the main **L1 data-semantics ambiguity** using live run 143/149/151 evidence and a zero-mismatch run-151 comparison. It **does not certify** current policy manager UI, fix its label, prove a new historical KPI is implemented, close all W5-08, change AE1 40-lens status, or increment programme completion. The existing [R4 consolidated owner checkpoint](WP05_R4_CONSOLIDATED_OWNER_DECISION_CHECKPOINT_2026-11-10.md) and [post-B1 gate ledger](WP05_B1_RETAINED_GATE_EXECUTION_LEDGER_2026-11-10.md) remain the approval authorities.

## UI impact and concrete acceptance expectation (same day follow-up)

Current `public/shared/js/costing-suite-control-center.js` renders the business feed's `scheme_policy_complete_count` and `scheme_policy_missing_count` into the **Scheme Policy Coverage** card, colours it from missing-count, and combines a period/run-scoped `control.total_sku_count` denominator with that feed. The earlier [CLD1 L1 design trace](WP05_CLD1_L1_KPI_CORRECTION_DESIGN_2026-11-08.md) shows that the business numerator comes from a **current-as-of** selected-scheme projection, and is CROSS JOINed to dashboard rows scoped to a historical run/period. Therefore the old run-mixing bug is real **at source-contract level**, even though the current Nov run-151 **601/629** happens to agree with frozen S-A. The current result does NOT validate the historical October card merely because the totals are plausible.

For **a future, explicitly authorised run-frozen scheme coverage implementation**, acceptance expected values from actual snapshot evidence are: **run 143 = 600/627**, **run 149 = 601/628**, **run 151 = 601/629**. A current-as-of-only KPI may continue to be offered separately if labelled as such, but it must not be pasted over run-specific denominator and presented as historical coverage. The separate Selling Policy Coverage numerator has a similar run-scoping issue, **not solved by S-A**; a complete L1 fix must investigate selling price policy's historical source independently rather than silently assume selected-scheme snapshot solves both.

No application or database correction was made. A server-side feed and any UI labelling changes need a design review, approved migration, and isolated positive historical/current-run test matrix.
