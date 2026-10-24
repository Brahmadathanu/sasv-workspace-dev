# G2 independent triage — machinery capacity and labour drivers
Date 2026-10-19 IST. READ ONLY; no policy changes, live SQL writes, run approvals or Sheets edits. Source: handover part 3, closure evidence, live Supabase views and G1 lineage.

## Priority machines confirmed in live database
All 15 priority machine IDs are currently **BLOCKED_NEEDS_CAPACITY** with null effective_capacity. This is real incomplete backfill, not a UI rendering problem. Preserve physical identity; duplicate display names are NOT interchangeable.
- 126 Hydraulic Oil Press, kg/charge, 137 routed products.
- 130 Hydraulic Juice Press, kg/charge, 95 routed products.
- 119 Firewood Dryer 1, kg/charge, 63 routed products. Machine 146 shares name but is in another area and must stay separate.
- 149 Electric Tray Dryer 24 trays, kg charge, 29 routed products; 141 another 24-tray dryer, 19 products (different area).
- 139 Manual Capsule Filling Machine, Nos/hour, 12 products, P28 time is for planning only.
- 147 Granulator 11; 140 Rapid Mixer Granulator 10; 155 20-station Tablet Compression Machine 10, Nos/hour planning-only.
- 146 Firewood Dryer 4; 121 Distillation Unit 2; 169 Irumbu Chatti 2; 67 Processing Vessel 19 1; 125 Planetary Mixer 1; 165 Pukaipokki Chakkara Aduppu 1.

### Work to complete before capacity activation
1. Check user-provided values already present in evidence and legacy class defaults; NEVER copy an unrelated class value into a named machine or mistake rated throughput for working charge.
2. Distinguish approved evidence origin from a costing-policy fallback. The word `provisional` has at least two meanings: value source confidence, and policy adoption readiness. Preserve user-declared factual values and track approval separately.
3. Build read-only route-step coverage test at both named-machine and fallback levels, by product and costing date. Only promote real blanks requiring plant evidence to concise user request.
4. Conduct isolated G4 simulation with proper physical units and manufacturing route, fail-closed on unresolved loads; run 122/128 remain untouched.

## CI-032: material manufacturing-labour concentration
Existing read-only G1 evidence (`G1_UPSTREAM_LINEAGE.md`) reports **44% of manufacturing direct labour allocated to top 10 products**; top cases:
- Dhanyamlam product 51: **13.2%**, ₹93,475/month, approximately ₹81/L; route step factors **38.4/64/64** with three equipment loads. SKU 42's manufacturing DL ₹162 and packing labour ₹2.64 dominate its negative price margin. Verify vessel capacity and actual number of physical charges, repeated operations, route steps and batch quantities—not simply the mathematical split.
- Thippili Rasayanam: **9.8%**, approximately ×14.4 loads; assess mixer/processing capacity and genuine passes.
- Karkkidaka Kanji: **6.7%**, manual operations ×500 loads due to a **25,000 kg unit-mass override**. This requires special review of charge, UOM, batch base, manual activity granularity, product/recipe quantities, and whether a step should scale by discrete charge at all.
These are **driver plausibility blockers**, not proof that math is wrong: G1 established arithmetic conservation. Do not invent new weights or change a frozen calculation to lower prices.

## Priority decisions and gates
- Machine-specific values for the 15 missing machines are user/Production evidence requirements when no acceptable legacy primary evidence exists.
- CI-032 cannot be closed on exact arithmetic alone; establish signed/verified production process and charge evidence.
- If staged correction is proposed, every prior approved run remains byte-for-byte immutable; only a newly authorised future valuation may consume effective-dated rules.
- G2 NOT CLOSED. G3-G6 remain dependent; do not release pricing.
## Reference
`closure/evidence/CAP/CAPACITY_P1_15_MACHINES.md`; `closure/G1_UPSTREAM_LINEAGE.md`; `closure/ISSUE_REGISTER.md`; `archive/CHATGPT_HANDOVER_2026-10-19_PART3.md`.
