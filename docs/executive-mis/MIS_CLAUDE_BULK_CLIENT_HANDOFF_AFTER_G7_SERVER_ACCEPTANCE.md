# Claude Code bulk client handoff — Executive MIS Production (SERVER ACCEPTED, CLIENT ONLY)

**Mode:** READY-TO-COPY ONE BULK CLIENT ASSIGNMENT. G7 SERVER ACCEPTED (bounded covered-subtotal contract); draft implementation now eligible, no merge/deploy authorized. Single authoritative RPC is `public.get_mis_production_value_summary(date,date)`; no preview or versioned APIs.  
**Repository:** `Brahmadathanu/sasv-workspace-dev`  
**MIS canonical workflow:** `docs/executive-mis/EXECUTIVE_MIS_WORKFLOW.md` on `docs/executive-mis-workflow-20261119`, draft PR #485.  
**Existing client candidate:** MIS-C1 draft PR #486, branch `claude/mis-c1-client-polish-hardening-m7rbjk`, previously observed head `eec9e03a98694af27c0ba726849b81cd28439748`. REVALIDATE live branch SHA first, no blind rebase or merge.  
**Server reference:** `docs/executive-mis/MIS_G7_SERVER_CONTRACT_DRAFT.md` and `MIS_G7_CONSOLIDATED_IMPLEMENTATION_REVIEW_2026-11-20.md`; `MIS_PRODUCTION_VALUE_SUMMARY.sql` is **installed as the sole canonical API**, with genuine signed-in authorized and denied-user acceptance evidenced on 21 Nov 2026.

## Server acceptance receipt and boundaries

**21 November 2026 G7 server RPC SERVER ACCEPTED (bounded contract)**: real owner-operated existing MIS View session accepted the single `get_mis_production_value_summary` RPC, `canonical_permission=true`, `rpc_outcome=ALLOWED`, report month Nov 2026, approved run 143, 80 receipt events / 2 unvalued, plan `UNAVAILABLE_PENDING_FROZEN_PLAN`, comparability `NOT_COMPARABLE`; signed-in no MIS View `403/42501` PASS, anonymous `401/42501` PASS. No JWT/identity recorded. Treat counts as a prior test fixture, not permanent/live source totals.

**Allowed now:** one client-only implementation on a new release-isolated feature branch with comprehensive offline tests and a draft PR. Use sole API `public.get_mis_production_value_summary(p_report_month date,p_as_of_date date DEFAULT NULL)`; no preview/v1/v2 alternatives. **Not allowed:** server SQL or schema changes, new functions, grants, cron, source writes, production deployment, merge, publishing installer, shared worker/cache changes, release metadata, Costing Suite files or Electron release steps. Claude must stop after pushing a draft PR and a full acceptance receipt.

**Not yet available from server:** approved frozen plan value, completed batch production value, plan achievement percentage and detailed FG book/log reconciliation. These are explicit remaining G7 server/integrity tasks and must appear as **unavailable/not comparable**, not be fabricated or computed in JS. `receipt_reference_covered_value` is a **covered subtotal**, not full COP/actual expense. `tally_fg_transfer_book_value` is distinct Tally book basis; `transfer_reconciliation_status=NOT_CHECKED_BY_BOOK_TOTAL`.

## One credit-efficient cohesive implementation assignment — EXECUTE CLIENT ONLY

You own **client only**. Implement a polished, compact, professional enterprise ERP-style Production monetary view with one coherent bulk package, not incremental scattered cosmetic PRs.

**Client files:** `public/shared/executive-mis-dashboard.html`, `public/shared/js/executive-mis-dashboard.js`, its module-specific styles and targeted offline tests as justified. Preserve other MIS tabs and all existing modules. Inspect current branch first; coordinate with PR #486, do not discard its latest-wins and accessibility fixes.

