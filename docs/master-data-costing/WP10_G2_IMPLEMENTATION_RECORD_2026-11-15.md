# WP10 G2 — Implementation record (draft; independent review pending)

Authority: issue #440 and `WP10_G2_SINGLE_DRAFT_IMPLEMENTATION_PACKAGE_2026-11-15.md`; owner decisions O1–O5 as recorded in `WP10_OWNER_G1_ACCEPTANCE_G2_DRAFT_AUTHORITY_2026-11-15.md`.
Base: `origin/main` 6b7eb45f9aaab89a8916740f70caa7375499570d. Branch `claude/wp10-g2-safeguards`. One draft PR. **Not merged, not deployed, no flag activated, no production SQL, no formal WP10 closure. Programme stays 10/13.**

## What was delivered
| # | Package item | Delivered | Where |
|---|---|---|---|
| 1 | Readiness lens distinguishes STALE / ABSENT / INCOMPLETE / valuation-missing / auth / permission / timeout / transport / unknown; names governed period, owner accountability and the manual runbook; no auto rebuild/retry | Yes (flag-gated). **No new RPC**: the existing portfolio read already raises `READINESS_BUILD_STALE/ABSENT/INCOMPLETE` in its error message | `wp10-safeguards.js` (`classifyReadinessError`, `readinessStateModel`), `wp10-safeguards-ui.js` (`readinessUnavailableHtml`), hooks in `costing-suite-readiness.js` |
| 2 | Manage Products activation pre-check using existing `rpc_get_sku_activation_check`; missing items + owner screens; verified links only; safe structured rejection; stale/cancel/selection/unavailable/ambiguous-PM-BOM/TOCTOU handled; server authoritative, no bypass | Yes (flag-gated) | `products.js` (`toggleSkuActive`, `promptGovernance({onOpen})`), `wp10-safeguards*.js` |
| 3 | Operational 30-day horizon from date-aware canonical resolvers + reviewed batch-size contract; separate from governed LIVE_AS_OF and the helper's `greatest(valuation, IST today)`; date basis stated; every in-window boundary inspected (gaps/overlaps that recover; inclusive `effective_to`); bounded paging; fail-closed unknown; no parallel readiness system | Server proposal UNAPPLIED (01–03); client panel inert until the RPC exists AND the flag is on | `supabase/draft-proposals/wp10-g2-unapplied/`, `mountOperationalHorizonPanel` |
| 4 | Re-parent and product-change safeguards | UNAPPLIED proposals 04 (active SKU re-parent) and 05 (route-changing subgroup edit that newly breaks an active SKU's route; not a blanket block) | same directory |
| 5 | Product-without-SKU / no-active-SKU visibility | Existing Membership Exceptions surface (`NO_SKU`, `ACTIVE_WITHOUT_ACTIVE_SKU`) is kept and documented in the runbook; no historical count is presented as current; no new surface | runbook §4 |
| 6 | SQL unapplied, outside migrations, closure/rollback/grants recorded; client inert without absent RPCs | Yes | `README.md`, `99_rollback_all.sql` |
| 7 | Short operator runbook | Yes | `WP10_G2_OPERATOR_RUNBOOK_2026-11-15.md` |

## Diff scope
Client: `public/shared/js/products.js` (+103, flag-gated), `costing-suite-readiness.js` (+63/−5, flag-gated hooks), new `wp10-safeguards.js`, `wp10-safeguards-ui.js`.
Tests: `scripts/wp10-g2-safeguards/*` (6 files). Two historical WP08 surface pins (`wp08-g2-0…/source.test.mjs`, `wp08-g2-1…/source.test.mjs`) were widened by exactly one allowance: the single new read-only `rpc_get_sku_activation_check` call in `products.js` (pinned again by WP10 `source.test.mjs` S9).
Docs/evidence: this record, runbook, SQL README, `WP10_G2_EVIDENCE/`, `WP-10-FUTURE-CREATION-SAFEGUARDS.md` update.
**Untouched:** `public/sw.js`, `manage-products.html`, launcher/registry/hub-auth, all `supabase/migrations` (including the five CRLF-only `20261112*` differences, which remain unstaged and unchanged), e-Aushadhi, Electron routing, permission targets.

## Key design decisions
- **Flag `WP10_SAFEGUARDS_V1`** (localStorage exact `"1"`, default OFF, never set by shipped code). Helper modules load by dynamic `import()` only when ON, so flag-off behaviour is unchanged and a missing/stale module cannot break either screen (tested: P9, R2). Rollback = `removeItem`.
- **No service-worker change** (its bytes are pinned by WP09). Consequence: a PWA client with an old cached shell may not fetch the new modules until its normal cache refresh; with the flag ON that case degrades to today's behaviour. Pre-deploy cache handling is an operational prerequisite (below).
- **Server stays authoritative.** The pre-check never gates, never disables Confirm and never claims success; a complete pre-check is shown as advisory (“does not guarantee activation”). Rejections are rendered from structured fields via `textContent` only; unknown codes are shown with sanitised text and no link.
- **Owner links only where already verified** (PM BOM by SKU, Production Route by product). Batch size / MRP / selling policy show the screen name only (WP08 left these unmapped).
- **Horizon date basis** = today's IST date, then every boundary (`effective_from`, `effective_to + 1`) in `(today, today+N]`; amounts are not evaluated; route boundaries cover captured tables only; both statements are rendered on screen.
- **Guards** (04/05) reject only the two precise conditions and *allow on evaluation error* (unknown never blocks master-data edits; detection layers remain: epoch → STALE, horizon).
- Found and fixed by the tests: the Manage Products result host was initially placed inside a hidden readiness surface; a `set_config` key with dots+ids was invalid in proposal 05 (now `wp10.rv_<id>`); a surviving mutant for “route already invalid” led to an added probe.

## Verification (fresh run, this branch; mocked / isolated only — not live-role acceptance)
| Suite | Result |
|---|---|
| WP10 G2 horizon fixture (isolated PostgreSQL) | 32 PASS / 0 FAIL |
| WP10 G2 guards fixture + mutation controls | 23 PASS / 0 FAIL |
| WP10 G2 draft-SQL static test | 13 PASS, 1 NOT PROVEN (S14: route-validation callee tables uncaptured) |
| WP10 G2 source/safety | 9 / 9 pass |
| WP10 G2 mocked Chromium, Manage Products (390 and 1280, flag off/on, race/cancel/stale, TOCTOU, hostile text, module-load failure, mutation control M1) | 13 / 13 pass |
| WP10 G2 mocked Chromium, Readiness lens + horizon (390 and 1280; STALE/ABSENT/INCOMPLETE/PERMISSION/TRANSPORT; horizon ok/missing/transport/malformed; flag off) | 17 / 17 pass |
| Screenshots | `WP10_G2_EVIDENCE/screenshots/` (9 images, 390 and 1280) |
| G1 baselines (preserved) | transition fixture 56 PASS; mutation controls M0 + 8 MU PASS; catalog parity 5 NOT PROVEN preserved; client-contract 19 PASS + 1 FAIL (B1), **identical to `origin/main`** |
| Readiness usability | 21 / 21 |
| WP04 readiness client smoke | passed |
| Product/SKU lifecycle smoke | 100 PASS / 2 known FAIL (hub-cache generation, route-URL) — baseline preserved |
| WP08 G2-0 fail-closed 81/81; sw-freshness 15/15; G2-1 selection 8/8, resolver 8/8, source 13/13, browser 44 pass / 0 fail of 45; G2-0 browser 46 pass / 0 fail of 48 | pass |
| WP08 G2-0 source | 11 pass / 2 fail — the same two failures exist on `origin/main` (diff-vs-historical-base tests 11 and 12); not caused by this package |
| WP09 sw pin, PEC protected-path guard, PEC cache freshness 13/13 | pass |
Raw counts: `WP10_G2_EVIDENCE/results/`. **SKIPPED: none.** **NOT TESTED:** live-role behaviour, the real database (proposals never applied), the production writer/preview/build functions (never called by design), real PWA cache rollover.

## Production / contract prerequisites (none executed)
1. Separate exact approval to apply proposals 01–03 (and later 04/05) to a named database after confirming the live definitions of the five dependency functions (SQL README, catalog questions file).
2. Owner decision on the **unresolved contracts**: O3-U1 amount sanity; O3-U2 route boundary coverage beyond captured tables; O4-U1 read-only impact preview for subgroup edits; O4-U2 override/exception workflow for guard rejections.
3. PWA cache refresh path for clients before the flag is trialled.
4. Named operator nomination (programme owner accountable meanwhile).

## Remaining owner decisions
Review/approve this draft; decide the four unresolved contracts above; decide whether and when proposals 04/05 (blocking guards) are wanted at all given privileged-writer-only reach; authorise any production step separately; formal WP10 closure (separate).

## Rollback
Client: remove `WP10_SAFEGUARDS_V1` from localStorage (instant, per browser); revert the PR (flag-off paths are unchanged, so revert is also safe). SQL: nothing applied; if later applied, `99_rollback_all.sql` removes every created object without touching data.
