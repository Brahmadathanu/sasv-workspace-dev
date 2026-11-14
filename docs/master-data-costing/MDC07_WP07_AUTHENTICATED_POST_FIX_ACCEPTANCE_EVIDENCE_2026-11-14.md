# MDC-07 WP07 — Authenticated post-fix acceptance evidence (14 November 2026)

**Status: WP07 remains OPEN. Programme remains at 7/13.** This document records an observed browser run and a bounded source investigation. It does not close WP07, change any application code, flag, permission or deployment, and does not rewrite the 13 November records.

- Issues: #367 (coordination), #380 (Workload Preview Product carry-over defect, fixed in PR #386 / `54e82ae`).
- Preserved unchanged: `MDC07_WP07_AUTHENTICATED_BROWSER_ACCEPTANCE_EVIDENCE_2026-11-13.md` and `MDC07_WP07_POST_FIX_ACCEPTANCE_ADDENDUM_2026-11-13.md`. This file executes the manual checklist (P0–P11) that the addendum left BLOCKED.
- Repository state used for source review: `main` at `4a857c02ee8c59f1f9bc09754fd7f89104b39971`.

## 1. Method and scope

| Item | Value |
|---|---|
| Date | 14 November 2026 |
| Browser | Claude desktop built-in browser pane (Chromium), not the owner's Chrome profile |
| Origin | `https://sasv-utilities-hub.netlify.app/` |
| Identity | The existing authorised view-only SASV account. The owner signed in personally; the agent never entered, retrieved or handled credentials. |
| Service worker | `/sw.js` activated and controlling; cache `hub-cache-v393` |
| Flags | Only `COSTING_NAV_GROUPS_V1` and `COSTING_PRM_NAV_CONTEXT_V1`, set browser-locally for P8–P10 under the owner's standing bounded authorisation. U11 untouched. |
| Not done | No Save/Apply/Create control used; the privileged route-evidence preview not opened; no writer operation, RPC call made by script, account creation, permission change, deployment or closure. |
| Caveat | The checklist text was read through a paraphrasing summariser, not verbatim. Pass criteria for P5 and P8 below are as paraphrased and should be checked against the committed 13 November addendum §3.1 by the reviewer. |

## 2. Results summary

| Step | Result | One-line observation |
|---|---|---|
| P0 | PASS | Both flag keys read `null`, `null`. |
| P1 | PASS | Browser-loaded assets match network; controller hash `92df9fd8…` (see §3). |
| P2 | PASS | Workload Preview fresh: **495 rows**, no `product_id`. |
| P3 | PASS | Product 678 selected, Workload pill: **495 rows**, no `product_id`. #380 not reopened. |
| P4 | PASS | Deep link `product_id=678`: **1 row**, URL keeps `product_id`. |
| P5 | **FAIL** (against stated expectation) | Pill click did not create history; Back left the module (see §5). |
| P6 | PASS | Product identity and `product_id=678` retained across three lenses. |
| P7 | PASS | With Product 678 selected: Readiness 592, Subgroup Mappings 16, Archived Routes 226. |
| P8 | **PARTIAL / FAIL** | Data + URL PASS; Product/Family chip clearing FAIL (see §6). |
| P9 | PASS (limited) | Product B reached by deep link, not picker (see §7). |
| P10 | PASS (limited) | Overflow checked; chip wrapping not visually inspected (see §8). |
| P11 | PASS | Complete restoration (see §9). |

**The #380 data-filtering defect is resolved on real data** (P2, P3, P8-data, P9, P10 all show 495 rows and no carried `product_id` after a pill click). **A separate, newly observed presentation issue** — Product/Family chips remaining visible on an unfiltered Workload Preview with flags ON — is recorded under P8 and is not a recurrence of #380.

## 3. P0–P1 — flags and browser-loaded freshness

- P0: `localStorage` `COSTING_NAV_GROUPS_V1` = `null`, `COSTING_PRM_NAV_CONTEXT_V1` = `null`. Only one non-costing (authentication) key existed; its name and value were not recorded.
- P1: the Production Route Manager page was loaded (`/shared/production-route-manager.html`). For 10 controller/support files the cache entry and a `cache: no-store` network fetch were compared by SHA-256 (LF-normalised), all identical:

