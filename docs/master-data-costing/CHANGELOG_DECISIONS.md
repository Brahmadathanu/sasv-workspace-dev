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
