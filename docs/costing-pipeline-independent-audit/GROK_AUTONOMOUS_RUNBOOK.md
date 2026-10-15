# Grok autonomous execution contract — READ BEFORE ANY WORK
**Objective:** Independent deep audit, professional architecture proposal and implementation-ready test/workpacks for SASV manufacturing + financial costing pipeline.

## Onboarding
Repository `Brahmadathanu/sasv-workspace-dev`. Start from current `main`, read THIS DIRECTORY exhaustively; inspect prior feature `feat/mc06-split-overhead-readiness-gate` / PR #66 as unmerged provisional work; read `docs/manufacturing-costing-price-revision/`, `docs/master-data-costing/` for interfaces **without merging programmes**. Build a live-vs-repo provenance matrix; no guesses. Work in `docs/costing-pipeline-independent-audit` branch for audit docs; code/test implementation must use *separate task-scoped branch* created from current main after drift check. Do not alter others' branches without consent.

## Autonomous permission envelope
YOU MAY independently: inspect repo history, migrations, functions; retrieve live Supabase metadata/snapshots via strictly SELECT, EXPLAIN read-only where permitted; generate SQL SELECT reports; perform local nonproduction simulations; add source-cited audit reports, test fixtures, graphs, SQL regression specs, architecture decision options and isolated draft PRs; run tests where safe isolated environment is verified.
YOU MAY NOT independently: run migrations against production, UPDATE/INSERT/DELETE/TRUNCATE live data, call server or client costing refresh, mark price rates/behaviour policies APPROVED, change access control, alter operational SKU/master data, manipulate Google Sheet 509 or filtered 440, merge PRs, push changes to main, modify e-Aushadhi, claim Finance approval, deploy services, run scripts with unclear write behavior or make live API calls with side effects.

## Audit discipline
- Work gate-by-gate A0→A11. Parallelize independent read-only evidence acquisition if efficient; user must not manually relay routine outputs.
- For each query store: SQL text (or reproducible filepath), project schema/name, result summary, run/date filter, query timestamp, row count, expected-vs-actual variance and source exact path.
- For each code hypothesis inspect actual current deployed function definition, *not only migration file*.
- For each cost head trace Tally/fiscal-year semantics; distinguish FYTD snapshot from monthly invoice and estimate from budget/actual.
- Cost model must respect manufacturing output per batch, separate multiple SKUs of a product, and not charge unsold SKUs via sales volumes. Separate actual expenditure reconciliation from standard-cost variance.
- Complete 509/440/69 business-scope reconciliation without changing submitted Sheet.
- Document failed tool calls; never spoof PASS. Source values mentioned in baseline require revalidation before assertion.
- Build executive 1-page issue summary AND granular technical dossier per gate; update ledger / decisions / handover after each meaningful action.
- In each message: what was VERIFIED, changed files/commit, severity, test outcome, blockers, next precise action. Do not repeat unchanged entire story.
- If multiple credible financial treatments exist, present concrete side-by-side sensitivity and ask ONE well-framed decision; do not fabricate signoff.
- Preserve existing functions outside authorised scope. All migrations must have versioned forward/rollback behavior, no surprise replacement.
- Retain test fixtures for SKU193, 988, 207/208/209/1798 plus 509/440 population, boundary cases.

## Stop gates / escalation
Stop and ask user before: any live write, Google Sheet edit, public release, branch merge, production cutover/refresh, permanent costing policy/normal budget approval, price revision acceptance, security policy changes. For findings with P0 risk, stop any proposed operational cutover and document containment. Otherwise stay autonomous.

## First Grok assignment
1. Complete A0 read-only baseline inventory end-to-end. 2. Start A1 expense pool forensic reconciliation and A3 extreme-SKU batch provenance in parallel. 3. Deliver P0/P1 issues with reproducible queries and owner. 4. Draft audit-only tests in task branch. 5. Update ledger/master plan/decisions and report commits, current gate, 3 highest-value follow-ons. Do not trigger any production work or ask for repetitive approvals on read-only tasks.

## Handover template
Gate / branch & HEAD / deployed-vs-proposed provenance / reproduced queries / changed files / test environment + output / findings with financial exposure / open decisions / stop controls / exact next step. If context resets, reread files and check latest live+Git state before acting.


## Override: canonical decision authority (user directive 2026-10-15)
In this programme, **the user is ultimate evidence-based approval authority**; avoid further routine referrals to Finance or Production for costing decisions. The costing suite is the governed implementation/evidence system, not an autonomous human approver. Grok should develop and recommend source-backed classifications, normal budgets, fuel consumption methods, density/route/BOM repairs, and present exact alternatives where material, then secure only the user's necessary decision. Do not forge signoff, self-approve rate policies, or bypass existing regulatory/financial law. An approval is a deliberate user action logged with basis, actor, date and effective period.
Withdraw the drafted Finance Fuel & Gas voucher request; continue read-only investigation of ledger and stock evidence, making missing voucher details explicit. Grok Google Sheet HTTP 401 is an access limitation specific to its environment; verify the original workbook and 440 filtered copy using available authenticated route before requesting exports. Do not make blocked A7 a blocker for A4/A5 source-backed architecture design; maintain A7 as a separate unresolved evidence gate.
Autonomous priority: AU-2/2b prevention of unsafe run selection/mutation (no historical writes) and independently testable source corrections; defer actual normal-rate issuance and engine cutover until Tally semantics and budget evidence are reconciled. Workpacks and test plans may advance concurrently, not their live deployment.
