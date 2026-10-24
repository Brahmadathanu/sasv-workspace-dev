# AU-9 R2: corrected capacities, throughput treatment and G4 re-simulation (18 Oct 2026, 18:45 IST)
Status: **READ-ONLY / PREPARE-ONLY.** `PREPARED_AU9_R2_capacity_corrections.sql` is tested locally and **not applied live**. No cost changed. R1 (live since 16:31) stays in place until R2 is approved.

Source: user, 18 Oct 18:19 IST. The R1 values (8 kg / 2 kg / 2 kg per khalvam set) were wrong.

## 1. Mapping (77 machines; all provisional, effective 1 Nov 2026)
| Machines | Plant ids | New value | Note |
|---|---|---|---|
| Rasoushadhi steel-drum grinders | 4–34 | 20 kg max = working (provisional) | No fill-factor evidence. 22, 24, 28 not operational |
| Rasoushadhi stone grinders | 41 | 10 kg | **"First" = Stone Grinder 1, the lowest id**: please confirm |
| | 42–44 | 5 kg | |
| Mechanised khalvam sets | 45, 46 | 3.2 kg per set (4 × 0.8 kg) | |
| Pills area grinders | 68–80 | 3 kg | |
| Stone Grinder (Pills area) | 81 | 3 kg | **Assumption**, flagged |
| Wet grinder (Vessels and Cookers) | 174 | 2 kg | |
| Fermentation tanks | 105–114, 156 / 159, 161 | 1,000 L / 500 L, working = rated (full) | |
| Disintegrator | 2 | 28.33 kg/h (85 kg in 3 h) | rated throughput |
| Semi-automatic pulverisers | 127, 129, 131–135 | 5 kg/h (10 kg in 2 h) | rated throughput |
| Horizontal sifters | 136, 137 | 9.43 kg/h (66 kg in 7 h) | rated throughput |
| Round sifters | 138, 162 | 1.10 kg/h (22 kg in 20 h) | rated throughput |

- **Throughput machines:** the user's "kg in h" statement is kept word for word in the evidence. These machines are recorded as **rated throughput for capacity planning only**. Hours per load is left blank, and the SQL checks that no time basis is stored.
- **New equipment classes:** DISINTEGRATOR, SEMI_AUTO_PULVERISER, VIBRO_SIFTER_HORIZONTAL and VIBRO_SIFTER_ROUND. The combined PULVERISER_DISINTEGRATOR and VIBRO_SIFTER classes are retired.

## 2. Revision SQL and local test
**How it works.** Each machine's current not-yet-effective row (50 R1 rows, 27 G2 rows) is closed as void-before-effect. A superseding row is then inserted with evidence "user-corrected 2026-10-18 18:19 IST". No schema change is needed.

**Safety checks**
- Prechecks: the 50 R1 targets and 27 G2 targets must be exactly as reviewed, or all 77 already R2 on a re-run. A dry check on live passes (50 / 27 / 171 open).
- Post-checks:
  - 171 open profiles; 77 revised
  - exactly 77 CLOSE + 77 SUPERSEDE in the transaction
  - all rows provisional; nothing effective before 1 Nov
  - no hours per load recorded
  - all existing functions/views and the run 122/128 fingerprints unchanged

**Local test results** (logs `tests/test_r2_*.log`)

| Test | Result |
|---|---|
| Run-128 replay at 16 Oct and 30 Nov | 898/898 identical |
| Fingerprints and function/view hashes | identical |
| Re-run | No-op; state md5 identical |
| One covering row per machine at 30 Nov | 171 / 171 |
| Partial state; edit of a superseded row | Rejected |
| Readiness after | **74 ready-provisional · 74 need values · 3 not operational · 20 not required** |
| Journal | Shows the history, e.g. grinder 4: G2 → R1 8 kg → R2 20 kg |

## 3. Throughput machines: how to cost them without spreading by time
| Option | Rule | Time element | Effect vs run 128 (with the R2 grinder rule) |
|---|---|---|---|
| **T1 (recommended)** | Pulverising, disintegrating and sieving steps stay on today's 50 kg weight lot | **None.** Loads = batch kg ÷ 50 | Median −0.12%; 17 SKUs >5% dearer; 0 >5% cheaper; negative margins 9 |
| T2 | One load per batch, whatever its size | None | Median +0.79%; 136 SKUs >5% dearer; negative margins 11 (160, 1279 new) |
| T3 | Load = batch kg ÷ kg per standard run (85 / 10 / 66 kg) | **Hidden time basis.** A "run" is defined by hours, so loads become proportional to machine hours | Median −0.43%; Dhanyamlam, Ksheerabala and Vaattu Kashayam −23 to −33%; 47 SKUs >5% cheaper |
| T3b | As T3, with sieving on the round sifter (22 kg) | Same as T3 | Median −0.39%; negative margins 7 |

