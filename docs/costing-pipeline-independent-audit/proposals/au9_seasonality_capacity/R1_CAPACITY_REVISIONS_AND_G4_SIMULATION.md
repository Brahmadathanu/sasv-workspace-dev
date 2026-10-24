# AU-9 R1: user-supplied capacities, prepared revisions and G4 cost simulation (18 Oct 2026, 16:40 IST)
Status: **READ-ONLY / PREPARE-ONLY.** The revision SQL is tested locally and **not applied live**. Nothing in costing changed.

**Inputs from the user**
- 16:19 IST:
  - Rasoushadhi steel-drum grinders: 8 kg maximum per charge.
  - Stone grinders: 2 kg.
  - Khalvam sets 45–46 are **mechanised**: 4 units × 500 g = 2 kg per set.
- 16:20 IST: the 13 water tanks in the fermentation area **are** used as fermentation tanks.

## 1. Which machines the values cover (`data/r1_machine_mapping.csv`)
| Group | Plant ids | Count | Value prepared |
|---|---|---|---|
| Steel-drum Rasoushadhi grinders ("Grinder 1–31", Rasoushadhi Grinding Area) | 4–34 (22, 24, 28 are status N) | 31 | 8 kg rated, 8 kg working (provisional) |
| Stone grinders (Rasoushadhi) | 41–44 | 4 | 2 kg / 2 kg |
| Mechanised khalvam sets | 45, 46 | 2 | 2 kg per set; UNKNOWN → capacity-based production |
| Fermentation tanks, 1,000 L by name | 105–114, 156 | 11 | rated 1,000 L; **working volume / fill % needed** |
| Fermentation tanks, 500 L by name | 159, 161 | 2 | rated 500 L; fill % needed. Also logged as FG bulk storage |

Correction: earlier notes listed 156 as a 500 L tank. Its name says 1,000 L.

**Working capacity versus maximum.** There is no evidence for a fill factor: the 31 grinders have no work logs. So working = 8 kg is kept as provisional. If the drum is normally run below its maximum (for example 75% = 6 kg), a BMR or trial value should replace it.

**Ambiguous or not covered**
| Plant ids | Machine | Question |
|---|---|---|
| 81 | "Stone Grinder" in the **Pills** grinding area | Is it the same 2 kg stone grinder? Not applied |
| 68–80 | Pills "Grinder 1–13" | Same names as the Rasoushadhi grinders, but a different area, and their logs are in Nos. Are they steel-drum 8 kg too? Not applied |
| 174 | Wet grinder (Vessels and Cookers) | kg per charge needed |
| 2, 127, 129, 131–135 | Disintegrator and pulverisers | Throughput machines (kg/h); not covered by these values |
| 136–138, 162 | Vibro sifters | Throughput machines (kg/h); not covered by these values |

## 2. Prepared revision SQL: `PREPARED_AU9_R1_capacity_revisions.sql`
**What it does, for 50 machines:**
1. **Close** the G2 row. Because it has not taken effect yet, it is closed with effective_to = effective_from (1 Nov), i.e. voided before effect.
2. **Insert** a superseding row, still effective 1 Nov 2026 and provisional:
   - Grinders, stone grinders and Khalvam: evidence USER_DECLARED, "user-supplied 2026-10-18 16:19 IST …".
   - Tanks: evidence NAME_DERIVED, with the user's confirmation of use.
3. The trigger journal records each change as CLOSE + SUPERSEDE.

**Other changes**
- New equipment classes MECHANISED_KHALVAM_SET, FERMENTATION_TANK_1000L and FERMENTATION_TANK_500L. The old KHALVAM_MANUAL_LEVIGATION and WATER_TANK_USED_AS_FERMENTATION classes are marked inactive.
- **One schema change, to an AU-9 table only:** `pcp_dates` becomes `effective_to >= effective_from`. This allows the zero-length (void) row. Void rows never cover any date (tested).

**Safety**
- Prechecks: the 50 targets must be exactly the reviewed G2 rows, or exactly the R1 rows on a re-run. A dry check on live passes (50/50, all effective 1 Nov).
- Post-checks:
  - 171 open profiles; 50 revised
  - exactly 50 CLOSE + 50 SUPERSEDE
  - all profiles provisional; nothing effective before 1 Nov
  - every existing function/view and the run 122/128 fingerprints unchanged

**Local test** (on the live-schema copy with G1–G3 applied; logs in `tests/test_r1_*.log`)

| Test | Result |
|---|---|
| Apply | 221 rows (171 open + 50 void); 36 equipment classes (34 active); journal 288 |
| Readiness after | READY_PROVISIONAL 34 (28 grinders + 4 stone + 2 Khalvam) · NOT_OPERATIONAL 3 · BLOCKED_NEEDS_CAPACITY 114 (incl. 13 tanks) · NOT_REQUIRED 20 · UNCLASSIFIED **0** |
| Run-128 replay at 16 Oct and 30 Nov | 898/898 identical |
| Run 122/128 fingerprints, function/view hashes | identical |
| Re-run | No-op; state md5 identical |
| One covering profile per machine at 30 Nov | 171 / 171 |
| Edit a void row; overlap | Rejected |
| Partial state | Precheck aborts |

