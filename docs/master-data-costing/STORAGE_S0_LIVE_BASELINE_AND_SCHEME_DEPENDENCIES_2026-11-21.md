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

### S3b pilot selection — production READ-ONLY screening 22 Nov
Run **85 (September 2026, SUCCESS; undesignated)** is a useful *staging test fixture* rather than a token zero-row run: five measured snapshot sets: traceability **29,283**, monthly cost-sheet **29,283**, signed/billed evidence **108,981**, regional marketing evidence **108,981**, scheme viability **4,086**; 280,614 rows combined over these five tables. Verified none of six surveyed direct governance-link types reference run85. This is **not** full orphan proof: other FKs, external pricing, reporting, acceptance trails or unindexed references may still exist. Use isolated restoreable staging clone ONLY for the first destructive rehearsal; verify the 64 direct + 62 second-order edges and all table rows before pilot. SQL fixture: `docs/master-data-costing/sql/S3B_PILOT85_SOURCE_SNAPSHOT_MANIFEST.sql`. Run1 has no rows across these large five tables and therefore would not adequately test large-run reclamation. Run143's same five-table footprint is **27588,27588,109162,109162,3762**; latest November draft run152 is **27676,27676,111012,111012,4403**. Do not regard draft 152 as approved replacement for 143.

**Critical implementation limit:** S3b's 93 provisional candidate runs are a static snapshot and must be recomputed at execution time. **No production purge, migration, archive, staging deletion or cron change has occurred**.

## S3B/S3C — Owner correction: November 2026 as first *fully implemented* costing period (22 November)

Owner has explicitly clarified that **only the November 2026 implementation epoch reflects the completed Costing Suite**; earlier July–October runs were pre-completion/testing/transitional. This is a **business-acceptance classification**, not a retroactive alteration of the historical `APPROVED`, `REVOKED`, or `REFERENCE` ledger. Five earlier formal approval entries exist and remain truthful as to what was decided then. The six distinct run IDs with designation histories are 119,122,128,136,140,143. Preserve a *tiny immutable provenance summary* and approval/revocation facts, not their many megabytes of run detail, after dependency-safe migration.

**Live 22-Nov-2026 facts:**
- 120 / 124 run headers are from July–October; November has 4 runs (3 SUCCESS, 1 FAILED). **No November approved run yet**; 152 is currently displayed November draft. October **143 remains the latest approved run** and is still consumed via an approved pointer. DO NOT withdraw October 143 without proving the replacement for pricing and report calculations (and without first producing a governed November approval if that is the business gate).
- July displayed historical run 80, August 82, September 122 and October 143 are still referenced by `costing.v_costing_period_run_status`. Their old display/status view must use an explicit legacy-unavailable result or compact historical record after cutover; don't silently redirect those older months to the November run.
- **Pre-Nov legacy detail retirement scope: all 120 runs**, *subject to independent reference/cutover and archival proof*, not merely the 93 unapproved-only candidates of the earlier policy.
- S3B SELECT-only classifier yields:
  - **93** pilot candidates pending FK+archive (57 Jul, 4 Aug, 28 Sep, 4 Oct).
  - **27** further legacy holds pending consumer/reference/governance separation (Jul 2; Aug 1; Sep 10; Oct 14).
  - **4** November runs remain operational and untouched.
  - Counts are live row-header categories, not verified safe-to-delete row totals.
- FK DAG check: **64** directly run-linked dependent relations, **62** second-order FK edges from those direct children, **no cyclic paths detected**, longest descendant path **4 FK hops**. S3C graph preview in `docs/master-data-costing/sql/S3C_CHILD_FIRST_DEPENDENCY_ORDER_PREVIEW.sql`. Ordering is not a substitute for business-ledger and row-level FK validation.
- S3B full SELECT and legacy gate query in `docs/master-data-costing/sql/S3B_PRECOMPLETION_RUN_RETIREMENT_SCREEN.sql`.

