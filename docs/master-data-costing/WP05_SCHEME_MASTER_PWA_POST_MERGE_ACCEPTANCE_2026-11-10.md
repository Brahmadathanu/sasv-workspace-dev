# WP05 — Scheme Master PWA post-merge acceptance (10 November 2026)

**State: HOSTED/PWA ACCEPTANCE NOT VERIFIED.** **Merged source**: PR #263 `cf41740ec054dac7cabd1df343eb4b0b67d5bd60` (explicit 31-column Scheme Master read) and PR #265 `ff2e79bb3a31a44489a426516e8fa35755cc77ae` (Pricing Policy module network-first with offline cache fallback; `hub-cache-v393` unchanged). This is **not** a new SQL task or Electron release. WP05 remains OPEN, formal programme 6/13; original historical AE1 #19 remains F with separately bounded recovery evidence.

## A. What is already proven

1. GitHub `main` has **31 explicitly named Scheme Master list fields**, excludes `viability_snapshot_count`, `viability_snapshot_period_count`, `latest_viability_snapshot_period`. Live SQL 31-column list materialization previously returned 7 rows within an imposed 3-second statement limit, while the full-column query failed under its separately imposed 5-second limit. Neither SQL test was an authenticated browser call.
2. The merged service worker has **network-first** `costing-suite-pricing-policy.js` and cached fallback if offline; other ordinary static JS remains cache-first; cache name is **`hub-cache-v393`**. New mocked-SW test 8/8 reported PASS by Claude; Scheme Master source projection test 3/3 reported PASS.
3. The four historical W6 #10–13 tests failed **both PR-head and unchanged main**, so are pre-existing historical pin mismatch, not evidence PR #265 broke PPM operations. Tests remain failed and should not be described as CI passing.
4. The historical source records identify `https://sasv-utilities-hub.netlify.app` as the intended Netlify host and `main` as deployment source. This does not independently prove the latest Netlify published commit.

## B. Current tool-access limitation (10 Nov)

Attempts to retrieve both `https://sasv-utilities-hub.netlify.app/sw.js` and `https://sasv-utilities-hub.netlify.app/shared/js/costing-suite-pricing-policy.js` through the public web access tool returned **inaccessible**. A separate container HTTPS request failed DNS name resolution for the same host. **These are environment egress/lookup limitations, not evidence of an HTTP failure on the deployed site.** No statement about the current Netlify production deploy commit, current users' activated worker version, or authentic browser request result follows.

## C. The smallest practical acceptance route

### C1. From the phone — useful preliminary functional check

1. Open the installed SASV Utilities Hub PWA **while connected to the internet**. First, visit the actual PWA (normal opening) and reopen/reload it to permit a service-worker update check; the changed worker may need an additional navigation for activation.
2. Open **Pricing Policy Manager → Scheme Master**. Observe whether the table loads seven schemes, whether the "Viability Periods" column is `--` (pre-existing SQL/renderer mismatch), whether any error or long spinner appears, and whether switching away/back works. Do **not** use Create/Edit/Deactivate or any writer action.
3. If possible, record **device, approximate local IST time, PWA versus normal browser, number of rows, and any error** in a private chat note. Avoid screenshots containing real business/product details in public GitHub. A mobile success is functional smoke only; **not** 1280 px authenticated desktop reliability proof or a signed asset comparison.

### C2. Served-asset identity (requires a network/operator able to reach Netlify)

