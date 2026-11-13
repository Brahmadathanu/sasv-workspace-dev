# MDC-07 / WP07 — authenticated browser acceptance: consolidated evidence (13 November 2026)

**Status: evidence record for independent review. WP07 remains OPEN; programme remains 7/13.** Nothing here is a formal closure, owner acceptance, deployment or production change. Issue #367. Companion records: [checklist](MDC07_WP07_OWNER_READ_ONLY_ACCEPTANCE_CHECKLIST_2026-11-12.md) and [bulk verification evidence](MDC07_WP07_BULK_VERIFICATION_AND_CLOSURE_EVIDENCE_2026-11-12.md). Primary raw source: the 13 Nov first-pass browser record (`WP07_browser_acceptance_evidence_2026-11-13_FOLLOWUP.md`, working-tree note, not committed). The earlier `WP07_browser_acceptance_evidence_2026-11-12.md` was **not found** in the repository and was not reviewed or relied on.

Legend: **PASS** genuinely observed · **PARTIAL** only part of the contract shown · **FAIL** incorrect behaviour demonstrated · **BLOCKED** cannot safely execute · **NOT TESTED** not attempted.

## 1. Environment and provenance

| Item | Value |
|---|---|
| Application origin | `https://sasv-utilities-hub.netlify.app` |
| Expected source | `52ab8097f1e8310bd8be7e49b36ab20a41b8e380` (= `origin/main`; PR #368 changed no `public/` file, so assets equal those at `3a93432` cited by the checklist) |
| Browser | Claude Desktop built-in browser pane (Chromium, desktop pane ≈ 998 CSS px wide). Claude in Chrome extension: no connected browser |
| Capabilities proven | navigation, localStorage read/write, service-worker and Cache Storage inspection, in-origin JS, viewport emulation, screenshots, console, network (`fetch` wrapper) |
| Identity | One existing owner-signed-in account; six Costing modules view-only (PPM "View-only access" banner); no RM/PM trace view permission. No credentials or tokens recorded. No identity was created or changed. |
| Authorised flags | `COSTING_NAV_GROUPS_V1`, `COSTING_PRM_NAV_CONTEXT_V1` only, browser-local, owner instruction in chat. `COSTING_REVIEW_WORKLIST_V1` / `COSTING_UX_CONSISTENCY_V1` never set |
| Not done | writers, approvals, imports, recalculation, privileged previews, DB writes, permission changes, deployments, U11 |

### 1.1 Browser freshness (checklist A.4) — PASS (scoped)
- Service worker `/sw.js` activated and controlling; no waiting or installing worker; single cache `hub-cache-v393` (22 entries).
- For the 10 navigation assets plus `costing-suite-scheme-audit-actor.mjs`: network (`cache:"no-store"`) SHA-256 = Git hash at `52ab8097` = checklist hash; the 10 cached copies equal as well (the actor `.mjs` is not cached; its network hash `a107eaa1…` matches). Zero `false`.
- **Limits:** the 73-asset server verifier (A.2) was **not re-run**; the 12 Nov result (73/73, 0 mismatches) is relied on, not re-verified. HTML pages were not hash-checked. Classification: **HOSTED BUILD VERIFIED for the 11 assets checked; full-bundle re-verification not repeated.**

## 2. First-pass acceptance (13 Nov, preserved with original limitations)

| Row | Result | Basis / limitation |
|---|---|---|
| B0 | PASS | both flags `null` before any change |
| B1–B3 | PASS | six modules flat pills, no group headings or context bar; PPM ten workspaces; OFF showed a text label "Module → Lens" |
| B4 | PASS | CSR three `?lens=` URLs then Back, Back, Forward: scheme-comparison, cost-comparison, scheme-comparison |
| B5 / responsive | PASS (see limits) | Measured by loading each module in a hidden **same-origin iframe** at 390/520/768/900/1280 px (emulates media queries by container width; **not** a true viewport) — no document overflow, Home in view; ≤520 dropdown with group headings, ≥768 group headings. **Real 390 px** viewport verified on PRM only in that pass. Not captured: a screenshot for every module/width |
| C1 | PASS | groups per contract on all six modules; landing destinations unchanged |
| C2 | PARTIAL | breadcrumb `Module › Group › Destination`; "Governed period" chip seen on CCC/CSR/CBM-provisions/MCM-trace; Workload Preview shows "Fixed historical context · not the current costing run". LIVE_AS_OF / run-scoped chip wording on individual CCC lenses not read |
| C3 | PASS | account has no trace permission: Traces group and both pills `hidden data-nav-hidden=role`; `?lens=rm-cost-trace` shows "Restricted RM contribution detail", no data. (In flag OFF the trace pills were visible, then restricted — presentation difference consistent with C3) |
| C5 | PASS | CSR Scheme Comparison rows: `SKU policy overview ↗` → `pricing-policy-manager.html?workspace=sku-overview&period_start=2026-11-01&product_id=…&sku_id=…`, `target=_blank`. Link not clicked in pass 1 |
| C8 | PASS (limited) | 5 rapid lens clicks: final screen = last click. Product-switch stale test done in §3.C |
| C9 | PASS | `?workspace=scheme-master`; `?lens=policy-manager` normalised to `?workspace=sku-overview`; `?workspace=sku-overview` |
| C10 | PASS | CSR Back, Back, Forward with flags ON: active pill and breadcrumb follow the URL |
| C11 | PASS | real Tab: `:focus-visible` solid 2.4 px outline; Enter activates a pill; ≤520 px `<select>` with optgroups (PRM 5, CSR 3) |
| D1 | NOT TESTED | U11 excluded |
| E1 | PASS | the single available account |
| E2–E4 | NOT TESTED | no additional existing identities |

## 3. Residual checks (13 Nov, second pass)

Flags were set to `"1"`/`"1"`, confirmed, and restored (§5). Page-level `window.open`/`fetch` wrappers were installed in the page session only to record calls; they are discarded on reload.

### A. N2 scope notes — **PASS**
Exact displayed text (flag ON, desktop and real 390 px; each rendered inside `[data-nav-scope]`, below the group navigation, group label in bold):

| Module / lens | Displayed text |
|---|---|
| MCM · Manual Rate Manager | "Rates · Rates: set and review manual RM/PM costing rates. Trace evidence is a separate, restricted view." |
| CBM · Cost Governance | "Mapping & classification · Expense-head mapping: assign ledger expense heads to cost pools. Not a materials rate function, trace evidence or driver-policy approval." |
| CBM · Staff Governance | "Mapping & classification · Staff governance: classify staff into cost pools and review salary data. Separate from expense-head mapping and manual provisions." |
| CBM · Manual Provisions | "Provisions · Manual provisions: manually entered cost-pool amounts. Separate from expense-head mapping, staff governance and driver-policy approval." |
| CBM · Driver Governance (Policy approval) | **No note** — by design: source defines notes only for the three lenses above; Driver Governance has its own controller (source comment). No MCM note for the hidden Traces lens. |

Narrow width (real 390×812 emulation, MCM and CBM Manual Provisions): note spans left 24 / right 367 px, not clipped, no horizontal overflow, 12.5 px text wraps to three lines; readable but tight above the Provision register tiles (screenshot reviewed).

### B. CSR action-queue cross-links — **PASS (destination/contract); new-tab opening itself PARTIAL**
Both directions: source queue opened, a row's detail drawer opened by real pointer click, the sibling button activated by real pointer click.

| Direction | Control | Observed call | Result |
|---|---|---|---|
| Materials & Stores → QC | "Open QC Action Queue" (`data-ms-aq-nav=sibling-queue`) | `window.open("cost-sheet-review.html?lens=qc-action-queue&period_start=2026-11-01","_blank","noopener,noreferrer")` | PASS |
| QC → Materials & Stores | "Open Materials / Stores Action Queue" (`data-qc-aq-nav`) | `window.open("cost-sheet-review.html?lens=materials-stores-action-queue&period_start=2026-11-01","_blank","noopener,noreferrer")` | PASS |

- Destination URLs loaded in the same tab: lens `QC Action Queue` and `Materials / Stores Action Queue` active, breadcrumb "Governed period 2026-11-01".
- No `fetch`/RPC was issued by either click; no writer or mutation. The row-detail drawer itself loaded read data.
- **Limit:** the Browser pane blocks popups not initiated by the user; the first (unhooked) click was blocked, so an actual second tab was **not observed**. Evidence is the real-pointer click producing the `_blank` `window.open` call with the specified URL.

### C. PRM selected-product context — **principal gate**
**Selection mechanism (normal interface, view-only account):** Product Assignments → click a row (opens a read-only summary) → action **View effective route** navigates to Effective Route Viewer with `product_id`; the Effective Route Viewer also has a **Select Product** combobox. Opening a row drawer alone did **not** set a context (first pass observation), and "Create Product route", "Preview route candidate evidence" and "Open Supply Batch Plan" were deliberately not used. The `rpc_get_*` calls after View effective route (`rpc_get_effective_product_process_route`, `rpc_get_product_route_history`, `rpc_get_route_family_route_history`) are read RPCs carried over POST by Supabase.

Product A = **Dadimashtaka Choornam (#119)**, Family "Dry Fine Powder — Wash & Dry + Post-Blending (#12)"; an earlier run used Ilaneer Kuzhambu (#678). Product B = **Ashta Choornam (#115)**, Family "Dry Fine Powder — Wash & Dry (#11)". (Product master names only; no confidential business data recorded.)

| # | Step (flags ON) | Observation | Result |
|---|---|---|---|
| 1–2 | Select A through View effective route | Chip row "Product Dadimashtaka Choornam (#119) · Family … (#12)"; URL `?lens=effective-route-viewer&product_id=119` | PASS |
| 3 | Product Route Editor | chips retained; editor empty (A has no Product route: "Product Route / Version: None") | PASS (identity); **product_route_id retention NOT TESTED** — no tested product had a Product route |
| 4 | Effective Route Viewer | A retained | PASS |
| 5–6 | Return to Product Assignments | chips retained; register narrowed to 1 of 384 (A) | PASS |
| 7–8 | Historical Evidence Review | chips retained, 0 rows. N4 source lists this lens among **identity lenses** (receives `product_id`, `route_family_id`); data-vs-filter cannot be separated (empty) | PARTIAL |
| 8 | Route Readiness | chip shown; register **unfiltered** (592 rows, same as no selection) | PASS |
| 8 | Subgroup Mappings (16), Archived Routes (226) | **unfiltered** (same counts as without selection) | PASS |
| 8 | Mapping Review | "No … evidence candidates for this exact-run context" with and without selection | PARTIAL (cannot show filtering either way) |
| 8 | Foundation Review | not visited | NOT TESTED |
| 8 | **Workload Preview** | with no selection **495 rows** (fresh load). After selecting A (or Ilaneer) and moving by pill: **1 row, the selected Product only**; URL carries `product_id`; fixed-historical label still shown; chip shows Product/Family | **FAIL** against checklist C7 wording ("inherit no hidden filter") — see attribution below |
| 9–10 | Switch to B via Select Product (Effective Route Viewer) | chip → "Ashta Choornam (#115) · Family … (#11)"; URL `product_id=115`; viewer shows only Ashta; Assignments 1 row (Ashta); Workload Preview 1 row (Ashta, not A or Ilaneer); no stale data | PASS |

**Workload Preview attribution (flag-independent).** The same click path was repeated with (i) only `COSTING_PRM_NAV_CONTEXT_V1` removed and (ii) both flags absent. In both, selecting a Product by View effective route and moving by pill carried `product_id=<id>` in the URL and Workload Preview narrowed to that Product (1 row; Route Readiness stayed 592/unfiltered). With both flags OFF there is no chip at all, so the narrowing is invisible. Therefore the narrowing is **pre-existing legacy deep-link/URL carry behaviour, not introduced by N1 or N4**; with N4 ON the filter is at least disclosed by the Product chip. The N4 module header ("never given hidden filters or a run … Workload Preview") and checklist C7 are **not met in the browser for Workload Preview**. N4's own unit logic (`hydratePrmDeepLink`) is not the carrier — the URL parameter is — which should be confirmed in code by the owner of the PRM controller (not done here).

Classification of residual C overall: **PARTIAL — identity retention and Product replacement PASS; non-identity-lens isolation FAIL for Workload Preview (pre-existing), PARTIAL for Mapping Review/Historical Evidence, NOT TESTED for Foundation Review and Product-route-version retention.**

### Responsive (residual screens only)
- Real viewport emulation: CBM Manual Provisions 390; MCM Rates 390; PRM Effective Route Viewer with chips at **390** (dropdown nav; chips wrap onto two lines; ctx right edge 374; no clipping; no overflow) and **1280** (five group headings, no overflow, no dropdown). One screenshot taken at 390 for PRM and one for CBM; not generalised to other modules or widths.
- Earlier iframe-based measurements at 520/768/900 remain **iframe-based only**.

## 4. Browser errors and side effects
- Console errors: none (checked after each restoration).
- No write RPC observed from any action performed. Network wrapper recorded only `rpc_get_*` calls.
- Clipboard: the Browser pane reported that the page wrote to the OS clipboard during one synthetic click on a Product Assignments row (the pane's own notice; a page copy handler). The clipboard may contain a copied record identifier; owner advised to check before pasting.
- Two unintended read-only row drawers were opened (Dadimashtaka Choornam in Product Assignments); no action buttons were pressed in them except View effective route.

## 5. Flag restoration — PASS
| State | Value |
|---|---|
| Before testing | both keys `null` |
| After activation | `"1"` / `"1"` confirmed |
| Intermediate attribution runs | `PRM` removed, then both removed, then both re-set (each confirmed by `getItem`) |
| After `removeItem` ×2 and `location.reload()` | `getItem(...) === null` for both; `Object.keys(localStorage)` contains no `COSTING*` key; DOM has 0 `.cp-nav-group` and no `.cp-nav-context`; 13 flat pills and label "Production Route Manager → Effective Route Viewer" — the flag-OFF presentation; no console errors |
The first-pass restoration (earlier on 13 Nov) was verified identically.

## 6. Closure assessment (recommendation only)

1. **MCM/CBM scope notes:** PASS (Driver Governance has none by design).
2. **CSR cross-links:** both directions PASS for click → `_blank` `window.open` with correct URL/lens/period and no mutation; the actual new tab was not observed (popup blocker).
3. **PRM selected-product context:** Selection was possible, so not BLOCKED. Identity retention and Product replacement PASS; Workload Preview product narrowing is a reproducible FAIL against checklist C7, but flag-independent and pre-existing.
4. **Restoration:** verified again — PASS.
5. **Material gaps:** (a) the Workload Preview behaviour versus the C7/N4 statement (documentation-vs-behaviour discrepancy; needs an owner decision, not a WP07 regression); (b) Product-route-version retention (needs a Product with a Product route — none among those tested); (c) Foundation Review and Mapping Review isolation unprovable with this data.
6. **Reasonable bounded residuals:** E2–E4 (no additional identities); D1/U11 (excluded); full 73-asset re-run (12 Nov verifier relied on); C2 chip-wording on every CCC lens; actual new-tab observation; per-width screenshots; trace-pill presentation difference OFF vs ON.
7. **Recommendation: CONDITIONAL closure** for independent review — navigation grouping, default landings, permission boundary, deep links, Back/Forward, keyboard, responsive, scope notes, cross-links and Product replacement are demonstrated. The owner should (i) either accept the Workload Preview URL-carry as a pre-existing, now-disclosed behaviour or open a follow-up fix, and (ii) record the other residuals as accepted, before formal closure. WP07 is **not** closed here and the 7/13 count is unchanged.
