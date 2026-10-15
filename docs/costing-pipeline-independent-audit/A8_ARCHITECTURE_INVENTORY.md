# A8: architecture inventory (costing suite client and server)
Source: `origin/main` `71c30f1` static read of `public/shared`, plus the live catalog from A0/A6. Retrieved 2026-10-15 ~20:00 IST. No UI was changed. Status: **COMPLETE for the audit scope (static).** Live UX walkthrough not done (no app session).

## Inventory (VERIFIED_REPO)
| Item | Count |
|---|---|
| HTML launcher pages | 4 here: cost-build-manager, cost-sheet-review, costing-control-center, material-cost-manager. 6 per the baseline, including the pricing-policy and production-route views hosted in the shell. |
| Views registered in `costing-suite-registry.js` | 38, e.g. control-center, material-cost, cost-build, pricing-policy, cost-sheet-review, production-route, 13 route-family/route views, 4 governance views, 3 action queues, cost comparison, printable cost sheet |
| Client JS modules (`costing-suite-*.js`) | 33 |
| Client code lines (costing JS + HTML) | ~102,800. Largest: production-route 11,945; shell 9,577; route-helpers 8,696; pricing-policy 8,197; material-cost 6,384; cost-sheet 6,150 |
| Distinct RPCs called by the client | 146 |
| Approval or state-changing RPCs callable from the UI | 19: 8× `rpc_approve_*` (routes, families, cost centres, DL/POH workload policy, driver envelope), `rpc_apply_product_mrp_proposal`, `rpc_accept_material_review_action`, 6× `rpc_close_*`, `rpc_request_costing_refresh` |
| Server | `costing` schema with 116 tables, about 56 snapshot tables, a 6-stage pg_cron pipeline, ~20 STABLE preview/simulation functions (not in repo, A0) |

## Findings
| ID | Finding | Sev |
|---|---|---|
| A8-F1 | **Wide UI surface for financial authority.** 19 approve, apply, close and refresh actions sit in the same client as browsing. The refresh request is the A6-F1 path that can supersede run 119. The manufacturing standard rates and behaviour split, by contrast, are approved only server-side (not via the UI). So approval authority is inconsistent across cost elements. | P1 (design) |
| A8-F2 | **Run context is resolved per module.** About 20+ modules each query `refresh_run_id` / `v_current_successful_costing_refresh_run` themselves (cost-sheet 45 references, route-helpers 30, materials-stores 22, QC 20, material-cost 20). No single run-context service exists, so different screens can show different runs during a refresh. | P2 |
| A8-F3 | **Pricing logic is duplicated in the client.** `roundDerivedMrpOk` (ceil to ₹5) and the OK-region % derivation in `costing-suite-pricing-policy.js` (lines 2229–2466) are preview-only; the RPCs persist server values. They can still diverge from the server price chain without any test. | P3 |
| A8-F4 | **Route-configuration sprawl.** 13 of the 38 views are route, family, mapping or archive editors, about 30k lines. Workload per batch (route factor) is the A3-F6 risk, yet there is no production-validation step in these editors. | P2 |
| A8-F5 | **No variance or period-close UI.** Matching A6-F6, nothing shows actual spend vs absorption, and there is no reference or approved designation. | P1 (design) |
| A8-F6 | **Monolithic modules** of 6k–12k lines without module-level tests in the repo (UNVERIFIED test coverage). Maintainability risk for the AU work packages. | P3 |

## Target client architecture (PROPOSAL; no UI redesign approved)
1. **One run-context service.** It resolves REFERENCE/APPROVED/DRAFT once (AU-2b), and every view displays the run id and designation.
2. **Separate workspaces by role:**
   - Analyst: explore, simulate.
   - Finance approver: rates, budget, behaviour split, run designation.
   - Production: routes, batch sizes, densities.
   - Commercial: MRP proposals.
   Approve and close actions appear only in the approver workspace.
3. **A scenario lab** that calls the existing STABLE simulators and is clearly labelled NOT APPROVED.
4. **A variance and absorption screen** (AU-6).
5. **Server-only pricing maths.** The client renders server preview RPCs.
