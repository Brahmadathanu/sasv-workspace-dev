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
- [~] WP02 — Product + SKU Lifecycle Redesign
- [ ] WP03 — Creation-Time Guided Completeness
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
WP02 — Product + SKU Lifecycle Redesign

## Active gate
WP02-G2 — lifecycle surface and WP01 contract-consumption design

## Overall completion progress
2 of 13 substantive work packs (WP0–WP12) completed. WP-1 prerequisite, WP00 and WP01 are completed and verified; WP02 is active with G1 current-state audit completed and G2 design/contract in progress.

## Major locked decisions
- Server-authoritative completeness.
- Operational Active does not automatically mean Costing Ready.
- Review states are not converted to Ready without evidence.
- No new top-level module until later IA audit proves it is required.
- No Product/Costing redesign before WP0 closes.
- WP01 readiness is multidimensional and server-authoritative; clients consume the canonical contract rather than recomputing it.

## Major unresolved blockers
No blocker to WP02-G2. One evidence-backed missing client surface remains parked for later work: the server-governed regional Marketing evidence-acceptance contract has no current-main client write/remediation path found.

## Immediate next action
Complete and independently audit WP02-G2: freeze the Product-detail child-SKU lifecycle surface and exact consumption of `rpc_get_product_sku_readiness`. Do not begin client implementation until G2 closes.
