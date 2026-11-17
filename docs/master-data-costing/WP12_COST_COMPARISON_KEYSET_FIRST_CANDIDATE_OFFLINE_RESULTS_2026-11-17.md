# WP12 — Keyset-first Cost Comparison CANDIDATE: offline implementation and parity results (17 November 2026)

**CANDIDATE ONLY. NOT A MIGRATION. NOT APPLIED. NOT DEPLOYED. NO PRODUCTION ACCESS.** Everything here ran in a throwaway local PostgreSQL 16.15 cluster (unix socket only, synthetic fixtures). The scoped-RPC flag `COSTING_CSR_SCOPED_COMPARISON_RPC_V1` stays **OFF**. WP10/WP12 OPEN, WP11 CLOSED, Electron HOLD. No change to `supabase/`, `public/`, `electron/`, `js/`, grants, RLS, flags or the installed function. Implements §2/§4 of the [proposal](WP12_COST_COMPARISON_KEYSET_FIRST_PROPOSAL_2026-11-17.md); context in the [investigation report](WP12_REGRESSION_AND_COST_COMPARISON_TIMEOUT_INVESTIGATION_2026-11-17.md) §8. Branch `claude/wp12-keyset-first-candidate`, based on PR #472 head `0e7f304` (PR #472 untouched).

## 1. What was built (all under `scripts/csr-comparison-verifier/`)
| File | Purpose |
|---|---|
| `candidates/keyset-first/candidate-function.sql` | New function `public.rpc_get_cost_sheet_sku_monthly_comparison_scoped_keyset_v1(date, integer)`; **new name**, installed function untouched. Not under `supabase/` so no tooling can apply it. |
| `candidates/keyset-first/candidate-grants.sql` | Privilege statements a future migration would need (REVOKE PUBLIC/anon, GRANT authenticated). Used only in the fixture. |
| `candidates/keyset-first/fixture-extra.sql` | Opt-in synthetic scenarios (name change, duplicate SKU, NULLs, missing history, draft/approved, NULL `sku_id`, decoy run, alternate run). |
| `candidates/keyset-first/candidate-keyset-rpc.sql`, `installed-rpc-reference.sql` | Candidate / comparator reads for `verify.mjs`. |
| `candidates/keyset-first/plan-evidence.mjs` + `evidence/synthetic-plan-shape-2026-11-17.json` | Synthetic plan-shape tool and its recorded output. |
| `keyset-first.parity.test.mjs` | 11 tests (picked up by `node --test scripts/csr-comparison-verifier/*.test.mjs`, i.e. the existing `wp05-csr-verifier` workflow path filter). |
| `lib.mjs`, `verify.mjs` (+8/−2 lines) | Opt-in `candidateFunctionSql` / `extraFixtureSql` (CLI: `--candidate-function-sql`, `--extra-fixture-sql`). Defaults unchanged; the original 29 tests pass unmodified. |

**Shape.** (1) pivot only the requested period (`cur_pivot`); (2) keep the first `p_limit` groups in final sort order (`cur_keys`, `MATERIALIZED`); (3) pivot previous-month/previous-year **only for `sku_id IN (cur_keys)`**; (4) the same LEFT JOINs, 63-column projection, `ORDER BY product_name, sku_column_label, sku_id`, `LIMIT p_limit`. Pivot select list, `GROUP BY`, governed-run join, comparison projection, outer projection and guards are **textually identical** to the installed migration (a test asserts this; the candidate was assembled from the migration text, not retyped).

**Why bag semantics survive the early LIMIT (resolves proposal risk (a)).** Every current group yields ≥ 1 output row (LEFT JOIN) and all fan-out rows of one current group share its sort keys, so the first `p_limit` output rows are always drawn from the first `p_limit` current groups. Historical groups of a kept `sku_id` are pivoted whole, so name-change duplicates fan out exactly as in the installed function. NULL `sku_id` never joins history in either shape.

## 2. Offline results (exact)
| Check | Result |
|---|---|
| Original verifier suite, unmodified, before any change | 29/29 PASS |
| New candidate suite `keyset-first.parity.test.mjs` | **11/11 PASS** |
| Whole CI path `node --test scripts/csr-comparison-verifier/*.test.mjs scripts/csr-scoped-rpc-client/*.test.mjs scripts/csr-pwa-freshness/*.test.mjs` | PR-head baseline **60/60**; candidate branch **71/71** (+11 new, 0 changed) |
| `verify.mjs` with the candidate on the base fixture | 12/12 periods PASS (Sep/Oct/Nov 2026, 7 synthetic months, empty 2024-01, 2105-SKU cap month 2027-03) |

