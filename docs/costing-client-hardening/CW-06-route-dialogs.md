# CW-06 — Production Route Manager in-page dialogs

Branch `feat/costing-cw06-route-dialogs`, baseline main `28cfadb20de3e2f3daf0aadada096f541254819d`. Draft; not merged.

## Audit of native prompt / confirm / alert (Costing client, `public/shared/js/costing-*.js`)
| Site | Status on main | This package |
|---|---|---|
| Family Route submit, duplicate sequences (`window.confirm`) | Already replaced by an in-page modal behind `COSTING_DIALOGS_V1` (flag OFF keeps native confirm) | No change |
| Supersede Product route (`window.prompt("New approved draft route ID:")`) | Native | In-page dialog behind `COSTING_DIALOGS_V1` |
| Create Manufacturing Route Family (`window.prompt("Manufacturing Route Family name:")`) | Native | In-page dialog behind `COSTING_DIALOGS_V1` |
| Candidate use review (`window.confirm` in `costing-suite-production-route-candidates.js`) | Fallback only; the route screen always injects `confirmCandidateUse: openCandidateReviewModal` | Reconciled: already resolved on main. Native fallback kept for callers that inject nothing |
| `costing-approval-screen.js` `confirmFn` | Injectable (`globalThis.confirm`) for the approval screen, outside Production Route Manager | Out of scope (separate approval contract) |

## Implementation
- New `public/shared/js/costing-dialogs-route-input.js`: `openRouteTextPromptModal` (labelled field, hint, inline `role="alert"` error, `aria-invalid`, `aria-describedby`, Enter submits, Cancel/Escape/backdrop resolve without writing, `withMutation` in-flight guard plus settled latch, stale-state refusal, generic safe error on failure) and validators `validateSupersedeRouteId` (positive whole number, not the route being superseded) and `validateRouteFamilyName` (not blank).
- `costing-suite-production-route.js`: two gated branches (`isCostingDialogsV1Enabled()`), each followed by the unchanged legacy native-prompt code.
- Flag `COSTING_DIALOGS_V1` stays default OFF; this package does not change any flag value.

## Write-flow parity
- Same calls and payloads: `editor.supersedeProduct({ new_product_route_id })`, `candidates.createRouteFamily({ route_family_name })`, so the same RPC builders (`rpc_supersede_product_route`, `rpc_create_route_family`), the same `canEdit()` checks and the same server validation apply. No RPC added or removed (tested against the baseline source).
- Differences, deliberate and client-side only: the value is trimmed; supersede requires a positive integer different from the open route; a stale selection is refused before any write. The server remains authoritative.
- No production route edits, database writes or RPC calls occurred during development; tests use fakes.

## Tests
`scripts/costing-dialogs/route-input-dialogs.test.mjs` (15 tests): validators, open/focus/ARIA, approve, incorrect input, Enter, cancel, Escape/backdrop cleanup (including a late click), repeated submission, stale state, write failure with no raw error leakage and retry, callback cleanup, plus source contracts for flag-OFF legacy code, payload parity, no data access in the dialog module, permission checks and RPC-name parity.

## Owner acceptance (Windows CMD)
```
node --test scripts\costing-dialogs\duplicate-sequence-confirm.test.mjs scripts\costing-dialogs\route-input-dialogs.test.mjs
```
Manual, with the flag ON in a non-production session (`localStorage.setItem("COSTING_DIALOGS_V1","1")` then reload) on a test Product route: open Supersede and Create Route Family; check Cancel, Escape, empty/invalid input messages, Enter, and that a double click performs one action. With the flag OFF the native prompts must appear exactly as before.
