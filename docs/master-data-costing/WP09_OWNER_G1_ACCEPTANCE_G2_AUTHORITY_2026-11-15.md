# WP09 — Owner G1 acceptance and G2 client authority (15 November 2026)

## Owner instruction and scope

After ChatGPT presented corrected draft PR #434 at `1d7791e7578f57acece324f68b54be7530930c46`, G1 results and the recommendation table, the owner replied **“Yes proceed”**. This records that explicit approval; it is not a signature created on the owner's behalf.

**G1 audit ACCEPTED in its documented source/metadata scope. G2 client implementation AUTHORISED. WP09 remains OPEN; programme 9/13.** Main at approval refresh: `e5693623e71ae60d0d613498f4e76c99be7214ef`. No fresh browser/live-role PASS is implied.

| Decision | Owner-approved disposition |
|---|---|
| G1 | Accept corrected audit, including test classifications and bounded review limitations. |
| IA | A then C: subgroup headings and section-scoped visual families; preserve current live sections, keys, routes and permission targets. Defer B. |
| Season profiles | MRP Master Data Console is the intended canonical owner, conditional on functional parity and dependency review before disabling or retiring the unregistered source writer. Investigation/reporting is approved; writer changes require an exact reviewed follow-up. |
| Costing | One visual family with all six modules, including Production Route Manager; preserve individual search, pins, routes and grants. |
| PWA | Shared search and per-user local Quick Access. No backend synchronization or new registry registrations. |
| Legacy source | Review dependencies before proposing archive/removal of unregistered source pages. No destructive cleanup or registry retirement is approved by the recommendation. |
| Root/child routes | Preserve registered child-page routes and existing client asymmetry; no Electron Step B or new PWA port. |

## Implementation defaults within that authority

Implement A→C and search/Quick Access as one coherent client package, using default-off presentation gating and existing conventions. Choosing a bounded default-off flag identifier is a routine implementation choice; it does not grant authority to activate it. Both disabled and enabled modes must be tested in isolated fixtures, with rollback to today's launcher. Existing production flag values and the inherited 11-flag release gate stay unchanged.

For locked modules, preserve visible locked semantics: search may show the already-visible locked result as disabled, but never create an enabled destination; denied modules stay absent. Pins remain enabled/routable modules only. Resolve family visibility after permission filtering; empty families disappear. Unknown registry keys remain reachable under a safe fallback group.

Defensive fallback handling needed by grouping belongs to this client work. Separate taxonomy/display-name changes, global sort-order cleanup and unrelated service-worker cleanup are deferred unless essential to the approved implementation and explicitly justified in the draft for independent review. Do not bundle writer removal with launcher work.

## One Claude package and current dispatch state

The complete assignment is `WP09_G2_SINGLE_CLIENT_PACKAGE_2026-11-15.md`, now **AUTHORISED / READY TO START**. Create one implementation branch from the current #434 head, integrating newer main only after inspecting drift. #434 remains the G1 audit/authority PR; do not mix runtime implementation into it. Create one separate G2 draft PR. If #434 is unmerged, initially target its branch to isolate runtime review; retarget to main after G1 merges. Do not merge either PR or deploy from the coding session.

ChatGPT inspected Claude Cloud; this browser reached its sign-in page. No Claude task has been submitted, no authentication was attempted, and a GitHub assignment does not itself launch Claude. A short kickoff prompt can start this single package in the owner's existing Claude Code Cloud session.

## Retained stops and receiving obligations

No production SQL writes, registry mutations, grants, permissions/RLS, flag activation, deployment or Electron repointing. No WP09 formal closure. WP08/PEC stay closed; five historical CRLF-only 20261112 migration worktree differences stay untouched. WP11 PM BOM overflow and SKU Deactivate contrast #429 remain. WP12 retains security/role, hosted resolver, installed-PWA, packaged-Electron/Windows, final flags and W12-WP08-01…08 acceptance. Two lab page/registry permission-name differences remain NOT TESTED; no alias or access-check change is authorised. Any demonstrated disclosure blocks release.
