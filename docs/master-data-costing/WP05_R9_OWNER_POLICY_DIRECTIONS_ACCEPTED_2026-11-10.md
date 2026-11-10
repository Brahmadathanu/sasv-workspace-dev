# WP05 R9 — Owner-approved policy directions; no operational permission or test authorization

**Decision date:** 10 November 2026. **Owner status: APPROVED AS POLICY DIRECTION.** Scope is the five recommendations in the WP05 R8 closure readback. **Not a final WP05 Gate Status sign-off.** Programme 6/13, WP05 OPEN. This record supersedes only the prior `PENDING` marker for these five *directional* decisions. It does not modify the binding WP05 40-lens baseline or the accepted B1 transfer of cross-module integration tests to WP12.

| Decision | Approved policy direction | Required separate gate |
|---|---|---|
| **Q-PRM** | Preserve the model of **fixed historical workload run plus independently selected route-mapping as-of date**, with both temporal contexts made unambiguous in Mapping Review and Foundation Review. A fully historical replay would be a separate future feature. | Design/test exact UI labels and validate an actual safe read path; no automatic modification to run-82/valuation/as-of selection or RPC semantics |
| **Q-ID** | Preserve source/ACL/isolated permission evidence honestly and **NT** for missing genuine roles; check existing eligible identities via a future **explicitly scoped, read-only** procedure. No production writer-denial probe and no created/modified identities by inference. | Approved identity list, exact audited SELECT/GET allowlist, signed-in operator process and evidence hygiene; no live test authorized by this directional decision |
| **Q-VIEW** | Use a **hybrid reader design**: retain justified shared aggregate views and propose module-specific/specialist gates for sensitive personnel, vendor, audit and trace detail, with business-approved exceptions. Already accepted W5-06 Staff Governance confidentiality is retained. | Exact per-view positive/negative consumers, columns, privilege contracts and isolated compatibility tests; separate approval before any GRANT/REVOKE, RLS or `fn_costing_view_allowed` rewrite |
| **Q-F1** | Keep PRM F1 and other privileged preview RPCs **blocked from read-only acceptance** until reviewed for data exposure and full dependency safety. | Separate no-side-effect, data-grain and privilege review plus individually approved execution/allowlist, preferably isolated |
| **Q-D3** | Keep **CCC View+Edit** and **MCM View+Edit** as **distinct authorities**. Do not silently merge, cross-grant, require both, or convert one into the other. | If a workflow requires an additional cross-module permission, propose a specific contract and client/server regression after owner approval |

**Explicitly NOT approved:** production role impersonation, creating test accounts, permission table edits, GRANT/REVOKE, schema changes, RPC preview or material accept/close execution, approval/finalisation action, feature flag activation, deploy/cache/Electron release, automatic 49-view rewrite, historical snapshot recalculation, classification of existing NT/F as PASS, or WP05 formal closure.

## Previously accepted, unchanged

- B1 transfers only WP12 B1-T2/T3 integrated acceptance responsibilities; B1-T1 transfers **no individual lens tests**.
- W5-06 Staff Governance confidentiality release subgate remains owner accepted with documented residuals; broader WP05 negative identity/SEC breadth remains separately open.
- Q-L1-PATCH was separately approved and applied to the live run-frozen policy coverage feed; October run143 = 627/627 selling and 600/627 scheme; Nov run151 = 629/629 selling and 601/629 scheme, 19 output columns/ACL unchanged.

## Next sequence

1. Reconcile historic **F #19, #23, #24, #35** with subsequent recovery and currently applicable source/issue evidence. Preserve timestamp/build/role scope.
2. Group remaining material NT into **no-side-effect read requirements** vs **owner-accepted bounded deferrals** vs **genuine correctness work**. Keep privileged F1 blocked.
3. Produce one final owner-ready WP05 gate disposition (not auto-sign), with explicit risk/milestone/receiver per item, and independently retain WP12's final integration obligations.

**Supporting records:** [R8 SEC/PRM live readback](WP05_R8_SEC_PRM_LIVE_BOUNDARY_AND_OWNER_DECISION_2026-11-10.md), [R4 combined checkpoint](WP05_R4_CONSOLIDATED_OWNER_DECISION_CHECKPOINT_2026-11-10.md), [post-B1 retained ledger](WP05_B1_RETAINED_GATE_EXECUTION_LEDGER_2026-11-10.md).
