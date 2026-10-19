# Changelog: costing pipeline audit (branch costing/au4-normal-budget)
Newest first. All times IST. Details: DECISIONS_AND_OPEN_QUESTIONS.md, POLICY_REGISTER.md, handover/.

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
- contracts/PRICE_REVISION_FEED_CONTRACT_v1.md, written from the live view definitions:
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
- handover/CHATGPT_HANDOVER_2026-10-18_PART2.md (full) and _PART2_SHORT.md cover everything after 42d3f89: AU-9 decisions P20–P29, G1–G3, R1 → R2, G4 live with the switch OFF, the simulation, open approvals and Sheets guidance.
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
- Added INDEX.md (current state and file map), POLICY_REGISTER.md (19 policies with status), handover/CHATGPT_HANDOVER_2026-10-18.md (+ _SHORT).
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