| File | SHA-256 (first 16) |
|---|---|
| `costing-suite-production-route.js` | `92df9fd8ea06f828` (full: `92df9fd8ea06f828978fd96bbe8ed7fe160a4c2ca9e801a74eec3e45741cc974`, matches the addendum) |
| `production-route-manager-entry.js` | `ffcbdf815f341a01` |
| `costing-suite-production-route-helpers.js` | `373cb3fb478e995b` |
| `costing-suite-production-route-nav-context.js` | `e2cf2d607e6a0d2d` |
| `costing-nav-groups.js` | `60f8fc9a09844280` |
| `costing-nav-context.js` | `e18a79e3f23f4e9a` |
| `costing-feature-flags.js` | `5e298c2e86ecfc35` |
| `costing-suite-production-route-rpc.js` | `87fbced94cdff0f0` |
| `costing-suite-shell.js` | `8b6fd71556a09673` |
| `costing-suite-scheme-audit-actor.mjs` | `a107eaa1f63d91f5` |

Response header for the controller: `cache-control: public,max-age=0,must-revalidate`. Limitation: the addendum's own A.4 script was not available verbatim; this is an equivalent comparison of 10 files, not the full 73-asset set (that was verified server-side on 13 November). R9 (stale PWA controller) is cleared for the controller by this comparison.

## 4. P2–P4, P6–P7 — observations

- **P2** Fresh load of Workload Preview, flags OFF: `495 rows`; URL `?lens=shared-workload-preview`. N = 495 (unchanged from 13 November).
- **P3** Product Assignments (384 rows) → row opened → **View effective route** → `?lens=effective-route-viewer&product_id=678` (Ilaneer Kuzhambu). Then the Workload Preview pill: `495 rows`, URL `?lens=shared-workload-preview` (no `product_id`). Limitation: the first Assignments row happened to be Product 678.
- **P4** Address-bar load `?lens=shared-workload-preview&product_id=678`: `1 row` (Product 678), URL retains `product_id=678`.
- **P6** Effective Route Viewer → Product Route Editor → Product Assignments, each URL carried `product_id=678`, Product name present; Assignments `1 row`. Limitation: Product 678 has a Product-specific route, but `product_route_id` retention (R4) was not exercised or observed.
- **P7** With Product 678 selected: Route Readiness `592 rows`; Subgroup Mappings `16 records`; Archived Routes `226 records` (the last two read from the section subtitle, not a rows counter). Equal to the 13 November no-selection counts.

## 5. P5 — Back/Forward: FAIL against the stated expectation, with contract assessment

**Observed.** From the P4 state, clicking a lens pill changed the URL (e.g. to `?lens=product-route-assignments&product_id=678`) but `history.length` stayed at 4. Instrumenting `history.pushState`/`replaceState` before a second pill click logged exactly one call: `replaceState` with `?lens=route-family-mapping-review&product_id=678`; no `pushState`. Browser Back then navigated out of the Production Route Manager (to the hub root). The P4 scoped state was therefore not restored. The initial scripted Back/Forward attempt in the same run likewise ended outside the module; it was redone step by step and the finding is from the step-by-step run.

**Comparison with the original checklist and prior records.**

| Source | Statement |
|---|---|
| Checklist B4 | "Open three `?lens=` URLs … then Back, Back, Forward — active destination follows the URL **(in-page pill clicks do not create history entries; existing behaviour)**" |
| Checklist C10 | "Back/Forward over three `?lens=` URLs" — i.e. three separate URL loads, not pill clicks |
| 13 Nov evidence | B4 PASS, C10 PASS (CSR, flags ON) using address-bar URL loads |
| `MDC07_WP07_BULK_VERIFICATION_AND_CLOSURE_EVIDENCE_2026-11-12.md` | Finding: in-page pill/select switches create **no** history entry (shell never calls `pushState`; PRM uses `replaceState`); pre-existing with flag OFF, unchanged by N1; Back leaves the module; "Not a regression" |
| `WP-06-PRICING-POLICY-MANAGER.md` | Workspace switching uses `replaceState` in both modes |
| `WP-07-COSTING-NAVIGATION.md` | Picker keeps URL `product_id` in step via `replaceState` |
| Source (main `4a857c0`) | Shell tab-click URL tidy (`costing-suite-shell.js` ~L5385–5410) and PRM `applyPrmDeepLinkToUrl`/`navigate(..., replace)` use `replaceState`; the #380 fix (`54e82ae`) touched only the controller and added no history write. |