What the 11 tests cover: isolation (candidate referenced nowhere in `supabase/`, `public/`, `electron/`, `js/`); textual provenance; 63 column names, order **and result types** equal to installed RPC and governed view; catalogue/security surface equal (SECURITY DEFINER, STABLE, `search_path=pg_catalog, pg_temp`, args/defaults, return set, owner) and fixture privileges authenticated=EXECUTE, anon/PUBLIC=none, anon refused at the privilege layer; guards (unauthenticated, permission-denied, bad period, `limit` 0/-5/2001/NULL) fail **identically** to the installed RPC; strict parity against **both** the governed-view read and the installed RPC (bidirectional `EXCEPT ALL`, strict `::text` bag, row order, 63-col contract, cap) for base and extra periods; an independent oracle on the extra fixture; a `p_limit` sweep 1…total+3 (exercising 2 tie-cuts and ≥30 strict cuts), plus 1/5/1999/2000 at the 2105-SKU cap month; run-selection flips; seven candidate-specific mutants.

Scenarios (extra fixture, period 2028-05, 33 result rows): name change across runs (SKU 200001: current/previous-month/previous-year names differ, 2 previous-year groups ⇒ 2 rows); duplicate SKU in the current period × 2 previous groups (SKU 200002 ⇒ 4 rows, bag preserved); all-NULL values and NULL label; missing previous month only / previous year only / all history; NULL `product_name` sorts last; zero previous COP ⇒ NULL percent with defined numeric change; NULL `sku_id` current group retained and never joined to a NULL-`sku_id` history group; previous month present only in a non-governed run ⇒ NULL; historical periods (Jan boundary etc. from the base fixture). Run selection: governed pointer flipped to an alternate run as DRAFT then APPROVED, previous month DRAFT→APPROVED, previous-month and previous-year pointers deleted, current pointer deleted, pointer attached to a run of another period (period-equality rejects) — each equal to both comparators; pointer table restored and re-verified.

