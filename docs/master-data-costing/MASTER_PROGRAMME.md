# SASV Master Data Governance, Product Lifecycle & Costing Suite UX Consolidation

> **Status 30 Oct 2026 (checked read-only against main `008fc26` and production):** WP-1 and WP00–WP04 done. WP05 and WP12 **partly done**; WP06–WP11 not started (dispositions in [MDC_WORKFLOW_STATUS_AND_CLOSING_PLAN.md](MDC_WORKFLOW_STATUS_AND_CLOSING_PLAN.md)). Costing redesign v2 and CI-046/CI-047 are live; PR #99 (approval screen, flag `COSTING_APPROVAL_SCREEN_V1`) and PR #100 (Refresh with date, flag `COSTING_RECALC_WITH_DATE_V1`) are merged with flags **OFF**; service worker `hub-cache-v377`. Client code is now built by **Codex** (Phase A plan only → Phase B after the owner's written authorisation); older mentions of ChatGPT/Cursor below describe past work. Document map: [README.md](README.md). Live picture: [ALIGNED_STATUS_2026-10-30.md](ALIGNED_STATUS_2026-10-30.md).

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
- [ ] WP05 — Costing Suite Functional Rationalisation Audit
- [ ] WP06 — Pricing Policy Manager Simplification
- [ ] MDC-07 (was WP07) — Costing Suite Navigation and Information Architecture
- [ ] WP08 — Product / Master Data Navigation Rationalisation
- [ ] WP09 — Wider Application Launcher/Section Audit
- [ ] WP10 — Governance Safeguards for Future Product/SKU Creation
- [ ] WP11 — UX Consistency and Visual Hardening
- [ ] WP12 — Regression, Live Proof and Governance Documentation

## Work-pack dependencies / delivery order
WP-1 → WP0 → WP1 → WP2–WP4 → WP5–WP7 → WP8–WP9 → WP10 → WP11–WP12. Later phases do not start because an attractive future idea appears.

## Programme status
IN PROGRESS: closing. Remaining items and dispositions: MDC_WORKFLOW_STATUS_AND_CLOSING_PLAN.md (25 Oct 2026)

## Active work pack
None formally open. WP05 is **partly done**: the 25 Oct client audit is its proposed output, awaiting owner acceptance. (Before 25 Oct this line said "WP05 has not started".)

## Active gate
None. WP04-G8 is completed and post-merge verification passed.

WP04 merged to `main` as `1ff8d13e90b5078dde7e414e3c257cf41aa6f34b` with parent 1 `a007cea4d624835dc5406a952657769868619649` and parent 2 `836ff0e9e9fd8dbe27061dde2a6346236466b2a4`. G0–G8 are complete. Formal G7 remains PASS; Track A remains CLOSED / APPLIED / PROVEN; Track B remains accepted at runtime candidate `47b07b4bdb92f9d2d471c61569045c8f24f1cac5`. Post-merge verification confirmed the merged tree matches the verified branch tree, Build 4 remains current/COMPLETED with Run 115 and 1793/611 populations, source fingerprint matches, Readiness RPC and CSE-P01 are unchanged, and no new statement-timeout or legacy-dashboard-summary log event was found in the checked post-merge window. No GitHub CI evidence is claimed. (At WP04 merge time WP05 had not started; see the 30 Oct status above.)

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
- CSE-P01 commercial-sales LIVE_AS_OF multi-row authority → costing/commercial-sales evidence governance.
- PERF-P01 broader portfolio-readiness performance architecture → separate future architectural decision.
- WP05 park candidates from Track B acceptance (SKU Control Status ↔ Readiness rationalisation; wider Costing/Pricing Policy Manager duplication audit; parked legacy dashboard-summary dependency audit) → WP05; they remain parked. WP05 has not started.

No Track A rerun is required without fresh defect evidence.

## Immediate next action
See the closing order in MDC_WORKFLOW_STATUS_AND_CLOSING_PLAN.md (owner decisions CSE-P01, WP10, PERF-P01, plant capacity; then Codex client packages). Do not reopen WP04 without fresh regression evidence.

## Server development operating model
> 30 Oct 2026: server work is now done by the costing assistant (Aryabhatta) through Supabase with the owner's explicit approval text per live write; client work by Codex. The text below is the original model.

ChatGPT owns server planning/review, direct implementation and live verification through Supabase. Server delivery is not gated on GitHub commits/PRs/merges or local CLI migration tooling. Reviewed high-risk packages, target/rollback safeguards, operation evidence and live verification remain required. Repository MD records workflow; optional SQL evidence is traceability, not a client-style server delivery gate. See DEC-014 and IMPLEMENTATION_RULES.

## Client development operating model
Routine bounded client work uses the repository autonomous gate model: ChatGPT freezes one complete work package; Cursor/Codex autonomously analyze, implement, test, self-review, fix, commit and push on an isolated task branch/worktree; ChatGPT audits the pushed GitHub implementation and may request one consolidated correction pass before explicit merge approval.

High-risk work retains a separate Plan → ChatGPT review → Implementation gate. Existing WP-specific plan gates remain valid when they involve architecture, authorization/permissions, database/schema/RPC contracts, production-data mutation risk, destructive operations, major cross-module refactoring, unclear business rules, or security-sensitive behavior.
