> **WP05 OVERNIGHT RECONCILIATION — 10/11 NOV 2026 (issue #267):** decision-ready gate matrix, W5-03/W5-05 reconciliations, W5-08/09 owner-decision register and the daytime read-only PC acceptance checklist are in [WP05_OVERNIGHT_RECONCILIATION_AND_PC_ACCEPTANCE_PACK_2026-11-10.md](WP05_OVERNIGHT_RECONCILIATION_AND_PC_ACCEPTANCE_PACK_2026-11-10.md). **No gate promoted; WP05 OPEN; formal programme 6/13.**

> **WP05 R9 OWNER POLICY AND FAILURE STATUS — 10 NOV 2026:** Q-PRM/Q-ID/Q-VIEW/Q-F1/Q-D3 policy directions are **approved without production implementation authority** ([R9 decision](WP05_R9_OWNER_POLICY_DIRECTIONS_ACCEPTED_2026-11-10.md)). Four original AE1 historical F retain frozen classification, with separately documented recovery scope ([R9 historical F](WP05_R9_HISTORICAL_F_RECOVERY_RECONCILIATION_2026-11-10.md)). Scheme Master proposed covering index **already exists** live, valid/ready, no known current index scans recorded; do not execute the 8 Nov ‘UNAPPLIED’ index creation script. Full WP05 negative identity, F1 and final lens/bounded risk sign-off still open. WP05 OPEN, programme 6/13.

> **L1 SERVER CORRECTION VERIFIED — 10 NOV 2026:** Following explicit owner approval, Costing Control Center historical selling/scheme coverage fields are now sourced from the same selected costing run as each displayed period's SKU denominator. Live Oct approved run 143 **selling 627/627; scheme 600/627**; Nov current-successful run 151 **selling 629/629; scheme 601/629**; all five returned periods satisfy `complete+missing=total`. The view remains 19 columns, same postgres owner and SQL ACL. [L1 acceptance/evidence](WP05_L1_SCOPED_KPI_CORRECTION_IMPLEMENTATION_GATE_2026-11-10.md). No client code, feature flags, cache or Electron release changed; no new browser visual acceptance run. This closes the **specific L1 server KPI defect**, not W5-08/parent WP05 or outstanding negative identity, F1, historical F. WP05 OPEN, formal programme 6/13.

> **LATEST WP05 SCOPE DECISION — 10 NOVEMBER 2026:** Owner APPROVED and made effective **B1**: transfer only repeated integrated **B1-T2 (eleven-flag/cross-module)** and **B1-T3 (final-build deep-link/responsive/Electron)** acceptance to WP12, with [explicit WP12 receiving receipt](WP-12-REGRESSION-AND-DOCUMENTATION.md). **B1-T1 = ZERO** individual 40-lens observations transferred, and no NT/F promoted to PASS. WP05 retains every specialist correctness, SEC/negative-identity, F1/D3/C5/D5/L1, S2/S9, historical failures, view-sensitive flag test and final owner Gate Status. W5-06's Staff Governance **confidentiality release subgate** is [OWNER ACCEPTED with documented residuals](WP05_W506_CONF_01_OWNER_RESIDUAL_DISPOSITION_2026-11-10.md), not equivalent to blanket WP05 server-denial acceptance. **WP05 OPEN, formal programme 6/13.** Contract [§11 B1](WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md).

> **LATEST WP05 CLOSURE GATE AUDIT — 8 NOVEMBER 2026:** After owner formally closed WP06 (programme now **6/13**), WP05 remains **OPEN**, Tier-1 audit/implementation passed, but its original shared acceptance §8 remains broader than WP06 A1: 40-lens/11-flag integrated evidence, negative identity/SEC server-denial, S2 printable ↔ SKU comparison and S9 CCC KPI parity, plus WP05-specific authority decisions are still incomplete. The evidence-credit and smallest safe next wave are in [WP05_FORMAL_CLOSURE_GATE_AUDIT_2026-11-08.md](WP05_FORMAL_CLOSURE_GATE_AUDIT_2026-11-08.md). No new code, DB operation or automatic scope change. Older 5/13 and 'draft N1' statuses below are historical.

> **Current WP05 acceptance checkpoint — 4 Nov 2026:** all identified Tier-1 code packages and supporting mock regression are merged, but WP05 remains **OPEN**. SEC-A1 material-review acceptance/close server edit gate and SEC-A2 preview acknowledgement write affect the view-only production acceptance plan; no verified six-module view-only account exists yet. See [PRODUCTION_READ_ONLY_ACCEPTANCE_SECURITY_AUDIT_2026-11-04.md](PRODUCTION_READ_ONLY_ACCEPTANCE_SECURITY_AUDIT_2026-11-04.md) and [OWNER_ACCEPTANCE_RECORD_2026-11-04.md](OWNER_ACCEPTANCE_RECORD_2026-11-04.md). C5/D5, C9, D3, S2, S9 and residual owner decisions must be verified or explicitly deferred; do not treat historical 'N1 draft' or 'Final handover not started' text as the present milestone. Formal programme closure remains **5/13**.

> **Reconciled 4 Nov 2026 (newer than every banner below):** see [PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md](PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md) for the progress indicator, the doc-versus-`main` reconciliation (N1–N4/W6/U11, CL1, G1/G1b/G1c/G1d, F-7, F-9, WP12 sweep are merged) and the shortest path to formally close WP05 and WP06. Formal count is unchanged: 5 of 13 accepted; nothing is closed by documentation alone.

> **Post-merge current status (3 Nov 2026):** WP05-P02 #131 and WP05-P01 #132 are merged; navigation N1 #133, N3 #134, N2 #136, N4 #135 and W6 #139 are merged on `main` `d395d7e`. The original Tier-1 design/architecture and independent reviews are evidenced. **WP05 itself stays OPEN** until live signed-in verification, disposition of outstanding A5 issues and formal closure. Historical “N1 draft/not started” statements below are superseded. See [Costing Suite completion-to-release gate](COSTING_SUITE_COMPLETION_TO_RELEASE_2026-11-03.md) and [PR #140](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/140). No Tier-2 screen/controller merger is implicitly authorised.

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

## WP05 scope and next retained acceptance — B1 effective 10 Nov 2026

**Transfer out only:** B1-T2/T3 integrated eleven-flag/cross-module and final release compatibility are owned by WP12 before rollout. No individual lens observation transferred; retain frozen AE1 40-row evidence ledger 13 P/4 historical F/2 restricted NA/21 NT, with later recoveries separately attributed.

**Credited:** W5-01 inventory/design PASS; W5-02 Tier-1 code implementation PASS; owner's 9 Nov bounded factual S2/S9 acceptance (SKU 105 remains PARTIAL-as-designed); 10 Nov W5-06 Staff Governance confidentiality release gate ACCEPTED WITH DOCUMENTED RESIDUALS. Those are scoped and do **not** imply W5-03–W5-09 whole-gate or WP05 final sign-off.

**Next retained work, priority order:** (i) W5-03 accepted source/identity parity and subsequent v393 change boundary; (ii) W5-04 honest historical F/NT per-lens reconciliation, missing critical module-specific UI checks; (iii) W5-06 negative ID-N/ID-X/ID-O/SEC-A1/A2 and multi-view privilege policy beyond the completed Staff Governance confidentiality subgate, with no production writer tests; (iv) W5-08 D3/F1/C5/D5/L1 authority/factual findings; (v) W5-09 backlog ID, owner/milestone/risks; (vi) W5-10 final owner sign-off. WP12 B1-T2/T3 pending evidence does not itself block *evidence gathering* in WP05, nor does it certify a safe release.

**Governance:** The earlier G3 and N1-draft lines are historical; they are not current release/implementation status. No new code, SQL, flags, permissions, deployments or Electron release authorised by B1. [Owner B1 matrix](WP05_B1_WP12_RECEIVER_AND_OWNER_APPROVAL_PACKAGE_2026-11-10.md); [binding shared amendment](WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md).
