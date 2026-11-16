> **SUBSEQUENT OWNER DECISION:** preview source #442 merged normally at `d20a8991` under explicit approval. [Receipt and SQL stage](WP10_OWNER_G2_PREVIEW_MERGE_AND_SQL_STAGE_2026-11-16.md) supersede earlier source-merge-pending status below. No SQL applied or flag activated; exact Phase 1 application decision remains open. WP10 OPEN, 10/13.

> **SUBSEQUENT INDEPENDENT REVIEW (16 Nov IST):** [Review/corrections](WP10_G2_IMPACT_PREVIEW_INDEPENDENT_REVIEW_2026-11-16.md) records two additional client lifecycle gaps corrected on this branch and new regression/mutation checks. Counts below describe author head `af207001` and are preserved as historical offline evidence. Corrected-source head `fbe86562` passed 286 offline checks, including 30 preview Chromium checks; see the independent review for run/artifact and live catalog-only bounds. Source merge still needs owner approval.

# WP10 G2 — Pre-submit impact preview: implementation record (draft; independent review pending)

**15 November 2026. Draft implementation only.** Package: [`WP10_G2_IMPACT_PREVIEW_SINGLE_DRAFT_COMPLETION_PACKAGE_2026-11-15.md`](WP10_G2_IMPACT_PREVIEW_SINGLE_DRAFT_COMPLETION_PACKAGE_2026-11-15.md) under issue #440, contract [`WP10_G2_COUNTERFACTUAL_PREVIEW_CONTRACT_DRAFT_2026-11-15.md`](WP10_G2_COUNTERFACTUAL_PREVIEW_CONTRACT_DRAFT_2026-11-15.md).
Base: `origin/main` `38f61c34c39df9ca7dd4b2697ddeaf21f84d262b`. One new branch `claude/wp10-g2-impact-preview`, one draft PR. **Not merged, nothing deployed, no flag activated, no production SQL, no grant/permission/RLS/registry change. SQL stays UNAPPLIED. WP10 OPEN; programme 10/13.**

