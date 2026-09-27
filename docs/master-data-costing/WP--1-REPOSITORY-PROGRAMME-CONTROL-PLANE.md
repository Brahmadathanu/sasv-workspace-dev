# WP-1 — Repository Programme Control Plane

## Objective
Establish the persistent repository-level governance and documentation system required before WP0 begins.

## Why this work pack exists
Chat history is supporting context, not the programme tracking authority. The repository must durably retain programme purpose, active work pack/gate, verified progress, locked decisions, parked ideas, authoritative repository/server state and exact resume instructions.

## Entry criteria
Approved programme handoff and mandatory control-plane addendum available; current repository conventions and main baseline inspected.

## Scope
Create the dedicated programme documentation namespace; canonical programme/rules/decision/backlog/handover documents; WP00–WP12 authoritative skeletons; status, gate, authority, recap, scope-control and handover conventions.

## Explicit exclusions
No Product/SKU redesign; no Costing Suite or Pricing Policy Manager redesign; no Home/navigation redesign; no server mutation; no application/client implementation.

## Current-state findings
- Repository: Brahmadathanu/sasv-workspace-dev.
- Captured main baseline at WP-1 start: 9ba35c786c91e017894c960665861f3ce7838216.
- Existing convention: programme-specific documentation under docs/<programme>/, demonstrated by docs/eaushadhi/.
- Existing e-Aushadhi programme/control branches are unrelated and must remain untouched.
- Dedicated namespace selected: docs/master-data-costing/.
- Isolated branch: docs/master-data-costing-programme-control.

## Approved design / contract
The control plane consists of MASTER_PROGRAMME.md, IMPLEMENTATION_RULES.md, CHANGELOG_DECISIONS.md, PARKED_BACKLOG.md, WORKPACK_HANDOVER_TEMPLATE.md, this WP-1 ledger, and WP00–WP12 authoritative documents.

## Milestones
- [x] WP-1-G1 — repository/documentation convention and baseline inspection
- [x] WP-1-G2 — isolated control-plane document creation
- [~] WP-1-G3 — independent completeness/diff audit
- [ ] WP-1-G4 — explicit merge approval and merge to current main
- [ ] WP-1-G5 — post-merge verification and WP0 handover

## Current Gate
`WP-1-G3 — independent completeness/diff audit`

## Gate Status
[~] IN PROGRESS

## Required to close
- verify every WP-1 completion criterion against branch contents;
- verify only intended documentation paths changed;
- verify current main has not moved into conflicting overlap;
- record any corrections on the same branch;
- only then request/record merge approval.

## Next gate
`WP-1-G4 — explicit merge approval and merge to current main`

## Server changes
None.

## Client changes
None. Documentation only.

## Tests / verification
- Repository convention inspected.
- Branch isolated from captured main baseline.
- Branch diff restricted to docs/master-data-costing/.
- Full WP-1 completion audit pending at current gate.

## Decisions created
DEC-001 through DEC-005 in CHANGELOG_DECISIONS.md.

## Risks
Main may move before merge; if so, compare current main with this branch and stop on overlap. Documentation must not claim WP-1 completion before independent audit and post-merge proof.

## Parked discoveries
None.

## Exit criteria
- programme documentation directory exists on current main;
- five mandatory canonical documents exist;
- this WP-1 ledger exists;
- WP00–WP12 documents exist;
- status-marker, gate, repository-authority, cumulative-recap, handover, decision-lock and scope-control conventions are documented;
- no Product/Costing redesign has started;
- independent diff/completeness audit passes;
- explicit merge to current main succeeds without unsafe overlap;
- post-merge verification passes.

## Final handover
Pending.
