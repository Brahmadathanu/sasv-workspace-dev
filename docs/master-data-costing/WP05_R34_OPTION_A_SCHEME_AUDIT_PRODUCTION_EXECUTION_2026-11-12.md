# WP05 R34 — Approved Option A Scheme Master audit policy APPLIED to production (12 November 2026)

**PRODUCTION EXECUTION RECORD — one-view-only change.** This document supersedes any prior claim that the R28 Option A candidate remains wholly unapplied. The owner first **approved the Option A business policy** and then, when asked whether to authorise the specific tested PR #315 one-view correction for **production execution**, explicitly replied **“Yes go head”**. The execution performed solely that approved one-view `CREATE OR REPLACE VIEW` transaction on SASV project `qhmoqtxpeasamtlxaoak`. No other server permissions, user identities, other views, app code, flags or production data rows were changed or accessed.

## Exact source and operation

- Reviewed SQL source: [PR #315](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/315), review-only file `docs/master-data-costing/candidates/WP05_R28_PPM_AUDIT_OPTION_A_REPLACE_VIEW_REVIEW_ONLY.sql`, exact Git blob `2f40df316f113bdb7359d2f087a00ae2f891274d`. The former draft #311 was superseded unmerged.
- Tool action: Supabase **execute_sql**, **single original guarded `BEGIN … COMMIT` script**, not `apply_migration` and not an unguarded view update. The script checked prior view definition MD5, 20 columns, original owner, and authenticated/anon/service_role SQL SELECT boundaries before replacing the view; immediately checked PPM View predicate, absent shared `fn_costing_view_allowed` reference, unchanged column count and denied service_role SQL SELECT.
- Target: `public.v_costing_scheme_master_audit` only, preserving the exact existing 20 fields, `costing.scheme_master_audit` source and existing view object. The ordinary authenticated reader predicate changed from the old four Costing View modules to `app_has_permission('module:pricing-policy-manager','view')`. An existing `current_user` postgres/service_role technical branch remains in the predicate but **service_role lacks SQL view SELECT**, so it remains denied at the ACL layer. No privileges were granted.
- SQL tool execution response returned success (no rows returned), followed by an independent read-only catalogue postcheck confirming the **exact tested candidate view definition fingerprint** below.

## Before/after production verification

| Invariant | Before | After |
|---|---|---|
| `md5(pg_get_viewdef('public.v_costing_scheme_master_audit'::regclass,true))` | `001024540bdeab9f2e5aa4ec2a6f6c53` | **`e2b9eb3c1b86d073183cd376f704cf58`**, exactly isolated PG17 candidate |
| View owner | `postgres` | `postgres` |
| View columns | 20 exact names/types | 20, unchanged |
| `relacl` | `{postgres=arwdDxtm/postgres,authenticated=r/postgres}` | Same |
| `authenticated` SELECT | true | true |
| `anon` SELECT | false | false |
| `service_role` SELECT | false | false |
| `reloptions` | NULL | NULL |
| View description | "Controlled read-only Scheme Master lifecycle history. Underlying audit table remains protected." | Same |
| Source table | `costing.scheme_master_audit` | Same |
| View's ordinary-user module permission | Four-module CCC/CBM/CSR/MCM View OR | **PPM View** |

Five *other* owner-selected D-2 view definitions re-checked **unchanged**, post execution:

| View | Original and post-change MD5 |
|---|---|
| `v_costing_material_manual_rate_history` | `e827e401cc2bb8ccadf782ee5b98add4` |
| `v_costing_material_manual_rate_register` | `8a4c73fd3f4562679af3ed0638fa87e4` |
| `v_costing_material_review_acceptance_register` | `df6c6771423c2aecb0130822a804a239` |
| `v_costing_pricing_cost_sheet_line_traceability` | `b67b4ee28e0eb19804c073cb83e14e11` |
| `v_costing_pricing_sku_detailed_cost_sheet` | `85585c98e6f184fb9a4eb3351b008c2e` |

Three shared permission functions' `md5(prosrc)` unchanged:

- `app_has_permission`: `12727b365c1728d3830eeab039b6e344`.
- `app_has_permission_core`: `b75d5b4ee5cc6c464149c5743e165b95`.
- `fn_costing_view_allowed`: `b7efb09b90fa3e9332915ba5d223568c`.

## Technical evidence and residual acceptance

- Before execution, PR #315 clean review branch was **0 commits behind main**; same six candidate source blobs as original PR #311; its isolated PostgreSQL **17.11 10/10 PASS** and offline structural contract PASS on exact-head [GitHub Actions run 43172959125](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43172959125).
- **PRODUCTION DDL + metadata acceptance: PASS** for this precise one-view update. No live Scheme Master audit **row** data was read, and no real authenticated user's effective view behaviour was tested. The fact that view SQL and isolated positive/negative tests match the approved policy does **not** equal a real signed-in PPM View-positive and CCC/CBM/CSR/MCM-only-negative acceptance; **that remains NOT TESTED**.
- **No production permission/identity manipulation** (no role grants, account provisioning, JWT impersonation, service-role elevation or writer RPC). No PWA flag/cache update, Electron release or merge of draft #315 as a deployment. The previous shared-client #303 actor UI source fix remains independent.
- The reviewed guarded rollback source remains in draft [#315](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/315), `WP05_R28_PPM_AUDIT_OPTION_A_ROLLBACK_REVIEW_ONLY.sql`; expected starting MD5 `e2b9eb3c1b86d073183cd376f704cf58`, restoring `001024540bdeab9f2e5aa4ec2a6f6c53`. **Rollback NOT executed.** Any future operational rollback requires owner/incident approval and a fresh current-state check; do not invoke it simply to test.

## Source-control and migration history distinction

The SQL was executed directly in Supabase under explicit user approval and **not registered through a Supabase `apply_migration` history entry**. The SQL is fully retained in the reviewed PR #315 and this signed execution record; it must not be silently re-applied through a newly merged migration with conflicting semantics. Before any future schema reconciliation or release migration packaging, explicitly account for this **already-applied production view definition** and compare expected fingerprint, avoiding replay or drift.

## Programme gate ledger

**Q-R27-PPM-AUDIT:** owner policy **APPROVED**, candidate **applied**, metadata invariants **PASS**. **Signed-in role behaviour NOT TESTED**, so D-2/W5-06 remains **OPEN** and the other five reader policies remain unapproved/not verified. W5-04 and W5-10 remain at retained states; D-1 writer-denial behaviour accepted as NOT TESTED with governed follow-up; D-4 Cost Comparison four-second p95 HOLD. Frozen AE1 baseline unchanged; formal WP05 **6/13**.

Next bounded step is a separately scoped positive/negative **existing-user, read-only, count/status-only** acceptance (if authorised), without materialising actor/remarks/history records. No staff identity or user-permission edits should be used solely to manufacture test accounts.
