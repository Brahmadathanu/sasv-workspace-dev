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
- **Server dependency:** [draft PR #374](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/374) proposes the approved/issued Add Line writer guard. Its isolated PG17 fixture PASS, but the migration remains **UNMERGED and NOT executed in production**. Separate owner authorization required. Client-only integrated guard rejects SQL in that branch by design; do not weaken that client safety guard.
- **Formal gates:** G0–G5 = 0/6 closed under [release readiness](PEC_ERP_RELEASE_READINESS_20261112.md). Outstanding: hosted true-identity Editor/View-only/no-access acceptance, owner phone confirmation, installed PWA freshness, packaged Windows Electron, official migration-history reconciliation, and explicit production promotion. Do not infer these PASS from fixture CI.
- **Cleanup:** preserve Git/CI audit trail, previous accepted screenshot evidence, production migrations and history. Remove only verified disposable local profiles/builds/temporary fixtures after acceptance with an itemized ledger. No production-row deletion, schema-history DML, unreviewed permission/flag changes or cleanup merely to erase traces.

## R2c owner mobile acceptance (13 November 2026)

**PASS — owner explicitly approved** the latest staged R2c phone review after inspecting Vendor-wise full-screen detail, filter-sheet typography and the native-select auto-open correction. Captured from the owner's direct reply: “Yes that i approve and passed.” Netlify preview #347 was successful and staging commit `0003fe43b3b5810f26a95553bd57840d24125177` had **8/8 GitHub CI SUCCESS** before this acceptance entry. This does not prove authenticated Editor/View-only/no-access negative tests, actual installed-PWA cache transitions, Windows packaged Electron, server Add Line guard production activation, or the originally unreproduced Action Queue→Excess transient error. Do not close formal G0–G5 or merge #347 into main on the basis of visual acceptance alone.

## Current PEC release-gate audit

See [PEC_PHASE_A_POST_R2C_RELEASE_GATE_AUDIT_20261113.md](PEC_PHASE_A_POST_R2C_RELEASE_GATE_AUDIT_20261113.md) for the latest owner visual PASS, 8/8 verified staging CI, the live Add Line writer gap, the ten unregistered PEC migrations, the G0–G5 dispositions and the retained post-acceptance cleanup controls. This evidence **does not** authorize production SQL or main promotion.
