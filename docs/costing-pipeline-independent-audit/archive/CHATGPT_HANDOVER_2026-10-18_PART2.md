> **SUPERSEDED (24 Oct 2026) — see [../CURRENT_STATE.md](../CURRENT_STATE.md).** Dated history only; live-state statements below (approved runs 122/128/131/136/140, cron 60/61, the public price feed view) are out of date.

# Auditor handover, part 2 (18 Oct 2026, 21:50 IST)
**Covers:** everything after the last handover (`archive/CHATGPT_HANDOVER_2026-10-18.md`, commit `42d3f89`, 14:30 IST) up to 21:50 IST.
**Repo:** branch `costing/au4-normal-budget` (PR #72), **not merged**. Short version: `CHATGPT_HANDOVER_2026-10-18_PART2_SHORT.md`.
**Unchanged since part 1:**
- September locked, run 122 APPROVED; October locked (valuation 16 Oct LOCKED), run 128 APPROVED.
- Runs 124–127 unapproved. Cron jobs 60 and 61 paused.
- No refresh run, no cost change, no Sheet edit, no merge.

## 1. What happened (timeline, IST)
| Time | Event | Migration / commit |
|---|---|---|
| 15:15 | User brief: seasonality + machinery architecture (AU-9), prepare-only | 188d608 |
| 15:36 | User decisions P20–P23 (DVS-1, Kanji, machine classes, fallback); G1–G3 finalised and tested locally | 76a8f4f |
| 16:07 → 16:08 | **G1–G3 capacity master LIVE**, with machine-delete block | **20261018103837**, 514a7ec |
| 16:19–16:29 → 16:31 | User capacities (R1) and grinder rule P24 approved; **R1 LIVE** | **20261018110111**, e77932e / f529d7c |
| 18:19 | User **corrected** capacities + throughput machines; R2 prepared and tested; T1–T3 compared | cf9334a |
| 20:11 → 20:15 | **R2 LIVE** (supersedes R1); T1, Kajjali on the 3.2 kg khalvam, and grinder rule v2 approved | **20261018144534**, b0a0df1 |
| 20:46 → 21:05 | G4 built and tested locally | 5fe478b |
| 21:17 → 21:19 | **G4 installed LIVE with switch OFF** | **20261018154911**, 1832948 |
| 21:40–21:45 | Read-only investigation: cron 60/61, run supersession, current-run pointer, Sheets feed | this commit |
| 21:48 | User on the approved-only feed view: **"not yet"** | — |

- Every live change used Supabase MCP `apply_migration` with the reviewed file unchanged. The files live outside `supabase/migrations`, and none was applied with `db push`.
- Before and after each change: run 122 and 128 fingerprints were identical, as were all non-target function/view hashes and the run-128 load factors (898/898).
- Evidence: `evidence/AU9/`.

## 2. Approved policy (user decisions)
| ID | Policy | Status |
|---|---|---|
| P20 | **DVS-1 demand-volume selection** (approved override → launch average → in-stock average excluding confirmed events → approved demand-seasonal 12-month average → else max month). The **60% top-3 test becomes a review flag only** | Approved in principle 15:36. **Prepared, NOT wired**: it does not reproduce run 128 exactly (−0.09% median with all proposed events, −0.44% with none confirmed). P15 (60% rule, run 128 method) stays operative until gate G5 |
| P21 | **Kanji 878 demand-seasonal**, peak Jun–Aug, costed on the 12-month average (same as run 128) | Approved; recorded in the DVS-1 seed (not wired) |
| P22 | **Machine applicability classes**: stoves non-capacity, pumps utility, packing not costed for now; every machine gets a class | Approved and live (G1–G3) |
| P23 | **Class fallback policy**: until machine values arrive, the AU-6 V2 class defaults are the approved, explicit fallback; classes with no capacity row keep one load per step | Approved and live (G3); read by costing only through G4 |
| P24 | Grinder rule v1 (8 kg / 2 kg) | **Superseded** by P26 |
| P25 | R1 capacities | **Superseded** by P27 |
| P26 | **Grinder rule v2**: Rasoushadhi "Grinding" (and grinder 26) 20 kg; "Kajjali grinding" 3.2 kg khalvam; "Pill grinding" 3 kg; wet grinder 2 kg; pulverise/disintegrate/sieve on the 50 kg lot (T1) | Approved 20:11; installed live 21:19 with **switch OFF** |
| P27 | **R2 corrected capacities** (table below) | Approved and live 20:15 |
| P28 | **No time-based cost spreading** (user ban). Throughputs in kg/h are evidence and planning data only; no hours-per-load is stored (a post-check enforces this) | Standing rule |
| P29 | **G4 resolution order**: machine named on the route step/override > approved step rule by activity > approved class fallback. Fails closed (error, never a guess). Per-step provenance kept | Installed live, switch OFF |

**T1, how throughput machines are costed:** loads = batch kg ÷ 50 kg lot, exactly as today. No time element. Rated kg/h is kept for planning only.
- Rejected: T2, one load per batch (median +0.79%, 136 SKUs >5% dearer).
- Rejected: T3, kg per standard run, because it hides a time basis.

## 3. R2 user-corrected capacities (live, provisional, effective 1 Nov 2026)
Source: user, 18 Oct 18:19 IST ("user-corrected 2026-10-18 18:19").

| Machines | Plant ids | Value |
|---|---|---|
| Rasoushadhi steel-drum grinders | 4–34 | 20 kg max (22, 24, 28 not operational) |
| Rasoushadhi stone grinders | 41 / 42–44 | 10 kg (**41 = "first": assumption**) / 5 kg |
| Mechanised khalvam sets | 45, 46 | 3.2 kg per set (4 × 0.8 kg) |
| Pills grinders | 68–80 | 3 kg |
| Pills-area stone grinder | 81 | 3 kg (**assumption**) |
| Wet grinder | 174 | 2 kg |
| Fermentation tanks | 105–114, 156 / 159, 161 | 1,000 L / 500 L, working = rated (full) |
| Disintegrator | 2 | 28.33 kg/h (85 kg in 3 h): planning only |
| Semi-auto pulverisers | 127, 129, 131–135 | 5 kg/h (10 kg in 2 h): planning only |
| Horizontal sifters | 136, 137 | 9.43 kg/h (66 kg in 7 h): planning only |
| Round sifters | 138, 162 | 1.10 kg/h (22 kg in 20 h): planning only |

- 77 revisions were made by closing the old row and inserting a new one. The journal shows the history, e.g. grinder 4: default → R1 8 kg → R2 20 kg.
- 4 new equipment classes (DISINTEGRATOR, SEMI_AUTO_PULVERISER, VIBRO_SIFTER_HORIZONTAL, VIBRO_SIFTER_ROUND); 2 retired.
- **Readiness:** 74 ready-provisional · 74 needing values · 3 not operational · 20 not required.

## 4. Live database state now (new since part 1)
| Object | State |
|---|---|
| Capacity master (G1–G3) | 6 applicability classes, 33+4 equipment classes, `plant_capacity_profile` 171 open rows (298 total), revision journal, 17 fallback rows, readiness view. All provisional, effective 1 Nov 2026. `authenticated` has SELECT only |
| Machine hard delete | **Blocked** (FK); use retire once AU-8 is built |
| G4 | `plant_aware_load_switch` (**0 rows = OFF**; cannot take effect before 1 Nov 2026); `route_step_capacity_rule` (9 rules, P26 + T1); `route_step_load_provenance_snapshot` (0 rows); 5 `fn_au9_g4_*` functions (owner-only execute) |
| Patched refresh RPCs | `rpc_refresh_production_overhead_workload_snapshot` and `rpc_refresh_sku_direct_labour_component_split_snapshot` now call `fn_au9_g4_route_step_loads`. With the switch OFF this returns the legacy loads, so there is **no cost change** (live recompute of run 128: 898/898 identical) |
| Runs / periods / designations | Unchanged: 108 runs (max 128); designations 1 (REFERENCE 119), 2 (APPROVED 122), 4 (APPROVED 128) |
| Cron 60 / 61 | Paused |

## 5. G4 simulation vs run 128 ("as if G4 on", R2 + rule v2 + T1 + Kajjali 3.2 kg)
- Median COP **−0.12%**; **17 SKUs >5% dearer**, 0 >5% cheaper. Negative-margin SKUs stay at **9**; none clears and none is added.
- Top movers:
  - Manasamithra Vatakam 50 Nos +31% (₹46.93 → 61.52)
  - Vatharakshasan 1266 +28% (₹21.62 → 27.67)
  - Gopichandanadi Gulika +21%; Sudarsanam Gulika +19%
  - Sivanar Amritham 1157 +16% (₹41.84 → 48.58)
  - Dhanwantharam Gulika +15%; Rasagandhi Mezhuku +13%; Vilwadi Gulika +12%
  - Abhraka Bhasmam 1792 +9% (₹5,532 → 6,042); Abhraka Chendooram 937 +7%
- Kanji 878 −0.30%; Kit 865 −0.10%. Largest falls: Ksheerabala Thailam 41 A −1.3%, Dhanyamlam −1.2%.
- If Kajjali used the stone grinder at 10 kg instead, Vatharakshasan would rise +11% rather than +28%.
- Local G4 test (switch ON, simulated run 9001) matched this exactly. Pools were absorbed exactly; September and October dates were rejected; the run was idempotent; provenance was complete (11,539/11,539); all 7 error paths failed closed.

## 6. October is not rerun
- October is LOCKED and run 128 is APPROVED and immutable. G4, R2 and the step rules only take effect from 1 Nov 2026.
- Code check: a refresh request for a non-OPEN period raises an error. A new run in a period holding an APPROVED run also needs a supersession authorisation (none exist).

## 7. Read-only findings today (21:40–21:45)
Details: `proposals/price_revision_feed/RUNS_CRON_AND_SHEETS_FEED_FINDINGS_2026-10-18.md`.

- **Job 60** (02:00 IST daily) only *queues* a full refresh for the current month if the period exists, is OPEN, and has a DRAFT valuation date.
  - October: returns "not open". From 1 Nov: "not governed" until a November period exists.
  - Once November exists: one November run per day.
- **Job 61** (every 5 minutes) only *advances* queued runs, one stage per call (about 25 minutes per run). Left on, it creates nothing by itself but processes any toolbar-requested run.
- **Runs are kept, never overwritten.** `v_current_successful_costing_refresh_run` picks per period: the latest APPROVED run, else the latest successful run (REFERENCE ranks below a newer success).
  - Today: Jul 80, Aug 82 (unapproved latest), Sep 122, Oct 128 (approved).
  - Runs 124–127 remain stored and editable but are hidden by the pointer.
- **All pricing views follow that pointer**: detailed cost sheet, SKU control status, scheme comparison, selector, status diagnosis.
- **Gap, run-mixing view:** `public.v_cost_sheet_snapshot_sku_monthly_comparison` takes `max()` across all runs in a month. For October, 475/648 SKUs differ from run 128. Do not use it for pricing.
- **Gap, no approved-only feed:** "current" quietly shows unapproved runs for months without an approval (November would show each trial run). There is no latest-approved-month marker and no negative-margin flag.

**Proposed, NOT built** (user 21:48 "not yet"): `costing.v_price_revision_feed_approved`
- Latest APPROVED run per month only; never falls back. Security invoker.
- Columns: run id, approved at/by, `is_latest_approved_period`, SKU/pack, MRP IK/OK, material, DL, COP, loaded and pricing cost, selling prices, margins (₹, %), and IK/OK negative-margin flags.
- Tested read-only: Sep 122 = 634 SKUs (74 IK / 70 OK negative); Oct 128 = 627 SKUs (9/9).
- Draft: `proposals/price_revision_feed/PROPOSED_v_price_revision_feed_approved.sql`.

## 8. Provisional or assumed (not yet confirmed by evidence)
- All 171 capacity profiles are provisional (no fill-factor evidence).
- Stone grinder 41 as the "first" (10 kg) and Pills stone grinder 81 at 3 kg are assumptions; neither is used by a current route step.
- The 50 kg T1 lot is a convention.
- The 60% seasonal threshold in the run-128 method was chosen by Aryabhatta; under DVS-1 it becomes a review flag.
- DVS-1 demand events still need confirming.

## 9. Open authorisations and pending approvals
| Item | Needs |
|---|---|
| G4 switch ON from 1 Nov 2026 (one journalled row; affects every November refresh) | User approval, when November inputs are ready |
| Trial **non-designated** November run (job-61 window; cron 60 stays paused) | User approval |
| Approved-only Sheets feed view | User approval ("not yet" at 21:48) and ChatGPT confirmation of the columns |
| Fix the run-mixing monthly comparison view | User decision |
| Re-enable cron 60/61 for November | User decision; job 60 would create one run per day |
| DVS-1 wiring (G5), plant master governance (G6), AU-8 screens | Build approval |
| Fingerprint robustness (AU9-P07: column additions show false drift on run 122) | Design and approval |
| Data requests: machine values for 74 machines, Tally bulk party, promotion dates, 11 unexplained SKUs | User / client |
| Carried from part 1: lock/reopen functions before the November close; CF-1 carry-forward; 6-month manual-rate review; 865/878 marketing basis; 10-unit marketing default | As in part 1 |

## 10. What ChatGPT should audit or verify
1. Run 122 and run 128 fingerprints are unchanged against the part-1 values. Run 128 load factors (898) are identical through the G4 path with the switch OFF.
2. `plant_aware_load_switch` is empty; the 9 `route_step_capacity_rule` rows match P26 + T1; no `hours_per_load` value is stored.
3. The R2 capacity rows match the table in §3 and the user's 18:19 statement, and the journal shows the close/supersede pairs (77 + 77).
4. Only the two named refresh RPCs changed in 20261018154911 (evidence hashes in `evidence/AU9/AU9_G4_LIVE_INSTALL_SWITCH_OFF_2026-10-18.md`).
5. The T1 reasoning: confirm no hidden time basis.
6. The Kajjali 3.2 kg khalvam choice versus stone 10 kg (Vatharakshasan +28% vs +11%).
7. The proposed feed view logic (approved-only, latest designation per run, REVOKED handled through the effective designation view).
8. The run-mixing finding on `v_cost_sheet_snapshot_sku_monthly_comparison`.

## 11. Sheets implications (ChatGPT owns Sheets; no Sheet edit is authorised here)
- Still to do, as in part 1: regenerate the price proposal from **run 128** (627 SKUs, valuation 16 Oct LOCKED). Drop the 7 inactivated SKUs; use the 9 October negative-margin SKUs and the 37 known exceptions.
- **Source only from approved runs.** Use the period's APPROVED run, and filter `refresh_run_id` = 128 explicitly until the approved-only feed exists.
  - Do not use `v_cost_sheet_snapshot_sku_monthly_comparison`; it mixes runs.
  - Do not rely on "current" views for months without an approval.
- The G4 simulation shows the November direction (17 SKUs >5% dearer) but is **not** an approved cost. Do not put it in a price plan until a November run is approved.
- Once the feed view exists (if approved), the Sheet can pull `costing.v_price_revision_feed_approved where is_latest_approved_period` and update automatically only when the user approves a run.