### Explicit transition / implementation acceptance gates
1. **Production-read replacement:** Preserve October 143 approved source until approved November costing data and its essential pricing/report outputs are fully reconciled. November draft 152 is not approved by virtue of display alone. No accidental pricing fallback or stale display.
2. **Archive governance:** Seal the six historical designation transitions, approval timestamps and reasons, fingerprints, source acceptance/correction decisions, and minimal execution metadata. Keep minimal data without retaining legacy bulky snapshots. Do not forge or relabel older approved events.
3. **Legacy FK migration:** Enumerate/resolve every row-level child, cross-run link, view and report dependent on pre-Nov run IDs; 64 direct run relationships plus 62 higher-level edges and scheme snapshot backlinks. Identify which acceptance ledgers survive as independent evidence and which only point to retired transitory snapshots. Historical comparison/printing UX should say 'pre-completion detail retired' when appropriate, not use November numbers for older months.
4. **Staged pilot:** On a separately verified staging/backup environment test a small pre-Nov undesignated/unreferenced run, using checksum manifest, recoverable archive and rollback. Verify number of rows removed in every impacted table, and physical space through safe vacuum procedures (no unsolicited `VACUUM FULL` in production).
5. **Rollout:** Only after the October-to-November consumer cutover and test results, propose bounded production pilot with separate explicit approval and audit. The monthly scheduled rule remains previous-month drafts expire following finalisation; approved November+ detailed runs retain current+previous 3 months. Scheduled policy does not presume November is approved yet.

**Status: S3B/S3C SQL previews source-controlled and live SELECT-verified. No deletion engine installed, no archive created, no cron activation, no production DML or DDL.**

## S3D — Bounded rehearsal pilot fixture, 22 Nov 2026 (READ ONLY)

**Candidate:** September `refresh_run_id=87`, `overall_status=SUCCESS`, no formal run designation, not the period displayed run (Sep displayed/approved is 122), and six independently probed run-header governance-reference categories returned **false**. This is a *provisional staging fixture*, NOT yet eligible to purge.

Live exact per-run counts across five large direct snapshot relations:

| Run | Period / role | Signed sales | Regional sales | Cost trace | Monthly cost lines | All-scheme rows | Five-table total |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 87 | Sep transitional; unapproved | 108,982 | 108,982 | 29,964 | 29,964 | 4,086 | **281,978** |
| 148 | Oct transitional; unapproved | 109,162 | 109,162 | 27,632 | 27,632 | 3,768 | **277,356** |
| 152 | Nov current, displayed draft; KEEP | 111,012 | 111,012 | 27,676 | 27,676 | 4,403 | **281,779** |

The five-table totals are row counts, **not five-table physical MiB nor complete dependency counts**. No snapshot deletion occurred. Historical run 1 is low-value as a deletion-rehearsal fixture (zero rows in the five inspected large tables); choose run 87 for a meaningful stage test after archive proof.

New run-specific assertions at `docs/master-data-costing/sql/S3D_RETENTION_STAGING_PILOT_REHEARSAL_READ_ONLY.sql`. The script opens a `READ ONLY` transaction, checks designation, major governance references, period approved/displayed pointers, exact five-table rows and rolls back. It does not create any database object. It must be **executed and verified on staging** with matching fixture data before a writer can be enabled. This document's counts were independently checked by live SELECTs; the newly committed combined script has **not yet been executed as a single unit**.

**Remaining implementation work:** (a) snapshot backup/export+restore of every parent/child table for a particular run, (b) no-cross-run-FK assertion across all descendant relationships, (c) read-only function/view consumer lineage, (d) dependency-ordered *staging-only* bounded deletion and restoration dry-run plus parity tests, (e) independent November approved-run cutover, (f) guarded production pilot and later scheduled rollover. No production deletion, cron change, destructive SQL or schema migration has been authorized by this audit.

## S3E — Live leaf-FK confirmation and staging-only rollback executor (22 Nov 2026)

**Staging availability check:** Supabase project `qhmoqtxpeasamtlxaoak` currently lists **zero Supabase development branches**; the user has one accessible project, the live SASV production project. Creating a Supabase branch may incur hourly charges and requires distinct consent. Therefore no staging branch was created, no staging DB test was claimed, and no production writer/DDL was executed.

**Pilot scope deliberately reduced:** run 87 (September 2026, undesignated/undisplayed). A fresh `pg_constraint` inspection verified **zero incoming foreign keys** to each of `costing.marketing_signed_billed_sales_evidence_snapshot` and `costing.marketing_regional_sales_evidence_snapshot`. These two tables each have **108,982 run-87 rows**, totaling **217,964** repeated evidentiary rows, with indexed `refresh_run_id` lookups. This avoids the 62 deeper FK chains in the first deletion rehearsal while keeping original source sales transactions entirely untouched.

