# WP05 R50 — CCC-only Stage 2 owner observation and Readiness error HOLD (12 November 2026)

**Stage 2 owner-observed result: PARTIAL (3 PASS, 1 ERROR). MCM-only Stage 3 NOT STARTED.** Owner reported on existing designated test-account signed-in PWA under Stage 2 CCC-only (R49): Navigation restriction PASS; Dashboard and SKU Control Status PASS; Control Workbench PASS; **Readiness ERROR**. These are owner's observed functional reports, not independently captured network traces.

## Test account state

R49 preflight/update and effective-permission readback established **CCC View only** among the six Costing module targets; CSR, CBM, MCM, PPM and PRM View false; all six Edit false. The original baseline (all six View true, all six Edit false) is preserved in R48 and remains final-restoration target. **R50 makes NO permission change**. Keep CCC-only state intact while investigating; do not advance to MCM until the Readiness issue is classified and an owner disposition is recorded.

## Read-only source diagnosis (no account impersonation)

Current main sources:
- `public/shared/js/costing-route-config.js`: CCC allowed lenses are Dashboard, Control Workbench, SKU Control Status, Readiness. Detailed SKU Cost Sheet and Full CSR Line Traceability are not CCC lenses, and were correctly removed from the earlier misleading browser checklist.
- `public/shared/js/costing-suite-readiness.js`: Readiness is a `LIVE_AS_OF` governed snapshot. It uses three normal RPC reads: `rpc_get_readiness_governed_periods`, `rpc_get_product_sku_readiness_portfolio`, `rpc_get_readiness_product_gaps`. The client validates returned JSON envelopes and renders `Readiness unavailable — ...` errors; it may separately report governed-period, portfolio or gaps load errors.
- Current live read-only `pg_proc` metadata: all three RPCs are `SECURITY DEFINER`, postgres-owned and grant authenticated EXECUTE, **but** first require `auth.uid()` non-null and `app_has_permission('module:costing-control-center','view')`. CCC-only test account has CCC View true at prior verified permission readback. This establishes the role design, not actual signed-in session response or function success.
- Current metadata query of `costing.cost_periods` and `costing.product_sku_readiness_portfolio_build`: November 2026, October 2026 and September 2026 each have one current build with `status='COMPLETED'`. This rules out a simple absence of current build records for these periods, but does **not** verify freshness digest match, portfolio RPC output, application rendering or error details.
- No user session/JWT, RPC production call as another user, sensitive portfolio row, readiness membership payload, server migration or client change was made.

## Minimal clarification required to diagnose

Request the **exact visible text** shown in the Readiness error, excluding any sensitive business data. Ideally the owner should identify whether the message appears in the main Readiness table (for example `Readiness unavailable — ...`), as a toast, or only when opening a particular panel. A screenshot **cropped to the error message only** is acceptable if it contains no account, supplier, SKU, price, personnel or token details. No need for browser console/network payload until the displayed error is classified.

**Next engineering step:** depending on exact message, inspect corresponding guarded-permission, envelope validation, freshness, RPC error, or rendering path. Do not apply speculative changes or claim server/client root cause. Stage 3 MCM-only requires a bounded documented disposition of this Stage 2 error (fix+retest, or explicit owner-approved deferral) before removing CCC-only test state.

## Governance status

- Stage 1 CSR-only owner-observed three functional checks PASS (R49).
- Stage 2 CCC-only navigation, Dashboard/SKU Control, Control Workbench PASS; Readiness **ERROR, investigation open**.
- D-2 six production views remain corrected at catalogue level. Readiness RPC issue is **a distinct potential issue** and not proof of six-view permission regression.
- W5-06 OPEN, WP05 formal **6/13**. No new security PASS or closure is claimed.
