# WP05 W5-06 CONF-01 — Production release and acceptance evidence

**Date:** 10 November 2026  
**Status:** DEPLOYED; database/costing-permission acceptance verified; signed-in PostgREST and browser acceptance PENDING.  
**Governance:** WP05 formal closure remains **6/13**, W5-06 OPEN pending remaining acceptance; do not claim formal closure.  
**Policy:** Individual Staff Governance details require `module:cost-build-manager` both `view` AND `edit`; authorised editor retains the required total salary cost; the broad costing permission continues to provide aggregate pool figures, with nested `staff_details` masked to other viewers.

## Changes released

- Client PR [#258](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/258) squash-merged to `main` at `47170b5d2122184232364ba5dbc8c8503c36436c`. Its production Netlify static assets were independently fetched by [GitHub workflow run 42773452039](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/42773452039): `sw.js` uses `hub-cache-v393`, the published shell includes `personnelAccessAllowed()` and `purgePersonnelOnSignOut`. **This checks published static assets, not authenticated browser interaction.**
- Server PR [#257](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/257) squash-merged to `main` at `1135663db3448cef569e7fde58315c5a9772f1d7`.
- Pinned confidentiality migration `wp05_w506_conf_01_personnel_view_gate` applied successfully to Supabase project `qhmoqtxpeasamtlxaoak` by the dedicated migration tool. **Actual production migration-history version: `20261110071308`.** The repo file remains `supabase/migrations/20261109130000_wp05_w506_conf_01_personnel_view_gate.sql`. **Follow-up migration-history reconciliation is needed** before another migration pipeline/replay; do not mutate Supabase history or rename the migration casually. Use a separately reviewed reconciliation plan that preserves applied SQL, order and audit trail.
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

## Outstanding release acceptance and stop conditions

- **Real signed-in PostgREST:** With each identity's legitimate session, use `HEAD`/count-only views and a restricted `staff_details` null-only check (see design §6). Never place JWTs in logs, comments or documentation; never use the service key to simulate a normal user.
- **Browser:** Read-only Staff Governance tab checks for two view-only users and the editor; verify no restricted individual-staff network requests, absent edit/export access, and permitted aggregate views. Test sign-out data clearing. Mask/crop any salary data from evidence and do **not** click Save/Close.
- **External consumer inventory:** confirm whether any BI/export/Edge Function integration relies on individual staff views or nested `staff_details`.
- **Migration-version reconciliation:** reconcile `20261109130000` repo filename with `20261110071308` Supabase recorded version through a reviewed, non-destructive process before future migration application.
- Stop on any restricted nonzero personnel count, exposed nested staff details, unexpected 5xx, failed browser permission check, or mismatched migration history. Treat rollback as a security regression requiring separate emergency authorisation and alternate containment.

**No completed signed-in PostgREST/browser evidence is claimed in this record. Formal W5-06 closure remains OPEN until those checks and version reconciliation are complete.**