**Assessment.** The behaviour is an **existing, documented navigation contract**, not a regression: in-page pill clicks use `replaceState`, and Back/Forward are defined over explicit `?lens=` URL loads (B4/C10). P5's wording ("click another lens pill, then Back, Forward — expect the P4 scoped state") conflicts with that contract and appears to be a checklist authoring error in the 13 November addendum rather than a product defect. **P5 is nevertheless recorded as FAIL against its stated expectation** and is not silently converted. A conforming test of the contract (three address-bar loads, then Back, Back, Forward on the Production Route Manager) was **not run** in this session; PRM-specific evidence for that contract on real data remains NOT TESTED here (13 November B4/C10 PASS used CSR, and 12 November mock evidence covered five shell modules).

## 6. P8 — flags ON: PARTIAL / FAIL

Flags set: `COSTING_NAV_GROUPS_V1="1"`, `COSTING_PRM_NAV_CONTEXT_V1="1"`, page reloaded. Observed: five `.cp-nav-group` elements and a context bar.

**Data and URL — PASS.**
- P2-equivalent: Workload Preview `495 rows`, no `product_id`.
- P3-equivalent (Assignments → View effective route → Workload pill): `495 rows`, URL `?lens=shared-workload-preview` without `product_id`.
- P4-equivalent: deep link with `product_id=678`: `1 row`, `product_id` retained. Note: with a deep link straight onto Workload Preview no Product/Family chip was shown (only "Fixed historical context · not the current costing run"); clicking the already-active Workload pill was a no-op (1 row, `product_id` kept).

**Chip clearing — FAIL (as stated in the checklist).** After selecting Product 678 and clicking the Workload Preview pill, the context bar still showed visible chips `Product: Ilaneer Kuzhambu (#678)` and `Family: Ilaneer Kuzhambu — Product-Specific Route (#113)` (DOM `li.cp-context-chip`, visible, not `hidden`) while the register showed all 495 rows and the URL had no `product_id`. Reproduced twice, and again for the 390px width (P10) and for Product B (P9). The stale chips can mislead a reader into believing the register is scoped.

**Classification: PARTIAL / FAIL overall.** The #380 data-filtering requirement is met; the chip-clearing expectation is not. This is a distinct presentation defect, not a recurrence of #380 (the filter is gone; only the disclosure chip remains).

Related observation (same cause, §10): returning to the Effective Route Viewer after Workload Preview, the Select Product box was prefilled with the previously selected Product.

## 7. P9 — Product A then B

