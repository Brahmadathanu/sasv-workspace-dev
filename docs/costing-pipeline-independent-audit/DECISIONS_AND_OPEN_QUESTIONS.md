# Decisions and open questions (costing implementation, PR #72)
Approver for every decision: Dr. Brahmadathan U (GOV-015). Times are IST. Earlier decisions (D-001 to D-024, to 16 Oct 07:46) are in this file on the audit branch `docs/costing-pipeline-independent-audit`. Policy status summary: POLICY_REGISTER.md.

## 2026-10-18 21:17 IST: G4 installed live with the switch OFF
- User: "install G4 live with the switch OFF". Applied unchanged at 21:19 (20261018154911).
- Only the two refresh RPCs changed, as reviewed. All other functions and views are identical, and run 122/128 fingerprints are identical.
- Run-128 load factors recomputed through the patched path are identical (898/898). Switch is empty (OFF); cron 60/61 paused.
- Evidence: evidence/AU9/AU9_G4_LIVE_INSTALL_SWITCH_OFF_2026-10-18.md.
- Pending user approval when November inputs are ready:
  1. Switch ON from 1 Nov 2026. It applies by valuation date, so it also covers the designated November run unless voided.
  2. A job-61 window for a trial non-designated November run.

## 2026-10-18 20:46 IST: G4 built and tested locally (not installed)
- User: "build G4 and test it locally" (local only).
- Built `PREPARED_AU9_G4_plant_aware_loads.sql`: switch (installed OFF, cannot start before 1 Nov 2026), 9 step rules (P26 + T1), resolver with resolution order P29, per-step provenance, and a guarded patch of the two refresh RPCs.
- Local tests passed:
  - OFF: run 128 identical, ₹0 change.
  - ON (simulated November run): identical to the R2 re-simulation (median −0.12%, 17 SKUs >5% dearer, 9 negative margins).
  - Pools absorbed exactly; October protected; idempotent; provenance 100%; error paths fail closed.
- Open, for the user:
  1. Install G4 live (switch stays OFF).
  2. Turn the switch ON from 1 Nov for a trial non-designated November run. The switch applies by valuation date, so it would also cover the designated November run unless voided.
  3. A job-61 window for the trial.

## 2026-10-18 20:11 IST: R2 approved and applied; G4 rule v2 and T1 approved
- User: "apply R2 live, throughput machines on the 50 kg lot (T1), Kajjali on the 3.2 kg Khalvam, grinder rule v2".
- R2 applied live at 20:15 (20261018144534). Fingerprints, hashes and load factors unchanged; readiness 74/74/3/20. Evidence: evidence/AU9/AU9_R2_LIVE_APPLY_2026-10-18.md.
- Approved-not-built for G4 (P26), superseding the 16:29 rule (P24):
  - Rasoushadhi "Grinding" and Grinder 26: 20 kg
  - "Kajjali grinding": 3.2 kg khalvam
  - "Pill grinding": 3 kg
  - Wet grinder 174: 2 kg
  - Pulverising, disintegrating and sieving: 50 kg lot (T1, no time element)
  - Everything else: default
- Assumptions, provisional and not objected to: stone grinder 41 is the "first" one (10 kg); Pills stone grinder 81 is 3 kg.

## 2026-10-18 18:19 IST: corrected capacities from the user (R2, prepared only)
- R1 values were wrong. New values: grinders 4–34 20 kg; stone grinders first 10 kg (mapped to 41) and others 5 kg; khalvam 3.2 kg per set; Pills grinders 3 kg (81 assumed); wet grinder 174 2 kg; tanks full capacity; throughputs disintegrator 85 kg/3 h, pulveriser 10 kg/2 h, horizontal sifter 66 kg/7 h, round sifter 22 kg/20 h.
- Standing rule: no time-based spreading (P28). Throughputs are recorded for planning only. Recommended T1: keep throughput steps on the 50 kg weight lot. T3 (kg per standard run) is a hidden time basis.
- Prepared: R2 SQL tested locally (not applied); grinder rule v2 proposed (P26). The 16:29 rule needs re-approval with the corrected values.

## 2026-10-18 16:29 IST: R1 live apply and grinder rule approved
- User: "apply the 50 capacity revisions live and approve the grinder rule (Grinding 8 kg, Kajjali 2 kg, rest default)".
- R1 applied at 16:31 as 20261018110111; all before/after checks identical; readiness 34 ready-provisional / 0 unclassified / 114 needing values (evidence/AU9/AU9_R1_LIVE_APPLY_2026-10-18.md).
- Grinder rule recorded as P24, APPROVED-NOT-BUILT, for G4.
- Still open: stone grinder 81, Pills grinders 68–80, wet grinder 174, pulveriser/sifter throughput, tank fill %, and whether 8 kg is the working charge.