**Implemented in repo, NOT executed:** `docs/master-data-costing/sql/S3E_STAGE_ONLY_ROLLBACK_EVIDENCE_DELETE_REHEARSAL.sql`. This is a staging-only SQL transaction which:
- Rechecks run identity/status, previous-month scope, no designation, no current display, six source-governance link categories, and no incoming FKs.
- Copies run-87 evidence rows into transaction-local temporary tables, verifies exact source row counts against independent live evidence, deletes **only** those rows in the staging transaction, asserts receipt counts and retained run header, and always executes **ROLLBACK** at the end on success. The temporary copies are NOT a durable archive. On failure, the session must be explicitly rolled back if the client's error-stop interrupts the tail.
- Intentionally does not touch any of the 64 run-child tables beyond the two identified leaves; no run header, price, approval, scheme, or November data is changed.

**Independent mandatory acceptance sequence before enabling persistent cleanup:**
1. Obtain an isolated, approved staging test environment (or a locally restored fixture) with exact run-87 data; confirm connection target independently. Stage branch provisioning is separately gated for cost.
2. Establish an **external, durable restore artifact** for affected data, its checksums and replay procedure, independently verify a restore in that isolated environment. TEMP table rollback alone is not disaster recovery.
3. Execute S3D read-only controls on staging and S3E rollback rehearsal; after ROLLBACK, re-query both source tables: **108,982 rows** in each, no changes to counts/fingerprints for September 122, October 143, November 152.
4. Verify no non-FK downstream reports materialise side effects, no writer/schema races, no permission changes. Document query durations, lock waits and actual record counts from receipts; do not claim MiB reclaimed from row counts.
5. Only then implement a separately reviewed permanent batched cleanup executor plus immutable per-run archive/tombstone and monthly job. The release acceptance and pricing governance must remain unaffected.

**S3E status: repo implementation drafted and committed, static metadata validated live, staging execution NOT TESTED; production data/cron UNCHANGED.**

## S3F — Offline-tested read-only archive tooling, 23 November 2026

Source-controlled Node utilities (no new dependencies; repository already has `pg`):
- `docs/master-data-costing/tools/archive-run87.mjs`: fixed two-table allowlist, `REPEATABLE READ READ ONLY` DB transaction, row-id keyset pagination, raw PostgreSQL `row_to_json(t)::text` streaming to gzipped JSONL, SHA-256 digest, exact 108,982-per-table count check and rejection/removal of incomplete output. Uses only a privately supplied `SASV_ARCHIVE_DATABASE_URL`; no database writes, restore, or deletion operations.
- `docs/master-data-costing/tools/verify-run87.mjs`: independent offline integrity check of archive manifest, data digest and row count. It cannot assert successful restoration.
- `docs/master-data-costing/tools/archive-run87.test.mjs`: Node built-in test runner fake-query tests. **3/3 PASS** in isolated local execution; no production database connection used in the test.
- `docs/master-data-costing/tools/README.md`: secure operator instructions and mandatory restore gate.

The source scripts were committed to this draft branch; production archival extraction has **not** been run and no archive artifact is asserted to exist. This is partial two-leaf backup tooling, *not* a complete archive of all 64 direct/62 nested run dependencies. A separately verified isolated database, stage restore and authenticated parity proof remain mandatory before S3E DELETE-in-ROLLBACK rehearsal and any persistent cleanup.

**Current operational-pointer update, read-only 23 Nov 2026:** October approved/displayed = 143; November `approved_run_id=NULL`, `displayed_run_id=153` (`LATEST_SUCCESS`). The previous observed November draft 152 was superseded as displayed; **do not promote 153 to approved or cut over October 143 pricing without the owner's existing approval procedure**. Static row-87 historical fixture is distinct from this moving pointer.

Security note: S3E opt-in flag is not a staging-environment attestation. Operator must independently establish the DB project identity and isolation outside SQL. No billable Supabase branch, archive, DML, DDL, cron or production deletion was created.

## S3G — isolated PostgreSQL typed-restore verifier (23 November 2026)

