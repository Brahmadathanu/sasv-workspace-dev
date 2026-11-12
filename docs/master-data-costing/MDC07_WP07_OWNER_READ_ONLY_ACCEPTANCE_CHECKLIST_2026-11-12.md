# MDC-07 / WP07 — owner-operated signed-in, read-only acceptance checklist (12 November 2026)

**Status: PREPARED, NOT EXECUTED.** Nothing here has been run against production. Executing it needs the owner's own signed-in browser; it is the only evidence that can move the WP07 rows marked *NOT TESTED* in [the closure evidence record](MDC07_WP07_BULK_VERIFICATION_AND_CLOSURE_EVIDENCE_2026-11-12.md). WP07 stays **OPEN** and the programme stays **7/13** until the owner decides after reading the results.

## Ground rules (read first)

1. **Read-only.** Navigate, look, press Back/Forward, resize the window. Do **not** press Save, Apply, Approve, Recalculate, Refresh-run, Close, Import, Upload or any button that writes. Do not open the privileged Production Route preview. Do not run SQL.
2. **No permission or account changes.** Use the already-restored trial account (six Costing modules View = true, Edit = false) and your own owner account. Do not edit the trial account's permissions. Do not paste tokens, JWTs, e-mail addresses or screenshots showing them into the repository or an issue.
3. **Feature flag is browser-local only.** The flag exists only in *your* browser's `localStorage` and never changes what other users see. Turn it on only in the browser you are testing in, and **remove it at the end** (step 0 and step 9). Do not set any other flag than those named in section B. No Netlify, service-worker or Electron action is needed.
4. **Record the exact build.** Open DevTools → Application → Service Workers / Cache Storage and note the active cache name (the repository currently designates `hub-cache-v393`), plus the page URL host. If the hosted build is older than the commit under test, write that down — results then describe that build, not this commit.
5. Mark each row **PASS / FAIL / NOT TESTED** and add one line of what you saw. A failure is recorded as a failure; do not retry until it passes.

## Step 0 — start state

| # | Do | Expect |
|---|---|---|
| 0.1 | In DevTools console run `localStorage.getItem("COSTING_NAV_GROUPS_V1")` and `localStorage.getItem("COSTING_PRM_NAV_CONTEXT_V1")` | Both `null` (flags OFF). If not `null`, run `localStorage.removeItem(...)` for that key and reload |
| 0.2 | Sign in with the trial account (View-only) and open each of the six Costing modules from the launcher | Each opens; navigation looks exactly as before this programme (flat pill strip, "lens" label). This is the **OFF baseline** — note anything unexpected |

## A — flag OFF baseline (N1, W6, U11 parity) — trial account

| # | Do | Expect |
|---|---|---|
| A1 | In each of the six modules click every visible destination once | Same destinations and order as the OFF baseline in 0.2; no group headings, no breadcrumb/context bar |
| A2 | In Pricing Policy Manager open each of the ten workspaces | Original three-group workspace navigation |
| A3 | Only if the review worklist is visible in your build (it is behind `COSTING_REVIEW_WORKLIST_V1`; do not enable it just for this) | Group labels in legacy Title Case (e.g. "Material Cost Blocked") — i.e. no U11 sentence case. Otherwise mark NOT TESTED |
| A4 | Press browser Back and Forward after opening a destination via a bookmarked `?lens=` URL | Lands on the same destination as the URL says |

## B — flag ON, View-only account (N1, N2, N3, N4, W6, U11)

Set the flag in this browser: `localStorage.setItem("COSTING_NAV_GROUPS_V1","1"); location.reload();` (and for N4 only: `localStorage.setItem("COSTING_PRM_NAV_CONTEXT_V1","1")`; add `COSTING_REVIEW_WORKLIST_V1` = `1` and `COSTING_UX_CONSISTENCY_V1` = `1` only if you want to look at U11 labels; the worklist that shows them is behind the first of those two).

