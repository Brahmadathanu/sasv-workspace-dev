# LB1 and DVS-1 (switched OFF): live apply, 19 Oct 2026 (USER-APPROVAL-20261019-LB1-DVS1-OFF)

The user approved this at 19:48 IST and Jarvis was notified. Both prepared files were applied unchanged with `apply_migration`:

| Migration | Version | Guard | Result |
|---|---|---|---|
| lb1_ci005_non_marketing_heads_approved | 20261019142418 | 22 heads / ₹514,421.93; 16 marketing heads | applied |
| dvs1_demand_volume_selection_off | 20261019142614 | live RPC md5 09c3d22c... | applied |

## Checks
| Check | Result |
|---|---|
| LB1: ledger rows | 22 rows closed (effective_to 2026-10-19) and 22 APPROVED copies added (from 2026-10-20) with identical pools and amounts. Rebuilding the pre-LB1 ledger hash from the current rows gives exactly the baseline value (522c27ab...), so nothing else changed. |
| LB1: cost effect | ₹0. Provision by pool: ADMIN 4,866,845.87 / FIN 779,552.76 / MKT 17,787,006.06 / PROD 3,779,280.24 / QC 307,750.02, the same as the local test. Only the status labels in comparison_details changed. |
| DVS-1: switch | OFF. Policy v1 is DRAFT from 2026-11-01; 0 APPROVED versions. Events, overrides and lineage tables have 0 rows. Kanji seed: product 695, Jun–Aug, from 2026-11-01. |
| DVS-1: objects | +5 tables (RLS on; no anon/authenticated/public grants), +1 function (fn_dvs1_select, EXECUTE owner only). Refresh RPC md5 is now ea2b1cdd..., the same as the tested patch. Method CHECK widened. Guards attached to the lineage table. |
| Only intended definitions changed | Rebuilding the function hash with the old RPC md5 and without fn_dvs1_select gives exactly the baseline (8a2287a6..., 1,132 functions). View definitions are unchanged (456). Tables 143 → 148. |
| Live-path replay (rolled back) | A temporary August run was refreshed through the live RPC inside a block that always raises, so nothing was committed. Before: 627 rows, content md5 93b43e46117c5fd736cf9fddc5b00fdc. After: **identical** md5, 0 lineage rows. A direct run-128 (October) replay is refused by the approved-run guard (AU2_PERIOD_HOLDS_APPROVED_RUN); it was not bypassed. |
| Read-only DVS-1 preview on live October data | LAUNCH_AVERAGE 14, MAX_MONTH 555 (87 flagged), no sales 58. Kanji is included under MAX_MONTH because its seed is effective only from November. This matches the isolated test. |
| Runs 122/128 | verify 0/50 and 0/51; basis snapshot hashes unchanged. |
| Other runs | Legacy drift on runs 119/121/124/125 is unchanged (1 table each). |
| Feed / cron / periods / designations / runs / switches / capacity | unchanged (feed aed9d8c1..., 1,261 rows; cron 60/61 inactive; Sep/Oct LOCKED). |

Note: the TB6 scoped-table set now includes the new lineage table. Verify skips it for old runs (0 rows), so there is no drift.
Evidence: `evidence/LBD/` (state_0/1/2, state.sql, replay_rollback_aug.sql).
