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
- [x] WP-1-G3 — independent completeness/diff audit
- [x] WP-1-G4 — explicit merge approval and merge to current main
- [x] WP-1-G5 — post-merge verification and WP0 handover

## Current Gate
`WP-1-G5 — post-merge verification and WP0 handover`

## Gate Status
[x] COMPLETED AND VERIFIED

## Required to close
Completed. All WP-1 exit criteria passed.

## Next gate
`WP00-G0 — entry criteria / start current-state inventory`

## Server changes
None.

## Client changes
None. Documentation only.

## Tests / verification
- Repository convention inspected.
- Branch isolated from captured main baseline.
- Branch diff restricted to docs/master-data-costing/.
- Independent completeness/diff audit passed: only docs/master-data-costing/* additions.
- Explicit no-ff-equivalent merge completed as 656d29ce79b3d0b63ae708606ed511c076b16dee.
- Merge parents verified: 9ba35c786c91e017894c960665861f3ce7838216 and d58f1b59d6304bfa8a91b350f286c00ad68c247d.
- Post-merge main verified with all 19 programme-control files present.

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
WP-1 completed and verified. WP0 may now start at WP00-G0 with live Supabase + current-repository architecture inspection. No Product/Costing redesign has started.