A staging-only verification utility is now committed at `docs/master-data-costing/tools/restore-verify-run87.mjs`, with source tests `restore-verify-run87.test.mjs` and runbook in `docs/master-data-costing/tools/README.md`. It reads the archive exported by S3F, verifies archive integrity offline, creates **TEMP** tables matching each source table's columns and relevant constraints, inserts parameterized raw JSON in bounded batches via PostgreSQL `jsonb_populate_record`, compares exact rows with `row_to_json` SHA-256, and ends in **ROLLBACK**. Both exporter and verifier set the transaction-local timezone to UTC to avoid timestamp-serialization drift. This is NOT a production import or a full-run data recovery.

The connection requires an explicit stage attestation and rejects the known production project ref within the DSN, but this is not a cryptographic or administrative proof of staging isolation. **Operator must independently verify project identity outside SQL**; no Supabase branch currently exists. No staging DB was provisioned, and S3G restore was **NOT TESTED** against PostgreSQL; the new unit test source is committed but not independently executed here. Prior S3F three fake-query archive tests were recorded as passing.

Prior S3F read-only export has not been executed against production, no actual archive exists in this workflow, and S3E rollback-DELETE rehearsal remains unexecuted. Thus no production clean-up or month-start automation is authorized. S3G is source-controlled engineering readiness, NOT closure of recovery acceptance.

## S3H — actual PostgreSQL archive type parity PASS; deletion block discovered (23 Nov 2026)

User directed use existing capabilities rather than create a billable Supabase development branch. No staging branch was created. A live **SELECT-only** PostgreSQL round-trip was performed on two run-87 source tables: `row_to_json(t)::text` → `jsonb_populate_record(NULL::<table>, json::jsonb)` → `row_to_json(... )::text`. On production PG 17.4 with UTC session timezone, **1,000/1,000 exact JSON matches per table**, total **2,000/2,000 PASS**; an earlier 20-per-table control also passed. This directly validates typed conversion of a sample using actual PostgreSQL types, but is NOT proof of durable archive, full restoration, external backup or per-run deletion. No writes occurred.

**Critical new blocker:** Both of the proposed FK-leaf evidence tables have two active row-level change-protection triggers:
- `costing.fn_guard_designated_run_rows()` rejects `REFERENCE/APPROVED/REVOKED` run history mutations.
- `costing.fn_enforce_mutable_refresh_run_snapshot()` rejects INSERT, UPDATE and **DELETE** for any run whose status is not `QUEUED`, `RUNNING` or `FAILED`. Its current source explicitly raises `Snapshot mutation is prohibited for terminal refresh run ... status ...`. Run 87 is `SUCCESS` and **cannot** be deleted by S3E in a production-identical staging database. A TRUNCATE-protection trigger is also present.

Read-only period grouping: 120 legacy runs = **104 SUCCESS**, **15 FAILED**, **1 CANCELLED**. The status guard blocks snapshot mutation for **105/120**, independently of six designation history IDs and FK relationships. It potentially permits FAILED rows (15), subject to other guards, but those are NOT automatically approved for purge. The discovery invalidates the assumption that a roll-back-only `DELETE` rehearsal of run 87 is presently executable on production-equivalent staging.

**Correction made:** S3E script amended to **fail closed** at an early preflight when the active terminal-run trigger exists; it does not disable/bypass any guard. `docs/master-data-costing/sql/S3H_RETENTION_MUTATION_GUARD_READ_ONLY.sql` records exact read-only introspection/period counts. The next engineering package must introduce an explicitly reviewed retention-maintenance policy pathway that authorizes narrowly scoped, audited disposal of **undesignated historical terminal** snapshots while preserving normal writer immutability; it must pass independent authorization/permissions, run-ID, archive, approval, month-lock, and rollback proofs. **Never set a user-modifiable GUC as sole authorization, alter run status to make deletion pass, or disable triggers in production**. No production DML/DDL, archive export or scheduled maintenance was executed.

**S3H status: production PostgreSQL typed-conversion sample verified; source-control safety correction applied; actual stage restore and deletion remain BLOCKED.**

## S3I / S3J — Guard-preserving retention authorisation boundary (23 November 2026)

Live read-only privileged-function inspection: `costing.fn_enforce_mutable_refresh_run_snapshot` and `costing.fn_guard_designated_run_rows` are owned by `postgres`, execute as SECURITY DEFINER, and have EXECUTE ACL restricted to `postgres`. Neither `anon` nor `authenticated` has direct EXECUTE in the tested live privilege check. These protections are an essential production security invariant and must not be weakened by a general writer bypass. Trigger code's `current_user` is the function owner, not a trustable original-caller identity.

