# WP09 G2 — corrected-head verification (PR #437)

**Result: all requested suites PASS on the corrected runtime. No merge, deploy, production-flag activation or migration touch. WP09 OPEN, programme 9/13.** All results are offline/mocked (stubbed Supabase, test-only auth), **not** authenticated production, live-role, installed-PWA, packaged-Electron or Windows acceptance.

## Pins

| | |
|---|---|
| Review head refreshed to | `9a26db7b8fd643d638583c1c8159ec7bc065bed0` (runtime code under test: identical to this head; `launcher-presentation.js` R1 fix, `hub-auth.js` R2 pending-identity isolation) |
| Authority / G1 head | `7584c0f04cae2b4a713a12fe46b2db1fac580835`; `main` `e5693623e71ae60d0d613498f4e76c99be7214ef` (no drift) |
| Test-only follow-up in this refresh | `e6782eff…` — retargets browser mutation M7 (see below); no runtime file changed after `9a26db7b` |

## Results

| Suite | Result |
|---|---|
| Generated contract check | PASS, 79 keys |
| **New independent-review suite** (`independent-review.test.mjs`, actual lifecycle + storage helpers) | **PASS 5/5** |
| G2 contract + 6 pure mutation controls | PASS 38/38 |
| G2 source/scope incl. new guard mutations | PASS 23/23 |
| **Extended G2 Chromium** (390/1280, both clients, ON/OFF, pending-permission and account-change cases, 5 browser mutation controls, 5 screenshots) | **PASS 87/87** (`corrected-head/g2-browser-results-87.json`, `corrected-head/screenshots/`) |
| **G1 flag-OFF Chromium** on the corrected code | **PASS 33/33** (`corrected-head/g1-flag-off-browser-results-33.json`) |
| G1 registry verifier / source-contract / mutation | PASS 21/21, 50/50, 22/22 |
| WP08 navigation source / resolver / SW freshness | PASS 13/13, 8/8, 15/15 |
| WP08 registry SQL | PASS 18/18 (PostgreSQL available in this session; reviewer's environment skipped 17) |
| WP08 `g2-0/source.test.mjs` | 11 PASS / **2 FAIL — unchanged documented historical baseline** (tests 11, 12) |
| WP08 fail-closed browser | NOT RE-RUN (no WP08 page/runtime touched; last 81/81) |
| Live roles, negative/view-only users, installed PWA, packaged Electron/Windows, hosted resolver, warmed/offline service-worker and old-controlling-worker behaviour | NOT TESTED — WP12 obligations (service-worker update/activation and stale importer/dependency combinations explicitly included) |

## One failure found and fixed (test-side)

First run on the corrected head: **86/87** — `M7 mutation 'stale pin reuse across users' is DETECTED` FAILED. Cause: the R2 hardening now resets the PWA tools scope to `"guest"` (`clearHubTools`) before every render, so the old mutant (stale scope assignment alone) can no longer leak pins — the defence became layered, the mutant became inert. **No runtime defect.** Fix (same branch/PR): the mutant now removes *both* the reset and the scope re-derivation, which does reproduce cross-user pin reuse and is detected; the control on the real code (M6) still passes. Re-run: 87/87.

Earlier author results (82/82 at `2b0f9a13`, screenshots under `WP09_G2_EVIDENCE/screenshots/`) are preserved unchanged; the corrected-head files are separate.

## Reproduce

```
node scripts/wp09-g2-launcher-presentation/independent-review.test.mjs
node scripts/wp09-g2-launcher-presentation/launcher-presentation.browser.test.mjs results.json ./shots   # ~8 min, expects 87
node scripts/wp09-g1-launcher-audit/launcher-browser.test.mjs                                            # expects 33/33
```
