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

## 4. Verification (all offline/mocked; see `WP09_G2_EVIDENCE/`)

See the results table in the PR description and `WP09_G2_EVIDENCE/g2-test-results.json`. Environment skips are reported BLOCKED/SKIPPED, never PASS. **None of this is authenticated production, live-role, installed-PWA, packaged-Electron or Windows acceptance.**

## 5. Receiving obligations (unchanged and inherited)

* **WP12:** final role/security matrix (including real negative/view-only users), hosted resolver links, installed PWA, packaged Electron/Windows, final 11-flag state, **and the decision to ever activate `LAUNCHER_PRESENTATION_V1`**; `W12-WP08-01…08` receiving cases.
* **WP12 / ChatGPT page-level verification:** the two lab permission-name differences (see the season/legacy review §6); no alias or access-check was changed.
* **WP11:** PM BOM 390px overflow (UX-P05) and SKU Deactivate contrast (#429) — untouched.
* **Owner/WP12 follow-ups (not executed):** season-profile writer disposition and `production-overrides` archive — exact proposals in `WP09_G2_SEASON_PROFILE_AND_LEGACY_SOURCE_REVIEW_2026-11-15.md`.
* Electron Step B (registry route repointing) remains NOT EXECUTED / NOT AUTHORISED; no registry write of any kind.

## 6. Known limitations (honest)

Family open/closed state is not persisted; the header's native datalist suggestions are label-only; a family whose only visible member is a single module auto-expands (by design); Electron's section grouping is still by label text (unchanged G1 finding); the live launcher with real grants at 390/1280 has not been observed.
