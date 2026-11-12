# WP05 R41 — MCM two-view browser acceptance readiness and next CCC reader decision (12 November 2026)

**READ-ONLY REVIEW; NO LIVE ROLE TEST COMPLETED.** Owner's MCM-only policy Q-R38-MCM approved; guarded live replacement of Material Rate History and Register applied under R40. Independent live catalogue reread on 12 November confirms expected new definition fingerprints and unchanged owner, ACL, explicit `security_invoker=false` and column counts. No additional DDL executed here.

## Verified live MCM state

| View | Live definition MD5 | Columns | Owner / ACL / mode |
|---|---|---:|---|
| `public.v_costing_material_manual_rate_history` | `01029a39e47a300aa7860d17b2f39cae` | 32 | postgres; postgres+authenticated SQL SELECT only; security_invoker=false |
| `public.v_costing_material_manual_rate_register` | `38b4262bfae719ca3f736185784fd047` | 34 | Same |

Both predicates are MCM View only for normal authenticated readers. Unrelated three views (CCC acceptance, CSR SKU cost sheet, CSR lineage) still have their previous definition MD5s. **These facts are definition-level evidence, not signed-in-user behavioural proof.**

## Non-identifying existing permission-record inventory

Using a single read-only aggregate `public.user_permissions_canonical` query, grouped internally by `user_id` without returning IDs, names, email addresses or audit/vendor details:

| Category | Distinct permission-record groups |
|---|---:|
| MCM View, without CCC/CBM/CSR/PPM View | **0** |
| MCM View with at least one CCC/CBM/CSR/PPM View | **3** |
| CCC/CBM/CSR/PPM View with no MCM View | **1** |
| CCC/CBM/CSR View with no MCM View | **0** |
| MCM Edit without MCM View | **0** |

A mixed MCM+other View account could establish a **positive** normal-session screen read, but not the narrower MCM-only condition. One non-MCM other-module permission group is a potential **negative** ordinary-session category, but that does not imply a CCC/CBM/CSR-only account exists. These are canonical permission-record group counts, not proof of current account activation, current JWT/session permissions or observed browser results. No role modifications, user provision, JWT impersonation or test account engineering.

## Actual client read contract verified on current main

In `public/shared/js/costing-suite-material-cost.js`:
- `fetchManualRateManagerRegisterRows` (~line 1670): full `v_costing_material_manual_rate_register.select('*')`, paginated 1000, register status/item/manual rate ordering.
- `fetchManualRateManagerHistoryRows` (~line 1682): full `v_costing_material_manual_rate_history.select('*')`, paginated 1000, item/effective date/manual rate ordering.
- `fetchManualRateHistory(row)` (~line 1654): per-stock-item History query `select('*').eq('stock_item_id',...).order(...).limit(100)`.
- The same Material Cost client separately consumes `v_costing_material_review_acceptance_register` through `loadMaterialReviewAcceptanceRegister` (~line 1373). **This may be a legitimate MCM workflow consumer, so the future CCC policy must not casually remove its read access.**
- Register depends on History, and both include supplier provenance; no data-projection change has occurred.

## Minimal authorised browser acceptance (no payload capture)

1. Use an existing legitimate **MCM View** user's normal authenticated SASV PWA session. Prefer the existing mixed MCM+Costing View category, since R41 inventory found no MCM-only category. Do not alter user permissions.
2. In Material Cost Manager, open **Manual Rate Manager → Register** and then **History**. If known existing manual-rate records are visible in each, note **Register records visible: YES/NO** and **History records visible: YES/NO**. Optionally open one item's prior rate history. Do **not** send rate amounts, vendor names, IDs, remarks, screenshots showing business data, JWTs or response payloads.
3. An empty table is **INCONCLUSIVE** unless there is independently known pre-existing data for the exact lens; a WHERE-denial can return HTTP 200 with `[]`. A client loading error is FAIL/INVESTIGATE.
4. A separate existing user with *no MCM View* may observe Register/History denial/emptiness as a candidate negative check, but that signal also requires a known nonempty relevant dataset and independent role validation. It will not establish CCC/CBM/CSR-specific denial unless that exact role exists.
5. Report only tested date, account **permission category**, UI outcome (Register visible / History visible / empty / error / not reachable) and no-payload confirmation. Do not claim tests not witnessed.

**Status:** MCM live DDL/catalogue **PASS**. Real signed-in positive and denied-role **NOT TESTED** at R41.

## Next owner decision: Q-R38-CCC — one Acceptance Register view

The live `v_costing_material_review_acceptance_register` remains unchanged (definition MD5 `df6c6771423c2aecb0130822a804a239`, 38 columns). It includes `accepted_by_email`, `acceptance_note`, period/rate-review status, and other acceptance evidence. **The Material Cost Manager source actually loads this view and renders accepted-by email, time and reason in an MCM panel**, so it is not safe to infer that only CCC uses the view merely because its name suggests Costing Control Center.

**Recommended provisional owner policy:** **CCC View plus MCM View** may read the full Material Review Acceptance Register, because CCC owns acceptance control and the MCM workflow already presents the acceptance context. **CCC or MCM Edit is not implied by View**, and no owner approval of the detailed actor/email exposure is presumed. If this staff identifier detail should be limited to CCC, then specify a separate reduced MCM status projection and design/test that before taking away existing MCM read access. CSR/CBM-only users would not automatically receive the full register absent a documented need.

This is **a proposal requiring an explicit owner ruling**, not an approved SQL correction or an execution instruction. Q-R38-CSR full cost/traceability readers also remain pending and will be handled independently.

**Formal governance:** W5-06 OPEN, WP05 **6/13**, historical AE1 and D1/D4 holds unchanged. No production SQL/grants/client edits were performed in R41.
