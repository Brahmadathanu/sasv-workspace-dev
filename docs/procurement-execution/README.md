# Procurement Execution Console — Governance Index

**Programme:** SASV Procurement Execution Console (PEC) Traceability, Access & Reliability
**Created:** 2026-10-09
**State:** Governance baseline is on main; implementation NOT authorized by this document.

## Reading order
1. [MASTER_PROGRAMME.md](MASTER_PROGRAMME.md) — objective, work packs, gates, dependencies, status.
2. [IMPLEMENTATION_RULES.md](IMPLEMENTATION_RULES.md) — non-negotiable working culture, server/client ownership, authorizations and verification.
3. [WP01_TRACEABILITY_ACCESS_CORRECTION.md](WP01_TRACEABILITY_ACCESS_CORRECTION.md) — current evidence, bounded corrections and acceptance matrix.
4. [CHANGELOG_DECISIONS.md](CHANGELOG_DECISIONS.md) — durable business decisions and proposals.
5. [ERP_C1_CLIENT_MODERNISATION_20261111.md](ERP_C1_CLIENT_MODERNISATION_20261111.md) — PEC-ERP-C1 client UI/UX modernisation: audit matrix, tests, server dependencies.
6. [ERP_C2_IMMEDIATE_VENDOR_SELECTION_20261111.md](ERP_C2_IMMEDIATE_VENDOR_SELECTION_20261111.md) — PEC-ERP-C2 immediate vendor selection from Indents.
7. [WORKPACK_HANDOVER_TEMPLATE.md](WORKPACK_HANDOVER_TEMPLATE.md) — complete continuity record when changing chat or executor.

## Authority hierarchy
Live Supabase state = server truth; current GitHub main = repository truth; approved programme/WP documentation = workflow and decision truth; conversations = supporting evidence. A document drafted in a feature branch is **not** an approval to mutate production.

## Cross-programme safety
Keep e-Aushadhi, Costing Suite, stock reconciliation and all other modules independent. Never overwrite other programme documentation or interpret their milestones as PEC authorization.

## Phase A R2c handover — 13 November 2026 (staging only)

