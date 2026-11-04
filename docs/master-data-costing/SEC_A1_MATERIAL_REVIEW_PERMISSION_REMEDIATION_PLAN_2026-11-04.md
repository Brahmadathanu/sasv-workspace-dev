> **LIVE SEC-A1 completion checkpoint — 4 Nov 2026:** Supabase migration `20261104155525` (`sec_a1_material_review_ccc_edit_permission_guard_20261104`) successfully applied to project `qhmoqtxpeasamtlxaoak`. Both material-review acceptance overloads and closure now require CCC edit at internal function entry; three new expected body MD5s, SECURITY DEFINER/owner/search_path and wrapper grants verified. [Full post-apply evidence](SEC_A1_LIVE_APPLICATION_AND_VERIFICATION_2026-11-04.md). **Server code correction COMPLETE, live role-level testing NOT YET DONE**; SEC-A2 preview acknowledgement and dedicated view-only account remain open, signed-in acceptance NOT TESTED. Historical 'prepared/not applied' statements below refer to the *pre-application state*, superseded by this checkpoint. Formal programme **5/13 (38%)**; no client deploy, cache, Electron or feature activation.

> **Independent review checkpoint — 4 Nov 2026:** The APPLY and ROLLBACK versions were re-read on the draft branch: three function bodies matched pairwise with exactly one CCC-edit check added to each APPLY body; draft PR is one branch ahead of the merged programme baseline with exactly seven documentation/prepared files. A disposable Supabase branch was requested **without** a cost confirmation, and Supabase refused creation until an explicit cost-confirmation ID is supplied. **No branch was created, no SQL was executed and no role-level testing was performed.** Isolated SQL/permission tests remain BLOCKED until the owner confirms the applicable Supabase organization and quoted hourly cost. Do not treat this static review as production migration approval.

# SEC-A1 — Material-review acceptance/closure RPC edit-gate correction (prepared, NOT APPLIED)

**Prepared:** 4 November 2026 · **Status:** SERVER-CHANGE REVIEW GATE · **Live project:** `qhmoqtxpeasamtlxaoak`

> **Do not execute or merge into the Supabase migration sequence based solely on this document.** No production migration, role/permission change, user creation, RPC call, data modification, or flag activation has taken place. This is a security-sensitive server package requiring independent review, owner approval and a separately controlled apply/verify/rollback decision.

## 1. Programme relationship

This SEC-A1 package supports the **existing** [Costing Suite unified workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md), [formal progress ledger](PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md), [security findings](PRODUCTION_READ_ONLY_ACCEPTANCE_SECURITY_AUDIT_2026-11-04.md), and [owner acceptance record](OWNER_ACCEPTANCE_RECORD_2026-11-04.md). It does **not** constitute another master workflow or a new work pack.

