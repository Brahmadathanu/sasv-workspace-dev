# WP04-G4 — First operational portfolio result and assessment

2026-10-04. One authorized execution completed. Correctness checks PASS_LIMITED_SCOPE; observed latency ABOVE_DOCUMENTED_GOALS; G4/application HOLD.

## Authority and fresh guards
Explicit user authorization: projectqhmoqtxpeasamtlxaoak, main4a8525caf4bf95e9c60bb00188706154d36b3d85, exact script SHA256c4477062f6f02e243e5b9bfc6b56ff6e0254b22408eb28b05ddad10a9fa9a29c, one execution only, noCOMMIT/no retry, restore/ROLLBACK, independent readback, stop. Fresh fetch matched main4a8525c and audit a33fa4810f29d89ef9c4588d9b4187be14e4569a. Exact LF script95,927bytes/hash matched. Connected project sasv-workspace ACTIVE_HEALTHY/Postgres17. READ ONLY fresh six source/ACL/attribute/event-trigger/candidate-absence guards passed; postgres owner; periodSeptember2026/valuation09-10/SUCCESS115; membership611; firstoperationalSKU1; existing actor claim/Control Center view permission true. SQL claim context is not native Auth/API proof.

## Single execution result
Exactly one execute_sql call received the frozen script. Its one operational portfolio invocation completed, all in-transaction checks/restore passed and the final ROLLBACK completed. No COMMIT, timeout, automatic retry, deployment, extra scope or client work. Returned metadata:

```json
{"operation":"WP04_G4_SINGLE_OPERATIONAL_PORTFOLIO_PROPOSAL","deployment":"NOT_AUTHORIZED","elapsed_ms":10822.426,"native_api":"NOT_RUN","all_existing":"NOT_RUN","response_bytes":14491,"restore_checks":"PASSED_IN_TRANSACTION","returned_count":1,"population_count":611,"population_scope":"OPERATIONAL","full_verification":"NOT_ESTABLISHED","within_3s_page_goal":false,"portfolio_invocations":1,"within_5s_statistics_goal":false,"first_row_canonical_parity":"PASS","envelope_and_severity_census":"PASS"}
```

All611 operational members were assessed despite limit1. Same-snapshot population/matched totals, context, severity total611, first page returned1/has_more/nextid and exact firstSKU1 baseline JSON equality passed. Response size14,491bytes is octet_length of PostgreSQL JSONB text for this limit1 response, not HTTP wire size. elapsed10,822.426ms is database wall-clock timing around the single function invocation, not client/API end-to-end latency. Other transaction setup/baseline/DDL/restore/readback time is excluded. No full readiness/business payload emitted.

## Independent restoration readback
A separate READ ONLY transaction repeated frozen original six source/ACL/attribute/event guards successfully. Returned independent_source_acl_attribute_event_readback=PASS; candidate_function_count=0; idle_wp04_transactions=0. Original server authority/access restored; no candidate endpoint remains committed. This was an authorized production transactional DDL/load operation, not a read-only operation or deployed feature. No data/fixture/actor/permission-assignment writer, paid resource, client implementation, merge/tag/release. Logs/statistics/OID consumption/load/locks are not claimed absent or undone.

## Independent G4 assessment
- Retain earlier limited rehearsal/readback PASS and two-sample read-only expression PASS unchanged.
- New evidence establishes one OPERATIONAL portfolio runtime invocation and its bounded count/envelope/first-row parity checks. It does not establish all-SKU parity, ALL_EXISTING, filters/keyset traversal, no-run/lazy branches or CSE ambiguity consumption across the population.
- Observed10.822s exceeds documented3s page and5s full-statistics goals. These remain goals, not approved SLAs; one measurement does not characterize cold/warm/concurrent distribution or prove a root cause. It is material evidence requiring performance disposition before application; do not repeat to obtain a faster PASS, raise timeout, conceal full work with a smaller page, invent a latest-row authority, or add an unreviewed index.
- Native/API permission matrix, full payload/monetary-note certification, broader performance/plans, committed rollback and existing-client regression remain unresolved. No acceptance or deployment waiver follows from successful SQL execution.

Authorization consumed by one execution. G4 is incomplete, application HOLD, G5 blocked. Stop after evidence assessment. Exact next gate: WP04-G4 — Measured portfolio-performance disposition: source/read-only bottleneck analysis and bounded correction/proof plan review, before any separately authorized new operation. No optimization, RPC/index change, further runtime test or client work is authorized here. G0–G3 retained; programme4/13; WP03closed; parked/locked/DEC-014 unchanged; formal WP04 closure still requires complete records and WP05 new-chat handover.
