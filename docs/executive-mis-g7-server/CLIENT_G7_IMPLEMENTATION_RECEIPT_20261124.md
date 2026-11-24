# MIS G7 — client implementation and integrated acceptance (24 Nov 2026)

> **Update (S7):** gaps G-1 to G-4 below are addressed by the prepared (not installed) S7 server package and the matching client integration; see `S7_ACCEPTANCE_AND_DEPLOYMENT_RECEIPT_20261124.md`. Where this document and that one differ, the S7 receipt is current. The §5 smoke matrix is superseded by §8 of the S7 receipt.

**Status:** client package complete and tested against an isolated model of the documented server contract. **G7 OPEN 7/11 (64%), G8 parked.** Production stays in AUDIT, core gate `CORE_MIGRATION_NOT_ACCEPTED`, ENFORCE prohibited, no permission assigned, no production write performed. Server provenance (PR #522, contract `mis-g7-s2-s5b/1`) is unchanged; no migration SQL was touched.

## 1. What was built

New module **Batch Governance** (`public/shared/mis-batch-governance.html`, `js/mis-batch-governance.js`, `js/mis-g7-contract.js`, `css/sasv-mis-batch-governance.css`). Shared shell conventions: `sasv-core` tokens only, `mountModuleHome` HOME (icon-only ≤520px), searchable selectors, tabbed single page, modal that becomes full-page ≤520px, Esc/Tab handling with focus return, latest-request-wins loaders, retry on every load error.

| Requirement | Where / how |
|---|---|
| A. Route-based logging | *Stage signing* tab: product → exact batch → BMR identity (1 = ok, 0/>1 = flagged) → `rpc_get_effective_product_process_route` steps (signable = `base_step_id`) → exact `daily_work_log` evidence (non-matching activity flagged) → occurrence, measured qty (required for FG bulk), evidence ref → confirm modal → `mis_sign_batch_stage_v1`. Route/identity gaps shown as notes. Mandatory FG bulk stage is named as the pre-packing gate. Historical logs are never shown as signed. |
| B. Governed packing | *Governed packing* tab: bulk-depleting packaging events only (`event_type_lkp.affects_bulk_stock = -1`), live available bulk + base UOM, per-SKU counts (existing lines locked → Corrections), `mis_pack_fg_bulk_v1`. Required / available-before / excess / balance-after / UOM / SKU line ids shown **from the server response only** (no JS stock arithmetic). No separate depletion or excess write exists (static test forbids table writes). |
| Idempotency | One UUID per user intent (`IntentRegistry`, scope = event + lines); kept across refusal → excess confirmation, deadlock retry (40P01/40001, ≤3, same key) and uncertain network outcomes; released only on success. Uncertain outcome locks inputs, offers Retry (same key → server replay) and Reload balance. |
| C. Measured excess | Only after `INSUFFICIENT_BULK` with `excess_permitted:true` **and** the operator holds packing+excess edit rights: compact modal (required, available, shortfall, UOM; measured qty, reason, evidence ref; validated) → same request key, one atomic call with `p_excess`. `INSUFFICIENT_AFTER_EXCESS` keeps the modal open. Others see the figures and a "nothing posted" note, no controls. No receipt is ever fabricated. |
| D. Corrections | *Corrections* tab: lines of the event → `mis_correct_pack_line_v1` (existing/proposed count and delta before, reason, server-reported stock delta and balance after; `0` = governed removal; excess flow when it increases consumption). Historical lines return `CORRECTION_NO_DEPLETION_BASIS` and stay blocked (NOT_VERIFIED shown). Stage void via `mis_correct_batch_stage_v1`. `STAGE_SOURCE_CHANGED` is reported with the correct-and-re-sign instruction; normal FG closure to Done does not change the S6 fingerprint (modelled and asserted). |
| E. Exception visibility | Batch Governance *Exceptions & mode* tab and a collapsed *Production evidence status* section in the Executive MIS Production tab: Signed / Unsigned / Source changed / Missing route / Missing FG receipt / Not verified definitions; the 29 historical missing-depletion lines (20 product-batches) and route-master deficiencies (80 FG bulk logs: 52/17/1/10) shown as a **labelled reference snapshot, not live**, separate from governed records. No backfill, no synthetic signatures, no computed counts. |
| F. Permissions / mode | Canonical `app_has_permission` (view AND edit, as `require_permission(target,true)`); capabilities only hide/omit controls, server stays authoritative. Registry preparation: `CLIENT_PERMISSION_REGISTRY_PROPOSAL_NOT_APPLIED.sql` (five targets + page module; **no assignment**). Mode badge reads `mis_g7_enforcement_readiness_v1` (admin view only); AUDIT is described as observational, ENFORCE as refusing direct writes; unknown mode is labelled unknown. **No ENFORCE or core sign-off control exists** (static test). Legacy paths (Add/Edit Log Entry, FG Bulk Stock) are untouched and stay available. |
| G. Read-contract gaps | §3 below. |

## 2. Files changed

New: `public/shared/mis-batch-governance.html`, `public/shared/js/mis-batch-governance.js`, `public/shared/js/mis-g7-contract.js`, `public/shared/css/sasv-mis-batch-governance.css`, `scripts/mis-g7-client/{fake-server,contract.test,page.test,static.test}.mjs`, `docs/executive-mis-g7-server/{CLIENT_G7_IMPLEMENTATION_RECEIPT_20261124.md,CLIENT_PERMISSION_REGISTRY_PROPOSAL_NOT_APPLIED.sql}`, `docs/executive-mis-g7-server/client-evidence/*.png`.
Modified: `public/shared/executive-mis-dashboard.html` / `.js` (governance section only; `get_mis_production_value_summary` untouched), `scripts/wp09-g1-launcher-audit/module-mapping.mjs` (one NON_LAUNCHER classification for the new page, as that audit requires every HTML page to be classified), `supabase/tests/mis_g7/gen_migration_identities.mjs` + `mis_g7_acceptance_pg.test.mjs` (identity generator now preserves all eight registered versions and LIVE status; test asserts them), status notices on five historical G7 documents (contemporaneous text preserved).
Not touched: `public/sw.js` (protected path; see release dependency R-1), any migration SQL, `client_rpc_contract.json`, Add/Edit Log Entry, FG Bulk Stock, Costing, PEC files, package.json/version.

## 3. Server-contract gaps (exact) — bounded server package proposal

The client works today without any of these; each removes a limitation. All would be new `SECURITY DEFINER` read RPCs (`search_path` pinned, authenticated-only, anon revoked, reading `app_private` internally; **no** table grants, **no** service role in clients). None is invented client-side.

| # | Missing contract | Effect today | Proposed (read-only) |
|---|---|---|---|
| G-1 | No stage-status read. `app_private.mis_batch_stage_event` is not client-readable. | Signed state is known only for signatures made in the current page session; void needs an event in that list; Packing shows "server verifies at posting". | `mis_get_batch_stage_status_v1(p_product_id int, p_batch text)` → per route step/occurrence: event_id, work_log_id, stage_role, signed_at, signer, corrected/corrects_event_id, `state` ∈ SIGNED / UNSIGNED / SOURCE_CHANGED, plus `fg_bulk_state`. View right on any MIS target. |
| G-2 | Route read needs `module:production-route-manager` view; the signer resolver accepts only **base family-route steps** (override steps unsignable). | A signer without route view sees "Route view is not available"; override steps shown "Not signable". | `mis_get_batch_route_context_v1(p_product_id, p_batch, p_work_log_id)` returning the resolver's own result (`code`, route_id, bmr_id, signable `route_step_id` list, mandatory FG step), gated by the signer permission. Alternatively owner assigns route view to signers. |
| G-3 | No packing/correction preflight. | Required bulk and "no depletion basis" appear only after a refused/accepted submit. | `mis_preview_pack_fg_bulk_v1` (required_base, available, stage state) and a per-line `has_depletion_basis` flag on the event-lines read. |
| G-4 | No governed-exception summary for Executive MIS. | Dashboard shows definitions + a labelled historical snapshot, no live signed/unsigned counts. | `mis_get_governance_exception_summary_v1(p_from,p_to)` → counts and a page of items by state (SIGNED, UNSIGNED, SOURCE_CHANGED, MISSING_ROUTE by code, MISSING_RECEIPT, NOT_VERIFIED), gated by `module:executive-mis-dashboard` view. |
| G-5 | Registry rows for the five targets + page module (proposal SQL ready, not applied). | Targets cannot be assigned in the permission admin; page not launchable from the hub. The page is reachable by URL and from the dashboard section. | Owner-authorised apply of the proposal SQL. |

## 4. Tests (all isolated; no network, no Supabase, no production)

| Suite | Result |
|---|---|
| `scripts/mis-g7-client/contract.test.mjs` — contract alignment with `client_rpc_contract.json` (every refusal code has wording), classification, idempotency registry, validation, capabilities (view∧edit), mode, authorized/unauthorized signing, route/BMR ambiguity, mandatory FG receipt, successful packing, insufficient, authorized/unauthorized excess, atomic failure/retry (deadlock, lost response, replay, key reuse, retry exhaustion), corrections/removal/historical, source revision vs Done closure, readiness | 16/16 |
| `scripts/mis-g7-client/page.test.mjs` — real page in Chromium vs the server model: signing, unauthorized, gate, ambiguity/gaps, route-view denied, FG-gate refusal, success receipt, excess modal (validation, same key, atomic), no-excess-authority, uncertain network retry (no duplicate), corrections incl. removal/historical/unauthorized, source revision, void, exceptions & mode, latest-wins, 320/390/768 layouts (no horizontal overflow, full-page modal ≤520px), keyboard Esc/focus return | 19/19 (stable on repeated runs) |
| `scripts/mis-g7-client/static.test.mjs` — no table writes/service role/private schema/invented RPC; no ENFORCE/core controls; excess gating; token-only CSS; HOME + Electron/PWA redirects; route normalisation for both clients; protected `sw.js` unchanged; registry proposal assigns nobody; manifest preserves versions | 11/11 |
| `mis_g7_acceptance_pg.test.mjs` "MIGRATION IDENTITIES" (updated) | pass |
| Regression, baseline-compared (44 suites that read `sw.js`, the dashboard, module registry, module chrome, FG bulk or the identity manifest; run on the base commit `6cefc0c` in a separate worktree and on this branch) | Identical outcomes for 43/44. The one difference is `wp10-g2-safeguards` **S4** ("no new … client file vs `origin/main`" with a fixed WP10 allowlist): it fails for any later client branch that adds a page, so it is scoped to the WP10 package, not to this change; left unchanged. Other failing suites (e.g. several `costing-*`, `mis-c1/mis-launcher-route`, `wp10 S6`) fail identically on the base commit. |
| Not run | The remaining ~110 `scripts/**` suites (Costing/PEC/etc., slow and unrelated to files changed) were not baseline-compared; the full-tree run was abandoned because the Costing suites alone exceed the session budget. |

Visual evidence: `docs/executive-mis-g7-server/client-evidence/` (desktop sign, receipt, excess modal, uncertain retry, exceptions; 320/390/768 excess modal and sign view).

Limits stated plainly: the browser tests run against a **model** of the server contract, not the live server; they prove client behaviour and contract adherence, not live authorization or live data shape. The live `rpc_get_effective_product_process_route` output shape was taken from its migration source (`steps[].base_step_id`, `is_mandatory`, `activity_name`, …) and has not been exercised with a real signed-in session.

## 5. Authenticated production smoke-test matrix (owner; no live permission is assigned by this package)

Prerequisite (owner, separate authorization): apply the registry proposal, then assign **to one named test user**: `mis-batch-stage-signer` (view+edit), `mis-fg-bulk-packing` (view+edit); `mis-fg-excess-adjustment` (view+edit) only to a second user for step 9. Use one real, low-value batch that already has FG bulk receipt evidence; record the batch before starting. Expected mode throughout: AUDIT.

| # | Step (as the stated user) | Expected | Evidence |
|---|---|---|---|
| 1 | Open Batch Governance with a user holding **no** MIS target | "You do not have access" | screenshot |
| 2 | Signer: product → batch → open Stage signing | BMR #n (exactly one), effective route steps, work-logs listed. If "Route view is not available": gap G-2 confirmed (owner may grant route view) | screenshot |
| 3 | Sign a non-FG step with the matching work log | "Stage signed", event id; repeat identical click → replay, no second event | event id |
| 4 | Sign the FG bulk stage with the measured qty equal to the logged receipt | Signed, role FG_BULK; wrong qty → MEASURED_QTY_MISMATCH, nothing written | event id / refusal |
| 5 | Packing on a batch whose FG stage is **not** signed | Refused FG_STAGE_NOT_SIGNED, "Not verified", stock unchanged | FG Bulk Stock before/after |
| 6 | Packing after step 4, small count | Receipt: required, available before, balance after, UOM; FG Bulk Stock agrees | receipt + stock |
| 7 | Same action with the network disabled mid-request, then Retry | "Outcome not confirmed" then replay; stock debited once | stock before/after |
| 8 | Counts above stock, user **without** excess right | Required/available/shortfall shown, no excess controls, nothing posted | screenshot |
| 9 | Same as 8 with the excess user, small measured excess with reason + evidence | Excess + packing posted together; balance after correct | receipt + ledger |
| 10 | Correct one line (decrease), then set another to 0 | Stock delta and balance per receipt; removal returns depletion | receipts |
| 11 | Try to correct a known historical line (29-line set) | CORRECTION_NO_DEPLETION_BASIS, "Not verified", nothing changed | refusal |
| 12 | Edit the signed FG work-log quantity, then pack | STAGE_SOURCE_CHANGED → void signature → re-sign → pack OK. Change only status to Done: no re-sign needed | event ids |
| 13 | Existing operational path: Add/Edit Log Entry and FG Bulk Stock as before | Unchanged (AUDIT) | normal save |
| 14 | Exceptions & mode as enforcement-admin viewer (view only) | Badge AUDIT, core gate CORE_MIGRATION_NOT_ACCEPTED, no activation control anywhere | screenshot |
| 15 | Phone (390px) and Electron: open page, HOME, excess modal | Full-page modal on phone; HOME returns to hub on both | screenshots |

Stop and report on any unexpected stock movement, any refusal without a visible reason, or any daily-logging failure. Roll back by removing the test user's assignments; signed events are append-only and stay.

## 6. Release readiness

* **Client:** ready for owner review as a draft. Not released: no merge, no Electron/PWA publication, no version bump.
* **Not claimed:** live authenticated acceptance (matrix above is outstanding, so G7 stays 7/11), core migration acceptance, ENFORCE readiness.
* **R-1 (release dependency):** `public/sw.js` is a protected path and was deliberately not edited. Hosted-PWA freshness for the new scripts/stylesheet and the changed dashboard script needs a separately reviewed SW network-first rule or cache-name advance at release time (the repository's own guards `pec-protected-path-guard` / WP10 S5 forbid an unreviewed SW edit). Electron is unaffected.
* **Blocking for a useful operator release:** G-5 (registry apply + assignments). **Recommended before wide use:** G-1 and G-2 (otherwise signing state is session-local and signers need route view).
* **Pre-existing, unrelated:** `scripts/mis-c1/mis-launcher-route.test.mjs` fails identically on the base commit (expects an unversioned `src="js/executive-mis-dashboard.js"`; the page carries a `?mis-c1=` cache-bust). Not changed here.

## 7. Process disclosure

While checking a baseline I briefly ran `git stash` on the working tree, which also swept the five protected PEC migration files (CRLF-only modifications). `stash pop` was refused, so I restored only my own five tracked files from the stash, verified the five PEC files are content-identical to their pre-stash state (clean-filter blob hashes equal) with 36 CR line endings intact, and dropped the stash. Nothing was reset, cleaned, staged or committed for those files. Later baseline comparison used a separate `git worktree`, never the stash.
