# Changelog: costing pipeline audit (branch costing/au4-normal-budget)
Newest first. All times IST. Details: DECISIONS_AND_OPEN_QUESTIONS.md, POLICY_REGISTER.md, handover/.

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
