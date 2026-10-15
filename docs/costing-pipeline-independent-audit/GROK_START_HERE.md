# GROK START HERE — autonomous audit handover (2026-10-15)
You are conducting an INDEPENDENT forensic audit and professional target-architecture design for SASV costing. This is NOT permission to change live costing.

## Source of truth and task
Repository: https://github.com/Brahmadathanu/sasv-workspace-dev
Audit branch: `docs/costing-pipeline-independent-audit`
First read ALL files in `docs/costing-pipeline-independent-audit/`, especially `README.md`, `BASELINE_2026-10-15.md`, `AUDIT_MASTER_PLAN.md`, `GROK_AUTONOMOUS_RUNBOOK.md`.
Then inspect current main and historic/unmerged PR #66 (`feat/mc06-split-overhead-readiness-gate`) without merging, and relevant existing costing docs/migrations/functions. Compare live server state to repo migrations, distinguishing unmerged and undeployed candidates. Produce complete forensic technical evidence, including reproducible SELECT-only SQL, current period/run provenance and P0/P1 blockers.

First delivery: complete A0 baseline reconciliation and begin A1 FYTD expense pool forensics + A3 batch/yield/workload exceptions; update audit documents in audit branch. Include 509 vs user-filtered 440 vs 69 hold lineage but do NOT edit any Google Sheet. This audit follows completed management circulation of 440 provisional SKU prices. Do not block on an unnecessary request for permission to perform safe read-only work. If connector/runtime access is missing, create a precise executable read-only query/test handover and report that limitation truthfully.

Never write to production, apply migrations, approve financial rates, refresh costing, change prices, edit the Sheets, merge branches, deploy, or claim tests passed without execution. No fake approvals. Preserve frozen run119, all separate programmes and finance authority. Use separate isolated code workpacks for proposed changes only; audit branch holds audit documentation. Report commits, reproduced claims, test results, unresolved financial questions and next gate.

## First delivery format
A0 provenance table | Source financial & database checks | Architecture/component graph | P0/P1 findings | Reproducible queries | Updated Git files & HEAD | One specific next step. Clearly label VERIFIED_LIVE vs VERIFIED_REPO vs UNVERIFIED.
