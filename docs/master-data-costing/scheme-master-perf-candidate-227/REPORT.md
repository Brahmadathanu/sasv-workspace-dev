# Scheme Master 57014 — isolated minimal candidate and parity gate (issue #227), 8 Nov 2026

**Status: REVIEW-ONLY. Nothing was applied anywhere.** No production Supabase access, no authenticated session, no change to migrations, grants, timeouts, flags, Netlify or Electron. Formal Costing Suite progress unchanged (5/13). No full 40-screen suite was run, and the #214 LATERAL migration was not repeated.

## 1. Incidents (do not conflate; from committed notes, not re-queried)
| UTC | Source | Nature |
|---|---|---|
| 05:39:31 | PostgREST (`authenticator`) | real user-path 57014, `v_costing_scheme_master_register ORDER BY scheme_name LIMIT/OFFSET` |
| 12:49:56 | PostgREST | real 57014, same query shape, query id `3050687451330475886` |
| 06:44:42 | `mgmt-api` | manual diagnostic `EXPLAIN (ANALYZE…)` with `statement_timeout=4500ms`; **not** a user request, not evidence of user latency |

Latency of the two real incidents, request parameters and concurrency remain unproven. Live view md5 `8fdc0306bd2f1efbe0638c7c13ba4dda` could **not** be re-verified here (no read-only catalog access in this session): unverifiable, taken from the committed docs.

## 2. Contract and index analysis (frozen SQL contract)
The view reads `costing.sku_scheme_viability_snapshot` once per scheme (7 loops) via `LEFT JOIN LATERAL` computing `count(*)`, `count(DISTINCT period_start)`, `max(period_start)` where `scheme_id = sm.id` (~38.5k rows/scheme, ~231k total per the plan review). The three needed columns are `scheme_id` and `period_start`.
- `idx_sku_scheme_viability_snapshot_scheme (scheme_id)` finds the rows but does **not contain** `period_start` → heap fetch of every row (wide table).
- `idx_sku_scheme_snapshot_period_status (period_start, status, sku_id, scheme_id)` has `scheme_id` trailing → cannot be range-scanned by scheme.
- Hypothesis tested: covering `(scheme_id, period_start)` lets the planner use an **Index Only Scan** and read presorted keys for the distinct count.
- **Not verifiable from the repo:** real table DDL and index DDL (not committed), real row width, bloat, visibility-map state, autovacuum behaviour.

## 3. Isolated measurements (scratch PostgreSQL 16.15, synthetic fixture `01_isolated_fixture.sql`)
Fixture: 231,120 snapshot rows, 6 populated schemes + 1 empty, 106 MB heap, shape inferred from the contract — **an approximation, not production data**. Query: `select * from view order by scheme_name asc limit 1000`. P50 of 7 warm runs after 1 discarded (`03_bench.sh`).

| Variant | Warm P50 / max | Shared buffers touched | "Cold-ish" first read after server restart (3 runs) |
|---|---|---|---|
| A. applied LATERAL view, existing indexes | 94.7–103 ms / 128–140 | ~18,555 | 160 / 175 / 209 ms; 15,920 hit + 2,649 **read** |
| B. same view + `(scheme_id, period_start)` index | **35.4 ms / 47** | **285** | 33–50 ms; 67 hit + 224 read |
| C. alternative aggregation (group by period, sum), existing indexes | 93.7 / 104 | 18,555 | not separately measured |
| D. alternative aggregation + new index | 35.0 / 48 | 285 | 38–50 ms |

Findings: **the index is the decisive element; the alternative aggregation adds nothing** (C≈A, D≈B), so it is rejected as unnecessary risk. Cold-ish figures only restart PostgreSQL (shared buffers emptied); the OS page cache was **not** dropped, so these are **not physically cold** and not production latency. The ~3× warm and ~10× buffer reduction is a *synthetic-fixture relative* result; absolute production gains are unproven. The result depends on index-only scans, i.e. on a fresh visibility map (VACUUM). If production autovacuum lags, the benefit shrinks toward variant A (still no worse, plan falls back to heap fetches).

## 4. Parity and security (isolated)
- 34 output columns identical in count to the contract (34). Variants A vs C: `EXCEPT` both directions = **0 differing rows of 7**, including the empty scheme (0 / 0 / NULL), system-defined (scheme 1) and inactive (scheme 6) rows. Candidate B/D adopts the **unchanged view**; an index cannot change row output, so B parity with A is structural plus planner-equivalent result (same 7 rows).
- Gate/roles (fixture stub of `fn_costing_view_allowed`, not the real function): `anon` → permission denied (42501); `authenticated` with gate false → 0 rows; gate true → 7 rows. These replicate role semantics only; the **real** `fn_costing_view_allowed` and RLS on the snapshot table were not exercised.
- The candidate changes no grant, no view, no flag, no function.

## 5. Index cost (synthetic)
`idx_cov` 1,760 kB vs existing scheme-only index 1,504 kB, period_status index 21 MB, heap 106 MB (≈+1.7 % relation size). Write overhead: 40k-row insert 298 ms without vs 505 ms with the index (single run, noisy, ~+70 % on bulk-load time of this narrow synthetic rows; refresh-run bulk writes in production are wider and include other indexes, so relative overhead there is expected lower but is **unmeasured**). Build: `CREATE INDEX CONCURRENTLY` takes SHARE UPDATE EXCLUSIVE, allows writes, but cannot run in a transaction (so not via `apply_migration`).

## 6. Decision: conditional GO for owner review (not self-authorised)
Smallest safe correction = **one additive index**, view untouched: `candidate_index.UNAPPLIED.sql`. Rollback = `candidate_index.ROLLBACK.sql` (pure `DROP INDEX CONCURRENTLY`; no data effect). Read-only checks: `candidate_index.VERIFY_READONLY.sql`.
**Not claimed:** that 57014 will disappear, true cold runtime, or production gains. Before approval the owner/ChatGPT should (a) fetch real index/table DDL and `relallvisible/relpages`, (b) confirm a maintenance window and that no other process holds long locks, (c) after build run one `ANALYZE`/VACUUM, then (d) re-run the single authenticated 1280 px Scheme Master check (not the 40-screen suite). If it still times out, next candidates are a governed summary table or `LIMIT`-bounded refresh-time counts — out of scope here. **NO-GO triggers:** index build exceeding the agreed window, replication lag, or plan not using the new index.

## 7. Reproduce
`initdb` scratch cluster → `01_isolated_fixture.sql` → create `v_base` from the applied migration body (sed rename) → `02_…` for variants → `create index … (scheme_id, period_start)` → `03_bench.sh <socketdir> <view>`.
