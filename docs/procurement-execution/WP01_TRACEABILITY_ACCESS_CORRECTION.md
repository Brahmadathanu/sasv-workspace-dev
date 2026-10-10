# WP01 — PEC Traceability & PWA Access Correction

## Gate status
**Current (2026-10-09, IST):** G3 client merged in PR #49 to main at 19:38 IST, before independent audit. Post-merge independent read-only audit of main: PASS WITH NOTES. G4: representative PASS WITH NOTES; two originally affected users PENDING; overall G4 OPEN. G5: the merge happened early; post-merge verification of main was done by that audit; the out-of-order merge was accepted by user 2026-10-09. This is not a claim that the brief's audit-then-merge order was followed.
**Open:** service-worker cache bump, PR #46 disposition and migration durability, G2 server change not stored as a repository migration.
**No application, data, permission or release mutation authorized by this document.**

## Problem A — two users cannot see PWA module
Prior read-only audit observed two correct `get_user_permissions` view grants, PWA registry module with `nav_enabled=true`, `min_nav_mode=read`, path `/shared/procurement-execution-console.html`; users nevertheless reported missing module.
**Updated G0 finding (2026-10-09):** Current `public/utilities-hub/js/hub-auth.js` already wires `visibilitychange` (visible) and `pageshow` to rerender, and `loadUtilities()` fetches `loadClientModuleRegistry('pwa')` while `loadAccessMap()` refetches `get_user_permissions`. Current `public/shared/js/module-registry.js` already maps `can_view + min_nav_mode=read` to `read`. Thus blindly adding resume listeners is **not justified**. Investigate actual deployment/service-worker version, network/error path, signed-in session permission mapping, registry/migration durability, route and client cache before changing any one of these. Live registry still shows `nav_enabled=true`, `min_nav_mode=read`, and the expected PWA route.
**Acceptance:** each affected account's real authenticated PWA displays and opens the module after supported refresh/relaunch; read-only card remains read-only; unauthorized user stays blocked. Preserve canonical grants. Capture registry persistence and exact navigation evidence.
**Status 2026-10-09 (IST):** PWA visibility now works. The PWA module client row for `procurement-execution-console` was registered live via PR #46's migration `supabase/migrations/20261009153000_pec_pwa_indent_serials.sql`. PR #46 is still OPEN and is not merged; that migration is therefore not on main.
**Open follow-up (pending user decision; not decided here):** decide PR #46's disposition and get its PWA registration migration onto main so the repository matches the live database.
Signed-in evidence for visibility is the G4 phone PWA record below. That test used the admin account with a temporarily reduced grant, not the two originally affected accounts themselves.

## Problem B — vendor-wise buying list Indents modal
Live 2026-10-09: `v_proc_vendorwise_buylist.indent_breakdown` provides `indent_line_sort_no`; `proc_vendorwise_buylist_filtered_pec_internal` omits this JSON field while reconstructing breakdown. Client `normalizeVwlBreakdown()` was previously found to discard it.
**Canonical example:** `28 MM ROPP Cap` → Indent `193`, serial `15`; display `193 (15)`.
**Required:** preserve existing JSON keys, grouping, filters, ordering and totals while adding `indent_line_sort_no`; normalize and consistently format serial. Audit other indent reference surfaces before deciding where else to reuse formatter. Missing value must not be inferred.

## Problem C — open-indent # displays result position
Prior code audit found client initial render uses `idx + 1` and appended render `startAt + idx + 1`, even though indent line RPC provides `indent_line_sort_no`. Revalidate both paths in current main. Show authoritative serial, including one-result search, infinite-scroll append and filter reset. Stable serial does not mean renumbering stored rows.

