# G0 Step 58 — effective Ksheerabala 101/41 manufacturing routes
Read-only SQL effective at 2026-10-22 using costing.fn_effective_product_process_route_steps on APPROVED routes. Product 183 = 101 Avarthi; 184 = 41 Avarthi.

Confirmed matching common base steps: 1384 RM issue, 1385 decoction disintegration, 1386 Kalkkam disintegration, 1387 pulverization, 1388 sieving, 1389 pressurized extraction, 1390 vessel processing, 1391 AVARTHI_CLOTH_FILTRATION (activity197 MANUAL), 1392 AVARTHI_HYDRAULIC_LIPID_RECOLLECTION (activity169 FILTRATION_SYSTEM, plant126), 1393 cooling, 1394 FINAL_MANUAL_CLARIFICATION_FILTRATION (activity253 MANUAL), 1395 QC. Product183 also has 1396 filling-line-side FG bulk storage; product184 has FG_TRANSFER (activity299) override1068. Product-specific overrides for repeated stages: product183 1059–1062, product184 1063–1066. Vessel machine172, material disintegration machine2 for both.

Operationally agreed manufacturing: common repetitions 1–41 count ONCE, 41 Avarthi output 5kg withdrawn at repetition41, further 60 repetitions 42–101 produce remaining105kg. Raw material BOM costs kept independently dispensed; route conversion expense common operations counted once and fairly apportioned by approved basis, incremental processing only 101, final finishing/QA/packaging separated. No historical run136 mutation.

Narrow filtration rule: AVARTHI_CLOTH_FILTRATION step1391 activity197 MANUAL, distinct from machine-assisted HYDRAULIC_LIPID_RECOLLECTION step1392 plant126 and final activity253 step1394 MANUAL. Never apply generic 50kg SOLID_CHARGE_KG multiplication to liquid cloth filtration without explicit physical workload evidence. Need examine current workload input rule for activity197 and repetition scaling, specify scoped correction preserving actual attended labor and no invented cycle count.

This is G0 evidence, not migration authorization. The draft October AU9 bridge remains not executable and not applied.
