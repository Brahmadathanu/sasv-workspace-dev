> **LATEST — CORRECTED G2 VERIFICATION ACCEPTED / MERGE AUTHORITY PENDING:** ChatGPT independently verified head `b26c7c3454f03cb2199999080095404cb7cb6e70`: runtime unchanged from reviewed correction; committed corrected-head JSONs reconcile to Chromium 87/87 + OFF 33/33, contract 38/38, source 23/23 and regressions 5/5 PASS (all offline/mocked). The previous corrected-head browser-evidence HOLD is resolved. [Final independent recommendation](WP09_G2_FINAL_INDEPENDENT_VERIFICATION_2026-11-15.md) proposes #434 merge → #437 retarget/base check → default-off merge, subject to owner authority. Neither PR is merged or retargeted. Live/release acceptance remains NOT TESTED; WP09 OPEN, 9/13; WP11/WP12 obligations retained. Older HOLD/pending-rerun banners below are historical.

> **Later independent review:** ChatGPT found and corrected storage-getter fallback and pending-render identity isolation defects, replaced a vacuous source assertion, and tightened migration scope checking on the same #437 branch. See [independent review](WP09_G2_INDEPENDENT_REVIEW_2026-11-15.md). Fresh corrected-file results: contract 38/38, source 23/23, lifecycle regressions 5/5. Corrected-head Chromium remains BLOCKED here; the original 82/82 and screenshots below describe Claude's submitted `2b0f9a13` head. Runtime merge remains HOLD. No live acceptance or production flag activation.

# WP09 G2 — A→C launcher families, shared search and PWA Quick Access (client package, issue #436)

**Status: IMPLEMENTED BEHIND A DEFAULT-OFF FLAG; FOR INDEPENDENT REVIEW. Not merged, not deployed, flag not activated anywhere.** WP09 remains OPEN; programme remains 9/13. WP08/PEC remain closed. Authority: owner "Yes proceed" record `WP09_OWNER_G1_ACCEPTANCE_G2_AUTHORITY_2026-11-15.md`; package `WP09_G2_SINGLE_CLIENT_PACKAGE_2026-11-15.md` (both preserved verbatim).

## Source pins

