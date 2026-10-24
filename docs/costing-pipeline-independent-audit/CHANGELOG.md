## 2026-10-20 late — Actual live route/period correction, verification runs, material forensics (authoritative checkpoint)
- Live Route161 family101 approved effective Oct20, historic Route144 superseded through Oct19; historical resolver repaired. October period reopened OPEN and valuation DRAFT Oct20 with audit15/16 (admin operation, NOT PWA session); historical approved run128 remains immutable.
- New verification runs130,131 succeeded, neither designated/approved. 56 matched quantity drivers carried forward by explicit user approval plus SKU1771 default0.725 approved, all 57 matched in run131. No Policy7 change.
- Run131 final control: 15 READY / 612 REVIEW_REQUIRED =605 material +7 pricing. 841 active Oct16 material acceptances; 826 still present with same issue summaries, 15 absent; 501 strictly matching currently observed rate/source/date triplets; full provenance and old/new approval parity pending. Do not blanket reaccept.
- Run131 product pool reconciliation manufacturing labour ₹706,203, production OH ₹670,935.04, both exact; five-product SKU manufacturing allocation shortfall ₹85.89. G2 attestation HELD; G6 and Sheets BLOCKED. Full and actionable successor checkpoint: `archive/LIVE_HANDOVER_2026-10-20_RUN131_MATERIAL_AND_SKU_AUDIT.md`.
- Documentation-only commit here, documenting preceding separate approved Supabase operations; no additional database mutation for this docs task.

# Changelog: costing pipeline audit (branch costing/au4-normal-budget)
Newest first. All times IST. Details: DECISIONS_AND_OPEN_QUESTIONS.md, POLICY_REGISTER.md, handover/.

## 2026-10-24 15:50: Docs cleanup (docs only, read-only checks)
- Added CURRENT_STATE.md (single entry point) and contracts/PRICE_REVISION_FEED_CONTRACT_v2.md for `costing.v_price_revision_current_approved_master` (627 rows, 64 cols). v1 marked superseded.
- Recorded live state: run 143 is October's approved run (24 Oct 13:46 IST, superseded run 140 via owner authorisation #10; Mathalam (F) at ₹118/kg); October OPEN, 22 Oct valuation DRAFT; approved feed `costing.v_price_revision_current_approved_master` (old public feed view gone); cron 66/67/68 active, 60/61 gone.
- Status banners refreshed (PROGRAMME, ISSUE_REGISTER CI-023/CI-024, cron replacement note, price-revision charter). Superseded banners on old handovers/checkpoints; unlinked _SHORT handover twins removed.

## 2026-10-19 19:35: TB1–TB7 applied live and verified; G3 policies accepted
- Approval USER-APPROVAL-20261019-TB1-TB7. Migrations tb1/tb2/tb3/tb5/tb6/tb7 (files unchanged). closure/TB_LIVE_APPLY_2026-10-19.md + evidence/TBL. No data row changed; 122/128 0 drift; feed, cron, periods, switches unchanged.
- Policies recorded (DECISIONS, POLICY_REGISTER P33-P38, register). LB1 (CI-005 ledger status) prepared and tested locally, not applied.

## 2026-10-19 20:45: G3 policy decision sheet ready (read-only simulation on run 128)
- closure/G3_POLICY_DECISION_SHEET.md + evidence/G3. CI-014 recorded as an open G3 item (60% rule operative by user approval until G5), severity MEDIUM. No live write.

## 2026-10-19 20:15: Technical approval batch TB1-TB7 prepared and tested in isolation (not applied)
- closure/TECHNICAL_BATCH.md, closure/prepared/PREPARED_TB1..TB7 (TB4 = no SQL), evidence/TB (runner, results, capacity origin CSV). Local PG17 fixture of the live catalogue (62/62 view definitions md5-identical).
- CI-017 raised to HIGH: 49 costing views had no permission gate; all 25 accounts could read per-employee salary (staff classification register) and cost sheets. TB2 gates them; permitted users' results unchanged.
- CI-001/002/009/010/018/019/020 prepared+tested; new CI-033 (INFO). No live write.

