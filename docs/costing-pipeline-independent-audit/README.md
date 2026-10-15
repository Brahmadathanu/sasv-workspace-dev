# SASV — Independent Costing Pipeline Audit and Architecture Review
**Initiated:** 2026-10-15. **Status:** OPEN / BASELINE INVENTORY. **Owner:** SASV production/finance governance. **Automation collaborator:** Grok, subject to these controls.

## Authority and separation
This is a stand-alone *audit programme*; it is NOT the existing `docs/master-data-costing/` product/master-data UX programme, NOT e-Aushadhi, and NOT the manufacturing pricing implementation workstream at `docs/manufacturing-costing-price-revision/`. Audit findings can propose corrective workpacks to those owners but never silently amend their rules, approvals or database. Repository branch: `docs/costing-pipeline-independent-audit`, created from main; merges require user authorisation.

Read in order: (1) README, (2) BASELINE, (3) AUDIT_MASTER_PLAN, (4) AUDIT_EVIDENCE_LEDGER, (5) GROK_AUTONOMOUS_RUNBOOK, (6) ARCHITECTURE_TARGET, (7) workpack artefacts as added. Read source programme docs and **current** SQL/migrations/functions independently. Live Supabase schema and snapshot results are source of operational truth, current Git main the code baseline, approved policies are financial authority. A prior chat, draft PR or this audit plan is **not** proof of deployment.

## Mission
Complete an inch-by-inch traceable audit of accounting inputs → source ETL → canonical masters → product/BOM/batch/pack → expense heads and source pools → cost behaviours/rate policies → production workloads and yield → product and SKU allocations → manufacturing COP → internal loaded cost → marketing/pricing bridge → commercial schemes and proposal → client display/export. Check temporal, numerical, accounting, operational, access-control and UX integrity. Produce an evidence-backed modern, professional, governable costing-suite target architecture and phased implementation plan, NOT an opportunistic code rewrite.

## Non-negotiable boundaries
- Frozen run119, valuation 2026-09-10, period 2026-09-01 is immutable. No historical mutation, backfill or refresh.
- Never trigger client/server refresh; only the user may launch a new client refresh after explicit authenticated release clearance.
- No write to live DB, no migration apply, no status/approval changes, no policy alterations, no production cost recalculation.
- Do not edit the shared Google Sheet or its management-review derivative without a separately scoped user approval.
- No fabricated rate approvals, causal drivers, batch output, actual expenditure, normal capacity or Finance signoff.
- SQL reads: SELECT only; code changes on isolated branches only; avoid unrelated modules and e-Aushadhi.
- Explicit status semantics: VERIFIED_LIVE, VERIFIED_REPO, TESTED_ISOLATED, ANALYTICAL_ONLY, PROVISIONAL, UNVERIFIED, BLOCKED. No claim of PASS if only code exists.
- Every finding requires source object, date/run, reproduced query or code link, observed and expected result, severity, financial exposure, owner, remediation and retest.
- Grok or other agents cannot independently authorise pricing, production deployment, active engine cutover, merges or runtime refresh.
- Stop for approval at finance policy/rate choices, semantic model changes, write operations, merges or client refresh.

## Artifacts and cadence
Update `AUDIT_EVIDENCE_LEDGER.md` after every evidence sweep, `AUDIT_MASTER_PLAN.md` when gate changes, `DECISIONS_AND_OPEN_QUESTIONS.md` for durable decisions, `ARCHITECTURE_TARGET.md` only from cited evidence. Maintain one workpack at a time and a single concise handover log. Finish each workpack with reproducible read-only tests, counterexamples, risk-ranked findings, signoff matrix and user-facing summary. Once audit passes, propose implementation workpacks separately.
