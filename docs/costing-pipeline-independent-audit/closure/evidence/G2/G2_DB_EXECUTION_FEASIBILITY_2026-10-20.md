# G2 database execution feasibility and read-only live schema check — 20 October 2026

## Test environment inspection (actually executed)
- Current runtime: Node 22 available; **no** `psql`, `postgres`, `initdb`, `pg_ctl`, Docker or Podman binaries; Python `psycopg` and `pglast` absent.
- Attempt to install `pglast` failed because package index is unreachable; **no PostgreSQL parser or database compiler was run**.
- Repository `closure/evidence/TB/run_tests.py` is a historical TB1–TB7 test script. It requires hard-coded `/workspace/au4wt`, `/workspace/tb`, Unix socket `/tmp` port `54329`, existing template database `tb` and psycopg. Its repository source and past result JSON are present, but those external runtime fixtures are **not present in the current execution environment**. It does not test G2 attestation. Past TB results therefore cannot certify new G2 SQL.

## Live read-only schema compatibility
Executed a read-only `information_schema.columns` query on Supabase project `qhmoqtxpeasamtlxaoak` for route headers, family steps and overrides. Found:
- both family/product route `id` bigint, `route_version` integer, `status` text, `archived_at` timestamptz;
- product `base_route_family_route_id` bigint;
- family step `family_route_id` bigint, `step_key` text, `sequence_no` numeric, `expected_occurrence_count` numeric, `standard_cycle_count` numeric;
- product override `product_route_id` bigint, `sequence_no` numeric, `expected_occurrence_count` numeric, `standard_cycle_count` numeric.
These types are compatible with the corresponding references and numeric casts visible in the **held** G2 migration. This is a limited metadata match, not compiled SQL.

## Gate
**STATIC SOURCE 25/25 PASS; LIVE COLUMN-TYPE CHECK PASS (selected columns); ISOLATED DATABASE COMPILATION/ACCESS/PERMISSION/CONCURRENCY TESTS NOT EXECUTED.** No live writes, migration or cost-bearing branch created. First-statement deployment HOLD remains. Next technical dependency is obtaining/reconstructing an executable PostgreSQL 17 fixture; do not approve merge of the held migration or start a refresh before real functional evidence.
