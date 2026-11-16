> **SUBSEQUENT OWNER APPROVAL/EXECUTION:** Phase 1 files 01/02/03/06 are APPLIED, with eleven functions and intended ACLs verified. [Current register](WP10_SQL_PHASE1_APPLIED_AND_VERIFIED_2026-11-16.md) supersedes earlier pending/unapplied statements below for these four files only. Flag OFF; guards 04/05 remain UNAPPLIED, role/release acceptance open, 10/13.

# WP10 — Exact Phase 1 SQL application review

**PROPOSAL FOR OWNER APPROVAL; NOT EXECUTED.** Target: Supabase project `qhmoqtxpeasamtlxaoak`. Source: main after #442 merge `d20a8991200df5fbf9e99e1a16478d62c3e2245e`. WP10 OPEN, programme 10/13. The owner's latest instruction approves the source merge and asks that necessary SQL be handled at the appropriate time; it does not approve these production files/hashes or their new-function grants.

## Why SQL is required

The merged flag-gated Readiness explanation and activation pre-check reuse existing server functions. The new operational horizon and counterfactual impact preview need new server helpers/RPCs. The active re-parent and route-changing product guards need new server triggers. Source merging alone installs none of them.

| Proposal | Required capability | Operational effect when applied |
|---|---|---|
| 01, 02 | IST clock, dated batch-size/essential states and boundary enumeration | Private read-only helpers; no new caller grant or trigger |
| 03 | 30-day operational expiry horizon | New read-only RPC for authenticated callers with existing Manage Products View OR Costing Control Center View |
| 06 | Before/proposed-subgroup route preview | New read-only RPC for authenticated callers with existing Manage Products View |
| 04 | Reject unreviewed active SKU re-parenting | Blocking trigger for all writers, including privileged writers; independent of the browser flag |
| 05 | Reject newly lost/unresolved route impact on subgroup edits with active children | Blocking triggers inside the product writer transaction; independent of the browser flag |

**Recommendation: apply the additive read-only stage first (01 → 02 → 03 → 06), keep the client flag OFF, verify it, then seek separate exact authority for blocking guards 04/05.** No business rule, override or new permission target is introduced by staging. The reviewed manifest already permits subsets with prerequisites. Guards are not optional for completing their agreed enforcement objective; they are deferred to a later execution decision.

## Exact Phase 1 payload

Directory: `docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/`. These LF-normalised SHA-256 values match the generated manifest and merged source. Execute unchanged, in the order shown.

| Order | File | SHA-256 | Proposed migration name |
|---|---|---|---|
| 1 | `01_clock_and_batch_size_contract.sql` | `0077b90fffbf9bd9c770ab55b85e81e8110d1c6c0a8a17135ba71bee4620dab3` | `wp10_g2_01_clock_and_batch_size_contract` |
| 2 | `02_essential_states_and_boundaries.sql` | `ef4cd91f693c220a614db3f7640afb301126b47626cde93e792b393b27c74b31` | `wp10_g2_02_essential_states_and_boundaries` |
| 3 | `03_operational_expiry_horizon_rpc.sql` | `dea309c07d0ff6726b04d9ed4d56e190c6d2afda9628a06996df133e7dfb0ce5` | `wp10_g2_03_operational_expiry_horizon_rpc` |
| 4 | `06_subgroup_impact_preview.sql` | `abb291fe26bce9ac2618eca5325b4cb82392a262d895585e87b9746cc8f9217f` | `wp10_g2_06_subgroup_impact_preview` |

Expected Phase 1 result: **11 new functions** (9 private costing helpers, 2 public RPCs), **zero new triggers**, and no business-row, existing-function, existing-table-ACL, RLS, registry, flag or readiness-builder change. The two new RPCs receive EXECUTE for `authenticated`; their bodies also check identity and the existing View permission. `PUBLIC`, `anon` and `service_role` lose inherited/default EXECUTE on these two new RPCs; internal costing helpers have no ordinary caller EXECUTE. Existing users/roles/permission records are not edited.

Proposed operator: ChatGPT through the connected Supabase tools after approval. Use the DDL migration operation with the exact file text and names above, producing four new generated migration-history entries. Do not hardcode returned version ids or modify historical migrations. Capture returned ids and object receipts immediately. Register only matching new WP10 migration source copies and exact hash/branch-scoped server-lane records (`server/wp10-g2-read-only-phase1`); no generic SQL-path exemption, no PEC runtime change and no allowance for another branch/hash. This bounded history/source registration is part of the proposed operation, not permission to weaken a guard or touch the five CRLF-only files. Finalise and verify the source-registration path before the first production application.

The offline preparation implementation is `scripts/wp10-g2-safeguards/prepare-phase1-registration.mjs`. It accepts only the target project/lane, all four expected migration names and distinct generated versions; verifies every reviewed source hash; rejects existing source paths or a changed registry structure; and returns proposed text without writing files, changing a guard or calling a database. `phase1-registration.test.mjs` passed **7/7** locally. Tests execute the real current guard and a proposed copy in memory: current policy rejects the new paths, the proposed copy accepts only these four exact hashes on this one lane, and changed hashes/branches, missing context, unrelated SQL/SW and prior registry entries remain protected. Synthetic receipt versions in the test are never application ids. Actual installation still needs this document's owner decision. Retain the exact applied SQL as an immutable payload; record current applied status separately rather than rewriting those reviewed bytes.

