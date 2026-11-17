# WP12 — source/CI regression results and Cost Comparison timeout investigation (17 November 2026)

**Status:** review-only documentation. WP10 and WP12 remain **OPEN**, WP11 **CLOSED**, programme **11/13**, Electron release **HOLD**. No production write, SQL install, permission/flag/account change, approval, deploy or publication was performed. Prior accepted evidence is preserved.

## 1. Provenance
- Branch `docs/wp12-continuation-20261117` (draft PR #472), head `89c379c14ab39a1a551c687c914ebce6761379a2`; base `main` `8c7648fab72f2cf2e40bacc74e8fe59bedca2777`. Diff vs main = docs + two comment-only JS edits (`62bc03f`).
- Checkout: Windows, Node v24.5.0, blobless full-history clone, `core.longpaths=true`, `core.autocrlf=false`, sparse checkout excluding `docs/costing-pipeline-independent-audit/` (Windows MAX_PATH). Failing tests were re-run on a pristine `main` worktree for baseline comparison.
- Command: `node --test <file>` per file, 96 non-browser tests matching costing/csr/wp05/wp10/wp11/wp12/pwa/electron/flag/permission (6-way parallel, 150 s cap). Playwright/Chromium browser suites (`*-browser.test.mjs`) were **not** run locally.

## 2. Local source regression result (96 files)
| Outcome | Count | Notes |
| --- | ---: | --- |
| PASS | 72 | |
| FAIL on PR head **and** on `main` (environment/baseline) | 21 | see below |
| FAIL on PR head only (**regression vs main**) | 1 | `scripts/wp10-g2-safeguards/source.test.mjs` |
| Timeout (124) on PR head and main | 2 | `verify-served-assets`, `responsive` (need browser/network) |

24 files did not pass on the PR head (22 non-zero exit + 2 timeouts). Re-running those 24 on pristine `main`: 23 failed identically (21 exit 1 + 2 timeouts = baseline); only `source.test.mjs` passed on main.

**Baseline/environmental failures (identical on pristine main; not caused by the PR; tests not edited):**
- No local PostgreSQL → fixtures print `SKIPPED ... (not PASS)` and exit non-zero: `csr-comparison-verifier/{bench,parity}`, `wp10-g1-safeguard-audit/{fixture-mutation,transition-fixture}`, `wp10-g2-safeguards/{guards,horizon,preview,provenance}`. Classified **NOT TESTED locally**.
- Windows host: `spawnSync tar` (acceptance-runner), `C:\tmp` path (cost-sheet-terminology), `c:` ESM URL scheme (w506-conf-client x2).
- Git-ref/diff-based guards (`uxf1`, `review-worklist`, `cross-links`, `sec-a2-strip`, `draft-run-evidence*`, `table-tools-pkg3/4`, `w506-conf-server/migration-static`) fail in this checkout identically on main. **NOT TESTED locally**; Linux CI is the authority.

### Finding R-1 (PR-induced, medium): WP10 G2 guard S4 trips on the comment-only JS edits
`scripts/wp10-g2-safeguards/source.test.mjs` S4 diffs `public/` against `origin/main` and allows only a pinned set of client files. It passes on main and **fails on PR head** with `unexpected changed client file: public/shared/js/costing-cost-comparison-read.js` (comment-only change `62bc03f`; `costing-feature-flags.js` is expected to trip it likewise). The workflow `wp10-g2-offline-verification.yml` is path-filtered and did **not** run on PR #472, so no red check is visible. Any later PR touching WP10 paths while these comments are not on `main` would fail S4. Nothing changed here (protected test). Owner options: (a) revert the `62bc03f` comment edits from this PR; (b) land them as their own reviewed PR to `main` first; (c) extend the allowlist in a reviewed change.

## 3. GitHub Actions
- PR #472 head `89c379c`: [PEC Integrated Browser Acceptance run 44104385612](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/44104385612) — **SUCCESS** (job `integrated-pec`; Netlify header/redirect rules pass, deploy preview ready). Earlier heads (44103587916, 44103555126, 44103104138, 44102595032, 44102456273, 44102021037, 44101932836) all success.
- On `main`: WP12 Hosted Costing Asset Provenance, e.g. [44096979204](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/44096979204), success.
- **Not triggered for this PR** (path filters): WP10 G2 offline verification and the WP05/WP11/WP12 workflows → **NOT TESTED on this head**; no PASS inferred. These are mocked/offline suites, not genuine authenticated evidence.

## 4. Cost Comparison default-OFF timeout — investigation (read-only, repository analysis)
**Observation (17 Nov, genuine signed-in session, role unproven):** one load of Cost Sheet Review → Cost Comparison, Nov 2026, flag OFF; UI showed raw server text "canceling statement due to statement timeout" (57014 class). HTTP status/elapsed were not captured by the tool. Not repeated.

**Read path (verified in source at head):** `costing-suite-shell.js` (~4933-4966) → flag OFF → `v_cost_sheet_snapshot_sku_monthly_comparison_governed` `.select("*")` `.eq("snapshot_period_start", period)` ordered by product_name, sku_column_label, `.limit(2000)` → public wrapper → `costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed`. The OFF path has no retry and renders the raw server message (sanitised text exists only on the scoped RPC path).

**Why it is slow (existing evidence: #273, CSR_READ_TIMEOUT_DIAGNOSIS, CSR_PLAN_RECHECK, WP05 R18, three-period variance doc):**
- The view pivots `costing.cost_sheet_line_monthly_snapshot` (~1.4 M planner rows, ~1.26 GB) over all governed periods (`line_pivot`, ~5.5 k grouped rows), self-joins previous month and previous year, and only then filters the requested period. ORDER/LIMIT cannot prune the aggregation.
- #273 owner Chrome evidence (11 Nov): 500@8.15 s, 200@6.03 s, 200@2.12 s, 500@8.15 s, 200@2.23 s: intermittent, failures cluster at about 8 s (consistent with an authenticated-role statement timeout). Variation suggests cache/IO and planner-statistics sensitivity (stats last auto-analysed 24 Oct before November rows; manual ANALYZE 5 Nov recorded) rather than a proven client duplicate-request bug; the five requests were likely repeated navigations (not proven).
- Installed scoped RPC (flag OFF, `authenticated` EXECUTE): restricts `line_pivot` to {period, period-1 month, period-1 year} inside the function. Planner cost Sep 4,602 / Oct 6,993 / Nov 2,413 (R18) vs 8,098 for the view; browser pilot 5.75/4.08/4.37 s (edge 5.4/3.6/4.0 s), HTTP 200, ID-N/X/O denials credited. It is the safer path functionally but **not proven fast**: single samples, no p95, October gain small, margin to an ~8 s timeout only ~2-4 s.
- R18 rejected candidates: `NOT MATERIALIZED` CTE and three separate pivots are worse in every month.

**Not done / blocked:** live `EXPLAIN` (no read-only database connector in this session) → **NOT TESTED**. No `EXPLAIN ANALYZE`, no view execution, no schema change. Current statistics freshness for the snapshot table was not re-read.

### Recommended corrective path (smallest sound, in order)
1. **Evidence (read-only, owner-authorised session):** `BEGIN READ ONLY` catalogue read of `pg_stat_user_tables` (`last_analyze`, `last_autoanalyze`, `n_mod_since_analyze`, `reltuples`) for the snapshot table, plain `EXPLAIN (FORMAT JSON)` (no ANALYZE) of the exact OFF request for Sep/Oct/Nov, and the role `statement_timeout` from `pg_roles.rolconfig`. This shows whether a statistics refresh (an operational ANALYZE, separately approved) is the cheapest fix for the November regression.
2. **Interim posture:** keep the flag OFF globally (owner R63). If the lens must be usable before a rewrite, authorise a **time-boxed browser-local scoped-RPC pilot** for named View-only users: Nov/Oct/Sep once each, record endpoint/status/ms, then remove the flag. Rollback = remove the localStorage value; no server change.
3. **Durable fix candidate (repo-only proposal, unapplied):** keyset-first rewrite (compute the current period's ordered top-N SKU keyset first, aggregate previous month/year only for those keys), or a period/run-keyed precomputed comparison snapshot written at governed refresh. Needs bidirectional `EXCEPT ALL` parity across Sep/Oct/Nov, 63-column types, governed-run selection, permissions, October non-regression, 4 s p95 on adequate samples and rollback SQL. Rollback = flag OFF, then restore the previous function body or drop the new function.
4. Do **not** raise `statement_timeout`, add indexes or widen grants on current evidence (period indexes already used; R18: no index justified).
5. Optional client hardening (separate reviewed PR, not prepared because it touches protected behaviour): sanitise OFF-path error text and avoid auto-running the heavy query until the tab is opened.

No corrective PR was prepared: the evidence does not yet justify a specific SQL or client change.

## 5. Outstanding acceptance conditions
Role matrix (Editor/View-only/No-access), V1-V7 negative GETs, ordinary Cost Comparison HTTP status/ms, real eleven-flag combined test, Windows NSIS/ZIP acceptance, WP10 PostgreSQL fixtures on Linux/CI, four-table direct-DML cutover: all remain NOT TESTED/OPEN per the continuation checkpoint.

## 6. Owner decisions requested
1. Choose R-1 option (a), (b) or (c).
2. Authorise the read-only metadata plus plain EXPLAIN session (§4.1): yes/no.
3. Choose release posture: keep OFF with accepted risk, or authorise a time-boxed scoped-RPC pilot (§4.2), and/or authorise a repo-only keyset-first proposal (§4.3).


## 7. Owner-approved R-1 correction and re-verification (17 Nov 2026, later)
**Owner decision:** R-1 option (a): revert the two comment edits. `public/shared/js/costing-feature-flags.js` and `public/shared/js/costing-cost-comparison-read.js` were restored byte-for-byte to `main` `8c7648fab72f2cf2e40bacc74e8fe59bedca2777` (`git checkout origin/main -- <file>`). The corrected factual explanation (scoped RPC is **installed**, flag default OFF, release mode undecided) now lives only in documentation. WP10 guard allowlist unchanged; no application behaviour changed.
- Corrected PR head after revert: `d181b5a94003a1fd976376d2f99fa4bc7c03adaa` (docs-only vs main; `git diff origin/main -- public index.html main.js electron` is empty).
- **R-1 re-test:** `scripts/wp10-g2-safeguards/source.test.mjs` on that head: **11/11 PASS** (previously failed S4). 

### Re-run of the 96-file source set in a Linux environment (WSL2 Ubuntu 24.04, Node v22.11.0, PostgreSQL 16 client/server binaries, clone of head `d181b5a`, `origin/main` ref pinned to `8c7648f`)
| Outcome | Count |
| --- | ---: |
| PASS | 85 |
| FAIL | 11 |

Previously-failing items now **genuinely PASS on Linux** (PostgreSQL fixtures actually executed, `skipped 0`): `csr-comparison-verifier/parity` 11/11, `wp10-g2-safeguards/{guards,horizon,preview,provenance}`, `wp10-g1-safeguard-audit/transition-fixture`, `csr-comparison-verifier/bench`, plus the Windows-host/ref failures (tar, `C:\tmp`, ESM URL, shallow history). These are synthetic isolated-fixture results, **not** genuine authenticated or production evidence.

**Remaining 11 failures — none counted as PASS:**
| Test | Cause | Class |
| --- | --- | --- |
| `cost-sheet-a4-narrow-layout`, `wp11-pm-bom-overflow`, `wp12-live-anonymous-denial` | Playwright/Chromium not installed in the WSL environment | **NOT TESTED in Linux**; these 3 did PASS in the earlier Windows run (Chromium available there), so they are credited from that run only |
| `costing-ccc-uxf1`, `costing-review-worklist` | diff guard "no Costing or history-rewriting supabase change" flags the four WP10 G2 migrations (`20261116022440`..`022528`) added after the guard was written | **Baseline failure on pristine `main` too** (re-run on `8c7648f`: exit 1) |
| `costing-w506-conf-server/migration-static` | "latest" migration now a WP10 G2 file, not the pinned W506 one | Baseline on `main` |
| `costing-table-tools/table-tools-pkg3`, `pkg4` | pinned diff of `costing-suite-control-center.js` and related files differs from the pinned baseline | Baseline on `main` |
| `costing-approval/sec-a2-strip`, `costing-draft-run-evidence/draft-run-evidence` | strict-equality assertions (colour/error-text constants) | Baseline on `main` (cause not investigated further; not caused by this PR) |
| `wp10-g1-safeguard-audit/fixture-mutation` | `M0 invariant suite is clean on the unmodified fixture — asof-not-IST-today` (date-sensitive fixture) | Baseline on `main`; fixture depends on the current IST date |

Reconciliation of the earlier Windows run (24 non-passing on the PR head; 23 of them also failed on pristine main): 16 were environmental (Windows host, no PostgreSQL, partial history, timeouts) and now PASS on Linux; the other 8 fail identically in both environments and on pristine `main` (baseline, listed above). Across both environments 88 of 96 files PASS in at least one environment (PostgreSQL fixtures only in Linux, Chromium suites only in Windows); 8 fail in both. **Pre-existing baseline failures are a repository-hygiene finding for the owner, not a result of this PR, and must not be treated as passes.** I did not edit tests or protected code. An attempt to create a non-root OS user in WSL was denied by the tool permission layer and was not worked around; the PG harness ran without it.

### Read-only database metadata and plain EXPLAIN (item 3)
**BLOCKED / NOT TESTED.** No approved database connection or Supabase connector is available in this session (no connector tool; no credentials were sought or used). No `pg_stat_user_tables`, `pg_roles.rolconfig` or `EXPLAIN` was run. The §4.1 query set therefore remains a pending owner-run item. No `EXPLAIN ANALYZE`, no execution of the comparison view, no statistics or SQL change.

### Keyset-first proposal (item 4)
Prepared as a repository-only document: [WP12_COST_COMPARISON_KEYSET_FIRST_PROPOSAL_2026-11-17.md](WP12_COST_COMPARISON_KEYSET_FIRST_PROPOSAL_2026-11-17.md). Unapplied, unbenchmarked.

### Superseded statements
§2 above (R-1 failure on head `89c379c`) is historical: it was corrected by the revert in this section. §4 recommendation 5 and the comment-edit references in the earlier checkpoint text are likewise superseded; the checkpoint's "Scoped source-comment correction committed" section is retained as history but those comment edits are no longer in the branch. The scoped-RPC flag remains OFF; no browser-local pilot is authorised.

### Recommended next technical step
Owner-run (or owner-authorised connector) **read-only metadata + plain `EXPLAIN` session** for Sep/Oct/Nov (stats freshness, `n_mod_since_analyze`, role `statement_timeout`, plan shape for the OFF view, installed RPC, and the keyset-first candidate once authored). That evidence decides between a separately approved `ANALYZE` and the keyset-first rewrite; in parallel, author the candidate SQL and fixtures in the isolated PG harness only.

## 8. Follow-up production read-only metadata and plain EXPLAIN — 17 November 2026 (supersedes session BLOCKED in §7)
**PASS for bounded catalogue and outer-query plan inspection only, not measured performance.** A separate owner-authorised ChatGPT session used the connected Supabase project `qhmoqtxpeasamtlxaoak`, `BEGIN READ ONLY`, `SET LOCAL statement_timeout='7000ms'`, SELECT-only statistics/role catalogues, and ordinary `EXPLAIN (FORMAT TEXT)` **without ANALYZE**. No comparison query was executed, and no business rows or response bodies were retrieved.

- `costing.cost_sheet_line_monthly_snapshot`: `pg_stat_all_tables.n_live_tup=1,490,828` (estimate), `last_analyze=2026-11-05 10:19:13 UTC`, `last_autoanalyze=2026-10-24 07:20:21 UTC`, `n_mod_since_analyze=55,352` (estimate). Stats were manually analysed **after** the cited October 24 automatic analysis, so "statistics last analysed 24 Oct" is not strictly accurate. These values **do not establish an ANALYZE need** without more evidence.
- Role configuration: `pg_roles.rolconfig` shows `authenticated: statement_timeout=8s`; `authenticator: statement_timeout=8s, lock_timeout=8s`. The inspecting session temporarily imposed its own 7s planning timeout; do not confuse that setting with normal authenticated role configuration. The role-level 8s timeout is consistent with (but not conclusive proof of the full explanation for) the previously observed ~8.15s UI failures.
- Plain `EXPLAIN` of the **exact client OFF query shape** `SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start=DATE '<period>' ORDER BY product_name,sku_column_label LIMIT 2000`, for **Sep, Oct, Nov 2026**, yielded the same top-level estimated `Limit cost=6997.21..6997.23, rows=8, width=1788`. The shared `line_pivot` CTE has a `GroupAggregate cost=5797.32..6523.50, rows=5096`, with a governed-run nested loop and index scan `idx_cost_sheet_monthly_exact_tuple`. Only the `CTE Scan on line_pivot cur` shows the selected period filter; previous-month and previous-year scans read the pivot CTE. **A client LIMIT does not eliminate the upstream history aggregation**. Costs are planner units, **not ms** or observed runtimes.
- Plain `EXPLAIN SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(DATE '<period>',2000)` for Sep/Oct/Nov yielded only the **opaque outer Function Scan** `cost=0.25..10.25, rows=1000, width=1788`. This **does not expose the internal SECURITY DEFINER function plan** and must **not** be compared numerically to the governed-view cost or cited as proof the RPC is faster. Historical repository R18 plans and authenticated RPC pilot timings remain separate evidence.

**Decision impact:** the real default-OFF timeout remains an open release risk; the plan shape supports examining a period/key-restricted alternative but does not establish speed or full result parity. Do not automatically run `ANALYZE`, increase `statement_timeout`, add indexes, switch flags, or migrate SQL. Advance the separately authorised **isolated PostgreSQL keyset-first candidate and adversarial duplicate-SKU parity fixtures**, followed by reviewed performance and rollback evidence before any production decision. WP10/WP12 OPEN, WP11 CLOSED, Electron HOLD.
