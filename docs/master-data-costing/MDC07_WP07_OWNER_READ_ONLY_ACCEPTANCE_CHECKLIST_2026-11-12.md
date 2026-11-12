# MDC-07 / WP07 — owner-operated signed-in acceptance checklist (12 November 2026, revised after independent review)

**Status: PREPARED, NOT EXECUTED, NOT YET AUTHORISED for Part C.** Revised after the independent review of PR #368 (review of 12 Nov 2026). WP07 stays **OPEN** and the programme **7/13** until the owner decides after reading the results. Companion: [closure evidence record](MDC07_WP07_BULK_VERIFICATION_AND_CLOSURE_EVIDENCE_2026-11-12.md).

## How this checklist is split (and what needs what)

| Part | What it is | Needs sign-in? | Changes anything in your browser? | Authorisation |
|---|---|---|---|---|
| **A — Hosted build provenance** | Prove the hosted site serves the reviewed source | No (public static GETs) | No | None beyond running it. Already run once by the reviewer-side agent (§A.3) |
| **B — Flag-OFF baseline** | Look at the six modules as they are today | Yes | No (flags stay absent) | Owner's own session, read-only |
| **C — Flag-ON controlled acceptance** | Browser-local activation of `COSTING_NAV_GROUPS_V1` (and N4's flag) to look at the new navigation | Yes | **Yes — it writes `localStorage` in that browser** | **Requires an explicit, separate owner decision. NOT GIVEN.** Do not start Part C without it |
| **D — Optional U11 labels** | Two more browser-local flags | Yes | **Yes** | Separate explicit decision; not needed for navigation acceptance |
| **E — Role-based checks** | Existing accounts only | Yes | No | Only with identities that already exist; anything else = NOT TESTED |

Part C is *not* "just reading": a flag in `localStorage` changes what that browser executes. It is local to one browser profile, but it is still a controlled activation and is treated as such here. Nothing in this document enables any flag for anyone else, edits permissions, creates accounts, deploys, or runs a writer.

## Ground rules (all parts)

1. **Read-only.** Navigate, look, Back/Forward, resize. Do not press Save, Apply, Approve, Recalculate, Close, Import, Upload or any button that writes. Do not open the privileged Production Route preview. No SQL.
2. **Existing accounts only.** Use the restored trial account (six Costing modules View = true, Edit = false) and your own owner account. Do **not** change the trial account, and do **not** create new users, roles or permission combinations. If an identity you need does not already exist, mark that row **NOT TESTED**.
3. No tokens, JWTs, e-mail addresses or screenshots that show them in the repository or an issue.
4. Mark each row **PASS / FAIL / NOT TESTED**; record failures as failures; never retry until green.
5. If Part A does not give `VERIFIED`, every later result describes **an unverified hosted build** and the whole session is classified **HOSTED BUILD NOT VERIFIED**; no row may then be reported as acceptance PASS.

## Part A — hosted build provenance (service-worker cache name is NOT proof)

`hub-cache-v393` only says which cache generation the worker names; it can be identical across different JavaScript bytes. Proof is byte equality of the served assets with a named Git commit, using the **existing** repository mechanism `scripts/costing-acceptance/verify-served-assets.mjs` (unauthenticated static GETs only; no login, cookies, API calls or writes; fails closed).

**A.1 Expected source.** Git commit `3a93432713bf86203d1e0c6ad5ebac1ce34a2413` (exact main reviewed by PR #368). PR #368 changes no file under `public/`, so its merge commit serves the same assets; if the owner's hosted build was deployed from a later commit, run the command with **that** commit's full 40-hex SHA (taken from Netlify → Deploys → Published deploy, not guessed) and compare against that instead. Expected bundle digest at `3a93432`: `c5a7bf14d89601f8196d97116e198425d582f77feef8e9d9dbbada849ceb0c69` (73 assets, cache `hub-cache-v393`). Full per-asset list: [`MDC07_WP07_EXPECTED_ASSET_MANIFEST_3a93432_2026-11-12.tsv`](MDC07_WP07_EXPECTED_ASSET_MANIFEST_3a93432_2026-11-12.tsv). Navigation-relevant assets (SHA-256 of LF-normalised bytes):

| Asset (under `public/`) | Expected SHA-256 |
|---|---|
| `shared/js/costing-nav-groups.js` | `60f8fc9a098442803ec7f20832467ba9a28d89b1bf535b35b296c30d884b35af` |
| `shared/js/costing-nav-context.js` | `e18a79e3f23f4e9a7ec9e12436006ba1772b31097f72d5ae85d3ceba3dc0c6d5` |
| `shared/js/costing-suite-shell.js` | `8b6fd71556a096739ddd11bed8da4707f6552ad33cc885c3e5a4de966829d986` |
| `shared/js/costing-suite-material-cost.js` | `76dd6f9bd00e760e498cf15a3cf677ff3d1a8debea9593aa76950bf6c7e81a46` |
| `shared/js/costing-suite-cost-build.js` | `7744d230338e2337a0761515621d51d9df5c40ef43fb80c77b84786ae459de8d` |
| `shared/js/costing-suite-pricing-policy.js` | `0102b5897c3ba0f40d14735583511d2f2bc2ebd70b5b440c09efc503c41cd8cb` |
| `shared/js/costing-suite-production-route-nav-context.js` | `e2cf2d607e6a0d2da74385a4f2038e6bf979baecda24a6939c9bd60d6da54b08` |
| `shared/js/costing-status-labels.js` | `b656d7ae6d54b87a75b0a4459004f9f163b4f00cf3a69c42330285c9fbf3370a` |
| `shared/js/costing-feature-flags.js` | `5e298c2e86ecfc35e2e8bb868fd8cbf8b907ab08b72c29eafcf02602116228e0` |
| `sw.js` | `d76fbb30378449b07b088b54e3c7a21285c31e2147d13f0fd1f4bcce6f5fdc46` |

**A.2 Command** (from a full-history checkout that contains the commit; no sign-in; never use `--allow-local-self-test` for hosted evidence):

```
node scripts/costing-acceptance/verify-served-assets.mjs https://sasv-utilities-hub.netlify.app 3a93432713bf86203d1e0c6ad5ebac1ce34a2413 --expect-cache hub-cache-v393 --json hosted-report.json
```

Exit 0 = `VERIFIED`; 1 = `MISMATCH`; 3 = `NOT_VERIFIED` (unreachable/denied: no evidence either way). The verifier accepts exactly one documented Netlify edge comment (`NETLIFY_INJECTED_BANNER_V1`) on served HTML and records raw and normalised hashes. It does **not** list `costing-suite-scheme-audit-actor.mjs`; compare it separately: `curl -sS <host>/shared/js/costing-suite-scheme-audit-actor.mjs | sha256sum` should equal `a107eaa1f63d91f5df5c7fe46d8a4808ac7dfc043832c7c233c1cb275ecc3b4d`.

**A.3 Result already observed (point in time, not a substitute for re-running):** 12 Nov 2026 17:22 UTC, host `sasv-utilities-hub.netlify.app`, against `3a93432`: **`VERIFIED [HOSTED]`, 73/73 assets match, 0 mismatches, served bundle digest = expected, served cache `hub-cache-v393`, 2 HTML files verified after removal of the documented Netlify banner** (cost-build-manager.html and costing-control-center.html, raw hashes recorded in the JSON report), and the actor `.mjs` hash matched. This establishes that, at that moment, the **server delivered** byte-identical Costing assets to `3a93432`. It does **not** establish what an individual owner browser has *activated*: an installed PWA can still run an older cached copy until its service worker updates. That is checked in A.4. No deployment or modification of the hosted application was performed.

**A.4 In the owner's browser (read-only):** open the app, DevTools → Application → Service Workers: record the worker state (activated / waiting) and Cache Storage name. Then in the Console run the following, which only **reads** (GET with `cache: "no-store"` for what the network serves now, and `caches.match` for what this browser has cached) and prints a table; it writes nothing:

```js
(async () => {
  const want = {"/shared/js/costing-nav-groups.js":"60f8fc9a098442803ec7f20832467ba9a28d89b1bf535b35b296c30d884b35af","/shared/js/costing-nav-context.js":"e18a79e3f23f4e9a7ec9e12436006ba1772b31097f72d5ae85d3ceba3dc0c6d5","/shared/js/costing-suite-shell.js":"8b6fd71556a096739ddd11bed8da4707f6552ad33cc885c3e5a4de966829d986","/shared/js/costing-suite-material-cost.js":"76dd6f9bd00e760e498cf15a3cf677ff3d1a8debea9593aa76950bf6c7e81a46","/shared/js/costing-suite-cost-build.js":"7744d230338e2337a0761515621d51d9df5c40ef43fb80c77b84786ae459de8d","/shared/js/costing-suite-pricing-policy.js":"0102b5897c3ba0f40d14735583511d2f2bc2ebd70b5b440c09efc503c41cd8cb","/shared/js/costing-suite-production-route-nav-context.js":"e2cf2d607e6a0d2da74385a4f2038e6bf979baecda24a6939c9bd60d6da54b08","/shared/js/costing-status-labels.js":"b656d7ae6d54b87a75b0a4459004f9f163b4f00cf3a69c42330285c9fbf3370a","/shared/js/costing-feature-flags.js":"5e298c2e86ecfc35e2e8bb868fd8cbf8b907ab08b72c29eafcf02602116228e0","/sw.js":"d76fbb30378449b07b088b54e3c7a21285c31e2147d13f0fd1f4bcce6f5fdc46"};
  const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t.replace(/\r\n/g, "\n"))))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const rows = [];
  for (const [p, h] of Object.entries(want)) {
    const net = await (await fetch(p, { cache: "no-store" })).text();
    const hit = await caches.match(p);
    rows.push({ path: p, network_ok: (await sha(net)) === h, cached_ok: hit ? (await sha(await hit.clone().text())) === h : "not cached" });
  }
  console.table(rows);
})();
```

`network_ok` all true ⇒ the network copy equals the reviewed source for these assets (HTML pages are not included). `cached_ok` must be true or `"not cached"`; **any `false` means the browser would run stale code** — record it, do not proceed to Part C in that profile, and do not "fix" it by deploying. (Pages served with Netlify's banner are verified by A.2, not here.)

**A.5 Classification (mandatory wording):**

| Outcome | Record as |
|---|---|
| A.2 `VERIFIED` and A.4 shows no `false` | **HOSTED BUILD VERIFIED** (server-side exact; browser state recorded) |
| A.2 `VERIFIED`, A.4 not run or has `false`/stale worker | **HOSTED BUILD VERIFIED SERVER-SIDE ONLY; BROWSER NOT VERIFIED** — later rows are provisional |
| A.2 `MISMATCH` or `NOT_VERIFIED`, or the deployed SHA is unknown | **HOSTED BUILD NOT VERIFIED** — never PASS |

## Part B — flag-OFF baseline (read-only, no flags touched)

| # | Do | Expect |
|---|---|---|
| B0 | Console: `localStorage.getItem("COSTING_NAV_GROUPS_V1")`, `…("COSTING_PRM_NAV_CONTEXT_V1")` | Both `null`. If not, **stop and record**; do not remove or alter anything without owner say-so |
| B1 | Sign in as the View-only trial account; open the six modules from the launcher | Flat pill strip and "lens" label as before the programme (OFF baseline); note anything unexpected |
| B2 | Click every visible destination in each module once | No group headings, no breadcrumb/context bar |
| B3 | Pricing Policy Manager: open each of the ten workspaces | Original three-group workspace navigation |
| B4 | Open three `?lens=` URLs of one module in turn, then Back, Back, Forward | Active destination follows the URL (in-page pill clicks do not create history entries; existing behaviour) |
| B5 | Widths 1280 / 900 / 768 / 520 / 390 (DevTools device toolbar) on each module with real data | No horizontal page scrollbar; header actions incl. Home stay on screen |

## Part C — flag-ON controlled acceptance (**requires separate explicit owner authorisation — NOT GIVEN**)

Proceed only after the owner has written (issue/PR comment or chat) something equivalent to: *"I authorise browser-local activation of COSTING_NAV_GROUPS_V1 [and COSTING_PRM_NAV_CONTEXT_V1] in my own browser profile for WP07 acceptance, to be removed afterwards."* Record the authorisation reference in the result table. Use a **dedicated browser profile** if possible so the flag cannot leak to everyday use.

**Activate (this browser profile only, nothing else):**
```js
localStorage.setItem("COSTING_NAV_GROUPS_V1", "1");
localStorage.setItem("COSTING_PRM_NAV_CONTEXT_V1", "1");   // only for row C7/C8 (N4); omit otherwise
location.reload();
```
**Restore (always, even after a failure):**
```js
localStorage.removeItem("COSTING_NAV_GROUPS_V1");
localStorage.removeItem("COSTING_PRM_NAV_CONTEXT_V1");
location.reload();
// then confirm: both getItem(...) return null, and Part B row B2 looks as before
```

| # | Do | Expect |
|---|---|---|
| C1 | Open each of the six modules | Groups: CCC Overview/Workbench/SKU Review; MCM Rates/Traces; CBM Mapping & classification/Provisions/Policy approval; CSR Review/Documents/Action Queues; PRM Readiness/Assign & Map/Build/Review/History; PPM five groups. Every destination from B2 still present once; default landing unchanged |
| C2 | Breadcrumb/context bar | `Module › Group › Destination`; basis chip LIVE_AS_OF / run-scoped / "Fixed historical context … not the current costing run"; no Product/Family/Route/Run chip unless selected |
| C3 | MCM Traces group, **with whichever existing account you are signed in as** | Shows exactly the RM/PM trace entries that account's existing view permission allows (record which); a hidden entry is unreachable by `?lens=` URL without the restricted message and without data |
| C4 | MCM and CBM tab strips | One-line scope notes (N2 wording) |
| C5 | Cost Sheet Review → Scheme Comparison: row with its own period and SKU | "SKU policy overview ↗" opens PPM SKU Policy Overview in a **new tab**, period carried; nothing changes |
| C6 | QC and Materials & Stores Action Queues | "Open … Action Queue" sibling link, new tab |
| C7 | PRM (N4 flag): select a Product on Product Assignments → Product Route Editor → Effective Route Viewer → Historical Evidence Review | Selection remembered across identity lenses; Readiness, Workload Preview, Mapping/Foundation Review and fixed-historical lenses inherit no hidden filter or run |
| C8 | PRM: click lenses quickly, then pick a different Product | Final screen matches last click; no earlier Product's data |
| C9 | PPM `?workspace=sku-overview`, `?workspace=scheme-master`, legacy `?lens=policy-manager` | Same workspace as with the flag OFF |
| C10 | Back/Forward over three `?lens=` URLs | Active destination and breadcrumb follow the URL |
| C11 | Tab through navigation, Enter on a pill; widths 1280/900/768/520/390 on populated data | Visible focus ring; Enter switches; no horizontal page overflow; ≤ 520 px dropdown with group headings |

## Part D — optional U11 label check (separately authorised; skip freely)

Not required for navigation acceptance and **not part of Part C's authorisation**. Needs a second explicit owner decision naming `COSTING_REVIEW_WORKLIST_V1` and `COSTING_UX_CONSISTENCY_V1` (the worklist that shows the labels is behind the first). Do not enable either merely to complete WP07; if not authorised, record D1 **NOT TESTED** (this does not block WP07 navigation acceptance; U11 is covered by isolated tests).

| # | Do | Expect |
|---|---|---|
| D1 | With both flags set to `"1"` in the same browser profile, open the Control Centre review worklist | Group labels read "Material cost blocked", "Material review required", "Prime cost review required", "Pricing bridge review required"; counts, filters, sort and CSV export unchanged (raw codes in export). Restore: `removeItem` both keys |

## Part E — role-based checks (existing identities only)

| # | Identity | Expect |
|---|---|---|
| E1 | Existing six-module View-only trial account (unchanged) | Covered by Part B/C rows; record which trace entries it shows |
| E2 | An existing RM-trace-only account, **if one already exists** | RM trace shown, PM trace hidden |
| E3 | An existing PM-trace-only account, **if one already exists** | PM trace shown, RM trace hidden |
| E4 | An existing account with no Costing module access, **if one already exists** | Existing access-denied behaviour on each module URL, unchanged |

If an identity does not already exist, the row is **NOT TESTED**. Do not create it, edit permissions, or alter the trial account to obtain it. The synthetic role matrix in the N2 mock tests is not authenticated evidence.

## What this checklist deliberately does not do

It does not test writers, approvals, recalculation, the privileged Production Route preview, the seven sensitive-view negative-role GETs (#297), Cost Comparison p95 (#273), the eleven-flag combined build, Electron/Windows (WP12 or separately governed), and it does not enable any flag for anyone else or deploy anything.

## Result record (owner fills in)

Hosted build classification (A.5): ____________  Deployed SHA (Netlify): ____________  Worker state/cache: ____________
Part C authorisation reference: ____________  Date: ____________  Browser profile: ____________

| Row | PASS / FAIL / NOT TESTED | Note |
|---|---|---|
| A.2 / A.4 | | |
| B0–B5 | | |
| C1–C11 | | |
| D1 (optional) | | |
| E1–E4 | | |
