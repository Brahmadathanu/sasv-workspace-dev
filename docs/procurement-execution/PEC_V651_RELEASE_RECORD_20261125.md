# SASV Workspace v6.5.1 — PEC Purchase Allocations mobile usability patch: release record

Previous stable: v6.5.0 (`a72af1e`), cache `hub-cache-v395`; both re-checked against live state before this release (unchanged by concurrent work). Target: v6.5.1, `hub-cache-v396`.

| Item | Reference |
|---|---|
| UX03 client implementation (squash-merged) | PR #532, `f7d2e6d` |
| Release PR #533: owner refinement (Summary pinned right, PEC chevron), version 6.5.1, `public/sw.js` cache v396, reviewed guard pin `REVIEWED_PEC_V651_PINS`, exact v395->v396 permit in `wp11-approved-delta.mjs`, cache-name pins, release notes | #533 (combined: the remote branch already carried the release prep and force-push is not permitted) |

Design, measurements (594 -> 276 px at 390x844) and evidence: `PEC_UX03_MOBILE_USABILITY_REFINEMENT_20261125.md`.

## Service-worker treatment
Only the cache generation advances (v395 -> v396). Network-first rules for `procurement-execution-console.js`, its CSS, `pec-modal-stack.js` and `pec-purchase-allocations.js` already exist and are unchanged; the console imports the lens module with a new `?v=20261125a`. The v6.5.0 guard pin remains and tolerates supersession; the v6.5.1 pin binds exact path, head branch and SHA-256.

## v6.5.0 publication evidence
v6.5.0 was published as stable Latest (tag `v6.5.0`, release verified by the publisher workflow); the owner never installed it separately, so owner acceptance is consolidated on v6.5.1.

## Not claimed
Authenticated PWA acceptance, real-device and Windows installation acceptance are owner-side.

## Publication procedure
Merge (squash) -> `electron-release-candidate.yml` on that main commit -> `publish-sasv-release.yml` (`version=6.5.1`, `build_run_id`, `installer_sha256`) -> verify tag, installer, ZIP, blockmap, `latest.yml`, `SHA256SUMS.txt`, Latest status and `node scripts/pec-release-provenance-check.mjs --url=<PWA host>` serving `hub-cache-v396`. Rollback: v6.5.0 remains available; client-only, read-only for allocations.

## Safeguard correction
`wp11-approved-delta.test.mjs` now exercises each approved transition (v393->v394, v394->v395, v395->v396) on fixed fixtures (`fixtures/sw-v393..v396.js`) instead of whatever `origin/main` currently is, with route, network-first, permission, cache-generation, extra-line and cross-generation mutations for every transition. No assertion was removed or skipped. The live working-tree-vs-main comparison is retained.
