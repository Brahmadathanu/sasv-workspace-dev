# Costing Suite — Six-module view-only test identity grants (5 Nov 2026)

**Status: SIX COSTING GRANTS APPLIED AND VERIFIED; AUTHENTICATED BROWSER ACCEPTANCE NOT TESTED.** This is a checkpoint in the [unified Costing Suite workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md) and [programme closure ledger](PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md). No formal WP closure is implied.

## Owner authority and identity protection

On 5 November 2026 the owner expressly approved **adding view-only access for all six Costing Suite modules to a named existing SASV test account**, retaining all pre-existing permissions. The account's identifying email address and UUID are **intentionally excluded** from GitHub documentation. Its private identity remains in governed Supabase Auth and the canonical permission table; authorised administrators can locate it using the owner-designated email from the private request. No credentials, secrets or session tokens were requested or used.

## Database execution

- Project: `qhmoqtxpeasamtlxaoak`.
- Preflight verified **exactly one** matching Auth identity, **73** prior canonical grant rows, **zero** rows for the six targets and all six registered in `public.permission_targets`.
- First transactional attempt failed **before changes**: PostgreSQL does not support `max(uuid)`. The transaction rolled back. The identity check was corrected to `min(id::text)::uuid` guarded by count = 1.
- Second transaction committed six `INSERT` records into `public.user_permissions_canonical`: `can_view=true`, `can_edit=false`. A single PL/pgSQL transaction checked the original 73-row baseline, exact six-target absence, inserted-row count = 6, final total = 79 and all six intended booleans. Each new row's `meta` records the owner-approval purpose without including private identity details.
- Six permission targets:
  - `module:costing-control-center`
  - `module:material-cost-manager`
  - `module:cost-build-manager`
  - `module:pricing-policy-manager`
  - `module:cost-sheet-review`
  - `module:production-route-manager`

## Independent post-commit SELECT verification

| Check | Before | After |
|---|---:|---:|
| Total canonical permission rows for test identity | 73 | **79** |
| `can_view=true` across all targets | 67 | **73** |
| `can_edit=true` across all targets | 52 | **52** |
| Six Costing targets view-only | 0 | **6/6** |

Both `public.user_permissions_canonical` and `public.v_user_permissions_effective` returned `can_view=true, can_edit=false` for every target. Recorded grant timestamp: **2026-11-05 02:14:19.354985+00**. The unchanged edit count supports preservation of existing edit entitlements, but a complete before/after row-level hash for all unrelated records was not captured; do not overclaim this as a row-by-row proof.

**Critical distinction:** This test account has **52 existing edit permissions for non-Costing functions and modules**. It is a **Costing-scoped** view-only account, *not* an application-wide read-only or unprivileged account. It should never be used to assert universal absence of write capability. Existing elevated or indirect privileges require consideration when designing authenticated negative tests.

## Next acceptance gate

1. Have the legitimate account holder sign in using the normal SASV Workspace Auth flow, without sharing passwords, session tokens or OTPs. Existing sessions may need sign-out/sign-in to load fresh navigation permissions.
2. Verify a browser/test-client actually serves merged `main` commit `6241bc5b993eeb1218de9d5f68f3e81900100210` or a later reviewed commit carrying SEC-A1/SEC-A2 client changes. A local browser origin can still point at **production** Supabase; no paid branch was created.
3. In the signed-in session, confirm all six navigation entries are visible with no edit actions. In CCC, verify the draft-run panel displays the view-only explanation instead of **Review for approval**, and the network log has **zero** preview-ack RPCs. Follow [OWNER_ACCEPTANCE_RECORD_2026-11-04.md](OWNER_ACCEPTANCE_RECORD_2026-11-04.md).
4. Only execute read-only UI/navigation paths. Do not press Preview, Approve, Finalise, Refresh, Lock, Accept, Close, Save, Recalculate or any other write-capable operation on the live database.
5. Record source SHA, served asset digest, browser/device, flag OFF/ON scoping, network calls, responsive views, error evidence and flag restoration. Because user sign-in/browser evidence has not yet occurred, mark corresponding entries **NOT TESTED**.
6. For actual server permission-denial tests (SEC-A1/SEC-A2), propose a separately reviewed no-side-effect plan. Do not impersonate an Auth user by manipulating SQL role claims or assume catalogue checks prove real JWT behaviour.

## Programme and release gate

Server SEC-A1 and SEC-A2 are installed, SEC-A2 client PR #174 merged. **Formal programme closure: 5/13 (38%)**, unchanged. WP05/WP06/MDC-07/WP12 signed-in acceptance remains open. Eleven flags stay default OFF, no PWA/Electron deploy, cache bump or installer release. e-Aushadhi WP07 remains independently paused. The owner-approved database permission change is the only production write in this milestone.