**Installed canonical JSON fields (pending authenticated acceptance):** `report_month`, `as_of_date`, `approved_cost_run_id`, `approved_cost_valuation_date`, `status`, `plan_status`, `component_policy`, `planned_product_count`, `planned_unvalued_count`, `planned_reference_covered_value`, `receipt_event_count`, `receipt_unvalued_count`, `receipt_correction_event_count`, `receipt_reference_covered_value`, `receipt_value_status`, `tally_fg_transfer_book_value`, `transfer_line_count`, `tally_snapshot_as_of`, `transfer_reconciliation_status`, `transfer_missing_amount_lines`, `completed_reference_value`, `completed_status`, `plan_achievement_pct`, `comparability`. Values may be null. `transfer_reconciliation_status='NOT_CHECKED_BY_BOOK_TOTAL'` means the fast Tally book aggregate is not a log-matching reconciliation. Future evolution **changes this same API** with additional nullable fields only when separately governed.

**Business view:**
1. Primary Production monetary KPI row: **Planned bulk value** (currently unavailable pending approved frozen snapshot; show no planned monetary amount), **Actual bulk received covered value** (with coverage caveat), **Completed bulk value** (N/A until canonical verified event), **Transferred FG book value** (explicitly `Tally book basis`, visually separate). Keep distinct source dates, run ID, as-of cutoff and basis.
2. Never mix Kg, L and Nos in a physical total. Show grouped physical quantities and product/batch counts below; do not invent a combined quantity achievement.
3. `plan_achievement_pct` remains N/A until server explicitly says `COMPARABLE`; do not compute in browser, especially not from bulk receipts or transfer book value.
4. For missing approved rates show `Unvalued`/coverage counts, no fabricated zero, no misleading summation. Honor server `NO_PREVIOUS_MONTH_APPROVED_COST`, `PARTIAL_COVERAGE`, `BLOCKED_CORRECTION_LINEAGE`, `NOT_COMPARABLE`.
5. Rate includes RM materials-stores share only; PM stores and packing labour/PM costs excluded from bulk. Do not calculate rates in JavaScript; consume server-computed figures only.
6. Legacy FG bulk receipt event semantics currently use physical storage postings; a future product-route logger will replace the back-end adapter. Client must not directly query `daily_work_log` or assume immutable `Done` = batch completion.

**UI quality:** use existing theme tokens, never hard-coded color palette; modern tight ERP cards rather than tall empty cards; compact toolbars and full-width data view at 390px; 320/390/520/768/desktop tests. Universal HOME icon+label desktop, icon-only <=520px. Searchable single selects use existing Stock Checker style. Clear hover/focus states, accessible contrast, keyboard and ESC behavior, latest-response-wins and correct loading/error/retry/empty states, no impossible zero values. Avoid overdecorating; keep semantic money, dates, exception labels prominent.

**Client test fixtures:** positive approved rate, approved-run absent, two missing approved product rates, plan live-not-frozen, formal completion unavailable, partial or corrected receipt history, transfer reconciled/missing-log/not-valued, different report cutoff, 401/no permission, rapid tab switch/network retry, 320/390 compact layout. Assert user-facing text and no bad ratio/zero/exposure.

**Workflow and credit discipline:** one new cohesive draft PR on a release-isolated branch, static/mock tests and screenshots, self-review; NO merge/deploy. Provide a single receipt with base/head SHAs, files, contract version, test matrix including mobile screenshots, known failures, and evidence of not touching release files. ChatGPT performs independent audit; request only one bounded correction package if required. Do not alter accepted server semantics because of a client convenience issue.

## If asked to help before SERVER ACCEPTED

Only read-only audit of PR #486, inspect module integration points, document proposed mock fixtures and conflict/merge plan. NO client code changes, no new branch/PR, no claimed acceptance; wait for SERVER ACCEPTED to avoid consuming credit on guesses.

**Current status (21 Nov 2026):** G7 bounded server RPC SERVER ACCEPTED from genuine session evidence. Claude not launched by ChatGPT; no direct Claude execution connector available in this session. Ready to provide to Claude for one client-only draft PR; subsequent independent review remains with ChatGPT.
