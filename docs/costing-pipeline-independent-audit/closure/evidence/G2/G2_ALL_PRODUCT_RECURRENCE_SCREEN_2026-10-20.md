# G2 all-product recurrence screening — 20 Oct 2026

**VERIFIED READ-ONLY SCREEN, NOT CORRECTION APPROVAL.** Source: frozen run128 `costing.product_direct_labour_step_snapshot`. 293 step records for 62 distinct products have either occurrence >1 or standard cycle >1. Exactly 6 step records (one product, **51 Dhanyamlam**) have *both* fields >1, all 8×8. The owner confirmed those two fields duplicate the same eight real repetitions for Dhanyamlam. This confirmed defect cannot automatically be inferred for other products.

Dominant pairs (occurrence, cycles) in frozen records: (1,3) 153 steps /48 products; (1,4) 22/2; (1,40) 22/2; (1,11) 21/3; (1,14) 12/2; (1,2) 11/8; (1,12) 11/1; (1,15) 11/1; (8,8) 6/1; (1,101) 4/1; (1,41) 4/1. Counts may overlap products; they are not proof of physical validity.

Special high-cycle examples from product-name joins: product183 Ksheerabala Thailam 101 Avarthi (4 repeated steps, max101); 184 Ksheerabala Thailam 41 Avarthi (4, max41); 54 Abhraka Bhasmam (12, max40); 760 Abhraka Chendooram (12, max40). These cases plausibly represent intended process repetition, so never automatically divide or collapse them. Product51 is the only frozen snapshot with both counts >1.

**Suggested validation taxonomy**:
- CONFIRMED_DUPLICATE: only Dhanyamlam 51 repeated route steps (owner statement).
- SINGLE_DIMENSION_REPETITION: occurrence=1, cycles>1 or occurrence>1, cycles=1; independent physical rationale still to be checked, especially high cycles.
- NO_REPETITION: both1.
- UNSUPPORTED/REVIEW: invalid counts, insufficient route lineage, unverified operating evidence.

**Safety**: verify other products potentially sharing route source on the *current effective route* separately from frozen 128, and test POH step records, route overrides, source multiplier versus already aggregated frozen factor, and whether any dynamic G4 workload reintroduces the error. No mass correction to all 62 products. Preserve 122/128 snapshots and standard batch references. G2 remains open; no live changes.

Reproducible query:
```sql
SELECT expected_occurrence_count, standard_cycle_count,
 count(*) step_rows,count(DISTINCT product_id) products
FROM costing.product_direct_labour_step_snapshot
WHERE refresh_run_id=128
 AND (expected_occurrence_count>1 OR standard_cycle_count>1)
GROUP BY 1,2 ORDER BY step_rows DESC;
```
