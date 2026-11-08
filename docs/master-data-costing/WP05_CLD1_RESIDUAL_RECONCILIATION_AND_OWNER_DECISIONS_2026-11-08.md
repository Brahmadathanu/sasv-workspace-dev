# WP05-CLD1 Track C/D — residual reconciliation, gate refresh and owner decision queue (8 November 2026)

**Status: PROPOSAL / NOT EXECUTED / NOT APPROVED.** WP05 OPEN; programme **6/13**. AE1 ledger unchanged: **13 P / 4 historical F / 2 NA / 21 NT**. Every "owner approval" cell below is `PENDING`. No SQL, auth, flag, code, cache, deployment or permission action. Labels: `CONFIRMED_IN_REPO`, `OBSERVED_PREVIOUS_RUN`, `NOT_IN_REPO`, `LIVE_UNVERIFIED`, `OWNER_DECISION_PENDING`.

## 1. Staff Governance pool summary — 7 rendered vs 42 source

- Client: `public/shared/js/costing-suite-cost-build.js:506-516` — sub-tab `staff-pool-summary` reads `v_costing_staff_cost_pool_summary` with `.select('*').eq('period_start', activePeriodStart).order('allocation_pool').order('costing_class')`. `CONFIRMED_IN_REPO`.
- View: `public.v_costing_staff_cost_pool_summary` (`supabase/migrations/20261019134900_tb2_costing_view_permission_gate.sql:2029-2045`) selects one row per `(period_start, allocation_pool, costing_class)` from `costing.v_staff_cost_pool_monthly`, then applies `fn_costing_view_allowed()`. No other filter. `CONFIRMED_IN_REPO`; the monthly base view definition is `NOT_IN_REPO`.
- Prior independent live aggregate (issue #211 / `STAFF_POOL_AND_ROUTE_PREVIEW_CONTRACT_REVIEW_2026-11-08.md` §A, `OBSERVED_PREVIOUS_RUN`): exactly 7 rows per period for June–November 2026, 6 × 7 = **42** unfiltered; ID-V browser at default 2026-11-01 displayed 7.
- **Classification: 7 vs 42 is EXPLAINED (period filter), not a UI defect** — repo confirms the filter, the prior run supplies the counts. I do not re-prove the per-month count (live, unverified now). **Lens status is not changed:** AE1 keeps `staff-governance` at NT/PARTIAL (review R1, other sub-tabs); this document only removes the "unexplained" qualifier for the pool-summary sub-tab. Whether to upgrade the ledger row is `OWNER_DECISION_PENDING` (Q-STAFF).

## 2. PRM exact-run Mapping Review and Foundation Review (C5/D5)

| Lens | Constant (helpers file `costing-suite-production-route-helpers.js`) | Fixed context |
|---|---|---|
| Route Readiness (and non-workload lenses) | `PRM_EXACT_RUN_CONTEXT` `:166` | period 2026-07-01, valuation 2026-07-22, run **80** |
| Workload Preview / Detail / Explain (`shared-workload-preview`) | `PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT` `:177` | 2026-08-01 / 2026-08-07 / run **82** |
| Mapping Review | `PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT` `:188` | run **82** |
| Foundation Review | `PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT` `:199` | run **82** |

Nav classification `FIXED_HISTORICAL` for the group (`costing-nav-groups.js:119`). `CONFIRMED_IN_REPO`. Source comments forbid fallback to "today" and mixing contexts.

**Zero-row observation:** IDV selector acceptance (`IDV_SELECTOR_SUBTAB_ACCEPTANCE_2026-11-08.md`) left rows 9/10 (mapping/foundation) "unchanged" and listed "mapping/foundation exact-run confirmation" as not done. The repository holds the constants and the read-RPC argument builders but **no run-82 data**, so whether 0 rows is correct (nothing to map for that run) or a context error cannot be classified from repo evidence: label **`source data comparison required`** — needs an owner/reviewer SELECT count of the Mapping/Foundation read source for `refresh_run_id = 82` (period 2026-08-01, valuation 2026-08-07) compared with the displayed count. Do **not** add a period selector or a latest-run fallback; that would silently break the C5/D5 fixed-run contract and needs a new server contract (`OWNER_DECISION_PENDING`, Q-C5). Treat as NT, not P, not F.

## 3. F1 and other previews
Carried to the Track B audit (`WP05_CLD1_SECURITY_RPC_STATIC_AUDIT_2026-11-08.md`): F1 is *probably* read-only per prior live catalogue read but the wrapper is not in repo and callees must be rechecked; the three historical candidate previews and the direct-labour shadow preview are UNKNOWN; none is added to any allowlist here.

## 4. Gate refresh W5-01…W5-10 (proposed wording only; the gate audit's table is unchanged)

| Gate | Gate-audit disposition | Update from PR #240/#241 and CLD1 | Proposed state (not approved) |
|---|---|---|---|
| W5-01 | PASS | none | PASS |
| W5-02 | PASS (code) | none | PASS (code) |
| W5-03 | PARTIAL for WP05 | none (owner baseline acceptance for WP05 still separate) | PARTIAL |
| W5-04 40-lens/11-flag | OPEN | AE1 13/4/2/21; AE2 RD-v391 limited render evidence 14/15 (not P); 11 flags: 1 PPM-only ON, 1 focused run, 9 none | **OPEN** |
| W5-05 factual parity | PARTIAL (S2/S9 untested) | PR #240: S2 READY + REVIEW SKUs PASS (loaded cost, COP, materials, MRP, status, valuation, run 149); BLOCKER SKU 105 PARTIAL (cost NULL both sides by design, MRP/status/run agree); S9 Nov run 149 121/506/1 of 628 and Oct approved 143 627/627 PASS within guarded view-read limits (no per-SKU UI click-through; harness only local). Gate audit table text is **stale** (still lists S2/S9 as remaining) though its §7 addendum carries the update. New defect **L1** (policy coverage scope) is separate | **PARTIAL → candidate PASS-with-recorded-limits at owner discretion**; L1 and BLOCKER partial recorded as residuals (Q-L1, Q-S2B) |
| W5-06 authorisation / negative IDs | OPEN for server denial | ID-V cleanup (#241) is **not** credit; revocation not independently tested; static map done in Track B | **OPEN** |
| W5-07 flags | PARTIAL | none | PARTIAL |
| W5-08 authority/route dispositions | PARTIAL | static D3 + view-gate breadth note (Track B §3) | PARTIAL |
| W5-09 backlog metadata | PARTIAL | this queue §6 supplies IDs/risks/milestones for owner acceptance | PARTIAL until owner accepts queue |
| W5-10 owner sign-off | OPEN | separate owner act | **OPEN** |

Nothing here moves WP05 to CLOSED or the programme to 7/13.

## 5. OPTIONAL amendment B1 — decision template for owner consideration ONLY (NOT approved; NOT recommended as approved)

**Baseline:** Option 1 = original shared §8 (global 40-lens, 11-flag, negative identity matrix) **remains fully binding on WP05**. The 8 Nov A1 amendment narrows WP06 only; it is not B1.

**If** the owner chooses to consider B1 for WP05, a candidate wording to approve, amend or reject:

> *"For WP05 only, the following integration-matrix items are transferred to WP12 and are **not** required for WP05 closure: (T1) the remaining 21 − [N] NT lens observations that need only repeat render-and-data-presence at 1280/390 under a verified build (list by id); (T2) the nine untested feature-flag ON/OFF combinations other than NAV_GROUPS and the focused Lock Screen run, to be exercised as the WP12 integrated flag matrix; (T3) cross-module deep-link regression across all six modules. WP05 **retains**: (R1) authority/role semantics D3, C5/D5 fixed-run labelling, C6/O-8 route disposition; (R2) negative identities ID-N/ID-X/ID-O and SEC-A1/SEC-A2 server-denial evidence under an approved no-side-effect plan; (R3) read-only integrity (no writer reachable by view-only identity, guard evidence); (R4) S2/S9 parity and the L1, BLOCKER-partial and Staff/PRM exact-run residuals; (R5) historical failure records (Scheme 57014, CSR 57014, LOCK-P01) unrewritten."*

Placeholders `[N]` and the lens list are for the owner/ChatGPT to complete; none was chosen here.

**What can plausibly shift to WP12:** repeat render checks of low-risk read lenses; remaining flag-combination sweeps; cross-module navigation regression; Windows A14 installer (already WP12 only).
**What should stay WP05-specific:** authority/role/denial; read-only integrity; fixed-run governance; S2/S9 residuals; anything where a defect could expose data or let a view-only identity write.

**Risks of transfer:** (a) the historical LOCK-P01 CCC-dashboard security FAIL (v391 ALL_ON; v392 focused fix tracked separately) is flag-combination evidence — deferring the flag matrix defers re-proof of that fix beyond WP05; (b) WP12 inherits integration risk without WP05's lens-level context; (c) 21 NT rows would close WP05 with unverified UI behaviour if T1 is wide; (d) cross-module dependencies: PRM fixed-run lenses depend on run 80/82 data persisting; CCC KPI L1 affects dashboard coverage credibility; the `fn_costing_view_allowed()` any-one-module read breadth affects every module's data exposure; (e) a B1 may need an explicit WP12 contract entry so the transfer is traceable, otherwise the obligation silently vanishes. B1 does not by itself resolve W5-06.

## 6. Decision queue (all `PENDING`)

| ID | Item | Risk / impact | Proposed disposition (recommendation only) | Required evidence | Approval | Milestone |
|---|---|---|---|---|---|---|
| Q-L1 | L1 policy-coverage KPI scope | Medium for historical periods; none for S9 | Readbacks R1–R5 then Option 1, else Option 2 (CLD1 Track A) | R1–R5 output | PENDING | WP05 residual / separate governed fix |
| Q-S2B | S2 BLOCKER SKU 105 partial (cost NULL by design) | Low; classification | Accept PARTIAL as designed | owner acknowledgement | PENDING | WP05 |
| Q-F1 | F1 `rpc_preview_route_family_route_steps` one-name allowlist | Blocks a secondary PRM read | Static trace first (Track B §5 tier 1), then one-name allowance | wrapper+callee text, static regression | PENDING | post-WP05 / WP12 |
| Q-PRV | three historical preview RPCs + direct-labour shadow + `shared-workload-preview` | UNKNOWN safety; stay NT | Keep denied/NT | per-function trace | PENDING | WP12 |
| Q-SEC | SEC-A1/A2 + negative identities | W5-06 open | Approve static+catalogue tier; decide on behavioural tier | catalogue readback | PENDING | WP05 |
| Q-D3 | CCC-edit vs MCM-edit privilege semantics; view-gate breadth | privilege | Keep distinct; record any-one-module read | owner semantic ruling | PENDING | WP05 |
| Q-C5 | C5/D5 fixed runs 80/82; PRM zero rows | label risk | Accept as fixed-historical with label; run-82 count comparison | count comparison | PENDING | WP05 |
| Q-C6 | C6/O-8 unmapped routes | route governance | WP06-deferred; WP05 records only | none new | PENDING | per PARKED_BACKLOG |
| Q-D7 | D7 maker-checker policy | authority | as deferred | none new | PENDING | per PARKED_BACKLOG |
| Q-STAFF | Staff pool 7/42 | explained; ledger wording | Record "explained by period filter"; keep NT/PARTIAL until sub-tab matrix agreed | none new | PENDING | WP05 |
| Q-224 | Scheme Master 1280 HTTP500 57014 (#224) | intermittent; historical | Keep issue open and monitored; no causal index claim | owner observation log | PENDING | monitoring |
| Q-CDE2 | CDE-2 candidate (SQL unapplied, client adapter unconnected) | not a prerequisite to audit | neither prerequisite nor WP12-integrated; determine dependency | owner | PENDING | separate |
| Q-IDV | ID-V password rotation done; global sign-out owner-confirmed; **revocation untested** | residual credential risk | owner-only action; **never actioned by Claude** | owner | PENDING (owner-only) | owner |
| Q-A14 | Windows A14 installer | none for WP05 | stays WP12 | — | PENDING | WP12 |
| Q-B1 | Amendment B1 (§5) | scope | decide: keep §8 / adopt B1 / amend | owner written decision | PENDING | before W5-10 |

## 7. Not done / unverified in this track
No re-run of anything; the 7/42 and 80/82 statements rely on prior records as labelled; line numbers are the `export const` lines in the helpers file; reviewer should spot-check.
