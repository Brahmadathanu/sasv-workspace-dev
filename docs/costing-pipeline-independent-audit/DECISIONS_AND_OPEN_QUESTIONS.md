
### 2026-10-16 20:05 IST — User decisions: first APPROVED run
- Check 25 signed off: key SKU costs accepted as presented; Mehasamani (879) a known exception pending the AU-5 batch-true fix; 33 flagged negative-margin SKUs to pricing review (evidence/run121_negative_margin_skus.csv).
- September 2026 valuation date (10 Sep) LOCKED via a guarded manual transition (no lock RPC exists; AU-2 backlog: rpc_lock/reopen_cost_period).
- Run 122 designated APPROVED (first APPROVED run); run 119 remains REFERENCE.

### 2026-10-18 — AU-6 prep (open, awaiting user approval)
- Abhraka Bhasmam standard batch = 50 kg (user). Prepared batch_size_ref revision (no BOM change); see evidence/AU5/AU6_ABHRAKA_BATCH50_AND_HO_ADMIN_2026-10-18.md.
- CF-1 monthly carry-forward + 6-month manual-rate review: policy draft POLICY_MONTHLY_CARRY_FORWARD_CF1.md; registered as AU8-P01 in docs/master-data-costing/PARKED_BACKLOG.md.
- HO admin Rs 5L/month provision missing since Aug (period-specific table). Recurring proposal registered as AU8-P02. OPEN: possible overlap with the Central Office Charges head.

### 2026-10-18 05:26 IST — AU-6 bundle approved and applied
- Applied: default-volume v2 (20261017235758), Abhraka batch ref 554 = 50 kg + plan 0.33 kg/month, recurring HO admin Rs 5L/month (20261018000020). Rerun 126 SUCCESS. 59 qty-driver + 204 regional acceptances recorded. Run 122 fingerprint unchanged. See evidence/AU6/AU6_APPLY_AND_OCT_RUN126_2026-10-18.md.
- CF-1 and the 6-month manual-rate review are approved for 1 Nov 2026. Design only; not activated.
- OPEN: QC allocation is volume-divided, which inflates low-volume SKUs (Kvatha Choornams x2.4, Abhraka QC Rs 1,121/kg). QC per-batch fix = AU-6Q (AU-7 is the price proposal).
- OPEN: a new run is needed for the acceptances to clear the run-126 review flags (user to decide).

### 2026-10-18 06:09 IST — AU-6Q QC per-batch: built and tested, NOT applied
- Prepared file proposals/au6q_qc_batch_true/PREPARED_au6q_qc_batch_true.sql. Local tests all pass. The run-126 replay is fully absorbed; negative-margin SKUs 37 -> 24.
- OPEN: Kvatha Choornam batch_size_ref 2 kg (products 468, 1340); SKU 865 kit conversion (275 Nos per pack?).

### 2026-10-18 08:14 IST: AU-6S RCA (read-only); open decisions
- Small batches: step factors are per batch regardless of mass, which is the root cause. Open: approve batch-size scaling Option B (small-batch only, recommended) or A (symmetric), so the writer hook can be built. QC stays per batch.
- Kit 865: the governed exception (1 Nos) is not used by the run writers (k = 275, so 61.9 instead of 0.225 batch equivalents/month, ~8% of POH/DL). Open: approve K1+K4 (kit only, effective 2026-10-01). K2 BOM clean-up is optional.
- Kanji 878: open question. Is the batch 50,000 g (100 packs)? This must be confirmed before 878 is activated.
- The kit fix and the scaling fix both raise everyone else's rates (~+9% each); simulate them combined before approval. Run 122 is not touched.

### 2026-10-18 08:34 IST: User decisions; AU-6 combined package BUILT (not applied)
- Route scaling: universal Option A (SYMMETRIC). Weight-driven steps scale, fixed-cycle steps do not, QC is not scaled. Kit K1+K4 approved; K2 only if needed (assessed: not needed). Kanji follows the same pattern.
- Kanji batch 50,000 = packs per batch (BMR SP718 50,000 Nos -> 50,052 x 500 g packets transferred). Batch ref kept.
- OPEN: SKU 878 sales feed (1,384 units/12 months) vs 59,286 packs dispatched in 2026. Ask the user about the sales unit, mapping or stock.
- Pending: user approval to apply the package (single migration via apply_migration), then the October rerun.


### 2026-10-18 09:06 IST: User rejects power-exponent scaling (AU-6A)
- Replacement: equipment-loads method (AU-6L), simulated read-only; awaits the user's capacity list. AU-6Q and kit/Kanji are unchanged.

### 2026-10-18 09:22 IST: User approves LOCAL build of combined v2 (AU-6Q + K1/K4 + AU-6L loads + SALES-01)
- Provisional capacities: grinder/sieve/tray dryer/firewood dryer/manual lot/tablet-capsule-pill 50 kg; planetary mixer 200 kg; puta 25 kg; vessel 220 kg/500 L; cooker 370 kg/500 L; fermentation tank 3,000 L. Kept in an editable, effective-dated config table.
- Sales feed for costing only: company-wide net, negatives to 0, no per-godown filter. Seasonal SKUs are sized on the 12-month AVERAGE (user decision). All from 1 Oct, each with its own switch; Sep run 122 unchanged.
- Built and replayed locally (evidence/AU6L/AU6L_COMBINED_V2_BUILD_AND_REPLAY_2026-10-18.md). NOT applied. Open: apply approval, seasonal threshold (0.60 used), capacity confirmation.
- Kanji flag resolved: costing sales feed IQR filter drops seasonal months; actual about 58.8k packs in 12 months (sales viewer 53,256 billed). OPEN: seasonal driver max month vs 12-month average.

### 2026-10-18 10:13 IST: User approves live install of combined v2, Kvatha 468/1340 inactivation and October rerun
- Applied as migration 20261018044644. Products 468/1340 and SKUs 1769/1770 are inactive (USER-DECISION-20261018-KVATHA-INACTIVATE). Run 127 SUCCESS, not approved. Run 122 unchanged.
- Open: the 204 regional-marketing acceptances no longer match after SALES-01 (fingerprint includes units); re-accept against run 127? There are also 3 qty-driver defaults (251, 1149, 1771).

### 2026-10-18 14:17 IST: User approves option A: lock October like September and approve run 128
- Done 14:18 IST: October LOCKED/LOCKED (valuation 16 Oct), audit 13; run 128 APPROVED via rpc_designate_costing_run with notes (provisional capacities, 60% seasonal cut-off, 37 reviews non-blocking, 9 negative margins to pricing). Runs 124–127 have no designation; cron 60/61 paused; run 122 fingerprint unchanged.
- Open: option C (lock/reopen RPCs) for November onward, now in the backlog; the 9 negative-margin SKUs go to pricing review; capacities to be confirmed.
