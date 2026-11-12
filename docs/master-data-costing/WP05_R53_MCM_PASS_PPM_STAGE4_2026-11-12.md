# WP05 R53 — MCM Stage 3 owner-observed PASS and PPM-only Stage 4 active (12 November 2026)

**OWNER-OBSERVED STAGE 3 POSITIVE, STAGE 4 PERMISSION STATE SET.** This is a bounded signed-in PWA observation, not independently captured JWT/network/REST evidence or whole-WP05 closure.

## Stage 3 — MCM View only

Owner reported on designated existing test account after R52 guarded MCM-only transition:
- MCM available and other five Costing modules restricted: **YES / PASS**.
- Material Cost Manager → Manual Rate Manager → Register: **POPULATED / PASS**. Source is `v_costing_material_manual_rate_register`.
- Material Cost Manager → Manual Rate Manager → Rate History: **POPULATED / PASS**. Source is `v_costing_material_manual_rate_history`.
- Material Review Acceptance in context: **NOT OBSERVED**, NOT FAIL. Acceptance information is displayed conditionally alongside a matching accepted material-action item, not a necessarily separately navigable register. No matching accepted item was confirmed in this stage, so positive live acceptance-reader evidence remains **NOT TESTED**, although R43 catalogue SQL and isolated PG17 role policy previously passed.
- These observations justify proceeding with PPM-only Stage 4 but do not amount to an MCM acceptance-panel PASS or to a negative-role REST proof.

## Stage 4 — PPM View-only guarded live transition

The owner requested transition if Stage 3 was sufficient. Read-only preflight verified one uniquely matched pre-existing designated test identity's six canonical Costing permission records: **MCM View true only; all other five View false, all six Edit false**.

A guarded transaction with baseline precondition and postcondition changed only six `can_view` bits, setting **`module:pricing-policy-manager` View true only**, and updated timestamps. Six records, all original `meta` and all six `can_edit=false` preserved. Separate readback from `public.v_user_permissions_effective` confirmed:

| Module | View | Edit |
|---|---|---|
| Pricing Policy Manager (PPM) | true | false |
| Cost Build Manager (CBM) | false | false |
| Cost Sheet Review (CSR) | false | false |
| Costing Control Center (CCC) | false | false |
| Material Cost Manager (MCM) | false | false |
| Production Route Manager (PRM) | false | false |

No other account, application source, view SQL, writer, approval, staff data, pricing policy or Costing run was changed. The original baseline retained from R48 is **all six Costing modules View true, all six Edit false**, to be restored after the progressive acceptance sequence. Stage 4 remains ACTIVE for owner's normal signed-in PWA checks. No automatic Stage 5 or restoration.

## Stage 4 PWA checklist (existing test user, normal sign-out/sign-in)

1. Confirm **Pricing Policy Manager** available and other five Costing modules restricted.
2. Within **Pricing Policy Manager → Scheme Master**, open an existing scheme row's detail drawer and its **History** tab (client reader `public/shared/js/costing-suite-pricing-policy.js`, `v_costing_scheme_master_audit` around line 5194). Confirm actual audit entries for a scheme known to have history; a detail drawer alone is insufficient. If no such known scheme, record not-observed/empty, not false denial.
3. Confirm basic PPM policy lens/view-only read paths function, using a known populated SKU or policy entry, without saving or modifying data.
4. Report only navigation restricted yes/no, Scheme Master list populated/empty/error, Scheme History populated/empty/error/not observed, other PPM policy read populated/empty/error/not checked. Do not share scheme rates, pricing values, actor details, account identifiers, source JSON or access tokens.
5. No Save/Edit/Close/Approve/Refresh or writer test. Confirm positive current PPM View only; negative read of other sensitive views would require an existing authorised safe read path, not merely absence of navigation.
6. After owner results, decide whether an additional negative-role CBM/PRM scenario is necessary; **restore the six-module View-only baseline explicitly after tests**, with independent effective-permission verification.

## WP05 programme state

- Stage 1 CSR-only: owner-observed positive PASS.
- Stage 2 CCC-only: 4/4 owner-observed PASS following documented READINESS_BUILD_STALE R50 error and R51 recovered portfolio #7.
- Stage 3 MCM-only: required navigation/register/history owner-observed PASS; Material Review Acceptance context NOT OBSERVED.
- Stage 4 PPM-only: permissions verified, **PWA NOT TESTED**.
- Six D-2 corrected production view definitions remain installed; no new definition/ACL change.
- W5-06 OPEN, WP05 formal **6/13**, technical 4/7. This partial acceptance work does not close D-1 writer denial, D-4 performance HOLD, or remaining W5-03/04/07–10.