`docs/master-data-costing/sql/S3I_GOVERNED_RETENTION_POLICY_PREVIEW.sql` implements the **read-only policy predicate** with an actual negative/positive fixture comparison. Nine production live test IDs all matched their expected classifications **9/9 PASS**:
- Pre-Nov non-designated and undisplayed: run 87 and 148 => `PREVIEW_ONLY_NEEDS_ARCHIVE_AND_GOVERNED_EXECUTOR` (not DELETE_ELIGIBLE).
- Historical designated: 122,128,136,140,143 => HOLD.
- November: 152,153 => HOLD.
- Historical reference run 119 remains protected by designation history (not part of the above nine fixture query).

`docs/master-data-costing/S3J_GOVERNED_RETENTION_EXECUTOR_CONTRACT.md` specifies the dedicated direct maintenance-role boundary, private manifest and audit records, same-transaction run/table/receipt binding, preservation of original snapshot guards, and privilege denial matrix. It explicitly forbids treating a modifiable session GUC alone, altering run status, disabling triggers, TRUNCATE or blanket CASCADE as authorisation.

**Execution state:** server permission and classification proof read-only PASS. Privileged maintenance function/role/ledger, trigger exception, archiving and real staging deletion **NOT IMPLEMENTED or tested**. No production DML, DDL, security-policy change or scheduler change. The safe next gate is implementation and isolated positive/negative security proof of this exact retention-only exception before production deployment; do not confuse the design contract with a deployed cleanup mechanism.

## S3K — Stage-only limited cleanup executor scaffold (23 Nov 2026)

**Source code now committed, not installed:** `docs/master-data-costing/sql/S3K_STAGE_ONLY_RETENTION_EXECUTOR_REVIEW.sql` is a PostgreSQL 17 **stage-only implementation candidate**. It requires a separately provisioned dedicated direct `NOINHERIT LOGIN` maintenance role, and an absent private `costing_retention` schema (fails closed if a preexisting schema could be reused). Installer defines private sealed approval, transaction context, and batch receipt tables, plus a `SECURITY DEFINER` 500-row DELETE-only executor restricted to **run 87 and exactly two evidence FK-leaf tables**. Other functions/roles are not granted access. A narrow exception to the existing terminal-run status trigger would consult the private transaction-bound, caller-bound permission record; the separate designated-run immutability trigger is **not modified**. Routine INSERT/UPDATE/DELETE by application roles still retain their normal guards. Hash/receipt fields require independent DBA review; their presence alone does not prove archive validity.

**Live read-only verification of installation gates:** `sasv_retention_executor` **does not exist**; `costing_retention` schema **does not exist**; both evidence leaf tables still have the two expected enabled immutable status/designation triggers (**4/4**). Thus this proposed stage-only installer would currently **abort** on live production rather than create a role or silently modify existing protections. A read-only negative-access preflight was committed to `docs/master-data-costing/sql/S3K_NEGATIVE_ACCESS_READ_ONLY_PREFLIGHT.sql`.

**Important limits:** source has **not** passed a real PostgreSQL deployment/rollback, function compilation, role-based positive/negative case execution, archive recovery or security code review. The 500-row loop is designed for one batch per call, not yet an approved permanent production mechanism. It also covers **only two tables** and does not solve the full 64+62 run-dependency graph, physical disk reclamation, all-scheme retirement, or October 143 to governed-November approval cutover. No new Supabase dev branch was bought. **NO live DDL, DML, role, trigger, cron, application change or archive extraction was performed.**

**Next gate:** independently provision a free isolated local PG17 fixture with the source trigger definitions, compile S3K in that fixture, prove all negative role/approval tests and run87-only positive 500-row rollback/restore test, then seek independent audit/security review before a production migration is even considered. Existing source-control PR remains draft.

## S3L — isolated PostgreSQL availability and S3K static security gate (23 Nov 2026)

Attempted to locate an available no-cost local PostgreSQL engine in this execution container. `postgres`, `initdb`, `psql`, Docker and a configured installable `postgresql-17` package were **not present**. No free isolated PostgreSQL instance could be started in this turn. No paid Supabase branch was provisioned, and importantly **no production writer/DML/DDL or trigger alteration was used as a substitute**.

