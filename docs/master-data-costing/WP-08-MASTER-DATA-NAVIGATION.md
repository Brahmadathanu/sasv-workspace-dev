> **14 NOV 2026 — CURRENT STATE (supersedes the banners below, which are history):** **G1 audit DONE.** **G2-0 DONE** — shared Electron/PWA source (#409/#416), live PWA registry Step A activated and verified, 4/4 launcher routes PASS and real read-data PASS (evidence: `WP08_G2_0_*`; the PM BOM 390 px overflow is WP11 UX-P05 FAIL/deferred; real view-only identity acceptance NOT TESTED; Step B Electron legacy-route repoint deferred). **G2-1 bulk implementation is in DRAFT-PR REVIEW (Issue #425), not merged, not deployed, not live-verified:** permission-gated resolver for four destination-proven codes, selection-only URL contracts for Products / RM BOM / SP BOM / PM BOM, permission-gated Related/Open-in handoffs and an RM BOM→Product backlink. Pricing `MRP_GOVERNANCE` / `SELLING_SCHEME_POLICIES` remain text-only pending an owner decision; `BATCH_SIZES` / `REGIONAL_MARKETING_REVIEW` UNMAPPED. [G2-1 implementation and gate report](WP08_G2_1_BULK_IMPLEMENTATION_AND_GATE_REPORT_2026-11-14.md). Owner approves merge and any rollout separately; WP12 integrated release obligations unchanged. **WP08 remains OPEN; programme 8/13.**

> **14 NOV 2026 — OWNER APPROVED G2 SHARED ELECTRON/PWA ARCHITECTURE (HISTORY — superseded by the CURRENT STATE banner above):** [Live read-only registry verification, four-module cross-platform decision, and guarded G2 contract](WP08_G2_OWNER_APPROVED_SHARED_PLATFORM_CONTRACT_2026-11-14.md). Owner approved one canonical shared implementation for Products, RM BOM, PM BOM and SP BOM in Electron and PWA. Live `app_modules`/`app_module_clients` SELECT confirms four active Electron-only entries and no PWA client rows; PM BOM registry key and permission remain `pm-templates` / `module:pm-templates`. **G2-0 source migration is the next implementation package, not yet proven or deployed.** PWA registry writes, source code merge, pricing-workspace semantics, grants and rollout require separate gates. WP08 OPEN; programme **8/13**; WP12 final acceptance unchanged. Older G0/G1 banners below are historical.

> **14 NOV 2026 — WP08 G1 CURRENT-STATE AUDIT KICKOFF (HISTORY — G1 is complete):** WP07 was owner-conditionally closed, programme **8/13**. WP08 entry prerequisites are satisfied; **G1 AUDIT IN PROGRESS**, not design or implementation authorisation. [Exact-main source inventory and NAV-P01/NAV-P02 audit brief](WP08_G1_SOURCE_PINNED_NAVIGATION_AUDIT_BRIEF_2026-11-14.md). Existing Product/SKU/Readiness tabs and prior WP02/WP03 implementation must be reused, but Product→BOM→Route→Policy click-path and readiness `recommended_ui_route` targets remain unverified pending G1. Preserve WP09 launcher and WP11 visual work boundaries and WP12 final release obligations. Older G0/NOT STARTED statements below are dated history, not new PASS evidence.

# WP-08 — Product / Master Data Navigation Rationalisation

## Objective
Audit Product/SKU/BOM/route/policy setup hierarchy and reduce top-level proliferation based on evidence.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
All prerequisite work packs in MASTER_PROGRAMME.md are completed and verified.

## Scope
As defined by the approved programme handoff; refine only from audited live architecture and explicit decisions.

## Explicit exclusions
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes.

## Current-state findings
G1 audit complete (`WP08_G1_SOURCE_PINNED_NAVIGATION_AUDIT_REPORT_2026-11-14.md`). G2-0 shared-source migration, activation and launcher verification complete. G2-1 findings and contract: `WP08_G2_1_BULK_IMPLEMENTATION_AND_GATE_REPORT_2026-11-14.md`. (Earlier "Not started" wording was historical.)

## Approved design / contract
Not yet approved.

## Milestones
- [x] Current-state/audit gate (G1)
- [x] Design/contract gate where applicable (`WP08_G2_OWNER_APPROVED_SHARED_PLATFORM_CONTRACT_2026-11-14.md`)
- [~] Implementation gate: G2-0 DONE; G2-1 bulk implementation in draft-PR review (not merged)
- [ ] Focused verification (G2-1 isolated verification recorded in the report; live acceptance NOT TESTED)
- [ ] Independent audit
- [ ] Merge/post-merge proof where applicable
- [ ] Final handover

## Current Gate
`WP08-G2-1 — bulk implementation, draft PR review` (G2-0 DONE; history: G0/G1 entries were earlier gates)

## Gate Status
[~] IN PROGRESS — OPEN; programme 8/13

## Required to close
Entry criteria must be satisfied and the work pack explicitly started.

## Next gate
Owner review/merge decision for the G2-1 PR; owner decisions on Pricing workspace mapping (`MRP_GOVERNANCE`, `SELLING_SCHEME_POLICIES`, PPM identity consumption) and optional Costing→Master-Data mappings; then live authenticated acceptance (real view-only identity), WP09 launcher IA, WP11 UX-P05, WP12 integrated release checks.

## Server changes
None.

## Client changes
G2-1 (draft PR, unmerged): `costing-suite-recommended-ui-route.js`, `costing-destination-access.js`, `master-data-selection.js`, Products / RM / SP / PM BOM selection wiring, readiness link wiring, `sw.js` network-first patterns.

## Tests / verification
None.

## Decisions created
None.

## Risks
Premature assumptions; scope drift; duplicated authority; loss of effective-dated/history semantics.

## Parked discoveries
Broader Product / Master Data navigation, parked from completed WP02. WP08 is not started.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current.

## Final handover
Not started.