## 2026-10-19 19:05: G1 upstream lineage verified (read-only)
- closure/G1_UPSTREAM_LINEAGE.md + evidence/G1U (u1-u5). Runs 122/128: all RM/PM lines, UOM conversions, yields, 999/994 Tally voucher rate picks, manual rates and labour allocations reconcile (0 mismatches); run 128 builder replay identical; run 122 replay differs for 8 products (BOM masters not effective-dated, CI-028).
- New issues CI-028..CI-032 (master effective dating; 12.8% stale/fallback/manual material value; process-loss plausibility; batch-true rate label; manufacturing-labour driver concentration, Dhanyamlam 13.2%). CI-027 closed as verified.
- No live write.

## 2026-10-19 18:25: Closure mandate G0 done; G1 downstream reconciliation verified (read-only)
- Mandate COSTING_END_TO_END_SERVER_CLOSURE_MANDATE_2026-10-19.md (28f1d4d) adopted; new `closure/` directory: PROGRAMME.md, IMPLEMENTATION_RULES.md, ISSUE_REGISTER.json/.md (27 issues), G0_BASELINE_2026-10-19.md, G1_COST_WATERFALL_RECONCILIATION.md, evidence/G0 and evidence/G1 (SQL + results).
- G0: repo (main 80c14ab, PRs), 582 live vs 96 repo migrations, 3,984 definition hashes (0 changed since W2), runs/designations/periods, fingerprints 122/128 0 drift, cron 33 (60/61 paused), switches (G4 none), capacity master, security advisors.
- G1: all waterfall identities hold for 634/627 SKUs; the 7-vs-9 exceptions are internal material conversion (in prime, missing from the ILC display). Head-to-pool and pool-to-SKU conservation exact (incl. IMC transfer Rs 175.26 Oct).
- Key open: Tally snapshot tables writable by any logged-in user (CI-001); Central Office Rs 8.72L vs HO Rs 5L (CI-003); 60% seasonal rule authoritative (CI-014); 74 machines without capacity (CI-011).
- No live write.

## 2026-10-19 11:06: W2 governed period lifecycle INSTALLED LIVE (approved 09:16)
- Migration 20261019053600 w2_governed_period_lifecycle (prepared file unchanged, md5 d978bb21). Prechecks/postchecks passed.
- Changed: only fn_guard_designated_run_rows/header (+REVOKED) and the audit event-type check. Added 26/26 objects identical to the local build.
- Runs 122/128 0 drift; Sep/Oct LOCKED, designations, feed (Sep 634 74/70, Oct 627 9/9) and cron (60/61 paused) unchanged. Context and run-128 pre-checks work (read-only).
- Not done: November not opened; no approval/lock action; no refresh; no merge or deploy. Evidence: evidence/W2/.

## 2026-10-19 08:15: W2 governed period lifecycle built and tested LOCALLY (approved 07:59; no live change)
- proposals/consolidation/w2/: PREPARED_W2_governed_period_lifecycle.sql (md5 d978bb21; guards stop on any live definition difference), local_test/ harness, W2_LOCAL_TEST_REPORT.md.
- 9 governed RPCs (open next month, pre-checks, approve, lock, reopen, authorise supersession, supersede, close, context); owner-only approve/authorise/supersede/close; every action audited with reason, reference, actor.
- Hardening H1-H6 (re-baseline truncate guard, audit append-only, event types, REVOKED immutable, one approved run per month, closed month final).
- Local tests 53/53 incl. full November lifecycle, permission refusals, double approval (RPC and direct), BLOCKED, close-before-lock, reopen-after-close, expired authorisation, supersession feed (old run kept, fingerprints clean), no cost-logic change.
- Client branch `costing/w2-period-runs-panel` (d5f92af, off costing/w1-approved-run-labels): "Period & runs" panel; node tests 17/17; client-to-DB contract 10/10. Not merged, no PR.
- No database writes, no apply_migration, no cron change, no merge or deploy. September unchanged (LOCKED).

## 2026-10-19 07:50: Feed contract v1, migration parity, W2 design (read-only); client PR opened
- archive/PRICE_REVISION_FEED_CONTRACT_v1.md, written from the live view definitions:
  - covers objects, access, grain, 30 columns, selection rules and the Sheets query
  - October run 128 control totals
  - lists what is not in the feed (RM/PM split, overheads, discount policy, contingency, schemes, realisation) and its authoritative source
