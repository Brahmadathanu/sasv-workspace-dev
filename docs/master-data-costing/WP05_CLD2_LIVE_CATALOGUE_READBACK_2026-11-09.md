# WP05-CLD2 — Live catalogue and frozen-run readback (9 November 2026)

**Status: SELECT-ONLY LIVE EVIDENCE / NO IMPLEMENTATION / NO OWNER CLOSURE.** WP05 OPEN; programme **6/13**. Source: connected SASV Supabase project `qhmoqtxpeasamtlxaoak`, read-only metadata and bounded aggregates on 9 November 2026 IST. No RPC executed, no write, schema alteration, auth/session/permission mutation, preview, app change or deploy. Does not constitute negative-identity behavioural acceptance. Issue #234, follows merged CLD1 PR #242 and PAR1 PR #240.

## 1. L1 active view and run populations

Live `pg_get_viewdef('public.v_costing_pricing_business_kpi_summary')` confirms both the current `v_costing_policy_manager_sku_overview` source and `CROSS JOIN policy`, exactly the historical population-scope problem diagnosed in CLD1. Definition fingerprint **MD5 `9a664a3f1dbb536289209d58f46ad33a`**, length 7,943. This is **LIVE_CONFIRMED**, not just migration evidence.

Actual live frozen snapshots contain columns `period_start`, `valuation_date`, `refresh_run_id`, `sku_id`; the selling bridge additionally has `selling_price_policy_id`, `policy_resolution_status`; the scheme viability snapshot contains `scheme_id`, `scheme_context_source`, `scheme_is_system_defined` and `selling_price_policy_id` but **does not have historical per-SKU IK/OK *selected* scheme identifiers directly comparable to the policy overview's `ik_selected_scheme_id` and `ok_selected_scheme_id`**. Presence of a generic scheme ID in a per-scheme row **cannot** be equated to bilateral policy selection.

| Frozen context | Pricing rows / distinct SKUs | Selling rows / distinct SKUs | Scheme rows / distinct SKUs |
|---|---:|---:|---:|
| Oct period, approved run **143**, valuation **2026-10-22** | 627 / 627 | 627 / 627 | 3,762 / 627 |
| Nov period, draft run **149**, valuation **2026-11-02** (historical PAR1 test) | 628 / 628 | 628 / 628 | 3,768 / 628 |
| Nov period, new current-successful run **151**, valuation **2026-11-09** | 629 / 629 | 629 / 629 | 4,403 / 629 |

Selling bridge `policy_resolution_status='RESOLVED'` and non-null `selling_price_policy_id` for **all 627 run-143** and **all 628 run-149** rows. These support a run-scoped *selling-policy* signal, but the owner must confirm desired historical coverage semantics; do not infer scheme policy completion from the 6+ scheme rows/SKU. Run-151 selling-status count was not separately audited.

**Critical freshness distinction:** `costing.v_current_successful_costing_refresh_run` now selects **Nov run 151 / valuation 2026-11-09**, while Oct still selects **run 143**. PAR1's Nov run **149** and its 121/506/1 numbers were valid observations at that time, not today's latest-run claim. No sign-off on run 151 or its approval state is implied; merely selected by the *current successful* view.

Live business-KPI read at the inspection time:

| KPI period | Total pricing SKUs | Current-projection selling complete / missing | Current-projection scheme complete / missing |
|---|---:|---:|---:|
| Oct | 627 | **627 / 2** | **601 / 28** |
| Nov | 629 | **627 / 2** | **601 / 28** |

Both periods carry identical policy counts, confirming L1 is still active; the policy population currently totals **629** (627+2 and 601+28). Therefore, a visually non-exceeding historical ratio (e.g. 627/627 today) **does not fix the scope defect**. These figures differ from the 8 Nov PAR1 observation (628/627): a current-state policy projection is a moving numerator. These are *display KPI counts*, not profitability calculations.

## 2. Workbench summary run-key sanity check

The live `public.v_costing_pricing_review_workbench_summary_snapshot` exposes `period_start`, `valuation_date`, `refresh_run_id`. Bounded aggregate shows October **14 rows, one run 143 / valuation 22 Oct**; November **16 rows, one run 151 / valuation 9 Nov**. Therefore no multi-run mixing was observed **for those two periods at read time**. CLD1's `period_start`-only join remains potentially unsafe if the underlying view ever carries several runs per period; that is a conditional design concern, **not an observed defect**.

