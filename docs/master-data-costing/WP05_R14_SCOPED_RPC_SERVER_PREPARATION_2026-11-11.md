# WP05 R14 — scoped Cost Comparison RPC: server preparation (#273, review-only)

**Date:** 11 Nov 2026 · stacked on [#274](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/274) (harness, diagnosis) · authority: [#274 review](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/274#pullrequestreview-5857484392) and [#273 decision](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273#issuecomment-6793681511).
**NOT APPLIED. NOT a migration.** D-7 #24 remains FAIL; WP05 OPEN; programme 6/13. No DDL, GRANT, flag, deploy, cache bump or release is made or authorised by this PR.

## What is prepared
| File | Purpose |
|---|---|
| `prepared/PREPARED_20261111_csr_scoped_comparison_rpc.sql` | One additive function, one transaction. Outside `supabase/migrations` so nothing can apply it by merge |
| `prepared/…_rpc_rollback.sql` | Drops exactly that function; refuses if not exactly one |
| `prepared/…_rpc_live_readonly_gates.sql` + `scripts/csr-scoped-rpc-server/gen_explain_gates.mjs` | Production read-only gates (catalogue + plain EXPLAIN Sep/Oct/Nov). **Not run** |
| `scripts/csr-scoped-rpc-server/run.sh`, `security_*.sql`, `bag_equivalence.sql` | Local disposable PostgreSQL 16 checks |
| `scripts/csr-scoped-rpc-server/prepared-sql-contract.test.mjs` | Static contract (no DB) |

Function body is byte-identical to the reviewed design except `CREATE` (not `OR REPLACE`) and `search_path` narrowed to `pg_catalog, pg_temp`; both asserted by the static test. Preserved from the design: view hash guard (`63adf794…`), first-of-month check, 1..2000 cap, `module:costing-control-center` view-only gate, run selection unchanged because the body is the original view SQL with a three-period input restriction. New: refuses **any** pre-existing function of that name; post-conditions (SECURITY DEFINER, STABLE, owner `postgres`, pinned search_path, no EXECUTE for anon/PUBLIC, authenticated yes, 63-column contract on both views) abort and roll back; `lock_timeout 3s` for the apply session only; `statement_timeout` untouched.

## SECURITY DEFINER vs INVOKER
INVOKER is **not viable without widening exposure**: the internal governed view and `costing` schema are deliberately not granted to `authenticated` (live W1 posture). Local test T20 shows an INVOKER variant is denied (`42501 permission denied for schema costing`) for an ID-V identity; making it work would mean granting `USAGE` on `costing` and `SELECT` on the internal view, bypassing the wrapper's permission gate. DEFINER is therefore proposed as a **constrained privileged surface**: owner `postgres`, pinned search_path, schema-qualified body, read-only (no DML/DDL/dynamic SQL, asserted), same gate as the public wrapper, EXECUTE only to `authenticated`, return type limited to the existing 63 governed columns (no individual staff/trace columns are added; any sensitivity already in those columns is already readable through the existing wrapper by the same permission). Stricter than the wrapper in one respect: it requires a signed-in `auth.uid()`, so `service_role` is denied.

## Local verification (disposable PostgreSQL 16.15, synthetic data; `run.sh` exit 0, 51 NOTICE-level PASS lines plus guard/rollback lines)
- **Bag equivalence:** `EXCEPT ALL` both directions, row counts and per-column NULL profiles equal for 2026-09, 2026-10, 2026-11, 2025-10, 2024-01 and for absent 2025-11 / empty 2026-12; column names, order and types identical (63). Negative control: a duplicated row is invisible to `EXCEPT` (0) but caught by `EXCEPT ALL` (1).
- **Order / cap:** deterministic under a deliberate `(product_name, sku_column_label)` tie (resolved by `sku_id`); with 2,630 governed rows the RPC returns exactly the first 2,000 of the ordered view. Truncation is therefore **explicit and detectable** (`rows == 2000`); the client PR must warn on it. `p_limit` 0/NULL/2001 rejected.
- **Negative identities (modelled roles):** anon denied at EXECUTE; signed-out authenticated "Not authenticated"; signed-in without permission, other-module-only, `can_edit` without `can_view`, explicit none: all `42501`; service_role denied; ID-V view-only succeeds. Direct reads of the internal view and snapshot table by authenticated denied. Shadow temp tables/functions created by a signed-in user do not change the result. Callable in a READ ONLY transaction.
- **Guards:** wrong view hash aborts; any overload aborts; PUBLIC grant trips a post-condition and nothing is left behind; second apply refused.
- **Rollback:** forward apply changed no view, index, row count or `statement_timeout` (fingerprint equal); rollback removes the function and restores the identical fingerprint; rollback refuses when absent; roll-forward and security tests pass again.

**Limits (all still open):** the permission helpers and roles are **models** of the documented live behaviour, not the live `require_permission` / grants; no RLS state on the real snapshot table was observable; synthetic data and a stubbed governed-run view; no production planner estimates, no October +1.7 % re-check, no 500/57014 log correlation, no p50/p95 cold/warm measurement, no staging with matching roles. The prior live EXPLAIN-only October estimate (+1.7 %) remains an **open gate**.

## Gates before the owner may approve application (all required)
1. Run `…_live_readonly_gates.sql` read-only; record G1–G7 and the Sep/Oct/Nov plain EXPLAIN pairs with fresh-statistics awareness. Stop if hash differs, an overload exists, owner ≠ `postgres`, policies/RLS are unexpected, or October regresses beyond an owner-set tolerance.
2. Correlate one failed request to SQLSTATE + timestamp; record the role `statement_timeout`.
3. Staging/Supabase branch with matching roles: apply, rerun `security_tests.sql` against real helpers and real identities (anon, ID-N, ID-X, ID-V), actual governed-run 63-column bag parity, cold/warm p50/p95 on the real view vs RPC, tested rollback.
4. Client flag fallback tested (client PR) before any flag enablement.
Any failure: stop.

## Commands
```
node scripts/csr-scoped-rpc-server/prepared-sql-contract.test.mjs
node scripts/csr-scoped-rpc-design-smoke.mjs
PSQL_ARGS="-h /tmp/pgs -U postgres" scripts/csr-scoped-rpc-server/run.sh   # throw-away local server only
```
