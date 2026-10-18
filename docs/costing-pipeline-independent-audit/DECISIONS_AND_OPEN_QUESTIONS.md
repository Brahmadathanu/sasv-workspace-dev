
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

