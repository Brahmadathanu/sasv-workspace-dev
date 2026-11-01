# WP-07 final regression recovery — evidence

Test-harness only. No production code, SQL, migration, RLS/RPC, cache version, flag, Portal Save/Submit, four-eyes,
Product 262 or B2 worker change. Nothing was deployed, merged or written to production.

| | |
|---|---|
| Evidence baseline (original failed run) | `17fb8c2e74fd163d7bdb2886cce7b44ae92e9b54` (PR #122 head) |
| Working base | `origin/main` `c3ce888d974a3ee987333ab762c99324fcd7887e` (squash of PR #120) |
| Correction commit | `c87a86f10606dad8a25b0cf7f0f0d817405a2c14` (code); this evidence is a second docs-only commit |
| Node | v22.23.4 (Linux). Windows was **simulated**, see "How Windows was reproduced" |

## 1. Branch relationships (checked 1 Nov 2026)

* `main` (`c3ce888`) is a **squash** of PR #120. Its tree is byte-identical to `merge-prep/wp07` (`f1e63b5`), but the
  history is unrelated (merge base of `17fb8c2` and `main` is `cfab901`).
* `17fb8c2` = `merge-prep/wp07` tree + 20 WP-07 migration/doc files (3,405 insertions, nothing else).
* PR #122 still targets `merge-prep/wp07`; a plain merge with `main` shows add/add conflicts although the content is the
  same. **PR #122 needs a retarget/rebase onto `main` before it can land** (not done here).
* This package was cut from `main`. It cherry-picks onto `17fb8c2` cleanly with an identical diff, and merges cleanly
  with PR #123 (cache v390 pins, `release/costing-uxf1-cache-v390`).
* No Costing branch already contains a fix for any of these failures (all other differences are branches that are simply
  behind `main`).

## 2. How Windows was reproduced

No terminal logs were attached to the task, so nothing was copied from them. The reported counts were reproduced instead:

| Condition | How |
|---|---|
| CRLF working tree + `core.autocrlf=true` | `git -c core.autocrlf=true checkout -f <sha>` in a separate worktree, and `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.autocrlf GIT_CONFIG_VALUE_0=true` for every child `git` call the tests make |
| Path with a space / URL-encoding | worktree at `".../dir with space"` (Linux analogue of `D:\ELECTRON PROJECTS\...`) |
| Chromium for UX smokes | `UX6_BROWSER_PATH=UX7_BROWSER_PATH=UX91_BROWSER_PATH=UX10_BROWSER_PATH=/opt/pw-browsers/chromium` |
| Electron packaging proof | `npx electron-builder --dir --linux --publish never -c.directories.output=dist-eaushadhi-wp07-validation`, then `EAUSHADHI_PACK_DIST=dist-eaushadhi-wp07-validation` (ignored/untracked artifact, not committed) |
| Dependencies | `npm ci --ignore-scripts` |

## 3. Root causes (each reproduced before the fix)

| # | Family | Baseline reproduction | Root cause (proven) | Real product regression? |
|---|---|---|---|---|
| A | Costing review worklist `review-worklist.test.mjs` | CRLF+autocrlf: **11 tests, 1 pass, 10 fail** (LF: 11/11) | `read()` returns CRLF working-tree text; extraction (`indexOf("\nfunction …")`), literal `"…\n"` fragments and comparison with `git show` (always LF) cannot match | No — outdated Windows assumption |
| B | Costing UX-F1 `uxf1.test.mjs` | CRLF+autocrlf: **20 tests, 9 pass, 11 fail** (LF: 20/20) | Same; `renderCccRunContextChrome`/`renderReviewWorklistPanel` "not found" is the `\nfunction` extraction missing | No |
| B2 | Same family, not in the original list | CRLF+autocrlf: `run-context` 7/10, `run-selection` 3/18, `table-tools` 12/23, `-pkg2` 1/9, `-pkg3` 2/11, `-pkg4` 0/8 | Same `read()` pattern, plus direct `fs.readFileSync(...).startsWith(cssBase)` in pkg3/pkg4 | No |
| C | Costing scope guard `scope-guard.test.mjs` | Space in checkout path: **28 tests, 27 pass, 1 fail** (`ENOENT …/dir%20with%20space/…`) | `new URL(import.meta.url).pathname` is a URL path, not a file path: keeps `%20`, and on Windows yields `/D:/…` which `path.resolve` turns into `D:\D:\…` | No |
| D | QC report-upload smoke | **fails on LF too**, 176 assertions OK then `ReferenceError: resolveReturnFocus is not defined`; **passes at `cfab901`** | WP-07 UX-5.1 (PR #120) made production `openQcConfirm` call a new helper `resolveReturnFocus`; the smoke builds `openQcConfirm` with `new Function` from extracted source and never extracted the helper. Once fixed, the fake key event also lacked `stopImmediatePropagation` (production handler calls it). On CRLF the pinned edge-function size/sha256 (4592 bytes) hashes CRLF bytes | No — fixture lagged a delivered WP-07 change |
| E1 | Worker first-entry capture smoke | fails on LF (also at `cfab901`): `FAIL no QC` | Assertion scanned the whole renderer control file, which has held the delivered QC Register UI (1,813 QC references) since WP-07 S2C; worker `dry-run.js` and `capture/*.js` have none | No — assertion scope outdated |
| E2 | Worker packaging smoke | `FAIL dist/ exists after electron-builder --dir` | Needs a separately produced `electron-builder --dir` artifact | No — build prerequisite |
| E3 | Two legacy PRM smokes (`production-route-product-delta-authoring`, `-subgroup-mappings`) | pass on LF, fail on CRLF | Same `\n`-anchored source pattern | No |

### How Windows-only was ruled out as the sole cause
Windows/CRLF explains A, B, B2, C, E3 and the CRLF part of D. It does **not** explain D (LF failure), E1 (LF failure) or
E2 (missing artifact), and none of the 63 remaining failures in section 6.

## 4. Corrections (15 files, +98/−21, tests/scripts only)

* **New** `scripts/lib/read-source-lf.mjs` (+ `read-source-lf.test.mjs`, 3 tests): rewrites only `CR LF` → `LF`.
  Lone CR, tabs, trailing spaces and any content change survive; negative controls are in the test.
* `read()` in 8 Costing suites and 2 legacy PRM smokes now uses it; the two direct CSS `startsWith(cssBase)` reads in
  `table-tools-pkg3/4` go through `read()` (same assertion).
* `scope-guard.test.mjs`: `fileURLToPath(import.meta.url)`.
* `eaushadhi-qc-report-upload-smoke.mjs`: extract the real `resolveReturnFocus` (two fixtures), add
  `stopImmediatePropagation` to the fake event, undo only CRLF (byte-exact, latin1) before the unchanged size/sha256 pins.
* `eaushadhi-worker-first-entry-capture-smoke.mjs`: "no QC" now covers `dry-run.js` **and every `capture/*.js`**
  (new assertion proves ≥10 modules including `index.js` are scanned); renderer control file and worker `index.js`
  (QC report upload wiring) are excluded because they legitimately contain QC.
* Not changed: any `public/`, `electron/`, `supabase/`, `sw.js`, `.gitattributes`, `package.json`.

## 5. Before / after (same commands, `node --test <file>`: tests / pass / fail)

| File | Base LF | Base CRLF | Corrected LF | Corrected CRLF |
|---|---|---|---|---|
| costing-review-worklist/review-worklist | 11/11/0 | 11/1/10 | 11/11/0 | 11/11/0 |
| costing-ccc-uxf1/uxf1 | 20/20/0 | 20/9/11 | 20/20/0 | 20/20/0 |
| costing-scope-guard/scope-guard | 28/28/0 | 28/28/0 (27/28 with space in path) | 28/28/0 | 28/28/0 (28/28 with space) |
| costing-review-worklist/run-context | 10/10/0 | 10/7/3 | 10/10/0 | 10/10/0 |
| costing-review-worklist/run-selection | 18/18/0 | 18/3/15 | 18/18/0 | 18/18/0 |
| costing-table-tools/table-tools | 23/23/0 | 23/12/11 | 23/23/0 | 23/23/0 |
| costing-table-tools/table-tools-pkg2 | 9/9/0 | 9/1/8 | 9/9/0 | 9/9/0 |
| costing-table-tools/table-tools-pkg3 | 11/11/0 | 11/2/9 | 11/11/0 | 11/11/0 |
| costing-table-tools/table-tools-pkg4 | 8/8/0 | 8/0/8 | 8/8/0 | 8/8/0 |
| eaushadhi-qc-report-upload-smoke | 1/0/1 (176 OK, then crash) | 1/0/1 | 1/1/0 (232 OK) | 1/1/0 (232 OK) |
| eaushadhi-worker-first-entry-capture-smoke | 1/0/1 | 1/0/1 | 1/1/0 | 1/1/0 |
| production-route-product-delta-authoring-smoke | 1/1/0 | 1/0/1 | 1/1/0 | 1/1/0 |
| production-route-subgroup-mappings-smoke | 1/1/0 | 1/0/1 | 1/1/0 | 1/1/0 |
| lib/read-source-lf.test (new) | — | — | 3/3/0 | 3/3/0 |

Full inventory (every `scripts/*smoke*.mjs` + every tracked `scripts/**/*.test.mjs`, run per file):

| Run | Files | Exit 0 | Non-zero |
|---|---|---|---|
| `cfab901` (pre-WP-07 main), LF | 166 | 100 | 66 |
| `17fb8c2` baseline, LF, browser env set | 179 | 113 | 66 |
| `17fb8c2` baseline, CRLF+autocrlf, browser env set | 179 | 104 | 75 |
| **`c87a86f` corrected, LF** | 180 | **117** | 63 |
| **`c87a86f` corrected, CRLF+autocrlf** | 180 | **117** | 63 |

Without the browser env vars the 6 browser UX smokes fail immediately (`Set UXn_BROWSER_PATH…`); that is a
prerequisite, not a defect. The original "71 files / 52 passed / 19 failed" file selection was not supplied, so the
superset is reported; raw per-file results are the `*.tsv` files in this folder (`file tests pass fail exit seconds`).

Groups in the corrected run: e-Aushadhi UX-1…UX-10 smokes 12/12; QC preparation + report upload + B5 12/12;
worker (incl. capture, IPC, packaging) 19/19; other e-Aushadhi 8/8; Costing `*.test.mjs` and costing smokes 20/20;
WP-04 1/1; pricing 1/1; PEC 5/5; every other failing file in the run is one of the 63 in section 6.

## 6. Unresolved: 63 pre-existing failures (identical set fails at `cfab901`, before any WP-07 work)

None is introduced or touched by this package (`comm` of failures vs `cfab901`: no new failure).

* **46 files**: every failing assertion is a historical cache-version pin (`SW bumped once to hub-cache-v299/v307/v318/v331…`)
  or a "current generation is v331" check. They cannot pass on any later cache version by design.
  See `legacy-failures-cache-pin-only.txt`.
* **17 files** with at least one non-cache assertion (Production Route Manager UI/structure, `ppm-n6-nav-resolver`,
  `sku-control-main-table-density` (also pins v250), `supply-batch-size-rpc-cutover` ("PRM inventory remains 54")).
  Bisecting the first-parent history of `main` shows they **already fail at the earliest available first-parent commit
  (`0d00477`, 9 Oct 2026)**, i.e. long before WP-07 UX and the recent Costing PRs.
  See `legacy-failures-other.txt`, `legacy-failures-first-bad-commit.txt`.

These are *outdated assumptions in legacy Production-Route / Costing gate smokes*. They were deliberately not edited:
fixing them means re-pinning or retiring Costing-owned gates, which needs a Costing owner decision. Not claimed as passing.

## 7. Safety assertions preserved

The complete set of removed assertion lines in the diff is: the `sasv-costing.css … startsWith(cssBase)` check in
table-tools pkg3/pkg4 (re-issued unchanged through `read()`), and `no QC` (re-issued scoped, see 4). No test was
skipped, removed or made unconditional. Costing scope guard (28 tests incl. negative controls) and the sw.js line-2 /
v389 checks, CSS append-only checks, protected-file `git diff` checks are untouched and green on LF and CRLF.
Tamper negative controls: changing one byte of the edge function still fails its sha256 on a CRLF tree
(`FAIL edge function sha256 matches`); the helper test proves a real content change is not hidden by EOL normalisation.

## 8. Observations (not changed)

* `scripts/migration-drift-check.mjs:33` has the same `new URL(import.meta.url).pathname` defect as finding C
  (a Windows/space-path bug in a CI/ops script; not a test, so left for a separate decision).
* If the Windows checkout has CRLF files **and** `core.autocrlf=false`, the Costing "diff against base" tests still
  see every line as changed (`git diff` is not EOL-aware). Supported condition is `autocrlf=true` (git default on Windows).
  A repo-wide `.gitattributes` EOL policy would remove the whole class but touches every workstream and was not done here.

## 9. Reproduce

```bash
npm ci --ignore-scripts
export UX6_BROWSER_PATH=<chromium> UX7_BROWSER_PATH=<chromium> UX91_BROWSER_PATH=<chromium> UX10_BROWSER_PATH=<chromium>
npx electron-builder --dir --linux --publish never -c.directories.output=dist-eaushadhi-wp07-validation
export EAUSHADHI_PACK_DIST=dist-eaushadhi-wp07-validation
node --test scripts/costing-review-worklist/review-worklist.test.mjs scripts/costing-ccc-uxf1/uxf1.test.mjs \
  scripts/costing-scope-guard/scope-guard.test.mjs scripts/eaushadhi-qc-report-upload-smoke.mjs
bash docs/eaushadhi/wp07/regression-recovery/run-inventory.sh "$PWD" out.tsv          # LF
bash docs/eaushadhi/wp07/regression-recovery/run-inventory.sh "$PWD" out.tsv crlf     # Windows-like git behaviour
```

## 10. Reconciliation with `origin/main` `74441b9` (Costing v390 release, PR #123)

* Merge of `74441b9` into PR #124. 8 Costing test files conflicted only on the `read()` line (and the CSS
  append-only `startsWith(cssBase)` line in table-tools pkg3/pkg4): main had independently added an inline
  `.replace(/\r\n/g, "\n")`. Resolved by keeping the shared `readSourceLf` helper (identical semantics); all v390
  expectations from main (`hub-cache-v390`, "release cache line is v390", "no stale cache line added", the
  v388/389/390 sw.js diff allowance in the UX-F1 scope test) are kept verbatim.
* `scope-guard.test.mjs`: main already carried the same `fileURLToPath` fix; the file is identical to main.
* `public/`, `electron/`, `supabase/`, `sw.js`: zero diff against main.
* Finding: seven WP-07 UX smokes (`ux1, ux3, ux5, ux6-layout, ux61-card-colours, ux62-controls, ux7`) still pinned
  `hub-cache-v389` and **fail on `main@74441b9` itself** (PR #123 missed them). Pins updated to v390 in a separate
  commit. `ux3`/`ux5` contained a literal `!/hub-cache-v390/` guard; it now reads `!/hub-cache-v391/`, i.e. the
  "no unplanned further bump" intent is kept, shifted past the owner-coordinated v390 release. **Owner to confirm**
  this reading; the commit can be dropped independently.
