# WP-05 — Costing Suite Functional Rationalisation Audit

## Objective
Inventory every Costing Suite module/tab/launcher and classify responsibilities before consolidation.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
All prerequisite work packs in MASTER_PROGRAMME.md are completed and verified.

## Scope
As defined by the approved programme handoff; refine only from audited live architecture and explicit decisions.

## Explicit exclusions
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes.

## Current-state findings
**Audit gate (WP05-G1) evidence complete 2 Nov 2026 on `main` `3d0b618` — awaiting design review.** Static, code-confirmed; no browser/production verification.
* Inventory: 6 modules / **32** top-level lenses (the 25 Oct "37" was a miscount; registry has never held 37) + 10 PPM workspaces — [A1](WP05_A1_LENS_AND_WORKSPACE_INVENTORY_2026-11-02.md)
* Overlaps and dispositions — [A2](WP05_A2_OVERLAP_AND_DISPOSITION_MATRIX_2026-11-02.md)
* Proposed architecture and current→proposed mapping — [A3](WP05_A3_PROPOSED_NAVIGATION_ARCHITECTURE_2026-11-02.md)
* RPC / permission / flag index — [A4](WP05_A4_RPC_AND_PERMISSION_INDEX_2026-11-02.md)
* Defects, risks, blockers, owner decisions — [A5](WP05_A5_RISK_BLOCKER_AND_DECISION_REGISTER_2026-11-02.md)
* Implementation package plan — [A6](WP05_A6_IMPLEMENTATION_PACKAGE_PLAN_2026-11-02.md)
* Regression evidence (408/408 LF and CRLF, 0 skipped) — [A7](WP05_A7_REGRESSION_EVIDENCE_2026-11-02.md)

G2 correction pass applied: first wave = presentation-only grouping (grouping ≠ consolidation); Readiness stays LIVE_AS_OF (no run selector); PRM run 80/82 are fixed historical fixtures (D5, server review first); server contracts for supersede/family-create/proposal-decide recorded as independently-reviewed (not re-verified here).

Confirmed PRM defects: C1 (Supersede needs loaded record), C2 (candidate scope controls hidden), C3 (candidate family create omits `p_family_code`).

## Approved design / contract
Not yet approved.

## Milestones
- [x] Current-state/audit gate (static; A1–A7)
- [ ] Design/contract gate where applicable
- [ ] Implementation gate where applicable
- [ ] Focused verification
- [ ] Independent audit
- [ ] Merge/post-merge proof where applicable
- [ ] Final handover

## Current Gate
`WP05-G2 — design review OPEN. Audit evidence (G1) delivered and corrected in the G2 consolidated correction pass; no design acceptance and no implementation permission is implied.`

## Gate Status
[~] IN PROGRESS — audit evidence delivered; WP05-G2 design review open (not accepted)

## Required to close
Entry criteria must be satisfied and the work pack explicitly started.

## Next gate
Owner closes WP05-G2 (design review of A3/A5 decisions D1–D10). Only then may bounded first-wave (presentation-only) packages per A6 be briefed. Tier 2 consolidation stays conditional.

## Server changes
None.

## Client changes
None (documentation only). Proposed packages: A6.

## Tests / verification
Baseline suite only: 408/408 LF and CRLF on `3d0b618` — A7.

## Decisions created
None.

## Risks
Premature assumptions; scope drift; duplicated authority; loss of effective-dated/history semantics.

## Parked discoveries
None.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current.

## Final handover
Not started.
