# AU-9 Seasonality and Machinery Capacity: architecture and migration/backfill proposal
> **Update 18 Oct 15:45 IST:** decisions 1, 2, 3 and 6 approved by the user (15:36). G1–G3 are finalised in `PREPARED_AU9_G1_G3_capacity_master.sql` and tested locally (`G1_G3_LOCAL_TEST_REPORT.md`). DVS-1 is recorded as a prepared policy version (`PREPARED_AU9_DVS1_policy_version.json`) and is **not wired** (it does not reproduce run 128 exactly). Decisions 4–5 (water tanks, Khalvam) remain open.

Prepared 18 Oct 2026 (IST) by Aryabhatta. **READ-ONLY / PREPARE-ONLY.** No live writes, no migrations, no Sheets, no merges. Run 128 (APPROVED, October LOCKED) and run 122 were read only. All simulations ran offline on copies of the run-128 extracts.

| File | What it holds |
|---|---|
| `PREPARED_AU9_seasonality_capacity_schema.sql` | Prepared DDL (not applied; parses as 23 statements; ends in ROLLBACK) |
| `data/seasonality_sku_classification.csv` | The 101 statistical seasonals plus the 27 master-seasonal SKUs outside the 101, with evidence |
| `data/seasonality_policy_simulation_summary.csv`, `…_per_sku.csv` | Policies P0–P4 against run 128 |
| `data/seasonality_threshold_diagnostic.csv` | The 60% rule at thresholds 0.5–0.8 (diagnostic only) |
| `data/plant_machinery_inventory_backfill.csv` | All 171 plant records with proposed class, unit, basis, evidence, readiness and flags |
| `data/user_supplied_capacity_values_needed.csv` | The values we need from you, grouped by equipment class |
| `data/capacity_cost_sensitivity.csv` | Cost sensitivity of run 128 to the capacity values |
| `scripts/` | Reproducible analysis code. Inputs are read-only extracts of run 128; the queries are described in §7. |

---
## 1. Key findings

### A. Seasonality
1. **The Product Master seasonality flag means *manufacture* season, not *demand* season.**
   - What it drives: `products.is_seasonal` and `season_profile_id` feed `v_sku_seasonal_attrs.manufacture_months`, the supply plan (`v_forecast_plan_12m` uses `y_supply`) and RM season overlays. Product-kind profiles cover mostly June–November (herb availability).
   - Fit with demand: of the 35 master-seasonal SKUs, only 8 are among the 101 SKUs that the 60% rule treats as seasonal. The other 27 have flat demand.
   - The reverse gap: Karkkidaka Kanji 500 g (SKU 878) sells ~100% of its year in Jun–Jul 2026 (28,444 + 30,838 units; prior-year top-3 share 99.9%) but is **not** flagged in the master.
   - Governance gap: the season tables have open authenticated CRUD, with no audit and no triggers. `product_season_override` has 0 rows.
2. **The 101 SKUs flagged by the 60% rule are mostly explained by events, not seasonality.**

| Four-way class (101) | SKUs | Main evidence |
|---|---|---|
| Master-seasonal | 8 | Kayathirumeni / Peenasakesari / Asavenna / Kayarajanka 5 L and Siddha oils |
| Exceptional event | 47 | Single-day bulk lines (probably institutional orders), March 2026 launch stocking, repeated stock-outs, sporadic sellers |
| Statistical only (recurring pattern) | 35 | Prior-year top-3 ≥ 50% in the same months ±1. About 19 have no other explanation (DVS-1 "demand seasonal") |
| Unexplained | 11 | 56, 340, 652, 839, 1039, 1079, 1251, 1253, 1261, 1269, 1279 |

   Primary reasons: bulk single day 36, supply constraint 21, new launch 16, unexplained 11, recurring 9, master 8.
   - **Promotions:** free-goods share showed no spikes, and `scheme_policy_rules` has no grouping.
   - **Missing data:** sales data has **no customer/party field**, so institutional orders can only be inferred from single-day lines and godown. Confirming them needs a Tally party extract (data request D1).
