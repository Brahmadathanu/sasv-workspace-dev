# AU-7 full-range price proposal from APPROVED run 122 (v1, 2026-10-16)
Source: server snapshots of run 122 only (control status, manufacturing COP, pricing bridge OK cost, selling-price bridge). Valuation date 10-Sep-2026, LOCKED. Run designation APPROVED. No Sheet edits, no live writes.
Rule (unchanged from A7): min MRP = OK commercial cost / (0.5·(1−contingency)/(1+GST) − 0.07); proposed OK MRP = ceil5(max(current OK MRP, min)). This is a proposal only, not an approved price.
Files: evidence/AU7/AU7_price_proposal_run122.{csv,xlsx}, AU7_SUMMARY.json, build.py (reproducible from the two read-only extracts).

## Coverage
634/634 active SKUs; every SKU has a current MRP policy. Per SKU: run id, valuation date/status, cost build-up, rate lineage (manual/review/stale/fallback line counts, volume basis), MRP/selling-policy ids, control status, flags, recommendation.

## Reconciliation vs the old sheet proposal
- 509 matched; 125 new (not in the 509); 0 missing; all 440 in the filtered set matched.
- Proposed vs old proposed: 196 same, 70 higher, 174 lower. 158 big moves (≥₹10 and ≥10%): 54 AU-5 holds, 74 under review, 30 self-funded.
- Big moves come mainly from the old sheet's provisional batch-corrected costs (A7F) on low-volume batch products (e.g. Thampira Chendooram 5 g: run 122 loaded cost 3,893 vs sheet 104). Run 122 still carries the batch overload, so the run-122 price is not usable for these products until AU-5. Lower costs elsewhere come from the ledger policy (interest excluded, fuel normal, repairs).

## Recommendations
SELF_FUNDED 143 (no material flags) · REVIEW 318 (manual rates, fallback valuation, negative margin) · HOLD_AU5 173 (132 SKUs of the A3 low-volume batch-overload products, 66 default-volume slow movers incl. Mehasamani; overlap counted once).
Flags: stale purchase rate 554, stock-valuation fallback 420, manual rate 141, negative margin 35 (the 33 + 2 prime-cost review).