- A = Ilaneer Kuzhambu (#678), chosen through the Select Product picker. In this account the picker offered **only this one Product** (typing "Abhayarishtam" returned "No results"), so a second Product could not be chosen through the picker.
- B = Abhayarishtam (#1) was loaded by **deep link** `?lens=effective-route-viewer&product_id=1`, not through the picker. Chips updated to `Product: Abhayarishtam (#1)` and its Family (#20).
- Workload Preview after each: `495 rows`, URL without `product_id`, first rows `678`, `1` (the unfiltered ordering). No stale A or B row data. Chips remained as in P8.

Limitation: the intended "choose A, then B in the picker" path is not demonstrated; B's selection path is the deep-link path.

## 8. P10 — 390px width

Viewport emulation 390×812, flags ON, P3 repeated: View effective route → Workload pill gave `495 rows`, no `product_id`. Horizontal overflow check: `document.documentElement.scrollWidth` 390 vs `innerWidth` 390 (no overflow). **Chip wrapping was not visually inspected** at this width (no screenshot was examined); only the overflow metric was checked. The stale-chip behaviour of P8 was also present. Viewport emulation was reset to desktop afterwards.

## 9. P11 — restoration

Both keys removed with `removeItem`; the page reloaded. Observed: `COSTING_NAV_GROUPS_V1` = `null`, `COSTING_PRM_NAV_CONTEXT_V1` = `null`; no `COSTING*` keys in localStorage; no `COSTING`/PRM keys in sessionStorage; zero `.cp-nav-group` elements; zero `.cp-context-chip`/`.cp-context-chips` elements; flat pill row restored; browser console reported no errors (`No console logs`).

## 10. Bounded source investigation of P5 and P8 (no code changed)

Files read at `4a857c0`: `public/shared/js/costing-suite-production-route.js`, `…-nav-context.js`, `costing-nav-context.js`, `costing-suite-shell.js`, and the #380 diff (`54e82ae`).

### P5
No source defect: see §5. A fix would require adding `pushState` to shell and controller lens switching, which is outside #380, contradicts the documented B4/C10 contract and the N1 baseline guards, and is **not recommended**. Correct the checklist wording instead.

### P8 — root cause
1. N4 deliberately **remembers** the selected Product/Family in a controller-side tracker (`createPrmNavContextTracker`) and publishes it to the shared N1 store `costingNavContext` as chips (`buildPrmNavChipValues`). The tracker keeps its context across lens switches by design (rule 1–4) and `hydratePrmDeepLink` only *injects* it into identity lenses (`PRM_LENS_CONTEXT_KEYS`); Workload Preview is not one (rule 5: never given hidden filters).
2. The shared context bar renders whatever the store contains for **every** lens (`buildNavContextModel` / `renderNavContextHtml` render each non-empty key; they do not know which lens consumes context).
3. The #380 fix (`54e82ae`) removes `product_id` from the URL and from Workload `state.product_id` on a pill entry (`prmTabEntryPending`), but does not touch the N4 tracker or the store. So the register is correctly unfiltered while the remembered selection remains published as a chip.
4. Consistent precedent: on 13 November, Route Readiness with a selection was recorded PASS as "chip shown; register unfiltered (592 rows)". Chips on register lenses are therefore the existing N4 behaviour; the new expectation (chips dropped on Workload) is stricter than the N4 contract and than checklist C2 ("no Product/Family/Route/Run chip **unless selected**" — here a Product *is* selected, just not applied).

So the chip is not stale state corruption; it is a *remembered-but-not-applied* selection displayed on a lens that ignores it, which reads as an active filter because the same bar showed the Product as the filter before #380.

### P8 — smallest appropriate correction (proposal, not implemented)
Keep the tracker's stored context (so N4 Product identity retention across identity lenses and `hydratePrmDeepLink` stay exactly as they are) and make only the **published chips lens-aware**, in the controller, without touching the N1-guarded shell:

- Give `createPrmNavContextTracker.publish()` the active lens (or add `publish(lensId)` used by `commit`/`selectFamily`/`invalidate`) and publish `{product:"", family:"", route:""}` when `PRM_LENS_CONTEXT_KEYS[lensId]` is undefined, i.e. for lenses that never receive stored context. Re-publish the stored ids on the next identity-lens commit (already happens via `commit`).
- Scope option A (narrowest): only `shared-workload-preview`, the lens whose carry-over was #380. Scope option B: every non-identity lens — this would also hide the chip on Route Readiness, a behaviour the 13 November evidence accepted, so it needs an owner decision.
- Guards preserved: `reconcilePrmNavContext`, `hydratePrmDeepLink`, `collectPrmLoadedIds` unchanged; N4 identity retention across Assignments / Product Route Editor / Effective Route Viewer / Historical Evidence unchanged; the shell stays byte-identical (N1 baseline guards in `nav-groups.test.mjs`); no URL writes added.
- Tests to add: extend `workload-product-carryover-browser.test.mjs` (flags ON) to assert no Product/Family chip on Workload after a pill entry while the stored selection is restored on returning to Effective Route Viewer; add a unit test for the lens-aware publish; keep existing N4 tests green.
- Alternative (no code): accept the chip as a documented "remembered selection" on register lenses and reword the checklist (C2/P8). This is a valid owner decision given the Route Readiness precedent.

Not verified by execution: the proposal has not been run or unit-tested; only source-read.

## 11. Residuals and closure recommendation

| Residual | State after this run |
|---|---|
| R1 (#380 carry-over) | Closed on real data (P2, P3, P8-data, P9, P10). |
| R2 (explicit deep link keeps filter) | Closed (P4, P8-P4). |
| R3 (identity-lens Product retention) | Closed for Product 678 (P6); B via deep link only. |
| R4 (`product_route_id` retention) | Still NOT TESTED. |
| R5, R6, R7, R8, R10, R11–R14 | Unchanged / not tested in this run. |
| R9 (stale PWA controller) | Cleared for the controller (P1). |
| New: P5 checklist/contract mismatch | Existing contract; checklist wording to be corrected. PRM real-data address-bar Back/Forward not run. |
| New: P8 stale Product/Family chip on Workload Preview | Open presentation defect (or accepted behaviour by owner decision); correction proposed in §10. |

**Recommendation.** Do not close WP07 now; it stays OPEN at 7/13. #380's data defect is demonstrably fixed. Before conditional closure, the owner should (1) decide the P8 chip behaviour — approve a small controller-only follow-up (option A or B) or accept the chip as documented retained context; (2) correct or retire the P5 wording and, if desired, run the contract-conforming PRM address-bar Back/Forward test; (3) accept the remaining residuals explicitly. Status changes and the programme count remain the owner's decision.