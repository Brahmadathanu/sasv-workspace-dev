# WP05 R18 — Cost Comparison scoped RPC performance planner screening (11 Nov 2026)

**Classification: production read-only EXPLAIN ONLY; two simple SQL candidates REJECTED.** No `EXPLAIN ANALYZE`, result SELECT, DDL, function replacement, snapshot read, stats refresh, index, role, timeout, client or feature-flag change.

## Source and method

The SQL compared was extracted from the original installed and GitHub-synchronized migration `supabase/migrations/20261111133505_csr_scoped_comparison_rpc_additive_20261111.sql`, after `RETURN QUERY`; only period parameters (`2026-09-01`, `2026-10-01`, `2026-11-01`) and cap `2000` were substituted for deterministic planning. `EXPLAIN (FORMAT JSON)` was executed within `BEGIN READ ONLY ... ROLLBACK`. All three candidates return intended 63 columns but have **not** been shown to preserve runtime bag parity, so no deployment is authorized.

## Results (PostgreSQL total cost; not milliseconds)

| Period | Existing installed SQL | Candidate A: `line_pivot AS NOT MATERIALIZED` | Candidate B: three separately scoped period pivot CTEs |
|---|---:|---:|---:|
| Sep 2026 | **4,601.54** | 33,328.84 | 28,626.49 |
| Oct 2026 | **6,993.40** | 30,734.29 | 36,985.02 |
| Nov 2026 | **2,412.99** | 4,679.56 | 12,154.13 |

Both simplistic rewrites are **REJECTED before implementation**. Repeated period/run `idx_cost_sheet_monthly_exact_tuple` index scans in Candidate A and costly separate group planning in B suggest naïve CTE splitting is counterproductive. Snapshot source table estimated 1,428,937 planner rows and 126,389 pages at observation. No additional index is justified by this evidence.

A more selective *hypothesis* is to determine the current-month final ordered SKU keyset before expensive previous-month/previous-year aggregation and read only historical rows for those keys. It has not been authored or benchmarked. Any such rewrite must maintain exact governed-run policy, exact row/duplicate semantics, full 63-column types, boundary and NULL behavior, sorting and 2000-limit, all permitted/denied identities, with **bidirectional EXCEPT ALL** and measurable 4000ms p95 acceptance including October no-regression.

## Parallel work ownership

[Claude Code package #282](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/282) authorizes **repo-only tests, evidence reconciliation, and draft PRs** in parallel, not live server changes. ChatGPT's server track owns optimization plan/review; no Claude work is claimed to be running until explicitly started in a Claude Code session. User approval of parallel work does not authorize speculative production deployment.

## Gate truth after this checkpoint

- **W5-05 PASS with recorded limits**; S2/S9 historical run evidence and L1 display are recorded in the workpack.
- **Cost Comparison exact CCC-scoped read authorization PASS**: real browser ID-V HTTP 200, real ID-N/ID-X/ID-O HTTP 400/P0001/zero rows. Trial account's original six view-only grants fully restored. See [R17](WP05_R17_CSR_SIGNED_IN_IDENTITY_AND_PERFORMANCE_GATE_2026-11-11.md).
- **W5-04 #24 timing HOLD**: owner browser Nov 5.75s / Oct 4.08s / Sep 4.37s (likely seconds); Supabase backend origin 5386/3642/3970ms, no representative p95 sample. Frozen historical AE1 F is not overwritten.
- **W5-06 parent OPEN**: other SEC-A1/A2 writer-denial, shared-view, F1, personnel boundaries still need separately governed reconciliation.
- **WP05 OPEN, programme 6/13**. No gate promotion here.

Issue evidence: [#273 planner experiment](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273#issuecomment-6799354932).
