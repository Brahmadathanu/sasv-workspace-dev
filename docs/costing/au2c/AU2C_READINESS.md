# AU-2c readiness — 2026-10-16
| Item | Local tests | Evidence still needed | Ready to apply? |
|---|---|---|---|
| 859 Ilaneer Kuzhambu reference output 28,039→28.039 Kg | PASS (T1, T5, T7) | BMR actual output for the last 2 batches + production sign-off | After evidence + user approval |
| 879 Mehasamani factor 0.02→0.001 + reference output | PASS (T2, T3, T8, T9) | BMR for a 16 Kg herb charge; 16 vs 32 Kg NOT decided (standard-batch hierarchy uses the approved 32 Kg meanwhile) | No — evidence first |
| 1277 Palthulli | untouched (T4) | Full formula sheet (missing base/vehicle?) | No — evidence first |
Guards: drift guard, default ROLLBACK, preflight blocks if a run is in flight (T10–T12). Rollback script tested. No live writes.

## Live verification 2026-10-16 11:45 IST (read-only) — user's direct edits NOT visible in live data
| SKU | Live now | Note |
|---|---|---|
| 859 (P678, 5 mL) | BOM 2283 ref output **28,039 Kg** (header touched 11:14 IST, value unchanged); factor 0.000714 Kg/mL; lines Σ471.2 | Intended 55 Kg not saved. At 55 Kg: batch RM ≈₹40,805 → ₹742/Kg → **≈₹2.65/pack** (0.00357 Kg). Factor implies density 0.714 g/mL — low for a honey/coconut preparation; verify (1.0 → 0.001). |
| 1277 (P1038, 5 mL) | BOM 2379 ref output **2,697 Kg** (touched 11:22 IST, unchanged); factor **0.00127** (not 0.000704) | Intended 5.44 Kg/0.000704 not saved. At 5.44 Kg: ₹2,582/5.44 = ₹475/Kg → ₹3.01/pack at 0.00127, or ₹1.67/pack at 0.000704×5. 0.000704 = 0.704 g/mL density: low for a honey-based product; confirm. |
| 879 (P696, 20 g) | BOM 2289 ref output 320 Kg; factor 0.02; batch_size_ref 32 Kg | Unchanged. 0.02 is Kg per 20 g pack, not per g (peers 0.001). |
AU2C_PROPOSED_CHANGES.sql stays as the guarded fix (its pre-checks still match live). It will be retired as "verification only" once edits are confirmed in live data.
