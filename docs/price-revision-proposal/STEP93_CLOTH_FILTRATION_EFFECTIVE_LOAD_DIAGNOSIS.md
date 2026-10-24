# Step 93 — Corrected inherited route diagnostic and cloth filtration load source

Date: 2026-10-22. Supabase READ ONLY.

## Important correction to diagnostic
The user-run Step92 diagnostic selected only override columns and produced NULL for all 8 resource classes, activities, and plant IDs. This was **not evidence of missing route fields**: inherited base stage fields are non-null. Use COALESCE(override.field, base_route_stage.field) or canonical effective step JSON.

Four inherited shared operation identities: 1389 EXTRACTION_SYSTEM activity62, 1390 PROCESSING_VESSEL plant172 activity238, 1391 MANUAL activity197, 1392 FILTRATION_SYSTEM plant126 activity169. Exactly same on approved routes212/213.

## Live factors, valued 2026-10-23
- Step1389 101=1,41=1
- Step1390 101=1,41=1
- Step1391 101=3,41=1 **mismatch**
- Step1392 101=1,41=1

**The mismatch is from LEGACY fallback fn_route_step_loads(), not activated AU9.** Verified fn_au9_g4_load_mode('2026-10-23') IS NULL; fn_au9_g4_route_step_loads delegates to fn_route_step_loads in this mode. Legacy MANUAL with solid-charge 105kg -> 3, 5kg ->1. Do not mistakenly report AU9 G4 activated. Step1391 cloth oil filtration is NOT a 50kg solid charge operation; arbitrary general MANUAL rule must not be altered for unrelated routes.

## Safe specific resolution
A genuine joint physical-stage factor must be resolved ONCE from the approved joint operation and scaled across common 41 cycles/continuation60 then allocated. There is no evidence to approve a numerical replacement for stage1391 yet. Narrow scoped governed physical workload policy for activity197 / base_step1391 should be introduced and verified before new run; keep hydraulic step1392 separate.

**No deployed correction or current-refresh change.** Policy1 prospective activation remains from 2026-10-23, run136 immutable. Next confirm appropriate physical stage basis for manual oil cloth filtration, wire and verify both full costing refreshes, check AU9 October cutover, pool conservation, and fresh run.