- Finding: the margins are MRP − (ILC + regional marketing), as % of MRP. pricing_cost_per_sku (national marketing) is not the margin cost.
- evidence/W1_W5/MIGRATION_PARITY_2026-10-19.md: 17/17 live definitions identical to the prepared SQL. Gap: the rebaseline table has no truncate guard (proposed H1).
- proposals/consolidation/W2_GOVERNED_PERIOD_LIFECYCLE_DESIGN.md: functions F1–F7, client panel, local build plan, decisions D1–D9.
- Client PR #73 (draft, "do not merge or deploy until reviewed"): costing/w1-approved-run-labels → costing/au4-normal-budget (4 files); retarget to main before deploy.
- No database writes; September unchanged (LOCKED, not closed); cron 60/61 paused.

## 2026-10-19 07:18: W1 + W5 + run 122/128 re-baseline INSTALLED LIVE (approved 07:12)
- Migrations 20261019014458 w1_approved_run_feed_and_labels, 20261019014611 w5_fingerprint_fixed_columns, 20261019014728 w5_rebaseline_runs_122_128 (reference USER-APPROVAL-20261019-W1-W5-REBASELINE). Files unchanged except the approval reference.
- Feed live: Sep 122 = 634 (74/70 negative), Oct 128 = 627 (9/9). Labels and governed comparison as tested. 0 existing objects changed by W1.
- W5: only the 2 fingerprint functions + purpose check changed. Run 122 and 128 now verify with 0 drift; re-baseline log 2 rows (50/50 and 51/51 identical).
- Not done: September close, refresh, cron (60/61 still paused), merge. Evidence: evidence/W1_W5/W1_W5_LIVE_INSTALL_2026-10-19.md.

## 2026-10-19 06:20: W1 + W5 built and tested LOCALLY (approved 18 Oct 22:44; no live change)
- proposals/consolidation/w1_w5/: prepared SQL (outside supabase/migrations), local test harness and W1_W5_LOCAL_TEST_REPORT.md.
- W1: approved-only price revision feed, per-month run status/labels, governed Cost-comparison view (old views unchanged). 6 views added, nothing else.
- W5: fingerprint on a recorded column list; governed re-baseline function + journal; prepared re-baseline of runs 122 (vs capture 4) and 128 (vs capture 11).
- Local tests 46/46 pass: feed Sep 122 = 634 (74/70 neg), Oct 128 = 627 (9/9); simulated drafts never reach the feed and are labelled; 128 unchanged, 122 clean after re-baseline, local Sep close accepted.
- Client branch `costing/w1-approved-run-labels` (d132edf, off this branch): run label badge + Cost comparison on governed view; node test 8/8. Not merged.
- No database writes, no apply_migration, no cron change, no merge.

## 2026-10-18 22:40: Consolidation plan (auditor reorientation; plan only)
- Verified via the GitHub API that commit 8ec5bee and both part-2 handover files are on remote `costing/au4-normal-budget`; raw URLs return 200. Repo URLs added to INDEX.
- proposals/consolidation/CLIENT_GOVERNED_WORKFLOW_PLAN.md:
  - Read-only inventory of 14 workflow steps (E/P/M).
  - Work packages: W1 approved-only selector/feed + badges, W5 fingerprint fix, W2 governed lifecycle RPCs + client buttons, W3 job 61 then job 60, W4 explainability.
  - Deferred: G4 switch-on, G5.
- Findings:
  - No lock or reopen RPC.
  - Designation and close are service_role only, with no client.
  - No RPC records a supersession authorisation.
  - The client Cost-comparison lens uses the run-mixing view.
  - September close is blocked by run-122 false fingerprint drift.
- Nothing built; no database writes.

## 2026-10-18 21:50: ChatGPT handover part 2 + read-only runs/cron/Sheets-feed findings
- archive/CHATGPT_HANDOVER_2026-10-18_PART2.md (full) and _PART2_SHORT.md cover everything after 42d3f89: AU-9 decisions P20–P29, G1–G3, R1 → R2, G4 live with the switch OFF, the simulation, open approvals and Sheets guidance.
- Read-only findings (21:45):
  - Job 60 only queues a run for an OPEN/DRAFT current month; job 61 only advances queued runs.
  - Runs are kept; the current-run pointer = APPROVED, else latest success.
  - Locked months cannot be rerun.
  - `v_cost_sheet_snapshot_sku_monthly_comparison` mixes runs (Oct: 475/648 SKUs differ from run 128).
