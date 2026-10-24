# Run 127 safe re-acceptance (user approved 2026-10-18 13:08 IST)
Approval quote: "Re-accept only the 155 safe regional rows and the 2 safe defaults". Volume rule unchanged: best month for steady SKUs, 12-month average for seasonal ones.
Ref: USER-APPROVAL-20261018-RUN127-SAFE-REACCEPT. Done 13:11 IST, acting as user dff17104 in one transaction with exact-count guards (`live/reaccept_run127_safe.sql`).

## Path used
The governed review RPCs for these two queues, the same ones used for the original 263:
- `costing.rpc_accept_regional_marketing_review(127, sku, region, ...)`
- `costing.rpc_accept_sales_allocation_quantity_driver_review(127, sku, ...)`

`rpc_accept_material_review_action` covers RM/PM material-rate review items, not these queues, so it was not used. The reference is carried in acceptance_reason and acceptance_note.

## Result
| Item | Count | IDs |
|---|---|---|
| Regional rows (class a, from `live/regional_acceptance_vs_run127.csv`) | **155** / 98 SKUs, all now READY | 573–727 |
| Qty defaults | **2**: SKU 251 at 6.219/month, SKU 1149 at 8.35/month | 131, 132 |
| Not accepted (by instruction) | 45 material regional rows, qty default 1771, 4 Kvatha rows | |

- Guards passed: the list held 155 distinct rows; all 155 were eligible in the run-127 queue; both defaults were REVIEW under policy 7; no excluded SKU was accepted. There were no mismatches.
- An earlier attempt failed on a temp-table permission error before anything was written; nothing was written (verified 0 rows).
- Note: the 155 include SKU 1771's **OK** regional row (default 10 units, unchanged). The user's quote names the 155, so it is included. SKU 1771's quantity default and its IK regional row were not accepted.

## Effect
- The run-127 queues show the change now: regional 1,209 READY / 45 REVIEW; quantity driver 56 READY / 1 REVIEW (1771).
- The **run-127 control counts are frozen** (snapshots are immutable). They change only in a new run. No rerun was done.

| Run 127 control | Now | After a rerun (same evidence) |
|---|---|---|
| Blocked | 0 | 0 |
| Prime-cost review | 8 | **2** (Brihat Chagaladi Ghritham 1771, 1772) |
| Pricing-bridge review | 129 | **35** |
| Ready | 490 | **590** |

Open review list after a rerun (37 SKUs): 1771/1772 (qty default) plus the 35 SKUs with material regional rows. Of those 35:
- 19 sold their whole year in one month: Hridayasanthi, Udarasudha, Vathamarmakan, Arjun Forte, Artiban Forte, Jumbolene, Vallarai, Hridayamohini, Kadaleekalpa 100 g, Karunai Lehyam 10 kg, Peenasakesari 5 L, Koottu Kuzhambu 10 L, Karpasasthyadi Kuzhambu 5 L, Chinchadi Kuzhambu 5 L, Chemparathyadi Keram 5 L, Triphaladi 1 kg, Nagaradi Lepa 1 kg, Chukku Podi 1 kg, and Brihat Chagaladi 150 mL (IK row).
- 4 have marketing cost per unit up more than 10%: Kazharchi 100 g, Avuri 100 g, Palandava Keram 450 mL, Orithalthamarai 100 g.
- The rest are large unit moves: Udwarthana, Kottamchukkadi, Bala Thailam 450 mL, Siroreksha, Chundaivattal, Eladi, Inchi, Kazharchi 50 g, Panchadeepakkini 50/100 g, Thayirchundi, Poonaikkali, Aswagandhadi 1 kg.

The projection assumes a rerun at the same valuation date reproduces the same evidence fingerprints.

## Controls
- Run 122 fingerprint before and after: ccb9c7072fc386ed13fbbbe6e4d8ab6b, 353,819 rows, run row 547983c7 (identical).
- Jobs 60/61 inactive.
- Run 127 not approved or locked; designations are 119 REFERENCE and 122 APPROVED only.
