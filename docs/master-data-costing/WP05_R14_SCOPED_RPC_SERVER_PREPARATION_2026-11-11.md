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

**Limits (all still open, updated for the live results above):** the permission helpers and roles are **models** of the documented live behaviour, not the live `require_permission` / grants; no RLS state on the real snapshot table was observable; synthetic data and a stubbed governed-run view; the live planner estimates and the timeout correlation above come from the reviewer's read-only run, not from this work; still none: real-role denial proof, real-data output parity, p50/p95 cold/warm measurement, staging with matching roles. October is **not a performance pass** (−0.57 % planner estimate, risk open).

## Live read-only gate results (executed by the independent reviewer, 11 Nov 2026; recorded here, **not** run by me)
Source: [#275 review](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/275#pullrequestreview-5858676992) and [#273 comment](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273#issuecomment-6795804745). Catalogue `SELECT`s inside `BEGIN READ ONLY`/`ROLLBACK` and plain `EXPLAIN` (no `ANALYZE`) on project `qhmoqtxpeasamtlxaoak`, plus historical logs. No function, view or data execution, no DDL/DML.

| Gate | Live result | Disposition |
|---|---|---|
| G1 hashes | internal view `63adf794…` (matches the guard); public wrapper `3382dc88e1db5589d5855ba858478c31` | guard holds |
| G2 overloads | scoped function name count **0** | no collision |
| G5 columns | internal and public both **63** | contract holds |
| G3 `require_permission(text,boolean)` | postgres-owned `SECURITY DEFINER`; checks `auth.uid()`, `user_permissions_canonical.can_view`, and `can_edit` only when requested | **matches my local model** (the model remains a model; real-role tests still required) |
| G4 snapshot table | postgres-owned, **RLS enabled, not forced, 0 policies**; internal view ACL `service_role` SELECT only; public wrapper `authenticated` SELECT | see boundary note below |
| G6 statistics | ~1,456,613 estimated rows; last explicit `ANALYZE` 2026-11-05 10:19 UTC; last autoanalyze 2026-10-24 07:20 UTC | October estimate remains statistics-sensitive |
| Role timeouts | **`authenticated` statement_timeout = 8 s**, `authenticator` 8 s, `anon` 3 s | confirms the budget; says nothing about RPC latency |

**Timeout correlation (replaces the earlier "consistent with, not proven").** Edge logs for `/rest/v1/v_cost_sheet_snapshot_sku_monthly_comparison_governed`: HTTP 500 with origin time 8094 ms at 09:16:05.276Z and 8058 ms at 09:30:31.942Z. Postgres logs: `canceling statement due to statement timeout` at 09:16:13.318Z and 09:30:39.966Z, about 8 s after each request. Neighbouring successes returned 200 in 5580/1869 ms and 2060/1146 ms. This establishes the **statement-timeout mechanism with high confidence**. The per-request SQLSTATE was **not** read from a response body, so SQLSTATE `57014` is inferred from the log text, not directly inspected.

**Planner results, current live statistics (plain EXPLAIN root total cost; candidate extracted from the prepared body with typed first-of-month date and limit 2000):**

| Period | Existing 63-col view | Scoped candidate | Change |
|---|---:|---:|---:|
| Sep 2026 | 7033.45 | 4601.54 | −34.6 % |
| Oct 2026 | 7033.45 | 6993.40 | **−0.57 %** |
| Nov 2026 | 7033.45 | 2412.99 | −65.7 % |

These are planner cost units, **not** runtime, p95 or a performance result. **October: the earlier +1.7 % concern is currently not reproduced in EXPLAIN, but the margin is tiny and the risk remains open** (October's three-period window includes the large September population). This is not a performance pass. The local ~30× figure is synthetic and is not live evidence.

**Security boundary note.** The new function is postgres-owned `SECURITY DEFINER` over a table with RLS enabled and no policies, so it reads past RLS; the permission gate (`require_permission` + input validation + EXECUTE only to `authenticated`) is the whole boundary, hence real-role staging tests and the confidential-column review below are non-waivable. *Inference to verify (gate G4b, reloptions `security_invoker`):* the existing public wrapper is also a postgres-owned view, which would make it read past RLS the same way, so the RPC would add no new data path beyond the 63 columns the same permission already reads. The 63 columns are SKU-level cost, price, status and run-label fields plus product/category names and the free-text `cost_sheet_note`; none is a staff or per-person field. `cost_sheet_note` is the one free-text column and must be reviewed on staging data.

## Gates before the owner may approve application (all required)
1. ~~Run live read-only gates~~ **Done by the reviewer (above)**; re-run `00_preflight_readonly.sql` on the staging target and immediately before any application (stop if the hash differs, an overload exists, owner ≠ `postgres`, policies/RLS unexpected, or October regresses beyond an owner-set tolerance).
2. ~~Timeout correlation~~ **Done (mechanism high confidence; SQLSTATE inferred)**.
3. Staging with matching roles, per [the staging acceptance package](prepared/staging/STAGING_ACCEPTANCE_PACKAGE_2026-11-11.md): real-role authorization, real-data 63-column bag parity, cold/warm p50/p95, rollback drill. **Not run: no staging target is authorised and no billable branch was created.**
4. Client flag fallback tested (client PR) before any flag enablement.
Any failure: stop.

## Commands
```
node scripts/csr-scoped-rpc-server/prepared-sql-contract.test.mjs
node scripts/csr-scoped-rpc-design-smoke.mjs
PSQL_ARGS="-h /tmp/pgs -U postgres" scripts/csr-scoped-rpc-server/run.sh   # throw-away local server only
```