**Recommendation: T1.**
- T3 is time-based spreading in disguise, and it swings costs by up to 33%.
- T2 removes batch-size scaling, which pushes 136 SKUs up and creates 2 new negative margins.
- T1 keeps today's weight-lot basis. The throughputs stay on record for capacity planning, and a measured kg-per-charge can replace the 50 kg lot later.
- T1's 50 kg lot is still a provisional convention, not a measured value.

## 4. G4 grinder rule v2 (replaces the 16:29 rule, which used the wrong capacities)
| Route step | Rule v2 |
|---|---|
| Steps naming Grinder 26 (plant 29) | 20 kg |
| Steps naming wet grinder 174 | 2 kg |
| Rasoushadhi Grinding Area, "Grinding" | **20 kg** (steel drum) |
| "Kajjali grinding" | **3.2 kg, mechanised khalvam (proposed)**. Alternatives: stone grinder 10 kg or 5 kg |
| "Pill grinding" | **3 kg** |
| Pulverisation, disintegration, sieving, wet pulverisation | 50 kg default (T1) |
| Hydraulic crushing, Vennei homogenisation | 50 kg default |

**Why khalvam for Kajjali.** Kajjali (mercury–sulphur trituration) is traditionally made in a khalvam. These products are small batches, and 3.2 kg is the purpose-built mechanised set. Using the stone grinder at 10 kg instead lowers Vatharakshasan's increase from +28% to +11%. Please confirm.

## 5. Re-simulation "as if G4 on" vs run 128
COP per unit, ₹ (run 128 → scenario):

| Scenario | Median | >5% dearer / cheaper | Neg. margins | Vatharakshasan 1266 | Sivanar Amritham 1157 | Abhraka Bhasmam 1792 | Abhraka Chendooram 937 | Kanji 878 | Kit 865 |
|---|---|---|---|---|---|---|---|---|---|
| R1 rule (superseded) | −0.08% | 22 / 0 | 9 | 21.62 → 32.83 (+52%) | 41.84 → 56.53 (+35%) | 5,532 → 7,147 (+29%) | +23% | −0.19% | −0.06% |
| **R2 recommended (rule v2 + T1, Kajjali 3.2 kg)** | **−0.12%** | **17 / 0** | **9** | 21.62 → 27.67 (+28%) | 41.84 → 48.58 (+16%) | 5,532 → 6,042 (+9%) | +7% | −0.30% | −0.10% |
| R2 with Kajjali on stone 10 kg | −0.11% | 14 / 0 | 9 | +11% | +9% | +9% | +7% | −0.27% | −0.09% |
| R2 with Kajjali on stone 5 kg | −0.11% | 16 / 0 | 9 | +19% | +12% | +9% | +7% | −0.29% | −0.10% |

**Other top movers under the recommendation** (Pills grinding at 3 kg):

| SKU | Pack | Change |
|---|---|---|
| Manasamithra Vatakam | 50 Nos | +31% (₹46.93 → ₹61.52) |
| Gopichandanadi Gulika | 100 Nos | +21% |
| Sudarsanam Gulika | 50 Nos | +19% |
| Dhanwantharam Gulika | 100 Nos | +15% |
| Rasagandhi Mezhuku | 10 g | +13% |
| Vilwadi Gulika | 100 Nos | +12% |

- **Largest decreases:** Ksheerabala Thailam 41 A −1.3% and Dhanyamlam −1.2%.
- **The 9 negative-margin SKUs** move between −1.3% and +0.04%; none clears and none is added.

Files: `data/g4_r2_capacity_simulation_summary.csv`, `data/g4_r2_capacity_simulation_per_sku.csv`.

## 6. What the live apply of R2 would do (needs go-ahead)
One `apply_migration` named `au9_r2_capacity_corrections`, using the file unchanged:
1. Prechecks.
2. Add 4 equipment classes and retire 2.
3. Void the 77 current not-yet-effective rows and insert 77 corrected provisional rows (journal +154).
4. Post-checks.

No schema change, no cost change (costing reads none of this until G4), no runs, snapshots or periods touched.

## 7. What remains for G4
1. Build the plant-aware load function `fn_route_step_loads_v2` with its switch, and extend the fallback policy to match on activity and area (rule v2).
2. Test on a non-designated November run.
3. Get the user decisions listed in the report.
