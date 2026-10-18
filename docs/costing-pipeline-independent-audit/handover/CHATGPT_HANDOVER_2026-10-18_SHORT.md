# Auditor handover: short version (18 Oct 2026, 14:30 IST)
Covers 16 Oct 07:31 IST (last directive) to now. Full version: `handover/CHATGPT_HANDOVER_2026-10-18.md`. Repo branch `costing/au4-normal-budget` (PR #72, not merged).

**Where things stand**
- **September:** locked; run 122 APPROVED. Its fingerprint has not changed (md5 ccb9c707…, 353,819 rows).
- **October:** locked; valuation date 16 Oct LOCKED; **run 128 APPROVED** at 14:18 IST on 18 Oct.
  - The October lock was a one-off guarded SQL, the same method as September ("option A"). There is no lock function yet.
- Runs 124–127 are not approved. Cron jobs 60 and 61 are paused. Nothing has been merged and no Sheet has been edited.

**Approved and live since 16 Oct**
- **Batch-true conversion cost (AU-5)** from 1 Oct. It is written when the run inserts its rows; the frozen snapshots are never updated.
- **Default sales volume v2:**
  - order: actual best month → approved assumption → new-product plan → small default
  - default-driven workload capped at 2% of the pool; more than 12 months on a default blocks the SKU.
- **Recurring HO admin provision**, ₹5 L a month. It is separate from Central Office Charges and due for review on 31 Mar 2027.
- **Abhraka Bhasmam**: batch 50 kg, with a plan of 0.33 kg a month.
- **October material rates**: 841 accepted. Band C true rates kept as entered: Chayilyam, Mathalam, Rasam, Gorochanam, Kuzhiyaana. Auto-refresh from Tally was withdrawn.
- **Inactivated**: 5 C1 SKUs (1617, 1538, 1481, 1401, 1705), and the Kvatha products 468/1340 with SKUs 1769/1770.
- **Combined v2:**
  - QC charged per batch.
  - Kit 865 and Kanji 878 unit fix.
  - Equipment-load scaling, with *provisional* capacities.
  - Costing-only sales feed: company-wide net, negatives set to 0.
  - Seasonal rule: steady SKUs use their best month; SKUs whose top 3 months are ≥60% of the year use the 12-month average (101 SKUs). The *60% threshold is provisional*.
- **Re-accepted** 155 low-risk regional-marketing rows and 2 default-volume rows. The 45 material rows and SKU 1771 were deliberately left out.
- **Superseded:** power-exponent route scaling (AU-6A), rejected on 18 Oct.

**Runs (blocked / review / ready, negative-margin SKUs)**

| Run | Result |
|---|---|
| 122 (Sep) | 0/146/488, 74 |
| 124 | 0/621/13, 35 |
| 125 | 0/189/445, 35 |
| 126 | 0/184/445, 37 |
| 127 | 0/137/490, 9 |
| 128 | 0/37/590, 9 |

- October pools total ₹72.85 L a month (September ₹67.85 L, plus the ₹5 L HO provision). All pools are fully absorbed.
- Example costs, run 122 → run 128: Mehasamani 113.37 → 7.47; Thampira 3,886.71 → 23.85; Abhraka 1 kg 10,525.57 → 5,532.41; Kit 839.91 → 57.20.

**Run 128 approval notes**
- Capacities are provisional.
- The 60% seasonal cut-off was chosen by Aryabhatta, not by the user.
- 37 open reviews are accepted as known exceptions: 2 prime-cost and 35 regional-marketing, each worth ≤0.2% of price.
- 9 SKUs with negative margins go to pricing review: 42, 43, 159, 193, 975, 1174, 1264, 1365, 1552.

**Open items**
- Approved but not built:
  - lock/reopen functions before the November close
  - monthly carry-forward (CF-1) and the 6-month manual-rate review from 1 Nov
  - AU-8 screens: carry-forward panel, provision register, RM BOM header save, regional-marketing acceptance
- Undecided:
  - confirm the capacities and the 60% threshold
  - the marketing-side regional basis for 865/878
  - the marketing-side 10-unit default
- Data and display fixes:
  - inactive SKU 1790 has a unit error
  - preview/explain functions still show unscaled factors
- Still open in the cost-head ledger: 40 provisional and 5 unresolved heads.

**Please verify independently**
- Run 122 fingerprint and run 128 pool absorption.
- The October lock guards against the September template; audit row 13; designation 4.
- The 5 band C true rates.
- How sensitive the seasonal set is to the threshold.
- Spot-check the equipment loads.
- Whether HO ₹5 L overlaps Central Office Charges (₹8.72 L a month).

**Sheets (you own them)**
- Regenerate the price proposal from **run 128** (627 SKUs, valuation 16 Oct LOCKED). The last proposal (AU-7) was built on run 122.
- Remove the 7 inactivated SKUs.
- Re-classify the 173 batch-overload holds.
- Replace the 33 September negative-margin SKUs with the 9 October ones, and add the 37 known exceptions.
- No Sheet edit is authorised by this note.
