# WP04-G4 — Independent readback-only completion package

## Status

**READ-ONLY COMPLETION PACKAGE — FROZEN.**

Script: `c-independent-readback-completion.sql`  
SHA-256: `42ff34e909251f22938dbb971a65d232cdc9938cd3d2dcb643092e63c620fc02`  
Git blob: `f1fb472982909303b7d47318615845b2cf9948ce`

This package exists only to close the independent-readback evidence gap left when the previously frozen monolithic readback was platform-blocked before reaching Supabase after the consumed V3 correctness PASS.

It does not reopen or reuse the consumed V3 authorization and does not rerun V3.

## What it verifies

The package checks the restoration/state evidence the frozen independent readback was intended to prove:

- all 22 captured original function definitions still match their frozen MD5 identities;
- owner/ACL/search_path attributes of the canonical readiness function, enrich helper and run-evidence helper remain unchanged;
- all nine C candidate function names are absent;
- enabled event-trigger fingerprint matches the frozen baseline;
- the six snapshot-table column/type/nullability shape matches the frozen baseline fingerprint;
- textual callers of the run-evidence helper remain exactly the frozen expected caller set;
- no idle WP04 transaction remains;
- execution context is the expected postgres database/owner context.

## Read-only boundary

The script:

- starts `BEGIN READ ONLY`;
- uses catalog/state SELECTs only;
- contains no CREATE, ALTER, DROP, INSERT, UPDATE or DELETE;
- invokes no readiness, portfolio, performance or business function;
- performs no function definition change;
- performs no data mutation;
- does not execute `c-correctness-proposal-v3.sql`;
- ends with ROLLBACK.

The package reports one `overall_pass` boolean and individual evidence booleans. Any false result is a stop condition.

This package does not prove performance, final-output parity, deployment readiness, application readiness, or G4 closure beyond the readback evidence gap.
