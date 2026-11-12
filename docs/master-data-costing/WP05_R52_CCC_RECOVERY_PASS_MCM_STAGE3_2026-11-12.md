# WP05 R52 — CCC Readiness retest PASS; progressive test account MCM-only Stage 3 active (12 November 2026)

**Stage 2 bounded functional acceptance PASS; Stage 3 permission setup PASS, browser NOT TESTED.** The owner reported the R51 normal signed-in PWA CCC-only Readiness retest as **POPULATED**, following owner-authorised November Readiness derived portfolio rebuild #7. The original R50 owner-observed Readiness ERROR (`READINESS_BUILD_STALE`) remains in the historical record. Current Readiness server build R51 #7 was independently verified COMPLETED/current with digest and source epochs matching the live source. This is recovery evidence, not an assertion that the stale build never occurred or a verified network trace.

## Stage 2 bounded owner-observed outcome

- CCC-only navigation restriction: **PASS**.
- Dashboard and SKU Control Status: **PASS**.
- Control Workbench: **PASS**.
- Readiness: initial R50 **ERROR**, then R51 rebuild and owner signed-in **POPULATED** retest = **RECOVERED PASS**.
- Stage 2 CCC-only PWA functional acceptance **4/4 PASS with documented recovery**, not blanket least-privilege REST proof, full six-view security matrix or WP05 closure.
- Crucial: CCC route has Dashboard, Control Workbench, SKU Control Status and Readiness. Detailed CSR SKU Cost Sheet and CSR full line Traceability are **not CCC lenses**; these must not be described as missing CCC UI elements, nor can inaccessible navigation be credited as effective SQL denial.

## Live Stage 3 guarded transition

Existing designated WP05 test account, owner-authorised for sequential single-module View-only simulation, was uniquely matched in `auth.users`; no identifying account token, UUID, or personal metadata copied into this repository record.

Preflight checked exactly six canonical Costing permissions, one View=true target (`module:costing-control-center`), all other five View=false and **all six Edit=false**. Within a guarded single transaction the six module View bits were set to `module:material-cost-manager` **true only**, preserving six rows, existing meta values, all six Edit=false and updating timestamp. Postcondition and separate read-only `public.v_user_permissions_effective` returned:

| Module | View | Edit |
|---|---|---|
| Material Cost Manager (MCM) | true | false |
| Costing Control Center (CCC) | false | false |
| Cost Sheet Review (CSR) | false | false |
| Cost Build Manager (CBM) | false | false |
| Pricing Policy Manager (PPM) | false | false |
| Production Route Manager (PRM) | false | false |

Only the designated test identity's permissions were changed; no other account, view policy, data row, source function, browser code, writer or Close operation. The original baseline from R48 is still **all six Costing View=true / all six Edit=false** and must be restored after testing. **Stage 3 remains ACTIVE pending owner browser observations**.

## Stage 3 browser instructions, tied to actual MCM code

After full sign-out/sign-in with the designated test identity, verify that **Material Cost Manager** is available and the five other Costing modules are restricted. Inside **Material Cost Manager → Manual Rate Manager**:
1. Open **Register** and confirm entries actually load for a known populated register. Source is `public.v_costing_material_manual_rate_register`, select all with stable paging.
2. Open **Rate History** and confirm entries load for a known populated history. Source is `public.v_costing_material_manual_rate_history`.
3. Optional: open an item to inspect **Rate History** and status; code's `fetchManualRateHistory` filters by `stock_item_id`. Verify only data visible, do not save/change anything.
4. Material Review Acceptance register is consumed by MCM `loadMaterialReviewAcceptanceRegister(periodStart)`, which shows acceptance actor/reason/notes in context when a matching accepted item exists. This is **not necessarily a separately labelled Register tab**. If no known accepted item or this context is unreachable, record `not observed`, not permission failure.
5. Do not operate Save, Close, Approve, Refresh, or writer buttons; MCM Edit is disabled.

Return outcomes only: MCM available/other modules restricted YES/NO; Manual Rate Register populated/empty/error; Rate History populated/empty/error; acceptance panel visible/not observed/error. Do NOT copy item IDs, rates, staff emails, notes, evidence JSON or JWTs. Empty results remain ambiguous without a known populated source.

After Stage 3 owner report, independently verify MCM-only before any PPM-only Stage 4 change. **No automatic transition.**

## Governance

D-2 six-view catalogue corrections remain installed. Stage 1 CSR-only bounded owner PASS, Stage 2 CCC-only bounded owner PASS with historic Readiness failure/recovery retained. Stage 3 MCM-only browser NOT TESTED. W5-06 remains **OPEN**, formal WP05 remains **6/13**, technical stage **4/7**. D-1 writer/no-call, D-4 p95 hold, and other WP05 remaining gates unaffected.
