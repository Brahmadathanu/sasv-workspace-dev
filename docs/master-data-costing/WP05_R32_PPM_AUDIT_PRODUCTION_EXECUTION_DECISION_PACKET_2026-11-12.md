> **R33 UPDATED CURRENT-MAIN REVIEW — 12 NOV 2026:** [R33 candidate reconciliation](WP05_R33_OPTION_A_CURRENT_MAIN_CANDIDATE_ALIGNMENT_2026-11-12.md): previous diverged **draft #311 closed unmerged** and superseded by **draft #315**, created at main `013e2bac...` with all six old candidate files unchanged, now 0 behind; exact-head isolated PG17 **10/10 PASS**, offline structural PASS ([CI 43172483197](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43172483197)). **No production execution authorisation or application**, no effective signed-in role proof, W5-06 OPEN and 6/13.

# WP05 R32 — Option A Scheme audit production-execution decision packet (12 November 2026)

**STATUS: PRE-FLIGHT REVIEW ONLY — PRODUCTION EXECUTION NOT AUTHORISED.** The owner approved the *business policy* Option A (R28); no explicit second approval for application of SQL to live Supabase has been received. This packet adds no permission, does not run any migration, and does not promote W5-06. Formal WP05 remains **6/13**.

## Scope of a possible future production change

- Target only `public.v_costing_scheme_master_audit` on project `qhmoqtxpeasamtlxaoak`.
- Use reviewed **draft** [PR #311](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/311), SQL file `docs/master-data-costing/candidates/WP05_R28_PPM_AUDIT_OPTION_A_REPLACE_VIEW_REVIEW_ONLY.sql` (after reconciling the branch with current `main` and revalidating exact head).
- Change exactly the view's outer permission condition to the approved `module:pricing-policy-manager` View check. Do **not** change other 5 views, `fn_costing_view_allowed`, underlying audit table grants, role membership, PWA, feature flags or staff data.
- Preserve the existing owner `postgres`, the view's 20 columns/column types and description, and the SQL ACL `{postgres=arwdDxtm/postgres,authenticated=r/postgres}`. SQL `service_role` SELECT remains **DENIED**, notwithstanding its appearance in the predicate's privileged technical branch.
- Review-only guarded rollback is in the same draft PR. Its candidate starting-state `pg_get_viewdef` fingerprint is `e2b9eb3c1b86d073183cd376f704cf58`, established in the isolated PG17 fixture; its expected restored original fingerprint is `001024540bdeab9f2e5aa4ec2a6f6c53`.

## Fresh live read-only preflight completed 12 November 2026

Production catalogue only, **no sensitive row read and no role impersonation**:

| Check | Production observation | Gate |
|---|---|---|
| `md5(pg_get_viewdef(public.v_costing_scheme_master_audit,true))` | `001024540bdeab9f2e5aa4ec2a6f6c53` | MATCH |
| `pg_get_userbyid(relowner)` | `postgres` | MATCH |
| `relacl` | `{postgres=arwdDxtm/postgres,authenticated=r/postgres}` | MATCH |
| `reloptions` | NULL (owner-rights/default) | MATCH |
| Description | "Controlled read-only Scheme Master lifecycle history. Underlying audit table remains protected." | MATCH |
| View output columns | 20 | MATCH |
| `authenticated`, `anon`, `service_role` SELECT | true, false, false | MATCH |
| `permission_targets.key='module:pricing-policy-manager'` | kind=module, is_assignable=true | MATCH |
| `app_modules.module_key='pricing-policy-manager'` | target matches, active=true, assignable=true | MATCH |
| `public.app_has_permission` md5(prosrc) | `12727b365c1728d3830eeab039b6e344` | MATCH R23 |
| `public.app_has_permission_core` md5(prosrc) | `b75d5b4ee5cc6c464149c5743e165b95` | MATCH R23 |
| `public.fn_costing_view_allowed` md5(prosrc) | `b7efb09b90fa3e9332915ba5d223568c` | MATCH R23 |

**Warning:** this is a point-in-time catalogue preflight, **not** a guarantee against later drift. Re-run immediately before separately authorised execution.

## Test and review state

- R31 corrected earlier over-broad service-role synthetic ACL; draft #311 currently tests production-parity SQL privilege denial instead.
- Last exact candidate head in R31: isolated GitHub PostgreSQL **17.11** with real SQL execution of candidate and rollback, positive PPM/mixed, negative CCC/CBM/CSR/MCM-only, PPM Edit-only and no UID, plus unexpected SQL ACL/definition drift: **10/10 PASS**; offline SQL/source contract PASS, [workflow 43164967909](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43164967909).
- At this R32 review PR #311 is **diverged** from current `main`: its feature branch is 17 commits ahead and 2 behind because R30/R31 documentation merged separately. No SQL conflict is demonstrated, but **reconcile/rebase or equivalent clean new review head, then rerun exact-head checks before requesting production execution**. Do not merge review-only SQL as an applied migration by accident.
- Successful isolated tests and prior source review do **not** constitute successful authenticated production-user access acceptance. Such behaviour remains **NOT TESTED**.

## Deployment go/no-go sequence — conditional on explicit separate owner approval

1. Resolve PR #311's branch divergence and confirm the exact proposed SQL/rollback and same isolated PG17 checks on final reviewed head.
2. Schedule a controlled production change with an authorised operator and a clear rollback decision owner. Obtain a **separate, explicit production-execution authorisation** identifying PR #311 and `public.v_costing_scheme_master_audit`. This R32 note does not provide it.
3. Immediately before applying: read-only recheck original view MD5, 20 *names/types* (not only count), owner, ACL including service_role denial, description, permission-function hashes and PPM target. STOP if any condition changes; update/review SQL rather than bypassing guards.
4. If separately approved, execute only the reviewed one-view guarded SQL as one transaction. No privilege or direct audit-table grant. Abort and leave original view if any precondition or postcondition fails.
5. Immediately afterwards, inspect only metadata to confirm new MD5, original owner/ACL/comment/20-column types, PPM predicate and no four-module shared helper. Verify no change to other five views or global helper.
6. Propose a separate tightly scoped authenticated acceptance protocol with existing authorised PPM View and existing negative-only module accounts, returning **status/count or existence only**, no audit actor/scheme/remark rows or export. Do **not** provision roles, impersonate users or fetch sensitive rows without approval.
7. If the update is faulty or causes unexpected screens to fail, use guarded rollback only with operational authority after confirming the target is the exact tested candidate definition. Record revert evidence and all residual limitations.

**Never infer the actual role predicate's success from an HTTP 200 alone; explicitly assess whether the view returns the expected permitted/denied count with synthetic or separately approved existing identities.** A denied request may still produce an empty array, as the view uses a row-level WHERE predicate.

## Owner authority and remaining gates

**Approved:** Option A access policy, bounded metadata and isolated fixture verification. **Not approved:** deployment, production view-row SELECT, real-role impersonation/account modifications, writer-denial execution, other five D-2 viewer-policy changes. W5-06 remains OPEN, W5-04/W5-10 retain their documented statuses, D-1 behavioural writer denial NOT TESTED, four-second Cost Comparison p95 HOLD, WP05 **6/13**.

The next decision is not whether Option A is conceptually sound—it is whether to permit a **single named production change after current-head reconciliation**. No SQL has been applied as part of preparing this packet.