| # | Do | Expect |
|---|---|---|
| B1 | Open each of the six modules | Destinations grouped: CCC Overview/Workbench/SKU Review; MCM Rates/Traces; CBM Mapping & classification/Provisions/Policy approval; CSR Review/Documents/Action Queues; PRM Readiness/Assign & Map/Build/Review/History; PPM five groups (SKU policies, MRP, MRP change workflow, Schemes, Costing inputs). Every destination from A1 is still present exactly once; the default landing destination is unchanged |
| B2 | Look at the breadcrumb/context bar on each lens | `Module › Group › Destination`; the basis chip says LIVE_AS_OF, run-scoped or "Fixed historical context … not the current costing run" as appropriate. No Product/Family/Route/Run chip appears unless you have selected one |
| B3 | MCM as the View-only account: look at the Traces group | **Record exactly what is shown.** Entries for RM trace and PM trace appear only if this account really holds the matching view permission (the permission check is the existing one; the navigation only hides, never grants). A hidden entry must not be reachable by a bookmarked `?lens=` URL without the in-page restricted message and without data |
| B4 | MCM and CBM: look above the tab strip | One-line scope note per the N2 wording (Rates / Mapping & classification / Provisions) |
| B5 | CSR Cost Sheet Review → Scheme Comparison: open a row that has its own period and SKU | "SKU policy overview ↗" link opens Pricing Policy Manager › SKU Policy Overview in a **new tab**, period carried; no data changes |
| B6 | CSR → QC Action Queue and Materials & Stores Action Queue | Each queue's detail panel has an "Open … Action Queue" link to its sibling in a new tab |
| B7 | PRM (needs N4 flag): select a Product on Product Assignments, switch to Product Route Editor, then Effective Route Viewer, then Historical Evidence Review | Selected Product (and route/Family where applicable) is remembered across the identity lenses; Readiness, Workload Preview, Mapping/Foundation Review and the fixed-historical lenses do **not** inherit a hidden filter or run |
| B8 | PRM: click lenses quickly several times, then pick a different Product | Final screen matches the last click; no previous Product's data appears (stale-response protection) |
| B9 | PPM: open `?workspace=sku-overview`, `?workspace=scheme-master`, `?lens=policy-manager` (legacy) by URL | All resolve to the expected workspace, with the same workspace ON and OFF |
| B10 | U11 (only if both `COSTING_REVIEW_WORKLIST_V1` and `COSTING_UX_CONSISTENCY_V1` are `1`): Control Centre review worklist groups | Four labels read "Material cost blocked", "Material review required", "Prime cost review required", "Pricing bridge review required"; counts, filters, sort order and CSV export unchanged (raw codes in export) |
| B11 | Back/Forward: open three different `?lens=` URLs of one module in turn, then Back, Back, Forward | Active destination and breadcrumb follow the URL each time. (In-page pill clicks do not create history entries; that is the existing behaviour with the flag OFF too.) |

## C — responsive and keyboard (flag ON, any account)

| # | Do | Expect |
|---|---|---|
| C1 | At window widths 1280, 900, 768, 520 and 390 px (DevTools device toolbar or a narrowed window), open each of the six modules | No horizontal page scrollbar; at ≤ 520 px the destinations are a dropdown with group headings; at 521–900 px the group strip scrolls inside its own container; header actions (incl. Home) stay on screen |
| C2 | Tab through a module's navigation, press Enter on a pill | Visible focus ring; Enter switches destination; the active destination is announced/outlined once |
| C3 | Repeat C1 on populated data (not an empty state) for Cost Sheet Review and Control Centre | Real tables do not push the page wider than the viewport |

## D — owner-account only (only if the owner wishes; same read-only rules)

| # | Do | Expect |
|---|---|---|
| D1 | Repeat B3 with an account that holds RM-trace-only, PM-trace-only, both and neither (use the existing accounts; do **not** change permissions to create them) | Navigation shows exactly the traces the account may view; deep links to others show the restricted message |
| D2 | A restricted (no-module) account: open each module URL | Existing access-denied behaviour, unchanged |

## Step 9 — restore

`localStorage.removeItem("COSTING_NAV_GROUPS_V1"); localStorage.removeItem("COSTING_PRM_NAV_CONTEXT_V1"); localStorage.removeItem("COSTING_UX_CONSISTENCY_V1"); localStorage.removeItem("COSTING_REVIEW_WORKLIST_V1"); location.reload();` then confirm A1 again. Sign out of the trial account.

## What this checklist deliberately does not do

It does not test writers, approvals, recalculation, the privileged Production Route preview, the seven sensitive-view negative-role GETs (#297), Cost Comparison p95 (#273), the eleven-flag combined build, Electron/Windows (all WP12 or separately governed), and it does not turn any flag on for anyone else.

## Result record (owner fills in)

Build / cache name: ____________  Date: ____________  Browser: ____________

| Row | PASS / FAIL / NOT TESTED | Note |
|---|---|---|
| 0.1–0.2 | | |
| A1–A4 | | |
| B1–B11 | | |
| C1–C3 | | |
| D1–D2 | | |
