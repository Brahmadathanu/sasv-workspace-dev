# WP01 — PEC Traceability & PWA Access Correction

## Gate status
**Current (2026-10-10, IST):** PEC WP01 G4 PASS / COMPLETE: original intended View-only user `33372369-…` sees `193 (15)` in Read-only PWA; intended Editor `b8fd6239-…` sees `193 (15)`, passed temporary View-only restriction testing, and was deliberately restored to Editor. PRs #49, #51, #52 merged; PWA v344 deployed. DEC-009 records the historical out-of-order #49 merge. Final documentation PR awaits review.
**Resolved:** PR #52 merged and deployed v344; PR #46 closed unmerged; PR #51 merged the exact two historical live SQL migrations. Global migration-history drift and unrelated popup formatting are separate work.
**No application, data, permission or release mutation authorized by this document.**

## Problem A — two users cannot see PWA module
Prior read-only audit observed two correct `get_user_permissions` view grants, PWA registry module with `nav_enabled=true`, `min_nav_mode=read`, path `/shared/procurement-execution-console.html`; users nevertheless reported missing module.
**Updated G0 finding (2026-10-09):** Current `public/utilities-hub/js/hub-auth.js` already wires `visibilitychange` (visible) and `pageshow` to rerender, and `loadUtilities()` fetches `loadClientModuleRegistry('pwa')` while `loadAccessMap()` refetches `get_user_permissions`. Current `public/shared/js/module-registry.js` already maps `can_view + min_nav_mode=read` to `read`. Thus blindly adding resume listeners is **not justified**. Investigate actual deployment/service-worker version, network/error path, signed-in session permission mapping, registry/migration durability, route and client cache before changing any one of these. Live registry still shows `nav_enabled=true`, `min_nav_mode=read`, and the expected PWA route.
**Acceptance:** each affected account's real authenticated PWA displays and opens the module after supported refresh/relaunch; read-only card remains read-only; unauthorized user stays blocked. Preserve canonical grants. Capture registry persistence and exact navigation evidence.
**Historical status and resolution:** PR #46 introduced the live PWA registration and view rewrite using migration version `20261009100628`. It was closed unmerged as superseded. Merged PR #51 records exact live migration versions `20261009100628` and `20261009131026` on main.
**Disposition:** The former PR #46/migration-history follow-up is resolved by merged PR #51; no database replay or repair was performed.
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
| E06 | Migration durability/service-worker path | RESOLVED 2026-10-10: historical SQL captured in merged PR #51; service worker v344 deployed via PR #52. Earlier v343 evidence remains historical. |
| E07 | Current main already has `visibilitychange` + `pageshow` rerender, canonical permission retrieval and `read` mode mapping | VERIFIED 2026-10-09; root cause remains open |
| E08 | Filtered internal RPC is `SECURITY DEFINER`, owned by `postgres`, `search_path=public`, and is not directly executable by `authenticated` | VERIFIED 2026-10-09; preserve wrapper/security separation |
| E09 | PR #49 merged to main at 19:38 IST on 2026-10-09 before independent audit, contrary to the brief. Post-merge independent read-only audit (user's assistant): PASS WITH NOTES. Code matches stated scope. Invalid, zero, negative, and null serials show `unavailable`. Output escaped via `esc()`. No permission, RLS, or server changes. Smoke scripts `pec-wp01-indent-serial-smoke.mjs`, `pec-plm-pm-canonical-smoke.mjs`, and `pec-pr-scope-smoke.mjs` pass. | VERIFIED 2026-10-09 |
| E10 | Historical PR #49 audit notes: old v343 cache and absent repo SQL were then open; later resolved by PRs #52 and #51. Changed export `[193]` → `[193 (15)]`; other popup formats remain out of scope. | HISTORICAL NOTES; two reconciliation items RESOLVED 2026-10-10 |
| E11 | G4 signed-in acceptance, user-performed on a phone PWA; screenshots held by the user. Admin grant temporarily set to view-only on module `procurement-execution-console`: Hub card `Procurement Execution Console` labelled `Read only`; console banner `Read-only access: workflow actions are disabled for your account`; add button disabled; Vendor-wise Buying List, 28 MM ROPP Cap (Classic Technologies) Indents popup showed `193 (15)`. Grant removed: card not visible (unauthorised user blocked). Grant then restored. User earlier verified Problem B and Problem C checks in a fresh PWA session via Cursor. Tested with the admin account and a temporarily reduced grant, not the two originally affected accounts. | VERIFIED 2026-10-09; account caveat recorded |
| E12 | PR #46's live registration/view rewrite is recorded verbatim in merged PR #51 as version `20261009100628`; PR #46 closed unmerged as superseded. | RESOLVED 2026-10-10 |

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
- G2: **VERIFIED live** — migration `pec_filtered_buylist_canonical_indent_line_sort_no`; canonical join 1147/1147; 769 rows and all financial totals unchanged; example 193 (15); function security preserved. Authenticated G4 acceptance was subsequently completed; original server parity evidence preserved.
- G3: **DONE** — PR #49 merged to main at 19:38 IST on 2026-10-09. Post-merge independent read-only audit PASS WITH NOTES (E09, E10).
- G4: **PASS / COMPLETE (2026-10-10)** — Intended View-only user `33372369-…` sees `193 (15)` and has Read-only access. Intended Editor `b8fd6239-…` sees the same label; temporary View-only test passed before deliberate restoration to Editor. No permission change needed.
- G5: PR #49 was merged before the independent audit, contrary to the brief. Post-merge verification of main was done by that audit (PASS WITH NOTES). Out-of-order merge accepted by user 2026-10-09 (DEC-009). This does not mean the prescribed order was followed.

