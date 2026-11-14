# PEC operator acceptance package — execution record (14 November 2026)

Base: staging `633820aa96e102d989a3f3ea7dfc94c98688f5fd`. Issues #388, #399. No production record, role, SQL, `main` merge or Electron release was touched. Test sheet: `PEC_OPERATOR_ACCEPTANCE_TEST_SHEET_20261114.md`.

## What was executed (evidence, not inference)
| Item | Result | Evidence |
|---|---|---|
| Netlify/CI for base commit | PASS | deploy preview "ready" for `633820aa`; 10 workflow runs on that commit all success, incl. PEC R10 PG17, Integrated Browser Acceptance, PWA Cache Freshness |
| #399 strict checker fix | DONE (source), PASS | `scripts/pec-release-provenance-check.mjs` strips only Netlify's exact 4-line preview block (preview hosts only, HTML only, exactly once); new contract test covers production host, non-HTML, duplicate, altered and unrelated-drift cases |
| Served-asset provenance, preview host | **PASS** | checker exit 0, `netlifyPreviewInjectionStripped: true`; html, js, css, sw byte-identical; `CACHE_NAME` `hub-cache-v393` |
| Provenance, production host | FAIL (expected) | html/js/sw hashes differ, css HTTP 404: staging not promoted. Do not test there |
| New harness probe for the R10 preview | DONE (source) | `r10_preview_*` in the operator harness: nonexistent indent id 0, returns only HTTP/SQLSTATE/booleans; Editor/View-only expect "passed the permission gate", No-access expects denial |
| Operator-harness self-tests | PASS | `node --test` 17 pass / 0 fail (was 15: +#399 test, +preview-probe test) |
| Anonymous denial of preview RPC | PASS | HTTP 401, SQLSTATE 42501 (R10 execution report §5) |

## What was not executed
| Item | Status | Why |
|---|---|---|
| Editor / View-only / no-access browser sessions (E1–E5, V1–V6, N1–N3) | **BLOCKED** | The built-in browser holds no PEC session: opening the PEC page on the preview redirected to `/login.html` (404 on the web build). Claude does not sign in or handle credentials; each operator signs in personally. All rows stay NOT TESTED in the sheet |
| Direct signed-in RPC denials | NOT TESTED | need genuine sessions |
| Installed PWA online/offline freshness | NOT TESTED | no installed PWA/device reachable here |
| Windows packaged Electron parity | NOT TESTED | no packaged build/session run here |
| Functional writer tests, on-screen collision preview | NOT TESTED | no approved disposable draft fixture; 0 draft indents exist and approved indents are never fixtures |

## Notes and follow-ups
- Observation: a signed-out visit to the PEC page on the web build redirects to `/login.html`, which is not published there (the file lives outside `public/`). Operators must sign in through `/utilities-hub/` first (the harness does this). Not a release blocker; candidate small follow-up.
- #399 and #388 were **not** commented on by this run (`gh` is not authenticated on this machine); this record plus the commit are the update. The checker fix still needs review/merge through PR #347 as part of staging.
- Release blockers unchanged: any unauthorized access found by the operator runs; concurrency evidence is synthetic CI only; residual R-1/R-2/R-3 need explicit disposition; #400 open. G0–G5 remain unsigned.
