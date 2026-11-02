# Costing client hardening: integration verification (CW-06, CW-13, CW-07)

Integration-only. Nothing was merged, deployed, written to a database or activated. The three PRs are untouched.

| Item | PR | Head verified | Owner status |
|---|---|---|---|
| CW-06 in-page Production Route dialogs (`COSTING_DIALOGS_V1`, default OFF) | #126 | `151cb615` | mock-browser acceptance evidence accepted; Production Route navigation defects deferred |
| CW-13 responsive hardening + compact mobile header | #127 | `bc60bf78` | accepted in the browser |
| CW-07 "Cost Sheet Review" terminology | #128 | `4f27cd06` | client terminology accepted; Home label is database-sourced (separate governed metadata change) |

Baseline: `main` `28cfadb20de3e2f3daf0aadada096f541254819d`. Integration branch: `integration/costing-cw06-cw13-cw07` (merge order #126, #127, #128, then one test-only reconciliation commit).

## Deferred, not blocking (pre-existing on main, flag on or off)
1. **Historical Candidate Review controls are invisible.** `renderCandidates()` in `costing-suite-production-route.js` writes the family / Product Groups (Mode B) / Product selectors and the four Preview buttons into `#workbenchSummary`, which stays `display: none` unless `is-visible` is added. Mode B cannot be selected, so the Create button cannot appear.
2. **Create Manufacturing Route Family cannot write from that lens.** It sends only `{ route_family_name }`; `buildCreateRouteFamilyArgs` requires `p_family_code`, so the request is rejected client-side with "p_family_code is required" (native prompt and in-page dialog alike). The supported create path is the Route Families lens modal.
Neither is changed by these PRs; revealing the controls changes production behaviour and a family code is a governance decision. Decision needed before CW-06 can be accepted end to end in the live app.

## Conflicts resolved
- **Textual:** none in any pair or in the three-way merge (`git merge-tree` and the real merge). `review-worklist.test.mjs`, the other Costing historical tests and `costing-scope-guard.mjs` were edited by more than one PR in different regions and auto-merged.
- **Semantic (one):** CW-13's test "freshness indicator retired by CSS only" asserted the shell equals the `28cfadb` baseline; CW-07 deliberately renames one toast string in the shell. Reconciled in `scripts/costing-responsive/responsive.test.mjs` by comparing against `applyCw07Labels(baseShell)` (CW-07's own helper), so the shell may differ from the baseline by exactly that rename and nothing else. The assertion is not weakened. Pairwise results before the fix: #126+#127 385/385, #126+#128 370/370, #127+#128 358/359 (this one test).
- No assertion was removed, skipped or loosened anywhere; test counts add up (328 baseline + 34 CW-06 + 23 CW-13 + 8 CW-07 = 393).

## Verified on the integration branch
See the integration report for totals. Contracts: the multiset of `rpc_*` / `costingRpc` / `get_user_permissions` references across `public/shared/js` is identical to `main`; no `.rpc(`, `.from(` or `supabase.` line is added; `costing-feature-flags.js`, `permission`/`appAuth` code, `public/sw.js` (`hub-cache-v390`), `supabase/` (the protected `20261015045233_ppm_inactive_sku_mrp_policy_governance.sql` hash is identical), `package.json` and all WP-07 / e-Aushadhi files are unchanged. Costing HTML changes: only the `<title>`, `<h1>` and subtitle of `cost-sheet-review.html`.

## Recommended safe merge sequence (owner authorisation required for each step)
1. **#126** (additive new module + two flag-gated branches; flag stays OFF). Merge, rerun the Costing suite on the new `main`.
2. **#127** (CSS + one new JS module + additive `data-*` helper; no shell or HTML change). Merge `main` into the branch first if GitHub reports it behind; expect no conflicts; rerun the suite.
3. **#128** (label rename). Before merging, merge latest `main` into the branch **and apply the one-line reconciliation** in `scripts/costing-responsive/responsive.test.mjs` (commit on the integration branch; cherry-pick it onto #128). Without it, the combined suite has exactly one failing test.
Alternative: merge the integration branch itself after review (one merge commit, same content).
Independent of the sequence: the Home-page label needs the separate governed `app_modules` metadata update (outside this repository's client code).

## Owner acceptance commands (Windows CMD, repo root)
```
node --test scripts\costing-approval scripts\costing-ccc-uxf1 scripts\costing-cost-sheet scripts\costing-dialogs scripts\costing-recalculation scripts\costing-responsive scripts\costing-review-worklist scripts\costing-run-status scripts\costing-run-status-screen scripts\costing-scope-guard scripts\costing-table-tools scripts\costing-ux-consistency scripts\lib
```
(Node treats directory arguments as modules on some versions; if so, pass the `*.test.mjs` files explicitly.) Browser tests need Playwright (chromium) and skip cleanly without it; `COSTING_RESPONSIVE_SKIP=1` and `COSTING_DIALOGS_BROWSER_SKIP=1` skip them explicitly.
