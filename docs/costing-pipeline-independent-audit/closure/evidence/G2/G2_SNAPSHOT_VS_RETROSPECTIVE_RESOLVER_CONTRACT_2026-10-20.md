# G2 snapshot attribution versus retrospective route resolution — 20 Oct 2026

## Live source verification
READ-ONLY pg_proc.prosrc:
- `costing.fn_resolve_effective_route_family_route(integer,date)`: currently requires nonarchived APPROVED routes with inclusive date eligibility; sorts effective_from/version/id descending and LIMIT 1. It **does not detect multiple candidates**.
- `costing.fn_resolve_effective_product_process_route(integer,date)`: same status/archive/date predicates, but counts matches and raises AMBIGUOUS_APPROVED_PRODUCT_ROUTE when >1.
- Earlier evidence: run82 has valuation date 2026-08-07 and 64 immutable DL snapshots referencing route9. Route9 was effective 2026-07-01 to 2026-08-10, subsequently SUPERSEDED and archived 2026-08-13. Its stored reference is historically appropriate regardless of current status.

## Proposed minimal bounded contracts (not implemented)
A. Snapshot read/explanation: return the explicit route ID and immutable workload/allocation values recorded for the selected run. Resolve route metadata *by that ID* even if superseded or archived; do not rerun as-of resolver or infer a successor. Never use archival alone to invalidate pre-existing snapshots.
B. Retrospective recomputation: independent, explicitly governed as-of selector; do not silently prefer latest. Read all relevant same-day candidates and fail closed on ambiguity. Archived predecessors should be considered for **provenance inspection** but must not be silently admitted into new computation. The historical eligibility rule requires a separate policy decision with evidence.
C. Current prospective approval / readiness / submit: preserve strict APPROVED/nonarchived and validation rules. Do not broaden these merely to repair retrospective reads.
D. Family and product as-of selection must have consistent explicit multiple-candidate detection. Date-effective ambiguity, status ambiguity, and missing temporal provenance are distinct review outcomes.
E. Frozen runs122 and128 must not be mutated or retroactively recalculated; run82 attribution stays intact. No undocumented route date/status corrections.

## Regression coverage still required
- Read run82 snapshot route9 after archival: returns stored route ID, correct original valuation date, no mutation.
- Retrospective recomputation Aug7: fail closed or governed permission based on explicit policy, not route9 silently disappearing or being reselected from another version.
- Family32 Aug17-23 historical predecessor and Aug24 overlap: unique vs ambiguous as documented.
- Family43 archived route49 plus route48/82: archival lineage review independent of prospective live selection.
- Product957 Aug25 same-day ambiguity; family68 and seven product predecessors with null effective_to.
- Strict approval lifecycle and authorization unchanged; route ambiguity handled identically at all historical selectors.
- Postgres integration testing absent; model-only fixtures are insufficient.
G2/CI-032 HIGH OPEN. No production SQL writes.
