# Changelog / Decisions

## 2026-09-27 — DEC-001 — WP-1
**Decision:** Use `docs/master-data-costing/` as the dedicated programme documentation namespace.
**Reason:** Current main establishes `docs/<programme>/` through `docs/eaushadhi/`; this isolates programmes and avoids root-level proliferation.
**Alternatives:** Repository root; reuse docs/eaushadhi. Rejected because both weaken programme isolation.
**Impact:** Documentation only.
**Affected:** docs/master-data-costing/*
**Reversible:** Yes, by explicit migration.
**Evidence:** main 9ba35c786c91e017894c960665861f3ce7838216; docs/eaushadhi present on current main.

## 2026-09-27 — DEC-002 — WP-1
**Decision:** Server-authoritative completeness; no JavaScript checklist as authority.
**Reason:** Programme invariant and governance requirement.
**Impact:** Future server/client architecture.
**Reversible:** Only by explicit superseding evidence-backed decision.
**Status:** LOCKED

## 2026-09-27 — DEC-003 — WP-1
**Decision:** Operational Active does not automatically mean Costing Ready.
**Reason:** Creation/operation/readiness are separate governance concepts until live architecture audit determines exact contracts.
**Status:** LOCKED

## 2026-09-27 — DEC-004 — WP-1
**Decision:** REVIEW_REQUIRED is not promoted to READY without evidence; BLOCKED is not bypassed.
**Status:** LOCKED

## 2026-09-27 — DEC-005 — WP-1
**Decision:** No new top-level Product/Costing module before WP5/WP7/WP8 evidence establishes the need.
**Status:** LOCKED

## 2026-09-29 — DEC-006 — WP01
**Decision:** Product/SKU readiness is a multidimensional server-authoritative composition, not a sequential lifecycle ladder or client checklist.
**Reason:** Live resolver/snapshot evidence proves lifecycle, structural foundation, evidence quality and final costing outcome are orthogonal; governed fallback can be structurally resolved while remaining REVIEW_REQUIRED.
**Impact:** WP01 server contract and later WP02–WP04 client consumption.
**Status:** LOCKED

## 2026-09-29 — DEC-007 — WP01
**Decision:** LIVE_AS_OF persisted evidence is pinned to the latest SUCCESS refresh run matching the governed period/valuation context; failed runs are excluded. EXACT_RUN remains pinned to the explicitly requested immutable run and never substitutes current mutable master evidence for fields not frozen in that run.
**Reason:** Run115 is the latest successful Sep-2026 / 2026-09-10 context while Run116 failed; exact Run114 proof must remain Run114.
**Impact:** Readiness context integrity and historical auditability.
**Status:** LOCKED

## 2026-09-29 — DEC-008 — WP02
**Decision:** Product detail is the Product/SKU lifecycle anchor. SKU master editing, SKU activation/deactivation, and readiness/remediation remain separate UI concepts and separate governed actions.
**Reason:** Live server already separates SKU master mutation from lifecycle transition, while WP01 proves lifecycle and readiness are orthogonal. Combining them would recreate business rules in the client and risk accidental activation.
**Impact:** Manage Products Product-detail architecture and WP02 implementation.
**Status:** LOCKED

## 2026-09-29 — DEC-009 — WP02
**Decision:** Manage Products consumes WP01 readiness only as LIVE_AS_OF for an explicit server-governed costing period. Product Master does not provide an EXACT_RUN/history browser and never computes valuation/run context or readiness severity in JavaScript.
**Reason:** Product lifecycle needs current governed remediation context, while exact frozen evidence belongs to specialist costing/audit surfaces. WP01 requires explicit context and server authority.
**Impact:** Product lifecycle readiness rendering and period-context handling.
**Status:** LOCKED

## 2026-09-29 — DEC-010 — WP02
**Decision:** Product users must not be granted Costing Control Center module access merely to render lifecycle readiness. Readiness visibility is authorized narrowly at the canonical readiness read boundary for users with Manage Products view access; costing mutations/approvals remain unchanged.
**Reason:** Live permissions prove legitimate Manage Products users do not necessarily have Costing Control Center permission. The readiness RPC exposes status/remediation metadata, not monetary costing values, and Product lifecycle requires this information.
**Impact:** Narrow G3 server authorization adjustment for readiness consumption.
**Status:** LOCKED


## 2026-10-01 — DEC-011 — Autonomous gate-based client implementation
**Decision:** Routine bounded client work no longer requires a separate ChatGPT approval between planning/analysis and implementation. ChatGPT freezes one complete bounded work package; Cursor/Codex autonomously analyze, implement, test, self-review, fix, commit and push; ChatGPT audits the actual pushed GitHub implementation, may request one consolidated correction pass, and explicitly approves merge/cleanup.
**High-risk exception:** Architecture, database/schema/RPC contracts, authentication/permissions, production-data mutation risk, destructive operations, major cross-module refactoring, unclear business-rule decisions, and security-sensitive behavior retain a separate Plan → ChatGPT review → Implementation gate.
**Preserved controls:** dedicated task branch/worktree, no direct main implementation, no invented backend contracts, server truth remains authoritative, no unrelated refactoring, targeted checks/tests, no merge/version/tag/release/publish without explicit approval.
**Status:** LOCKED

## 2026-10-01 — DEC-012 — WP02
**Decision:** Manage Products uses full-width Product selection plus Product Master, SKUs, and Readiness tabs. The persistent Product side rail is retired. SKU and readiness deep detail use bounded focused surfaces. Small-screen registers use compact card views.
**Reason:** Authenticated verification of the rail layout, including a live catalog of 1,342 Products and narrow screens, showed that a permanent side list plus a long stacked workspace was not usable.
**Impact:** This supersedes only the earlier WP02 presentation choice. Product, SKU, readiness, permission, and server contracts are unchanged.
**Status:** LOCKED

## 2026-10-02 — DEC-013 — Manage Products catalog/lens workspace
**Decision:** Manage Products is a full-width catalog. One global Product search filters the catalog only and does not select a Product. The lenses are Products, SKUs, and Readiness. SKUs and Readiness become available only after a saved Product is selected. Single row selection is separate from the dialog that does the row's work. Registers have no permanent Action column. At 520px and below, registers become compact list rows. This supersedes the DEC-012 picker, tab labels, and tall card presentation.
**Reason:** Authenticated use of the DEC-012 workspace showed that search selected a Product, dialog actions overlapped, and the narrow card layout was too tall.
**Impact:** Presentation only. Product, SKU, readiness, permission, and server contracts are unchanged.
**Status:** LOCKED
**Evidence:** DEC-012 remains recorded above and is not erased.

## 2026-10-02 — DEC-014 — Server/client execution ownership clarification
**Decision:** ChatGPT owns server analysis, reviewed package implementation and live verification directly through Supabase/server tools. Server implementation is not bound to GitHub commits, PRs, merges, Cursor/Codex handoff or local CLI-generated repository migrations. Client implementation remains through Cursor/Codex on an isolated branch, followed by ChatGPT audit of the actual pushed implementation and explicit merge authorization.
**Reason:** User explicitly reconfirmed this ownership division during WP04. Prior server wording was generic; WP04's proposed CLI/repository artifact steps over-bound server delivery to the client pipeline.
**Impact:** Clarifies execution ownership and removes artificial server Git/local-tool prerequisites. Repository MD still carries durable workflow authority; optional SQL/rollback artifacts may be retained for traceability. High-risk Plan → review → authorized application, target/rollback safeguards, Supabase operation records where applicable and live verification remain required. No particular database mutation, paid provisioning, client implementation or merge is approved by this clarification.
**Affected:** IMPLEMENTATION_RULES, MASTER_PROGRAMME, WORKPACK_HANDOVER_TEMPLATE and WP04 server-package planning.
**Status:** LOCKED — workflow ownership; existing readiness/business/security decisions unchanged.

## 2026-10-05 — DEC-015 — WP04 G4 closure / performance limitation / G7 native verification
**Decision:** WP04-G4 server implementation is accepted and closed with the committed C contract active in production. Server performance feasibility is ACCEPTED WITH MEASURED LIMITATION: 6938.008 ms and 5084.304 ms for full-611 OPERATIONAL/full-statistics; provisional 3s/5s engineering goals remain UNMET/NON-BLOCKING and are not SLAs. No further speculative G4 optimization is permitted. Genuine signed-in native Auth/API runtime permission verification is mandatory at WP04-G7, not waived or relabelled PASS. Broader caching/materialization/page-statistics separation/precomputation/subset-route redesign is deferred to a separate architectural work item.
**Reason:** Correctness/parity/access-source/payload/filter/no-success/rollback obligations are closed; C is committed and independently verified. Current synchronous canonical full-population/statistics semantics make the remaining latency materially architectural, while the repository explicitly defined 3s/5s as provisional engineering targets. Native API proof requires the signed-in application surface already assigned to G7.
**Impact:** G4 may be marked COMPLETED AND VERIFIED and G5 client implementation may open from a frozen bounded package. G7 remains a hard verification gate for native permissions and live performance before G8 closure.
**Affected:** WP-04-READINESS-CONTROL-CENTRE.md, MASTER_PROGRAMME.md, WP-04-G5-CLIENT-PACKAGE.md, PARKED_BACKLOG.md.
**Status:** LOCKED for WP04 gate governance; measured performance figures and UNMET status remain historical evidence and must not be rewritten as PASS.

## 2026-10-07 — WP04 G7 recovery acceptance / ledger reconciliation
**Decision:** After original G7 signed-in verification exposed native 8-second portfolio instability and material CCC/Readiness UX defects, G7 recovery Track A is recorded CLOSED/APPLIED/PROVEN (production Build 4 / COMPLETED / current / period 2026-09-01 / valuation 2026-09-10 / Run 115 / 1793 ALL_EXISTING / 611 OPERATIONAL / OPERATIONAL mismatch 0 / indexed reader under 8s / fail-closed stale-absent-incomplete proven / CSE-P01 unchanged). Track B is recorded ACCEPTED at `47b07b4bdb92f9d2d471c61569045c8f24f1cac5`, including startup-timeout repair that removes normal CCC queries of parked legacy `public.v_costing_pricing_dashboard_summary` and corrects Scheme/Margin Risk from duplicate 1764 to governed 882. Exact current gate is **WP04 G7 restart boundary**. Formal G7 has not been rerun after recovery; no Track A rerun without fresh defect evidence; Track B has no GitHub CI evidence; WP05/G8/merge/release/publish have not started.
**Reason:** Authoritative programme/WP04 docs on the recovery branch were stale versus independently verified recovery state and required ledger reconciliation before G7 restart.
**Impact:** Documentation/workflow authority only. Does not reopen G0–G6, does not authorize merge/release, and does not start WP05 or G8.
**Status:** RECORDED — preserves DEC-011 / DEC-014 / DEC-015. This entry remains the historical recovery record; it is not rewritten by the later G7 PASS.

## 2026-10-08 — WP04 formal G7 rerun PASS / G8 boundary
**Decision:** Formal WP04-G7 signed-in/native rerun is **COMPLETED AND VERIFIED / PASS**. All seven checks passed: startup/hard refresh; Readiness OPERATIONAL; filter/search; ALL_EXISTING; detail/Membership; lens restoration; narrow-screen path. Backend verification after that rerun found no new statement timeout events and no new calls to parked `public.v_costing_pricing_dashboard_summary`. Track A remains CLOSED/APPLIED/PROVEN (Build 4 / COMPLETED/current / period 2026-09-01 / valuation 2026-09-10 / Run 115 / 1793 ALL_EXISTING / 611 OPERATIONAL / fingerprint matching / Readiness RPC unchanged / CSE-P01 unchanged). Track B remains ACCEPTED at runtime candidate `47b07b4bdb92f9d2d471c61569045c8f24f1cac5`. Documentation-only branch head advanced after that runtime candidate (`bece900ae75d3292fbb7ea6f4623f1185af0e283`, then this record) and is not a new runtime candidate. No GitHub CI evidence exists. Current gate is **WP04-G8 — merge / post-merge closure boundary**. WP04 remains active until G8 completes. No merge has occurred. WP05 has not started; parked WP05 items remain parked.
**Reason:** The original G7 attempt was blocked, recovered through Track A/B, and then formally rerun successfully. That blocked history is preserved; this entry records the successful rerun and the G8 boundary only.
**Impact:** Documentation/workflow authority only. Next action is the explicitly authorized clean merge of the verified WP04 branch into current main, followed by independent post-merge verification. Do not start WP05 until WP04 G8 is closed.
**Status:** RECORDED — preserves DEC-011 / DEC-014 / DEC-015 and the 2026-10-07 recovery evidence.

## 2026-10-08 — WP04 G8 merge / post-merge closure
**Decision:** WP04 — Central Master Data / Costing Readiness Control Centre is **COMPLETED, VERIFIED, MERGED, AND CLOSED**. Exact G8 merge commit on `main`: `1ff8d13e90b5078dde7e414e3c257cf41aa6f34b`; parent 1: `a007cea4d624835dc5406a952657769868619649`; parent 2: synchronized WP04 feature head `836ff0e9e9fd8dbe27061dde2a6346236466b2a4`. The merge tree exactly matched the verified synchronized branch tree. Post-merge live verification preserved Track A Build 4 / COMPLETED / current / period 2026-09-01 / valuation 2026-09-10 / Run 115 / 1793 ALL_EXISTING / 611 OPERATIONAL / matching source fingerprint; Readiness RPC MD5 remained `590a40c5a53949ca8e9f87dd54404947`; CSE-P01 MD5 remained `68bd9325062299eb8af1291bf4d9393b`. The checked post-merge log window contained no new statement-timeout event and no new call to parked `public.v_costing_pricing_dashboard_summary`. Formal G7 remains PASS. No GitHub CI evidence is claimed.
**Reason:** G0–G7 and both recovery tracks were completed/accepted, the branch was synchronized to current main, all bounded WP04 regression checks passed, the authorized normal two-parent merge completed, and independent post-merge verification found no regression.
**Impact:** WP04 exits the active programme. WP05 remains not started and may open separately. Parked WP05 candidates (SKU Control Status ↔ Readiness rationalisation, wider Costing/Pricing Policy Manager duplication audit, and legacy dashboard-summary dependency audit) remain parked. No release/publish is implied by this closure.
**Status:** CLOSED — preserves DEC-011 / DEC-014 / DEC-015 and all historical G7 recovery evidence.