## 2026-10-18 16:19–16:20 IST: user capacity answers (R1, prepared only)
- Rasoushadhi steel-drum grinders 8 kg maximum per charge (mapped to plants 4–34); stone grinders 2 kg (41–44); Khalvam sets 45–46 mechanised, 2 kg per set; the 13 water tanks (105–114, 156 at 1,000 L; 159, 161 at 500 L) are used as fermentation tanks.
- Open: stone grinder 81 and Pills grinders 68–80 (same names, Pills area), wet grinder 174, pulveriser/sifter throughput, tank fill %, whether 8 kg is the working charge. Proposed G4 fallback rule: Grinding 8 kg, Kajjali 2 kg, otherwise the current default (needs approval).

## 2026-10-18 16:07 IST: AU-9 G1–G3 live apply approved and done
- User: "Yes, apply G1–G3 live with the machine-delete block". Applied at 16:08 as 20261018103837; all checks identical (evidence/AU9/AU9_G1_G3_LIVE_APPLY_2026-10-18.md). Machine hard-delete block accepted.

## 2026-10-18 15:36 IST: AU-9 decisions (user)
- **Approved:** DVS-1 evidence-based demand policy, with the 60% rule as a review flag only (P20); Kanji 878 demand-seasonal Jun–Aug on the 12-month average (P21); machine classes, i.e. stoves non-capacity, pumps utility, packing not costed for now (P22); current class defaults as the approved fallback until machine values arrive (P23); build G1–G3 with no cost change.
- **Still open (answered 16:19/16:20, see above):** are water tanks 105–114, 156, 159, 161 used as fermenters? Are Khalvam sets 45–46 a tool or an asset? Both stay UNKNOWN and provisional in the backfill.
- **Done 15:45 (prepare-only):** G1–G3 package finalised and tested locally (replay identical, run 122/128 fingerprints unchanged, re-runnable). DVS-1 recorded as a prepared policy version, NOT wired because it does not reproduce run 128 exactly. Not applied live; the live apply needs the user's go-ahead.
- **Finding:** `fn_verify_run_fingerprint(122)` shows 1 drifted table (`sku_sales_allocation_basis_snapshot`). The cause is the nullable column added by 20261017235758. The values were verified unchanged (re-hash = captured md5). Backlog AU9-P07.

## Consolidated status (18 Oct 2026, 14:30), which supersedes the "OPEN" notes in older entries below
**Closed:** September (run 122 APPROVED) and October (run 128 APPROVED; period and 16 Oct valuation LOCKED via option A).

**Resolved since the entries were written**
- The HO admin ₹5 L is separate from Central Office Charges (user, 18 Oct).
- QC per batch: live.
- Kvatha batch 2 kg: products made inactive.
- SKU 865 kit conversion: live (K1+K4).
- Kanji 878 batch: 50,000 packs.
- Kanji sales gap: costing-only feed.
- Seasonal driver: 12-month average when top 3 months ≥ 60%.
- 204 regional acceptances: 155 re-accepted; 45 material rows left as known exceptions.
- Defaults 251/1149: re-accepted. 1771: left open.
- Run-126 flags: cleared by runs 127/128.
- Route scaling option A/B: SUPERSEDED by equipment loads.

