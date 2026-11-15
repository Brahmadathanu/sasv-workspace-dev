# WP09 G2 — Season-profile parity, legacy-source dependency review and exact follow-up proposal

**Status: REVIEW + PROPOSAL ONLY. No writer, page, registry row, permission or route was changed by this review.** Authority: owner approval of 15 Nov 2026 (MRP Master Data Console is the *intended* canonical season-profile owner, *conditional* on parity and dependency review; writer changes require an exact reviewed follow-up). Evidence is source-only; **database behaviour (RLS, foreign keys, cascades) is NOT TESTED**.

## 1. Pages compared

| | `manage-season-profiles.html` + `js/season_profiles.js` | MRP Master Data Console, season section (`public/shared/js/mrp-master-data-console.js`) |
|---|---|---|
| Registry | **Not registered** (no `app_modules` row in the 15 Nov snapshot) | Registered, **Electron only** (`mrp-master-data-console`, `mrp-procurement`, no PWA row) |
| Route/static root | repo root (Electron only; not in PWA publish root) | `public/shared/` (reachable by both static roots, but only registered for Electron) |
| Page-level permission check | **none in source** | `isProcurementAdmin() \|\| canEditPM()` before every write |
| Create / edit | `season_profile` insert/update: `label`, `entity_kind`, `notes` | `season_profile` upsert: `id`, `label`, `entity_kind`, `notes` **plus** `season_profile_month` and `season_profile_weight` rows |
| Delete | single `delete()` on `season_profile` only | deletes `season_profile_weight`, then `season_profile_month`, then `season_profile` after an explicit confirm |
| Detail view | none | `Entity Kind`, manufacture months, month split, notes |
| Also uses | — | `inv_stock_item_season_profile` (item assignments), MOQ policy, form conversion, `v_season_calendar` |

## 2. Functional parity result (source-only)

* **Console ⊇ legacy for every field the legacy page edits** (`label`, `entity_kind`, `notes`), and adds months/weights and a permission gate. No legacy-only data field was found.
* **Behavioural differences that matter before any writer is disabled:**
  1. Legacy delete does **not** remove month/weight child rows; it depends on database foreign-key behaviour (**NOT TESTED**). The console deletes children first.
  2. Legacy page has **no page-level permission gate**; the console does. Which users can write today through the legacy page is decided only by database policy (**NOT TESTED**).
  3. The console is registered for Electron only; PWA users have no season-profile editor at all (today as well).

## 3. Dependencies on the legacy source page (why it must NOT be retired now)

| Dependent | Evidence | Effect if the page disappeared |
|---|---|---|
| WP08 shared Products page link "Manage profiles" | `public/shared/manage-products.html:1151` → `../../manage-season-profiles.html` | dead link in an accepted WP08 page |
| Platform helper | `public/shared/js/master-data-platform.js:33` returns the legacy page for Electron, `null` for PWA | helper returns a missing destination |
| WP08 tests | `scripts/wp08-g2-0-shared-master-data/browser.test.mjs`, `source.test.mjs` reference it | accepted regression assertions fail |
| Registry | none | — |

WP08 is closed and must not be reopened, so these references are **not** modified here.

## 4. Exact proposed disposition (SEPARATE follow-up; not executed, not authorised)

1. **Keep the legacy page and its writer unchanged.** Parity is established in source; the three behavioural differences above are unproven in the database.
2. **Follow-up F-A (read-only, owner/WP12):** with a read-only database session, confirm (a) FK/cascade behaviour of `season_profile` → `season_profile_month`/`_weight` and `inv_stock_item_season_profile`, (b) RLS write policy on `season_profile`, (c) which roles use the legacy page. No page change before this evidence.
3. **Follow-up F-B (separate WP08-boundary change, owner approval):** repoint the Products "Manage profiles" link and `master-data-platform.js` helper to the console's season section for Electron users who hold the console permission; keep the legacy link as fallback until F-A passes. This edits an accepted WP08 file, so it needs its own approval.
4. **Follow-up F-C (only after F-A and F-B):** make the legacy page read-only (remove insert/update/delete handlers) behind a reviewed change; archiving the file is a further, later decision. **Registry rows are never deleted to retire anything.**

## 5. `production-overrides.html` (unregistered; source-only)

* Not in the registry, not referenced by any page, script, service worker or test except the G1 audit.
* Loads `js/production-overrides.js` and `css/style.css`, **neither of which exists** (G1 test A1), so the page cannot function; its title reads "Supply Overrides" while the registered module is `supply-overrides` (`supply-overrides.html`).
* **Proposed disposition (separate approval):** archive-or-delete the dead shell in its own reviewed change after the owner confirms nobody bookmarks it. **No registry change is involved, and nothing is deleted by G2.**

## 6. Recorded lab permission-name differences (NOT TESTED; no alias, no access-check change)

| Registry key (`target_key`) | Key observed in page code | Status |
|---|---|---|
| `test-method-master-manager` | `lab-test-method-master` | page-level behaviour NOT TESTED — for ChatGPT/WP12 page-level verification |
| `lab-workflow-access-control-manager` | `lab-workflow-access-control` | page-level behaviour NOT TESTED — for ChatGPT/WP12 page-level verification |

G2 adds **no alias** for either, and test `S9`/`S10` assert the alias table is byte-identical to the authority head and that neither lab key resolves.