## Evidence register
| ID | Evidence | Status |
|---|---|---|
| E01 | Live base vendor-wise view indent 193 / cap serial 15 | VERIFIED 2026-10-09 |
| E02 | Live filtered RPC JSON lacks serial property | SUPERSEDED 2026-10-09 by live G2 change `pec_filtered_buylist_canonical_indent_line_sort_no` (not stored as a repo migration) |
| E03 | Current GitHub client normalization function exists | VERIFIED in indexed repository search. Post-merge audit of PR #49 (E09) found the client matches the stated scope. |
| E04 | Row-index rendering path | PRIOR AUDIT. G3 scope included the opened-indent `#` column; post-merge audit (E09) found the code matches that scope. |
| E05 | Registry/grants and two affected users | PRIOR LIVE AUDIT. 2026-10-09 phone PWA visibility recorded on the admin account with a temporary view-only grant (E11). The two originally affected accounts were not themselves tested. |
| E06 | Migration durability / service-worker/deployed-version path | INVESTIGATED 2026-10-09. `public/sw.js` still `hub-cache-v343` (E10). Live PWA row registered via PR #46's migration; that migration is not on main (E12). |
| E07 | Current main already has `visibilitychange` + `pageshow` rerender, canonical permission retrieval and `read` mode mapping | VERIFIED 2026-10-09; root cause remains open |
| E08 | Filtered internal RPC is `SECURITY DEFINER`, owned by `postgres`, `search_path=public`, and is not directly executable by `authenticated` | VERIFIED 2026-10-09; preserve wrapper/security separation |
| E09 | PR #49 merged to main at 19:38 IST on 2026-10-09 before independent audit, contrary to the brief. Post-merge independent read-only audit (user's assistant): PASS WITH NOTES. Code matches stated scope. Invalid, zero, negative, and null serials show `unavailable`. Output escaped via `esc()`. No permission, RLS, or server changes. Smoke scripts `pec-wp01-indent-serial-smoke.mjs`, `pec-plm-pm-canonical-smoke.mjs`, and `pec-pr-scope-smoke.mjs` pass. | VERIFIED 2026-10-09 |
| E10 | Audit notes, not closed: (a) `public/sw.js` still `hub-cache-v343`, so previously cached PWA clients may serve the old console script; deferred as separate release approval; the smoke test asserts v343 and must be updated with any bump. (b) G2 server change `pec_filtered_buylist_canonical_indent_line_sort_no` is applied live but not stored as a migration in the repo. (c) export Indent Breakdown text format changes from `[193]` to `[193 (15)]`. (d) some other PEC popups still show indent number without serial (out of scope). | RECORDED 2026-10-09; follow-ups OPEN |
| E11 | G4 signed-in acceptance, user-performed on a phone PWA; screenshots held by the user. Admin grant temporarily set to view-only on module `procurement-execution-console`: Hub card `Procurement Execution Console` labelled `Read only`; console banner `Read-only access: workflow actions are disabled for your account`; add button disabled; Vendor-wise Buying List, 28 MM ROPP Cap (Classic Technologies) Indents popup showed `193 (15)`. Grant removed: card not visible (unauthorised user blocked). Grant then restored. User earlier verified Problem B and Problem C checks in a fresh PWA session via Cursor. Tested with the admin account and a temporarily reduced grant, not the two originally affected accounts. | VERIFIED 2026-10-09; account caveat recorded |
| E12 | PWA module client row for `procurement-execution-console` registered live via PR #46 migration `supabase/migrations/20261009153000_pec_pwa_indent_serials.sql`. PR #46 still OPEN, not merged; migration not on main. Disposition pending user decision. | VERIFIED live registration 2026-10-09; repo follow-up OPEN |

## Required G0 outputs
- Identify exact source/migration/client paths and security-definer grants/owner/search_path implications.
- Compare current main with historical audit, other worktree owners and tests.
- Explain actual missing-card mechanism with evidence rather than untested assumption.
- Freeze smallest rollback-safe server contract and client test plan.
- Present G1 high-risk plan for explicit user approval.

## Detailed acceptance matrix
| Case | Expected |
|---|---|
| Indent 193 / 28 MM ROPP Cap | `193 (15)` |
| Modal with multiple indents | Each retains its own authoritative serial and indent |
| Search returns serial 15 alone | `# = 15`, not `1` |
| Filter + append / scrolling | Canonical serial unchanged; no duplicates from client numbering |
| No serial returned | Clearly unavailable, no fabricated numeric fallback |
| Vendor-wise filtered vs unfiltered | Same eligible data, same serials and amounts |
| Read-only PWA user 1 & user 2 | Visible route, can view, cannot edit |
| Authorized editor | Existing edit access unaffected |
| Ungranted user | No newly accessible module/data |
| Reopen/resume after permission update | Fresh entitlement presentation, no stale unauthorized view |
| Existing procurement data | No changes to line identity, quantity, pricing, approvals or history |
| Regression | Existing PEC tests and cross-module protections continue to pass |

## Gate completion
- G0: complete audit, root-cause discrimination and plan.
- G1: exact user-approved high-risk mutation contract.
- G2: **VERIFIED live** — migration `pec_filtered_buylist_canonical_indent_line_sort_no`; canonical join 1147/1147; 769 rows and all financial totals unchanged; example 193 (15); function security preserved. Authenticated wrapper test still pending.
- G3: **DONE** — PR #49 merged to main at 19:38 IST on 2026-10-09. Post-merge independent read-only audit PASS WITH NOTES (E09, E10).
- G4: **PARTIAL / OPEN — representative PASS WITH NOTES** — phone PWA evidence E11 (2026-10-09). Admin account was tested with a temporarily reduced grant; the two originally affected View-only users are still unverified. Do not mark overall G4 complete.
- G5: PR #49 was merged before the independent audit, contrary to the brief. Post-merge verification of main was done by that audit (PASS WITH NOTES). Out-of-order merge accepted by user 2026-10-09 (DEC-009). This does not mean the prescribed order was followed.