3. **Cost impact against run 128 is small, except for Kanji.**

| Policy | SKUs changed | Total monthly units | DL / POH rate × | Median COP | Max COP | Negative margins (run 128: 9) |
|---|---|---|---|---|---|---|
| P0 run 128 (60% rule) | 0 | 251,327 | 1.000 / 1.000 | 0 | 0 | 9 |
| P1 master flag only | 115 | 276,643 | 1.232 / 1.379 | −3.6% | −20.3% | 8 (1552 clears) |
| P2 max month for all 101 | 101 | 281,328 | 1.252 / 1.400 | −3.8% | −21.4% | 8 |
| **P3 DVS-1 (evidence-based, proposed)** | 68 | 252,152 | 1.004 / 1.004 | **−0.09%** | −0.63% | 9 (no change) |
| P4 master-or-recurring → average | 58 | 254,158 | 1.012 / 1.012 | −0.29% | −2.4% | 8 |

   - **Why P1 and P2 move so much:** almost all of the effect comes from Kanji. Its max month of 30,838 units replaces the 12-month average of 4,944, which inflates the common workload base (DL ×1.23, POH ×1.38) and so lowers every other SKU's conversion rate.
   - **DVS-1 on Kanji:** it keeps Kanji on the 12-month average. That is right for demand that is seasonal *and* recurring, where the plant runs one campaign a year.
   - **Bottom line:** DVS-1 reproduces run 128 within 0.1% (median) and adds lineage and governance.

### B. Machinery capacity
4. **The plant master (`public.plant_machinery`, 171 rows) cannot be authoritative yet.**
   - It has no capacity, unit or classification fields, and no audit.
   - The client (`js/plants.js`, `manage-plants.html`) does direct insert/update and **hard delete**.
5. **Costing barely links to machines today.**
   - Only 131 of the route-family steps carry a `plant_id`. That is 18 distinct machines; 14 machines are on cost centres.
   - Loads come from 13 class defaults in `costing.route_equipment_load_capacity` (provisional, AU-6 V2). Class fallback therefore stays essential, and it must become an explicit, approved policy rather than an implicit default.
6. **Rated capacity can be read from the name for only 36 machines.** These are the 22 fermentation tanks of 1,500/3,000 L, 13 water tanks of 1,000/500 L and PV 100 L.
   - Work logs record *product batch size*, not machine charge.
   - 49 machines have implausible values (≥ 50,000), and 21 machines log in Nos, including all the pills grinders.
   - **Conclusion:** logs are corroborating evidence, never the capacity source.
7. **Proposed classification of the 171 records:**

| Proposed applicability | Count | Notes |
|---|---|---|
| Capacity-based production | 151 | 148 need a user value. 3 are status N (22, 24, 28) and are not required while not operational |
| Capacity-based packing | 10 | Throughput recorded; not used by costing v1 |
| Non-capacity production | 7 | Stoves 166–168, 170–173 (capacity sits with the vessel on them) |
| Utility | 3 | Transfer pumps 143–145 |
| Non-production / unknown | 0 | Classes stay available for future assets |

   Readiness at backfill:
   - 36 READY_PROVISIONAL (name-rated)
   - 112 BLOCKED (need values)
   - 23 NOT_REQUIRED

   Flags:
   - 13 water tanks are typed "Fermentation Tank" and carry fermentation-scale logs. Is this a type mismatch, or are they used as fermenters?
   - 44 names are duplicated across locations.
   - 4 machines have status N.
8. **Capacity values matter much more than the seasonality policy.** Pool totals do not change; capacities shift workload between large-batch and small-batch products.

