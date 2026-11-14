# WP05 R49 — CSR-only owner-observed PASS; CCC-only test stage ACTIVE (12 November 2026)

**OWNER-OBSERVED SIGNED-IN FUNCTIONAL POSITIVE + LIVE PERMISSION TRANSITION.** The owner reported the R48 Stage 1 designated test-account normal-PWA results: other five costing modules restricted **YES**, Detailed SKU Cost Sheet **POPULATED**, Line Explanation/Traceability **POPULATED**. No screenshots, payloads, raw costing numbers, JWTs, network traces or staff identities supplied.

## Stage 1 outcome (R48 CSR-only)

- Test account permission category at time of owner check: **CSR View true; other five Costing modules View false; all six Edit false**; independently confirmed via SQL R48.
- Owner's first-person report confirms restricted other-module navigation and actual populated details and trace explanations. Credit as **owner-observed authenticated CSR-only functional PASS**, not independent network trace or full server/REST negative proof. It supports the intended CSR positive path for both sensitive Cost Sheet views; does **not** show CCC-only trace denial.
- User requested next CCC-only stage contingent on sufficiency; this criterion is met for the bounded owner observation.
- This result does **not** close the entire D-2/W5-06 parent gate or modify WP05 formal approval 6/13.

## Stage 2 live transition (CCC-only), completed

- Unique pre-existing designated test identity matched in guarded SQL; no test account creation or impersonation.
- Read-only preflight checked **six canonical rows**, exactly CSR View true and five other View false, six Edit false.
- Single atomic BEGIN/COMMIT changed only six View bits to **CCC View true, all other five View false**, and updated only their timestamps. All six Edit bits remained false; source rows and existing meta retained.
- Independent query of **public.v_user_permissions_effective** returned exact six module states:
  - Costing Control Center **View true, Edit false**;
  - Cost Sheet Review, Cost Build Manager, Material Cost Manager, Pricing Policy Manager and Production Route Manager **View false, Edit false**.
- Original baseline for final restoration remains six View=true and six Edit=false, with original metadata left untouched. This temporary CCC-only state remains ACTIVE pending the owner's PWA observations; do not advance automatically.

## Stage 2 owner browser acceptance (pending; no result presumed)

1. Fully sign out and back into the normal SASV PWA using the already authorized designated test account.
2. Verify CCC navigation available and the other five Costing modules not independently accessible.
3. From an appropriate existing shared Costing route, choose a known populated period/SKU. Confirm the **Detailed SKU Cost Sheet** actually displays populated detailed fields, not only the overview/list row fallback. Under approved Option C, the detailed view is authorized for CCC View.
4. Attempt to view the full line **Explanation/Traceability** only through the standard read-only UI if exposed. Under Option C, **CCC-only must not obtain full line evidence JSON**, even when it can see detailed cost values. If the line-explanation UI is inaccessible because CSR navigation is restricted, report **not reachable**, rather than claiming a server authorization denial. An empty result alone also does not prove denied access without a known populated line and controlled read path.
5. If available, check **Material Review Acceptance Register** under CCC for an expected populated row/status; CCC View should authorize it.
6. Reply with non-sensitive outcomes only: CCC navigation allowed yes/no, other modules restricted yes/no, Detailed SKU Cost Sheet populated/empty/error/not reachable, line trace restricted/visible/empty/not reachable/error, Acceptance Register populated/empty/error/not reachable. Do not copy pricing data, staff IDs, email actors, evidence JSON, JWTs, screenshots with business values or raw REST payloads.
7. Do not press any Edit, Save, Close, Approve, Preview, Refresh or writer actions.

**Next after owner observation:** record the evidence, then independently revalidate CCC-only before progressive MCM-only setup. Later PPM-only and any necessary negative categories, and final six-View baseline restoration, remain pending.

## Governance

- Live six-view D-2 database definitions already approved and installed (R34/R40/R43/R46); none changed in this stage.
- Stage 1 CSR functional positive **owner-observed PASS**; Stage 2 effective-permission change **PASS**, CCC-only PWA functional outcome **NOT TESTED**.
- W5-06 remains OPEN and WP05 formal 6/13; D-1 and D-4 holds and W5-03/04/07–10 closure requirements persist. No claims of complete WP05 acceptance.
