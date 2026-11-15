> **LATEST — CORRECTED G2 VERIFICATION ACCEPTED / MERGE AUTHORITY PENDING:** ChatGPT independently verified head `b26c7c3454f03cb2199999080095404cb7cb6e70`: runtime unchanged from reviewed correction; committed corrected-head JSONs reconcile to Chromium 87/87 + OFF 33/33, contract 38/38, source 23/23 and regressions 5/5 PASS (all offline/mocked). The previous corrected-head browser-evidence HOLD is resolved. [Final independent recommendation](WP09_G2_FINAL_INDEPENDENT_VERIFICATION_2026-11-15.md) proposes #434 merge → #437 retarget/base check → default-off merge, subject to owner authority. Neither PR is merged or retargeted. Live/release acceptance remains NOT TESTED; WP09 OPEN, 9/13; WP11/WP12 obligations retained. Older HOLD/pending-rerun banners below are historical.

# WP09 G2 — ChatGPT independent review and corrective evidence (15 November 2026)

**Verdict: corrections prepared for draft PR #437; HOLD runtime merge/release until corrected-head browser verification. WP09 OPEN, programme 9/13.** No production flag, SQL, registry, permission, deployment or Electron repointing change.

## Source and scope

Reviewed Claude's exact G2 head `2b0f9a13d53b3ccbba72d1b9ead289ae9bade614` against owner-authority / #434 head `7584c0f04cae2b4a713a12fe46b2db1fac580835`. Refreshed main remains `e5693623e71ae60d0d613498f4e76c99be7214ef`. #437 correctly targets `claude/lucid-gates-6uwfvx`; separate branch `claude/wp09-g2-launcher-families` is explicitly acceptable and required by #436. No extra branch approval is needed. G1/#434 has not merged; #437 must be retargeted to main only after that integration, with an exact-diff check.

Original 25-file diff has exactly seven runtime files, no SQL/registry changes. Contract preserves all 79 Electron and 41 PWA keys, live sections and the six-Costing family including Production Route Manager; 36/24 maximum section-scoped top-level counts. Alias table and lab access checks are unchanged. Registered child routes are preserved. Five historical migration CRLF-only worktree differences remain untouched and are not part of the published diff.

## Findings and corrections

| ID | Finding at original head | Corrective action / evidence |
|---|---|---|
| R1 | `isLauncherPresentationV1Enabled(storage = globalThis.localStorage)` can throw before entering its try block when accessing the property is denied. Because both launchers call it at import, even the intended OFF fallback could fail. | Move property lookup inside try. The regression installs a throwing property getter, invokes the actual helper and requires false. It fails on the original code and passes after correction. |
| R2 | PWA revalidation leaves previous tools/pins/search and module DOM active until async permission loading finishes. An identity change during an active render is discarded by the existing SIGNED_IN short circuit; an outdated result can publish previous-user tools. Existing P5 waits 700ms and checks settled state only. | Flag-ON renders immediately invalidate tools and module DOM, version pending renders, reject obsolete commits after async boundaries, and queue a changed identity even while rendering. OFF lifecycle remains unchanged. Actual hub lifecycle runs in an offline VM with a minimal DOM and deferred permissions, proving immediate clear, B→C switch, pending sign-out and OFF compatibility. Before correction 3 of 5 regressions failed; after correction 5/5 PASS. This is UI state isolation, not proof of database access or disclosure. |
| R3 | Source assertion X4 ends in `|| true`, so it passes regardless of whether entry points are flag-guarded. | Replace it with explicit CSS, renderer and tool-entry guard checks. Two mutation controls remove the PWA tools / Electron synchronization guards and must be rejected. Fresh source suite now 23 checks rather than 21. |
| R4 | Scope guard ignores every `20261112*` migration path without checking whether it is truly line-ending-only. No migration was actually changed by G2, but the guard could conceal a future SQL edit. | Ignore only tracked worktree differences whose committed bytes equal the authority baseline and whose content differs solely by CRLF/LF. Substantive or committed SQL differences remain in the forbidden scope set. |

