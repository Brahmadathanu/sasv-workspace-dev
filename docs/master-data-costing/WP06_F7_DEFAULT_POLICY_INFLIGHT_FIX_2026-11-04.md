# WP06-F7 — default-policy revise modal: in-flight persistence and stale-session handling — 4 Nov 2026

Applied directly on `main` (after #153 and #154 were squash-merged; supersedes the stacked PR #157 branch, which inherited already-merged changes). The module also contains #153's F-1/F-2 protections for the SKU-assumption modal; both sets are preserved and tested together. Test file: `scripts/costing-wp06-g1b/default-policy-modal-browser.test.mjs`. Source file: `public/shared/js/costing-suite-commercial-sales-assumptions.js` (default-policy revise functions only). RPC names, payloads, validation, permissions and scope semantics unchanged. The F-7 characterisation test of #154 is **replaced** by protective assertions.

## Defects reproduced first (5 of the 7 new F-7 tests failed on the unfixed code)
1. `closeDefaultPolicyModal` cleared `defaultWriteInFlight` → after closing during a pending save, a second write for the same target (or another target) could be sent.
2. A completion of the old request ran `closeDefaultPolicyModal()` on whatever modal was open, and showed its error text inside a newer modal.
3. `refreshDefaultPolicyImpactPreview` had no session/request identity: the answer of a closed session (or of a superseded request) was rendered into the newer modal and its `commit_allowed` could enable Save for the wrong target.
4. `saveDefaultPolicyRevision` captured the old target's fields, then awaited the commit-time preview; if the user switched modal meanwhile, the write for the OLD target was gated by the NEW session's preview.

## Fix
- `defaultModalSeq` (monotonic session id, bumped on open and close) and `defaultPreviewSeq` (latest preview request). Preview answers are applied only if both still match; invalidated when inputs become unpreviewable, on open and on close.
- `defaultWriteInFlight` is no longer cleared by the modal; it is cleared only by the request that set it (`finally`), which then restores Save from the *current* session's preview (`setDefaultSaveEnabled(Boolean(defaultScopePreview?.commit_allowed))`).
- The save captures its session; if the session changed while the commit-time preview was pending, nothing is written. On completion the success toast, policy re-read, hub re-render and `reloadRows` still happen (the write succeeded), but the modal is closed and an error is shown only in the session that started the request.

## Evidence
Mutation checks (each fails the browser suite): close clears the flag (2 failures); stale preview rendered (1); no session check after the commit-time preview (1); success closes a newer modal (2); stale error shown (1, after fixing the test stub so the failure is decided when the answer arrives); controls not restored after completion (4).
