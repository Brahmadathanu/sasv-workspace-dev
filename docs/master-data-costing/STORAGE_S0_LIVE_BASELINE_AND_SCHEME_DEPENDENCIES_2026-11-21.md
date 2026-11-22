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

## S3 — owner-approved monthly draft-expiry policy, preview verified 22 Nov 2026

**Owner policy:** Once the new valuation month begins and prior-month finalisation is confirmed, unapproved prior-month costing-run *detail* is disposable. Schedule monthly cleanup **after** the governed finalisation gate, not at the calendar rollover itself. Preserve current-month drafts and all historical approval/REFERENCE/revocation governance. Rolling detailed approved retention target: current month plus previous three months. Outside-window approved run snapshots require a separate, proven archive/compaction contract.

**Executable, non-destructive SQL:** `docs/master-data-costing/sql/S3_PREVIOUS_MONTH_UNAPPROVED_RUN_PREVIEW.sql`. This is a SELECT-only script, verified against production, not a purge mechanism. All tentative candidates remain subject to FK and financial-evidence validation.

| Month | Provisional unapproved previous-month runs | Holds |
| --- | ---: | --- |
| Jul 2026 | 57 | 1 governance-linked; 1 displayed |
| Aug 2026 | 4 | 1 displayed |
| Sep 2026 | 28 | 2 formally designated; 8 governance-linked |
| Oct 2026 | 4 | 4 designated; 10 governance-linked |
| Nov 2026 | 0 | all 4 current-month |

**93 provisional candidates** across July–October. Other 31 runs held. Note that the preview identifies only six *non-snapshot* governance links; it does not yet assert no remaining foreign-key/lineage references. Thus 93 is **not** a safe deletion count. The snapshot fanout, all incoming scheme IDs and 64 direct header FKs must be resolved before DML.

### Deletion-engine acceptance contract

- **Closed-by-month:** Determine the target as **all months strictly before the current month**, but defer the immediately preceding month until the official finalisation/valuation status is governed and settled; if no approved run is mandated for that month, require an explicit month-close/no-approval disposition. Run/period locks prevent race with scheduled refresh and human approval. Nothing executable is triggered by the first day alone.
- **Classification:** Never infer approval from `overall_status=SUCCESS`. Any `costing_run_designation` history (`REFERENCE`, `APPROVED`, `REVOKED`) is a permanent hold on deleting governance rows and an approval-sensitive decision on details. Check selected/displayed status, active processing, accepted evidence, references and protected exception flags. Any unresolved reference is HOLD.
- **Keep compact history:** preserve run ID, period, valuation context, status, start/finish, errors, designation transitions, approval evidence fingerprints and cleanup receipt. If a legacy child currently FK-references the run header, preserve its lineage or migrate it to an immutable tombstone with an approved schema contract. No silent ON DELETE CASCADE expansion.
- **Large-data disposal:** after independent archive + restore test, delete only enumerated eligible per-run snapshot rows in child-to-parent order, bounded batches with savepoint/checkpoint and repeat-safe receipts. Never independently wipe transactional sales or material source ledgers. Keep run metadata small.
- **Verification:** pre/post row and checksum manifests per table/run, approved costs and pricing parity, workbench/printable report parity, no missing source evidence, no unexpected FK/permission faults, cron idempotence, archive reconstitution; report estimated freed logical bytes separately from allocated filesystem/quota figures.
- **Rollout:** stage → approved isolated pilot → measured post-pilot validation → owner sign-off → schedule guarded monthly run. Do not modify cron jobs 66 weekly, 67 month-end or 68 five-minute processor: they are currently active and form the cost production processing path. New cleanup scheduling must be independent and never pre-empt the end-of-month run.
- **Security:** privileged execution only under internal governed job role, not anonymously callable or general authenticated Data API RPC; logging/audit mandatory; privilege review before deployment.

**S3 status:** Query created and live SELECT-tested, candidate preview verified. Deletion engine, archive/restore pilot, FK migration contract, monthly cron and production data pruning **NOT IMPLEMENTED**. Existing production data untouched.

## S3b — OWNER CLARIFICATION: first completed Costing Suite month is November 2026 (22 Nov)

**Governance override to S1/S2 interpretation (not to factual run ledger):** Owner confirmed that the complete Costing Suite workflow was only fully implemented in **November 2026**. Runs from July–October, including five historical `APPROVED` designations across four runs (Sep 122; Oct 128, 136, 140, 143), are *pre-completion implementation / acceptance-transition outputs*; their historical `APPROVED` status must not be represented as evidence of the fully finished Costing Suite. This does **not** make those database designations factually nonexistent. Retain their low-volume auditable approval/revocation records or a sealed immutable compact surrogate; do not retain large work snapshots solely because their historical designation was `APPROVED`.

