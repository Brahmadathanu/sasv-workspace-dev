> **Integration reconciliation (3 Nov 2026, after U11 merge):** U11 PR #144 squash-merged to `main` `cf26ae5ed6c69b9e5f52e195f033cfb94e2e781b` (pre-merge final LF 610/610 and CRLF 610/610, 0 skipped; Chromium executed). The nine Costing flags remain default OFF. Subsequent client/server evidence design is now controlled by [CLIENT_DRAFT_RUN_EVIDENCE_IMPLEMENTATION_GATE_2026-11-03.md](CLIENT_DRAFT_RUN_EVIDENCE_IMPLEMENTATION_GATE_2026-11-03.md). Supporting, not-yet-merged historical audit PRs: #141 (live Supabase), #143 (Claude baseline/client), #145 (WP05–WP12 mapping). This branch’s original base SHA `4bbadf8` remains a historical provenance marker, not the current `main`. No work-pack closure or release was triggered by U11 integration.

> **Full programme release target — owner direction 3 Nov 2026:** The new Electron version shall be planned **after completion and verification of the entire agreed WP00–WP12 programme**, not after a reduced Costing/navigation subset. Authoritative execution and Claude Cloud parallel work plan: [FULL_PROGRAMME_COMPLETION_EXECUTION_2026-11-03.md](FULL_PROGRAMME_COMPLETION_EXECUTION_2026-11-03.md). WP05/WP06/MDC-07 remain open; WP08–WP12 must receive real audit, approved implementation and closure rather than being classified as automatic nonblocking future scope. Costing run 148's 110 prime-cost reviews and related approval actions will be evaluated **through the governed client-end workflow** with authorised sign-in, not manually cleared through SQL. This is a plan and sequencing decision only; it does not approve server writes, live review approvals, flags, deployments, versioning, merging any new code PR, or a release. Supersedes the narrower release-scope suggestion in [COSTING_SUITE_COMPLETION_TO_RELEASE_2026-11-03.md](COSTING_SUITE_COMPLETION_TO_RELEASE_2026-11-03.md); its technical gate evidence remains useful.

> **Authoritative post-merge checkpoint — 3 Nov 2026 (newer than historical status entries below).** GitHub `main` = `d395d7e8031a28e56ea1b0997424932997a36636`. The Costing Tier-1 navigation feature wave is **fully integrated**: N1 #133 (`85a163f`), N3 #134 (`55acfcf`), N2 #136 (`7f46f37`), N4 #135 (`2ce8af0`), W6 #139 (`d395d7e`); N2/N3 guard repair #138 (`026c646`) also merged. Final W6 head `5c3869a`: LF 605/605 and CRLF 605/605, 0 failed/skipped/cancelled/TODO, 61 Chromium tests per run, **pre-merge**. Verified **exact Git blob/tree equivalence** between final-tested W6 head and squash-merged `main` (2,271 matching entries, 0 mismatches); a fresh post-merge execution is not claimed. All new flags remain default OFF; no deployment, cache bump, Supabase write or activation. **This completes the N1/N2/N3/N4/W6 client navigation wave only**, not WP05, WP06, MDC-07 or the wider programme: U11, signed-in populated-data acceptance, production/flag rollout and later work packs remain open. The completion-before-release decision and gate ledger are in [COSTING_SUITE_COMPLETION_TO_RELEASE_2026-11-03.md](COSTING_SUITE_COMPLETION_TO_RELEASE_2026-11-03.md). Release preflight is documented in [ELECTRON_RELEASE_READINESS_2026-11-03.md](ELECTRON_RELEASE_READINESS_2026-11-03.md); Electron repository version remains `6.1.0`; latest GitHub published release is `v6.1.0` (18 Aug 2026); release candidate/build/Windows smoke/version bump are not yet approved or performed. PWA service-worker cache remains `hub-cache-v390`. e-Aushadhi WP-07 and storage-retention work remain paused/parked respectively. Historical draft/not-started statements below are superseded by this checkpoint, not retroactively rewritten.

