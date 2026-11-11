# WP05 R15 — Cost Comparison scoped-RPC client, disabled by default (#273)

**Date:** 11 Nov 2026 · base `main` `b9915b82` · pairs with the server preparation PR ([#275](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/275), R14) · authority: [#274 review](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/274#pullrequestreview-5857484392), [#273 decision](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273#issuecomment-6793681511).
**The flag stays OFF. The server function is NOT applied.** D-7 #24 remains FAIL; WP05 OPEN; programme 6/13. No `sw.js`/cache bump, deploy, flag activation or Electron release is made here.

## Behaviour
| State | Cost Comparison read |
|---|---|
| Flag OFF (default, every browser and Electron profile today) | The original read, code path untouched: governed view, `select("*")`, `snapshot_period_start` filter, order `product_name, sku_column_label`, `limit 2000` |
| Flag `COSTING_CSR_SCOPED_COMPARISON_RPC_V1 = "1"` in that browser's `localStorage` | One `rpc_get_cost_sheet_sku_monthly_comparison_scoped({p_period_start, p_limit: 2000})`, same 63 columns, same rendering |

Scope is only the `cost-comparison` lens (`costing-suite-shell.js` `loadRowsForLens`; one gated branch, new `costing-cost-comparison-read.js`, one flag in `costing-feature-flags.js`). Deliberately absent: retry, automatic view fallback on error (it would hide a broken server and double the query), any writer RPC, any period/label/run-selection/column change.

Safeguards: first-of-month period validated before any call; the 63 expected columns are pinned (and tested equal to the W1 migration's public view) and a result missing any is refused rather than rendered partially (extra columns are tolerated); errors map to **fixed** user-safe texts only (RPC not installed names the flag to switch off; permission; timeout; signed-out). **Any unrecognised server error, including any `P0001` other than exactly `Not authenticated`, shows one generic message; raw server text is never rendered** (review of 11 Nov). The original `code` and `cause` stay on the thrown `Error` for non-visible diagnostics (console) only. A result missing expected columns shows a generic "did not match the expected format" message with no column names (names kept in `error.diagnostics`); exactly 2,000 rows raises a visible "may not be shown" warning as both a persistent status line and a toast (1,999 rows shows neither), because the server cap makes truncation otherwise silent (the original view read truncates silently too).

Rollback: remove the flag (`localStorage.removeItem("COSTING_CSR_SCOPED_COMPARISON_RPC_V1")`, reload); it restores the original read without any database change. Roll the client flag back **before** dropping the function.

## Release coupling (owner step, not done here)
Static JS is cache-first, so a clients-hold-old-shell situation keeps today's behaviour (safe, flag OFF anyway). Reaching clients needs a cache generation bump at release; this PR does not do it (`public/sw.js` line 2 unchanged at v393, asserted by a test). Electron loads the same renderer files, so the flag and fallback behave identically there; no Electron packaging was run.

## Verification
```
node --test scripts/csr-scoped-rpc-client/*.test.mjs   # 27 pass (15 unit/source + 12 Chromium)
```
Added after review: sensitive-detail regression for unknown codes (XX000, P0001, no code) asserting the text is absent from status, toast and page text; a stale-response test (a late reply for the previous period never overwrites the newly selected period, one call per load; mutation-checked: removing the generation guard makes it fail); 2,000/1,999-row boundary at 1280 and 390 px.

Browser test: at **1280 px and 390 px** flag OFF reads the view only and flag ON the RPC only, same period, `p_limit` 2000, **identical rendered table HTML** for identical data, no mutation, no horizontal overflow, no page error; RPC-not-installed and permission-denied show the safe message with one call and no view read; 2,000 rows shows the truncation warning.

Frozen-diff regression tests that compare the shell with historical bases (table-tools pkg1–3, nav-groups, responsive, worklist, others via `unpersonnel.mjs`) were extended with this change's exact two shell edits (`scripts/csr-scoped-rpc-client/shell-edits.mjs`) so they still prove nothing else in the shell changed. The full `scripts/**/*.test.mjs` set has the same failures on this branch and on unmodified `main` (see PR); ESLint could not be run (dependencies not installed).

## Not established
Anything server-side or role-based: this is mock-backend proof. The real function, real roles, real ID-V success, real latency and the October planner check are the gates in R14. Flag-ON in production needs the owner's separate approval after application and staging tests.