| | |
|---|---|
| Authority / G1 PR #434 head | `7584c0f04cae2b4a713a12fe46b2db1fac580835` (fast-forwarded; contains accepted G1 correction `1d7791e7578f57acece324f68b54be7530930c46`) |
| `main` at refresh | `e5693623e71ae60d0d613498f4e76c99be7214ef` (already a parent of #434; **no newer main drift**) |
| This work | branch `claude/wp09-g2-launcher-families`, **one draft PR targeting `claude/lucid-gates-6uwfvx`** (runtime-only diff vs the G1 branch; retarget to `main` after G1 integrates). No runtime edit was made on #434. |

## 1. The one feature flag

| | |
|---|---|
| Identifier | **`LAUNCHER_PRESENTATION_V1`** (browser `localStorage`, same convention as the `COSTING_*_V1` flags) |
| OFF (default; any value other than exactly `"1"`, including unset, `"0"`, `"true"`) | Today's launcher. **Proven byte-identical**: the DOM of Electron `#workspace-sections` and PWA `#hub-root` equals the authority-head launcher's DOM for the same registry/grants (browser tests O1–O3). No new CSS loaded, no families, no PWA tools. |
| ON (`"1"`) | Subgroup headings + collapsible families in **both** launchers, one shared search matcher (Electron header Enter + Ctrl+K palette, PWA search box), PWA per-user local Quick Access, deterministic catalog-missing section order. |
| Enable (isolated walkthrough only) | `localStorage.setItem("LAUNCHER_PRESENTATION_V1","1"); location.reload();` |
| Roll back | `localStorage.removeItem("LAUNCHER_PRESENTATION_V1"); location.reload();` — restores today's launcher. No code, data or registry rollback exists because none changed. |
| Not touched | the eleven `COSTING_*` release flags, `costing-feature-flags.js` (byte-identical, test G4), their sweep tests, any global/production flag value. **No flag was activated.** |

## 2. What changed (runtime files: exactly seven)

| File | Change |
|---|---|
| `public/shared/js/launcher-presentation-contract.js` (new, **generated**) | 79 frozen tuples `module_key → [live section, approved subgroup, family\|""]`, produced by `scripts/wp09-g2-launcher-presentation/generate-contract.mjs` from the accepted G1 mapping and the committed live snapshot (generation fails if any key/section differs from the snapshot). Data only: no routes, grants or targets. |
| `public/shared/js/launcher-presentation.js` (new) | Pure logic, no DOM/network/Supabase: flag reader, `planSection` (subgroups/families, fallback), `matchModules`, per-user pin helpers, `resolveQuickAccess`. |
| `public/shared/css/launcher-presentation.css` (new) | Subgroup/family/search/Quick Access styling; loaded **only** when the flag is ON; reuses existing tokens. |
| `index.html` (Electron launcher) | Flag-guarded: extracted the existing tile template into `renderModuleLink` (OFF output unchanged), ON renders subgroups + families, `syncPresentationGroups` resolves family/subgroup visibility **after** permission filtering, family toggle handler, shared-matcher bridge for header Enter and palette, catalog-missing order `1_000_000 + index` (ON only). |
| `public/utilities-hub/js/hub-auth.js` (PWA hub) | Flag-guarded: card renderer extracted (OFF output unchanged), subgroup/family rendering, search box, Quick Access, delegated toggle, tools cleared on sign-out / registry failure / identity change. |
| `public/shared/js/module-registry.js` | One additive export `getModuleKeyAliases(key)` (read-only reverse view of the existing alias table). **The alias table itself is unchanged** (tests S9/S10). |
| `public/sw.js` | **Add-only**: the new files, `module-registry.js` and `hub-auth.js` join the existing network-first list so an installed PWA never pairs new code with a stale copy. `CACHE_NAME` and `PRECACHE` untouched (network-first bypasses older cached entries); the two stale ETL precache entries remain deferred. |

## 3. Behaviour contract

* **Visibility is never granted by presentation.** Everything is built from the existing permission-filtered registry result. Families resolve after filtering; empty families/subgroups disappear; a lone visible member auto-expands its family. Locked (`view`) modules keep today's locked semantics (disabled, `href="#"`); denied modules stay absent; permission-RPC error or non-array fails closed in both clients.
* **A (subgroups) + C (families):** current live sections preserved; families are scoped to their section; Costing is one family holding all six modules including Production Route Manager; each member keeps its direct registered route, individual search hit and pin. Section-scoped top-level maximum is **36 Electron / 24 PWA** (79 / 41 modules), asserted against `option-coverage.json`. The four registered child pages (`coa-print`, `edit-log-entry`, `sop-editor`, `sop-viewer`) remain launchable under their grants.
* **Unknown / colliding keys:** a key missing from the contract, or one whose registry section differs from the contract's section, is rendered flat in a per-section **"More"** subgroup (last) — never merged into another section's family, never dropped.
* **Shared search** (label, description, approved subgroup, real existing aliases; AND of terms; exact label first): flat and module-level, independent of family expansion. Electron palette keeps excluding locked modules (as today); the header search keeps listing the already-visible locked module disabled (its browser datalist *suggestions* remain label-based — only Enter uses the shared matcher); PWA search shows an already-visible locked result **disabled with no pin button**. Section names are not searched.
* **Quick Access:** same key as Electron (`sasv-workspace:<user-scope>:pinned-modules`), maximum 10, newest first, enabled+routable+currently-visible modules only; stale/revoked/locked pins are retained and return when access returns. **Browser-local only — no server persistence and no device sync is implied or implemented.** PWA state is rebuilt on every render and cleared on identity change/sign-out.
* **Recent items — decision:** *not displayed in either client.* Electron keeps its existing recents/usage storage (used for the "Suggested shortcut" prompt); the PWA records neither. Rationale: a recents list is a second personalised surface needing its own revocation/identity handling, beyond the authorised scope; the pin list + search cover the need. Revisit only on owner request.
* **Hygiene delivered because grouping needs it:** deterministic order for sections missing from the catalog (after all catalog sections, ON only) and explicit fallback grouping. **Deferred (unchanged):** display-name/taxonomy renames, SQL sort-order tie cleanup, stale ETL precache. The two fallback modules (Product Shelf Life, Staff Directory) are registered in the snapshot, so no missing-registration defect is claimed.

## 4. Verification (offline / mocked; evidence in `WP09_G2_EVIDENCE/`)

| Suite | Result |
|---|---|
| Pre-implementation baseline (G1): registry verifier L1–L12 + S1–S3, source-contract, registry mutation | PASS 21/21, 50/50, 22/22 (run before any edit) |
| `scripts/wp09-g2-launcher-presentation/contract.test.mjs` — contract = 79 live keys/sections, 36/24 section-scoped top-level cards, six-Costing family, child pages, unknown/collision fallback, shared matcher, alias table byte-identical, lab keys unaliased, pins (cap 10, scope, revocation), flag, **6 pure mutation controls** | **PASS 38/38** |
| `source.test.mjs` — scope guard (7 runtime files only, nothing under supabase/sql/electron, no WP08/costing/flag file touched), no new writers, data-only contract, single default-off flag never set, add-only service worker, recents decision | **PASS 21/21** |
| `launcher-presentation.browser.test.mjs` — real Chromium, actual registered keys, both clients, 390 + 1280: OFF byte-identical to authority head (+ `0/true/on/' 1'/''` stay OFF), counts 79/36 and 41/24, subgroup headings 34/23, no horizontal overflow (collapsed and expanded), keyboard Enter/Space family toggle + focus, Costing family routes/search/pin while collapsed, label/description/subgroup/alias search, editor / viewer(locked+read) / denied / mixed, permission error + non-array fail closed, unknown key, cross-section collision, catalog-missing order, pin revocation/restore, 10-pin cap, user switch, sign-out, writer/network assertions, **5 browser mutation controls** (permission-filter bypass ×2, hidden search leakage ×2, stale pin reuse), 5 screenshots | **PASS 82/82** |
| G1 regression with flag OFF on the modified code: `launcher-browser.test.mjs` | PASS 33/33 |
| G1 `source-contract.test.mjs` | PASS 50/50 — two assertions (O6, B7) were intentionally re-expressed because G2 makes those behaviours flag-conditional; each now asserts the unchanged OFF behaviour **and** the ON change independently. All other assertions untouched. |
| G1 `registry-mutation.test.mjs`, `registry-verify.mjs` on the committed snapshot | PASS 22/22, PASS 21/21 (snapshot/evidence byte-identical to the authority head, test G5) |
| WP08 `g2-1/source` 13/13, `g2-1/resolver` 8/8, `g2-0/sw-freshness-and-gate` 15/15, `g2-0/registry-sql` 18/18 (PostgreSQL available in this session) | PASS |
| WP08 `g2-0/source.test.mjs` | **11 PASS / 2 FAIL — documented historical diff-scope baseline** (tests 11 "sw.js diff…" and 12 "forbidden file changed…"); identical to the baseline, not weakened, not edited |
| WP08 `g2-0/fail-closed.test.mjs` (~5 min browser suite) | **NOT RE-RUN** in G2 (no Master Data page, resolver or WP08 file changed; last recorded 81/81 in G1) |
| Authenticated live roles, real negative/view-only users, installed PWA, packaged Electron/Windows, hosted resolver | **NOT TESTED** (WP12) |

Three defects found in *my own tests* during the work (a shared-context close, a control that matched a granted module, a counted "no results" note) were fixed in the tests; no runtime defect was found by the suites. Screenshots (mocked data, deviceScaleFactor 2): `WP09_G2_EVIDENCE/screenshots/{electron-1280,electron-390,pwa-1280,pwa-390}-flag-on.png` and `pwa-390-flag-off.png`. Reproduce:

```
node scripts/wp09-g2-launcher-presentation/generate-contract.mjs --check
node scripts/wp09-g2-launcher-presentation/contract.test.mjs
node scripts/wp09-g2-launcher-presentation/source.test.mjs
node scripts/wp09-g2-launcher-presentation/launcher-presentation.browser.test.mjs results.json ./shots   # ~8 min
```

## 5. Receiving obligations (unchanged and inherited)

* **WP12:** final role/security matrix (including real negative/view-only users), hosted resolver links, installed PWA, packaged Electron/Windows, final 11-flag state, **and the decision to ever activate `LAUNCHER_PRESENTATION_V1`**; `W12-WP08-01…08` receiving cases.
* **WP12 / ChatGPT page-level verification:** the two lab permission-name differences (see the season/legacy review §6); no alias or access-check was changed.
* **WP11:** PM BOM 390px overflow (UX-P05) and SKU Deactivate contrast (#429) — untouched.
* **Owner/WP12 follow-ups (not executed):** season-profile writer disposition and `production-overrides` archive — exact proposals in `WP09_G2_SEASON_PROFILE_AND_LEGACY_SOURCE_REVIEW_2026-11-15.md`.
* Electron Step B (registry route repointing) remains NOT EXECUTED / NOT AUTHORISED; no registry write of any kind.

## 6. Known limitations (honest)

Family open/closed state is not persisted; the header's native datalist suggestions are label-only; a family whose only visible member is a single module auto-expands (by design); Electron's section grouping is still by label text (unchanged G1 finding); the live launcher with real grants at 390/1280 has not been observed.