> **Single coordinated Costing Suite workflow entry point:** [COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md). This establishes one client/master-data programme control plane while preserving the distinct server audit evidence and e-Aushadhi WP-07 pause. *(3 Nov: documentation PR #129 is merged; this is the live entry point, no longer proposed.)*

> **Verified status — 3 Nov 2026 (supersedes the "pending review" wording of the 2 Nov banners below).**
> * `main` was verified at `86f1c18c538eea224fd3ad8198e5527413892474`. Squash-merged and no longer drafts: #129 (docs reconciliation, `1ad8e42`), #130 (WP05 audit A1–A7, `b5ca04f`), #131 (WP05-P02 Production Route corrections, `fc39b1b`), #132 (WP05-P01 Readiness usability, `86f1c18`).
> * **WP05 Tier 1 design is ACCEPTED** (owner, 2 Nov 2026): presentation-only grouping; Tier 2 consolidation not approved. WP05 itself stays open (G3/implementation packages).
> * **P01 and P02 are integrated on main**, all new behaviour default OFF (P02 behind `COSTING_PRM_CORRECTIONS_V1`). Post-merge limitations: signed-in populated-data acceptance not yet done; 51 legacy `production-route-*` smokes fail identically on pristine main (see the N1 evidence in [WP-07](WP-07-COSTING-NAVIGATION.md)).
> * **Combined baseline on pristine main `86f1c18`: 471/471 on LF and on CRLF, 0 skipped (Chromium ran).** The earlier 393 and 408 figures are historical single-PR totals and must not be added together.
> * **MDC-07 package N1 (shared navigation contract, grouped renderer, context chip/breadcrumb, flag `COSTING_NAV_GROUPS_V1`, default OFF) is IMPLEMENTED on a draft PR, awaiting independent review and owner acceptance. It is not merged and no flag is activated.** Evidence: [WP-07-COSTING-NAVIGATION.md](WP-07-COSTING-NAVIGATION.md). Remaining: N2, N3, N4, W6, U11.
> * Formal count unchanged: 5 of 13 substantive work packs accepted. No database write, migration, feature activation, cache bump, Electron release or PWA deployment happened in this series.

> **Post-merge documentation checkpoint — 2 Nov 2026 (pending review):** Costing client PRs #126 (CW-06), #127 (CW-13) and #128 (CW-07) are squash-merged on GitHub `main` at `3d0b6185f4351469cf23969beefac0e8875e0c2e` (respective merge SHAs `4f1cb406`, `86b4ad5e`, `3d0b6185`). Their combined **393/393 LF and CRLF** regression outcome was reported by Claude for the reconciled PR head; the final merged `main` has not yet been independently retested. Cache v390 remains designated; deployment is not independently established. The 1 Nov current-state and remaining-work documents below are historical snapshots and need an authoritative 2 Nov reconciliation. The *3/10 formal gates* displayed in chat has not been traced to a formal ten-gate ledger; do not treat it as official programme completion. WP05 rationalisation and MDC-07 navigation work are **not automatically closed** by these hardening packages. Production Route Historical Candidate Review navigation defects and the database-sourced Home label remain deferred. **No database writes or flags activated.**

# SASV Master Data Governance, Product Lifecycle & Costing Suite UX Consolidation

> **Update 31 Oct 2026:** current state is in [CURRENT_STATE_2026-10-31.md](CURRENT_STATE_2026-10-31.md) and remaining work in [REMAINING_WORK_2026-10-31.md](REMAINING_WORK_2026-10-31.md). Since 26 Oct: CI-040 to CI-047 and CI-050 are live (CSE-P01 is done); costing screen PRs #99 to #106 are merged with seven switched-off flags; `main` is `9ea163d`, cache `hub-cache-v383`. The "Active work pack", "Major unresolved blockers" and "Immediate next action" sections below describe 8 Oct 2026 and are historical.

> **Status update 25 Oct 2026 (read-only audit):** this programme was dormant from 8 Oct 2026. Costing work after that date ran under `docs/costing-pipeline-independent-audit/` (see its `CURRENT_STATE.md`). WP-1 and WP00–WP04 are done and verified on main and live. SEC-P01 is done live. The old "WP07" here is renamed **MDC-07** so it is not confused with the e-Aushadhi WP-07 programme. Every remaining item and its proposed disposition is in [MDC_WORKFLOW_STATUS_AND_CLOSING_PLAN.md](MDC_WORKFLOW_STATUS_AND_CLOSING_PLAN.md). The programme is **not closed yet**. References below to Run 115 and Build 4 are history; current approved runs are 122 (Sep, locked) and 143 (Oct).

> **Update 26 Oct 2026:** CI-038, CI-038a and CI-039 applied live and recorded in the repo; SKUs 41 and 846 activated. See CHANGELOG_DECISIONS.md (2026-10-26).

## Authority
This directory is the durable workflow authority for this programme. Live Supabase state governs server reality; current Git main governs repository reality; approved programme documents govern workflow state; chat is supporting context.

## Business objective
Make Product/SKU creation and lifecycle governance complete, understandable and future-proof, while simplifying Product and Costing Suite information architecture without losing specialist capability.

## Problem statement
Product/SKU creation can leave downstream costing foundations incomplete or obscure. Costing correctly fails closed, but remediation is distributed and users must know hidden dependencies. Product and Costing launch surfaces have also accumulated specialised destinations requiring evidence-based rationalisation.

## Approved scope
Product/SKU lifecycle and completeness; costing-foundation dependency inventory; central readiness/remediation; Costing Suite rationalisation; Pricing Policy Manager; Product/Master Data and wider launcher IA; recurrence safeguards; UX consistency; regression/live proof and governance documentation.

## Non-goals
No guessed master data. No rewriting historical/effective-dated evidence. No weakening fail-closed costing. No wholesale visual redesign before architecture. No deletion/merger of modules without usage/dependency evidence. No e-Aushadhi changes.

## Architectural principles
- Supabase/server is authoritative for business rules, lifecycle contracts, effective dating, validation and governance.
- Client must not duplicate authoritative server logic.
- UNKNOWN is not READY; missing evidence stays incomplete; REVIEW_REQUIRED remains review; BLOCKED cannot be bypassed.
- Entity existence, operational activation, master-data completeness, costing-foundation completeness and costing readiness remain distinct until live evidence proves exact contracts.
- Completeness must be explicit and remediation guided.
- Historical evidence is immutable.
- Progressive disclosure keeps normal tasks prominent while specialist/audit detail remains reachable.

## Work-pack inventory
- [x] WP-1 — Repository Programme Control Plane
- [x] WP00 — Authoritative Current-State Inventory
- [x] WP01 — Canonical Product/SKU Completeness Contract
- [x] WP02 — Product + SKU Lifecycle Redesign — COMPLETED, VERIFIED, AND MERGED
- [x] WP03 — Creation-Time Guided Completeness — COMPLETED, VERIFIED, AND MERGED
- [x] WP04 — Central Master Data / Costing Readiness Control Centre — COMPLETED, VERIFIED, MERGED, AND CLOSED
- [~] WP05 — Costing Suite Functional Rationalisation Audit — audit merged (#130); Tier 1 design ACCEPTED 2 Nov 2026; P02 (#131) and P01 (#132) merged; WP05 remains open; see WP-05 document
- [ ] WP06 — Pricing Policy Manager Simplification
- [~] MDC-07 (was WP07) — Costing Suite Navigation and Information Architecture — N1 implemented on a draft PR (3 Nov 2026), awaiting review; N2/N3/N4/W6/U11 not started
- [ ] WP08 — Product / Master Data Navigation Rationalisation
- [ ] WP09 — Wider Application Launcher/Section Audit
- [ ] WP10 — Governance Safeguards for Future Product/SKU Creation
- [ ] WP11 — UX Consistency and Visual Hardening
- [ ] WP12 — Regression, Live Proof and Governance Documentation

## Work-pack dependencies / delivery order
WP-1 → WP0 → WP1 → WP2–WP4 → WP5–WP7 → WP8–WP9 → WP10 → WP11–WP12. Later phases do not start because an attractive future idea appears.

## Programme status
IN PROGRESS: closing. Current remaining items: REMAINING_WORK_2026-10-31.md (31 Oct 2026). Earlier list and dispositions: MDC_WORKFLOW_STATUS_AND_CLOSING_PLAN.md (25 Oct 2026)

## Active work pack
None formally accepted as active (see 3 Nov status above). WP04 — Central Master Data / Costing Readiness Control Centre is completed, verified, merged, and closed. *Updated 3 Nov 2026:* WP05 audit evidence (A1–A7) merged as #130; the owner accepted the WP05-G2 Tier 1 design on 2 Nov 2026; P02 (#131) and P01 (#132) are merged; MDC-07 package N1 is implemented on a draft PR awaiting independent review. No package other than N1 is authorised. Formal count unchanged: 5 of 13 substantive work packs accepted.

## Active gate
None. WP04-G8 is completed and post-merge verification passed.

WP04 merged to `main` as `1ff8d13e90b5078dde7e414e3c257cf41aa6f34b` with parent 1 `a007cea4d624835dc5406a952657769868619649` and parent 2 `836ff0e9e9fd8dbe27061dde2a6346236466b2a4`. G0–G8 are complete. Formal G7 remains PASS; Track A remains CLOSED / APPLIED / PROVEN; Track B remains accepted at runtime candidate `47b07b4bdb92f9d2d471c61569045c8f24f1cac5`. Post-merge verification confirmed the merged tree matches the verified branch tree, Build 4 remains current/COMPLETED with Run 115 and 1793/611 populations, source fingerprint matches, Readiness RPC and CSE-P01 are unchanged, and no new statement-timeout or legacy-dashboard-summary log event was found in the checked post-merge window. No GitHub CI evidence is claimed. WP05 remains not started.

## Overall completion progress
5 of 13 substantive work packs (WP00–WP12) are completed, verified, and merged where applicable. The prerequisite control plane, WP00, WP01, WP02, WP03, and WP04 are complete. WP04 merged to `main` as `1ff8d13e90b5078dde7e414e3c257cf41aa6f34b`; its final synchronized feature head was `836ff0e9e9fd8dbe27061dde2a6346236466b2a4`, while the signed-in runtime candidate verified in G7 was `47b07b4bdb92f9d2d471c61569045c8f24f1cac5`. WP02 merged to `main` as `7948551bd48e9ab6113e21df3a2cd98946a25362`; its final feature tip was `6247a7bccb862d679071f68843523156ce6e5cb3`. WP03 merged to `main` as `dd7da3a6fa2f447a71d92ca091f3d18921e32968`; its verified feature tip was `3894ce43798e4d9d919dfac54c8ab11aa7168733`.

## Major locked decisions
- Server-authoritative completeness.
- Operational Active does not automatically mean Costing Ready.
- Review states are not converted to Ready without evidence.
- No new top-level module until later IA audit proves it is required.
- No Product/Costing redesign before WP0 closes.
- WP01 readiness is multidimensional and server-authoritative; clients consume the canonical contract rather than recomputing it.
- Product detail is the Product/SKU lifecycle anchor; SKU master, activation and readiness remain separate.
- Product Master readiness uses LIVE_AS_OF only for an explicit server-governed period.
- Manage Products readiness visibility does not require granting Costing Control Center module access.
- DEC-011 autonomous gate-based client implementation remains LOCKED.
- DEC-014 server/client execution ownership remains LOCKED.
- DEC-015 WP04 G4 closure / measured performance limitation / mandatory G7 native verification remains LOCKED.

## Major unresolved blockers
No WP02/WP03 blocker remains. Parked items stay parked for their assigned later work:

- UX-P02 → WP11.
- NAV-P01 / NAV-P02 → WP08.
- ~~CSE-P01 commercial-sales LIVE_AS_OF multi-row authority~~ → DONE: owner chose option B on 26 Oct 2026; CI-050 applied live 31 Oct 2026.
- PERF-P01 broader portfolio-readiness performance architecture → separate future architectural decision.
- WP05 park candidates from Track B acceptance (SKU Control Status ↔ Readiness rationalisation; wider Costing/Pricing Policy Manager duplication audit; parked legacy dashboard-summary dependency audit) → WP05; they remain parked. *(Superseded 3 Nov 2026: WP05 started on 2 Nov; its audit, Tier 1 design acceptance, P01 and P02 are on main.)*

No Track A rerun is required without fresh defect evidence.

## Immediate next action
WP04 is closed; do not reopen it without fresh regression evidence. *(3 Nov 2026)* WP05 is open and its Tier 1 design is accepted; the next step is independent review of the N1 draft PR, then (each on its own written brief) N2, N3, N4, W6 and U11 in the order of [A6](WP05_A6_IMPLEMENTATION_PACKAGE_PLAN_2026-11-02.md). Signed-in populated-data acceptance of P01/P02/N1 and the owner decisions in A5 remain open.

## Server development operating model
ChatGPT owns server planning/review, direct implementation and live verification through Supabase. Server delivery is not gated on GitHub commits/PRs/merges or local CLI migration tooling. Reviewed high-risk packages, target/rollback safeguards, operation evidence and live verification remain required. Repository MD records workflow; optional SQL evidence is traceability, not a client-style server delivery gate. See DEC-014 and IMPLEMENTATION_RULES.

## Client development operating model
Routine bounded client work uses the repository autonomous gate model: ChatGPT freezes one complete work package; Cursor/Codex autonomously analyze, implement, test, self-review, fix, commit and push on an isolated task branch/worktree; ChatGPT audits the pushed GitHub implementation and may request one consolidated correction pass before explicit merge approval.

High-risk work retains a separate Plan → ChatGPT review → Implementation gate. Existing WP-specific plan gates remain valid when they involve architecture, authorization/permissions, database/schema/RPC contracts, production-data mutation risk, destructive operations, major cross-module refactoring, unclear business rules, or security-sensitive behavior.