| Scenario (run 128 base) | Median COP | SKUs −>5% / +>5% | Max down / up | Negative margins |
|---|---|---|---|---|
| All capacities × 0.5 | 0.0% | 66 / 0 | −38.0% / +3.7% | 7 |
| All capacities × 2 | +1.3% | 0 / 152 | −3.8% / +53.4% | 11 |
| Grinder × 0.5 (25 kg) | −0.1% | 41 / 0 | −23.9% / +4.1% | 8 |
| Grinder 10 kg (levigation size) | −0.4% | 87 / 7 | −51.9% / +8.9% | 6 |
| Manual lot × 0.5 / 100 kg | −0.3% / +0.3% | 5/7 · 1/2 | ±13% / ±8% | 8 / 9 |
| Processing vessel × 0.5 | −0.5% | 2 / 2 | −8.8% / +22.0% | 8 |
| Dryer, filtration, extraction, fermentation, mixer, tablet, calcination, furnace × 0.5 | ≤ 0.35% | ≤ 1 each | within ±6% | 9 |

   - **Most sensitive:** grinder capacity matters most (455 POH steps run >1 load), then manual lot (748) and processing vessel (183).
   - **The decision to get right first:** the 31 Rasoushadhi levigation grinders (likely a few kg each) versus the 8 pulverisers (throughput) currently share one 50 kg grinder default.
   - Model check: the load model reproduces all 898 run-128 scaled factors exactly (0 mismatches).

---
## 2. Seasonality architecture (A)

### A1. Separate concepts
| Concept | Where | Used for |
|---|---|---|
| Manufacture season | Existing `products.is_seasonal`, `season_profile*` | Supply plan, RM overlays. **Unchanged** |
| Demand pattern | New `costing.product_demand_seasonality` (effective-dated: DEMAND_SEASONAL / NON_SEASONAL / UNDER_REVIEW, peak months, evidence) | Demand-volume selection |
| Exceptional demand events | New `costing.demand_event_register` (bulk/institutional, promotion, supply constraint, launch stocking, exhibition/festival, pre-buy, data correction; treatment; evidence; PROPOSED → CONFIRMED) | Excluding or capping event units |
| Governed override | New `costing.sku_demand_volume_override` (method, units, reason, approval, effective dates) | Last word for named SKUs |
| Statistical concentration | Existing 60% top-3 calculation | **Diagnostic only** (review flag) |

### A2. DVS-1: demand-volume selection policy (versioned in `costing.demand_volume_selection_policy`)
The first matching rule wins:
1. An approved override exists → use the override.
2. Launch within 12 months → average since first sale.
3. Confirmed demand events → recompute the max month excluding EXCLUDE_UNITS events. A month with a confirmed supply constraint → average of in-stock months.
4. `demand_pattern = DEMAND_SEASONAL` (approved) → 12-month average. Campaign manufacture absorbs one year's conversion cost.
5. Otherwise → the AU-5 default (max actual month) unchanged.
6. Diagnostics: if top-3 ≥ 0.6 and none of steps 1–4 applied, set flag `DEMAND_CONCENTRATION_UNEXPLAINED` (REVIEW_REQUIRED, not a blocker), so the SKU goes to review rather than to an automatic switch.

`params` example: `{"launch_window_months":12,"bulk_day_share_of_peak":0.5,"bulk_day_share_12m":0.25,"stockout_days":10,"min_months_for_seasonal":2,"diagnostic_threshold":0.6}`.

- **Lineage:** every refresh writes `costing.sku_demand_volume_selection_snapshot`: all candidate volumes, the method, event and override ids, the diagnostic and the selected units.
- **Snapshot protection:** the existing append-only and designated-run guards are attached, so approved snapshots cannot be modified.
- **Simulated outcome on run 128:**
  - Methods: 39 max-excluding-bulk, 19 demand-seasonal average, 16 launch average, 15 in-stock average, 12 unexplained → keep and review, 6 unchanged.
  - Cost impact: median −0.09%.
- **Transition:** the first version can be seeded only from *proposed* events (all PROPOSED until confirmed). Until confirmed, the step-3 rule applies only to `CONFIRMED` rows, so the first live run equals run 128 except for approved demand-seasonal products.