- Proposed approved-only feed `costing.v_price_revision_feed_approved`, tested read-only and **NOT built** (user: "not yet"). proposals/price_revision_feed/.
- No database writes, no cron change, no Sheets.

## 2026-10-18 21:19: AU-9 G4 LIVE, switch OFF (20261018154911)
- Approved 21:17. Package applied unchanged. Two refresh RPCs patched as reviewed; all other function/view hashes identical; run 122/128 fingerprints identical.
- Run-128 recompute through the G4 path is identical (898/898). Switch empty; cron 60/61 paused; no cost change.

## 2026-10-18 21:05: AU-9 G4 built and tested locally (not installed)
- PREPARED_AU9_G4_plant_aware_loads.sql (md5 97a210fa…): plant-aware loads (P26 + T1, order P29), switch OFF by default, per-step provenance, guarded RPC patch.
- Local results:
  - OFF: 898/898 identical, ₹0 change.
  - ON (run 9001): matches the R2 simulation exactly.
  - Pools absorbed exactly; Oct/Sep protected; idempotent; provenance 11,539/11,539; 7 error paths fail closed.
- Live dry-check of the prechecks passes. G4_PLANT_AWARE_LOADS_BUILD_AND_LOCAL_TEST.md.

## 2026-10-18 20:15: AU-9 R2 LIVE (20261018144534)
- Approved 20:11. 77 corrected capacities applied unchanged. Run 122/128 fingerprints, function/view and load-factor hashes identical; cron 60/61 paused; readiness 74/74/3/20.
- P26 (grinder rule v2 + T1) is APPROVED-NOT-BUILT and supersedes P24. P27 is live and supersedes P25.

## 2026-10-18 18:45: AU-9 R2 prepared (corrected capacities; not applied)
- User 18:19 corrections plus Pills/wet/tank/throughput values. PREPARED_AU9_R2_capacity_corrections.sql (77 revisions) tested locally: replay/fingerprints identical, re-runnable; readiness would be 74/74/3/20.
- Throughput treatment options compared; T1 recommended (no time basis). G4 rule v2 simulated: median −0.12%, 17 SKUs >5% dearer, negative margins 9. R2_CAPACITY_CORRECTIONS_AND_G4_RESIMULATION.md.

## 2026-10-18 16:31: AU-9 R1 LIVE (20261018110111) + grinder rule approved (P24, not built)
- 50 capacity revisions applied unchanged; run 122/128 fingerprints, 1,554 function/view hashes and 898 run-128 load factors identical; runs/periods untouched; cron paused. Readiness 34/0/114. Evidence: evidence/AU9/AU9_R1_LIVE_APPLY_2026-10-18.md.

## 2026-10-18 16:40: AU-9 R1 prepared (user capacities; not applied)
- User 16:19/16:20: steel-drum grinders 8 kg (4–34), stone grinders 2 kg (41–44), Khalvam mechanised 2 kg/set (45–46), 13 water tanks are fermentation tanks. PREPARED_AU9_R1_capacity_revisions.sql (50 close+supersede revisions, effective 1 Nov, provisional) tested locally: replay/fingerprints identical, re-runnable.
- G4 simulation: proposed rule (Grinding 8 kg, Kajjali 2 kg) → median −0.08%, 22 SKUs >5% dearer (max +52%), negative margins unchanged at 9. R1_CAPACITY_REVISIONS_AND_G4_SIMULATION.md.

## 2026-10-18 16:08: AU-9 G1–G3 LIVE (20261018103837)
- Capacity master applied unchanged via apply_migration after the user's approval at 16:07: 6/33/171/188/17 objects; all profiles provisional from 1 Nov.
- Run 122/128 fingerprints, 1,550 function/view hashes and the 898 run-128 load factors identical before and after. Runs, periods and designations untouched; cron 60/61 paused. Machine hard-delete is now blocked (approved). Evidence: evidence/AU9/.

## 2026-10-18 15:45: AU-9 G1–G3 finalised and tested locally (not applied)
- User approvals at 15:36 recorded (P20–P23). PREPARED_AU9_G1_G3_capacity_master.sql: 5 tables, 1 view, triggers, 171 provisional profiles, 17 fallback rows, with prechecks and post-checks.
- Local test on a copy of the live schema: run-128 load and cost replay identical; run 122/128 fingerprints unchanged; re-run idempotent; 16 guard tests pass. See G1_G3_LOCAL_TEST_REPORT.md.
- DVS-1 recorded as a prepared policy version, not wired (not identical to run 128).
- Found pre-existing run-122 fingerprint drift caused by the 18 Oct column addition; values unchanged.

