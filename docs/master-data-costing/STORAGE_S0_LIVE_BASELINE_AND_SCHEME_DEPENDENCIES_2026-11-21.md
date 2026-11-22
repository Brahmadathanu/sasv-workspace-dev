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

## Database-wide size and safe run inventory, follow-up
- `pg_database_size(current_database())` = **18,375.5 MiB (17.94 GiB)** in PostgreSQL's `postgres` database. This includes database components beyond the 18,033.8 MiB of costing+public user-table allocations; **still not a confirmed Supabase billing usage/plan quota**.
- Run history again confirms July 59 (56 SUCCESS, 3 FAILED); Aug 5 (4 SUCCESS, 1 CANCELLED); Sep 38 (28 SUCCESS, 10 FAILED); Oct 18 (16 SUCCESS, 2 FAILED); Nov 4 (3 SUCCESS, 1 FAILED), total 124. SUCCESS is not approved.
- Bounded indexed query of the scheme snapshot for three selected run IDs counted **September approved 122: 3,804**, **October approved 143: 3,762**, and **November draft 152: 4,403** all-scheme rows (11,969 total). The selected-scheme design proposal reports 634/627/630 distinct selected SKU-scheme pairs respectively, but these design counts must be independently parity-verified before replacing refresh logic.
- **Local code housekeeping is a separate user-directed reconciliation.** Owner's dev CMD is on `costing/approval-screen-preview` commit `80e6fd39` (2 commits ahead, 614 behind `origin/main` before latest merge) with one modified migration and multiple untracked temporary files/worktrees. The owner prefers one authoritative GitHub main and no accumulating local debris. No direct remote access to the Windows filesystem exists in this assistant session; only locally run commands can verify unique changes and safely remove old files. Never run `git clean -fdx` or delete `.worktrees` indiscriminately, which may house active linked worktrees and unmerged development.

## S1 — proposed narrow monthly rollover decision (NOT applied)

**Owner's intended rule:** current month plus three previous months is the *maximum detailed-approved retention window*; old-month drafts should be cleared promptly after closing/month rollover, but only after documented protection checks. Example **November 2026**: detailed approval window Aug–Nov; July+ older than window. August has **no approved run**, so its successful calculations are not to be mistaken for an approval merely because they are recent.

| Historical category | Proposed handling / gate |
| --- | --- |
| September approved locked 122; October approved 143 | **KEEP untouched**, including all required selected-scheme, traceability, priced output, approval/fingerprint evidence while within window. |
| Older within-window approvals (e.g. earlier October approved runs 128/136/140, superseded by 143) | **HOLD** for owner policy: either preserve full detail while window active or compact them to immutable approval/fingerprint summaries after audited equivalence. Do not mark them drafts. |
| October latest unapproved draft 148; September nonapproved runs | **CANDIDATE** after a grace period and reference checks; never assume running/failed/accepted evidence can be deleted without exception. |
| August SUCCESS without approval (and July SUCCESS without approval) | **CANDIDATE** only after documenting any historical development/cost audit, signed financial reporting or linked evidence uses. Their current `OPEN/DRAFT` statuses preclude calling them approved. |
| July+ detail older than three previous months | **ARCHIVE/COMPACT candidate**, *not* immediate delete; retain immutable summaries and required legal/financial evidence and protect any historical external references. |
| Failed/cancelled/stage history | Retain compact incident/refresh execution ledger; delete bulky per-run working detail only after causal and recovery dependencies reviewed. |

**Safety blockers before any S2 pilot:** enumerate all 64 run FK references and the three scheme viability FK links with retention semantics, check referenced run designations/fingerprints, archive manifest+checksum+restore rehearsal, prove selected-scheme IK/OK outputs and printed cost sheets unchanged, show per-run exact byte/row estimates, document lock/WAL impact and whether VACUUM can reuse or reclaim capacity. An automated first-of-month job is prohibited before this pilot demonstrates idempotent recovery and owner accepts the exact policy.

