# Gate 1B — Draft run-scoped frontend read contract (1 November 2026)
Status: DESIGN ONLY. No migration or production write authorised.

## Verified facts
- October approved run 143; draft run 148 SUCCESS with 628 stored SKU status rows (514 READY, 110 prime-cost review, 2 material review, 1 pricing review, 1 material blocker). Six stages SUCCESS.
- Public SKU status snapshot view selects one governed run per period, giving 143 in October; run-148 rows cannot be fetched through this view.
- Existing period run-status view exposes approved, displayed and newer-draft run IDs and is filtered by costing-control-center view permission.
- Existing SKU status view is security_invoker=true. Authenticated SELECT on underlying SKU snapshot and direct-labour snapshot is granted, but authenticated SELECT on costing.costing_refresh_run is NOT granted. A new security-invoker view joining that internal run table directly is therefore not a safe drop-in solution.
- Indexes exist on SKU snapshot (refresh_run_id, sku_id) and direct-labour snapshot (refresh_run_id, sku_id); no new index without measured necessity.

## Proposed minimal server change
Create a new read-only public run-scoped SKU status view alongside, not instead of, the existing governed-run view. Preserve the existing SKU status fields and direct-labour override semantics. Limit selected run IDs to those authorised and exposed through the existing permission-checked period-status view (displayed, approved, or newer successful draft). Enforce both period_start and refresh_run_id in client filters. No pricing-source change, no run mutation, no historical recomputation, no permission broadening on costing_refresh_run. Use security_invoker=true and explicit permitted identities validation; only grant SELECT on the new view to authenticated if independent permission and RLS checks pass.

Before writing migration SQL: verify live status-view definition proves newer_draft_run_id refers to a completed successful run, and verify the new view does not accidentally expose an in-progress, failed or unauthorised run. If the period-status contract is insufficient, design a narrowly scoped SECURITY DEFINER RPC with explicit permission and run validation rather than widening underlying table SELECT grants. Review SQL search_path and EXECUTE grants.

Preflight: record definitions, privileges, run designations, snapshot counts, index plan and rollback.
Postflight: run 148 exactly 514/113/1; approved run 143 parity; denied identity gets zero rows; approved/run fingerprint unchanged; explain query plan.
Rollback: drop only new read surface, preserve historical and existing views.

## Existing decision and gate
The earlier deferral of draft-run views until after October finalisation conflicts with the owner's requirement to investigate run 148 through the frontend before finalisation. This is a request to reconsider the sequencing decision, NOT approval to apply a migration. Require specific written approval after the concrete SQL, preflight and rollback are reviewed.

## Client next steps
PR #115 remains unmerged; revise the run-status-error wording so that a failed status read does not claim the server currently displays the loaded run. Coordinate cache bump with Jarvis before merge. Once a secure server read contract is approved and live, issue Claude C1B: add a run selector to the existing worklist, preserving correction navigation, run labels, and frozen evidence. Do not fabricate draft rows.

## Parked
Post-finalisation cause-split analytics and COST_REVIEW_WORKBENCH mapping; CI-048/049; historical reconciliation; C2–C6; migrations housekeeping. Consult the main completion register.