## G3 client evidence — 2026-10-09
Buying-list normalization keeps canonical `indent_line_sort_no`. The Indents modal, buying-list compact export, and buying-list PDF indent split display `indent (serial)`, for example `193 (15)`. A missing or invalid serial displays `unavailable` and is not replaced with a row index. Opened indent `#` cells use that same serial on the first paint and on infinite-scroll append.

Display-only compact change: structured buying-list breakdown text changes from `[193]` to `[193 (15)]` when the canonical serial is present, and to `[193 (unavailable)]` when it is not. Quantity, rate, amount, vendor, and line identity are unchanged. Indent requisition `SN` remains the export document sequence.

**Historical G3/PWA investigation (2026-10-09):** At that point `hub-cache-v343` was deployed and original-user signed-in evidence was open. Both were subsequently resolved by PR #52 and G4 acceptance on 2026-10-10; the Hub permission mapping remained unchanged.

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

## Historical open follow-ups (2026-10-09; disposition updated 2026-10-10)
Pending user decision where noted. Not decided in this document.
- **RESOLVED / SUPERSEDED 2026-10-10:** The former `hub-cache-v343` stale-client concern was addressed by the separately approved PR #52 service-worker v344 release (merge `dd669459010c8df1bf73a198da564a02becfb392`), updated smoke expectations and successful affected-user retests.
- PR #46 closed unmerged as superseded; exact live migration version `20261009100628` was recovered by merged PR #51.
- **RESOLVED / SUPERSEDED 2026-10-10:** Merged PR #51 (`f2d9a94fd300f61dc728daaba8914f00a7b0d655`) records the exact historical G2 live migration as `20261009131026_pec_filtered_buylist_canonical_indent_line_sort_no.sql` alongside the original `20261009100628` PWA registration/view migration; no replay or repair.

## Parked
Potential wider finance formatting improvements, other indent UX enhancements, and unrelated stock mapping are outside WP01 unless separately approved.

## E13–E17 — final operational and repository closure evidence (2026-10-10 IST)
| ID | Evidence | Status |
|---|---|---|
| E13 | PR #51 merged: historical live versions `20261009100628` and `20261009131026` reconstructed verbatim from `supabase_migrations.schema_migrations`, and integrated without `db push` or migration repair. Live view rewrite from original PR #46 included faithfully in history. | VERIFIED via prior read-only audit and reported merge |
| E14 | PR #52 merged at `dd669459010c8df1bf73a198da564a02becfb392`; Netlify production serves `hub-cache-v344` and updated PEC client script, verified content-identical to merged main; no Electron release. | INDEPENDENTLY VERIFIED content parity per closure audit |
| E15 | Intended View-only user `33372369-…`: PWA shows `193 (15)` with Read-only access. Intended Editor `b8fd6239-…`: PWA shows `193 (15)`; temporary View-only restrictions passed and Editor grant deliberately restored. | BOTH PASS — user-reported 2026-10-10 |
| E16 | Prior admin account grant temporarily restricted: Read-only card/banner and edit restrictions; grant removed: card hidden; grant restored. | Representative PASS WITH NOTES; not substituted for E15 |
| E17 | PR #46 closed unmerged as superseded; 35 approved clean Group A remote branches deleted, 23 remote branches kept excluding main with SHA-guarded checks, other worktrees/branches retained and auto-delete off. | Executor-reported ledger; no further cleanup authorized here |

**Disposition:** G4 complete. PEC WP01 operational acceptance met; final documentation PR #53 merged at e20a8f06 (closed 2026-10-10). Out-of-order PR #49 merge remains DEC-009 historical exception, not a process precedent. The wider repository/live migration drift (50 local vs 515 remote in the recorded snapshot), historical branch cleanup beyond Group A, and other PEC popup indent-reference formats are separate work and do not reopen accepted WP01 functionality.

### E18 — 2026-10-10 role qualification
**E18 RESOLVED — no correction required.** Account `b8fd6239-…` is intentionally an Editor; its live View+Edit permission is correct. It was temporarily assigned View-only, passed serial display and disabled-action checks, then deliberately restored to Editor. The original intended View-only account is `33372369-…` and passed after v344. No remaining grant-restoration work.
