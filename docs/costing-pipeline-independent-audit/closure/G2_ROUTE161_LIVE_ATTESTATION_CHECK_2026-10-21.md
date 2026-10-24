# G2 route verification — 21 October 2026

Read-only live verification after the independently completed run131 internal cost reconciliation.

Source routes: costing.production_route_family_route_step, family_route_id 144 and 161.
- Historical approved route144: 9 step rows; 6 have both expected_occurrence_count>1 and standard_cycle_count>1.
- Corrected route161: 9 step rows; 0 have both factors>1.

This verifies the known six doubled recurrence settings were removed prospectively in route161 while route144 remains historical. It does NOT establish G2 preventive-attestation enforcement. Live costing schema contains no function with a name matching attest/repetition, and repository ISSUE_REGISTER describes prospective G2 attestation as HELD and not DB-verified. CI-032 remains open. Do not deploy the experimental migration until provenance, permission, stale-evidence and concurrent-edit tests pass under the repository implementation rules.

Financial checks in RUN131_INTERNAL_OVERHEAD_CONSERVATION_2026-10-21.md were committed separately at 364e8371742356ca93d2ea65d17abea1abe29d97. Run131 stays SUCCESS, UNAPPROVED; no new refresh, approval, pricing or Sheets activity.
