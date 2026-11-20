# CLAUDE C1B — RUN-148 SKU WORKLIST INTEGRATION
**Owner handoff / client implementation brief, 1 November 2026 (IST).** Read all instructions before coding. Target: one **draft PR only**, no merge, no production deployment, no database writes.

## Verified baselines
Repository: Brahmadathanu/sasv-workspace-dev. main = 5c5b7ba4b6370cece85796afd26423342c36eaf5, cache hub-cache-v387 as of this brief.
Draft PR #115 head 7931c12b3cb180913cc9d38a5d5de9021eb26ac4 on feat/costing-c1-run-context-diagnostics; not merged. It introduces run-context helper/loader and tests. PR #116 is docs only (not merged); do not accidentally pull its migration documentation into client PR.
Supabase project qhmoqtxpeasamtlxaoak: deployed **public.v_costing_pricing_sku_control_status_by_run** via approved production migration, subsequently tightened to SELECT-only for authenticated and service_role. It has same 40 columns/types as public.v_costing_pricing_sku_control_status_snapshot and security_invoker=true. It returns October 143: 627 READY; 148: 514 READY, 113 REVIEW_REQUIRED, 1 BLOCKER. Failed 147 returns zero. Admin-side tests verified; actual permitted/denied browser JWT tests remain to perform.
Keep public.v_costing_pricing_sku_control_status_snapshot unchanged; it is the governed-run source for ordinary pricing and status.

## Branch strategy and dependencies
You MUST inspect current main and PR #115 first. To avoid duplicate/competing implementations, **base your C1B feature branch on the current PR #115 head** and open a **draft PR with base feat/costing-c1-run-context-diagnostics** (stacked PR), unless PR #115 has been approved/merged by owner by the time you start. If #115 merged, rebase C1B onto fresh main and target main. NEVER merge #115 yourself. State the exact base and dependency clearly in PR title/body. If the GitHub interface cannot create a stacked draft PR, stop and document blocker instead of mixing bases or duplicating all #115 changes into a main-targeting PR.
First correct the #115 status-read error wording in its own branch/PR if possible: when period status read fails, do not claim server's current run is verified; say current designation could not be verified, while loaded row ids still show their stored run. Coordinate that as a narrow follow-up to #115; do not modify the source branch without ensuring owner can review its diff. No cache bump until Jarvis confirms allocation; list pin paths.

## Intended UX
Within Costing Control Center > SKU Control Status:
- Keep ordinary default/governed-run mode and existing behavior intact when existing COSTING_REVIEW_WORKLIST_V1 flag is OFF.
- When flag ON, use the existing period-run-status read to list ONLY the server-advertised permitted run ids: displayed_run_id, approved_run_id, newer_draft_run_id. **Never fabricate, synthesize, or permit arbitrary URL/user-provided run IDs**. Deduplicate ids. Render clear labels: 'Approved/in use' for 143 and 'Draft — not for pricing' for 148, with exact valuation dates only from authoritative data. Do not infer dates.
- Default selection remains the server's displayed run (143); explicit user choice of draft 148 is allowed only as a read-only diagnostic lens. When run chosen, load **public.v_costing_pricing_sku_control_status_by_run** with BOTH .eq('period_start', ACTIVE_PERIOD_START) and .eq('refresh_run_id', selected server-advertised id). Query within existing 2000-row cap, but assess response/paging behavior and avoid truncated totals.
- Reuse SAME ALL_ROWS -> worklist groups -> table -> drawer -> existing recommended_ui_route fix navigation. Do not invent a second workbench, new independent table or backend write endpoint.
- For 148, show grouped 1 BLOCKER / 113 REVIEW_REQUIRED / 514 READY, and server first_control_status group breakdown; the expectation is about loaded **live** data, not hard-coded UI metrics. Confirm 110 PRIME_COST_REVIEW_REQUIRED, 2 MATERIAL_REVIEW_REQUIRED, 1 PRICING_BRIDGE_REVIEW_REQUIRED, 1 MATERIAL_COST_BLOCKED based on preflight, but allow live data to differ safely.
- Show prominent source details: period, run id, valuation date, APPROVED vs DRAFT, and prominent warning that draft is NOT pricing source; frozen-run data is historical, correction screens show current source.
- Clicking group/row navigates to existing correction screen with SKU/product/period context. Maintain all existing permission gates and no write capability added. If a target is unmapped (COST_REVIEW_WORKBENCH), show honest no-navigation explanation, never broken link.
- If period changes, status changes, user reloads, or late requests complete: reset selected run to the new period's displayed run and discard stale responses. Handle denied role, no data, failed status read, group selection and restoration to approved default. Never show previous run under new label.
- A permission-denied user must never see SKU results; preserve existing server checks. No hidden service keys.
- No client change to approval, locking, recalculation, cost calculations, pricing source, or historical data.

## Source files to inspect before coding
public/shared/js/costing-suite-shell.js (VIEW_BY_LENS, loadRows, ALL_ROWS, renderReviewWorklistPanel and period switch), costing-review-worklist.js, costing-run-status-badge.js, costing-feature-flags.js, costing-suite-control-center.js, costing-suite-recommended-ui-route.js, costing-status-labels.js, current PR #115, C1 walkthrough in #115.
Tests: scripts/costing-review-worklist/*.test.mjs and costly old shell regression guards under scripts/costing-table-tools/*.test.mjs. Confirm no direct reads in flag-OFF state.

## Architecture and tests
Avoid long async cycles, duplicate status reads and false stale-run badges. Use a small testable pure helper for run choices and selection; separate server query adapter. Abort or discard late loads using existing ROWS_LOAD_GENERATION. Do not alter RLS, views, migrations, schema, or permissions.
Tests must cover: flag-off exact baseline; displayed default 143; switch to 148 returning real-shaped fixture counts; switch back 143; no arbitrary run id via URL; stale period/run requests; no-row/permission error, partial response, failed view query; group filter and fix links; accessible select label and keyboard use; status read failure; XSS escaping; mobile. Fix old brittle tests only where needed, without losing protections.
Compare baseline and head on same Node version; record full unit and smoke outcomes and whether known production-route failures are pre-existing. Independently inspect the final diff for accidental unrelated modifications.
Client cache: public/sw.js currently hub-cache-v387. DO NOT allocate v388 unilaterally. Enumerate every cache pin, coordinate with Jarvis (owner relays if no direct connector), obtain confirmed cache version, then bump all references consistently only as part of release preparation. No unapproved service-worker churn.
Protected: never modify/reapply supabase/migrations/20261015045233*; no supabase/ changes or new RPC; do not touch production database; do not enable lock flag or other default-off flags in production.

## Delivery
Produce single focused stacked DRAFT PR with exact base/head SHAs, changed-file breakdown, tests/smokes, flag behavior, backend contract use, owner walkthrough with reversible flag enable/disable, cache pin list and required release actions; do not merge.
Clearly report any missing data contracts or permission failures rather than compensating with hard-coded UI data. The owner will send PR link to ChatGPT for independent review. ChatGPT owns orchestration and backend. All unfinished topics parked in docs. Do not claim Gate 1 complete until real browser owner acceptance.
