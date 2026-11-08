# PEC-VWL-R1 — Vendor-wise Buying List search reliability (2026-11-08)

## Confirmed cause (client, from code inspection of main `bc40689`)
`loadVendorBuylist()` had no latest-wins protection. Each debounced keystroke / filter change started a new
`proc_vendorwise_buylist_filtered` **and** `proc_vendorwise_buylist_split_items` call (both awaited together, nothing
cancelled), so requests accumulated and an older, slower response could overwrite a newer one. The list also could not
render until the secondary split lookup finished, and a split-lookup failure silently became "no splits".

## Evidence table
| Suspect | Observation | Conclusion |
|---|---|---|
| Overlapping RPCs / stale overwrite | No sequence guard or abort; verified by code and by the new deterministic mock test | **Confirmed (client)** |
| Split lookup blocks render | `Promise.all` of both RPCs before render | **Confirmed (client)**; only needed up-front for "split only" |
| Split failure hidden | catch cleared lookup silently | **Confirmed (client)** |
| Loading mask | Depth counter balanced per call | Not a cause |
| Search param handling | `p_q` built consistently; clear sends null | Not a cause |
| SQL: 2026-11-05 `v_proc_indent_lines_console_ordered` change adds a per-row `(SELECT … FROM v_proc_indent_console …)` subquery; timing matches "~2 days" | **UNVERIFIED** — no database/network access in this session; no production timings exist | Needs owner-run read-only `EXPLAIN (ANALYZE, BUFFERS)` of `proc_vendorwise_buylist_filtered` with and without `p_q`. No SQL change made. |

## Change
`public/shared/js/procurement-execution-console.js` only: per-load sequence + `AbortController` (superseded requests are
aborted and their results/errors/toasts discarded); params snapshotted per load; split lookup no longer gates the list
unless "split only" is active (markers re-render on arrival); split failure is flagged and toasted, and "split only" with
a failed lookup shows an error instead of wrong rows; error row is explicit and recoverable. RPC names/params unchanged.

## Tests
`node scripts/pec-vwl-search-reliability-smoke.mjs` (31 checks; LF and CRLF) plus existing `scripts/pec-*.mjs`.

## Rollback
Revert the squash-merge commit. No database, service-worker, or Electron version change.