**Open (current list)**
1. Provisional capacities (13 of 16 rows): user to confirm.
2. The 60% seasonal threshold (executor's choice): user to confirm. Also confirm that one-month sellers should get the 12-month average.
3. 37 known exceptions in run 128: revisit in November.
4. 9 negative-margin SKUs (42, 43, 159, 193, 975, 1174, 1264, 1365, 1552): pricing review.
5. The regional-marketing basis still uses 275/500 units for 865/878.
6. The marketing-side 10-unit default is undecided.
7. Inactive SKU 1790: FG transfer unit error (108 Pkt valued as 108,000 Nos).
8. Preview/explain functions show unscaled route factors (display only).
9. Build before November: CF-1 carry-forward plus the 6-month manual-rate review (approved), and lock/reopen functions (option C, approved direction). Each needs build and apply approval.
10. AU-8 UI items: CF-1 panel, provision register, RM BOM header save, regional acceptance surface.
11. Cost-head ledger: 40 PROVISIONAL and 5 UNRESOLVED heads; PF/ESI; POH behaviour split.
12. Sheets: an October price proposal from run 128 (ChatGPT).

### 2026-10-16 20:05 IST — User decisions: first APPROVED run
- Check 25 signed off: key SKU costs accepted as presented; Mehasamani (879) a known exception pending the AU-5 batch-true fix; 33 flagged negative-margin SKUs to pricing review (evidence/run121_negative_margin_skus.csv).
- September 2026 valuation date (10 Sep) LOCKED via a guarded manual transition (no lock RPC exists; AU-2 backlog: rpc_lock/reopen_cost_period).
- Run 122 designated APPROVED (first APPROVED run); run 119 remains REFERENCE.

### 2026-10-16 ~20:30 IST: AU-5 batch-true approved and installed
- "Approve AU-5 with re-based rates: install switched off now, prepare October period and run." Migrations 20261016150830 and 20261016150908. Labour v3 and POH v2 rate rows APPROVED from 1 Oct (USER-APPROVAL-AU5-REBASED-20261016). October period opened (audit 11). Run 122 unchanged.

### 2026-10-16 ~23:00 IST: AU-5 insert-path fix (run 123 failed)
- Run 123 failed at stage 03: a post-step UPDATE hit the immutable POH snapshot trigger. Fix 20261016170817: batch-true workload is written at insert. Run 124 SUCCESS (0/621/13). The 612 material reviews come from acceptances being scoped to the period; AU-5 did not cause them.

### 2026-10-17 07:20–15:58 IST: October rate-quality decisions
- R1/R2 carry rules approved (645 accepted). 175 rule defaults; 10 band C new items; 4 user-confirmed; 2 BOM-confirmed (SRM002, Nandukkal). Total **841** ACTIVE.
- **Band C true rates (R4):** Chayilyam ₹32,000/kg, Mathalam ₹240 and Rasam ₹35,000 are known future purchase rates. Gorochanam ₹16.79 L/kg is a true past purchase. Kuzhiyaana ₹30 with BOM 59 Nos confirmed.
- R3 auto-refresh from Tally WITHDRAWN (Tally can lag real purchase prices).

### 2026-10-17 16:10 / 18:45 IST: Run 125; default-volume hierarchy; C1 inactivation
- Run 125 SUCCESS (0/189/445). The 117 qty-driver reviews came from acceptances being period-scoped.
- C1: SKUs 1617, 1538, 1481, 1401, 1705 inactive (USER-DECISION-20261017-C1-INACTIVATE; audit 46–50).
- Default-volume v2 proposed; approved 18 Oct 05:26.

### 2026-10-18 — AU-6 prep [RESOLVED: applied 05:26]
- Abhraka Bhasmam standard batch = 50 kg (user). Prepared batch_size_ref revision (no BOM change); see evidence/AU5/AU6_ABHRAKA_BATCH50_AND_HO_ADMIN_2026-10-18.md.
- CF-1 monthly carry-forward + 6-month manual-rate review: policy draft POLICY_MONTHLY_CARRY_FORWARD_CF1.md; registered as AU8-P01 in docs/master-data-costing/PARKED_BACKLOG.md.
- HO admin Rs 5L/month provision missing since Aug (period-specific table). Recurring proposal registered as AU8-P02. OPEN: possible overlap with the Central Office Charges head.

### 2026-10-18 05:26 IST — AU-6 bundle approved and applied
- Applied: default-volume v2 (20261017235758), Abhraka batch ref 554 = 50 kg + plan 0.33 kg/month, recurring HO admin Rs 5L/month (20261018000020). Rerun 126 SUCCESS. 59 qty-driver + 204 regional acceptances recorded. Run 122 fingerprint unchanged. See evidence/AU6/AU6_APPLY_AND_OCT_RUN126_2026-10-18.md.
- CF-1 and the 6-month manual-rate review are approved for 1 Nov 2026. Design only; not activated.
- OPEN: QC allocation is volume-divided, which inflates low-volume SKUs (Kvatha Choornams x2.4, Abhraka QC Rs 1,121/kg). QC per-batch fix = AU-6Q (AU-7 is the price proposal).
- OPEN: a new run is needed for the acceptances to clear the run-126 review flags (user to decide).

### 2026-10-18 06:09 IST — AU-6Q QC per-batch: built and tested [later LIVE in combined v2, 10:16]
- Prepared file proposals/au6q_qc_batch_true/PREPARED_au6q_qc_batch_true.sql. Local tests all pass. The run-126 replay is fully absorbed; negative-margin SKUs 37 -> 24.
- OPEN: Kvatha Choornam batch_size_ref 2 kg (products 468, 1340); SKU 865 kit conversion (275 Nos per pack?).

### 2026-10-18 08:14 IST: AU-6S RCA (read-only) [scaling options SUPERSEDED 09:06; kit K1+K4 LIVE 10:16]
- Small batches: step factors are per batch regardless of mass, which is the root cause. Open: approve batch-size scaling Option B (small-batch only, recommended) or A (symmetric), so the writer hook can be built. QC stays per batch.
- Kit 865: the governed exception (1 Nos) is not used by the run writers (k = 275, so 61.9 instead of 0.225 batch equivalents/month, ~8% of POH/DL). Open: approve K1+K4 (kit only, effective 2026-10-01). K2 BOM clean-up is optional.
- Kanji 878: open question. Is the batch 50,000 g (100 packs)? This must be confirmed before 878 is activated.
- The kit fix and the scaling fix both raise everyone else's rates (~+9% each); simulate them combined before approval. Run 122 is not touched.

### 2026-10-18 08:34 IST: User decisions; AU-6 combined package BUILT [SUPERSEDED: the symmetric power-exponent scaling (AU-6A) was rejected 09:06; the kit/Kanji decisions stand]
- Route scaling: universal Option A (SYMMETRIC). Weight-driven steps scale, fixed-cycle steps do not, QC is not scaled. Kit K1+K4 approved; K2 only if needed (assessed: not needed). Kanji follows the same pattern.
- Kanji batch 50,000 = packs per batch (BMR SP718 50,000 Nos -> 50,052 x 500 g packets transferred). Batch ref kept.
- OPEN: SKU 878 sales feed (1,384 units/12 months) vs 59,286 packs dispatched in 2026. Ask the user about the sales unit, mapping or stock.
- Pending: user approval to apply the package (single migration via apply_migration), then the October rerun.


### 2026-10-18 09:06 IST: User rejects power-exponent scaling (AU-6A) [AU-6A SUPERSEDED]
- Replacement: equipment-loads method (AU-6L), simulated read-only; awaits the user's capacity list. AU-6Q and kit/Kanji are unchanged.

### 2026-10-18 09:22 IST: User approves LOCAL build of combined v2 (AU-6Q + K1/K4 + AU-6L loads + SALES-01)
- Provisional capacities: grinder/sieve/tray dryer/firewood dryer/manual lot/tablet-capsule-pill 50 kg; planetary mixer 200 kg; puta 25 kg; vessel 220 kg/500 L; cooker 370 kg/500 L; fermentation tank 3,000 L. Kept in an editable, effective-dated config table.
- Sales feed for costing only: company-wide net, negatives to 0, no per-godown filter. Seasonal SKUs are sized on the 12-month AVERAGE (user decision). All from 1 Oct, each with its own switch; Sep run 122 unchanged.
- Built and replayed locally (evidence/AU6L/AU6L_COMBINED_V2_BUILD_AND_REPLAY_2026-10-18.md). NOT applied. Open: apply approval, seasonal threshold (0.60 used), capacity confirmation.
- Kanji flag resolved: costing sales feed IQR filter drops seasonal months; actual about 58.8k packs in 12 months (sales viewer 53,256 billed). OPEN: seasonal driver max month vs 12-month average.

### 2026-10-18 10:13 IST: User approves live install of combined v2, Kvatha 468/1340 inactivation and October rerun
- Applied as migration 20261018044644. Products 468/1340 and SKUs 1769/1770 are inactive (USER-DECISION-20261018-KVATHA-INACTIVATE). Run 127 SUCCESS, not approved. Run 122 unchanged.
- Open: the 204 regional-marketing acceptances no longer match after SALES-01 (fingerprint includes units); re-accept against run 127? There are also 3 qty-driver defaults (251, 1149, 1771).

### 2026-10-18 12:57 / 13:08 IST: Acceptance re-check and safe re-acceptance
- Read-only re-check against run 127 with a materiality rule: units ±25%, marketing cost per unit ≤10% or ≤₹0.25, impact ≤0.5% of price.
- User: "Re-accept only the 155 safe regional rows and the 2 safe defaults" (USER-APPROVAL-20261018-RUN127-SAFE-REACCEPT; ids 573–727, 131–132). The 45 material rows, SKU 1771's default and the Kvatha rows were NOT accepted.

### 2026-10-18 13:12 IST: Rerun October
- Run 128 SUCCESS: 0/37/590, 9 negative margins. Costs identical to run 127.

### 2026-10-18 14:14 IST: Close with sanctioned functions only: STOPPED
- No lock RPC exists (only rpc_close_cost_period → CLOSED/FINAL). Nothing changed. Options A/B/C given (evidence/AU6L/AU6L_OCT_CLOSE_STOPPED_2026-10-18.md).

### 2026-10-18 14:17 IST: User approves option A: lock October like September and approve run 128
- Done 14:18 IST: October LOCKED/LOCKED (valuation 16 Oct), audit 13; run 128 APPROVED via rpc_designate_costing_run with notes (provisional capacities, 60% seasonal cut-off, 37 reviews non-blocking, 9 negative margins to pricing). Runs 124–127 have no designation; cron 60/61 paused; run 122 fingerprint unchanged.
- Open: option C (lock/reopen RPCs) for November onward, now in the backlog; the 9 negative-margin SKUs go to pricing review; capacities to be confirmed.
