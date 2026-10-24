# AU-9 Step 57 — migration integration and manual filtration safeguard
Status: G0 HOLD; read-only findings and implementation plan, not deployed.

## Verified read-only findings
1. costing.fn_au9_close_only_guard() rejects DELETE; permits updating ONLY effective_to when original effective_to is null. Neither old policy fields nor approved future November versions can be modified to manufacture an October version.
2. Existing route master already models FILTRATION_SYSTEM activity251 for pump-assisted clarification / filtration; MANUAL activity253 for manual clarification / filtration. Samples: manual step265/278/290, pump step182/196/209, and distinct more-specific keys for guggulu clarification, final manual clarification.
3. An unqualified MANUAL_LOT 50 kg SOLID_CHARGE_KG multiplier on cloth filtration of processed oil must not silently increase conversion workload. Preserve machine-assisted Kalkkam lipid recovery as a distinct process when present. Do not simply redefine all MANUAL operations or all FILTRATION_SYSTEM steps, and do not assume manual activity253 is necessarily oil filtration in every product.
4. Early October profile bridge, fallbacks and route rules are separate guarded drafts, not approved executable migration. Both functions still block dates prior Nov1, switch is empty. Combined activation remains on HOLD.
5. A joint Ksheerabala Thailam 101/41 Avarthi process conversion-cost correction is mandatory before any fresh costing run; its shared repetitions 1–41 must be counted only once, with 42–101 continuation solely for 101, materials kept independent.

## Minimal implementation decision
- Use existing step key and activity lineage for manual/pump distinction. Activity253 alone is too broad to override all manual workloads.
- Audit exact effective 101/41 route instances and other oil processing routes for manual cloth filtration. Introduce narrowly scoped governed workload basis for correctly identified manual filtration; capture standard attendance/time or explicitly approved neutral unit, no invented kg solid-charge capacity.
- Preserve generic fallback outside validated process scope. Fail closed where applicable work denominator is missing; do not silently double workload or default all manual steps to one load.
- Build full source-controlled migration from exact current function bodies and versioned records, with preflight, 64-machine manifest, 17 fallback and 9 rule bridge checks, approval and audit IDs, new dated switch, test rollback.
- Verify both 2026-10-20 legacy outcome and future approved date, plus machine availability, route suitability, 101/41 co-production, cost-pool conservation, missing lineage and unintended impact. No work to pricing tabs until G0 is passed.
No production Supabase mutation or spreadsheet mutation as of this record.
