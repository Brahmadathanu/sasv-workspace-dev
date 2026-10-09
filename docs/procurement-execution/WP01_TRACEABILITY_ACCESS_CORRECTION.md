# WP01 — PEC Traceability & PWA Access Correction

## Gate status
**Current:** G2 server correction verified live (2026-10-09); G3 client implementation pending; G4/G5 unopened. Signed-in PWA access evidence remains outstanding.
**No application, data, permission or release mutation authorized by this document.**

## Problem A — two users cannot see PWA module
Prior read-only audit observed two correct `get_user_permissions` view grants, PWA registry module with `nav_enabled=true`, `min_nav_mode=read`, path `/shared/procurement-execution-console.html`; users nevertheless reported missing module.
**Updated G0 finding (2026-10-09):** Current `public/utilities-hub/js/hub-auth.js` already wires `visibilitychange` (visible) and `pageshow` to rerender, and `loadUtilities()` fetches `loadClientModuleRegistry('pwa')` while `loadAccessMap()` refetches `get_user_permissions`. Current `public/shared/js/module-registry.js` already maps `can_view + min_nav_mode=read` to `read`. Thus blindly adding resume listeners is **not justified**. Investigate actual deployment/service-worker version, network/error path, signed-in session permission mapping, registry/migration durability, route and client cache before changing any one of these. Live registry still shows `nav_enabled=true`, `min_nav_mode=read`, and the expected PWA route.
**Acceptance:** each affected account's real authenticated PWA displays and opens the module after supported refresh/relaunch; read-only card remains read-only; unauthorized user stays blocked. Preserve canonical grants. Capture registry persistence and exact navigation evidence.

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
| E02 | Live filtered RPC JSON lacks serial property | VERIFIED 2026-10-09 |
| E03 | Current GitHub client normalization function exists | VERIFIED in indexed repository search; full current-head source audit pending |
| E04 | Row-index rendering path | PRIOR AUDIT; reconfirm on current main |
| E05 | Registry/grants and two affected users | PRIOR LIVE AUDIT; current signed-in acceptance pending |
| E06 | Migration durability / service-worker/deployed-version path | INVESTIGATED 2026-10-09; no evidence-proven client correction. Signed-in acceptance still open. |
| E07 | Current main already has `visibilitychange` + `pageshow` rerender, canonical permission retrieval and `read` mode mapping | VERIFIED 2026-10-09; root cause remains open |
| E08 | Filtered internal RPC is `SECURITY DEFINER`, owned by `postgres`, `search_path=public`, and is not directly executable by `authenticated` | VERIFIED 2026-10-09; preserve wrapper/security separation |

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
- G3: isolated client tests and branch evidence.
- G4: ChatGPT independent audit and authenticated user acceptance.
- G5: explicit merge decision, post-merge/live verification, handover.

## G3 client evidence — 2026-10-09
Buying-list normalization keeps canonical `indent_line_sort_no`. The Indents modal, buying-list compact export, and buying-list PDF indent split display `indent (serial)`, for example `193 (15)`. A missing or invalid serial displays `unavailable` and is not replaced with a row index. Opened indent `#` cells use that same serial on the first paint and on infinite-scroll append.

Display-only compact change: structured buying-list breakdown text changes from `[193]` to `[193 (15)]` when the canonical serial is present, and to `[193 (unavailable)]` when it is not. Quantity, rate, amount, vendor, and line identity are unchanged. Indent requisition `SN` remains the export document sequence.

PWA: no client edit. Live `v_app_module_registry` has the PWA row `procurement-execution-console` with `nav_enabled=true`, `min_nav_mode=read`, and route `/shared/procurement-execution-console.html`. Effective grants on `module:procurement-execution-console` are 2 view-only and 3 edit. `authenticated` can select the registry view. Current Hub code already reloads the registry and `get_user_permissions` on `visibilitychange` and `pageshow`, and `getModuleAccessLevel` already maps view permission plus `min_nav_mode=read` to a clickable read card. `public/sw.js` is `hub-cache-v343`: `hub-auth.js` is network-fetched and `module-registry.js` is cache-first. Those two scripts are unchanged since the v343 commit, and the read-mode mapping dates from 2026-06-29, before that cache. The pre-read client still showed a view-only card rather than hiding it. The repository has no recorded public deployment URL, so the bytes currently served to phones were not compared. No permission was widened, no resume listener was added, and the service-worker cache was not bumped. Signed-in proof for the two accounts remains open.

## Parked
Potential wider finance formatting improvements, other indent UX enhancements, and unrelated stock mapping are outside WP01 unless separately approved.