- Formal closure: **5/13 (38%)**; recent WP06/WP12 implementation integration: **3/3 completed**; WP05/WP06/MDC-07/WP12 still open.
- Latest baseline before this document branch: `main` `52d4797859e2ba0cdcaf7bcb1368c46fa2fde557` (#171 programme reconciliation merged).
- SEC-A1 is one prerequisite to genuine six-module signed-in **view-only** acceptance. SEC-A2 (preview acknowledgment insert under CCC view), absent view-only account, CDE-2 and other governance remain separate.

## 2. Scope and business decision

**Minimal behavioural-parity policy:** require `public.require_permission('module:costing-control-center', true)` on **three internal SECURITY DEFINER functions**, at the first executable statement:
1. `costing.rpc_accept_material_review_action(date, bigint, text, text, text, text, text, text, text, text)` — the 10-argument issue-summary overload.
2. `costing.rpc_accept_material_review_action(date, bigint, text, text, text, text, text)` — the 7-argument historical material-issue overload.
3. `costing.rpc_close_material_review_acceptance(bigint, text)` — closure.

Their `public` wrappers are already authenticated-executable and delegate to these internal routines; the internal routines are not directly executable by `authenticated`. Adding the gate inside the internal routines protects both overloads through any wrapper and prevents future callers from bypassing a check located only in a public wrapper.

**Why CCC edit?** Existing [WP05 A4 permission inventory](WP05_A4_RPC_AND_PERMISSION_INDEX_2026-11-02.md) records CCC-edit as the cross-module workbench acceptance/closure permission. This is parity-preserving. **Owner decision D3 remains separate:** whether MCM-edit should ALSO be required is not settled by this package.

**No unrelated change:** do not change material rate calculations, review queue filtering, severity rejection, source-context trigger, historical records, RLS, function owners, `search_path`, EXECUTE grants, approval-preview semantics, feature flags or frontend controls. `costing.rpc_accept_internal_source_material_review_action` already has a CCC-edit check and is outside the target three.

## 3. Live evidence and immutable fingerprints

Read-only PostgreSQL catalogue inspection on 4 Nov found these `prosrc` hashes:

| Function / overload | Before MD5 | Predicted after MD5 |
|---|---|---|
| Material-review acceptance — 10 arguments | `23d406a822ceb748f1ee272a48c2c589` | `50712d2cbbf09b1be0764966d604f092` |
| Material-review acceptance — 7 arguments | `c2801c07767c615a1e46ca94b408cb0c` | `326211fd5e811bdab52aa6ce421d56b7` |
| Review-acceptance closure — 2 arguments | `a6b13f1c7b6a2b2ca04cb295f54ee03d` | `32077cdd5599de73d7d8867211820f24` |

The three `SECURITY DEFINER` functions have `search_path=costing, public`, are VOLATILE, and have exactly one PL/pgSQL top-level `begin`. The MD5 is a **drift fingerprint, not a cryptographic authenticity certificate**. Any drift from the captured live bodies must **STOP** application; do not regenerate or force the SQL without comparing and approving the new live definitions.

The acceptance register has no direct authenticated INSERT/UPDATE table grants and RLS is disabled. Its trigger `costing.fn_apply_material_acceptance_source_context()` validates the evidence/source tuple but does **not** perform the missing CCC-edit check. The public `SECURITY DEFINER` wrappers currently permit `authenticated` EXECUTE; therefore API role-level denial must be governed inside the called function. The finding is based on static catalogue/source inspection; **no unsafe RPC was invoked**.

## 4. Prepared SQL (under docs/, NOT under supabase/migrations/)

- [Exact guarded APPLY SQL](prepared/SEC_A1_MATERIAL_REVIEW_EDIT_GATE_APPLY_20261104.sql).
- [Exact guarded ROLLBACK SQL](prepared/SEC_A1_MATERIAL_REVIEW_EDIT_GATE_ROLLBACK_20261104.sql).

Both scripts use a single transaction and source-hash preflight for all three routines, then `CREATE OR REPLACE FUNCTION` with original full live DDL and transaction-end source-hash postcheck.

**Verified preparation invariant:** each after-definition differs from its rollback definition by **one and only one added `perform public.require_permission('module:costing-control-center', true);` statement** immediately after top-level `begin`. All three function DDLs were compared in this draft; no return signatures/defaults/security properties or existing source sections were intentionally altered. SQL is **not tested on a staging database** and should not be called deployment-ready until it is.

The rollback restores the exact prior definitions, but would **reopen SEC-A1**. Use it only with explicit approval and if all three live hashes still equal the expected patched versions; otherwise stop and re-plan. For an ordinary failed APPLY, PostgreSQL transaction rollback should leave the previous definitions untouched.

## 5. Execution and validation gates (none performed yet)

1. **Independent SQL review:** verify exact source hashes and all three signatures, object dependencies/grants, dollar-quoted DDL syntax, and that the only body diff is one early edit-check per function.
2. **Isolated test environment:** use a disposable Supabase development branch/project or otherwise approved fully isolated test database. Check cost before creating it. Apply a representative schema baseline and synthetic fixture data; do **not** copy private production records just to test roles.
3. **Negative role tests:** authenticated with CCC-view true / CCC-edit false must receive permission-denied errors on both acceptance overloads and closure. Confirm no insert, update or audit drift after denial. Without `auth.uid()` must also fail.
4. **Positive role tests:** a synthetic account with CCC edit true must reach existing underlying validation/acceptance branches (and succeed only on legitimate synthetic REVIEW_REQUIRED rows), with expected acceptance and closure provenance; hard blockers remain unacceptably blocked. Verify business-logic parity with the original definitions.
5. **D3 matrix:** MCM-edit alone does not authorise acceptance under the parity-preserving CCC policy; CCC-edit without MCM-edit does, subject to real workflow validation. If the owner later decides D3 differently, propose a separate reviewed policy change.
6. **Object/permission preservation:** verify public wrapper signatures, authenticated EXECUTE grants, internal direct EXECUTE denial, security definer flags, `search_path`, trigger behaviour and null/foreign period safeguards. Confirm no creation of new API routes.
7. **Regression gate:** run existing material-review acceptance and Costing suite tests. Report LF/CRLF, zero skipped Chromium and exact head/test provenance; do not infer SQL tests from browser mocks.
8. **Owner approval:** present test evidence and an explicit approve/defer decision for a governed Supabase `apply_migration` operation. Owner approval must be for the **live server change**, not just the GitHub documentation PR.
9. **Live apply (not authorised yet):** only via the approved Supabase migration pathway, full preflight with recorded current hashes, one transaction, one immutable migration/version record, immediate permission and preserved-data verification; do not use indiscriminate `db push` or manually rewrite migration history.
10. **Post-apply:** update this plan and [programme ledger](PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md) with migration ID, exact applied source hashes, negative/positive safety evidence, monitoring and rollback outcome. Only then unblock preparation of the six-module view-only account. SEC-A2 remains excluded from live test.

## 6. Stop conditions and rollback

**STOP** if any source hash changes, an unknown extra overload exists, grants or owner changed, a live source check fails, an isolated read-only user can mutate, a real legitimate editor fails unexpectedly, any run/period evidence diverges, or a fixture cannot reproduce the essential contract. Do not work around a denial by using an administrator JWT against production.

**Emergency rollback** is reviewed separately and restores only the exact three captured function bodies after confirming the patched fingerprints. The original vulnerability would reappear, so alternatives (temporarily disabling acceptance actions) may be preferable in a live incident, subject to owner authorization. Do not use rollback to erase acceptance register history.

## 7. Next decision

**Approve technical design for isolated testing** or **revise D3** (add MCM edit). In either case, this document alone is **not** authorisation to apply to live Supabase. SEC-A2 remains a separate approval-preview entitlement/governance issue.

No e-Aushadhi WP07, Manage Activities, Tally, storage retention, PWA or Electron task is affected.
