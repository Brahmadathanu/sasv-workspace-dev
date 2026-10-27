# WP-07 migration record (e-Aushadhi, live changes since 24 Oct 2026)

Project `qhmoqtxpeasamtlxaoak`. Checked on 27 Oct 2026 (IST) by a read-only query of `supabase_migrations.schema_migrations`: for each row below, the md5 of the recorded statements equals the md5 of the repo file. Costing changes applied in the same period (CI-0xx and inventory alias migrations) are owned by the costing workstream and are not listed.

## Applied changes

| Live version | Name | Repo file (this branch) | md5 | Drafted as | What it does | Rollback | Verify result |
|---|---|---|---|---|---|---|---|
| 20261024115131 | wp07_ux1_roles_worklist | `20261024115131_wp07_ux1_roles_worklist.sql` | 228072363ffa20a127a4fa98a4f7e22e | same | Role grants (VERIFIER, APPROVER), my-roles, grant/revoke RPC (no self-grant), read-only worklist RPC | No separate file; additive objects | Applied 24 Oct; 4 active grants today |
| 20261025163252 | wp07_ux1_2_worklist_classification | `20261025163252_wp07_ux1_2_worklist_classification.sql` | 4f4c603b52c5d9a38805b61315041005 | `20261025160000_...` | Worklist returns Category, Sub-category, Group, Sub-group and source_sheet | No separate file; previous worklist md5 5ccaaaad7e23421c32c8ab2b789fbd6e recorded | 931 rows, 0 without a group, queues unchanged |
| 20261025173239 | wp07_ux1_four_eyes | `20261025173239_wp07_ux1_four_eyes.sql` | cd786d62c36513ca4c9309fd6bf768ac | `20261025200000_...` | 3 guard functions, 6 triggers: approver must differ from the saver | DOWN block at the end of the file | 3 functions, 6 triggers enabled, RPC md5s unchanged |
| 20261026133841 | wp07_ux2_stage_review_state | `20261026133841_wp07_ux2_stage_review_state.sql` | 361ee6963cba25b69f1dd11106f33f03 | same | Read-only `rpc_eaushadhi_stage_review_state_v1` with block codes | DOWN line in draft `UX2_STAGE_REVIEW_STATE_RPC.sql` (drop function) | Product 262: 7 rows VERIFIED; no uid: 0 rows |
| 20261027135522 | wp07_ux3_bulk_seed_review_rows | `20261027135522_wp07_ux3_bulk_seed_review_rows.sql` | a095c80b22075c04e8bc911811bf98c3 | `20261027190000_...` | Seeds 358 workflow, 358 details, 358 classification and 4,608 line review rows; saver empty | `UX3_BULK_SEED_ROLLBACK.sql` (b4296f15e3e9a547c0e67a98e869ddfb), not run | 20 of 20 checks true; totals 491 / 491 / 491 / 6,895 |
| 20261027161124 | wp07_ux4_saved_for_review_by | `20261027161124_wp07_ux4_saved_for_review_by.sql` | 1dddec312b74d873142457402d3f7080 | `20261027210000_...` | `saved_for_review_by/_at` on 5 tables, saver triggers, `FOUR_EYES_CHANGED_ON_APPROVE`, 10-row backfill | `UX4_ROLLBACK.sql` (2e49f0ba2528a2dfe0f0545d8fd3b908), not run | V1 to V18 true; 10 savers backfilled; seeded rows with a saver: 0 |

Live counts re-read on 27 Oct 2026 (read-only): workflow 491, details review 491, classification review 491, line review 6,895, active role grants 4.

## Version and file name mismatches

- Four files were drafted under a planned timestamp, but `apply_migration` recorded the apply time. On this branch the repo copies are named with the **live version**, so the Supabase CLI sees them as already applied and never re-runs them. This matters most for the bulk seed, which must not run twice.
- The drafted names (`20261025160000`, `20261025200000`, `20261027190000`, `20261027210000`) appear in the APPLIED_* records in the agent workspace. They refer to the same bytes as the live-version files above.
- Rollback and trial scripts are kept in the agent workspace (`/workspace/eaushadhi-c1/ux1/`), not in the repo.

## Open item

- 14 older repo migration files have versions that differ from live (flagged by the costing agent). Not fixed here. It needs a separate, read-only comparison and a rename plan agreed with the costing agent before any `supabase db push`.
