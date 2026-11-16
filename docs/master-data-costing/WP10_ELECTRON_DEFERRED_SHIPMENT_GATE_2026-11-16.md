# WP10 — Deferred Electron shipment decision (2026-11-16)

## Owner decision
**Defer the next Electron version until the Costing Suite release is ready.** Do not create an interim installer or publish an updater solely for WP10 classification masters. Treat the merged client package as **integrated, pending normal Electron release**.

## Confirmed inclusion in a later Electron package
- Classification client PR #445 is merged into `main` as `13168b29939cf88be42bc6a56d4d22fe1be6d220`; later docs-only merge `dc77cad1232f42e8b450f12b94c4882605b12252`. All four root HTML management pages and the four rewritten JS modules, `js/classification-master-access.js`, `js/classification-html-escape.js`, and Product Group kind chooser are committed to `main`.
- The current `package.json` Electron-builder `build.files` includes `**/*`, excluding docs/scripts/tools/supabase/sql and other nonruntime paths; **none of the four root management HTML files or the six JS files is excluded**.
- `main.js` runs a local Express server using `express.static(path.join(__dirname))` on port 3000, launches `login.html` from that server and loads Electron module links through its child-window `loadURL`. A packaged build using the same source tree therefore includes and serves the classification pages/scripts.
- This establishes **source inclusion and expected runtime routing**, not proof of a built Windows installer or installed-user behavior. The four pages remain Electron-only in the WP09 route inventory; merging JS to `main` does not make these screens available through hosted PWA.
- The 12 governed RPCs are already installed on production with postflight PASS 12/12, unchanged grants 4/4, and a documented rollback boundary. Do not reinstall them.

## Condition to release together with Costing Suite
At the **future Electron packaging gate**, require:
1. The release commit is a descendant of `13168b29939cf88be42bc6a56d4d22fe1be6d220`, and the build manifest/ASAR contains all four HTML, four JS and two shared helpers, plus `manage-product-groups.html` with mandatory `newGroupKind`.
2. Build and installer/updater receipt from Windows packaging; check the actual installed application can open each module and loads `http://localhost:3000/js/{categories,subcategories,product-groups,subgroups}.js` and two security helpers, without stale code.
3. With existing authorized identities, real **Editor**, **View-only** and **No-access** negative and positive acceptance on all four modules. The View-only role must not be able to create/rename/delete. Direct-route negative checks must fail closed; do not modify role grants just for testing.
4. Confirm master data and installed RPC parity and that those four clients call only governed RPCs for CRUD. No experimental deletion or editing of genuine master records.
5. Preserve existing authenticated table DML until the legacy Electron install base has demonstrably migrated. A later four-table `REVOKE` requires separate review and explicit owner authorization.
6. Retain WP10 proposal 04/05, CL15 product activation parent lock, Route Manager mapping concurrency and privileged subgroup reassignment as distinct open gates. Do not imply these ship with the client-only PR.

## Status
- Source integration / server-first RPC installation: **PASS**.
- Electron packaging now: **DEFERRED BY OWNER** until Costing Suite completion.
- Electron installed acceptance: **NOT TESTED**; no installer or deployment is claimed.
- PWA classification master routes: **NOT PRESENT** according to current route inventory.
- WP10 formal closure: **OPEN**. This deferral is not a waiver of the runtime acceptance or direct-DML security residual.

Upon future Costing Suite release readiness, reopen this checklist for the combined Electron release, not as an immediate additional release.
