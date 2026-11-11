# WP05 R19 — Cost Comparison offline regression verifier and timing harness (11 November 2026)

**Classification: repository-only tests and documentation. Timing gate remains HOLD. No gate promoted; WP05 OPEN; programme 6/13.** Parallel Claude Code package [#282](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/282); P1 incident [#273](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273); WP05 tracker [#267](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/267). Evidence base: [R17](WP05_R17_CSR_SIGNED_IN_IDENTITY_AND_PERFORMANCE_GATE_2026-11-11.md), [R18](WP05_R18_CSR_PLANNER_OPTIMIZATION_SCREEN_2026-11-11.md), [B1 retained ledger](WP05_B1_RETAINED_GATE_EXECUTION_LEDGER_2026-11-10.md).

**Not touched by this package:** the installed production RPC, `supabase/migrations/20261111133505_csr_scoped_comparison_rpc_additive_20261111.sql` (its header text "PREPARED, NOT APPLIED" is historical — the function is installed live and was synchronised by #278; **never reapply it**), any view/index/policy/grant/timeout, client source, `public/sw.js`, cache version, feature flags. No production query, JWT, credential or timing was produced. ChatGPT's server SQL track is independent; nothing here edits migration or prepared-SQL files.

## 1. What was added (`scripts/csr-comparison-verifier/`)

| File | Purpose |
|---|---|
| `lib.mjs` | Starts a **throwaway local PostgreSQL cluster on a private unix socket** (no TCP, no remote target by construction), builds the fixture, and runs the comparator. Fail-closed: no PostgreSQL binaries ⇒ thrown error / exit 2, never a skip or pass. `CSR_VERIFIER_PG_BIN` is authoritative when set. |
| `sql/fixture-schema.sql`, `sql/fixture-data.sql` | Deterministic fixture (no `random()`, no clock): 40 SKUs × 23 monthly periods, governed-run decoys, duplicate SKU/group keys, NULLs, zero denominators, a 2105-SKU cap month. |
| `sql/baseline-view-read.sql`, `sql/candidate-installed-rpc.sql` | The two **parameter** paths. Baseline = what the flag-OFF client reads (view, period filter, `product_name, sku_column_label` order, cap). Default candidate = the installed RPC body taken verbatim from the synchronised migration. Any other SQL file (a not-yet-proven optimisation) is supplied via `--candidate-sql`; nothing about an optimisation is hard-coded. |
| `verify.mjs` | CLI. Exit 0 = all periods pass; 1 = parity/contract failure; 2 = DB unavailable or bad input. |
| `parity.test.mjs` | 11 fixture tests incl. 8 mutant self-tests proving the comparator detects regressions. |
| `sql/mutants/*.sql` | Deliberately wrong candidates (dropped row, duplicated row, NULL flip, scale drift, wrong order, cap 1999, 64th column, shifted previous-month COP). All must FAIL. |
| `bench-stats.mjs`, `bench.mjs`, `bench.test.mjs` | Timing-sample analysis and bounded harness (section 3). |
| `client-contract.test.mjs` | Read-only checks of the client path and service worker (section 4). |

### Run

```bash
node --test scripts/csr-comparison-verifier/*.test.mjs
node scripts/csr-comparison-verifier/verify.mjs --candidate-sql path/to/candidate.sql   # baseline defaults to the flag-OFF view read
```

Candidate/baseline files are single `SELECT`s using psql variables `:'period'` and `:lim` and must return the 63 columns of the governed view.

## 2. What the comparator proves (and does not)

For each period it materialises both paths and requires: (a) exact 63-column names **and** order equal to the client's pinned `COMPARISON_COLUMNS`; (b) identical column types between paths; (c) bidirectional `EXCEPT ALL` bag parity (duplicate-sensitive); (d) a second **strict text** bag (`row::text`) because numeric equality hides scale drift such as `1.0` vs `1.000` — the `scale-drift` mutant passes (c) and fails here; (e) candidate order equals `ORDER BY product_name, sku_column_label, sku_id` (NULLS LAST) and matches baseline order position-by-position on `(product_name, sku_column_label)`; (f) row count ≤ cap and equal to baseline.

Fixture coverage: Nov/Oct/Sep 2026; seven synthetic periods (Jan–Jul 2026, incl. the Jan→Dec year-boundary look-back and Mar→Feb); a period with **no governed run** (both paths empty, no error); a 2105-SKU month where the cap of 2000 must bite; SKU 7 with two groups in both months (2×2 join fan-out preserved as a bag); a duplicate `line_label` inside one group (`max()` semantics); NULL `product_name`/`sku_column_label` (sort last); previous COP of zero (percent NULL, change numeric); SKUs missing in the previous month/year; non-governed run ids and a governed id of the **wrong period** (both must be excluded). Guards are exercised too: unauthenticated, permission denied, non-first-of-month period, limit 0/2001/NULL.

### Limits — read before relying on a green run

1. **Fixture, not production.** The governed *view* is reconstructed by removing the three-period pre-filter, period filter, ORDER and LIMIT from the installed function body. Its md5 (`63adf794…`, guarded in the migration) cannot be verified offline, and column **types are fixture assumptions**, not a production catalogue dump. A green run proves the candidate matches the baseline *semantics as reconstructed*; it does not prove live parity.
2. **Collation.** The fixture cluster uses the `C` locale. Production default collation may order mixed-case/accented names differently. Any candidate must be re-checked on a production-like collation before an ordering claim is made.
3. **Tie risk at the cap (finding F-3).** The flag-OFF read orders by `(product_name, sku_column_label)`; the RPC adds `sku_id`. They select identical rows whenever that pair is unique at the cap boundary (true in the fixture). If ties straddle row 2000 in production, the two paths may truncate to different rows. Not observed; not excludable from fixtures.
4. Fixture plans and timings say nothing about the 1.43M-row snapshot table (R18 planner estimate).
5. Bag parity has no bearing on identity/permission behaviour in production: the identity stubs only model the guard order. Production ID-V/ID-N/ID-X/ID-O evidence remains R17's.

## 3. Timing harness

* **DRY_RUN by default.** `bench.mjs fixture` prints a plan. It executes only with `--execute` **and** `BENCH_CONFIRM=FIXTURE_ONLY_NOT_PRODUCTION`, with `--samples` bounded to 1–30, against the local throwaway cluster only; output is labelled `FIXTURE_NOT_PRODUCTION`, warm only. There is no code path to a remote host and no credential input; a test asserts the sources contain no network client, URL or key variable.
* **`bench.mjs ingest <file>`** analyses genuinely collected browser/edge timings (schema `csr-timing-samples/v1`). Unit (`ms`|`s`) is **mandatory** — the 5.75/4.08/4.37 ambiguity in R17 cannot recur silently. Inputs containing JWT-like values or token/cookie/email/authorization-style keys are rejected; unknown keys are rejected.
* **Statistics:** nearest-rank p50/p95; **p95 is withheld below 20 samples per cell**; cold and warm are separate cells; 4000 ms target per cell; October non-regression compares candidate vs baseline p95 per temperature with a tolerance that defaults to 5% — **an assumption for the owner to confirm or replace**.
* **The harness never prints PASS.** Overall result is `HOLD` or `CANDIDATE_FOR_OWNER_REVIEW`; the owner records any timing PASS from genuine authorised samples. A test feeds the owner's real Nov 5.75 / Oct 4.08 / Sep 4.37 observations (as seconds, n=1) and confirms `HOLD`, no p95.

## 4. Client and service-worker verification (no client change)

| Check | Result |
|---|---|
| Flag default OFF; only the literal `"1"` enables; failing storage = OFF; no hard-coded ON; shell never sets it | **Verified** (source + executable) |
| No fallback and no retry: one RPC call per load; after an RPC failure the view is never read; flag-ON shell branch has no `catch`/retry/view call | **Verified** |
| 2000-row notice on the RPC path: `truncated` true at exactly 2000, false at 1999; shell shows warning status + toast | **Verified** |
| `sw.js` never intercepts cross-origin/Supabase or non-GET requests; the shell script is network-first with offline cache fallback | **Verified** in a vm harness |
| **F-1 (finding, not fixed):** `costing-cost-comparison-read.js` and `costing-feature-flags.js` are **cache-first** in `sw.js`, unlike their importer `costing-suite-shell.js`. Same class as #264. A later edit to either file would be shadowed by a stale cached copy in an installed PWA until a cache-version bump. | Recorded in an assertion that fails if behaviour changes, forcing this document to be updated. Owner decides whether to extend the network-first list; this package changes nothing. |
| **F-2 (finding, not fixed):** the flag-OFF view path uses `.limit(2000)` but shows **no** truncation notice. | Recorded likewise |
| Line endings of the Cost Comparison client files, `sw.js` and the migration are internally consistent; new files are LF | **Verified** |

## 5. Evidence provenance and risk matrix

| Claim | Source / class | Status |
|---|---|---|
| Scoped RPC installed live; repo source synced | #273, #278 | Fact; **do not reapply** |
| ID-V positive; ID-N/X/O HTTP 400 `P0001` zero rows | R17; owner-operated browser; trial account restored (6 view-only grants) | PASS for the CCC-scoped read subgate only; parent W5-06 OPEN |
| Browser 5.75 / 4.08 / 4.37 (unit unstated, likely s); edge origin 5386 / 3642 / 3970 ms | R17; single samples, period↔log mapping unproven | **Not a p95; HOLD** |
| Historical `500 @ ~8 s` and original `57014` | AE1 #24, #273 owner screenshot | Frozen historical F, never erased |
| Planner: simple CTE rewrites worse (A 4,679–33,329; B 12,154–36,985 vs installed 2,413–6,993 cost units) | R18, `EXPLAIN` only | Candidates A/B **rejected**; no index justified |
| Candidate parity, order, cap, 63 columns | **This package**, fixture-only | Tool ready; no candidate yet submitted |
| 4000 ms p95 and October non-regression | no genuine sample set | **HOLD / UNPROVEN** |

| Risk | Likelihood / impact | Control now | Remaining action |
|---|---|---|---|
| A tuned candidate silently changes rows, NULLs, scale, order or cap | Medium / High | mutant-proven comparator, strict text bag | run candidate through `verify.mjs`, then production-like rollback-only parity (owner-approved) |
| Collation differences | Medium / Medium | documented limit 2 | verify on production-like collation |
| Tie at cap boundary | Low / Medium | F-3 | confirm uniqueness of `(product_name, sku_column_label)` read-only before relying on either order |
| Stale cached client modules | Low / Medium | F-1 recorded | owner decision on SW list / cache bump |
| Fixture mistaken for production proof | Medium / High | labelled `FIXTURE_NOT_PRODUCTION`; never prints PASS | — |
| Percentile claimed from few samples | Medium / Medium | p95 withheld < 20 | collect ≥ 20 cold + ≥ 20 warm per period, both variants, with unit |

## 6. Gate truth after this package

W5-05 PASS WITH RECORDED LIMITS (unchanged). Cost Comparison CCC-scoped read authorisation PASS (R17). **W5-04 #24: functional recovery credited, timing HOLD**; historical AE1 F frozen. W5-06 parent OPEN. **WP05 OPEN, programme 6/13.** Dated 11 November 2026.
