# WP05 R13 — Cost Comparison intermittent HTTP 500 (#273): diagnosis and review-only repair proposal

**Date:** 11 Nov 2026 · **Base:** `main` `b9915b82d6ab818e9f66eb2ab95ca36d08b55bd6` · **Issues:** [#273](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273), context [#272](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/272), incident note [#267 comment](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/267#issuecomment-6792330708).
**Status:** D-7 #24 remains **FAIL** (intermittent 500). Historical AE1 #24 F retained. **WP05 OPEN, programme 6/13, W5-04 not unconditional.** Nothing here is a PASS, a deployment, or a production change.

## 1. Evidence (owner-reported, not Claude-run)
Five requests to `v_cost_sheet_snapshot_sku_monthly_comparison_governed`, `…order=product_name.asc,sku_column_label.asc&limit=2000`: **500 @ 8.15 s (0.9 kB)**, 200 @ 6.03 s, 200 @ 2.12 s, **500 @ 8.15 s**, 200 @ 2.23 s (~962 kB). Response bodies were not supplied.

## 2. Conclusions and confidence
| Question | Finding | Confidence |
|---|---|---|
| Is it a frontend duplicate/retry/lifecycle artefact? | **No, per code.** The lens does exactly one un-retried `select("*")` per load (`costing-suite-shell.js` `loadRowsForLens`); there is no retry or abort wrapper (unlike the printable summary's 57014 retry). A stale generation is discarded *after* the response, not cancelled. The observed 500/200 order therefore reflects separate user-driven loads (navigation, hard refresh, revisit). Pinned by `scripts/csr-local-pg-harness/client-read-contract.test.mjs`. | High for "client does not auto-retry"; cannot rule out rapid user re-navigation producing overlapping loads |
| Is the 500 a statement timeout (57014)? | **Consistent with, not proven.** Two failures at an identical 8.15 s; the same view logged HTTP 500 + `57014` on 5 Nov (`CSR_READ_TIMEOUT_DIAGNOSIS_2026-11-05.md`); the 200s sit at 6.03 s and 2.1–2.2 s, i.e. a cold-vs-warm spread with thin margin below a ~8 s cap. The ~8 s authenticated-role limit is general Supabase knowledge and was **not verified** against this project (repo records no value). | Medium-high; needs the response body or PostgREST log |
| Root cause class | **Server-side query cost**, not client. | High (mechanism reproduced locally, below) |
| Would a client-only fix work? | **No.** Narrowing `select("*")` to 6 columns left the server time unchanged locally (3.1–3.6 s vs 3.2–3.5 s) because the shared `line_pivot` CTE aggregates every column regardless. A narrower projection would shrink the ~962 kB transfer only. Result is ~630 rows, so `limit(2000)` is not binding. A client 57014 retry would at best mask the first failure and re-spend the same budget; it is not recommended as the fix. | High |

## 3. Mechanism (reproduced offline)
The view's `line_pivot` CTE groups **every governed period** (`v_current_successful_costing_refresh_run` returns one run per period) and is then read three times (`cur`, `prev`, `yoy`); the requested period is filtered only at the `cur` scan. Cost therefore grows with the number of months ever captured, not with the one month requested. In the local fixture the original plan pivoted 685,440 rows into 21,420 groups (34 periods × 630 SKUs) with a ~92 MB on-disk sort to return 630 rows. Cost rises monotonically as months accrue, which is consistent with a failure that was borderline on 5 Nov and is still borderline on 11 Nov.

## 4. Safe offline reproduction
Disposable local PostgreSQL 16.15, synthetic data only (see `scripts/csr-local-pg-harness/README.md`; the earlier 5 Nov isolation blocker no longer applies). The real view DDL and the real design-RPC body are extracted from the repo, not re-typed.

| Check | Result |
|---|---|
| 63-column two-way `EXCEPT`, view vs `rpc_get_cost_sheet_sku_monthly_comparison_scoped` | **Parity** for 2026-09, 2026-10, 2026-11, 2024-01; **0 = 0 rows** for absent 2025-11 and empty 2026-12 |
| Ordering (client order + `sku_id` tie-break) | 0 mismatches |
| Governed-run isolation (Nov: run 149 LATEST_SUCCESS, prev = run 143 APPROVED, no previous-year, superseded run 148 not leaked) | as expected |
| Negative control (deliberately wrong result) | flagged 630 rows, so the check can fail |
| Wall-clock, fresh stats, Nov | original ~3.2–3.5 s vs scoped ~0.10 s (≈30×) |
| Wall-clock, fresh stats, Oct | original ~3.3–3.5 s vs scoped ~0.15–0.16 s |

**Not established:** production latency. The governed-run view is a stub here, so the original plan seq-scans where production uses `idx_cost_sheet_monthly_exact_tuple`; no RLS, PostgREST, JWT role or statement timeout is modelled; row counts and data distribution are synthetic. The prior live EXPLAIN-only +1.7 % October planner estimate (`CSR_THREE_PERIOD_…`) is **not reproduced or refuted** here.

## 5. Not done (per #273 boundaries)
No Supabase connector was available to this session, so no live catalogue read, EXPLAIN, or request-log/error-code correlation was performed; no production query, DDL/DML, grant, index, timeout change, refresh, deploy or merge. Log correlation for the two 8.15 s requests (status body / SQLSTATE, timestamps) remains the cheapest way to move confidence on the 57014 question to certain.

## 6. Review-only repair proposal (unexecuted)
Candidate: the existing design file `evidence/CSR_PARAMETERIZED_SCOPED_RPC_DESIGN_NOT_FOR_DEPLOY.sql` (additive function; hash guard on view `63adf7946b8d7f99a01a05e5e54d00be`; atomic create + `REVOKE PUBLIC/anon` + `GRANT authenticated`), unchanged by this PR, plus new `evidence/CSR_SCOPED_RPC_ROLLBACK_NOT_FOR_DEPLOY.sql` (drop function; roll the client flag back first).
- **Index:** none proposed. The scoped read is predicate-driven on the existing period/run indexes; the local gain came from input restriction, not an index.
- **Review items before any application:** (a) the function `RETURNS SETOF` the internal view's row type, so any later change to that view must rebuild the function; (b) `SECURITY DEFINER` + `require_permission('module:costing-control-center', false)` needs the ownership/EXECUTE review already listed in `CSR_PARAMETERIZED_RPC_INDEPENDENT_REVIEW_2026-11-05.md`; (c) October live-plan estimate must be re-checked with fresh statistics; (d) the 57014 body must be confirmed.
- **Client step (separate PR, not in this one):** flag-gated switch of only the `cost-comparison` read from the view to the RPC, same 63 columns, original view read kept as flag-OFF path; Electron and PWA consumers and the service-worker cache bump follow the existing release checklist.
- **Test plan:** this harness (rerun against a staging copy or Supabase branch only if the owner authorises one); real-role `EXECUTE` denial for anon/no-permission identities (not testable from source mocks); ID-V browser read of Nov+Oct recording HTTP status, duration with explicit unit, cold and warm, no repeated retries.

## 7. Single owner decision requested
**Authorise preparation of a reviewed, flag-gated change set using the scoped read RPC (additive function only, view/indexes/timeouts untouched), to be applied only after a separate application approval — yes or no.** If no, #24 stays FAIL and the only alternative within current boundaries is accepting intermittent failure risk.

## 8. Tests run (this branch)
```
node scripts/csr-local-pg-harness/client-read-contract.test.mjs   # PASS
node scripts/csr-scoped-rpc-design-smoke.mjs                       # PASS (pre-existing, unchanged)
PSQL_ARGS="-h /tmp/pgs -U postgres" scripts/csr-local-pg-harness/run.sh   # exit 0, parity PASS all periods
```
