# SASV Workspace v6.5.1 — PEC Purchase Allocations mobile usability patch: release record

Previous stable: v6.5.0 (`a72af1e`), cache `hub-cache-v395`; both re-checked against live state before this release (unchanged by concurrent work). Target: v6.5.1, `hub-cache-v396`.

| Item | Reference |
|---|---|
| UX03 client implementation (squash-merged) | PR #532, `f7d2e6d` |
| Owner refinement: Summary pinned right + PEC chevron (client PR, squash-merged) | PR #533, `1049142` |
| Release PR: version 6.5.1, `public/sw.js` cache v396, reviewed guard pin `REVIEWED_PEC_V651_PINS`, exact v395->v396 permit in `wp11-approved-delta.mjs`, cache-name pins, release notes | release PR (this) |

Design, measurements (594 -> 276 px at 390x844) and evidence: `PEC_UX03_MOBILE_USABILITY_REFINEMENT_20261125.md`.

## Service-worker treatment
Only the cache generation advances (v395 -> v396). Network-first rules for `procurement-execution-console.js`, its CSS, `pec-modal-stack.js` and `pec-purchase-allocations.js` already exist and are unchanged; the console imports the lens module with a new `?v=20261125a`. The v6.5.0 guard pin remains and tolerates supersession; the v6.5.1 pin binds exact path, head branch and SHA-256.

## v6.5.0 publication evidence (completed)
Tag `v6.5.0`, target `a72af1e4bc9b34f5109e62051bf97ab4252f7f01`, published 2026-11-24T17:42:18Z as stable Latest (not draft, not prerelease) by `publish-sasv-release.yml` run 45451409295 (success). Assets: installer, ZIP, blockmap, `latest.yml`, `SHA256SUMS.txt`. The owner never installed it separately, so owner acceptance is consolidated on v6.5.1.

## v6.5.1 publication evidence
- Client PRs: #532 (`f7d2e6d`), #533 (`1049142`); release PR #534, final main `c6587a10bf5653262654d81daeb163af9115a052`.
- CI on #534: all 15 checks green (integrated-pec, wp10-offline, package, hosted-provenance, ...). On the main commit: Electron Windows release candidate run 45536311668 (success), PEC Integrated Browser Acceptance run 45536311784 (success).
- Installer SHA-256 recorded from the build log: `52537b32fa004a7897ea7d4a6ffd2669ff8628535e888ea71181e1fbd932902b`. Publish run 45537168180 (success), published 2026-11-25T03:03:01Z.
- Release: tag `v6.5.1` -> `c6587a1` (lightweight tag, commit object), stable Latest, assets `SASV-Workspace-Setup-6.5.1.exe` (141,490,920 B), `SASV-Workspace-6.5.1-win.zip`, blockmap, `latest.yml`, `SHA256SUMS.txt`; SHA256SUMS lists the installer hash above; `latest.yml` version 6.5.1 and is served by `/releases/latest/download/latest.yml`.
- Production PWA (`sasv-utilities-hub.netlify.app`): serves `hub-cache-v396`; `pec-release-provenance-check --url` byte-identical for the console HTML, JS, CSS and `sw.js`; `pec-purchase-allocations.js` and `pec-modal-stack.js` byte-identical to the repository.

## Final owner operational acceptance — 2026-11-25

**Status: CLOSED — owner approved all eight operational acceptance checks on v6.5.1.** Acceptance was explicitly confirmed in the SASV Workspace programme-control conversation on 25 November 2026 (IST). The consolidated owner acceptance covers:

1. PWA compact layout and professional appearance.
2. PWA full-page filter modal on narrow screens.
3. PWA right-aligned Summary button and chevron.
4. PWA date filters, allocation results and drill-downs.
5. Electron successful update to v6.5.1.
6. Electron anchored filter panel on regular screens.
7. Electron nested modal Escape behaviour.
8. Electron Purchase Allocations exports and print functionality.

These are owner-attested operational results, not independently executed browser or Windows tests by the implementation agent. All scoped work packages (UX-01/02, PA-01/02, integrated acceptance, UX03-A/B/C/D and release) are closed. No additional release or business-data change is required. Immutable allocation-change history remains deferred and is not an outstanding acceptance item. The unrelated five CRLF-only migration working-tree changes remain outside scope.

Closure review independently confirmed PRs #532, #533 and #534 merged, package.json on main at 6.5.1, and public/sw.js on main at hub-cache-v396. Publication and deployed asset verification evidence is recorded above; no new installer download or authenticated device test was executed by the closure reviewer.

## Publication procedure
Merge (squash) -> `electron-release-candidate.yml` on that main commit -> `publish-sasv-release.yml` (`version=6.5.1`, `build_run_id`, `installer_sha256`) -> verify tag, installer, ZIP, blockmap, `latest.yml`, `SHA256SUMS.txt`, Latest status and `node scripts/pec-release-provenance-check.mjs --url=<PWA host>` serving `hub-cache-v396`. Rollback: v6.5.0 remains available; client-only, read-only for allocations.

## Safeguard correction
`wp11-approved-delta.test.mjs` now exercises each approved transition (v393->v394, v394->v395, v395->v396) on fixed fixtures (`fixtures/sw-v393..v396.js`) instead of whatever `origin/main` currently is, with route, network-first, permission, cache-generation, extra-line and cross-generation mutations for every transition. No assertion was removed or skipped. The live working-tree-vs-main comparison is retained.