### A3. Product Master hygiene (proposals, not applied)
- Flag Kanji 878 for demand seasonality (DEMAND_SEASONAL, Jun–Aug) in the new table. Do not change its manufacture season without your instruction.
- Move season profile edits behind an RPC with audit, as `rpc_update_product` already does. Retire the direct delete+insert in `mrp-master-data-console.js`.

---
## 3. Machinery capacity architecture (B)

### B1. Data model (see the prepared SQL)
- **`machine_applicability_class`:** CAPACITY_BASED_PRODUCTION / CAPACITY_BASED_PACKING / NON_CAPACITY_PRODUCTION / UTILITY / NON_PRODUCTION / UNKNOWN. Only the first requires numbers. UNKNOWN blocks readiness.
- **`machine_equipment_class`:** 33 classes seeded from the inventory, e.g. RASOUSHADHI_LEVIGATION_GRINDER, PULVERISER_DISINTEGRATOR, SS_PROCESSING_VESSEL, FERMENTATION_TANK_3000L. These preserve the distinctions; no blanket 50 kg.
- **`plant_capacity_profile`:** one effective-dated, **append-only** row per machine version.
  - Fields: applicability, equipment class, costing resource class, mode (CHARGE / THROUGHPUT / NONE), charge basis, unit, **rated** and **effective** capacity (fill % derived), hours per load, evidence type and reference, provisional flag, effective from/to, approval, supersedes, reason.
  - Constraints: no overlap per machine. Non-provisional applicable equipment must carry numbers. Non-capacity assets **cannot** carry capacity. Final rows need an approval reference.
- **`plant_capacity_profile_revision`:** journal with before/after images. Update and delete are blocked; the only permitted update is closing `effective_to`.
- **`capacity_fallback_policy`:** class-level fallback per resource class (optionally per equipment class), with source, approval and effective dates. The seed keeps today's AU-6 V2 class defaults as **explicitly approved** fallbacks, each raising review flag `CAPACITY_FALLBACK_USED`.
- **`v_plant_capacity_readiness`:** BLOCKED_NO_PROFILE / BLOCKED_UNCLASSIFIED / NOT_REQUIRED / NOT_OPERATIONAL / BLOCKED_NEEDS_CAPACITY / READY_PROVISIONAL / COSTING_READY.

### B2. Function changes
| Object | Change | Gate |
|---|---|---|
| `fn_route_step_loads_v2(rc, plant_id, solid, output, uom, date)` | New function. Order: plant profile (CHARGE mode) → approved class fallback → BLOCKED. Returns loads, capacity used, source, profile id, fallback policy id and flag | G4 |
| `fn_route_step_loads` (v1) | Unchanged; v2 calls it for fallback | — |
| Refresh RPC (route load scaling) | Behind switch `capacity_resolver_version` (V1 default). V2 adds `plant_id`, `capacity_source`, `profile_id` and `fallback_policy_id` keys to `step_detail` (additive) | G4 |
| `rpc_refresh_sku_sales_allocation_basis_snapshot` | `seasonal_driver` CTE replaced by DVS resolver behind `demand_policy_version` switch; writes selection snapshot | G5 |
| Plant master | `rpc_plant_machinery_upsert`, `rpc_plant_machinery_retire` (soft), `plant_machinery_audit`. Revoke direct I/U/D after the client switch. Delete blocked when referenced | G6 |
| THROUGHPUT machines | Not used for loads in v1. Recorded for capacity planning; v2 may convert using hours per load | later |

### B3. Integration
- **Routes:** route steps with `plant_id` resolve to the machine profile. Steps without one use the fallback policy. Readiness reports the count of fallback steps per product.
- **BMR evidence:** evidence type `BMR` with the document reference. A BMR batch charge on a named machine is the preferred evidence for *effective* capacity.
- **Work logs:** used for corroboration only (P50/P90 by machine in the CSV). A future check flags logged batches above the effective capacity × loads.
- **Equipment-load calculation:** unchanged formula, `ceil(charge ÷ capacity)`, with lineage of which source was used.
- **Approved snapshots:** profiles are effective-dated and the resolver reads by valuation date. Run 122 and run 128 rows are protected by existing guards and never recomputed.

