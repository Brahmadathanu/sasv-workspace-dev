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