## 2026-10-18 (afternoon): AU-9 seasonality and machinery capacity review (PREPARE-ONLY)
- proposals/au9_seasonality_capacity/: architecture and migration proposal, prepared SQL (not applied), 101-SKU classification (8 master / 47 event / 35 recurring / 11 unexplained), DVS-1 policy simulation (median −0.09% vs run 128), 171-machine inventory and backfill CSV, user value list, capacity sensitivity (grinder capacity is the dominant lever).
- No live writes, migrations, merges or Sheet edits. Runs 122 and 128 were read only.

## 2026-10-18 14:30: Documentation consolidation and auditor handover
- Added INDEX.md (current state and file map), POLICY_REGISTER.md (19 policies with status), archive/CHATGPT_HANDOVER_2026-10-18.md (+ _SHORT).
- DECISIONS log: missing entries for 16–18 Oct added; AU-6A exponent marked SUPERSEDED; resolved OPEN items marked; consolidated open-items list.
- PARKED_BACKLOG: statuses refreshed (AU6Q/AU6S/AU6-PKG); new rows AU2-P01, AU6L-P02, MKT-P01/P02, SKU-P01, PREV-P01, PRC-P02, AU7-P02, AU8-P03.
- No live writes, merges or Sheet edits.

## 2026-10-18 14:18: October closed (lock + approval)
- October period and 16 Oct valuation LOCKED (option A, guarded SQL like September; audit 13). Run 128 APPROVED (designation 4) with 4 notes. Run 122 fingerprint unchanged. Lock/reopen functions (option C) added to the backlog for November.

## 2026-10-18 13:13: Run 128 (0/37/590, 9 negative margins; costs identical to 127)
## 2026-10-18 13:11: 155 regional + 2 default acceptances re-accepted (ids 573–727, 131–132)
## 2026-10-18 10:16: Combined v2 live (20261018044644): QC per batch, kit/Kanji unit fix, equipment loads (provisional capacities), costing-only sales feed + seasonal rule. Kvatha 468/1340 inactive. Run 127 (0/137/490, 9)
## 2026-10-18 09:06: AU-6A power-exponent scaling rejected (SUPERSEDED by equipment loads)
## 2026-10-18 05:26: AU-6 bundle live: default-volume v2 (20261017235758), Abhraka 50 kg + 0.33 kg plan, recurring HO admin ₹5 L/mo (20261018000020); 59 qty + 204 regional acceptances; run 126. CF-1 approved for 1 Nov (not built)
## 2026-10-17 18:45: C1 inactivation (5 SKUs, audit 46–50)
## 2026-10-17 16:10: Run 125 (0/189/445)
## 2026-10-17 07:20–15:58: 841 October material-rate acceptances incl. 5 band C true rates; Tally auto-refresh withdrawn
## 2026-10-16 22:38: AU-5 insert-path fix (20261016170817); run 124. Run 123 had FAILED on the immutable trigger
## 2026-10-16 20:41: AU-5 batch-true installed (20261016150830/150908), rates from 1 Oct; October period opened
## 2026-10-16 20:10: AU-7 price proposal from run 122 (634 SKUs; no Sheet edit)
## 2026-10-16 20:07: September LOCKED; run 122 APPROVED (first APPROVED run)
## 2026-10-16 08:50–18:55: staff classifications, AU-2c BOM fixes, ledger engine link (20261016070413), SKU 1797 fixes, labour rate ₹128.02; runs 120 (failed), 121, 122
## 2026-10-16 07:31: Directive 2026-10-16 (cut-off for the 18 Oct auditor handover)

## 2026-10-19 (evening)
- DVS-1 prepared (closure/prepared/PREPARED_DVS1_demand_volume_selection.sql) and tested in isolation (closure/DVS1_BUILD_AND_TEST.md). NOT applied.
- CI-011 capacity exception register (74 machines, prioritised). CI-012 in-month effective-date design. CI-015 reconciliation worksheet. CI-034 logged (CURRENT_DATE-anchored sales cleaning view).