`independent-review.test.mjs` exercises actual lifecycle functions with test-only data/DOM adapters. It makes no network call, performs no production authentication and does not replace a Chromium acceptance run. Initial failing results are retained as `WP09_G2_EVIDENCE/independent-review-before.json`.

## Decisions and deviations

- Separate G2 branch and PR base: accepted; do not commit runtime code into #434. Do not discard the unrelated migration differences.
- Recents: accepting non-display is within the package's implementation discretion; retain Electron's existing storage and pin/search behaviour. No additional personalised surface is required for G2.
- The two re-expressed G1 assertions O6/B7 are appropriate because source behaviour is now conditional; their OFF branch remains asserted. X4's vacuous guard was a separate defect and is now corrected.
- Keep `CACHE_NAME` unchanged because these dependencies are routed network-first **by the updated active service worker**, not merely to satisfy historical tests. That is not a guarantee for an old controlling worker or an unprimed offline cache. WP12 must verify update/activation, stale cached importer/dependency combinations, reload and warmed/offline behaviour. No installed-PWA result is claimed here.
- Season-profile review proves source-field parity only. The live FK/RLS/role findings remain NOT TESTED, the Products link depends on the legacy page, and F-A/F-B/F-C remain separate bounded follow-ups. No writer/page is removed. `production-overrides` stays an unregistered cleanup proposal; no archive/delete is executed.
- Lab permission-name differences remain WP12 page-level checks, not new aliases or permissions. WP11 PM BOM overflow and SKU Deactivate contrast #429 remain unresolved in their owning work pack.

## Fresh independent verification

| Suite | Result on corrected files |
|---|---|
| Generated contract check | PASS, 79 keys |
| G2 contract and existing six mutation controls | PASS 38/38 |
| G2 source/scope including new guard mutations | PASS 23/23 |
| New actual-lifecycle/storage regressions | PASS 5/5 (original head: 2 PASS / 3 FAIL) |
| G1 registry / source / mutation | PASS 21/21, 50/50, 22/22 |
| WP08 navigation source / resolver / SW freshness | PASS 13/13, 8/8, 15/15 |
| WP08 registry SQL | 1 PASS / 17 SKIPPED; PostgreSQL binaries unavailable here |
| WP08 historical G2-0 source scope guards | 11 PASS / 2 FAIL; same documented baseline; tests unchanged |
| G2 Chromium on corrected code | BLOCKED in this environment: Chromium/Playwright launch unavailable. Original 82/82 at `2b0f9a13` is author-reported mocked evidence, not a corrected-head rerun. |
| G1 launcher Chromium | Original 33/33 at Claude head; not freshly rerun after these corrections. |
| WP08 fail-closed browser | Historical 81/81; not rerun, WP08 runtime pages unchanged |
| Live roles / actual negative/view-only / installed PWA / packaged Electron/Windows / hosted resolver | NOT TESTED; inherited WP12 obligations |

Historical author evidence and screenshots are preserved; the new machine-readable independent review result records scope and classifications separately. No screenshot is relabelled as evidence of corrected-head behaviour.

## Remaining verification before a runtime merge recommendation

Run the extended G2 Chromium suite (original 82 checks plus five new pending-permission/account-change checks, expected 87 with screenshots) and 33-check G1 OFF suite on the corrected #437 head in the existing Claude session. The test harness now supports held permission responses and real stub auth callbacks; R1–R5 check immediate clear, queued identity change, denied final identity and pending sign-out. These new browser cases are authored and syntax-checked but NOT EXECUTED here. Run the new offline independent-review suite there too. Return results to this same review; no new audit/package/handover is needed. Do not activate production flags, merge, deploy or label mocked roles as live acceptance.

G1 audit acceptance remains valid independently of these G2 corrections. Its docs-only integration can be considered separately, but owner authority recorded for this package excludes automatic merges/deployment. No merge request is made while corrected-head verification is incomplete. Retarget #437 only after #434 actually merges, then confirm the runtime diff remains isolated and the authority/snapshot preserved.
