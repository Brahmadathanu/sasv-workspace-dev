# Claude Code bulk client handoff — Executive MIS Production (NOT YET AUTHORIZED TO EXECUTE)

**Mode:** READY-TO-COPY work assignment, **parked until G7 SERVER ACCEPTED**.  
**Repository:** `Brahmadathanu/sasv-workspace-dev`  
**MIS canonical workflow:** `docs/executive-mis/EXECUTIVE_MIS_WORKFLOW.md` on `docs/executive-mis-workflow-20261119`, draft PR #485.  
**Existing client candidate:** MIS-C1 draft PR #486, branch `claude/mis-c1-client-polish-hardening-m7rbjk`, previously observed head `eec9e03a98694af27c0ba726849b81cd28439748`. REVALIDATE live branch SHA first, no blind rebase or merge.  
**Server reference:** `docs/executive-mis/MIS_G7_SERVER_CONTRACT_DRAFT.md` and `MIS_G7_CONSOLIDATED_IMPLEMENTATION_REVIEW_2026-11-20.md`; `MIS_G7_PHASE1_RPC_MIGRATION_DRAFT.sql` is a **proposal, not installed or server accepted**.

## Stop gate / permission

**Do not start client implementation until owner provides G7 SERVER ACCEPTED receipt:** exact production callable RPC name and signature, return JSON field contract, authenticated positive/no-view/anon test result, live cutoffs, sample response and current deploy/branch baseline. A documentation design or mocked SQL does not satisfy this. No client deployment, merge, installer packaging, shared service worker/cache changes, Costing Suite asset changes, server SQL, schema, grants, cron, network policy or Electron release work without separate owner approval.

## When SERVER ACCEPTED: one credit-efficient cohesive implementation assignment

You own **client only**. Implement a polished, compact, professional enterprise ERP-style Production monetary view with one coherent bulk package, not incremental scattered cosmetic PRs.

**Client files:** `public/shared/executive-mis-dashboard.html`, `public/shared/js/executive-mis-dashboard.js`, its module-specific styles and targeted offline tests as justified. Preserve other MIS tabs and all existing modules. Inspect current branch first; coordinate with PR #486, do not discard its latest-wins and accessibility fixes.

**Business view:**
1. Primary Production monetary KPI row: **Planned bulk value** (approved frozen snapshot only, else prominently `Live indicative plan`), **Actual bulk received covered value** (with coverage caveat), **Completed bulk value** (N/A until canonical verified event), **Transferred FG book value** (explicitly `Tally book basis`, visually separate). Keep distinct source dates, run ID, as-of cutoff and basis.
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

**Current status:** Claude not launched by ChatGPT; no direct Claude connector available in this session. This file is an assignment artifact only.
