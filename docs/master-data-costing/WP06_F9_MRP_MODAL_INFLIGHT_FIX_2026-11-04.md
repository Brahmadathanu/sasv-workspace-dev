# WP06-F9 — MRP modals: in-flight persistence and stale-session handling — 4 Nov 2026

Applied directly on `main` after #155 and #156 were squash-merged; this clean replacement supersedes the stacked PR #158 (which inherited already-merged changes). Test file: `scripts/costing-wp06-g1c/mrp-proposal-flows.test.mjs`. Source files: `costing-suite-mrp-decisions.js`, `costing-suite-mrp-application.js`, `costing-suite-mrp-proposals.js` (+45/−18 lines in total). RPC names, payloads, validation, permissions and business rules are unchanged; **D7 (no maker-checker) is untouched** — no actor, identity or comparison was added.

## Defects reproduced first (18 of the new tests failed on the unfixed code: 3 per modal × 6 modals)
Generate, Adjust, Reset, Submit, Decide and Apply each reset their `...Saving` flag when the modal is closed. Consequences, all reproduced deterministically with a gated RPC:
1. close (and reopen) while the request is pending → a second submission of the same operation is accepted;
2. the old request's success then calls the modal closer, closing / clearing the **newer** modal;
3. the old request's failure writes its message into the **newer** modal's error line.

## Fix (same pattern in all six)
- `...Session` — monotonic id, bumped on every open and every close of that modal.
- The `...Saving` flag is no longer cleared by the closer; only the request that set it clears it (`finally`), after which `syncWriteUi()` restores Save for the current session.
- A request captures its session when it starts. On completion the success toast, data reload, cache invalidation (apply) and view navigation (generate/submit select the workspace) still happen — the operation succeeded — but closing the modal and showing an error are done only if that session is still the current one.

## Evidence
- 43 tests (15 existing + 28 new). The two old F-9 characterisation tests are **replaced** by protective assertions: for each of the six modals — pending+close+reopen blocks a second submission (even with the button forced enabled); late success leaves the newer modal open, untouched, error-free with Save restored and usable; late failure is reported once but never shown in the newer modal and the new session recovers; pending+close without reopen leaves everything closed and the next modal clean; ordinary same-session success/failure/retry unchanged.
- Mutation: for every modal, (a) restoring the flag reset in the closer, (b) removing the success guard, (c) removing the error guard each fail exactly the corresponding test (18/18 mutants killed).
- D7 assertions in the stacked test file are labelled as current-state records, not policy (review comment on #155).

## Not changed
Navigation after generate/submit (selecting the new/submitted proposal workspace) is intentionally still applied for a late success; it is view state of a succeeded operation, not modal state. Applied-history is read-only and untouched.
