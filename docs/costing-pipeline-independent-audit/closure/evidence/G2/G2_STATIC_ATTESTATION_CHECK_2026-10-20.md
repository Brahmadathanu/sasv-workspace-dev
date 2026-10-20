# G2 static attestation evidence — 20 October 2026

**Source:** branch `costing/au4-normal-budget`, `closure/prepared/HELD_G2_route_repetition_evidence_20261020.sql` and `scripts/costing-g2-attestation-migration-static-smoke.mjs` fetched directly from GitHub.

## Actual execution
Executed 25 JavaScript RegExp / count checks against the current 19,515-character staged SQL body in the connected tool runtime (not by invoking Node CLI). **25/25 passed**:
- 18 required source-pattern checks passed;
- both ordinal/ordering count checks passed (2 each);
- three family-header `FOR SHARE OF fr` references found, matching corrected static script;
- both review submission RPCs and both parent `FOR UPDATE` selectors are present (4 checks).
- The script references the canonical HELD prepared SQL path; the SQL begins with the unconditional `G2 HOLD` exception.

## Limits / remaining required tests
This is **static execution only**. Does not establish PostgreSQL syntax validity, function compilation, expected grants, RLS effectiveness, actor permissions, route mutation rejection, deadlock freedom, transactional behaviour, or correctness of route repetitions. It must not be represented as an end-to-end PASS. Migration must not deploy with initial HOLD, and HOLD must not be removed before isolated DB verification. The approved historical runs 122/128 remain untouched.

**Disposition:** static source gate PASS; G2 functional database gate HOLD; release/refresh/Sheets blocked.
