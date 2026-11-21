# Storage B / S0 — Post Costing Suite Closure Live Read-only Recheck (21 November 2026 IST)

**Status: READ-ONLY AUDIT, NO PURGE OR SCHEMA CHANGE AUTHORISED.** Costing Suite WP00–WP12 formally owner-closed (13/13). PR #472 was merged to main at `28e38ff193867c61a89d3458f2813b994a8aec30` with a critical historical V1 possible-access security exception that remains independently OPEN. Local Electron developer checkout is the older `costing/approval-screen-preview` at `80e6fd39`, 2 commits ahead/614 behind main with uncommitted material, and MUST NOT be forcibly reset. This note is B-only; separate C cleanup and security follow-up remain governed.

## Fresh PostgreSQL allocation estimates (production live metadata)
`pg_total_relation_size` includes heap, indexes and TOAST and measures allocated bytes, not guaranteed immediate recoverable disk. PostgreSQL size metadata and planner row estimates, not full row counts.

| Relation | Allocated MiB | Approximate live rows |
| --- | ---: | ---: |
| costing.cost_sheet_line_traceability_snapshot | 3,546.2 | 1,447,672 |
| costing.marketing_regional_sales_evidence_snapshot | 3,113.5 | 6,000,276 |
| costing.marketing_signed_billed_sales_evidence_snapshot | 2,732.2 | 6,104,137 |
| costing.cost_sheet_line_monthly_snapshot | 1,314.0 | 1,484,232 |
| public.tally_group_outstanding_snapshot | 887.4 | 2,199,333 |
| costing.sku_rm_material_cost_line_snapshot | 678.9 | 828,172 |
| costing.cost_sheet_rm_line_traceability_snapshot | 655.1 | 618,226 |
| public.tally_fg_transfer_voucher_lines | 617.3 | 815,336 |
| costing.sku_scheme_viability_snapshot | 477.2 | 240,024 |
| costing.product_rm_material_cost_line_snapshot | 386.2 | 637,863 |

**No actual capacity/plan quota warning or physical billed disk figure verified**; this audit covers only relation allocation metadata.

## Run count and protected basis (read-only)
124 refresh-run records from July–November 2026:
- July: 56 SUCCESS, 3 FAILED (59 total).
- August: 4 SUCCESS, 1 CANCELLED (5).
- September: 28 SUCCESS, 10 FAILED (38).
- October: 16 SUCCESS, 2 FAILED (18).
- November: 3 SUCCESS, 1 FAILED (4).

`costing.v_costing_period_run_status` confirms September **run 122 APPROVED/LOCKED**, October **run 143 APPROVED**, November **run 152 DRAFT not approved**, October newer run 148 is draft. July/August have no approved-run ID in this status view. SUCCESS does NOT imply approved. With user's proposed rolling rule, November 2026 detailed retention window would be **August, September, October, November**; **July is a candidate** for archive/reconciliation, NOT automatically deletable (old pricing/audit/linked tables may reference it). Prior-month unapproved run pruning needs grace, protected exceptions and signed audit/backup first; **do not delete September and October unapproved runs until proof**.

## Direct dependency list: all-scheme viability snapshot CANNOT simply be dropped
Live PostgreSQL `pg_depend` view dependency check on `costing.sku_scheme_viability_snapshot` gives six **direct** views:
1. `costing.v_pricing_workflow_dashboard_summary` — KEEP consumer requiring a replacement source.
2. `costing.v_pricing_workflow_diagnostics` — KEEP consumer requiring a replacement source.
3. `costing.v_sku_scheme_comparison` — exhaustive comparison RETIRE candidate, through indirect public lens.
4. `public.v_costing_pricing_business_kpi_summary` — KEEP reporting, must prove parity.
5. `public.v_costing_pricing_printable_cost_sheet_lines` — KEEP selected-scheme printouts, must prove parity.
6. `public.v_costing_scheme_master_register` — KEEP Scheme Master, must prove parity.

Two named `costing.rpc_refresh_sku_scheme_viability_snapshot` overloads exist (period only; period+valuation_date+refresh_run_id). There is additionally a `scheme_viability_snapshot_id` pointer in `costing.cost_sheet_line_traceability_snapshot`, proving other run-linked lineage risk; full foreign-key/function/refresh-order dependency mapping **NOT YET COMPLETE**.

