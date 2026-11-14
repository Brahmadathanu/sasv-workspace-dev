# WP05 R43 — CCC + MCM Acceptance Register production policy execution (12 November 2026)

**PRODUCTION EXECUTED; CATALOGUE VERIFICATION PASS.** Owner first approved Q-R38-CCC business policy: both CCC View and MCM View may read all existing Material Review Acceptance Register fields, including actor email, acceptance reason and notes, but without receiving Edit or Close rights. After being told the separately tested draft PR #332 required production approval, the owner replied "Proceed." This was treated as approval to apply **only that exact one-view correction**, subject to fresh preflight. Q-R38-CSR remains pending.

## Execution source and safeguards

- Production target: SASV Supabase project `qhmoqtxpeasamtlxaoak`, `public.v_costing_material_review_acceptance_register` only.
- Exact source: unmerged reviewed **draft [PR #332](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/332)**, `docs/master-data-costing/candidates/WP05_R42_CCC_MCM_ACCEPTANCE_APPLY_REVIEW_ONLY.sql` Git blob **`509ae2d92c55b3fe3fc5955da73f36f4e2fea5cb`**.
- Before applying: confirmed PR #332 branch 0 commits behind main, original live view definition MD5 `df6c6771423c2aecb0130822a804a239`, 38 exact column names and data types, postgres owner, no reloptions, original ACL `{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}`, authenticated SELECT true, anon SELECT false, service_role SELECT true. Both CCC/MCM module targets exist and are active/assignable. All three shared permission function fingerprints and five other selected view definitions matched previously retained baselines.
- Ran **the unchanged exact SQL blob once**, a guarded `BEGIN … COMMIT` with 3-second lock timeout/45-second statement timeout. It checks the starting definition/ACL/options/columns and replaces the full 38-column view with the same underlying source but a narrowed predicate: `app_has_permission('module:costing-control-center','view') OR app_has_permission('module:material-cost-manager','view')` for ordinary authenticated readers, retaining existing privileged support branch. Postcondition checks prohibit unrelated source or ACL changes.
- This was executed directly via Supabase `execute_sql`, **not recorded in Supabase migration history**. Future deployments must account for the already-installed view, and must not silently replay this SQL.
- Tested rollback source is retained in draft #332: `WP05_R42_CCC_MCM_ACCEPTANCE_ROLLBACK_REVIEW_ONLY.sql`. It expects candidate hash `0dcc3db262a30a9b770720dcb48e6376` and restores original hash `df6c6771423c2aecb0130822a804a239`. **Rollback was NOT executed**. Any future rollback needs fresh catalogue validation and separate incident/owner authority.

## Independent live post-deployment metadata

| Property | Before | After |
|---|---|---|
| `md5(pg_get_viewdef(...,true))` | `df6c6771423c2aecb0130822a804a239` | **`0dcc3db262a30a9b770720dcb48e6376`** (exact PG17 tested candidate) |
| Output field count and types | 38; actor UUID, email varchar(255), note/reason text | **38, unchanged**; exact candidate definition |
| Owner | `postgres` | `postgres` |
| `relacl` | `{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}` | **Identical** |
| `reloptions` | NULL | NULL |
| `authenticated` SQL SELECT | true | true |
| `anon` SQL SELECT | false | false |
| `service_role` SQL SELECT | true | true |
| Effective ordinary-reader outer gate | shared CCC/CBM/CSR/MCM View helper | **CCC View OR MCM View** |

Other relevant views' MD5s **unchanged after execution**:

- MCM History: `01029a39e47a300aa7860d17b2f39cae`.
- MCM Register: `38b4262bfae719ca3f736185784fd047`.
- Scheme audit: `e2b9eb3c1b86d073183cd376f704cf58`.
- CSR detail: `85585c98e6f184fb9a4eb3351b008c2e`.
- CSR line traceability: `b67b4ee28e0eb19804c073cb83e14e11`.

Shared permission functions' `md5(prosrc)` **unchanged**:
`app_has_permission` `12727b365c1728d3830eeab039b6e344`;
`app_has_permission_core` `b75d5b4ee5cc6c464149c5743e165b95`;
`fn_costing_view_allowed` `b7efb09b90fa3e9332915ba5d223568c`.

## Test evidence and boundaries

Draft #332 exact-head [GitHub Actions 43193963075](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43193963075): **isolated PostgreSQL 17 8/8 PASS**, using the original 38-column definition, fake fixture users and synthetic acceptance data. CCC View, MCM View and mixed roles positive; CBM/CSR/PPM View only, MCM Edit-only and no permission negative. No Edit/Close privileges granted, original ACL retained, guarded rollback accepted exact tested candidate and refused drift.

**LIVE EXECUTION + METADATA: PASS. Real authenticated production staff role tests: NOT TESTED.** Database-function SQL and artificial PostgreSQL users do not establish normal PWA signed-in behaviour; the view WHERE predicate can yield empty arrays under denial, making a zero-row screen ambiguous. No actual material acceptance history rows, personnel identifiers, JWT tokens, account permissions, Close/writer RPCs, web client builds, PWA cache flags or other views were changed or fetched as part of this execution. No security breach or blanket D-2 PASS is claimed.

## Programme state

- Q-R38-CCC: policy **APPROVED**, one-view production correction **APPLIED**, catalogue postchecks **PASS**.
- R34 Scheme audit and R40 MCM two-view corrections remain live and intact.
- **Q-R38-CSR** detailed Cost Sheet and line-traceability reader policy **PENDING OWNER DECISION**. No action has been taken on those two views.
- CCC/MCM positive and CBM/CSR-only negative browser role tests **NOT TESTED**.
- W5-06 **OPEN**; formal WP05 **6/13**. D-1 writer behavioural test and D-4 p95 4-second HOLD retain their previous dispositions.

This record is documentation of already-authorised execution, **not approval for any further database change or later replay of the SQL**.