## 2026-10-19 (19:48 IST onward)
- LIVE: LB1 (22 heads APPROVED, ₹0) and DVS-1 installed with the switch OFF. Verified; see closure/LB1_DVS1_LIVE_APPLY_2026-10-19.md.
- Prepared and tested locally: CI-012 tiered no-backdating guard; CI-034 valuation-anchored basis status.
- User-facing items: the 15-machine capacity table and the 86-SKU DVS-1 review worksheet.

## 2026-10-19 20:20 IST: ChatGPT handover part 3
- archive/CHATGPT_HANDOVER_2026-10-19_PART3.md (full) and _PART3_SHORT.md: everything since 8ec5bee; approved policy, live state, prepared-not-applied and open items kept separate; what remains (gates, issues by severity, pending approvals, blocked, items to verify). POLICY_REGISTER P37/P38 status updated. No live change.

## 2026-10-20 — ChatGPT handover Part4 / lean architectural governance
- User binding direction: minimal future-proof cost allocation, avoid unwanted capacity complexity, hard-retire superseded executable architecture after tested approved migration; preserve immutable snapshots/migrations.
- Committed governing directive, closure implementation-rule amendment, master-programme update, issue-register note and full Part4 handover. All changes DOCS ONLY; no live Supabase or pricing client modifications; G2 open and G5/G6 not done.

### 2026-10-20 — Mobile-first server completion path
- Reconciled user-requested merge+new-refresh acceptance with existing mandate and closure rules. Recorded pre-merge tests, explicit approval boundaries, live post-deploy reconciliation and protected-run immutability. Identified held G2 SQL location conflict with `closure/prepared/` rule; BLOCK merge of experimental migration as-is. Recognised existing Technical Batch PostgreSQL 17 fixture path as a possible free verification route. Documentation updates only; no live deployment, refresh, merge or Sheets edits.

### 2026-10-20 — Approved production costing migrations applied
- Confirmed previously prepared TB1/TB2/TB3/TB5/TB6/TB7, LB1 and DVS1 OFF are already live. Applied `ci034_valuation_anchored_basis_status` (migration `20261020162105`) and `ci012_no_backdating_guard` (`20261020162117`) from exact prepared SQL through Supabase migration tool; both succeeded. Verified CI034 marker/function checksum; CI012 8 FORWARD_ONLY + 37 AUDIT_ONLY settings and 45 triggers, no audit rows; DVS1 remains OFF; historical runs 122 and 128 read-only status SUCCESS. Applied SQL and live evidence recorded in `closure/PROGRAMME.md` and `closure/evidence/CI012/`. G2 remains held and untested in PostgreSQL. Branch not merged, no refresh or Sheets work.


- **2026-10-21:** Owner-approved bounded G2 numerical release closure documented; corrected route161 and run136 finance evidence PASS. Proposed prospective route attestation explicitly separated as uninstalled future hardening. G6 security/negative tests and designation outstanding; no Sheets writes. See `closure/G2_BOUNDED_RELEASE_CLOSURE_2026-10-21.md`.


- **2026-10-21:** G6 **CLOSED / approved**: user-executed governed supersession run128→run136 (designation 7, governance audit 17), verified against live Supabase. Historical designation retained, one review retained; Sheets on hold for further instructions.


## 21 October 2026 — Prospective approval policy ACTIVE
Owner adopted mandatory **zero unresolved reviews** before future run approval. Live `costing.fn_w2_run_checks(bigint,text)` changed only the former unconditional `REVIEW_REQUIRED_RECORDED` pass to `NO_UNRESOLVED_REVIEWS` requiring `v_review=0`; diagnostic now explicitly requires zero. Both APPROVE and SUPERSEDE paths invoke this shared eligibility gate. Applied DDL captured byte-for-byte at `closure/evidence/G6/G6_APPLIED_ZERO_UNRESOLVED_APPROVAL_GUARD_20261021.sql`; live pg_get_functiondef md5 `9ee598acf646fdc2a04395154eea7b46`. Read-only verification on run136 shows one unresolved review => test FAIL as expected, but its historical approved designation id7 remains intact, run128 revoked id6 and earlier approval id4 preserved. **Prospective only; no retroactive revoke.** Governed acceptance of an estimate must be recorded before a subsequent successful refresh produces fully resolved effective cost-sheet statuses; do not falsify raw evidence. No refresh or Sheets integration performed.
