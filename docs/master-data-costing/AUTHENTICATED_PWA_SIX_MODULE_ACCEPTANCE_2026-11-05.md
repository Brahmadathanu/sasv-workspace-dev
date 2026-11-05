# Six-module authenticated PWA owner acceptance — initial observations and follow-up (5 November 2026)

**Status: navigation verified 6/6; screen-level read-only acceptance PARTIAL. Two distinct dependencies identified. This record belongs to the existing unified Costing Suite workflow. Formal closure remains 5/13 (38%).**

## Evidence supplied by owner

A legitimate session using an existing designated SASV test account with canonical **Costing** module grants `can_view=true, can_edit=false` (all six) navigated to the production PWA and exercised only read-oriented screens. No account identifier or credential is reproduced in repository documentation.

- **Costing Control Center:** Dashboard populated for November 2026 draft run **149** (valuation 2 Nov 2026), with **121/628 ready**, **506 review**, **1 blocked**. Control Workbench and SKU Control Status reportedly loaded. **Readiness** displayed `READINESS_BUILD_ABSENT` with current period Nov 2026.
- **Material Cost Manager:** Manual Rate Manager loaded; RM/PM contribution trace screens correctly displayed confidentiality restrictions. Additional trace-level roles were not present for the tested identity. Do not grant trace access merely to make these messages disappear.
- **Cost Build Manager:** tables loaded.
- **Pricing Policy Manager:** explicit `View-only access — editing actions are unavailable.` banner; tables loaded.
- **Production Route Manager:** most table lenses loaded, but **Cost Centres** showed `rpc failed: Unknown RPC error Parameters: {}`.
- **Cost Sheet Review & Approval:** tables reportedly loaded.

The screenshots and owner's observations establish functional signed-in module entry, not server-side denial proofs or validation of every action and lens. Some read-heavy views may time out, as noted below.

## Readiness — database dependency confirmed

Read-only SQL inspection: `costing.product_sku_readiness_portfolio_build` contains **one current completed September 2026 build** and **one current completed October 2026 build**, but **zero current November 2026 build rows**. The live `public.rpc_get_product_sku_readiness_portfolio` code intentionally raises `READINESS_BUILD_ABSENT` where no current build exists. November's unavailable message is **not a test-account permission denial**. This is a governed snapshot-build dependency; do not create or promote a production build in an unrelated view-only acceptance package.

## Production Route Manager Cost Centres — client-root cause

Repository inspection of `public/shared/js/costing-suite-production-route.js` found that `governed(name,built,fallback)` explicitly denies `!canEdit()`, while `invoke(name,built,fallback)` uses the strict RPC contract adapter without that edit gate. The Cost Centres controller incorrectly passed **both read-only `RPC.list` and `RPC.detail` through `governed`**, triggering the denial for the view-only identity before the RPC could execute. Its fallback formatting displays an unhelpful unknown RPC error. The live `public.rpc_get_production_cost_centres` and `public.rpc_get_production_cost_centre_detail` enforce `require_permission('module:production-route-manager', false)` and grant authenticated EXECUTE, so the **server contract permits view-only reads**. There are 88 total Cost Centre records (86 date-valid on 5 Nov).

Proposed narrowly scoped client patch changes only the two reads to `invoke` and supplies `invoke` alongside `governed` to the Cost Centres controller. **Create, update, validate, approve and inactivate continue to use `governed`, require `canEdit()`, and retain their server-side edit protection.** Read-detail action rendering remains based on `canEdit`. No Supabase function change, data mutation, new grant or flag activation is required. Post-fix signed-in UI is **NOT TESTED** until deployed and retested; a source patch is not a live fix.

## Additional server logs: separate read-heavy performance findings

At **2026-11-05 04:50:16 UTC** the PWA's authenticated read from `v_costing_pricing_printable_cost_sheet_product_summary` returned HTTP 500, PostgreSQL code **57014 statement timeout**. At **04:59:50 UTC** the authenticated read of `v_cost_sheet_snapshot_sku_monthly_comparison_governed` likewise returned HTTP 500 / **57014 statement timeout**. These logs support **separate Cost Sheet Review query-performance follow-up**, even if UI tables appeared to load or recover. Do not silently classify every CSR lens as performance-PASS on the basis of screenshots alone.

## Next evidence gates

1. Independently review and execute Cost Centre list/detail view-only and editor mock tests in LF/CRLF plus existing PRM/Costing regression tests. Document exact pass/fail/skips and source SHA. No altered permissions or data writes.
2. Owner-reviewed squash merge separately; public PWA deployment/cache provenance and source must be verified before claiming the live Cost Centres issue resolved.
3. Retest signed-in view-only **Cost Centres** list and detail; verify no write action is enabled and no client-generated RPC to any create/update/validate/approve/inactivate endpoint occurs. Repeat editor UI proof without production mutation.
4. Govern November readiness build separately, maintaining source-fingerprint, run and period governance. Do not invent a build or equate draft costing KPIs with live readiness.
5. Treat the two Cost Sheet Review 57014 errors as a separate SELECT-only performance investigation, with safe query shape/limits and no expensive production scans absent safeguards.
6. Record screenshots, exact build provenance, network counts and disabled/edit affordances. SEC-A1/SEC-A2 authenticated server denial and eleven flag-ON acceptance are still **NOT TESTED**.

**No new formal work-pack closure, global flag activation, PWA or Electron release is authorised by this record.**