**Target:** all **120** runs from July–October 2026 are now `LEGACY_DETAIL_RETIREMENT_SCOPE`. Nov 2026 and later are the operational era. **Not** all 120 are immediately executable DELETE candidates. As of 22 Nov 2026, November had four runs (149–152), three SUCCESS and one FAILED; **no November APPROVED designation**, latest displayed November run 152 is a *draft*. September run122 (LOCKED) and October run143 (APPROVED) still anchor period views; run143 can also be used as latest approved cost source by pricing. Therefore, retain 143's usable data and prevent a fallback gap until a November-or-later approved source replaces it and price/report parity is proven. Lock/finalisation status is a separate constraint from owner's quality-era classification.

**Live read-only verified SELECT:** `docs/master-data-costing/sql/S3B_PRECOMPLETION_RUN_RETIREMENT_SCREEN.sql` (created in same draft PR). Screen prioritises consumer and reference holds over mere approval history; requires FK-aware archive/restore before *any* writes.

| Pre-completion period | Runs in legacy retirement scope | Preliminary detail pilot candidates | Holds pending replacement / separation |
| --- | ---: | ---: | ---: |
| July | 59 | 57 | 2 |
| August | 5 | 4 | 1 |
| September | 38 | 28 | 10 |
| October | 18 | 4 | 14 |
| **Total** | **120** | **93** | **27** |

A direct catalog discovery verified **64** run-header FKs and **62 second-order FK edges** referencing tables which themselves point to the run header. These 62 edges include dependencies not directly in the 64-header-FK set. `cost_sheet_line_monthly_snapshot` and `cost_sheet_line_traceability_snapshot` have incoming scheme viability IDs, so bulk deletion requires child-first deletion or a deliberate migration with parity. The pre-completion classification is **policy eligibility**, while technical deletion eligibility remains **BLOCKED**.

### Deployment work packages (bounded)

**S3b-A — preserve minimum provenance (migration design + rehearsal)**
- Immutable seal for historical owner approvals/revocations and reference run119: run ID, period, valuation, designation transitions, authority+times, checksum/fingerprint, approval reason/receipts; preserve preexisting accepted financial decisions and signed artifacts.
- Preserve a small run register/tombstone rather than removing all run IDs without a mapped FK replacement; classify the legacy rows visibly as pre-completion, not fully production-accepted.
- Inventory every published financial/pricing/report consumer for runs 80,82,122,143 and check pricing workbook selection is not silently impacted.
- Restore validation with archived records and historical printable reports on an isolated staging copy.

**S3b-B — disposal engine in staging (NO production installation yet)**
- Build `preview` and `execute` as separate capabilities. Preview returns manifest of all retained/retired run IDs and table-level row counts, FK edge graph, byte allocation estimates with uncertainty, archive references and expected invariants.
- Execution must require sealed manifest, replayable restore, explicit approved scope, advisory lock, and fresh recheck of live month closure, new approved replacement availability, reference protections and job processor idle state.
- Derive child-to-parent order from 64 direct plus 62 second-order FK edges (do not hardcode an optimistic order); reject cycles/unclassified paths until handled. Restrict batches and statement locks; no generic `DROP CASCADE`, table-wide `TRUNCATE`, or user-facing RPC.
- Preserve transactional Tally evidence, marketing source rows, non-snapshot registers, pricing decisions and signed reports; remove only permitted redundant *snapshot copies*. All writes logged into an immutable maintenance receipt.
- Verify run IDs removed from detail tables, retained governance/price/printed report parity, stage processor safety, space reuse and rollback before any scheduled repeat.

**S3b-C — monthly automation activation**
- After owner-accepted S3b-B pilot, schedule expiry of previous-month unapproved details, gated by verified prior-month close/disposition; retain approved post-completion details for current month + three prior months.
- Do not conflate the pre-November one-time legacy purge with the recurring monthly approved-retention policy; treat them as distinct scopes.
- Do not modify running jobs 66,67,68. Independently schedule cleanup only after month-end processing, with idempotence, notification and no race against approval.
- No deployed cleanup function, migration, archive, DML or cron change in this step; these remain future acceptance gates.

**S3b outcome:** Owner policy updated and SELECT-only code + catalog checks validated on live production, **no records deleted**. This supersedes S1's proposal to keep legacy full detail merely because of earlier APPROVED labels.
