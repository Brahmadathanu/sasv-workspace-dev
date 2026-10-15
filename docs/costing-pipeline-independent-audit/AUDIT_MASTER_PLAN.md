# Comprehensive audit master plan — gate-based, not calendar-fiction
Audit executes in strictly sequenced evidence gates, allowing *parallel read-only sweeps* where independent. Every gate has objective, method, artifact, test and exit condition. Agent may act without user relay within READ-ONLY or isolated branch boundaries. Record blocked tools once and switch to a bounded alternative rather than endlessly adding draft notes.

| Gate | Scope and granular checks | Required evidence and exit |
|---|---|---|
| A0 | Reconcile Git main/feature PRs, Supabase migrations/current schema, actual policy states, period/run anchors, sheet 509/filtered 440 lineage; record access, read-only reproduction instructions | Signed baseline matrix: VERIFIED or explicit GAP, no assumption a draft PR is deployed |
| A1 | Tally source/ETL capture and idempotency; absolute vs signed balances; FYTD, FY resets, cutoff, late corrections, duplicate jobs; 8 OH heads vs ledger and repair/fuel outliers | Account-to-SQL lineage, reconciliation by FY/month, deterministic source tests |
| A2 | Canonical SKUs/products/UOM, status as-of, BOM/RM/PM quantities, weighted costs, price-effective-date and inventory; multi-pack same product, packs/cases/count conversion, yield losses | Per-SKU complete join/count/cardinality and value recon, mismatch registry |
| A3 | Manufacturing standard vs minimum batch, preferred batch version/effective date, production routing, labour attendance, utility/process workload, actual transfer/completion differences, consecutive lots, output yield | Batch-size/workload/yield evidence per product, including 193/988 and 4 MC07 exceptions |
| A4 | Classification of all manufacturing labour, fixed/variable POH, packing/QC/stores/admin/marketing, causal drivers and actual vs normal capacity; budget source alternatives, variable cost flex and fixed capacity | Independent Finance approval pack, no invented rates; sensitivity by driver, FY |
| A5 | Rebuild product-first manufacturing costing and multi-SKU allocation; ensure product expense charged ONCE, no sales-dependent manufacture COP; show period actual spend vs standard absorption and variances separately | Per-head reconciliation, no duplicate absorption, SKU conversion precision, missing foundation fail-closed |
| A6 | Inspect full refresh run lifecycle: capture valuation, locks, stage SQL, RPC security definer/RLS, immutability, logs, retries/idempotency, data drift, job failure, client controls; risk of provisional consumers | Dependency graph with source code/function signature, adversarial dry-run test specification |
| A7 | COP → internal loaded → sales-region marketing → GST → 40% discount → 5+1 → contingency → 7% MRP-profit → ₹5 rounding. Cross-check 509 baseline, screened440 vs held69, no false PILOT READY | Analytical independent recomputation, formula preservation, exception documentation, approved statuses only |
| A8 | Architecture inventory: module map, redundant UI controls, master-data remediation, costing control centre, role/access, client architecture, service API, exports and evidence UX | Pain-point/ownership/dependency matrix and proposed target architecture, no unapproved UI redesign |
| A9 | Design professional suite: domain boundaries, canonical data contracts, versioned cost model/policies, batch execution & variance ledger, immutable snapshot + explainability, scenario lab vs approved rates, period-close controls, per-role workspace, audit trails | Architecture decision records, data migration plan, rollback strategy, explicit finance signoffs |
| A10 | Cost and regression qualification: numeric unit/golden fixtures, portfolio boundary cases, SQL test harness on isolated branch DB, reconciliation/performance, concurrency/security, rollback, UAT | Run logs and reproducible pass/fail matrix; blocked if no isolated environment |
| A11 | Rank findings by regulatory/finance impact and effort; divide independently releasable implementation WPs; stakeholder approvals; cutover/preflight/monitoring/rollback | Final audit report, defect register, implementation programme, decision log, user-authorised future execution |

## Mandatory test matrix (all gates)
1. Exact run/period/timezone/effective-date scope; 2. source-to-pool conservation and head duplication; 3. product→SKU cardinality incl multiple packs; 4. output/yield/pack conversion; 5. product manufacturing frequency vs sales; 6. normal standard vs completed production reality; 7. manufacturing split and separate packing/QC/stores; 8. budget/actual variance; 9. missing/zero/negative/duplicate/expired/stale input fail closed; 10. public RPC privilege, SECURITY DEFINER, leakage; 11. re-run idempotence/immutability; 12. 509/440/69 numerical reconciliation and previously extreme cases.

## Severity and acceptance
P0: corruption or wrong live price/approval/refresh, historical snapshot mutation, duplicate financial pool. P1: material wrong COP/source/driver, unsafe default, formula error, unsound capacity allocation. P2: noncritical remediable mapping, usability and traceability. P3: optional improvement. A gate passes only if all P0/P1 are fixed or explicitly blocked from cutover, quantitative reconciliation documented, tests actually executed (not just committed), and Finance signs financial interpretation.

## Audit workflow
Agent: READ repository → query live read-only → reproduce arithmetic → write evidence ledger → assess P0/P1 → draft isolated branch fixes/tests → test (if truly isolated) → update gate → handoff decision. In all reports separate: observed / inferred / proposed / approved / deployed. Preserve uncertainty; avoid multiplying assumptions by calling them facts.

## Gate status (updated 2026-10-15 17:30 IST)
| Gate | Status | Artefact |
|---|---|---|
| A0 | SUBSTANTIALLY COMPLETE — GAPs: 509/440/69 (BLOCKED, no Sheets access), PR #66 tests unexecuted (no isolated DB) | `A0_BASELINE_RECONCILIATION.md` |
| A1 | IN PROGRESS — sweep 1 (logic + POH heads + pool totals); P1 findings A1-F1…F4 | `A1_EXPENSE_SOURCE_AUDIT.md` |
| A3 | IN PROGRESS — sweep 1 (mechanism + portfolio + named cases); P1 findings A3-F1/F2 | `A3_BATCH_WORKLOAD_AUDIT.md` |
| A2, A4–A11 | NOT STARTED | — |
No gate PASSES: P1 findings open; Finance interpretation not signed.

## Gate status (updated 2026-10-15 ~19:00 IST, sweep 2)
| Gate | Status |
|---|---|
| A0 | COMPLETE except BLOCKED items: Sheets 509/440 (HTTP 401; access spec in A0) and PR #66 tests (no isolated DB). Migration reconciliation done (33 genuinely missing, 1 server-renamed, 1 docs-only). Run-119 vulnerabilities documented and fingerprinted. |
| A1 | COMPLETE for the audit scope. Tally switch traced to the agent side, not the job params. Interest/exceptional classification table done. D-012 comparison inputs and Fuel analysis done. OPEN dependencies: Finance normal budget, Fuel vouchers (request drafted), Tally agent template. |
| A3 | COMPLETE for the audit scope. 125-product evidence table plus simulator cross-check. OPEN dependencies: production validation of route intensity (A3-F6), pre-Jul-2025 batch history. |
| A4/A5/A9 | STARTED: `ARCHITECTURE_UPGRADE_STRATEGY.md` (PROPOSAL). |
| A6 | PARTIAL: lifecycle immutability findings in A0 sweep 2. |
| A2, A7, A8, A10, A11 | NOT STARTED (A7 blocked on Sheets, A10 on an isolated DB). |