**Mutants detected (each must fail the strict comparator):** collapse-duplicate-keys (`DISTINCT ON sku_id`, i.e. the proposal's risk (a)), history too narrow, wrong year offset, run join without period equality, keys `LIMIT p_limit − 1`, keys ordered wrongly, final ordering wrong. The pre-existing installed-RPC mutants (null-flip, scale-drift, prev-COP-shift, etc.) remain green in the original suite.

**Known, documented caveat (identical to the installed function).** Rows tied on `(product_name, sku_column_label, sku_id)` — e.g. the 2×2 fan-out of one current group — have no defined order among themselves, so a `p_limit` that cuts *inside* such a tie may legitimately return a different member of the tie under any plan. The tests assert strict equality only for cuts outside ties and, for tie-cuts, equal counts, equal sort-key sequence and membership in the full result. Also unchanged from the installed pair: the governed-view baseline read orders by `(product_name, sku_column_label)` only; the RPCs add `sku_id`.

## 3. Regressions: pre-existing vs candidate-induced
Offline Costing/WP10 suites run on both a clean worktree of PR head `0e7f304` and this branch: `console-rpc-allowlist`, `wp10-client-release-contract` and the 12 non-browser `wp10-g2-safeguards` suites — **74 tests, 67 pass, 7 fail on BOTH trees, identically** (S4, S5, S6, S9, S10, "PM BOM reviewed WP11 addition", "SW v393→v394 delta"). They compare the working tree with `origin/main` (e.g. `git show origin/main:public/shared/js/products.js`, "`manage-pm-bom.html` differs from main by more than the reviewed WP11 addition"), so they depend on branch/`main` divergence unrelated to this work. **Classification: pre-existing, 0 candidate-induced.** Not run: Playwright/browser suites and every script that contacts a hosted site (no network targets by instruction).

Working-tree note: five `supabase/migrations/2026111211*–2026111215*_pec_*.sql` files show as modified in the cloud checkout, but `git diff --ignore-cr-at-eol` is empty for them (CRLF noise from the checkout). They are **not** part of this change and were not staged.

## 4. Performance evidence — SYNTHETIC SHAPE ONLY, no production claim
Tool: `candidates/keyset-first/plan-evidence.mjs`; recorded output `evidence/synthetic-plan-shape-2026-11-17.json`. Local PG 16.15 sandbox VM, `EXPLAIN (ANALYZE, BUFFERS)` of the **extracted function bodies** (a plain `EXPLAIN` of the RPC is opaque), literal parameters, no parallelism, warm cache, one warm-up + three runs, an **assumed** `idx_cost_sheet_snapshot_period_sku(snapshot_period_start, sku_id)` taken from the proposal (not verified in production). Milliseconds below are three local warm runs, **not a percentile** and not comparable to the 8 s authenticated timeout.

| Synthetic scenario (Nov 2026 request) | Rows entering aggregates: view / installed RPC / candidate | Buffers touched: view / RPC / candidate | Local ms (3 runs): RPC → candidate |
|---|---|---|---|
| 3000 SKUs/period, 1 run, limit 2000 (cap bites) | 1,449,000 / 189,000 / 149,000 | 28.6k / 28.7k / 80.8k | 751–773 → 580–590 |
| 1500 SKUs/period, 1 run, limit 2000 (cap does not bite) | 724,500 / 94,500 / 94,500 | 14.3k / 14.4k / 28.7k | 333–359 → 321–328 |
| 230 SKUs/period × 14 retained runs (~1.56 M rows), limit 2000 | 111,090 / 14,490 / 14,720 | 30.7k / 30.8k / 33.0k | 212–232 → 173–215 |
| same, limit 100 | 111,090 / 14,490 / 9,030 | 30.7k / 30.8k / 33.0k | 207–218 → 171–183 |

**What this does and does not show — read before drawing conclusions**
1. The keyset-first idea prunes historical aggregation **only when `p_limit` is smaller than the period's SKU population**. The client always requests 2000. The live plain-`EXPLAIN` estimate was ~5,096 grouped pivot rows across *all* governed periods (investigation §8), i.e. very roughly 220 groups per period if spread evenly — far below 2000. **If that holds, the cap never bites and the candidate aggregates essentially the same rows as the installed RPC** (row 3: 14,720 vs 14,490; row 2: identical). That estimate is a planner statistic, not a measured SKU count; a real count is a missing input.
2. Even where rows are pruned, the candidate touches **more buffers** (second heap/index passes, materialised keys) in every scenario, and any time difference here is a local warm-cache artefact. **No production speed improvement is claimed, and none should be inferred.**
3. In the production-shaped scenario the dominant read volume is the **period scan returning all retained runs** (≈202k rows scanned to aggregate ≈14k governed rows in the installed shape). Restricting by SKU does not touch that; driving the read from the governed-run pointer `(snapshot_period_start, refresh_run_id)` via `idx_cost_sheet_monthly_exact_tuple` might. This is a **hypothesis** from a synthetic model that assumes old runs are retained in the table; it needs authorised read-only catalogue evidence (rows per period/run, distinct SKUs per period) before anyone designs on it.

## 5. Decision position for independent review
- **Correctness:** the candidate is functionally equivalent to the installed scoped RPC and governed view on every scenario tested offline, with identical guards and security surface. This is fixture evidence only; no production data was seen.
- **Benefit:** **unproven and possibly negligible** at the client's fixed limit of 2000 if production SKUs/period ≪ 2000. Not recommended for an apply request on current evidence.
- **Suggested next evidence (all read-only, separately authorised):** distinct `sku_id` and distinct `refresh_run_id` per `snapshot_period_start` for the last 3 periods + same month last year; count of rows belonging to non-governed runs; plain `EXPLAIN` (no ANALYZE) of the *extracted* RPC body with literal period/limit under `BEGIN READ ONLY` (the body can be pasted as a plain SELECT — the opaque Function Scan problem disappears); only then decide between this candidate, a governed-run-first rewrite, or an operational ANALYZE (separately approved).
- **Reproduce:** `node --test scripts/csr-comparison-verifier/*.test.mjs`; `node scripts/csr-comparison-verifier/verify.mjs --candidate-function-sql scripts/csr-comparison-verifier/candidates/keyset-first/candidate-function.sql --candidate-sql scripts/csr-comparison-verifier/candidates/keyset-first/candidate-keyset-rpc.sql`; `node scripts/csr-comparison-verifier/candidates/keyset-first/plan-evidence.mjs --skus 230 --runs 14`.

## 6. Rollback
Nothing to roll back: not applied, not referenced by any client. If it were ever applied, it is a new function name — rollback is `DROP FUNCTION public.rpc_get_cost_sheet_sku_monthly_comparison_scoped_keyset_v1(date, integer);` plus the already-existing client flag OFF. The installed function is never replaced.

## 7. Independent live production read-only counts — 17 November 2026 (later than offline modelling)
**READ-ONLY VERIFIED on Supabase project `qhmoqtxpeasamtlxaoak`**, using `BEGIN READ ONLY`, a local 6-second statement timeout and bounded aggregates of existing snapshot periods. This follow-up was performed in a separate ChatGPT session after the cloud candidate research. No DML, approval, permissions, indexes, ANALYZE, feature flags, production function calls or business-value rows were changed/read. Counts below are actual aggregate query results, not planner estimates.

| Period | Governed refresh run | Governed selection | Distinct governed SKU IDs | Governed line rows | Total retained period rows | Distinct retained run IDs | Non-governed line rows |
|---|---:|---|---:|---:|---:|---:|---:|
| 2026-09-01 | 122 | APPROVED | 634 | 27,896 | 874,391 | 30 | 846,495 |
| 2026-10-01 | 143 | APPROVED | 627 | 27,588 | 442,156 | 16 | 414,568 |
| 2026-11-01 | 152 | LATEST_SUCCESS (draft, not approved) | 629 | 27,676 | 82,984 | 3 | 55,308 |

Each month's `count(DISTINCT (sku_id,product_name,sku_column_label))` equalled its distinct governed SKU count (634/627/629). November 2025 had **no governed run** in the limited period lookup. The client requests `p_limit=2000`. **Thus the current-period keyed cap does not bite at all for these three real governed runs.** The keyset-first candidate cannot meaningfully reduce the number of historical SKUs through early LIMIT for these periods. Its offline correctness and 11/11 tests are retained, but **this candidate is NOT recommended for rollout as a speed fix** on present evidence.

### Interpretation of retained-run counts versus actual view plan
Most retained snapshot rows are from non-governed runs (Sep ~96.8%, Oct ~93.8%, Nov ~66.6%). This **does not prove** the installed scoped RPC scans all those rows: prior live plain `EXPLAIN` of the governed-view read used `idx_cost_sheet_monthly_exact_tuple` with both `snapshot_period_start` and `refresh_run_id` join conditions, so at least that planner path is already governed-run-selective. The plain outer `EXPLAIN` of the SECURITY DEFINER RPC was opaque and cannot establish whether its internal planner chooses the same access path.

### Recommended next technical gate
Do **not** apply the candidate or commission a production rewrite yet. With separately authorised non-executing source-level planning, compare the installed scoped RPC's **extracted RETURN QUERY SQL** for Sep/Oct/Nov using literal inputs against the observed governed-view plan; inspect actual `Index Cond`, buffer *estimates unavailable without execution*, cardinality and join order. Use **plain EXPLAIN only**, no `ANALYZE`, no function execution, no business data retrieval and no operational statistics refresh. Plan units are not timings. If a credible bottleneck emerges, prepare a **new, isolated, evidence-led** candidate and parity fixture rather than changing this passing research package. Keep default-OFF flag, WP10/WP12 OPEN and Electron HOLD.

### Exact live index definitions — correction to shorthand interpretations
Further read-only `pg_indexes` inspection found:
- `idx_cost_sheet_monthly_exact_tuple`: **`(snapshot_period_start, valuation_date, refresh_run_id)`**, *not* a contiguous `(period,refresh_run_id)` key. A displayed `Index Cond` with both period and run does not alone prove the B-tree can efficiently skip across all valuation dates.
- `idx_cost_sheet_monthly_run_sku`: **`(refresh_run_id, sku_id)`**, a second possible governed-run-first access path.
- `idx_cost_sheet_snapshot_period_sku`: **`(snapshot_period_start, sku_id)`**, used in the synthetic candidate assumptions.
- `uq_cost_sheet_monthly_snapshot_line` also leads with `(snapshot_period_start, valuation_date, refresh_run_id, ...)`.

This corrects any overly strong claim that the earlier planned `idx_cost_sheet_monthly_exact_tuple` path already guarantees efficient period+run lookup. **Neither a new index nor a rewrite is authorised from catalogue evidence alone**. Use a nonexecuting extracted-body `EXPLAIN` to compare actual chosen plan nodes/estimates and investigate the existing `refresh_run_id`-leading index. No changes were applied.

### Additional plain EXPLAIN and statistics evidence — candidate selection shifts toward planner diagnosis
Read-only plain `EXPLAIN` of **simple indexed SELECTs only** (not the comparison function; no `ANALYZE` and no row execution) on `costing.cost_sheet_line_monthly_snapshot` with each exact governed `period + refresh_run_id` pair returned:

| Period/run | Planner estimated rows | Actual bounded governed line count | Planned access |
|---|---:|---:|---|
| Sep 2026 / 122 | 17,615 | 27,896 | `idx_cost_sheet_monthly_run_sku`, `Index Cond refresh_run_id=122`, period as Filter |
| Oct 2026 / 143 | 8,564 | 27,588 | `idx_cost_sheet_monthly_exact_tuple`, both period and run in Index Cond |
| Nov 2026 / 152 | **1** | **27,676** | `idx_cost_sheet_monthly_run_sku`, `Index Cond refresh_run_id=152`, period as Filter |

These are **simple probe SELECT plans**, not the actual pivot/function plans. They demonstrate significant cardinality estimation error for the current governed run, especially November; they do *not* prove a corresponding improvement from any particular index, statistics refresh, or query rewrite. Index paths vary by month. `pg_stats` for this table reports `n_distinct` estimates of 49 refresh runs, 6 period starts and 10 valuation dates; `pg_stat_all_tables.last_analyze` was 2026-11-05, with ~55k estimated modifications since. A conditional read-only review of whether newer runs are underrepresented in statistics is now more valuable than pursuing the 2,000-row keyset cap.

**Updated recommended next step:** run only narrowly targeted, non-executing `EXPLAIN` of the exact installed RPC's extracted internal SELECT (three periods) and inspect plan choices and estimates. Separately prepare a specific **ANALYZE impact assessment** for owner approval (no refresh performed yet): what table would be analysed, operational impact, pre/post plan capture, rollback limitations, expected monitoring and reapproval requirements. Do not claim that `ANALYZE` will fix timeout solely from these estimates; actual authenticated latency and status are still required. No feature-flag pilot or release approval was granted.

### Exact installed scoped RPC internal SELECT: nonexecuting plan evidence
The owner-authorised session extracted the `RETURN QUERY` SQL from the repository's installed-function migration `20261111133505_csr_scoped_comparison_rpc_additive_20261111.sql`, replaced `p_period_start` by a **literal date** and `p_limit` by `2000`, and ran **plain `EXPLAIN (FORMAT TEXT)` only** inside `BEGIN READ ONLY` with a 6-second planning timeout. No RPC was called; no row payloads, buffers or elapsed execution timings were obtained. The executed query structure matches the repository SQL source; this is not a fresh hash comparison of the live function body.

| Requested period | Outer Limit planner cost | `line_pivot` estimated grouped rows | Snapshot index-scan estimated input rows | Selected access |
|---|---|---:|---:|---|
| Sep 2026 | 4635.59..4635.63 | 3,223 | 3,149 | `idx_cost_sheet_monthly_exact_tuple`; filter period set Sep/Aug 2026 + Sep 2025 and governed run equality |
| Oct 2026 | 7022.00..7022.06 | 4,702 | 4,594 | Same index; Oct/Sep 2026 + Oct 2025 |
| Nov 2026 | 2433.26..2433.28 | 1,680 | 1,641 | Same index; Nov/Oct 2026 + Nov 2025 |

The internal source plans explicitly show `Index Cond: snapshot_period_start = ranked.period_start AND snapshot_period_start = ANY (three dates) AND refresh_run_id = ranked.refresh_run_id`. This establishes a governed-run selective **plan**, but does not establish that the leading `(period, valuation_date, run)` B-tree reads few irrelevant entries or that cost predictions match actual work. The aggregate live governed line counts are 27,896 Sep, 27,588 Oct and 27,676 Nov, each far larger than these estimated rows even before considering the related historical period. September and October's plan estimated aggregates also differ materially from the current actual SKU counts (634, 627); planner rows are not reliable counts.

**Updated evidence-led decision:** keyset-first candidate remains **OFFLINE RESEARCH ONLY / NO APPLY**; fixed 2000-row key cap is above actual 627–634 current-period SKUs. The meaningful next decision is whether the owner wants a separately reviewed **statistics remediation experiment** with a bounded operational `ANALYZE` on one large snapshot table, accompanied by a careful pre/post nonexecuting plan and authenticated latency acceptance protocol. `ANALYZE` is a live maintenance write to statistics, NOT a read-only investigation, and has **not** been authorised or performed. No live query was benchmarked; do not claim a speed fix or resume Electron release. Keep WP10/WP12 OPEN, WP11 CLOSED, 11/13 closed, release HOLD.