**Recommendation:** selected-scheme policy-context driven **per region IK/OK** projection; preserve all historical approved run evidence and Scheme Master, dashboard, printable costing, KPI consumers. Review-only design exists in PR #492. User's stated objective of eliminating redundant SKU×scheme fanout is valid, but only after equivalence is proven across 122/143 official contexts and drafts 148/152, including November differing IK/OK selected schemes. Removing UI alone will NOT reclaim the 477 MiB snapshot or avoid refresh fanout.

## Next safe S0/S1 progression
1. Verify plan storage warning/actual quota from an authorised project billing view (not fabricated from allocated size). Inventory FK constraints, triggers/refresh functions, archival references and all snapshot `refresh_run_id` column coverage; measure estimated row/byte per period/run through metadata or bounded index-only queries without heavy broad scans.
2. Produce exact **run-by-run candidate preview**, distinguish failed/successful/unapproved/approved/locked; protect immutable historical summaries, referenced official pricing and data-retention exceptions.
3. Conduct selected-scheme design parity in safe read-only/staging branch before any client/API/cron changes. Only later seek owner approval for SQL/install, client deployment, archive/deletion, physical reclamation and monthly automation as distinct gates.

**Not authorised:** any DELETE/DROP/TRUNCATE/VACUUM FULL/REINDEX, retention scheduler, RPC/view changes, app rollout, branch cleanup or PR merge. Security V1 triage must be tracked as an independent critical exception, not silently dismissed by 13/13 workflow closure.

## Additional 21 Nov read-only FK/run-link discovery — material constraint

A further `pg_constraint` inspection uncovered **three direct RESTRICT foreign keys pointing to `costing.sku_scheme_viability_snapshot(id)`**, not just view dependencies:
- `costing.cost_sheet_line_monthly_snapshot.ik_scheme_viability_snapshot_id` → scheme viability ID, ON DELETE RESTRICT.
- `costing.cost_sheet_line_monthly_snapshot.ok_scheme_viability_snapshot_id` → scheme viability ID, ON DELETE RESTRICT.
- `costing.cost_sheet_line_traceability_snapshot.scheme_viability_snapshot_id` → scheme viability ID, ON DELETE RESTRICT.

Consequently **a direct DELETE of scheme rows can fail referential integrity** and any `DROP ... CASCADE` would be especially unsafe. Preserve historical print/cost line/traceability lineage and explicitly design a selected-scheme identity replacement/migration before any table retirement.

Live read-only catalogue also found **more than fifty** costing snapshot tables/views with `refresh_run_id` and `period_start` (the inspected output includes more than 50; this is not a counted exhaustive table total). A wide range of `costing_refresh_run(id)` foreign keys have `ON DELETE RESTRICT` / default NO ACTION; only some stage rows are CASCADE. Thus deleting a refresh-run header is **not equivalent** to safe cascading deletion of all its dependent snapshots; retain approved run IDs, designated/fingerprint/acceptance records, and stage lineage. Formal S1 must produce an explicit dependency-ordered archival/deletion plan and full preview before any owner-authorised purge.

This finding strengthens the KEEP-first approach: Scheme Master and selected-scheme profitability/audit must remain intact while the expensive exhaustive comparison fanout is replaced, not dropped. No destructive SQL, DDL or migration was run.

## S0 metadata totals (21 Nov confirmation)
- `costing` user-table allocated relations: **14,574.6 MiB**.
- `public` user-table allocated relations: **3,459.2 MiB**.
- Combined `costing` + `public` tables/indexes/TOAST: **18,033.8 MiB**, approximately **17.61 GiB** allocated. **This is not a verified Supabase billed storage usage or plan cap.**
- `costing.costing_refresh_run(id)` is targeted by **64 foreign key constraints across 64 dependent relations**. `costing.sku_scheme_viability_snapshot(id)` is targeted by **3 foreign key constraints**, detailed above. The existing idea of simply deleting old refresh runs or dropping a scheme snapshot would therefore violate or cascade into extensive referential/audit obligations; do not implement a raw `DELETE FROM costing_refresh_run` retention job.