**Security sidecar:** issue [#494](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/494) tracks unresolved conflicting V1 No-access views; unrelated to destructive storage approval and not a cleared finding.

## S2 — live run-sensitive bounded preview (22 Nov 2026; read-only; not a purge approval)

The exact `costing.costing_run_designation` ledger has **six designated run IDs**: September **119 REFERENCE**, **122 APPROVED**; October **128,136,140 APPROVED then REVOKED**, **143 APPROVED**. **None of July/August's runs were formally designated.** Critical policy correction: `APPROVED → REVOKED` means there is a historically significant approval decision, not an ordinary disposable draft. Preserve these IDs, approval fingerprints, reason+timestamps and audit metadata regardless of whether details are later compacted.

| Month | Runs | Never designated | Historically designated | Traceability lines | Signed/billed evidence rows | Regional evidence rows |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| July 2026 | 59 | 59 | none | 29,154 | 436,996 | 327,747 |
| August 2026 | 5 | 5 | none | 29,197 | 327,051 | 327,051 |
| September 2026 | 38 | 36 | 119,122 | 874,391 | 3,269,459 | 3,269,459 |
| October 2026 | 18 | 14 | 128,136,140,143 | 442,156 | 1,746,592 | 1,746,592 |
| November 2026 | 4 | 4 | none | 82,984 | 333,036 | 333,036 |

Rows above are **exact counts** from a grouped bounded read-only production query, as observed on 22 Nov 2026. They are **not byte savings**; relation allocation, TOAST, index occupancy, space reuse and PostgreSQL file truncation differ. Three relations measured in this preview total more than 13 million evidence/traceability rows. These evidence rows may be copied on every run, even if source business sales transactions are unchanged; test true lineage and signed-report dependencies before removing any.

### Decision matrix for an S2 preview candidate (NOT execute list)
1. **PERMANENT GOVERNANCE / HOLD:** run designation ledger (including `REFERENCE`, prior `APPROVED` and `REVOKED`), approval fingerprints, approval/lock dates, financial/marketing acceptance decisions, incident and reproducibility manifests. Never delete a run solely because its designation is revoked or its `overall_status` is SUCCESS. As observed, 119,122,128,136,140,143 have historical designations. Retain the header and necessary dependencies until a reversible governance design passes.
2. **CURRENT operational / HOLD:** run 152 (displayed November draft), run 143 (displayed approved October), run 122 (displayed approved September); no destructive action while referenced by current views/pricing.
3. **Historical displayed without approval / HOLD:** July run 80 and August run 82 currently serve as displayed successful runs despite no approval. Displayed status is an independent protection gate; do not delete until replacement/period policy is proven.
4. **Superseded approved details / COMPATION CANDIDATE ONLY:** October 128,136,140 and reference 119 are possible *large snapshot* compaction subjects only after archived immutable evidence and printed/financial parity. Do not delete their authoritative approval and reference ledgers.
5. **Undesignated old runs / CANDIDATE:** July's 59 and August's 5 historical runs qualify for *screening*, subject to the displayed-run exception and other references. September's 36 and October's 14 undesignated runs are also candidate detail sets after controls; November runs are current and excluded. Candidate does not mean permission to purge.

### Confirmed execution blockers
- **64 run-header FKs**, many with `ON DELETE RESTRICT` or NO ACTION; ten large direct dependents include `cost_sheet_line_traceability_snapshot` (3546 MiB), `marketing_regional_sales_evidence_snapshot` (3114 MiB), `marketing_signed_billed_sales_evidence_snapshot` (2732 MiB), `cost_sheet_line_monthly_snapshot` (1314 MiB), and cost RM line tables.
- Some references are **acceptance registers** (`material_review_acceptance_register.source_refresh_run_id`, `regional_marketing_evidence_acceptance.source_refresh_run_id`, etc.) and historical controls. Deleting dependent snapshot lines without a FK/lineage contract migration may destroy valid regulatory evidence even if the header survives.
- `sku_scheme_viability_snapshot` has **three incoming RESTRICT FK references**, plus six direct view consumers; all-scheme rebuild cannot be stopped before view/client and FK migration.
- **No production DML, DDL, VACUUM FULL, refresh, archive copy, or scheduler update executed.**

### S3 design/verification required before execution
Prepare a **read-only decision manifest** with one record per `refresh_run_id`, including period, displayed run, designation history, protected approvals/lock, all 64 dependency reference counts, accepted external ledger refs, each snapshot row count, and byte-reclamation projections labeled as estimates. Flag any run with designation history, displayed/official consumer, accepted financial evidence, approval fingerprint or legal retention as HOLD by default. Prefer a **small pilot** removing only isolated, undesignated, undisplayed historical per-run detail after sealed recoverable archive + restore rehearsal + app parity + owner approval. Do not enable automatic month-start deletion until rollback, idempotence and retention boundaries are independently tested. The 3-month rule is a *policy target* not sufficient authorization to purge older receipts.

S2 outcome: **read-only dependency and period counts verified, destructive pilot BLOCKED pending independent per-run reference/lineage and recovery proofs.**