## What was delivered
| Package item | Delivered | Evidence |
|---|---|---|
| 1 Proposal 06 with context-aware helpers | `06_subgroup_impact_preview.sql`, **generated** by `scripts/wp10-g2-safeguards/gen-proposal-06.mjs` from the committed live definitions. Four helpers are the captured text with named, count-asserted substitutions: family resolver (the two `public.products` reads become the explicit (product, proposed sub-group) pair; group from `public.sub_groups` for the proposed sub-group), family-route resolver, product-route validator (**only the nested family lookup at the route's own effective-from date** changes) and effective validator. Product-route selection (canonical ambiguity), the family-route validator and effective steps/overrides are the unchanged captured functions. No live function is replaced. | static S19 (file == generator), **S20 parity** (undoing only the substitutions returns each helper to its captured text), S21 (no remaining stored-subgroup path), S22 (reused callees fingerprinted) |
| 2 Read-only, single snapshot, contract response | `rpc_wp10_preview_product_subgroup_impact(product, proposed_sub_group)`: STABLE (one statement snapshot), authenticated + existing Manage Products **View**, reads stored sub-group from the table, group from the proposed sub-group, missing product/sub-group = input error (P0002) not zero impact, closed `VALID/INVALID/UNKNOWN`, family / family-route / product-route ids, bounded sanitised reason codes, active-SKU count, `authoritative_for_save:false`, `review_required`, `impact_class`, IST date and a staleness digest (never an authorisation). Evaluation errors / malformed results = UNKNOWN. No write, set_config, rollback dry-run, audit/epoch write or builder call. | preview.test.mjs W1–W10 (42 PASS) incl. READ ONLY transaction and unchanged business/audit/epoch fingerprints after repeated previews |
| 3 Preflight / fingerprints / receipts / rollback together | 06 added to the absence preflight, md5 fingerprints (4 derived-from + 3 reused live functions), prerequisite receipt (01), transactional receipts and the fail-closed rollback (which now lists 14 functions + 3 triggers). Proposed grant is SQL text only. Proposal 05 semantics, amount resolution and the no-override policy are unchanged. | provenance V14.1–V14.7 (26 PASS): collision, prerequisite missing/drift, derived-from drift, modified-before-rollback, clean rollback, grant verified in isolation |
| 4 Manage Products integration (flag `WP10_SAFEGUARDS_V1`, default OFF) | Existing update confirmation only; only an **existing** product with a **changed** sub-group; module import → preview → dialog → pre-writer revalidation serialized by one reservation (released synchronously before the writer); bound to product / stored / proposed sub-group / one attempt; stale, cancelled, disposed results discarded; absent endpoint explicit; strict response validation (identity, authority flag, class-vs-states consistency, closed vocabularies); text nodes only; verified Production Route link only; no client freeze and no use of the preview as a token. | browser-preview B1–B16 + mutation controls M1–M4 (23 PASS) |
| 5 Delivery, pins, guidance | Helper imports stay hash-versioned (token `6b42977628`, re-stamped); **no `sw.js`, cache pin or protected-path-guard change**; WP08 RPC-surface allowances extended by exactly the new endpoint name (exact, once) and re-pinned by WP10 S9/S10; runbook §3c; WP12 receiving cases `WP10_WP12_IMPACT_PREVIEW_RECEIVING_CASES_2026-11-15.md`. Proposal 05 alone is not described as pre-submit review acceptance. | source S9–S11, sw-delivery |
| Verification workflow | `.github/workflows/wp10-g2-offline-verification.yml` now requires `preview.test.mjs` (PG, no skips), `browser-preview.test.mjs` (must reach a clean non-empty pass) and generator parity, keeping every earlier suite. | source S11 |
| Application manifest | `WP10_G2_UNAPPLIED_SQL_APPLICATION_MANIFEST_2026-11-15.md` (generated; static S24 proves its sha256 values match the SQL). **Not permission to apply.** | — |

## Defects found by the new suites and fixed here
1. **NULL-logic fail-open in proposal 06 (server):** `jsonb_typeof(v->'valid') <> 'boolean'` is NULL for a result without `valid`, so a malformed validator result fell through and was classified INVALID instead of UNKNOWN. Fixed with `IS DISTINCT FROM`; permanent mutation control W11.7.
2. **Modal Confirm could be pushed outside the viewport** by the preview detail (the existing governance box neither limits height nor scrolls). Fixed in the helper's injected CSS (box `max-height`/scroll, detail host capped), without touching `manage-products.html`.
3. **A stale dialog kept "Checking…" forever** when the selection changed while it was open; both the activation pre-check and the preview now replace it with an explicit "discarded" note and still submit nothing.
4. A source comment containing the word "bypass" tripped the G1 C5.1 text guard (a regression against the G1 baseline); reworded, no behaviour change.

## Author-head offline results (af207001; historical after reviewer corrections; mocked/isolated only — not live-role or installed-app acceptance; raw: `WP10_G2_EVIDENCE/results/regression-counts.txt`)
| Suite | PASS | FAIL | NOT PROVEN | SKIPPED |
|---|---|---|---|---|
| G2 horizon / guards / provenance (isolated PG) | 43 / 37 / 26 | 0 | 0 | 0 |
| **G2 preview fixture (isolated PG, incl. 7 mutants + 3 probes)** | **42** | 0 | 0 | 0 |
| G2 draft-SQL static | 25 | 0 | 0 | 0 |
| G2 client units / source / sw-delivery | 14 / 11 / 7 | 0 | 0 | 0 |
| G2 mocked Chromium: Products / Readiness / **Preview** | 24 / 27 / **23** | 0 | 0 | 0 |
| G1 transition fixture / mutations / catalog parity | 56 / 9 / 48 | 0 | **5 (preserved bounds)** | 0 |
| G1 client-contract | 19 | 1 (B1 = known lifecycle baseline, identical to `main`) | 0 | 0 |
| Readiness usability / WP04 smoke | 21 / pass | 0 | 0 | 0 |
| Lifecycle smoke | **100 PASS** | **2 known** (hub-cache generation, route-URL) | 0 | 0 |
| WP08 G2-0 fail-closed 81, sw-freshness 15, browser 46/48; G2-1 source 13, selection 8, resolver 8, browser 44/45; PEC guard 1, PEC cache 13, WP09 pin 1 | all | 0 | 0 | 0 |
| WP08 G2-0 source | 11 | **2 (tests 11, 12 fail identically on `origin/main`: historical-base diff tests)** | 0 | 0 |

All fresh counts are from this branch's run. Historical counts of earlier heads (199 for #441) are not reused as results. The G2 browser run executes each mutation control by serving a mutated `products.js`/helper to the real page.

## Mutation matrix (all DETECTED)
Preview fixture: RPC ignores proposed sub-group; **outer** selector ignores it; **nested** product-route validator ignores it (route's own date); product-map precedence dropped; group taken from the stored sub-group; evaluation error → VALID; malformed result not UNKNOWN. Browser: no pre-writer revalidation; no serialization; no identity check; no class-consistency check. Provenance: weakened preflight; rollback without md5 check (earlier package, retained).

## Fixture provenance
Route chain: five callees + validator **LIVE-VERBATIM** from the independent catalogs; stand-in **tables** only (column subsets from the function texts); proposal 06 text exactly as generated; proposal text is the only thing under test. Overrides, inherited and product routes, SUPERSEDED selection, inclusive window ends and overlapping product routes use the real callees.

## Remaining (unchanged boundaries)
- NOT TESTED: real identities, real database / production-scale performance, hosted/installed PWA & Electron/Windows, real-device layout; all carried to WP12 (`WP10-PV-1..8`).
- Separate exact owner decisions: whether/when to apply 01–06 (manifest), independent review of this package, formal WP10 closure. Inherited WP11 PM BOM overflow and SKU Deactivate contrast defects are retained and not hidden. The five CRLF-only `supabase/migrations/20261112*` differences remain untouched and unstaged.

## Rollback
Client: remove `WP10_SAFEGUARDS_V1` (the preview is inert while the endpoint is absent) or revert the PR; flag-OFF behaviour is unchanged. SQL: nothing applied; if ever applied, `99_rollback_all.sql` removes only intact, receipted objects and refuses (dropping nothing) otherwise.
