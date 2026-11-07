# Issue #206 automated screen acceptance and #208 fix — consolidated report (7 Nov 2026)

Base: `818a6da49b9a2d86e65de41a7297196f8a3c0862` (main, PR #207). Draft only; nothing merged, deployed, granted or flagged. Formal closure stays **5/13**.

## Evidence classes (read this first)

| Claim | Class | Result |
|---|---|---|
| Hosted served-asset SHA verification (72 assets) of `https://sasv-utilities-hub.netlify.app/` | HOSTED | **NOT TESTED** — the Claude container's egress proxy returns `403 CONNECT tunnel failed` for the Netlify host (same as the earlier DNS failure). No screenshot or local mock is counted as a digest pass. |
| Signed-in ID-V acceptance of any lens | AUTHENTICATED | **NOT TESTED** — requires a storage state captured by the owner; none exists. The existing over-privileged account was not used. |
| 40-lens × 390/1280 render suite | LOCAL SELF-TEST (inert fake backend, commit tree served by `git archive`, stubbed supabase-js) | see below — proves runner + page chrome only, **not** the hosted build or real data |
| #208 evidence-table scroll regression | LOCAL Chromium (real CSS, injected markup mirroring the renderer) | fix verified locally; **hosted re-verification NOT TESTED** |

## Local self-test suite (LOCAL_SELF_TEST, matrix `standard`, screenshots kept outside the repo)

- 119 observations, all pages ready; 53 at 390 px, 66 at 1280 px.
- Inventory: 4+3+4+10+6+13 = **40 lenses/workspaces discovered, expected 40**, no mismatch. 80/80 lens×width pairs rendered (390 and 1280).
- Page-level horizontal overflow >1 px: **0**. Console/page errors: **0**. Blocked or violating requests: **0** (deny-by-default barrier never fired). Costing flags restored: true.
- Network names observed were all `get_user_permissions`, `rpc_get_*` and REST GETs against `v_*` views (plus the app-documented `rpc_costing_health_check`, reported as unverifiable server-side).
- Data claim: **NOT TESTED for 117/119** (inert backend returns no rows); this is a limitation of the fake, not a pass. Period switch: 2 observations could select a period; the remainder are **NOT TESTED** (the fake backend exposes no period options).
- Finding to confirm on the real build: with all eleven flags ON the CCC dashboard shows an **enabled "Close quarter (lock months)" control** to the view-only identity (runner flags `WRITE_CONTROL_ENABLED`, 390 and 1280). The runner only observed it; it was never clicked. Under the local fake the permission/role state is not representative, so this must be re-checked with genuine ID-V before it is classed a bug (server-side RPC authorisation is the real barrier).
- Per-lens P/F/NT: render PASS and security (no write attempt) PASS for every lens/width except the CCC ALL_ON dashboard above (security FAIL by the runner's strict "enabled write control" rule); data NT everywhere except where the fake returned rows.

## Issue #208 — Exact Material Evidence table clipped on mobile

Reproduced in Chromium at 390 px (real `sasv-costing.css`, real `costing-control-center.html`, nine-column markup in `#drawerContent`):

| | 390 px before | 1280 px before |
|---|---|---|
| `#drawerContent` overflow-x | **hidden** (mobile media rule) | auto |
| `.cp-evidence-table-scroll` overflow-x | **visible** (no rule existed) | visible |
| table width / wrapper client width | 1140 / 364 | 1140 / 614 |
| touch swipe | no movement; columns after Area unreachable | n/a (drawer scrolled) |

Root cause: the drawer body is `overflow-x:hidden` on phones and the wrapper emitted by `renderDenseMaterialEvidenceTable()` had no styles.

Fix (CSS only, 11 lines, appended): `body.sasv-costing .cp-evidence-table-scroll { max-width:100%; overflow-x:auto; overflow-y:visible; overscroll-behavior-x:contain; -webkit-overflow-scrolling:touch; }`. The same wrapper also protects the affected-lines table. No JS, data, role or read-only behaviour changed; the main SKU table and its future card redesign are untouched (park under WP11).

Tests (`scripts/costing-acceptance/evidence-table-scroll.test.mjs`): 390 px real CDP touch drags reach the far end and the Trace header is fully visible with no page bleed; 1280 px parity; static scoping check. Verified to **fail without the fix (3/3 red)** and pass with it. Full acceptance suite: 31/31 pass. Line endings of the touched CSS are LF (unchanged).

Not done on purpose: `public/sw.js` cache name not bumped (owner instruction: do not touch service-worker cache). Because browsers may serve the old cached CSS, the owner/release step must decide the cache bump when this is deployed.

## Closure-gate matrix (unchanged)

| Gate | Status |
|---|---|
| WP05, WP06, WP12 signed-in evidence | NOT TESTED (no hosted verification, no authenticated session) |
| #208 mobile evidence table | local fix verified; hosted **FAIL until redeployed and re-verified** |
| Formal closure | 5/13, no change |

## Exact next owner action (only one is truly indispensable)

1. On the owner's computer, one short supervised login: `node scripts/costing-acceptance/capture-storage-state.mjs --base https://sasv-utilities-hub.netlify.app --out <path outside repo>` signing in as `balublablee@gmail.com` personally (never paste credentials/session anywhere), `chmod 600` the file.
2. Run `verify-served-assets.mjs` then `acceptance-runner.mjs` from a network that can reach Netlify (that computer), with the canonical proof generated earlier. The runner re-checks session/canonical parity before collecting evidence.
3. Review/merge this draft PR and decide the deploy + cache bump; then re-run on hosted for #208.
