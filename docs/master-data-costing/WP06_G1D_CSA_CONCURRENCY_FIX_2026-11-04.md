# WP06-G1d — Commercial Sales Assumptions modal concurrency fix — 4 Nov 2026

Client-only. Baseline `main` `195b13c`. File changed: `public/shared/js/costing-suite-commercial-sales-assumptions.js` (+27/−13 lines). Tests: `scripts/costing-wp06-g1d/csa-concurrency.test.mjs` (14, written first; 7 failed on the unfixed code, see below). Fixes findings F-1 and F-2 of the WP06-G1 audit (PR #152).

## Change
1. **F-1 clock-independent identity.** `token: Date.now()` → `token: ++manageSessionSeq`, a per-handler monotonic counter that is never reused. Two openings of the modal in the same millisecond (or with a clock that goes backwards) now always have different identities, so a late history answer from an earlier opening cannot be accepted by a later opening of the same SKU.
2. **F-2 write-in-flight belongs to the request.** `closeManageModal` no longer clears `writeInFlight`; it keeps the controls disabled while a write is pending. The flag is cleared only in the `finally` of the request that set it, so close/reopen (same or different SKU) cannot start a second write while the first is pending.
3. **Stale completions cannot touch a newer session.** Each write captures its session id when it starts. On success the user is still told it succeeded (toast), but the form reset and history refresh only run if that session is still the open one; on error `handleError` still reports it once, but the inline modal error is shown only in its own session.
Unchanged (asserted): RPC names (`rpc_set_sku_sales_assumption`, `rpc_close_sku_sales_assumption`, reads), exact payloads, validation messages and order, `requireEditAccess` before every write, workspace/period freshness checks (`assertModalContextFresh`, `onPeriodChanged`), and the set of RPC names in the file.

## Reproduction → fix evidence
Before the fix (same tests, source unchanged): F-1 frozen-clock same-SKU stale history accepted; "snapshot identity is a counter" source check; F-2 second write sent after close/reopen of the same SKU; second write/close sent for a different SKU while one is pending; stale success reset the newer session's form and re-read its history; stale error text appeared in the newer modal; pending close-assumption write not protected → **7 of 14 failed**. After the fix: 14/14.
Mutation checks on the fix (each fails the suite): clock token restored (2 failures); `closeManageModal` clears the flag again (3); no session guard on set success (1); on set error (1); on close success (1). A sixth mutation (re-disabling controls when opening during a pending write) is not observable because the controls are the same DOM nodes and stay disabled; that redundant line was therefore not added.

## Not changed (separate findings)
Default-policy revise modal (`closeDefaultPolicyModal` clears `defaultWriteInFlight`, finding F-7 in WP06-G1b) and the MRP modals (F-9 in WP06-G1c) have the same pattern; each is its own small package (G1e) because they live in other files/owners.
