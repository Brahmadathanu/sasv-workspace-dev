# Auditor handover, part 2: short version (18 Oct 2026, 21:50 IST)
**Covers:** after the last handover (commit 42d3f89, 14:30 IST). Full version: `handover/CHATGPT_HANDOVER_2026-10-18_PART2.md`. Branch `costing/au4-normal-budget` (PR #72), not merged.
**Unchanged:** Sep locked, run 122 APPROVED; Oct locked, run 128 APPROVED; runs 124–127 unapproved; cron 60/61 paused. No refresh, no cost change, no Sheet edit, no merge.

**Approved policy (user)**
- **P20 DVS-1 demand policy:** approved in principle but **NOT wired** (it does not reproduce run 128). The 60% top-3 rule becomes a review flag only. The run-128 method stays operative until gate G5.
- **P21 Kanji 878:** demand-seasonal Jun–Aug, costed on the 12-month average.
- **P22 machine classes:** stoves non-capacity, pumps utility, packing not costed for now.
- **P23 fallback:** the current class defaults are the approved fallback until machine values arrive.
- **P26 grinder rule v2:**
  - Rasoushadhi Grinding 20 kg; Kajjali on the 3.2 kg khalvam; Pills grinding 3 kg; wet grinder 2 kg.
  - Pulverise/disintegrate/sieve on the 50 kg lot (**T1, no time basis**).
- **P28:** no time-based cost spreading; kg/h is for planning only.
- **P29:** G4 resolution order is named machine > step rule > class fallback; fails closed; per-step provenance.
- P24 and P25 (the R1 rule and values) are superseded.

**Live now**
- **G1–G3 capacity master** (20261018103837): 171 machines with effective-dated, append-only profiles and a journal, all provisional from 1 Nov. Machine hard-delete is blocked.
- **R2 corrected capacities** (20261018144534; R1 20261018110111 superseded):

| Machines | Value |
|---|---|
| Steel-drum grinders 4–34 | 20 kg |
| Stone grinders 41 / 42–44 | 10 / 5 kg |
| Khalvam 45–46 | 3.2 kg per set |
| Pills grinders 68–80 (and 81) | 3 kg |
| Wet grinder 174 | 2 kg |
| Fermentation tanks | full (1,000 / 500 L) |
| Disintegrator, pulverisers, sifters | rated kg/h, planning only |

- **Readiness:** 74 ready-provisional / 74 need values / 3 not operational / 20 not required.
- **G4 plant-aware loads** installed with the **switch OFF** (20261018154911, commit 1832948):
  - Only the two refresh RPCs changed. The run-128 recompute is 898/898 identical, so **no cost change**.
  - Run 122/128 fingerprints are unchanged.

**G4 simulation vs run 128** (not an approved cost):
- Median −0.12%; 17 SKUs >5% dearer, 0 cheaper; negative margins stay at 9.
- Top movers: Manasamithra +31%, Vatharakshasan +28% (+11% if Kajjali used the stone grinder at 10 kg), Gopichandanadi +21%, Sudarsanam +19%, Sivanar Amritham +16%, Abhraka Bhasmam +9%.
- Kanji −0.30%, Kit −0.10%.

**October is not rerun.** It is locked and run 128 is approved. Code blocks refreshes for non-OPEN periods and needs a supersession authorisation where an approved run exists. G4 takes effect from 1 Nov only.

**Today's read-only findings**
- **Job 60** (02:00 IST daily) queues one full refresh for the current month, only if the period exists, is OPEN, and has a DRAFT valuation date. October: no-op. November: no-op until the period exists, then one run per day.
- **Job 61** (every 5 minutes) only advances queued runs, one stage per call (about 25 minutes per run); it never creates runs.
- **Runs are kept, never overwritten.** The pointer `v_current_successful_costing_refresh_run` picks the latest APPROVED run per month, otherwise the latest successful run. All pricing views read this pointer.
- **Gaps:**
  1. No approved-only feed: months without an approval show unapproved runs, and November trials would appear.
  2. `v_cost_sheet_snapshot_sku_monthly_comparison` mixes all runs in a month (475/648 October SKUs differ from run 128).
- **Proposed, NOT built** (user: "not yet"): `costing.v_price_revision_feed_approved`, latest APPROVED run only, with a latest-month marker and negative-margin flags. Tested read-only: Oct 128 = 627 SKUs, 9 negative.

**Provisional / assumed:**
- All capacities.
- 41 = "first" stone grinder; 81 = 3 kg.
- The 50 kg T1 lot.
- The 60% threshold (Aryabhatta's choice).
- DVS-1 demand events.

**Pending user approval:**
- G4 switch ON from 1 Nov and a non-designated November trial (job-61 window).
- Feed view.
- Fix of the run-mixing view.
- Cron 60/61 for November.
- G5 DVS-1 wiring; fingerprint robustness (AU9-P07); lock/reopen functions before the November close.
- Machine values for 74 machines.

**Please audit:**
- Run 122/128 fingerprints; switch empty; the 9 step rules = P26 + T1; no hours stored.
- R2 rows vs the user's 18:19 values; only the 2 RPCs changed.
- The T1 reasoning; Kajjali 3.2 vs 10 kg.
- The feed-view logic; the run-mixing finding.

**Sheets (you own them; no edit authorised here)**
- Still regenerate the price proposal from **run 128**.
- Use approved runs only: filter `refresh_run_id = 128` until the feed exists.
- Do not use the monthly comparison view, and do not use the G4 simulation as prices.
