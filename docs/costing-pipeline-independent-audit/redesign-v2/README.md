# Costing redesign v2 — approval records (27 Oct 2026)

This folder keeps the paper trail for the costing redesign changes applied to production on 27 Oct 2026: the approval request for each change, a plain summary, and the record written straight after each live apply (APPLIED_*). Start with [../COSTING_REDESIGN_V2_CURRENT_STATE.md](../COSTING_REDESIGN_V2_CURRENT_STATE.md).

## About the five migration files in `supabase/migrations/`
These five files are **record-only copies of changes that are already applied to production on 27 Oct 2026. Do not re-run them.** They have no header note because their text must stay exactly as applied. Each file's md5 equals the md5 of the statement that production stored when it was applied (checked read-only from `supabase_migrations.schema_migrations` on 27 Oct 2026).

| Change | File (live recorded version) | Applied (IST) | md5 (file = production record) |
|---|---|---|---|
| CI-040 v2.1 | `20261027033918_ci040v21_unified_approval_preview_ack.sql` | 27 Oct 09:09 | ab7fb50473d609be1b50546a85a7abd6 |
| CI-041 v2.1 | `20261027034040_ci041v21_scheduler_business_date_retries.sql` | 27 Oct 09:10 | 4408eaff66177f86fd62630d039e0f46 |
| CI-045 | `20261027064617_ci045_provenance_designated_run_guard.sql` | 27 Oct 12:16 | c2ece2eba2d5bd8fba807d0dd261b7c6 |
| CI-042 v2.2 | `20261027121655_ci042v22_lock_state_only_status_views.sql` | 27 Oct 17:46 | d94771dd1e06646a1db705a2dd90ef49 |
| CI-043 v2.2 rev B | `20261027153126_ci043v22_costing_health_check.sql` | 27 Oct 21:01 | cfae78680e4e1c2ddde0661eba8bfd24 |

Rollback and verify scripts are in `../closure/prepared/` (`CI-040v21_*`, `CI-041v21_*`, `CI-045_*`, `CI-042v22_*`, `CI-043v22_*`). Rollbacks are for emergencies only and need the owner's approval.

## Replay safety (checked 27 Oct 2026)
All five versions above are already recorded in production's migration history, so the Supabase CLI treats them as applied. There is no CI and no deploy script that pushes migrations. The repo and production histories already differ in both directions (18 / 73 versions) — a pre-existing gap; never run `supabase db push` against production. Details and the safe procedure: [../MIGRATION_HISTORY_RECONCILIATION.md](../MIGRATION_HISTORY_RECONCILIATION.md).

## Related
[../README_COSTING_SUITE.md](../README_COSTING_SUITE.md) · [../COSTING_OPERATIONS_RUNBOOK_CURRENT.md](../COSTING_OPERATIONS_RUNBOOK_CURRENT.md) · [../DECISION_LOG.md](../DECISION_LOG.md) · [../STATUS_AND_REMAINING_WORK.md](../STATUS_AND_REMAINING_WORK.md)