## G3 client evidence — 2026-10-09
Buying-list normalization keeps canonical `indent_line_sort_no`. The Indents modal, buying-list compact export, and buying-list PDF indent split display `indent (serial)`, for example `193 (15)`. A missing or invalid serial displays `unavailable` and is not replaced with a row index. Opened indent `#` cells use that same serial on the first paint and on infinite-scroll append.

Display-only compact change: structured buying-list breakdown text changes from `[193]` to `[193 (15)]` when the canonical serial is present, and to `[193 (unavailable)]` when it is not. Quantity, rate, amount, vendor, and line identity are unchanged. Indent requisition `SN` remains the export document sequence.

PWA: no client edit. Live `v_app_module_registry` has the PWA row `procurement-execution-console` with `nav_enabled=true`, `min_nav_mode=read`, and route `/shared/procurement-execution-console.html`. Effective grants on `module:procurement-execution-console` are 2 view-only and 3 edit. `authenticated` can select the registry view. Current Hub code already reloads the registry and `get_user_permissions` on `visibilitychange` and `pageshow`, and `getModuleAccessLevel` already maps view permission plus `min_nav_mode=read` to a clickable read card. `public/sw.js` is `hub-cache-v343`: `hub-auth.js` is network-fetched and `module-registry.js` is cache-first. Those two scripts are unchanged since the v343 commit, and the read-mode mapping dates from 2026-06-29, before that cache. The pre-read client still showed a view-only card rather than hiding it. The repository has no recorded public deployment URL, so the bytes currently served to phones were not compared. No permission was widened, no resume listener was added, and the service-worker cache was not bumped. Signed-in proof for the two originally affected accounts remains open; see the G4 record below for what was actually tested.

## Post-merge audit of PR #49 — 2026-10-09 (IST)
PR #49 was merged to main at 19:38 IST before independent audit, contrary to the brief. A post-merge independent read-only audit by the user's assistant returned **PASS WITH NOTES**.
- Code matches the stated G3 scope: canonical indent serials in the PEC buying-list Indents popup, exports, and opened-indent `#` column.
- Invalid, zero, negative, and null serials show `unavailable`.
- Output is escaped via `esc()`.
- No permission, RLS, or server changes.
- Smoke scripts pass: `pec-wp01-indent-serial-smoke.mjs`, `pec-plm-pm-canonical-smoke.mjs`, `pec-pr-scope-smoke.mjs`.
- Notes: (a) `public/sw.js` still `hub-cache-v343`, so previously cached PWA clients may serve the old console script; deferred as separate release approval; the smoke test asserts v343 and must be updated with any bump. (b) the G2 server change `pec_filtered_buylist_canonical_indent_line_sort_no` is applied live but not stored as a migration in the repo. (c) export Indent Breakdown text format changes from `[193]` to `[193 (15)]`. (d) some other PEC popups still show indent number without serial (out of scope).
The out-of-order merge was accepted by user 2026-10-09 (DEC-009).

## G4 signed-in acceptance — 2026-10-09 (IST)
**PASS WITH NOTES.** User-performed on a phone PWA. Screenshots are held by the user.
- With the admin's own grant temporarily set to view-only on module `procurement-execution-console`, the Hub showed the `Procurement Execution Console` card labelled `Read only`.
- The console opened with banner `Read-only access: workflow actions are disabled for your account` and the add button disabled.
- Vendor-wise Buying List, 28 MM ROPP Cap (Classic Technologies) Indents popup showed `193 (15)`.
- With the grant removed, the card was not visible (unauthorised user blocked). The grant was then restored.
- The user earlier verified Problem B and Problem C checks in a fresh PWA session via Cursor.
**Caveat:** this was tested using the admin's account with a temporarily reduced grant, not the two originally affected accounts themselves.

## Open follow-ups (2026-10-09, IST)
Pending user decision where noted. Not decided in this document.
- Service-worker cache bump for `hub-cache-v343`. Previously cached PWA clients may serve the old console script. Separate release approval. The smoke test asserts v343 and must be updated with any bump.
- PR #46 is still OPEN and not merged. Decide its disposition and get `supabase/migrations/20261009153000_pec_pwa_indent_serials.sql` onto main so the repository matches the live database.
- Store the live G2 server change `pec_filtered_buylist_canonical_indent_line_sort_no` as a migration in the repository.

## Parked
Potential wider finance formatting improvements, other indent UX enhancements, and unrelated stock mapping are outside WP01 unless separately approved.
