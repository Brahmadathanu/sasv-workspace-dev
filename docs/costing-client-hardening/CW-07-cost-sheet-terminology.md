# CW-07 — Cost Sheet terminology correction

> **Owner status (2 Nov): client terminology accepted (PR #128 head `4f27cd06`, no further client change required).** The Home-page label is sourced from the live `public.app_modules` row for `cost-sheet-review` (label and description still say "Cost Sheet Review & Approval" / "approval support"); correcting it is a separate, owner-authorised server metadata change and is **not** part of any of these PRs. The earlier statement in this note that no hub string exists on the client stands: the Home label comes from the database registry view, not from client code.

Branch `feat/costing-cw07-cost-sheet-terminology`, baseline main `28cfadb20de3e2f3daf0aadada096f541254819d`. Draft; not merged.

## Finding
The screen titled "Cost Sheet Review & Approval" provides no approval function:
- Lenses: SKU Cost Details, Printable Cost Sheet, Snapshot Comparison, Scheme Comparison, QC Action Queue, Materials / Stores Action Queue.
- Every RPC called by `costing-suite-cost-sheet.js`, `costing-suite-qc-action-queue.js`, `costing-suite-materials-stores-action-queue.js` and `costing-suite-scheme-comparison.js` is a read (`rpc_get_*`). There is no approve/submit/write RPC and no approve control in the page.
- The only "Approved" fields (`csApprovedRole`, `csApprovedOrg`) are signatory text for the printable sheet layout, not an action.
- The page subtitle said "and approval support"; the route-config subtitle already described the real contents.

Conclusion: rename to **Cost Sheet Review** (already the name used in the modal title, lens controller comments and the Materials/Stores helper labels). Audit item U5 / CW-07 option "rename" is chosen; the "link to CW-02" option is not needed.

## Display text changed (and nothing else)
| File | Change |
|---|---|
| `public/shared/cost-sheet-review.html` | `<title>`, `<h1>`, initial subtitle (now equals the route-config subtitle) |
| `public/shared/js/costing-route-config.js` | `title` of `cost-sheet-review` |
| `public/shared/js/costing-suite-registry.js` | suite `label` |
| `public/shared/js/costing-suite-cost-sheet.js` | `source_module_label` shown in drill context |
| `public/shared/js/costing-suite-shell.js` | Scheme Comparison relocation toast |

Not changed on purpose: module key `cost-sheet-review`, permission target `module:cost-sheet-review`, suite id, `routePath`, file names, lens ids, RPC names, database objects, and `hub-cache-v390` (`public/sw.js`).

## Test infrastructure
Historical package tests assert that Costing HTML, the route config and the shell are unchanged against fixed bases. `scripts/lib/costing-scope-guard.mjs` now exports `CW07_LABEL_CHANGES`, `applyCw07Labels` and `isCw07LabelOnlyChange`: the base text is renamed before comparing, so these seven strings are the only tolerated differences and any other edit to those files still fails. No assertion was removed.

## Tests
`scripts/costing-cost-sheet/cost-sheet-terminology.test.mjs` (8 tests): labels agree across route config, registry, `<title>` and the single `<h1>`; no approval wording remains; identifiers unchanged; diff against baseline is exactly the rename; the label-only tolerance is narrow; read-only RPCs and no approve control; accessible header actions and `lang`; cache stays v390.

## Owner acceptance (Windows CMD)
```
node --test scripts\costing-cost-sheet\cost-sheet-terminology.test.mjs
```
Open Cost Sheet Review from the hub: the browser tab, the page heading and the suite switcher read "Cost Sheet Review"; URLs and permissions behave as before. Permission rows named `module:cost-sheet-review` are untouched.
