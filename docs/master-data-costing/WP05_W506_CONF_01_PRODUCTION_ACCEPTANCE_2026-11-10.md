# WP05 W5-06 CONF-01 — Production release and acceptance evidence

**Date:** 10 November 2026  
**Status:** DEPLOYED; database/costing-permission acceptance verified; signed-in PostgREST and browser acceptance PENDING.  
**Governance:** WP05 formal closure remains **6/13**, W5-06 OPEN pending remaining acceptance; do not claim formal closure.  
**Policy:** Individual Staff Governance details require `module:cost-build-manager` both `view` AND `edit`; authorised editor retains the required total salary cost; the broad costing permission continues to provide aggregate pool figures, with nested `staff_details` masked to other viewers.

## Changes released

- Client PR [#258](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/258) squash-merged to `main` at `47170b5d2122184232364ba5dbc8c8503c36436c`. Its production Netlify static assets were independently fetched by [GitHub workflow run 42773452039](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/42773452039): `sw.js` uses `hub-cache-v393`, the published shell includes `personnelAccessAllowed()` and `purgePersonnelOnSignOut`. **This checks published static assets, not authenticated browser interaction.**
- Server PR [#257](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/257) squash-merged to `main` at `1135663db3448cef569e7fde58315c5a9772f1d7`.
- Pinned confidentiality migration `wp05_w506_conf_01_personnel_view_gate` applied successfully to Supabase project `qhmoqtxpeasamtlxaoak` by the dedicated migration tool. **Actual production migration-history version: `20261110071308`.** The canonical repository file is now `supabase/migrations/20261110071308_wp05_w506_conf_01_personnel_view_gate.sql` following [PR #260](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/260), squash merge `62107719315da492a7f29aef8599759cad18876e`. The former `20261109130000` file is absent. **The live `statements[1]` content was independently matched byte for byte with the canonical repository file (9,604 characters; unchanged Git blob `f2095c11fcf213d3eb8be69514d6d1b959a6fd5c`).** No Supabase history edit, migration replay, or security-function change occurred during reconciliation. The scoped #259 version-mismatch problem is resolved; a whole-project migration drift assessment remains separate.
- Existing W5-06 Save/Close writer guards remain applied. No retroactive edit of them or permission grants was made.

## Verification already completed

1. Prior to the production migration, all four default-deparse MD5 fingerprints matched the pinned candidate:
   - Register `2447f6b30fdc11e5e5dac487619b9142`
   - Unclassified review `659a7d0e992a7bae23b4b0409d33a161`
   - Pool summary `80d1a1a4f2e3add5eae58acac99e14fd`
   - Broad gate `a5c51f50421d35a7207878c237fff273` (unchanged after deployment)
2. [Server PR-only CI](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/42773452039) passed isolated PostgreSQL 16.15 and the captured live PG17.4 view-definition fixture, with **15/15 static**, **30/30 runner**, and **14/14 identity matrix**; forced failure after helper creation and first/second view replacements leaves no changes, and rollback/induced drift stop checks pass. This is isolated testing, not native PG17.4 execution.
3. [Client PR-only CI](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/42758694875) passed **22/22 confidentiality** and **11/11 dynamic access-revocation, sign-out and late-response cases**.
4. Production post-apply catalogue: two individual-staff views refer to `fn_costing_personnel_view_allowed()`; the pool retains `fn_costing_view_allowed()` and masks `staff_details`. Owners, column order/types, reloptions and ACL contracts were preserved by the migration. The helper exists, `authenticated` and `service_role` have EXECUTE, while `anon` and `PUBLIC` have none.
5. Live production **transaction-local `SET LOCAL ROLE authenticated` + JWT-subject setting simulation**, `SELECT` counts only, transaction rolled back; no salary names/rows exported and no permission changes:

| Existing permission category | Personnel allowed | Register rows | Review rows | Pool rows | Non-null `staff_details` |
|---|---:|---:|---:|---:|---:|
| CBM View-only 1 | false | 0 | 0 | 42 | 0 |
| CBM View-only 2 | false | 0 | 0 | 42 | 0 |
| Cost Sheet Review viewer | false | 0 | 0 | 42 | 0 |
| CBM View + Edit authorised editor | true | 164 | 0 | 42 | 42 |
| Authenticated with no JWT subject | false | 0 | 0 | 0 | 0 |

The authorised editor's count confirms nonempty individual-personnel access without extracting protected row details. All 42 aggregate pool rows remain available to the permitted costing viewers.

## Consumer and data-integrity review

- Read-only PostgreSQL dependency scan identified `public.v_costing_unclassified_staff_for_costing` as a dependent view of the classification register, already within the release scope.
- Searching defined functions in `public`/`costing` identified `costing.rpc_set_staff_costing_classification` and `costing.rpc_close_staff_costing_classification` as server consumers of the restricted views. These established Save/Close writer paths were previously guarded; do not alter or replay them.
- The read-only post-release classification baseline recorded **164 rows** and `max(updated_at) = 2026-10-16 03:17:31.055173+00`. This is a post-release reference point, **not proof** of unchanged state versus a separately captured pre-release timestamp.
- This database catalogue scan cannot prove the absence of external BI, custom PostgREST clients or Edge Function consumers; review those inventories separately.

## Authenticated acceptance tooling and additional consumer inventory — 10 November 2026

- [PR #261](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/261) squash-merged at `9caf1fb1839b883702a6b8091ca00ba1deab7fc7`, adding `scripts/costing-w506-conf-acceptance/live-staff-governance-acceptance.mjs` and [the operator-only runbook](WP05_W506_SIGNED_IN_ACCEPTANCE_RUNBOOK_2026-11-10.md). Pure-contract GitHub Actions [run 42802421322](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/42802421322) passed **9/9**, with no tokens, test login or production calls. The runner uses an existing operator-created Playwright storage-state file and an independent canonical permission proof, both kept outside the repository; it performs count-only real signed-in PostgREST checks and read-only tab navigation with a fail-closed request guard. **The genuine signed-in operator run has NOT yet occurred and is not represented by 9/9 CI.**
- Live Supabase Edge Functions inventory was checked via read-only list/get operations: the three deployed functions were `cleanup-raw`, `lookup-reference-doi` and `eaushadhi-qc-report-verify`. Their retrieved source content contained **no direct references** to `v_costing_staff_classification_register`, `v_costing_unclassified_staff_for_costing`, `v_costing_staff_cost_pool_summary`, `fn_costing_personnel_view_allowed`, or `staff_details`. This is a bounded textual source scan, not dynamic dependency proof. Unconnected external BI, third-party consumers and indirect access remain unverified.

## Genuine authenticated acceptance — operator-reported results, 10 November 2026

The operator supervised local, signed-in, read-only production browser runs with the merged W5-06 acceptance runner. The five redacted result files remain under restricted owner-controlled local storage; **the files themselves have not been ingested or independently verified in this GitHub record**. No JWT, UUID, staff identity, salary record, or unredacted screenshot was shared to the repository.

| Identity/check | Operator report | Details |
|---|---|---|
| CBM View-only #1 | PASS | Six runner checks true; process exit not recorded; report verdict PASS |
| CBM View-only #2 | PASS | Exit 0; six runner checks true; no findings |
| CBM View+Edit editor | PASS | Exit 0; six runner checks true; no findings; 107 canonical permission rows; true View and Edit |
| CSR-only viewer | BLOCKED / NOT TESTED | No qualifying existing production identity (CSR View true, CBM View and Edit both false) |
| Extra CBM view-only UI action inspection | PASS | Exit 0; eleven checks true; 100 observed requests, zero blocked by allow-list; no unexpected restricted action controls |

The final UI inspection (operator-reported) found: restriction notice present on Staff Review Queue and Classification Register; zero individual rows on both; zero `[data-edit-staff-classification-index]` elements across all three tabs; classification edit/review modals hidden with `aria-hidden`; Save button not visible; Staff Pool Summary displayed **seven aggregate rows** (this is the UI's period/filter-specific rendered count, not a contradiction of the earlier 42 live database pool rows across periods). No download event occurred. No Save/Close action was clicked. The browser's network guard blocked no attempted request in this run.

**Export hardening observation:** the export button remained visible and enabled on all three tabs, independent of personnel access. In the restricted individual tabs, the current client holds zero rows and the observed source behaviour is to show a `No rows to export` toast; the pool tab holds only aggregate rows. No confidential data leak was observed, but the UX should hide or disable export on restricted individual tabs as a separate, reviewed, client-side hardening improvement. **No export action was clicked and the claimed toast outcome is from code inspection, not execution.**

## Owner residual decisions — 10 November 2026

The owner explicitly confirmed **no known external BI or independently hosted applications** depend on the three protected views, and approved the proposed residual acceptance: CSR-only remains **NOT TESTED** (no eligible live identity) with deferred validation; export-button hardening [#262](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/262) is non-blocking; and direct production unauthorised Save/Close testing remains out of scope in favour of deployed server guards, isolated negative tests and read-only UI evidence. See [owner decision record](WP05_W506_CONF_01_OWNER_RESIDUAL_DISPOSITION_2026-11-10.md).

**Not yet confirmed:** whether all test sessions were actually signed out or revoked. Deleting local session/proof files and closing the Claude terminal do not themselves establish Auth session invalidation. This outstanding procedural confirmation is distinct from accepted D1–D4. No all-device logout, session deletion, or user-permission change is authorised by these approvals.

## Remaining W5-06 closure requirements

1. **CSR-only identity gap:** The genuine CSR-only role cannot be marked PASS. Obtain a properly governed identity later, or require an explicit owner-approved exception documenting that this role was not live-tested, supported by separate negative SQL/CI permission tests. Do not change an operational account's permissions solely to create test evidence.
2. **Outside-repository consumers:** Deployed Supabase Edge Functions have already been source-scanned (three functions, no direct references); repository and database catalog scans completed within scope. External BI, third-party reporting, scripts, and other independently hosted integrations still require owner confirmation, or an explicitly bounded no-known-consumer declaration.
3. **Action denial:** Browser inspection confirms Edit/Review actions absent and modals hidden for the view-only user. Direct Save/Close interaction was **not performed** and should not be attempted in production merely to assert denial. Server-side writer permission guards and isolated tests remain the supporting evidence.
4. **Export UX:** Track a separate client hardening issue for disabled/hidden export on restricted individual tabs. No observed leak; do not conflate this follow-up with a production confidentiality regression.
5. **Session and evidence hygiene:** Operator reports temporary session/proof files were deleted; session revocation must be confirmed according to existing SASV policies. Keep the five redacted reports in restricted owner storage, not public source control. Existing mock-backed sign-out/dynamic permission-revocation tests do not constitute fresh live sign-out acceptance.

**W5-06 formal state: OPEN; WP05 closure stays 6/13 until the owner resolves the CSR-only gap, external consumer scope and remaining acceptance governance.**