1. In Netlify **Deploys**, check production published deploy status and commit; record the **exact** deployed SHA (not merely that GitHub main includes #265). Compare with the latest reviewed source commit as of validation. A docs-only main commit later than #265 is not a requirement to change JavaScript bytes.
2. From a clean network, verify the served `/sw.js` still contains the exact Pricing Policy network-first expression and `hub-cache-v393`, and the served `/shared/js/costing-suite-pricing-policy.js` contains `SCHEME_MASTER_LIST_SELECT` with 31 explicit columns and no `.select("*")` in the Scheme Master read site. Prefer byte-digest comparison to the appropriate git commit, using the existing `scripts/costing-acceptance/verify-served-assets.mjs` with the real base URL and **verified exact git SHA**, rather than just searching text.
3. Record fetched asset digest/HTTP status and time. Do **not** assume Netlify source provenance from local git `main` alone or fabricate a result when the host is inaccessible.

### C3. Existing installed PWA update acceptance

1. On an installed PWA that already had older cached Pricing Policy JS, verify online **fresh worker activated** and next request to Pricing Policy JS returns fresh served module; test network-first online and cached offline fallback. This is different from a clean new browser, which has no stale cache.
2. Under a legitimate existing **ID-V read-only** identity, capture only safe metadata for Scheme Master at **1280 px**, with optional **390 px** recheck: request path, method GET, selected-column count (=31), HTTP status, elapsed time, result count (=7 at previous baseline), errors/57014, service-worker control and deployed build. **Zero POST/PUT/PATCH/DELETE** and no privileged preview/writer RPC. No credentials/session states in GitHub.
3. Keep F #19 historically true even if this new run passes: add a dated **post-fix recovery PASS at the tested viewport/build/identity** separately. Multiple safe clean observations improve reliability confidence but are not required for a first bounded smoke result.

## D. Remaining separate issues

- **Viability Periods:** UI consumes `viability_periods` or `viability_period_count` but server view returns `viability_snapshot_period_count`; the full view's three expensive viability aggregates were deliberately omitted from the list read. **Do not silently restore the slow `select("*")`** to populate it. Choose an on-demand/protected summary if this field must become live.
- **Historical W6 test #10–13:** update/pin tests to their *actual frozen historical source revision* under a separately reviewed test-only change; never erase baseline failure evidence or widen business behaviour accidentally.
- **Electron:** accumulate merged source; ship once at the coordinated release readiness milestone with owner-approved version, Windows package and rollback. No Electron release now.

## E. Sign-off

**Merge status: complete. PWA source-host and old-install activation: NOT VERIFIED. Genuine signed-in desktop performance: NOT TESTED after merged fix.** No production database query/write, permission change, feature flag, release or deployment action was made in this acceptance reconciliation. Issue #264 stays scoped to served PWA acceptance. Issue #224 historical 57014 stays OPEN. WP05 retained gate and master programme remain 6/13.


## F. Owner-reported installed-PWA functional smoke — 10 November 2026 IST

Following PR #263 and PR #265 merge, the owner was asked to open the installed PWA online and confirm **Pricing Policy Manager → Scheme Master** loaded the expected seven schemes without an error or prolonged spinner. The owner replied in the follow-on costing-suite conversation: **“Yes that’s confirmed on pwa.”** Record this as **OWNER-ATTESTED LIMITED FUNCTIONAL SMOKE: PASS**, not independently captured authenticated request or delivered-asset verification. The report does not establish the actual served JS SHA, activated service-worker update generation, exact device/build or response latency, older-cache-to-fresh-cache upgrade, or 1280 px desktop reliability. No credentials or screenshots collected.

Issue [#264](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/264) records this owner report. Keep historic AE1 #19 F and issue #224 open, with a distinct post-fix functional observation. C2 served-asset identity and C3 signed-in desktop GET (31 fields, 1280px, timeout/57014 evidence) remain mandatory. WP05 **OPEN**, formal programme **6/13**; do not release Electron, alter database permissions, flags, cache version, or silently correct Viability Periods on the basis of this smoke.

## G. Claude Code execution pass — evidence matrix (10 November 2026, issue #264 delegated brief)

Base: `main` at `e8bb468`. No Supabase, flag, Netlify, cache-version or Electron action was taken.

| Gate | Status | Evidence |
|---|---|---|
| Source: 31-column `SCHEME_MASTER_LIST_SELECT`, no Scheme Master `select("*")` | VERIFIED (source only) | `public/shared/js/costing-suite-pricing-policy.js` on `e8bb468`; `node --test scripts/scheme-master-list-projection.test.mjs` |
| Source: `sw.js` is `hub-cache-v393` with PPM module network-first + cache fallback | VERIFIED (source only) | `node --test scripts/costing-sw-freshness/pricing-policy-sw.test.mjs` (mocked vm SW: old→new→offline, no-cache offline, scope, LF/CRLF) |
| Netlify published deploy SHA / served `/sw.js` and PPM module bytes | **BLOCKED** | Sandbox proxy returned HTTP 403 (CONNECT tunnel failed) for `sasv-utilities-hub.netlify.app`; the host was then added to the environment allowlist, but the follow-up fetch was denied by the session permission classifier, so no request reached the host. Environment/permission limit, not an HTTP result from Netlify. `verify-served-assets.mjs` NOT RUN. Source was not substituted for deployed bytes. |
| Old installed-PWA SW upgrade (real browser, real old cache) | NOT VERIFIED | No old-cache fixture/browser available; mocked SW only. |
| Authenticated ID-V 1280/390 px GET-only Scheme Master (31 fields, status, timing, 57014) | NOT TESTED | No authorised session; no credentials requested. |
| Owner PWA smoke (seven rows) | OWNER-ATTESTED, limited | Section F; unchanged. |
| W6 #10–13 | Diagnosed; test-only repair in this PR | See below. |
| Viability Periods mismatch | Unchanged backlog | Not touched. |

### W6 #10–13 root cause (corrects earlier wording)
`#10/#11/#13` failed in the cloud checkout only because the clone was **shallow** (`git cat-file` for pin commit `2ce8af0` failed; the test itself says to run `git fetch --unshallow`). With full history W6 is **12 pass / 1 fail**; only **#12** is a real pin drift: it compared the current PPM controller (stripped of W6) with the pre-W6 baseline `2ce8af0`, but PR #263 (`cf41740e`) is the only later controller change (`git log 2ce8af0..HEAD` on that file = `d395d7e8` W6 and `cf41740e`).
Test-only repair: keep the original pin evaluated at `cf41740e^`, and pin the current controller to `cf41740e`. Full-history result: **13/13**. Negative check: appending one line to the controller makes #12 fail (12/13), so unreviewed controller edits are still rejected. CI and other clones need full history (`fetch-depth: 0`) for this test.