---
## 4. AU-8 client UI specification
| Screen | Change |
|---|---|
| Plant & Machinery (`manage-plants.html`, `js/plants.js`) | Replace direct table writes with the RPCs. Delete becomes **Retire** (status R, reason required). New "Costing capacity" tab: current profile, history (revision list), and "New revision" form (applicability, equipment class, mode, basis, unit, rated, effective, hours/load, evidence type + reference/file, provisional, effective from, reason). The form validates per applicability class: number fields are hidden for non-capacity classes. Readiness badge per machine |
| Capacity readiness board (new, Costing) | Filters by readiness / class / section; counts; bulk export; link to the route steps using the machine; fallback-usage list |
| Fallback policy (new, approver role) | View/close/create fallback rows; approval reference required |
| Season profiles (`manage-season-profiles.html`, MRP console) | Route through an audited RPC; label clearly as **manufacture season** |
| Demand seasonality and events (new, Costing) | Per-SKU demand pattern, event register (propose/confirm/reject with evidence), overrides with approval, and a DVS preview showing candidate volumes, diagnostic flag and selected units versus the last approved run |

---
## 5. Migration / backfill plan and gates
| Gate | Content | Precondition | Live effect |
|---|---|---|---|
| G1 | Reference tables + applicability/equipment classes | Your approval of the classes | None on costing |
| G2 | Backfill `plant_capacity_profile` from the CSV. All rows **provisional**; 23 carry a name-derived rated volume; water tanks and Khalvam stay UNKNOWN (user 15:36) | Classes approved 18 Oct 15:36 | None (v1 resolver still active) |
| G3 | Fallback policy seed = current AU-6 V2 class defaults, approved | Approval reference | None |
| G4 | `fn_route_step_loads_v2` + switch (V1 default); a test run on a non-designated run | User capacity values for at least the grinder classes | Only when the switch is flipped |
| G5 | DVS tables, policy DVS-1 v1 (DRAFT → APPROVED), selection snapshot, guards; switch default = legacy 60% rule | Event confirmations (D1) | Only when the switch is flipped |
| G6 | Plant master RPCs + audit + revoke, and AU-8 client release | Client tested | Plant UI behaviour |
| G7 | November run with V2 switches, compared with run 128 | All gates passed; your approval of a run window | New non-designated run |

**Stop rules:** any guard failure, any diff on run 122/128 fingerprints, any profile overlap → STOP.

---
## 6. Compatibility risks
| Risk | Mitigation |
|---|---|
| Changing loads alters many SKU costs (up to ±50% for grinder-heavy SKUs) | Switch-gated; test on a non-designated run; review per-SKU diff before approval |
| Wrong class of the 31 Rasoushadhi grinders | User values before G4; evidence = BMR |
| Water tanks typed as fermentation tanks | Confirm the type; profile carries an equipment class that is independent of `machine_types` |
| Duplicate names across locations (44) | Profiles keyed by `plant_id`, never by name |
| Client hard delete removes referenced machines | G6 delete block + retire |
| Existing `fn_route_step_loads` callers | v1 untouched; v2 is a new function |
| Approved snapshot drift | Effective-dated reads; existing append-only and designated-run guards; fingerprint checks before and after |
| Event register misuse to lower cost | CONFIRMED status needs evidence and an approval reference; the diagnostic flag stays visible |
| Supply plan confused with demand seasonality | Separate tables and UI labels; no change to `products.is_seasonal` |

## 7. Tests (to run at each gate)
1. **Reproduction (done offline):**
   - Load model with the current capacities = run-128 scaled factors, 898/898.
   - DVS P0 = run 128.