- **Integration staging branch:** `integration/pec-erp-staging-20261112`; R2c client-only [PR #378](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/378) merged after exact-head 2/2 client CI PASS, merge commit `81e05b8a2bf80e20720d36de2c72dd5a44a57cd4`. This is **not** main, production or formal owner sign-off.
- **Owner UX work:** R1 #365, R2 #373, R2b #376, R2c #378 integrated into staging; owner has now expressly **APPROVED/PASSED the R2c mobile visual corrections** on the hosted preview (13 Nov 2026; owner statement). This is scoped UI acceptance, not real-role, installed-PWA, Electron or production authorization. Track [R2c issue #377](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/377), parent [#375](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/375), and [R2c evidence/report](PEC_PHASE_A_R2C_20261113.md).
- **R2c outcomes:** Vendor-wise detail full-screen on phones with footer total and bottom Close removed; all seven filter sheets use shared styling, headings receive focus instead of iOS native select on open; Excess loading failures receive classified/sanitized diagnostics and bounded Retry. The original intermittent Action Queue→Excess failure was **not reproduced** and must **not** be labeled conclusively fixed. Genuine iOS and role acceptance pending.
- **Server dependency:** [draft PR #374](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/374) proposes the approved/issued Add Line writer guard. Its isolated PG17 fixture PASS, and the exact reviewed wrapper was **executed in production with owner authorization** (13 Nov 2026; function MD5 `a19fabfd29ffba4d937df1bbf09453c2`). PR #374 is still **UNMERGED** and its migration version **NOT registered**. Genuine-role negative acceptance and official migration-history reconciliation remain outstanding. Client-only integrated guard rejects SQL in that branch by design; do not weaken that client safety guard.
- **Formal gates:** G0–G5 = 0/6 closed under [release readiness](PEC_ERP_RELEASE_READINESS_20261112.md). Outstanding: hosted true-identity Editor/View-only/no-access acceptance, owner phone confirmation, installed PWA freshness, packaged Windows Electron, official migration-history reconciliation, and explicit production promotion. Do not infer these PASS from fixture CI.
- **Cleanup:** preserve Git/CI audit trail, previous accepted screenshot evidence, production migrations and history. Remove only verified disposable local profiles/builds/temporary fixtures after acceptance with an itemized ledger. No production-row deletion, schema-history DML, unreviewed permission/flag changes or cleanup merely to erase traces.

## R2c owner mobile acceptance (13 November 2026)

**PASS — owner explicitly approved** the latest staged R2c phone review after inspecting Vendor-wise full-screen detail, filter-sheet typography and the native-select auto-open correction. Captured from the owner's direct reply: “Yes that i approve and passed.” Netlify preview #347 was successful and staging commit `0003fe43b3b5810f26a95553bd57840d24125177` had **8/8 GitHub CI SUCCESS** before this acceptance entry. This does not prove authenticated Editor/View-only/no-access negative tests, actual installed-PWA cache transitions, Windows packaged Electron, genuine-role Add Line negative test results, or the originally unreproduced Action Queue→Excess transient error. Do not close formal G0–G5 or merge #347 into main on the basis of visual acceptance alone.

## Current PEC release-gate audit

See [PEC_PHASE_A_POST_R2C_RELEASE_GATE_AUDIT_20261113.md](PEC_PHASE_A_POST_R2C_RELEASE_GATE_AUDIT_20261113.md) for the latest owner visual PASS, 8/8 verified staging CI, the owner-authorized live Add Line guard deployment and its unregistered version, the ten other unregistered PEC migrations, the G0–G5 dispositions and the retained post-acceptance cleanup controls. This evidence **does not** authorize production SQL or main promotion.

**Latest production/security update:** owner-authorized guarded replacement of `proc_indent_add_line` applied 13 Nov. See the dated addendum of the [release gate audit](PEC_PHASE_A_POST_R2C_RELEASE_GATE_AUDIT_20261113.md). No `main` promotion, live data edits, historical migration registration, real-role acceptance or cleanup occurred.

## Live security acceptance and migration-history control (13 November 2026)

The [authenticated-role and migration-reconciliation runbook](PEC_AUTHENTICATED_ROLE_AND_MIGRATION_RECONCILIATION_PLAN_20261113.md) is the current handover for the next release gates. Live read-only recheck confirms the approved Add Line guard and ACL, **45 approved headers / 1,593 lines**, and **0/11 PEC migration versions registered** (#317 seven, #323 three, #374 one). Previously documented **ten** refers only to #317/#323; #374 creates the eleventh unregistered version. Real-role negative tests and approved fixture-based positive tests remain outstanding. This does not authorize write tests, history DML, broader cleanup or merging to main.

## Migration-effect audit R1 — 13 November 2026

See [PEC_PHASE_A_MIGRATION_EFFECT_AUDIT_R1_20261113.md](PEC_PHASE_A_MIGRATION_EFFECT_AUDIT_R1_20261113.md) for read-only live source parity: four stock masters in g (4/4), exact 13 BOM corrections (13/13), all ten G1 paged/filtered/operational RPCs present with expected authenticated/anon/PUBLIC ACL and View-guard checks. This is **bounded parity**, not full function-body equivalence or signed-in role acceptance. None of eleven PEC migration versions are registered. The live Add Line guard is deployed independently, while genuine-role/write/concurrency and official history remediation stay gated.

## Function-body parity R2 — 13 November 2026

Independent read-only comparison of the GitHub-reviewed migration source against live `pg_get_functiondef` found **21/21 normalized PL/pgSQL bodies MATCH** (#323 ten paged read functions, #317 ten final internal/MRP definitions, #374 one live Add Line wrapper). Details, scope and limitations: [PEC_PHASE_A_MIGRATION_EFFECT_AUDIT_R1_20261113.md](PEC_PHASE_A_MIGRATION_EFFECT_AUDIT_R1_20261113.md), R2 addendum. The original 0/11 PEC migration-history registration remains; matched bodies **do not** authorize marking a migration applied. Genuine-role execution and other data/metadata checks remain open.

## Authenticated acceptance handoff — 13 November 2026

The [operator packet](PEC_PHASE_A_AUTHENTICATED_ACCEPTANCE_OPERATOR_PACKET_20261113.md) states exactly what can be verified under real authorized Editor, View-only and no-access sessions without creating or changing production procurement records. The existing interactive browser harness checks UI/read-only status only; **it does not test direct server-side no-access RPC denial or writer rejection**. Such checks remain NOT TESTED until real-session evidence exists. Do not close G0–G5 on synthetic fixtures, function metadata, or a hidden UI alone.

## Genuine-session negative RPC harness — staging integration (13 November 2026)

PR [#381](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/381) merged into **staging only** at `e3adc0b1d534c11498220abcdad6f41b3e146c1b` after exact-head PEC Integrated Browser Acceptance **SUCCESS** at `facf27570a6a438e118c2557389ad8c9cd878859`. The existing interactive operator harness now probes a no-access role using a single-row read RPC and a View-only role using an explicitly nonexistent indent ID `0`; it requires actual current user authentication, a permission-specific HTTP error, and emits only sanitized metadata. If the session is absent, outcome is **BLOCKED** and the process exits nonzero. SQL/SW protected guards passed. **No genuine user-role run was executed during CI or the merge.** Production, `main`, migration history, live permissions and procurement records unchanged. Real signed-in role acceptance, installed PWA, packaged Electron and official migration reconciliation remain NOT TESTED / pending. Formal G0–G5 0/6 closed.

## Negative-role harness R2 fail-closed parity — 13 November 2026

[PR #382](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/382) passed its exact-head PEC Integrated Browser Acceptance CI at `9fb26ebf135d2d933cf6b7f4d9d9e60a48387540` and merged **only into PEC staging** at `932fae916d9e8240a66b3a75e62e21c46600ab7b`. The interactive operator harness now requires **both** no-access read and View-only invalid-key writer permission probes to produce a real HTTP rejection (>=400) and an expected authorization error. The test protects this two-probe symmetry; missing authenticated identity remains BLOCKED and exits nonzero. Operator instructions now use `PEC_PLAYWRIGHT_MODULE`, and accurately describe the zero-key writer permission probe. This is a reviewed **test-tooling change only**; no real authenticated-role runs have occurred. No production/main deployment, schema/permissions/data change or migration-history registration. G0–G5 remain 0/6 closed.

## Official migration-history reconciliation decision (13 November 2026)

See [PEC_MIGRATION_HISTORY_RECONCILIATION_GOVERNED_PLAN_20261113.md](PEC_MIGRATION_HISTORY_RECONCILIATION_GOVERNED_PLAN_20261113.md). The currently documented Supabase CLI `migration repair --status applied --remote` marks verified **already-effective** migrations without replaying SQL, but cannot be executed before source integration and per-version effect parity are approved. All 11 PEC versions are still unregistered. Draft/server PRs #317, #323 and #374 remain unmerged; the #374 wrapper is effective in production. **No history repair, new live SQL, or main promotion is authorized by this plan.**

## MRP helper RBAC audit R4 — 13 November 2026

The [migration-effect audit](PEC_PHASE_A_MIGRATION_EFFECT_AUDIT_R1_20261113.md) R4 addendum independently verifies the live `20261112150000` strict UOM helper's SECURITY DEFINER mode, `pg_catalog, public` search path, authenticated/service-role EXECUTE grant, anon/PUBLIC denial, and underlying conversion table isolation. The observed current grant on `inv_uom` is recorded separately without claiming the migration introduced it. **The version remains unregistered** and genuine JWT behavior has not been tested; no migration-history or production access change was made.

## Historical internal-material guard evidence R5 — 13 November 2026

The [migration-effect audit R5](PEC_PHASE_A_MIGRATION_EFFECT_AUDIT_R1_20261113.md) confirms 35 positive active PR lines and 11 positive approved indent lines involving currently classified internal semi-finished/finished-bulk materials are **all created before 12 November**, with none updated on/after 12 November. This is **bounded legacy-record preservation**, not an end-to-end proof of the writer guards and not authorization to delete or reconcile history. Real authenticated negative-role and concurrency acceptance remain NOT TESTED.

## SAFE-resync mapping audit R6 — 13 November 2026

A read-only [mapping-integrity R6 audit](PEC_PHASE_A_MIGRATION_EFFECT_AUDIT_R1_20261113.md) found **3 stock-item identity mismatches among 1,023 PR-to-indent line mappings**, plus **2 PR-linked indent lines without line mappings**. All are historical (pre-Nov 12), with no recorded updates since Nov 12; no causation or corruption is inferred. The six PR-linked headers each have exactly one active header mapping. [Issue #383](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/383) tracks provenance and disposable-fixture SAFE/RESET tests. Migration `20261112143000` stays **PARTIAL — REVIEW REQUIRED**, even though its function body matches source. No live resync, row editing, or migration-history registration occurred.

## SAFE/RESET isolated PG17 evidence R7 — 13 November 2026

Exact owner-reviewed PR #317 resync function was exercised in disposable PostgreSQL 17 by [test-only PR #384](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/384) with **PASS** CI at `a7433188af8957cbde00e9a82988fa1e659ce65e`. Test-only fixture merged into **#317's unmerged feature branch**, not staging or main. See [R7 audit](PEC_PHASE_A_MIGRATION_EFFECT_AUDIT_R1_20261113.md). SAFE preserves unrelated unmapped manual lines, but **overwrites and remaps an unmapped manual line when its item identity matches an active PR line**; RESET discards manual lines. This policy distinction is under [issue #383](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/383), which remains open alongside the three historical wrong-stock-item line maps. Isolated functional PASS does **not** clear historical data provenance or migration registration `20261112143000`. No live resync, migration-history repair or release promotion.

## SAFE resync identity-collision decision brief R8 — 13 November 2026

The [R8 policy brief](PEC_G0_SAFE_RESYNC_COLLISION_POLICY_DECISION_R8_20261113.md) expands [issue #383](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/383) using read-only historical quantity/timestamp evidence and the PASS result of isolated PG17 fixture #384. All three wrong-item mapped lines happen to share quantity with their mapped PR line; the two unmapped-but-PR-matching lines have **different quantities** from the current PR. **Proposed—not approved:** fail closed before SAFE writes on a mismatched-quantity collision, requiring an operator choice. Existing SAFE/RESET implementation stays unchanged, historic approved indents untouched, migration `20261112143000` remains history-repair blocked. Formal G0–G5 remain open.

## SAFE collision prototype R9 — synthetic red/green verification (13 November 2026)

Draft [PR #385](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/385), against the still-unmerged #317 source branch, passed disposable PG17 CI at `95f3b8cd571cf64ef1a8ea0a4ef1a33699936fcd`. The existing SAFE function was first observed silently overwriting a colliding unmapped manual line in a rolled-back fixture transaction; the prospective replacement under `scripts/` then rejected the same quantity collision (SQLSTATE `23514`) with no line/mapping changes. See the [R8/R9 decision brief](PEC_G0_SAFE_RESYNC_COLLISION_POLICY_DECISION_R8_20261113.md). **No official migration, client resolution UX, concurrent writer guarantee or real-JWT acceptance exists yet.** PR #385 remains DRAFT; issue #383 and migration-history hold remain OPEN; no production or `main` update.

## Final PEC release technical package for Claude Cloud — 13 November 2026

[GitHub issue #388](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/388) is the **single master bulk execution handover** to complete R9 SAFE collision/concurrency work, guarded PEC client resolution UX, genuine-role operator readiness, eleven-version migration source/history reconciliation and the final G0–G5 release gate matrix. This is a **draft-PR and CI evidence package only**, not authority to deploy, execute production SQL, repair history, change grants, edit approved indents, merge `main` or sign off acceptance. Any actual Editor/View-only/no-access role tests remain NOT TESTED until performed through real signed-in identities. Previous R8/R9 audit notes remain evidence, but #388 supersedes open-ended exploratory rounds as the finalization execution queue.

## Finalization package #388 — 13 November 2026
Draft PRs #389 (server R10), #390 (client R12), #391 (evidence). See [final gate matrix](PEC_FINAL_RELEASE_GATE_MATRIX_20261113.md), [operator runbook](PEC_OPERATOR_EXECUTION_RUNBOOK_20261113.md), [migration matrix + CLI plan](PEC_RELEASE_MIGRATION_MATRIX_20261113.md) and the R10 note on #389. Formal G0–G5 remain 0/6 closed; no genuine-role test has been performed.
