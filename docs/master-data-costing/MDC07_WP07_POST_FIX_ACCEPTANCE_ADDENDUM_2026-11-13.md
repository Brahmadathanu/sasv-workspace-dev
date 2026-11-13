# MDC-07 / WP07 — post-fix acceptance addendum (13 November 2026)

**Status: evidence addendum for independent review. WP07 remains OPEN; programme remains 7/13.** No closure, owner acceptance, deployment, flag change, SQL or permission action is recorded or implied. Issues #367 (coordination), #380 (defect). PR #386 (fix, merged `54e82ae`), PR #379 (original evidence, merged `5dee8c3`). Companion: [authenticated browser evidence](MDC07_WP07_AUTHENTICATED_BROWSER_ACCEPTANCE_EVIDENCE_2026-11-13.md) — its **pre-fix C7 FAIL for Workload Preview is historical and is not rewritten here**; this addendum supersedes it only in the sense that a correction has since been merged, and the correction is not yet confirmed on real data.

Legend as in the companion record: PASS · PARTIAL · FAIL · BLOCKED · NOT TESTED.

## 1. Hosted asset provenance — **HOSTED BUILD VERIFIED (server-side, 73/73) against main `5dee8c3`**

Run from a full-history checkout of `5dee8c3163ff08128ad938bd20c4203fcc643b55`, unauthenticated static GETs only, `verify-served-assets.mjs`, host `sasv-utilities-hub.netlify.app`, 13 Nov 2026 16:54 UTC:

| Expected commit | Verdict | Assets | Mismatch | Served digest | Cache |
|---|---|---|---|---|---|
| `5dee8c3` (current main) | **VERIFIED [HOSTED]** | 73/73 | 0 | `fd9e5f93…e110a` = expected | `hub-cache-v393` |
| `52ab809` (main before PR #386) | **MISMATCH** (control) | 72/73 | 1: `shared/js/costing-suite-production-route.js` | — | `hub-cache-v393` |

- Served `costing-suite-production-route.js` SHA-256 (LF-normalised) = `92df9fd8ea06f828978fd96bbe8ed7fe160a4c2ca9e801a74eec3e45741cc974` = the `5dee8c3` blob. The pre-fix commit differs on exactly that file, so the hosted site **serves the PR #386 correction**. Together with the dated merge, deployment is established by served bytes, not by GitHub state. Two HTML pages were verified after removal of the documented `NETLIFY_INJECTED_BANNER_V1` comment (hashes in the verifier JSON, not committed).
- The verifier does not list `costing-suite-scheme-audit-actor.mjs`; not re-checked here (unchanged since the earlier verified comparison; PR #386 touched neither it nor the shell).
- **Point-in-time only.** It proves what the server delivered at 16:54 UTC, not what an individual signed-in browser has activated.
- **Cache-name observation.** PR #386 changed a `public/` asset but `sw.js` still names `hub-cache-v393`. This does *not* leave the fix hidden: `sw.js` serves `/costing-suite-production-route*` network-first (explicit rule, comment "must not stay cache-first"), and the response headers are `cache-control: public,max-age=0,must-revalidate`. A browser that was online reloads the new controller. Offline-fallback copies could still be old. Recorded as a residual (R9), not a defect. Browser-side freshness (checklist A.4) is still to be recorded in the owner's session.
- Sandbox note: the 12 Nov checklist (A.5) classification rules apply: server-side verified, **browser not verified**.

## 2. Automated evidence re-run (this environment)

`scripts/costing-prm-workload-product-carryover/workload-product-carryover-browser.test.mjs` on `5dee8c3`, Linux, real Chromium, pure LF checkout: **20/20 pass, 0 fail/skip** (129 s). This independently reproduces, in LF, the author-reported result. **CRLF was not re-run here** (author-reported 20/20 in both modes). The suite uses mocked RPC data: it is regression evidence, **not authenticated real-data acceptance**. The 52 historical smoke failures reported on PR #386 as identical on main and branch were not re-examined.

Source review of the merged diff (+22/−2, controller only; shell byte-identical): `onLensExit()` (called by the shell only on tab/pill/select clicks) sets `prmTabEntryPending`; `loadPrmLens` consumes it; a Workload Preview tab entry ignores/removes a leftover `product_id`; `popstate` clears the mark so Back/Forward remain URL-authoritative; the Workload branch derives `state.product_id` from the current load only. Consistent with the three #380 requirements. Not exercised against real data: any path where `onLensExit` is not called by the shell (e.g. a non-shell navigation entry point).

## 3. Authenticated post-fix retest — **BLOCKED**

| Item | Result |
|---|---|
| Signed-in SASV session available to this cloud container | **No.** No storage state, token or signed-in browser profile; no attached machine; the Claude-in-Chrome/Desktop browser used on 13 Nov is not reachable from this session |
| Unauthenticated access | Static assets only (above). The PWA data screens need a Supabase session |
| Credentials | None were requested, entered, read or created. A `.env` file exists in the working tree; it was deliberately **not opened**, because using stored credentials would not be a legitimate existing signed-in browser session. No account created, no authentication bypass |
| Classification | **BLOCKED** for all of: Product→Workload tab (unfiltered), explicit deep link (filtered), identity-lens retention, flag-OFF baseline, flags ON (N1/N4), restoration. Nothing is inferred from the mocked tests |

### 3.1 Minimal manual checklist for the existing signed-in owner session (read-only)

Preconditions: the same account as 13 Nov (six Costing modules view-only). Flags used: **only** `COSTING_NAV_GROUPS_V1` and `COSTING_PRM_NAV_CONTEXT_V1`, browser-local, authorised on 13 Nov in chat; **re-confirm the authorisation applies to this retest**. U11 flags stay unset. No Save/Apply/Create buttons; do not open "Preview route candidate evidence" or the privileged preview. No tokens or e-mail in the record.

| # | Step | Expected | Result |
|---|---|---|---|
| P0 | DevTools → Console: `["COSTING_NAV_GROUPS_V1","COSTING_PRM_NAV_CONTEXT_V1"].map(k=>localStorage.getItem(k))` | `[null,null]` (else stop and record) | |
| P1 | Reload; run the A.4 console script from the checklist | `network_ok` all true for the 10 assets; add `/shared/js/costing-suite-production-route.js` with hash `92df9fd8ea06f828978fd96bbe8ed7fe160a4c2ca9e801a74eec3e45741cc974`; no `cached_ok:false` | |
| **Flags OFF** | | | |
| P2 | PRM → Workload Preview directly (fresh load, no selection) | Register unfiltered (**495 rows on 13 Nov; record today's count N**) | |
| P3 | Product Assignments → open row → **View effective route** (URL gains `product_id`) → click **Workload Preview** pill | URL has **no** `product_id`; register count = N (**not 1**) | |
| P4 | Paste `…?lens=shared-workload-preview&product_id=<id of that product>` in the address bar | Register scoped to that Product (1 row); URL keeps `product_id` | |
| P5 | From P4, click another lens pill, then Back, Forward | Back/Forward follow the URL (P4 state returns scoped) | |
| P6 | Effective Route Viewer (`product_id=<id>`) → Product Route Editor → Product Assignments | Product identity retained across identity lenses (URL `product_id` present) | |
| P7 | Route Readiness, Subgroup Mappings, Archived Routes with a Product selected | Counts equal the no-selection counts (13 Nov: 592 / 16 / 226) | |
| **Flags ON** | `localStorage.setItem("COSTING_NAV_GROUPS_V1","1"); localStorage.setItem("COSTING_PRM_NAV_CONTEXT_V1","1"); location.reload()` | | |
| P8 | Repeat P2–P4 | Same results; Product chip appears while a Product is selected, and the Workload pill click drops both the chip filter and `product_id` | |
| P9 | Select Product A, then B (Select Product box) and click Workload Preview | N rows, no stale A/B data | |
| P10 | Width 390 (real device emulation): P3 once | Same result; chips wrap, no horizontal overflow | |
| **Restore** | `localStorage.removeItem("COSTING_NAV_GROUPS_V1"); localStorage.removeItem("COSTING_PRM_NAV_CONTEXT_V1"); location.reload()` | | |
| P11 | `getItem` both → `null`; `Object.keys(localStorage)` has no `COSTING*`; flat pills, no `.cp-nav-group`/context bar; console clean | | |

Record any deviation as FAIL; never retry until green. A single P3 result of 1 row, or a surviving `product_id` in the URL, reopens #380.

## 4. Residual risk register (genuine classifications preserved)

| ID | Residual | Classification | Notes / what would close it |
|---|---|---|---|
| R1 | Workload Preview tab-click carry-over (#380) | **Fixed in source and served; real-data retest BLOCKED** | Historical C7 FAIL stands. Close with P2–P5, P8 |
| R2 | Explicit `product_id` deep link stays filtered | Mock Chromium PASS (20/20); **real data NOT TESTED** | P4, P8 |
| R3 | Identity-lens Product retention after the fix | Mock PASS; real data **NOT TESTED** post-fix (pre-fix PASS on 13 Nov) | P6, P9 |
| R4 | Product route-version (`product_route_id`) retention | **NOT TESTED** — no tested Product had a Product route | Needs an existing Product with a Product route (read-only view); do not create one |
| R5 | Role coverage E2–E4 (RM-only, PM-only, no-access identities) | **NOT TESTED** — only one existing identity (view-only, no trace permission) | Existing accounts only; never created or altered. E1 PASS stands |
| R6 | New-tab behaviour of cross-links (C5/C6) | **PARTIAL** — click → `window.open(…,"_blank","noopener,noreferrer")` with correct URL seen; actual second tab not observed (popup blocker) | Owner pressing the links in a normal tab, or accepted |
| R7 | Exact-run lens isolation (Mapping Review, Foundation Review, Historical Evidence Review) | Mapping Review/Historical Evidence **PARTIAL** (empty data cannot show filtering); Foundation Review **NOT TESTED**. The #380 mock suite includes "register / mapping / foundation lenses never receive the selected Product" — mock-only, not a substitute | Needs a Product/period with data in those lenses |
| R8 | D1 / U11 labels | **NOT TESTED** (not authorised; U11 not enabled) | Optional; isolated tests only |
| R9 | Stale/offline PWA copy of the controller | **Low, unverified in a browser**: network-first rule and `must-revalidate`; cache name unchanged at v393 | A.4 in the owner profile (P1); optionally bump the cache generation in a separate governed release (not proposed here) |
| R10 | CRLF re-run of #380 suite | Author-reported only | Not independently repeated here |
| R11 | Clipboard write by a Product Assignments row click (13 Nov notice) | Open observation | Owner to check clipboard; likely a page copy handler |
| R12 | Previously out-of-scope items (writers, #297 sensitive-view negative roles, #273 p95, combined eleven-flag build, Electron) | **NOT TESTED / out of WP07 scope** | Unchanged from the checklist |
| R13 | 52 pre-existing historical smoke failures and non-WP07 baseline failures | Pre-existing, not green; not WP07 | Tracked separately |
| R14 | C2 chip wording on every CCC lens; per-width screenshots; iframe-based 520/768/900 | **PARTIAL** (as in companion record) | Bounded; owner may accept |

## 5. Recommendation on formal WP07 closure

**Do not close WP07 yet; keep it OPEN at 7/13.** Reasoning:

1. The defect that blocked closure (#380) is corrected in source, served byte-exactly by the hosted site and passes its Chromium regression suite here — strong, but all of it is mocked data. The acceptance criterion was real-data behaviour in the signed-in app, which could not be run from this environment (BLOCKED, not PASS).
2. The retest is short (P0–P11, ~10 minutes, read-only, same already-authorised flags). Its outcome is binary and directly decides R1–R3.
3. Residual R4–R8 are genuine gaps (data or identities that do not exist, popup UI, U11). They are bounded and were already recorded as such; they are the owner's to accept explicitly, not to be reclassified.

Suggested path: owner runs §3.1 → record results as a further addendum; if P2–P9 and P11 PASS, recommend **CONDITIONAL closure** with R4–R8, R10–R14 recorded as accepted residuals by explicit owner decision (R9 cleared by P1); if any of P3/P8 fails, reopen #380. The status change and the programme count remain the owner's decision.

## 6. What this addendum did not do

No sign-in, flag, write, RPC, SQL, permission change, account creation, deployment, PR merge or issue status change. Verifier JSON output was kept outside the repository.
