# SASV Costing Suite — Orchestration and Completion Register
Date: 2026-11-01 (IST). Status: DRAFT; pending owner review and merge approval.
Baseline: main 5c5b7ba (PR #113), cache hub-cache-v387. This document does not override existing owner approvals, decision records, or migration safeguards.

## Assignment and authority
- Owner: final approval on production writes, migrations, destructive actions, changing business policy, approval/finalisation/locking, and merges (exact existing approval sentence).
- ChatGPT: primary orchestrator, read-only server investigator and database engineer; prepares dependency order, server designs, preflight/rollback/postflight and independent PR audit; may make safe documentation proposals via draft PR. No production write without exact written owner approval.
- Claude Code cloud: client implementation only, supplied by self-contained bulk briefs, one draft PR per package, never merges or migrates.
- Aryabhatta/Grok: retained for decision-log handoff and review when available; do not create two contradictory authoritative registers.
- Jarvis: mandatory e-Aushadhi/cache coordination before a cache bump.
- Owner interaction only at genuine approvals, policy choices, or real UI walkthroughs. Design choices with no business/policy risk may be resolved autonomously and documented.
- Tool sessions are not background workers: orchestration happens when a ChatGPT turn or explicit authorised scheduled task runs. Claude sessions require the owner to launch/relay briefs unless a supported direct connector is available.

## Non-negotiable controls
- Approved historical runs immutable; draft never becomes pricing source without owner finalisation.
- No production DML, DDL, migration, RPC with side effects, refresh, approval, lock, flag enablement, or merge without prior explicit authorisation per current rules.
- Do not call approval-preview RPC against production from tools/tests.
- Never reapply migration 20261015045233. No legacy-remnant retention without a genuine dependency.
- Client functionality behind exact-value-1 flags, default off. Lock flag off for open months until CI-049 live.
- Backend owns business rules and authorisation; client must not simulate authority or bypass protected data.
- Snapshot current main SHA, cache, tests and deployment before every package; owner-approved merge at audited head SHA; tell Jarvis before cache bump and after merge.
- Each phase entry records evidence, decision, risk, rollback and accepted completion.

## Progress rubric
Acceptance gates passed: 3/10 (30% of gates; NOT development-effort percentage).
Passed: core costing engine; scheduled month-end execution; separation of draft from approved pricing basis.
Underway: client workflow acceptance; exception handling; October finalisation; safeguards/monitoring.
Pending: historical reconciliation; client rollout/consolidation; full-cycle closing acceptance.
Promote gate only with documented evidence. No arbitrary engineering-percent estimation.

## Ordered programme
| Phase | Status | Scope | Gate / dependency |
|---|---|---|---|
| P1 | ACTIVE | Frontend-first inspect run context and review worklist: run 148 access, SKU classification, accurate cause and fix-screen navigation; approval screen walkthrough | No backend migration before October finalise as previously decided. If authorised read API missing, record blocker and prepare proposal, don't invent frontend data |
| P2 | READY AFTER P1 | Diagnose run 148: 1 blocked material, 2 material reviews, 1 pricing review, 110 prime-cost reviews; group common causes; correct source via approved screens | Preserve original 148 evidence and assess if new October candidate run required |
| P3 | BLOCKED BY P2 | Compare candidate vs 143; owner-controlled October finalisation, pricing cutover, readiness rebuild approval | Do not silently approve 148; historical fingerprints unchanged |
| P4 | PARKED UNTIL P3 DECISION | CI-049 lock guard; CI-048 monitoring schedule/alert; lock UX | Separate approval, tests and rollback |
| P5 | PARKED | June-August historical reconciliation, old periods and run-119 baseline; regional marketing review | Owner policy decision, no retroactive silent edits |
| P6 | CLIENT PREP ALLOWED | CW-05 remaining sorting/column help; CW-06 supersede picker and family-create decision; CW-03 after-scheme margin; CW-04 glossary; CW-10 badges; CW-13 mobile; CCC-P01/P02/P03; UX-P02; NAV-P01/P02; MDC-07/WP06/WP09; regional-review UI held | Bundle related, testable changes; server-dependent reads stay gated |
| P7 | PARKED PENDING OWNER INPUT | WP10 incomplete-SKU policy, 74 machine capacities, PERF-P01, WP05, migration-history reconciliation | Seek policy only when implementation reaches gate |
| P8 | PENDING | Netlify/Node/smoke verification, flag-by-flag owner rollout, Jarvis branch coordination, retire obsolete views after dependency checks | Approval for release changes |
| P9 | PENDING | Whole-month end-to-end acceptance, failure/retry, cost-sheet/pricing traceability, permissions and closing WP12 report | All hard gates evidenced |

## Claude bulk briefs
- C1: frontend review diagnostic *without* DB changes: inspect actual screens first; run-selector / worklist visibility only when existing authorised data source supports it; draft PR; detailed test plan. Worklist currently approved run 143 not draft run 148.
- C2: correction-screen UX deficiencies observed in real run-148 walkthrough.
- C3: cohesive table, sorting, filtering, hints, export and mobile improvements.
- C4: navigation, dialogs, duplication consolidation, glossary and badges.
- C5: governance UI after server controls are approved.
- C6: release/regression/cleanup.
Never dispatch Claude to implement C2-C6 blindly; only issue briefs after current-code inspection and acceptance criteria.

## Facts and evidence (2026-11-01)
- GitHub main verified 5c5b7ba, PR #113 docs only.
- Read-only database check: run 148 valuation 2026-10-31, SUCCESS, six stages SUCCESS; 514 READY, 110 PRIME_COST_REVIEW_REQUIRED, 2 MATERIAL_REVIEW_REQUIRED, 1 PRICING_BRIDGE_REVIEW_REQUIRED, 1 MATERIAL_COST_BLOCKED.
- Run 143 still has approved designation; no approval designation for 148. Run 143 valuation 2026-10-22 and designation on 2026-10-24 UTC.
- As of handover eight client flags default off; CI-049 and CI-048 not live. Full client UI regression and deployment have NOT been independently executed.

## Parked register
CI-044; post-finalisation read-only cause-split/draft views and COST_REVIEW_WORKBENCH; CI-048; CI-049; June-Aug; regional-marketing review; machine capacities; WP10; PERF-P01; migration housekeeping; retirement of legacy dashboard views; unresolved historical smokes. Re-evaluate each only at its dependency gate, preserving all prior scope decisions.

## Immediate next sequence
1. Inspect existing frontend source/routes and read contracts read-only. Do not assume review worklist can use run 148 without run-scoped API.
2. Prepare a single tightly scoped Claude C1 brief, including starting SHA, cache pin sites, tests, flag, protected paths, file-level exclusions, and acceptance walkthrough.
3. Owner launches Claude C1 cloud session from brief; Claude creates draft PR only. Independently audit its diff and tests.
4. Owner performs genuine frontend walkthrough of run 148, classifying bugs vs missing server data. Preserve evidence and use minimum server change after proper approval.
5. Reassess P2/P3 on actual evidence; update this register in a docs PR with every meaningful milestone.
