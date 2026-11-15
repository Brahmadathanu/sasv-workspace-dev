> **SUBSEQUENT OWNER DECISION:** #441 source merged normally at `a3816a3f` under explicit approval, with default-off flag and SQL unapplied. [Approval, final-head evidence and remaining gates](WP10_OWNER_G2_DEFAULT_OFF_SOURCE_MERGE_AND_REMAINING_GATES_2026-11-15.md) supersede any earlier source-merge prohibition or pending state below for #441 only. Preview, production application and formal closure remain open; 10/13.

> **LATEST:** [Independent CI verification and bounded source-merge recommendation](WP10_G2_CI_VERIFICATION_AND_MERGE_RECOMMENDATION_2026-11-15.md) records 199 fresh offline PASS (including 51 Chromium and 99 PostgreSQL checks) at `9f28f05b`. This supersedes the earlier local-environment browser/PG limitation and pending-rerun status below. Impact preview is contract-only, not implemented; SQL remains unapplied, flag OFF, owner merge decision pending. WP10 OPEN, 10/13.

# WP10 G2 — Implementation record (draft; independent review R1–R7 addressed in this same PR)

Authority: issue #440 and `WP10_G2_SINGLE_DRAFT_IMPLEMENTATION_PACKAGE_2026-11-15.md`; owner decisions O1–O5 as recorded in `WP10_OWNER_G1_ACCEPTANCE_G2_DRAFT_AUTHORITY_2026-11-15.md`.
Base: `origin/main` 6b7eb45f9aaab89a8916740f70caa7375499570d. Branch `claude/wp10-g2-safeguards`. One draft PR. **Not merged, not deployed, no flag activated, no production SQL, no formal WP10 closure. Programme stays 10/13.**

> **Current independent review:** [corrected-source review](WP10_G2_CORRECTED_SOURCE_REVIEW_2026-11-15.md) accepts the R1–R7 source corrections and records an additional client/SQL cursor-contract fix. Fresh reviewer units are 14/14; focused Chromium rerun is pending.

## Historical first delivery (3e5c63d2; superseded by the follow-up below)

The original choices, unresolved-contract list, counts and rollback description in this section are historical. In particular, allow-on-error, partial route closure, amount/override decisions and unconditional rollback statements were superseded.

### What was delivered
| # | Package item | Delivered | Where |
|---|---|---|---|
| 1 | Readiness lens distinguishes STALE / ABSENT / INCOMPLETE / valuation-missing / auth / permission / timeout / transport / unknown; names governed period, owner accountability and the manual runbook; no auto rebuild/retry | Yes (flag-gated). **No new RPC**: the existing portfolio read already raises `READINESS_BUILD_STALE/ABSENT/INCOMPLETE` in its error message | `wp10-safeguards.js` (`classifyReadinessError`, `readinessStateModel`), `wp10-safeguards-ui.js` (`readinessUnavailableHtml`), hooks in `costing-suite-readiness.js` |
| 2 | Manage Products activation pre-check using existing `rpc_get_sku_activation_check`; missing items + owner screens; verified links only; safe structured rejection; stale/cancel/selection/unavailable/ambiguous-PM-BOM/TOCTOU handled; server authoritative, no bypass | Yes (flag-gated) | `products.js` (`toggleSkuActive`, `promptGovernance({onOpen})`), `wp10-safeguards*.js` |
| 3 | Operational 30-day horizon from date-aware canonical resolvers + reviewed batch-size contract; separate from governed LIVE_AS_OF and the helper's `greatest(valuation, IST today)`; date basis stated; every in-window boundary inspected (gaps/overlaps that recover; inclusive `effective_to`); bounded paging; fail-closed unknown; no parallel readiness system | Server proposal UNAPPLIED (01–03); client panel inert until the RPC exists AND the flag is on | `docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/`, `mountOperationalHorizonPanel` |
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

---