2. **Fingerprints:** run 122 = ccb9c7…6b / 353,819 rows. Run 128 snapshot counts and hashes are unchanged before and after each gate.
3. **Constraints:** a non-capacity asset with capacity is rejected. A non-provisional asset without numbers is rejected. Overlapping profiles are rejected. Update and delete on the profile and revision tables are rejected (except closing).
4. **Resolver:**
   - Plant profile is preferred.
   - Fallback is used only when a policy exists.
   - BLOCK produces a blocker.
   - Lineage keys are present.
   - v1 and v2 give equal results when profiles equal the class defaults.
5. **DVS:**
   - Each rule fires on a fixture SKU.
   - An unconfirmed event has no effect.
   - An override wins.
   - The diagnostic flag is raised for unexplained concentration.
6. **RLS / grants:** authenticated users cannot write the tables directly after G6.
7. **Client:** retire instead of delete; form validation per applicability class.

**Read-only extracts used:**
- `costing.route_load_scaling_snapshot`
- `product_production_overhead_step_snapshot` and `product_direct_labour_step_snapshot`
- `*_workload_snapshot` (refresh_run_id = 128)
- `sku_packing_labour_workload_snapshot`
- `public.sales_monthly`, `v_sales_daily_normalized`, `sku_stock_snapshot`
- `plant_machinery`, `machine_types`, `daily_work_log`
- Route-step and cost-centre `plant_id`s

**Rebuilding the outputs:** the scripts in `scripts/` rebuild every CSV from those extracts. The extracts themselves are not committed because they contain sales detail.

## 8. Decisions needed from you
1. Adopt **DVS-1** as the demand-volume policy (and keep the 60% rule as a diagnostic only)?
2. Treat Kanji 878 as **DEMAND_SEASONAL (Jun–Aug, Karkkidakam)** on the 12-month average, which is the run-128 treatment?
3. Approve the **applicability classes** and the treatment of stoves (non-capacity), pumps (utility) and packing machines (throughput, not costed in v1).
4. Water tanks 105–114, 156, 159, 161: are they used as fermenters? If not, re-type them.
5. Khalvam sets 45–46: are they a manual tool (non-capacity) or a capacity asset?
6. Keep today's class defaults as the **approved fallback** until machine values arrive (G3)?
7. Approval to proceed to gates G1–G3. These are additive, with no cost effect.

## 9. Data you need to supply
- **D1. Customer/party for bulk orders:** the party on the single-day bulk lines (36 SKUs) and the March 2026 launch stocking, from Tally, to confirm institutional orders and launches.
- **D2. Effective working charge:** see `data/user_supplied_capacity_values_needed.csv`. Priority order:

| Priority | Machines | Value |
|---|---|---|
| 1 | Rasoushadhi grinders 4–34 (28 operational), stone grinders 41–44/81, wet grinder 174, Khalvam 45–46 | kg per charge |
| 2 | Pills grinders 68–80 | kg per charge (logs are in Nos) |
| 3 | SS processing vessels 47–67, open vessels 39/40/51/52, cookers 35–38/157/158 | rated L and working L |
| 4 | Fermentation tanks 1,500/3,000 L and water tanks | confirm rated; working fill % |
| 5 | Dryers 118–120/146 (firewood), 141/149 (24-tray electric) | kg per load (kg per tray) |
| 6 | Pulverisers/disintegrator, sifters, tablet press, capsule filler/loader, pill maker, extruder, root washer | kg/h or Nos/h and hours per batch |
| 7 | Planetary mixer 125, granulators 140/147, coating pan 154, oil press 126, juice press 130, distillation 121, puta furnace 165, Irumbu Chatti 169, Chembu Vaarpu 160 | kg (or L) per charge |

- **D3. Promotion events:** any scheme or exhibition dates not in Tally.
- **D4. Unexplained SKUs:** the reason behind the peak month for the 11 unexplained SKUs.
