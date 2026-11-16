# WP10 — Consolidated engineering batch and open gates (2026-11-16)

## Verified evidence
- CL14 multi-SKU: **PASS** in GitHub Actions [run #29](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43806533283), completed SUCCESS. Both SKUs on product 1 active; product inactivation rejected.
- CL12/CL13: previously verified in CI and recorded in the existing receipt.
- Production catalog: read-only function and exact trigger event audits captured in separate documents on this PR. Neither is proof of complete route writer serialization.

## Negative mutation (CL15)
- [Run #30](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43806891672) FAIL: barrier missing.
- [Run #31](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43807177803) FAIL: barrier missing again. Root cause: SQL fixture opening dollar quote was `$`, but closing delimiter `$mut$`; test fixture setup could not install the pause trigger. Corrected opener and added explicit `CL15_SETUP` assertion so a missing trigger cannot silently masquerade as an unsuccessful race witness.
- Latest CL15 changes and CL16 concurrent sibling activation test are **NOT YET CI VERIFIED** at this document revision.

## New CL16 contention scenario
- Two concurrent active-status updates for distinct SKUs belonging to the same product, with 7-second statement and 6-second lock timeouts. Both must commit, both SKUs must be active. Timeout, deadlock or missing fixture counts as FAIL.
- This is one bounded lock-contention scenario, **not** proof of global deadlock freedom or correctness for all route writers.

## Remaining required gates
1. CL15_SETUP + CL15 negative witness PASS; CL16 contention PASS in isolated PostgreSQL CI, with log receipt.
2. More complex lock-order schedules: SKU reparent, product inactivation, subgroup-to-group reassignment and route mapping/assignment writers. Evaluate whether guards are sufficient at each mutation boundary.
3. Independently reviewed minimal correction-only SQL, exact forward and rollback provenance, permissions/role boundaries and owner authorization before production.
4. WP10 remains OPEN; WP11/WP12 closure reconciliation is separate. No production SQL/deploy/flag change in this batch.
