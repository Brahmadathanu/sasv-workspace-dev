# WP10 Stage B — installed-v6.2.0 role acceptance receipt and conditional closure recommendation
**Date:** 21 November 2026 IST. **Status:** OWNER-REPORTED ACCEPTANCE RECORDED; FORMAL WP10 CLOSURE AWAITS EXPLICIT OWNER DECISION. **Programme:** 11/13 formally closed.

## Authorised staff observation (user's direct report)
The owner confirmed that **every staff installation** had been checked and was on **SASV Workspace v6.2.0** before the Stage B cutover. After cutover, the owner reported:
- **Editor account: PASS** for the requested installed-app classification access checks.
- **View-only account: PASS** for the requested installed-app classification access checks.
- **No-access account: PASS for navigation visibility**: the classification modules were **not visible to access**. No independent direct URL/deep-link denial, HTTP 403 or real JWT negative route request was reported; **direct-route denial remains NOT TESTED**.

The observations are **owner-reported** (not independently captured by this assistant's browser). No usernames, screenshots, JWTs, account IDs or business-record bodies are included. The report does not prove a successful live production write, nor that credentials used in the app independently match every canonical entitlement row.

## Corroborating independent server evidence, previously verified
- Owner-approved production migration `20261121094820_wp10_four_master_stage_b_revoke_authenticated_direct_dml` APPLIED; read-only postflight confirmed all four public classification tables retained `authenticated SELECT` and revoked **INSERT/UPDATE/DELETE 12/12**. All four Stage A RLS configurations preserved.
- All 12 relevant governed `rpc_wp10_*` CRUD procedures have SECURITY DEFINER, authenticated EXECUTE true, anon false, and previously inspected canonical `require_permission` guards.
- Source of published v6.2.0 has 12 RPC-only classification calls; staff versions verified by owner. Per-binary ASAR hashes were not independently gathered.
- Read-only aggregate canonical permission register: one classification Editor (View+Edit on >=1 target), three classification-view-no-classification-edit users, zero Edit-without-View. This register aggregate does not authenticate any particular UI observation.

## Closure matrix
| Gate | Evidence status |
| --- | --- |
| Stage A policy application, migration reconciliation | PASS, earlier production receipts |
| Stage B four-table direct-DML REVOKE, registered migration | PASS, independent catalog and ledger |
| Governed RPC source/execution grants and module View+Edit guards | PASS at source/catalog layer |
| Fleet on v6.2.0 | PASS, owner report; hashes NOT TESTED |
| Editor installed UI list/control behaviour | PASS, owner-reported |
| View-only installed UI list/control behaviour | PASS, owner-reported |
| No-access module hidden from navigation | PASS, owner-reported |
| No-access direct-route/deep-link denial under genuine JWT | NOT TESTED |
| Real-JWT Editor positive RPC write / restricted negative RPC write with disposable data | NOT TESTED; do not manufacture production test |
| Installed binary ASAR hash matched to release | NOT TESTED |
| Optional separate WP10 Phase 2 product/subgroup concurrent lock correction 04/05/99 (see draft #444), optional PR #463 | NOT INSTALLED; independently gated; no implicit permission to install |

## Owner decision requested (not assumed)
**Recommended: conditionally CLOSE WP10** on the basis of completed Stage A/Stage B security installation, v6.2.0 fleet verification, and the three owner-observed role UX results, while **explicitly accepting** the narrow residuals listed above. Carry any still mandatory genuine-JWT negative direct-route and controlled non-production RPC test to WP12 security acceptance, with the owner as receiving decision maker; optional 04/05/99 lock safeguards and PR #463 remain separately held and cannot be recharacterized as passed. **Alternative:** keep WP10 OPEN until the additional acceptance is provided.

No new production DML, browser probing, database role creation, permission modification, file merge, installer publication, feature-flag change or GitHub PR merge is authorised by this receipt. Stage B is not rolled back automatically; any RE-GRANT requires explicit incident-level owner approval.
