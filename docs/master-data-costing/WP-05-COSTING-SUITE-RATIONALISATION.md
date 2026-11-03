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
**Owner decision, 2 Nov 2026 — WP05-G2 Tier 1 DESIGN ACCEPTED.** Accept the evidence-backed task-oriented grouped navigation as design baseline, not implementation approval. Preserve six modules, 32 lens IDs, 10 Pricing Policy workspaces, deep links, distinct live-vs-run truth models, authorisation boundaries, RPC payloads, default-OFF flags, history, and existing controllers. Tier 2 controller/screen consolidation remains separately gated and NOT approved. D3: keep CCC/MCM review authority separate for now; D4: Commercial Sales Assumptions stays in PPM; D5 historical run selection requires a separate server contract; D7 maker-checker is deferred governance; D10 Utilities Hub label is a separate server-authorised update. P01 and P02 may be briefed independently, but no implementation, merge, deployment or server write is authorised by this decision alone.

## Milestones
- [x] Current-state/audit gate (static; A1–A7)
- [x] Design/contract gate — Tier 1 accepted by owner 2 Nov 2026
- [~] Implementation gate where applicable — P02 (#131) and P01 (#132) merged; N1 on a draft PR (3 Nov 2026); N2/N3/N4/W6/U11 not started
- [ ] Focused verification
- [ ] Independent audit
- [ ] Merge/post-merge proof where applicable
- [ ] Final handover

## Current Gate
`WP05-G3 — Tier 1 design accepted; P01 and P02 implemented and merged; MDC-07 N1 awaiting independent review. Other packages (N2, N3, N4, W6, U11) await their own written briefs.`

## Gate Status
[~] IN PROGRESS — WP05-G1 audit complete and WP05-G2 Tier 1 design accepted; WP05 remains open

## Required to close
Entry criteria must be satisfied and the work pack explicitly started.

## Next gate
Independent review and owner acceptance of the N1 draft PR; then N2/N3/N4/W6 briefs. Signed-in populated-data acceptance of P01, P02 and N1. Tier 2 consolidation stays conditional and unapproved.

## Server changes
None.

## Client changes
Merged 3 Nov 2026: P02 Production Route corrections (#131, `COSTING_PRM_CORRECTIONS_V1` default OFF) and P01 Readiness usability (#132). Navigation package N1 is a draft PR (see [WP-07](WP-07-COSTING-NAVIGATION.md)). Remaining packages: A6.

## Tests / verification
Audit baseline 408/408 LF and CRLF on `3d0b618` (A7). **Combined post-merge baseline on `main` `86f1c18`: 471/471 LF and CRLF, 0 skipped** (3 Nov 2026; [WP-07](WP-07-COSTING-NAVIGATION.md)). The 393/408/471 figures are different heads and are not additive.

## Decisions created
Owner accepted Tier 1 design on 2 Nov 2026 (see Approved design / contract); unresolved server-governance and Tier 2 decisions remain separately gated.

## Risks
Premature assumptions; scope drift; duplicated authority; loss of effective-dated/history semantics.

## Parked discoveries
None.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current.

## Final handover
Not started.
