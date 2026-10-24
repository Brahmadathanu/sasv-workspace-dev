# Step 81 — exact labour step integration inputs

Read-only run136 snapshot verified 2026-10-22:
- AVARTHI_PRESSURIZED_EXTRACTION step factor product183 60.6 at 101 cycles; product184 24.6 at 41 cycles; per-cycle factor=0.6.
- AVARTHI_VESSEL_PROCESSING: 101/41 => 1.0 per cycle.
- AVARTHI_CLOTH_FILTRATION: 101/41 => 1.0 per cycle.
- AVARTHI_HYDRAULIC_LIPID_RECOLLECTION: 101/41 => 1.0 per cycle.

Joint calculation must apply *per-step factor* before approved common share, not treat all four operations as equal. Common 41 cycles times per-step factor, split 21/22 product183 and 1/22 product184; extra 60 cycles times same factor to product183. Each step conserves actual 101 cycles times that per-step factor. This is labour workload factor, not rupees or hydraulic equipment loads. Subsequent governed AU5 joint batch scaling and exact company labour denominator required.

The detailed SQL test file write was blocked. No cost functions have been replaced; AU9 migration inactive; run136 immutable. Next: retry source-controlled executable regression test, and obtain actual production-overhead step factors before integrating both refreshes.