## 3. Cost simulation: "as if G4 were wired" (run 128 copy, offline)
- **Model:** the same as before. Batch-true DL/POH shares with pool totals fixed. It reproduces all 898 run-128 factors exactly with today's capacities.
- **Grinder steps in run 128:** 1,023 POH steps (and 1,023 matching DL steps). Only **297 name a machine**:
  - 290 → disintegrator 2
  - 6 → Grinder 26 (plant 29)
  - 1 → wet grinder 174

  The other **726 are class-only**.

**Proposed fallback rule for class-only grinder steps** (to be put into `capacity_fallback_policy` per activity/area at G4):

| Route step location / activity | Steps | Capacity used |
|---|---|---|
| Pulverizer section (pulverisation, disintegration, sieving) and juice-extraction wet pulverisation | 910 | stays on the 50 kg class default (throughput machines; values not supplied) |
| Rasoushadhi Grinding Area, activity "Grinding" | 62 class-only + 6 linked | **8 kg** (steel drum; 31 of the 37 machines there) |
| Activity "Kajjali grinding" | 13 | **2 kg** (stone grinder or khalvam: both 2 kg, so the choice of machine does not matter) |
| Pills grinding | 29 | stays 50 kg until the Pills grinders are answered |
| Hydraulic crushing, Vennei homogenisation, wet grinder 174 | 3 | 50 kg default |

That rule affects 47 products.

| Scenario | Median COP | SKUs >5% cheaper / dearer | Negative margins (run 128: 9) |
|---|---|---|---|
| **A. Proposed rule** (Grinding 8 kg, Kajjali 2 kg) | −0.08% | 0 / 22 | 9 (no change) |
| B. Strict: only the 6 steps naming a machine | −0.01% | 0 / 2 | 9 |
| C. All Rasoushadhi grinding at 8 kg (incl. Kajjali) | −0.06% | 0 / 20 | 9 |
| D. All Rasoushadhi grinding at 2 kg (bound) | −0.23% | 0 / 34 | 9 |
| E. A + fermentation at 1,000 L tanks (bound) | −0.11% | 0 / 21 | 9 |

**Biggest movers under A** (COP per unit, run 128 → A)

| SKU | Pack | Run 128 | A | Change |
|---|---|---|---|---|
| 1266 Vatharakshasan Gulikai | 50 Nos | ₹21.62 | ₹32.83 | +52% |
| 1157 Sivanar Amritham | 10 g | ₹41.84 | ₹56.53 | +35% |
| 1792 Abhraka Bhasmam | 1 kg | ₹5,532 | ₹7,147 | +29% (50 kg batch = 7 charges of 8 kg instead of 1) |
| 937 Abhraka Chendooram | 5 g | ₹34.69 | ₹42.76 | +23% |
| 1275 Rasagandhi Mezhuku | 10 g | | | +21% |
| 979 Mandoora Chendooram | 5 g | | | +19% |

- **Everyone else** becomes slightly cheaper. The largest falls are Ksheerabala Thailam 41 A 10 mL −0.8% and Dhanyamlam −0.75%.
- **Kanji 878:** −0.19%. **Kit 865:** −0.06%.
- **The 9 negative-margin SKUs** move between −0.8% and +0.13%; none clears and none is added.
- **Fermentation tanks:** they matter little. Even pricing every fermentation step at 1,000 L moves the median only 0.03 points more.

Files: `data/g4_capacity_simulation_summary.csv`, `data/g4_capacity_simulation_per_sku.csv`.

## 4. What remains for G4
1. **Build** `fn_route_step_loads_v2` and the switch, with lineage. Extend `capacity_fallback_policy` to match on activity/area, implementing the rule above, so the 726 class-only steps resolve explicitly.
2. **User answers still needed:**
   - Stone grinder 81 and Pills grinders 68–80.
   - Wet grinder 174.
   - Pulveriser, disintegrator and sifter throughput (or confirm they stay on the 50 kg default).
   - Tank working volume / fill %.
   - Whether the 8 kg drum is filled to the maximum (a BMR value).
3. **Approve the fallback rule** (Grinding 8 kg, Kajjali 2 kg, everything else on today's default).
4. **Test G4** on a non-designated November run before any approval. The expected effect is scenario A: about 22 Rasoushadhi/Siddha SKUs 5–52% dearer, everyone else slightly cheaper.

## 5. What the live apply of R1 would do (needs your go-ahead)
One `apply_migration` named `au9_r1_capacity_revisions`, using the file unchanged, in a single transaction:
1. Prechecks.
2. Relax `pcp_dates` on `plant_capacity_profile`.
3. Add 3 equipment classes and deactivate 2.
4. Write 50 void-before-effect closures and 50 superseding provisional profiles (journal +100).
5. Post-checks. Readiness becomes 34 ready-provisional and 0 unclassified.

No cost, run, snapshot or period changes. Costing does not read these tables until G4.
