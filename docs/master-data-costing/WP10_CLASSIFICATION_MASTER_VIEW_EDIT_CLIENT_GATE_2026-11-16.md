# WP10 — Classification master client View/Edit gate and evidence (2026-11-16)

## Integrated draft (UNMERGED)
- `js/classification-master-access.js` calls existing `app_has_permission` with separate `view` and `edit` checks for each of the four canonical `module:manage-*` keys.
- `js/categories.js`, `js/subcategories.js`, `js/product-groups.js`, `js/subgroups.js` import and invoke the guard. Initial state LOCKED; only an affirmative View+Edit check releases edit/save/delete/add controls. View-only users retain listing rendering. Failed/unauthorized checks deny writes in the UI; server RPCs independently check Edit.
- `scripts/wp10-g2-safeguards/browser-classification-access.test.mjs`: mocked Chromium @390/1280, Editor/View-only/No-permission/permission-check error. It checks visibility, click suppression, and unchanged read-only listing rendering. This browser harness is not a live identity test.
- `verify-classification-crud-contract.mjs` requires all four screens to import the guard and validates the fail-closed contract. The GitHub Actions WP10 workflow includes the browser test.

## Security boundary and residual read risk
The direct-DML revoke protects table writes. It deliberately **preserves SELECT** grants because classification lookups are shared across application modules. Existing table RLS SELECT policies admit any authenticated user. Therefore, the new client gating does not itself prove that a no-module-permission identity cannot retrieve classification data via raw API queries. Closing that read-exposure boundary requires a separate SELECT-consumer inventory and authorization decision. Do not claim direct GET negative-role acceptance or confuse hidden UI with RLS read protection.

## Gate
No live acceptance, deployment, flag change, RPC installation or grant REVOKE has been performed. Required: green exact-head CI, independent review of browser/PG harness assertions, explicit owner-authorized phased rollout, verification with existing Editor/View-only/No-access test accounts, older Electron transition, and WP10 concurrency CL15 resolution. WP10 OPEN.
