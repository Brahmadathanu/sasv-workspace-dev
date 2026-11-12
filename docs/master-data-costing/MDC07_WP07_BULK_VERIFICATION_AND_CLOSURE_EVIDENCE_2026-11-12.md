# MDC-07 / WP07 — bulk verification and closure-preparation evidence (12 November 2026)

**Status: evidence record for independent review. WP07 remains OPEN; programme remains 7/13.** Nothing here is a formal closure, an owner acceptance, a flag activation, a deployment or a production action. Issue [#367](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/367). Builds on the gap audit [`MDC07_WP07_CURRENT_MAIN_CLOSURE_GAP_AUDIT_2026-11-12.md`](MDC07_WP07_CURRENT_MAIN_CLOSURE_GAP_AUDIT_2026-11-12.md) (PR #366, carried into this branch unchanged).

## 1. Pinned baseline

| Item | Value |
|---|---|
| Exact main verified | `3a93432713bf86203d1e0c6ad5ebac1ce34a2413` (GitHub `main` = handover SHA; ahead 0 / behind 0) |
| Checkout | Full history (`git fetch --unshallow`; the N2/N3/N4/W6 permanent-range guards need it and passed), two detached worktrees of the exact SHA, **no working-tree changes**; CRLF worktree created with `core.autocrlf=true`, `core.eol=crlf` (per-worktree), files verified to carry CRLF |
| Runtime | Linux 6.18 cloud container, Node v22.23.4, Playwright 1.63.0 with pre-installed Chromium (`/opt/pw-browsers`), real Chromium execution; **Electron binary not installed** |
| Suite command | `node --test $(find scripts -name '*.test.*' | sort)` (91 files) with `NODE_PATH=/opt/node-tools/node_modules` (the repo has no `node_modules`; tests import `playwright-core`) |
| Network / Supabase / production | None used. Mock backend only. |

## 2. Baseline result on exact main (before any change)

| Run | tests | pass | fail | skipped | cancelled |
|---|---|---|---|---|---|
| LF, `3a93432` | 1337 | 1306 | **13** | 18 | 0 |
| CRLF, `3a93432` | 1337 | 1298 | **21** | 18 | 0 |

The earlier recorded WP07 totals (471 → 605 → 610, LF = CRLF, zero failures) are **dated pre-merge figures on older heads**. The suite is now 1337 tests; it had not been run as a whole since several WP05/WP06 packages merged (the repository has no CI job that runs it). **The recorded "605/605 and 610/610" cannot be represented as a current-main result.**

**18 skips** are all `Electron renderer …` tests (`Electron binary not installed`), i.e. Electron-in-Chromium checks that belong to WP12 B1-T3 (Electron/Windows). Zero Chromium (Playwright) tests were skipped.

### 2.1 Every baseline failure, classified

| # | Test (file) | Cause | In WP07 scope? | Disposition |
|---|---|---|---|---|
| 1 | `costing-ccc-uxf1` scope guard | Later WP05 server packages (4 migrations touching costing + 16 `supabase/tests` fixtures), then PPM controller (#263 projection, #306 actor), Cost Build controller (W506 personnel gate), `sw.js` network-first additions — all post-date the historical base the guard diffs against | Yes (Costing client ownership guard) | **Fixed** (§3) |
| 2–4 | `costing-responsive` CW-13 CSS ×3 | Test sliced the CW-13 CSS block "to end of file"; the later appended N1 block and the #208 comment (which contains the text `overflow-x:hidden`) fell inside the "CW-13 block" | Yes | **Fixed** |
| 5–7 | `costing-review-worklist` protected files; `costing-table-tools` pkg3, pkg4 | PPM controller (#263/#306) and Cost Build controller (W506) changed after their pre-W6 base | Yes | **Fixed** |
| 8 | `costing-wp05-closure` (whole file) | Test helper `load-controller.mjs` rewrote only `./x.js` imports; #306 added `./costing-suite-scheme-audit-actor.mjs` to the PPM controller, so loading it in Node threw an unhandled rejection | Test-helper defect, shared with N2 | **Fixed** |
| 9 | `costing-w506-conf-server` migration-static: "sorts after every other migration" | A later, unrelated migration (`20261112050000_lab_tolerance_…`) sorts after it | No (server migration ordering) | **Not changed.** Open — #370 |
| 10 | `scheme-master-migration`: "strictly newest migration" | Same cause | No | **Not changed.** Open — #370 |
| 11 | `scheme-master-migration`: "no client … change" | Asserts the PPM list reads `.select("*")`; #263 intentionally narrowed it to a 31-column projection | No (Scheme Master package pin, WP05) | **Not changed.** Open — #370 |
| 12–13 | `fg-bit-ux-1` page tests ×2 | FG-BIT-UX-1 (#277) finished-goods transfer UI; unrelated module | No | **Not changed.** Open |
| CRLF-only (8 extra) | `costing-sw-freshness`, `costing-w506-conf-client` ×2, `costing-w506-sec-fix-01/02` rollback ×2, `fg-bit-ux-1/sw-freshness`, `csr-comparison-verifier` line-endings, `manage-activities` header | Five tests read source/migrations with raw `readFileSync` and compare to LF literals; one test (`csr-comparison-verifier`) asserts new verifier files are LF by design; `manage-activities` was a 30 s load timeout under two concurrent suites (passes alone: 97/97) | No | Raw-read tests **fixed** (LF-normalised reader); line-ending test (#370) and timing flake (#372) routed |

Items 9–13 and the CRLF line-ending test are unrelated to navigation, were failing on the pinned main, and are **reported, not hidden and not edited**: their owners are the WP05 server/migration package (items 9–11, #224 family) and the FG-BIT/PEC workstreams (12–13). Item 11 is a real stale assertion that a Scheme Master owner should update deliberately.

## 3. Corrections made (tests only; no product code, no production path)

Reproduction for each is the baseline failure above, run on the pinned main; every correction was re-run in isolation, then in the full suite. Principle: **no guard was weakened** — each exception is exact-text or hash-pinned, tampering still fails.

| Change | File(s) | Before → after |
|---|---|---|
| CW-13 block bounded to its own header → the next appended block (`/* MDC-07 N1:`), with an assertion that the boundary exists | `scripts/costing-responsive/responsive.test.mjs` | 3 failing → 23/23 pass |
| Approved post-base WP05 server files pinned by path **and** LF-normalised sha256 (20 files: 4 migrations, 16 PG test fixtures), exported as `APPROVED_COSTING_WP05_SUPABASE_FILES`, used as the default for `costingScopeReport` while the original `APPROVED_COSTING_SUPABASE_FILES` (asserted equal to exactly two files by the Scheme Master package) is untouched | `scripts/lib/costing-scope-guard.mjs` | uxf1 scope guard 20 violations → 0; scope-guard suites 43/43 |
| `stripPostW6Approved` reverses exactly two sanctioned post-W6 PPM edits (#263 projection, #306 actor), applied alongside the existing W6/N2/personnel strips | `scripts/lib/w6-nav-strip.mjs`; applied in `uxf1`, `review-worklist`, `table-tools-pkg3`, `table-tools-pkg4` | 4 failing → pass |
| Existing `unPersonnel` strip applied to the Cost Build comparison in the three tests that lacked it (pkg3 and responsive already had it) | `uxf1`, `review-worklist`, `table-tools-pkg4` | pass |
| `sw.js` guard judges only `CACHE_NAME` lines (v393 added to the allowed set); later network-first allowlist additions are owned by `scripts/costing-sw-freshness` and their packages | `scripts/costing-ccc-uxf1/uxf1.test.mjs` | pass |
| `load-controller.mjs` rewrites `./x.mjs` imports as well as `./x.js` | `scripts/costing-nav-mcm-cbm/load-controller.mjs` | wp05-closure 11 → 13 tests, 0 failing |
| LF-normalised source/migration reads | `costing-w506-conf-client/staff-governance-gate`, `costing-w506-sec-fix-01/02 migration-static`, `costing-sw-freshness/pricing-policy-sw`, `fg-bit-ux-1/sw-freshness` | CRLF: 7 failing → pass |
| New: Back/Forward verification (§5) | `scripts/costing-wp07-verification/wp07-back-forward-browser.test.mjs` | 5/5 |

**Mutation checks on the repaired guards** (run in a scratch worktree, reverted): appending a line to the PPM controller, to the Cost Build controller, or to an approved WP05 migration each still fails the uxf1 guard; adding `overflow-x: hidden` inside the CW-13 block fails the responsive guards.

**Residual risk of the repairs:** the approved-file list and the post-W6 strip are new exact-text exceptions that a reviewer should read once (diff is test code only). They record that the WP05 #263/#306/W506 changes were accepted *elsewhere*; this PR does not re-review those changes.

## 4. Final result on the fixed tree

Tested commit `b9cfd4c9` (tests-only change on top of `3a93432` plus the audit doc):

| Run | tests | pass | fail | skipped | cancelled |
|---|---|---|---|---|---|
| LF | 1344 | 1319 | 7 | 18 (Electron binary absent) | 0 |
| CRLF | 1344 | 1319 | 7 | 18 (Electron binary absent) | 0 |

Failures remaining (all outside WP07, §2.1): LF — `costing-w506-conf-server` migration ordering, `scheme-master-migration` ×2, `fg-bit-ux-1` ×2, and two `manage-activities` tests that fail only under the two concurrent suites and pass alone (97/97); CRLF — the same set (instead of the `manage-activities` timing pair: `csr-comparison-verifier` line-ending test, plus one `manage-activities` timing failure). **Zero failures in any N1/N2/N3/N4/W6/U11/CW-13/UX-F1/worklist/table-tools/WP05-closure test.** Net: baseline LF 13 → 5 deterministic non-WP07 (+2 load-sensitive); CRLF 21 → 6 (+1 load-sensitive).

Focused WP07 suites on the fixed tree (LF): N1 `costing-nav-groups` 40/40; N2 `costing-nav-mcm-cbm` 19/19; N3 `costing-cross-links` 14/14; N4 `costing-prm-nav-context` 38/38; W6 `costing-w6-pricing-nav` 23/23; U11 `costing-ux-consistency` 17/17 (incl. `u11-control-status` 5/5); responsive `costing-responsive` 23/23; WP07 Back/Forward 5/5. All run Chromium; none skipped.

Legacy smokes on the pinned head: 14 pass, 51 fail of 65 (`production-route-*-smoke` + `wp04-readiness-client-contract-smoke`) — **identical to the 3 Nov record** (51 stale-pin failures); baseline-qualified, not regressions.

## 5. Independent verification per area

| Area | Verified how | Result |
|---|---|---|
| **Flags exact-`1`, default OFF; no second navigation engine** | `nav-groups.test.mjs`, `u11-control-status.test.mjs`, `prm-nav-context.test.mjs`; source review: `costing-feature-flags.js` returns `getItem(...) === "1"` in try/catch; single canonical copy of each shared module under `public/shared/js` (no Electron/PWA duplicate found by filesystem search) | PASS (source/isolated) |
| **N1 six-module groups, deep links** | `nav-groups-browser.test.mjs` (12): all six pages ON, 30 non-PPM `?lens=` links plus PPM legacy URLs, ON/OFF deep-link parity, click-through, narrow select | PASS (mock Chromium) |
| **Default-OFF parity, 96 snapshots** | Re-ran `off-parity-snapshot.mjs` against the pre-N1 tree (`86f1c18c`) and exact main (`3a93432`), flag absent: **96 pages/deep links × 390/1280, 239,916 bytes, byte-identical (`cmp` clean), 0 page errors** | PASS (mock Chromium; this is independent of the recorded 3 Nov run) |
| **N2 role-aware MCM/CBM nav, RM/PM independent fail-closed** | `n2.test.mjs`, `n2-browser.test.mjs` (4 role combinations at 1280/390, non-boolean grants, unauthorised deep link stays restricted with no trace RPC, re-render persistence, identical RPC sequence ON vs OFF) | PASS (mocked permissions) — **not genuine role proof** |
| **N3 cross-links, Action Queues** | `cross-links.test.mjs`, `cross-links-browser.test.mjs`; two queues remain two lenses with unchanged RPC names; Scheme Comparison link only when row has own period + SKU | PASS (mock) |
| **N4 Production Route context** | `prm-nav-context*.test.mjs` (stale-response protection, abandoned/slow loads, rapid clicking, Product/Family switch drops dependants, evidence/historical lenses unhydrated, no run/period ever set, RPC sequence ON(empty)=OFF, read-only); scope guard judges permanent range `026c646`→`2ce8af0` (needs full history; passed) | PASS (mock) |
| **W6 PPM grouping, legacy URLs** | `w6.test.mjs`, `w6-browser.test.mjs` (10 workspaces, five groups, legacy `?lens=`/`?workspace=`, Back/Forward across page loads ON=OFF, narrow dropdown five optgroups) | PASS (mock) |
| **U11 sentence-case, raw codes unchanged** | `u11-control-status.test.mjs`: four codes only, unknown code returns "" (caller fallback), OFF = legacy Title Case incl. throwing storage, raw codes/group keys unchanged | PASS (isolated). Flag `COSTING_UX_CONSISTENCY_V1`; the worklist itself is behind `COSTING_REVIEW_WORKLIST_V1` |
| **Responsive 390/520/768/900/1280** | `nav-groups-browser.test.mjs` six pages × five widths (no horizontal page overflow, 768/900 strip scrolls inside its container), `responsive.test.mjs` six pages × widths 320–1280 incl. long run-status chip and focus rings | PASS (mock Chromium, empty/seed data) |
| **Keyboard** | N1 a11y test: `role=group` + labelled headings, one `aria-current`, Tab moves to next pill, Enter navigates, focus ring ≥ 2 px | PASS (mock). No screen-reader run |
| **Browser Back/Forward** | New `wp07-back-forward-browser.test.mjs`: five shell modules, `?lens=` deep-link loads a→b, Back, Forward, flag ON and OFF, 1280 (pills) and 390 (select): active destination = URL each time, exactly one active pill, breadcrumb = active label (ON), no page errors, ON sequence = OFF sequence | PASS (mock). **Finding:** in-page pill/select switches create **no** history entry (shell never calls `pushState`; PRM uses `replaceState`). Pre-existing with flag OFF, unchanged by N1; Back leaves the module. Not a regression; recorded so acceptance reviewers are not surprised |
| **Context indicators / basis labelling** | `nav-groups-browser` chips test: no chip without a supplied value, fixed-historical lens says "not the current costing run", no embedded run 80/82 | PASS (mock) |
| **No new RPC, writer, permission bypass** | Tests pin RPC names/payload sequences ON vs OFF (N1 PRM integration 13-lens click-through, N2 backend parity, N4 24 read/38 write baseline); new modules contain no `supabase`/`.rpc(`/`.from(` (grep of `costing-nav-groups.js`, `costing-nav-context.js`, `costing-suite-production-route-nav-context.js`: none) | PASS (source/isolated) |

## 6. Acceptance-gate ledger

`PASS (scope)` states the scope; none of these is genuine authenticated hosted evidence.

| Gate | Classification | Evidence / why |
|---|---|---|
| G1 Exact-main full suite LF + CRLF with Chromium | **PASS WITH QUALIFICATION** | §2/§4. On exact main: 13 / 21 failures; after test-only repair: 0 in WP07 suites; 5–6 deterministic non-WP07 failures remain and are listed with owners. 18 Electron skips |
| G2 N1 groups, deep links, default-OFF parity | **PASS (source / isolated / mock Chromium)** | §5; 96-snapshot parity re-proved byte-identical |
| G3 N2 role-aware MCM/CBM, fail-closed RM/PM | **PASS (mocked permissions)**; real-role **NOT TESTED** | `n2*` tests; no authenticated account matrix |
| G4 N3 cross-links + Action Queues | **PASS (mock)**; signed-in **NOT TESTED** | |
| G5 N4 Route selection, stale-response, historical isolation | **PASS (mock)**; populated-data **NOT TESTED** | |
| G6 W6 PPM grouping + legacy URLs | **PASS (mock)**; signed-in **NOT TESTED** | |
| G7 U11 sentence-case, raw codes unchanged | **PASS (isolated)**; signed-in **NOT TESTED** | |
| G8 Responsive 390/520/768/900/1280 | **PASS (mock Chromium)**; populated-data and final-build **NOT TESTED** | final-build responsive is WP12 B1-T3 |
| G9 Keyboard, Back/Forward, active destination, context chips | **PASS (mock)** | §5; in-page switches are not history entries (pre-existing) |
| G10 No new RPC / permission / calculation change | **PASS (source / isolated)** | |
| G11 Canonical shared source (Electron = PWA) | **PASS (source)** | one copy under `public/shared`; nothing duplicated |
| G12 Real signed-in, ON/OFF, exact-build acceptance | **NOT TESTED — owner-operated; flag-ON part additionally needs explicit owner authorisation (not given)** | [checklist](MDC07_WP07_OWNER_READ_ONLY_ACCEPTANCE_CHECKLIST_2026-11-12.md) Parts B–E; hosted build provenance is a separate gate, G12a |
| G12a Hosted build provenance | **VERIFIED SERVER-SIDE (point in time); BROWSER NOT VERIFIED** | §10.1 |
| G13 Electron renderer checks | **NOT TESTED (18 skipped, binary absent)** — WP12 | |
| G14 Eleven-flag combined integration, final-build responsive, Electron/Windows | **OPEN — WP12 (B1-T2/T3)** | not required by or claimed in WP07 |
| G15 Independent review of this record + PR | **OPEN** | |
| G16 Owner WP07 closure decision | **OPEN** | no owner instruction received |

## 7. Mocked verification versus genuine evidence

* **Mock:** every browser result above is real Chromium against an inert fake backend (no Supabase, no network, no writes). It proves rendering, routing, permissions *as simulated*, flag behaviour, request sequences and responsive layout.
* **Not obtained:** any real authenticated session, real role permission matrix, populated production data, the hosted PWA build/cache activation, Electron/Windows, production flag state. No production SQL, writer, preview, permission, flag, deployment or release action was taken.

## 8. Remaining acceptance gaps and owner-operated checks

1. G12 — owner runs the read-only [checklist](MDC07_WP07_OWNER_READ_ONLY_ACCEPTANCE_CHECKLIST_2026-11-12.md) on the exact hosted build (flag set only in the owner's own browser, removed afterwards, no permission changes).
2. Independent reviewer disposition of this PR, in particular the new exact-text guard exceptions (§3) and the open non-WP07 failures (§2.1 items 9–13) which need their owners.
3. WP12 retains B1-T2/T3 (final eleven-flag integration, final-build responsive, Electron/Windows); B1-T1 transfers zero lenses.
4. R62's fourteen residuals, #273, #297, #224 and the rest are untouched and keep their receivers.

## 9. Recommendation

**WP07 is not yet ready for formal closure, but is ready for independent review and for the owner's read-only signed-in check.** All automated and isolated gates that can be proven without production authority pass; the exact-main suite needed test-only repairs (guards that went stale as WP05/WP06 landed), done without weakening any guard and without touching product code. The remaining blocking gap is G12 (genuine signed-in evidence) plus reviewer/owner decisions (G15/G16). Next programme gate: **merge this test-and-docs PR after independent review → owner executes the checklist → owner closure decision on WP07**; in parallel the non-WP07 failures in §2.1 should be routed to their owners, and WP08 G1 navigation inventory can proceed without waiting.

## 10. Post-review corrections (independent review of PR #368, 12 Nov 2026)

Review verdict: positive static review, explicitly not an independent rerun; conditions below. Test code and product code are unchanged by this section (docs, a manifest and GitHub issues only).

| Review finding | Correction |
|---|---|
| Cache name `hub-cache-v393` does not prove the hosted assets equal the reviewed source; require exact served hashes; otherwise HOSTED BUILD NOT VERIFIED | Checklist Part A rewritten around the **existing** `scripts/costing-acceptance/verify-served-assets.mjs` (no new verifier), with expected SHA, bundle digest, per-asset manifest (`MDC07_WP07_EXPECTED_ASSET_MANIFEST_3a93432_2026-11-12.tsv`), a read-only in-browser network-vs-cache hash snippet, and a mandatory three-way classification (VERIFIED / SERVER-SIDE ONLY / NOT VERIFIED) |
| Browser-local flag ON is a controlled activation, not a read-only observation; needs explicit owner decision | Flag-ON moved to Part C, labelled **NOT AUTHORISED**, with the wording the owner must give, exact activate/restore commands and a dedicated-profile recommendation. Part B (OFF baseline) touches no flags |
| U11 flags optional, not essential to navigation acceptance | Part D: separately identified, separately authorised, skippable; `NOT TESTED` does not block navigation acceptance |
| Do not ask the owner to create new role combinations | Part E: existing identities only; missing RM-only / PM-only / no-module identity = NOT TESTED; trial account untouched |
| Preserve non-WP07 failures as issues/receivers | #370 (3 stale WP05 guards + CRLF line-ending test), #371 (FG-BIT ×2), #372 (Manage Activities load-sensitive) — no code edited |
| Close #366 as superseded, don't merge twice | §10.3 |

### 10.1 Hosted build provenance observation

Ran the existing verifier (unauthenticated static GETs; no sign-in, no writes, nothing deployed or changed) on 2026-11-12 17:22 UTC:

`node scripts/costing-acceptance/verify-served-assets.mjs https://sasv-utilities-hub.netlify.app 3a93432713bf86203d1e0c6ad5ebac1ce34a2413 --expect-cache hub-cache-v393`

Result `VERIFIED [HOSTED]`: 73/73 assets match, 0 mismatches, served bundle digest = expected `c5a7bf14d89601f8196d97116e198425d582f77feef8e9d9dbbada849ceb0c69`, served cache `hub-cache-v393`; two HTML pages (cost-build-manager, costing-control-center) verified after removing the documented `NETLIFY_INJECTED_BANNER_V1` comment. The `costing-suite-scheme-audit-actor.mjs` module (outside the verifier's list) was compared separately and matched (`a107eaa1…`). A local-loopback self-test of the same command also verified 73/73 and is labelled `LOCAL_SELF_TEST`, not hosted proof.

**What it establishes:** at that moment the hosted site delivered Costing assets byte-identical to `3a93432` (PR #368 changes nothing under `public/`). **What it does not:** which build was deployed *from* (Netlify deploy SHA not read), whether an owner's browser has activated that service-worker generation (Part A.4), or anything about authenticated behaviour. Verdict for acceptance wording: **HOSTED BUILD VERIFIED SERVER-SIDE (point in time); BROWSER NOT VERIFIED.** It must be re-run in the owner's session; a later deploy invalidates it.

### 10.2 Final PR diff verification (against current `origin/main` = `3a93432`, unchanged)

* 19 files: 2 modified docs, 3 added docs (+ the manifest added in this correction), 13 test/test-helper files (`scripts/`). **0 files under `public/`, `supabase/` or `sql/`.** No product code, migration, `sw.js`, cache bump or flag-default change (the flag modules are untouched, so default-OFF/exact-`1` behaviour is unchanged).
* Guard changes bounded: sha256+path pins for 20 added files (original two-entry list and its exact-equality test unchanged); exact-text reversal of two named PPM edits (#263, #306); existing `unPersonnel` reused; CW-13 block boundary asserts its end marker exists; mutation checks failed as required. No permission test or scope guard was removed or loosened beyond these. Nothing in a guard accepts an unlisted file or an unlisted edit.
* No deployment, release, SQL, writer, permission or global flag action. WP05 closure (14 residual lines) and WP12 B1-T2/T3 (B1-T1 = zero) untouched.
* Executed code last verified at commit `b9cfd4c9` (full LF/CRLF, §4); the later commits are docs/manifest only and change no executable test behaviour. Doc-reading tests (`costing-acceptance`, `scheme-master-index-candidate`, `cde2-sql-candidate`, W506 server tests, wp06-g1) re-run after the docs commit `1b808ea7`: 138/139, the one failure being the already-routed migration-ordering pin (#370).

### 10.3 PR #366 reconciliation

PR #366 (head `7c198d3a`, one file) is carried into #368 as commit `d137d004` (cherry-pick). `MDC07_WP07_CURRENT_MAIN_CLOSURE_GAP_AUDIT_2026-11-12.md` is **byte-identical** (same SHA-256 `836b162b…`) on both branches; no divergence. #368 supersedes #366 completely. Recommendation: merge #368 only, then close #366 as superseded; do not merge both. (This session does not close or merge either.)