**Actual code hardening:** stage-only `S3K_STAGE_ONLY_RETENTION_EXECUTOR_REVIEW.sql` now fails closed if either of the two current immutable trigger-function definitions or their `postgres` SECURITY DEFINER ownership differs from the live PG17.4 references, or if the expected four active row guards are absent. Read-only live `md5(pg_get_functiondef(...))` fingerprints on 23 Nov:
- `fn_enforce_mutable_refresh_run_snapshot`: `2fc573625296de9ccde5d722fdd4a3de`.
- `fn_guard_designated_run_rows`: `5629ce76254a5ed45cde5529ce91caee`.

These MD5 values are **source drift markers only**, not a signed approval or a substitute for restore authorization. Before staging execution, pin checks must be reviewed against the **actual isolated fixture's function definitions**. A mismatch must stop installation, not be bypassed.

**Offline static review:** 23/23 source checks PASS (scope, fixed run 87, two table allowlist, executor role, 500-row cap, no trigger disabling or status spoofing, private authorization and transaction context, source-fingerprint and trigger-count guards). Reproducible Node test source committed to `docs/master-data-costing/sql/S3L_STAGE_EXECUTOR_STATIC_GATES.test.mjs`, runnable as `node --test docs/master-data-costing/sql/S3L_STAGE_EXECUTOR_STATIC_GATES.test.mjs`. **These are source-only checks; no PostgreSQL syntax compile, role-based negative-access test, positive 500-row deletion/rollback, actual restore or concurrent-writer proof was performed.**

**Verdict:** S3K remains **REVIEW_ONLY / NOT DEPLOYABLE** until its security and SQL semantics pass an actual isolated PostgreSQL 17 deployment and the independent archival/restore gates. Retention scope must not be broadened beyond two historical run-87 evidence tables by this scaffolding. No production changes.

## S3L — ACTUAL PostgreSQL 17 CI acceptance achieved (23 Nov 2026)

**Decision:** The prior local-container PostgreSQL installation blocker is resolved without buying a Supabase development branch. The existing repository already had GitHub Actions `postgres:17` service patterns. Added `.github/workflows/costing-s3l-pg17.yml`, `docs/master-data-costing/sql/S3L_SYNTHETIC_PG17_FIXTURE.sql`, and `docs/master-data-costing/sql/S3L_RUN_PG17_FIXTURE.sh` to the draft PR. All data are synthetic and all database credentials are fixture-only; no production database connection or secrets are used.

**Executed evidence:**
- [Initial actual PostgreSQL CI PASS](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45143106462), head `42d3921d`: real PG17 function/triggers compile, live guard fingerprints match, stage-only S3K SQL installs on synthetic fixture, role denials, 500+500+100 historical signed-evidence deletion and transaction rollback PASS. Static 23/23 PASS.
- [Expanded actual PostgreSQL CI PASS](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45143292020), head `1c60246d`: both run-87 historical evidence tables execute separate authorized **500 + 500 + 100** row sequences; both table receipts equal three batches; protected historical approval run 122 and current-period run 153 remain unchanged; approved 143 scope refuses executor call; normal users, nonmaintenance sessions, spoofed user session flag, unsealed/completed approval and private-approval access all rejected; rollback receipt/count verified. Static 23/23 PASS. Final literal receipt `S3L_PG17_FIXTURE_PASS`.

**Comparison outcome:** A disposable existing GitHub Actions PG17 fixture is preferable to an additional billable Supabase branch or unavailable local PostgreSQL install for **compilation, trigger, privilege and synthetic rollback tests**. It is **not** a replacement for authentic full-run archive/restore or production parity: no real run-87 archive has been exported; S3K is limited to two leaf tables for one unapproved run; accepted historical designations and current October 143 pricing pointer remain protected; cross-table FK graph for whole-run retention remains unimplemented in the writer. The synthetic fixture's sealed approval values are deliberately dummy hashes, not production recovery evidence.

**Actionable implementation gate, not another research loop:** keep the tested S3K narrow writer separate from unimplemented whole-run deletion. Next close the **actual production archive/restore** and **pricing source cutover**, then a small explicitly authorised production pilot only after independently proven recovery. No role, trigger, DDL, DML or cron was changed in production; PR #491 remains draft.
