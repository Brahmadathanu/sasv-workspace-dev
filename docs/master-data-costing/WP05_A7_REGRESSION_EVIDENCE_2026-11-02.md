# WP05-A7 — Regression evidence and exact reproducible commands (2 Nov 2026)

## Environment
* Cloud container, Linux 6.18, Node **v22.23.4**, Playwright **1.63.0** (global, Chromium `/opt/pw-browsers/chromium-1243`). No `node_modules` / `npm install` needed (tests import only repo files and `node:*`, Playwright for browser tests).
* No Supabase credentials, no network to Supabase, no production RPC; browser tests use in-memory mock backends.
* Source: **clean detached worktrees at `main` `3d0b6185f4351469cf23969beefac0e8875e0c2e`** (main did not move; verified via `git fetch` before and after).

## Commands

Test selection: every `*.test.*` under `scripts/` (26 files: 6 approval, 1 ccc-uxf1, 1 cost-sheet, 3 dialogs, 1 recalculation, 1 responsive, 3 review-worklist, 1 run-status, 1 run-status-screen, 1 scope-guard, 4 table-tools, 1 ux-consistency, 1 lib, 1 tally-etl-contract).

```bash
# LF worktree
git worktree add --detach <dir>/lf 3d0b6185f4351469cf23969beefac0e8875e0c2e
cd <dir>/lf && node --test $(find scripts -name "*.test.*" | sort)

# CRLF worktree (Windows-equivalent checkout)
git -c core.autocrlf=true -c core.eol=crlf worktree add --detach <dir>/crlf 3d0b6185f4351469cf23969beefac0e8875e0c2e
cd <dir>/crlf
export GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=core.autocrlf GIT_CONFIG_VALUE_0=true GIT_CONFIG_KEY_1=core.eol GIT_CONFIG_VALUE_1=crlf
git status --short            # must print nothing (clean) – otherwise git-diff based tests fail
node --test $(find scripts -name "*.test.*" | sort)
```
Per-package commands from the CW docs (e.g. `node --test scripts/costing-dialogs/*.test.mjs`) are subsets of the above.

## Results

| Run | tests | pass | fail | skipped | cancelled | duration |
|---|---|---|---|---|---|---|
| LF (main) | 408 | **408** | 0 | **0** | 0 | ≈256 s |
| CRLF (main), `autocrlf=true` applied persistently | 408 | **408** | 0 | **0** | 0 | ≈251 s |

* Browser (Chromium/Playwright) tests ran and passed, not skipped: responsive suite (six pages × 390/520/768/900/1280 px, focus visibility, compact header, popover, long chip — tests 196-208) and the CW-06 route-dialogs browser test. `skipped 0` confirms no silent skip.
* Composition: 390 Costing-suite tests + 18 in `scripts/lib` and `scripts/tally-etl-contract` = 408 (counted separately: lib+tally = 18/18).

### Discrepancy and incident (reported, not hidden)
1. **Baseline 393 vs 408 — unresolved.** The previously reported 393/393 (pre-merge PR head) does not equal the 408 observed over this file set (390 Costing + 18 lib/tally). No reproducible evidence was gathered to explain the 15-test difference (no per-test inventory of the earlier head was compared), so it is retained as an **unresolved comparison**. All 408 pass; this is not a claim of regression or of growth.
2. **First CRLF run: 400/408 (8 failures)** — tests 79, 91, 210, 219, 335, 344, 346, 354 (uxf1, review-worklist, table-tools pkg2/3/4). Cause was **my environment**: the worktree was created with `-c core.autocrlf=true` only at checkout time, so the later `git diff`/`git show` calls inside those tests (which compare against the LF blob) saw every CRLF line as changed (`git status` listed 494 modified files). After exporting the same setting persistently (clean `git status`), the identical suite is 408/408. This is **not a product defect** and the `read-source-lf` helper behaves as designed; but it is a documented trap for anyone reproducing CRLF runs: *apply autocrlf as repo/global config, not only at checkout*.

## Not run (limitations)
* **No global smoke, signed-in browser, or live PWA validation is claimed.**
* **Smoke scripts** (`scripts/*-smoke.mjs`, ~170 files incl. production-route and e-Aushadhi) were not run: the earlier reported baseline (42/57 on an older sandbox, with 15 e-Aushadhi/Node-21 dependency failures) is unverified on this `main`; no global-smoke claim is made.
* Signed-in/populated-data browser acceptance, live PWA version check and GitHub CI: not available/not claimed.
* No test touched production state; approval-preview RPC never called.
