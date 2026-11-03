# WP05-P02 — Production Route Manager corrections (2 Nov 2026)

Client-only. Draft PR; not merged. Baseline `main` `3d0b6185f4351469cf23969beefac0e8875e0c2e` (re-verified at start). Guided by the WP05-A5/A6 documents on PR #130 (not yet on `main`).

**Flag:** `COSTING_PRM_CORRECTIONS_V1` (localStorage, default OFF). With the flag OFF every code path, rendered HTML and RPC call is the pre-existing one. `COSTING_DIALOGS_V1` is untouched; the new flag takes precedence for the two affected actions.

## What changed (flag ON)
| ID | Behaviour |
|---|---|
| C1 | Empty Product Route Editor shows a searchable Product picker (same pattern as the Effective Route Viewer). Choosing a Product uses the existing loader (opens the single current route, or lists the Product's versions). A **Route history** button on a loaded route opens the existing history modal to select another version. **Supersede** is shown only when the loaded route is APPROVED *and* the Product's history contains at least one other APPROVED, non-archived version; otherwise a short note says why (history unavailable / no other approved version). The dialog replaces the raw-integer prompt with a selector listing only those routes and names the route being superseded. Payload is unchanged: `p_old_product_route_id` (loaded route) and `p_new_product_route_id` (chosen). No dates are computed; the server's errors are shown unmodified and keep the dialog open. |
| C2 | Candidate scope controls are visible (`is-visible` on the summary host) and preselected from the deep link (`route_family_id`, `product_id`, `product_group_id`) and from the user's own last choice (kept across the repaint after Preview). |
| C3 | "Create Manufacturing Route Family" opens the existing governed Route Families modal (user types `p_family_code` and `p_family_name`; code validated `^[A-Z][A-Z0-9_]*$`). No code is generated or derived. That modal already stays open on failure and reports success only after the server accepted the request. The generic prompt dialog gained an opt-in `keepOpenOnFailure` (returned `{ok:false}` keeps it open and shows the reason). |
| Context | Workload Preview, Mapping Review and Foundation Review (Run 82 · Aug 2026 · valued 7 Aug 2026) now state "Fixed historical context - not the current costing run". Workload Preview's run cue lived in a hidden summary host; it is made visible with the flag. Run 80 (period 2026-07-01, valuation 2026-07-22) is only used by the exact-run readiness helper, which no lens calls, so there is no surface to label; it is recorded in `PRM_FIXED_HISTORICAL_CONTEXTS` and tested. No run selector or resolver was added. |

## Supersession eligibility (server contract)
Live `rpc_supersede_product_route` (migration `20260812173816`) requires both routes to be `status = 'APPROVED'`, `archived_at is null` and of the same Product, then sets the old route's `effective_to` from the new route's `effective_from`. The selector mirrors exactly that using `rpc_get_product_route_history`, which returns the full table rows (`status`, `archived_at`, `product_id`). The direction (which of two approved routes is "old") is the loaded route; the client does not judge dates. The server stays the authority.

## Files
`costing-suite-production-route.js`, `-route-editor.js`, `costing-dialogs-route-input.js`, new `costing-suite-production-route-corrections.js` (pure logic; it also defines the flag, so the shared `costing-feature-flags.js` stays byte-identical because other packages' tests guard it); tests under `scripts/costing-prm-corrections/` and two count assertions in `scripts/costing-dialogs/route-input-dialogs.test.mjs` (call sites 2→3, `notify` 2→3). No HTML/CSS change was needed.

## Remaining limitations
* Which approved route is "old" vs "new" is not validated by date client-side (by design); the server rejects unsuitable pairs.
* The 390 px check covers the controls and dialogs reachable in the mock; real data volumes were not exercised.
* Run 80 has no visible surface to label (see above). Any selector for runs 80/82 remains the D5 server-review item.
* `scripts/production-route-*-smoke.mjs` (not part of the 408-test suite) fail on pristine `main` identically (51 scripts); this package changes none of them.

## Review pass (3 Nov 2026): identity and async races
* **Identity.** `rpc_get_product_route_history(p_product_id)` (migration `20260802142625`) filters `where r.product_id = p_product_id` and returns whole table rows, so each row carries its `product_id`; `rpc_get_product_route_detail` likewise returns `to_jsonb(r)` as the header. The server therefore guarantees identity today, but the client no longer depends on it: a replacement row is offered only if its own `product_id` is present and equal to the loaded route's `product_id` (previously a missing `product_id` was accepted), and the loaded route's product comes only from its own detail header (the URL/selection fallback was removed). Unknown identity hides Supersede.
* **Races.** Gate requests are sequence-tagged and re-validated against the route still loaded and the lens still active; choices are cleared on entering the editor and on any editor action, and a dropped (invalidated) answer triggers a fresh check instead of being applied. The Supersede dialog and Route history button re-check the loaded route/lens after their history await and use an in-flight latch against repeated clicks. Submit remains single-flight (`withMutation`) and refuses a changed route before any write.
* Tests R1–R5 (browser) and the identity unit test. Mutation check: removing the identity rule, the sequence/invalidation guard, or the latch makes R1, R2b and R5 fail respectively.
