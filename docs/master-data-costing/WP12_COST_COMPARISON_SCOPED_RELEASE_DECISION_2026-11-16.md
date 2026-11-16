# WP12 — Cost Comparison scoped-read release decision (16 November 2026)

## Verdict
**Server readiness: PASS (catalog only). Release mode/performance: NOT APPROVED / NOT PROVEN.** This is **not** a change request to enable the flag in production. Do not conflate previously demonstrated working scoped RPC reads with guaranteed functionality on a browser where the flag is OFF.

## Source-path facts at reviewed main
- `public/shared/js/costing-feature-flags.js`: `COSTING_CSR_SCOPED_COMPARISON_RPC_V1` defaults OFF and activates only when browser-local `localStorage` has exact value `"1"`.
- `public/shared/js/costing-suite-shell.js`: when Cost Sheet Review's active lens is `cost-comparison` **and flag is ON**, client calls `readCostComparisonRows({scopedRpcEnabled:true})`. On OFF, it falls through to `v_cost_sheet_snapshot_sku_monthly_comparison_governed` with `select("*")`, period predicate, two sorts and `limit(2000)`.
- `public/shared/js/costing-cost-comparison-read.js`: scoped function is `rpc_get_cost_sheet_sku_monthly_comparison_scoped`, `p_period_start` and `p_limit=2000`; checks expected 63-column shape, avoids silent retry/fallback, sanitizes user-facing errors.
- Existing #273 owner Chrome evidence: five original-view requests on 11 Nov, status sequence `500,200,200,500,200`, ~8.15-second failures, ~2–6-second successes. This is a specific real flag-OFF incident. A prior real authenticated scoped-RPC pilot passed meaningful Nov/Oct/Sep HTTP 200 responses and ID-N/X/O denial; pilot browser durations ~5.75s/4.08s/4.37s, with 4-second p95 and matched October non-regression **NOT PROVEN**. See WP05 R17, R61, R63 and open [issue #273](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273).
- Owner R63 expressly says **do not globally enable scoped RPC until measured review**; this remains binding.

## New live read-only verification
At `qhmoqtxpeasamtlxaoak` the reusable `scripts/wp12-readonly-comparison-rpc-release-preflight.sql` returned:
```json
{"scoped_comparison_rpc_catalog":"PASS","matching_signatures":1,"authenticated_execute":true,"anonymous_denied":true}
```
It additionally asserted `SECURITY DEFINER` and fixed `search_path=pg_catalog, pg_temp`. This checks the installed function's availability/ACL but **does not run the function** or measure latency. A recent 24-hour Supabase edge-log sample contained **zero matching scoped-RPC and original-view requests**; that sample offers no fresh performance/error conclusion and must not be turned into a zero-error rate claim.

## Minimal release-mode decision at genuine existing View-only account
1. First confirm hosted build identity already credited as 74/74; verify actual browser asset freshness and that localStorage flag is OFF without changing it.
2. With the existing legitimately signed-in CSR View-only identity, open Cost Comparison *once* at its ordinary supported period and capture **only HTTP status, elapsed time, selected read endpoint and visible error/valid rows**. Never capture costs/identifiers/token or response bodies. A live 500 on the normal default-OFF path is a reproduced release risk, not a historical artifact.
3. **Do not switch the flag during this protocol**. If a distinct, expressly authorized browser-local scoped-RPC pilot is later approved, isolate it to the test session, capture bounded Nov/Oct/Sep status/timing once, then remove the flag and verify OFF restoration. No server flag, global default or application deployment change without separate owner review.
4. Decide whether the supported release standard is (a) working default-OFF governed-view path with bounded accepted reliability risk, or (b) separately authorized scoped-RPC default promotion after role/latency and rollback evidence. **Neither is implicitly approved here.** A newly demonstrated repeated HTTP 500 or incorrect cost output is a hard release blocker.
5. Retain 4-second p95/October non-regression as issue #273 performance follow-up until a suitably sized authenticated measurement exists. Never claim p95 from three observations.

## Security and workpack boundaries
No production query for large comparison rows, no RPC function execution, SQL DDL/DML, period/run approval, user grant edit, client flag activation, publication or Electron package operation was performed. This checkpoint closes only **scoped RPC catalog availability**, not signed-in flag acceptance, actual endpoint performance, seven sensitive direct-view negative GETs, WP10/11/12 or Costing release.