# Follow-up: independent review R1–R7 (same PR #441, base `6b7eb45f`, reviewed head `889332e3`)
Source: `WP10_G2_INDEPENDENT_REVIEW_2026-11-15.md` and `WP10_G2_EVIDENCE/independent-route-callee-catalog-2026-11-15.json`. Semantics preserved: governed-period LIVE_AS_OF, CI-038a, the five essentials, canonical resolution (no amount policy), no override, no new permission target/writer, SQL unapplied. **Location change (CI-driven):** the SQL proposals moved from `supabase/draft-proposals/wp10-g2-unapplied/` to `docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/` because the PEC protected-path guard (`scripts/lib/pec-protected-path-guard.mjs`, run by `integrated-pec` CI) rejects **every** `supabase/` path and `integrated-pec` failed on the previous head for exactly that reason (`FAIL: no unauthorized new SQL/SW paths (supabase/draft-proposals/...)`). I did **not** weaken that guard (an attempt to add a narrow exemption was refused by the permission check and was not applied). The directory is still outside `supabase/migrations`, still labelled UNAPPLIED, and no tool reads it.

| ID | Resolution | Evidence |
|---|---|---|
| R1 | Proposal 05 no longer allows unknown. Three-valued before/after (valid/invalid/unknown; error or malformed result = unknown). Rejected: valid→invalid (`WP10_PRODUCT_ROUTE_IMPACT`) and any case where impact is not provable (`WP10_PRODUCT_ROUTE_IMPACT_UNRESOLVED`, review required, distinct reason): after-error, before-error+invalid, malformed, both-error, invalid→malformed, **missing BEFORE receipt**. Preserved: valid→valid, invalid→invalid, before-error+valid-after, no active SKU, non-subgroup edits. No override. Rejection rolls back the product row and `product_master_audit` row. | guards P4.1–P4.11, P6.1 (live chain, ambiguous product route), P7.1/P7.2 (two-session concurrency: second writer blocks on the row lock and evaluates against the first's committed state), mutants M3–M6 incl. "unknown treated as safe" |
| R2 | Route closure proven from the callee catalog: the validators take no date, so validity changes only when a **selector** window changes the selected family/family-route/product-route. Boundary scan now includes product routes (APPROVED) and family routes (APPROVED+SUPERSEDED) besides maps and families; each boundary is evaluated by the **real validator**; AMBIGUOUS_APPROVED_PRODUCT_ROUTE is reported as AMBIGUOUS. Context `route_boundary_coverage: COMPLETE`. The fixtures now run the verbatim live route chain (5 callees + validator); only tables are labelled stand-ins. | horizon H17.1–H17.8 (family gap, product route invalid from a date, overlap, replacement, gap-while-inherited, SUPERSEDED), mutants H16.x (product-route windows dropped, route ambiguity→UNKNOWN, SUPERSEDED dropped), static S14–S17 |
| R3 | `toggleSkuActive` split into a reservation wrapper + inner flow: reserved before any await, released in `finally`; SKU/product/rights/draft/state revalidated after the import, for the pre-check (including its catch path) and **immediately before the writer**; result/detail tied to SKU identity and cleared on selection change; no new writer. | browser R3.1–R3.7, mutation controls M2 (no serialization) and M3 (no revalidation) |
| R4 | `validateHorizonEnvelope` now enforces positive-integral ids, strictly ascending non-duplicate rows past the sent cursor, cursor presence and strict advance when `has_more`, no cursor on the last page, exact window = `horizon_days`, dates inside the window, coverage/amount flags, and cross-page context equality. The panel restarts once on a context change, then stops; stops with a PARTIAL label at page/row/scan/time budgets; never implies completion. | client-units (12), browser R4.1–R4.5 |
| R5 | Preflight + receipts + fail-closed rollback (details in the SQL README). `CREATE FUNCTION`/`CREATE TRIGGER` only; nine live dependencies fingerprinted by md5 of `pg_get_functiondef`; rollback removes only intact, receipted objects. | provenance V1–V13 (19 checks incl. 2 mutants), static S11/S11b/S14 |
| R6 | Property access moved inside `try`; throwing-getter regression; exact `"1"` preserved. | client-units R6 |
| R7 | **No `sw.js` change.** Helper modules are imported with `?v=<content hash>` (also the helper→helper import); `sw.js` caches by exact URL so an old cached helper is unreachable from an updated parent; parents are network-first. The real `sw.js` is executed in a VM with mocked caches/fetch. Re-stamp with `node scripts/wp10-g2-safeguards/stamp-asset-version.mjs`; a test fails if the token is stale. Installed-controller acceptance remains WP12. | sw-delivery R7.1–R7.7 |
| Disposal | Panel `rebind` on re-mount, `dispose` on lens exit/controller destroy, pending-read results discarded; remount after exit works. | browser D1–D3 |
| Whole-page overflow | Compared against flag OFF on the same states (not WP10 boxes only): ON never exceeds OFF at 390 and 1280 for Readiness and Manage Products (closed, dialog open, after rejection). Inherited WP11 widths are not hidden. | browser O1, O2; `screenshots/*overflow-compare*.json` |

## Fresh results (this head; `WP10_G2_EVIDENCE/results/regression-counts.txt`; mocked/isolated only, not live-role acceptance)
| Suite | PASS | FAIL | NOT PROVEN | SKIPPED |
|---|---|---|---|---|
| G2 horizon fixture (isolated PG) | 43 | 0 | 0 | 0 |
| G2 guards fixture (isolated PG, incl. concurrency + mutants) | 37 | 0 | 0 | 0 |
| G2 provenance fixture (isolated PG) | 19 | 0 | 0 | 0 |
| G2 draft-SQL static | 19 | 0 | **0** (S14 NOT PROVEN of the prior head is closed by R2) | 0 |
| G2 client units / sw-delivery / source | 12 / 7 / 9 | 0 | 0 | 0 |
| G2 mocked Chromium: Manage Products / Readiness+horizon | 24 / 27 | 0 | 0 | 0 |
| G1 baselines preserved | fixture 56 PASS; mutations 9 PASS; catalog parity 48 PASS + 5 NOT PROVEN; client-contract 19 PASS + 1 FAIL (identical to `origin/main`) | | | |
| Readiness usability 21/21; WP04 smoke pass; lifecycle smoke **100 PASS / 2 known FAIL** (hub-cache generation, route-URL) | preserved | | | |
| WP08 G2-0 fail-closed 81/81, sw-freshness 15/15, browser 46/48 listed pass 0 fail; G2-1 selection 8/8, resolver 8/8, browser 44/45 pass 0 fail; PEC guard, PEC cache freshness 13/13, WP09 sw pin | pass | 0 | | |
| WP08 G2-0 source | 11 | **2 (tests 11 and 12 fail identically on `origin/main`: historical-base diff tests)** | | |
Only the CRLF-only `supabase/migrations/20261112*` working-copy differences remain unstaged and untouched.

## Remaining contracts / decisions (only outside the approved bounds)
- **Impact PREVIEW (read-only counterfactual before submit)** remains an unresolved *specific* contract: the live `fn_resolve_route_family_for_product` reads `products.sub_group_id`, so a counterfactual needs either an owner-authorised new sub-group-parameterised resolver (duplicating the 3-level selection) or a live-function change; rollback-based dry runs are excluded. The guard evaluates inside the writer's transaction and names the remediation.
- Everything else (amounts, override workflow, route closure) is settled/closed as described. Production application still needs separate exact approval after review, provenance, rollback and performance checks (the new preflight enforces provenance mechanically).
- Performance: not measured against production-scale data (NOT TESTED); the horizon is bounded (≤200 SKUs per call, per-SKU boundary evaluation) and the client budgets pages/rows/scans/time.
