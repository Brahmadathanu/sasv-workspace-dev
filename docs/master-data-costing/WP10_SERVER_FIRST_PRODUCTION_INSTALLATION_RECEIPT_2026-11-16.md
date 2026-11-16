# WP10 — Server-first production installation receipt (2026-11-16)

## Outcome
**PASS — bounded production installation completed.** Owner explicitly approved the assistant to install exactly the two independently reviewed classification RPC SQL packages on Supabase project `qhmoqtxpeasamtlxaoak`. No classification table REVOKE, RLS-policy changes, CL15 or route-impact guard installation, client deployment, feature flags, or PR merge was performed.

## Source artifact integrity
Source is immutable commit `6c8f839d4d7e449b47bf6a34af3391dc67c3093f` on PR #444, independently reviewed B1–B4 PASS. The two installed SQL file hashes were **recalculated from the exact GitHub file bytes** using PostgreSQL SHA-256 on UTF-8 strings and matched the independently reviewed receipt.

| Installed file under `scripts/wp10-g2-safeguards/` | SHA-256 |
|---|---|
| `review-only-parent-classification-governed-rpcs.sql` | `7463fb0d8bb54fc4eb30629715aa0052661de50dfd5c1d663a0abf66c35ae51f` |
| `review-only-subgroup-governed-rpcs.sql` | `1d0f1267f9dcea5dcfb99f39bad32d8e2af16fceb49d0c3aee8f5cc8a5f814cf` |

Also checked pinned rollback hashes (NOT EXECUTED): parent `d946bb15b21f373eb0da3da3904a6570bad1dfafb70ef7443a1f603a9f0342bd`, subgroup `abf7e2830f4fe32a4b0579cda66a35ce23af0e43bfc8144d20853a2d0b273a98`.

## Prerequisites and execution
- Supabase project metadata: `sasv-workspace`, `qhmoqtxpeasamtlxaoak`, region `ap-south-1`, Postgres 17.4, ACTIVE_HEALTHY.
- Immediately before execution the exact reviewed preflight returned **PASS / 10 checks / 0 failed / 12 RPCs absent / 0 present**, including Editor targets, FK dependency safety, column integrity and legacy table grants.
- Parent SQL executed as one migration via the connected Supabase DDL tool: **success=true**; validated nine parent functions present before the second application.
- Subgroup SQL executed as a separate migration via the connected Supabase DDL tool: **success=true**.
- Supabase migration history confirms both records, in order:
  - `20261116143254` — `wp10_server_first_parent_classification_rpcs_20261116`
  - `20261116143310` — `wp10_server_first_subgroup_classification_rpcs_20261116`
- These are **connector migration applications**, not manual SQL Editor executions. This execution channel was chosen because the owner authorized the connected assistant to perform the same bounded approved change.

## Verified postflight (production SELECT-only)
The exact SQL from `WP10_MANUAL_DASHBOARD_INSTALL_POSTFLIGHT_WORKSHEET_2026-11-16.md` returned:
```json
{"postflight":"PASS","rpc_catalog_passed":12,"rpc_catalog_expected":12,"table_grants_unchanged":4,"tables_expected":4,"failing_rpc_signatures":[],"failing_tables":[]}
```
These checks assert SECURITY DEFINER, intended fixed search_path and authenticated-only EXECUTE, absence of anonymous/PUBLIC execution, and preservation of existing four-table authenticated SELECT/INSERT/UPDATE/DELETE permissions.

| Classification table | Before | After | All four authenticated S/I/U/D grants |
|---|---:|---:|---|
| `public.categories` | 5 | 5 | unchanged: true |
| `public.sub_categories` | 24 | 24 | unchanged: true |
| `public.product_groups` | 100 | 100 | unchanged: true |
| `public.sub_groups` | 146 | 146 | unchanged: true |

No application CRUD smoke calls against business master rows were made. The row-count comparison is a bounded invariant, not a cryptographic fingerprint of every row.

## Remaining programme gates
- **Client rollout not performed**: the four master screens are still draft PR code. Existing direct-DML clients continue to work because grants are retained.
- Live Editor/View-only/No-access acceptance across all four screens: **NOT TESTED in production**.
- Authenticated direct DML REVOKE: **NOT PERFORMED**; requires installed Electron cutover and separate approval.
- Proposal 04/05, CL15 parent-lock correction and Route Manager mapping concurrency residual: **NOT PERFORMED**, separately governed.
- PR #444 is still OPEN / UNMERGED; WP10 formal closure is **OPEN**.
- If a later client is rolled out to call these 12 RPCs, never drop the functions without a separately approved client rollback/cutover plan.

This receipt records observed actions and database outputs; it does not claim end-to-end WP10 completion.