## 3. Live RPC/permission catalogue (NO RPC CALLS)

- `public.rpc_preview_route_family_route_steps(bigint,date,date)`: live body is a `VOLATILE SECURITY DEFINER` wrapper that first calls `public.require_permission('module:production-route-manager', false)` and returns `costing.fn_preview_route_family_route_steps(...)`. **Live wrapper existence, arguments and view-level permission gate confirmed**. The internal callee graph and side effects have not been fully certified: **F1 NOT YET ALLOWLIST-APPROVED**.
- Other candidate preview wrappers, direct-labour shadow preview and workload preview RPCs are present in live `pg_proc`, commonly `SECURITY DEFINER` and some `VOLATILE`. A pattern match against source terms is not a no-side-effect proof. **No preview or `rpc_get_*` called.** Keep safety classifications in CLD1 until complete dependency trace.
- `public.require_permission(text,boolean)` live definition checks non-null `auth.uid()`, exact row of `public.user_permissions_canonical`, `can_view=true`, and `can_edit=true` when requested. `public.fn_costing_view_allowed()` allows postgres/service role or a view grant in any of CCC, CBM, CSR or MCM. Thus cross-module view breadth is **LIVE_CONFIRMED** at the helper level; the TB2 migration documents **49** newly gated views (35 initial plus 14 additional). Exact per-view active wrapper scope needs own audit.
- Three **`costing.` SEC material-review accept/close function bodies inspected**: `rpc_accept_internal_source_material_review_action`, both signatures of `rpc_accept_material_review_action`, and `rpc_close_material_review_acceptance` have `require_permission('module:costing-control-center',true)` in the initial validation path. **Server-side edit checks confirmed by catalogue**, not by negative-identity execution. Other public wrappers and all transitive side effects were not fully audited.
- `public.rpc_costing_preview_approval_impact` exists as `VOLATILE SECURITY DEFINER` with the prior SEC-A2 gate; it was **not invoked**. Naming a function "preview" must never automatically qualify it as read-only.
- No ID-N, ID-X or ID-O behavioural authentication performed. **W5-06 stays OPEN**.

## 4. Historical PRM run-82 evidence

Catalogue-only reading of `public.rpc_get_route_family_mapping_review_candidates` and `public.rpc_get_route_family_foundation_review` shows **STABLE SECURITY DEFINER**, first-order PRM view permission check, and required exact `period_start / valuation_date / refresh_run_id` consistency against `costing.costing_refresh_run` with `valuation_context_source='CAPTURED_AT_REQUEST'`. Their candidate lists further restrict to route-readiness statuses and other conditions. No RPC executed.

Direct SELECT-only base-population check:

| Fixed run | Captured valuation | Direct-labour workload recipient products |
|---|---|---:|
| 80 / July 2026 | 2026-07-22 | **0** |
| 82 / August 2026 | 2026-08-07 | **495** |

Consequently, zero Mapping/Foundation rows in UI (if confirmed) **cannot be explained solely by zero workload products for run 82**, but candidate-specific filters may legitimately yield zero. Still **NOT TESTED / source-filter comparison required**; no invented run selector or latest-run fallback.

## 5. Remaining owner decisions and safe next step

1. **Q-L1:** Decide whether coverage means resolved *at frozen run valuation* or *current policy*; selling-run source now proven but **bilateral IK/OK scheme selection cannot be inferred** from scheme viability rows. Before approving a migration, derive the exact historical scheme selection signal and preserve denominator/snapshot join semantics. No server/client fix authorised here.
2. **Q-F1/Q-PRV:** Request complete *transitive* callee trace and no-DML proof per exact function/signature; do not permit preview calls merely from volatility or naming.
3. **Q-SEC:** Accept catalogue-gate confirmation as **CATALOGUE_PASS only**, not behavioural server-denial. Any negative-identity plan requires separate explicit authorisation, with no mutating writer RPC in production.
4. **Q-C5:** Need a bounded, safe direct comparison of candidate filters with the fixed run-82 recipient set before classifying Mapping/Foundation zero-row results.
5. **Run 151:** preserve the accepted PAR1 context (149) and distinguish new current-successful run (151) in all future claims. Do not automatically reclassify programme gates.

**Gate result: WP05 OPEN, programme 6/13; AE1 13 P / 4 historic F / 2 NA / 21 NT unchanged. No B1 amendment, final WP05 sign-off, feature flag change or deployment.**
