# SASV Master Data Governance, Product Lifecycle & Costing Suite UX Consolidation

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
- [ ] WP04 — Central Master Data / Costing Readiness Control Centre
- [ ] WP05 — Costing Suite Functional Rationalisation Audit
- [ ] WP06 — Pricing Policy Manager Simplification
- [ ] WP07 — Costing Suite Navigation and Information Architecture
- [ ] WP08 — Product / Master Data Navigation Rationalisation
- [ ] WP09 — Wider Application Launcher/Section Audit
- [ ] WP10 — Governance Safeguards for Future Product/SKU Creation
- [ ] WP11 — UX Consistency and Visual Hardening
- [ ] WP12 — Regression, Live Proof and Governance Documentation

## Work-pack dependencies / delivery order
WP-1 → WP0 → WP1 → WP2–WP4 → WP5–WP7 → WP8–WP9 → WP10 → WP11–WP12. Later phases do not start because an attractive future idea appears.

## Programme status
IN PROGRESS

## Active work pack
WP04 — Central Master Data / Costing Readiness Control Centre. WP03 remains completed, verified, merged, and closed; no upstream regression was demonstrated.

## Active gate
WP04-G4-S0 remains in progress. First offline wrapper at test/wp04-s0-cursor-runner / 9062d4a independently audited: 47 tests PASS, but six grouped control/safety gaps reproduced with fakes. Consolidated same-branch four-file correction approved; corrected audit next, no live proof acceptance. No real input/network/Auth/SQL/cost/target/server/client application approved. DEC-014 retained; G0–G3 complete at documented levels; main b162d4932ec2bbe9ca665aadedf1827e5117de5a unchanged; audit/feature branches unmerged.

## Overall completion progress
4 of 13 substantive work packs (WP00–WP12) are completed, verified, and merged where applicable. The prerequisite control plane, WP00, WP01, WP02, and WP03 are complete. WP02 merged to `main` as `7948551bd48e9ab6113e21df3a2cd98946a25362`; its final feature tip was `6247a7bccb862d679071f68843523156ce6e5cb3`. A subsequent e-Aushadhi-only merge advanced `main` without WP02 overlap. WP03-G1 audited `main` at `f22b36ca7077fcf70943112fb0aee6380af93e8d`. WP03 merged to `main` as `dd7da3a6fa2f447a71d92ca091f3d18921e32968`; its verified feature tip was `3894ce43798e4d9d919dfac54c8ab11aa7168733`.

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

## Major unresolved blockers
No WP02 blocker remains, and WP03-G1 found no WP03 blocker. These findings stay parked for their assigned later work and do not reopen WP02 or WP03:

- UX-P02, remaining Manage Products aesthetic and interaction hardening: PARKED → WP11.
- Broader Product / Master Data navigation: PARKED → WP08.
- Commercial-sales LIVE_AS_OF row authority is ambiguous when multiple snapshot rows exist for one SKU/period. This stays in costing/commercial-sales evidence governance and is not solved.

## Immediate next action
WP04-G4-S0 — Consolidated offline test-runner correction. Cursor applies WR-01–WR-06 in the [superseding brief](WP-04-S0-CURSOR-TEST-RUNNER-PLAN.md) on the same feature branch, preserves harness/original checkout, extends meaningful offline regressions, self-reviews/tests/commits/pushes and returns closure evidence for ChatGPT audit. No real inputs/network/live/paid operations; programme 4 of 13; WP03 closed.

## Server development operating model
ChatGPT owns server planning/review, direct implementation and live verification through Supabase. Server delivery is not gated on GitHub commits/PRs/merges or local CLI migration tooling. Reviewed high-risk packages, target/rollback safeguards, operation evidence and live verification remain required. Repository MD records workflow; optional SQL evidence is traceability, not a client-style server delivery gate. See DEC-014 and IMPLEMENTATION_RULES.

## Client development operating model
Routine bounded client work uses the repository autonomous gate model: ChatGPT freezes one complete work package; Cursor/Codex autonomously analyze, implement, test, self-review, fix, commit and push on an isolated task branch/worktree; ChatGPT audits the pushed GitHub implementation and may request one consolidated correction pass before explicit merge approval.

High-risk work retains a separate Plan → ChatGPT review → Implementation gate. Existing WP-specific plan gates remain valid when they involve architecture, authorization/permissions, database/schema/RPC contracts, production-data mutation risk, destructive operations, major cross-module refactoring, unclear business rules, or security-sensitive behavior.