## Readiness evidence and limits

- Merged source passed 286 isolated/mocked checks; exact #442 head `478c087c` passed `wp10-offline`, integrated-pec and relevant Netlify checks before merge. Final-head WP10 run: [43762543335](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43762543335). This is not production acceptance.
- [Catalog/source capture](WP10_G2_EVIDENCE/sql-application-readiness-catalog-2026-11-16.json): at `2026-11-16T01:19:17Z`, 9/9 fingerprinted dependencies match; no WP10 functions/triggers installed; live PostgreSQL 17.4. Applying roles must still pass fresh file preflights at execution time.
- The previously existence-only PM BOM resolver is now captured read-only: STABLE, SECURITY DEFINER, fixed `public,pg_temp` path, owner postgres, expected approved/superseded inclusive-window/ambiguity logic. Its restricted ACL need not be widened: the new definer helpers call as owner.
- Live `auth.uid`, `app_has_permission` and its core are captured. The wrapper checks UID; the core returns `coalesce(v_allowed,false)` from `user_permissions_canonical`. The canonical permission table has RLS enabled, admin-only insert/update/delete policies, and admin-or-self SELECT. This is source/catalog evidence, not a real-user permission test or a new approval of inherited access policy.
- Current public function defaults explicitly grant anon/authenticated/service_role EXECUTE; both new public RPCs explicitly revoke these defaults and grant back authenticated only. No global/costing default-function ACL was present in the capture. Verify the actual post-create ACLs; do not assume default privileges prove intended access.
- Relevant indexes exist and are marked valid in the captured catalog; planner row estimates are retained as estimates. Neither these indexes nor synthetic fixtures prove production-scale performance.
- Authenticated/authenticator timeout catalog says 8 seconds; anon says 3 seconds. Actual PostgREST session settings and performance remain unproven. The files' `SET LOCAL statement_timeout='30s'` applies during installation only. Do not increase any timeout or claim a persistent 30-second RPC limit.

Official background: [Supabase database functions](https://supabase.com/docs/guides/database/functions) and [Postgres roles](https://supabase.com/docs/guides/database/postgres/roles). The operational claims above rely on the captured project catalog, not generic defaults.

## Execution and read-only postchecks included in the proposed authority

1. Re-fetch main, compare all four exact hashes, confirm target and operator, inspect current migration history, and re-run absence/dependency/owner/default-ACL checks. Stop if anything conflicts, a reviewed function drifts, or history/source registration cannot be completed within the exact scope above. Never change a fingerprint to make a preflight pass.
2. Apply each reviewed file once. Each has its own transaction and lock/statement limits. On an error or uncertain tool response, stop and inspect catalog/history read-only before doing anything further; no blind retry and no automatic guard application.
3. Record generated migration versions, installation outcomes, the 11 function definitions/receipts/owners/ACLs and the absence of all WP10 triggers. Prove only the two intended RPC grants exist for authenticated; anon/service_role cannot execute them and ordinary callers cannot execute the internal helpers. Preserve all existing table/function privileges.
4. Compile/read-test installed private helpers under a read-only transaction as the installer, with bounded synthetic argument/error controls and a small bounded real-data sample (at most 10 SKUs/products). Return only aggregate states/timings and route identifiers needed for diagnosis, not personal data. No auth-claim spoofing and no production writer, activation, deactivation, preview-as-write, builder or scheduler. An SQL-editor run is **not real-role acceptance**. Measure actual server execution separately from network/client time; record timeout/error as such and stop rather than raising limits or adding retries.
5. Keep `WP10_SAFEGUARDS_V1` OFF. Actual JWT role calls, installed-client behaviour and any browser-local flag trial require their own bounded acceptance authority. Report absent evidence as NOT TESTED. Do not mark WP10 complete.

## Rollback and deferred work

No rollback is executed as part of this approval request. If an application is partial or a postcheck fails, stop and present the exact installed subset and rollback proposal. The reviewed `99_rollback_all.sql` supports subsets and checks definition receipts before dropping anything; its hash is `a1bc2af2642f1c6e2e1ee9ca0047388648bc5940de5cc5ae1e50f159c6f00522`. Before any separately approved rollback, also compare installed owners/ACLs to the post-apply receipt capture: definition receipts alone do not detect every ownership/ACL change. Never drop a modified or foreign object, use CASCADE, or retry by overwriting it.

Proposals 04/05 are deferred. Their future approval must explicitly acknowledge immediate writer enforcement regardless of the client flag and include their own exact hashes, dependency/lock/audit checks, safe rollback and appropriate acceptance. No live writer rehearsal or rollback-based business dry-run is authorised here. All WP11 defects, WP12 real-role/security/PWA/hosted/Electron/Windows obligations, G1 bounds and known baseline failures remain. Programme 10/13 until a separate formal closure decision.

## Exact requested decision

Approve **only Phase 1**, target `qhmoqtxpeasamtlxaoak`, files/hashes and migration names in the table, creation of the 11 functions, the two new-RPC EXECUTE grants, four migration-history/source registrations and the bounded read-only postchecks above, with ChatGPT as operator. Keep 04/05, business writers/builders, all client flags, deployment, access-record/RLS changes and formal closure outside this authority. No SQL has been applied by preparing this request.
