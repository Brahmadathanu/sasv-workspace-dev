# G6 closure execution decision — 21 October 2026

## One definitive disposition (no circular audit)

**Run136 financial acceptance: PASS.** G2 current-release numerical gate CLOSED by owner. No more costing refresh required on unchanged sources. Seven cost pools reconcile; run135→136 627 matched SKU cost outputs; 17/17 integrity tests PASS. SKU1771 IK stays an intentional review.

**G6 production safeguard certification: HOLD**, NOT CLOSED. Exactly one unperformed class of evidence remains: PostgreSQL-executed negative-role, changed/stale-evidence and two-session concurrency tests of SECURITY DEFINER regional acceptance and release/designation paths. Reviewing the functions repeatedly is not an acceptable substitute. The current sandbox has Node.js but no local psql/postgres/initdb/docker and the connected SQL tool targets production, which must not be used for mutation tests.

## Minimal executable test handoff
Use an isolated throwaway PostgreSQL instance restored with the **live function DDL + relevant table schema and representative non-sensitive fixtures**. Never execute these destructive/concurrent tests against production. Run once, record transcript, fail on:
1. Ineligible marketing evidence may not be accepted.
2. Valid acceptance requires `module:costing-control-center` permission and a nonempty reason.
3. Future-dated, revoked, changed-source, changed-policy, changed-units or changed-sales-value acceptance cannot be mistaken for unchanged evidence; governed actual-monthly exception may match only when all strict positive actual-evidence predicates hold.
4. Two simultaneous approvals must not leave duplicate acceptance rows, and approval racing an underlying source change must not silently approve stale evidence.
5. Unprivileged caller cannot designate costing run or alter frozen snapshots. Validate API exposed schemas and function grants.
6. Confirm any required access-policy changes with owner before applying them.

Capture independent PG server version, exact definition hashes, test names, pass/fail and execution timestamps. If all pass, request explicit G6 acceptance and run136 designation. If a test fails, address the proven issue only and rerun that gate; a new costing refresh only if executable logic or costing inputs change.

## Repo / release gate
- PR#72 branch remains unmerged unless release checks independently approve it.
- Deliberately nondeployable future G2 route-attestation SQL must remain excluded from production migrations; its absence is **not** a blocker to current numerical G2.
- The separate Sheets freeze remains in effect until the owner formally closes G6. No Sheets edits or run designation authorised here.

## Actions actually performed
Verified runtime capabilities, read G6 and implementation rules. Prepared this bounded handoff. No production SQL writes or data changes; no test pass is fabricated.
