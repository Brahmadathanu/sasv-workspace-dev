# WP12 — authenticated browser service worker and 11 Costing flags (21 November 2026)

**Status:** REAL SIGNED-IN BROWSER OBSERVATION COMPLETE; **one explicitly stored ON flag identified**. WP12 remains OPEN, formal programme 12/13 closed. This is a user-observed read-only Chrome console receipt, not an agent-controlled browser or asset SHA verification.

## Owner-supplied actual console output
The operator ran the pre-reviewed read-only inspection of `navigator.serviceWorker`, `caches.keys()`, and an exact array of eleven named `localStorage.getItem()` feature keys. No setters, reloads, session-token inspections, or data requests occurred.

| Runtime item | Owner observation | Acceptance scope |
| --- | --- | --- |
| Service worker controller exists | `controlled: true` | PASS — current page controlled |
| Controller path | `/sw.js` | PASS — expected path |
| Active registration | `/sw.js`, state `activated` | PASS |
| Hub caches | `Array(1)` | One cache in filtered `hub-cache-*` list; **exact version string NOT SHOWN** (not a v394 cache-name proof) |
| Feature flags inspected | 11/11 | PASS for exact-key inspection |
| OFF, default/unset | 10/11 | PASS for these ten |
| ON, explicitly stored | **1/11: `COSTING_REVIEW_WORKLIST_V1`** | **DEVIATION from all-OFF assumption**, not necessarily a defect or unauthorised activation |
| Comparison scoped RPC flag | `COSTING_CSR_SCOPED_COMPARISON_RPC_V1` OFF/default | Consistent with separate owner-reported November 200 base-view request |
| Other flags | All OFF/default | No other stored ON flag shown |

Exact feature names verified against reviewed main `public/shared/js/costing-feature-flags.js` (10 keys) and `public/shared/js/costing-suite-production-route-corrections.js` (additional `COSTING_PRM_CORRECTIONS_V1`): only the literal string `"1"` enables each. Worklist is default OFF in source but ON in **this browser only** by stored selection. This may be an intentionally approved user pilot; **do not assume a defect, remove it, or silently count 11 OFF**.

## Follow-up required for formal WP12 sign-off
1. **Worklist ON origin / receiving**: owner to confirm this browser's `COSTING_REVIEW_WORKLIST_V1` was intentionally enabled and whether its current usage is accepted, or separately authorise a scoped reset. Do not mutate localStorage without decision.
2. **Cache identity**: if necessary, run read-only filtered `caches.keys()` display of cache names only (no values, no auth storage) to identify exact `hub-cache-vNNN` pin; previous v394 hosted/installed PWA evidence remains credited independently. Presence of `Array(1)` without its displayed element cannot establish version.
3. **Live ON/ALL-ON**: earlier mocked 21/21 matrix remains PASS, but general signed-in feature activation matrix remains NOT TESTED. Default-off source and ten browser-default OFF keys are accepted facts; no global features were toggled.
4. **Performance**: recorded owner November base-view HTTP 200 and 5.25s successful load; one sample exceeds 4s and does not prove or disprove 4s p95. Issue #273 remains scoped monitoring / owner decision.
5. **Security**: seven genuine No-access bounded views HTTP 200/empty PASS for no-disclosure, not explicit deny; direct route NOT TESTED; role View-only UI six modules PASS and No-access navigation hidden PASS.

## No action beyond recording
No production SQL/rows, role/grant change, service worker register/cache manipulation, localStorage mutation, flag activation/deactivation, network body disclosure, PR merge or release. WP12 only active; storage/selected schemes and cleanup parked.
