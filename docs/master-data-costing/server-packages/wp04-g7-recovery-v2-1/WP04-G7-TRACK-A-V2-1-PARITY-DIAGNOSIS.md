# WP04 G7 Track A V2.1 — Read-only parity diagnosis

2026-10-05. **DIAGNOSIS COMPLETE — NO PRODUCTION MUTATION.**

## Symptom

Mandatory pre-cutover parity gate raised:

`V2 full-611 parity mismatch count 1182`

Public cutover did not occur.

## Authoritative population counts

Current live tables:

- ALL_EXISTING SKU population: **1793**
- OPERATIONAL SKU population: **611**
- Non-operational remainder: **1182**

Exact relation:

`1793 - 611 = 1182`

## Parity-query construction

The V2.1 forward package deliberately:

1. builds **ALL_EXISTING** into `costing.product_sku_readiness_portfolio_item`;
2. captures the current public C portfolio baseline using:
   `p_population_scope='OPERATIONAL'`;
3. requires baseline row count = 611;
4. then compares with:

```sql
FROM wp04_v2_baseline b
FULL JOIN costing.product_sku_readiness_portfolio_item i
  ON i.build_id=v_build AND i.sku_id=b.sku_id
WHERE b.sku_id IS NULL
   OR i.sku_id IS NULL
   OR i.assessment IS DISTINCT FROM b.assessment
```

The stored side is **not filtered to OPERATIONAL**.

## Exact cause

The 1182 mismatches are the 1182 valid ALL_EXISTING-but-non-OPERATIONAL stored SKU rows that have no row in the OPERATIONAL baseline.

This is a **proof-query population-scope defect**, not a canonical-envelope mismatch.

## Why the count proves operational envelope equality

The V2.1 build guard had already required:

- successful promoted build;
- `operational_count = 611`.

The baseline guard required:

- baseline count = 611.

The stored table contains ALL_EXISTING; therefore all 611 operational SKUs are members of the stored population.

The FULL JOIN mismatch result is exactly the non-operational remainder: 1182.

If any operational SKU were:
- missing from either side; or
- present on both sides but had a different JSONB assessment,

then at least one additional mismatch row would be counted and the total would be **greater than 1182**.

Observed total = exactly 1182.

Therefore, within the executed V2.1 gate:

**the 611 OPERATIONAL assessment envelopes matched exactly; only the unmatched non-operational ALL_EXISTING rows caused failure.**

## Categories ruled out by this evidence

For the OPERATIONAL 611 comparison, no evidence of mismatch remains from:

- governed context;
- run-cohort/evidence assembly;
- route evidence;
- shared evidence;
- ordering;
- multiplicity;
- NULL/missing semantics;
- enrichment inputs;
- canonical JSON envelope.

If any of those changed an operational envelope, the mismatch count would exceed 1182.

## Architecture disposition

**The V2 batched-builder architecture does not need to be abandoned.**

The architecture is supported by the executed parity evidence.

Required correction is narrow:

- compare the OPERATIONAL baseline only against the OPERATIONAL subset of the stored V2 build; or
- separately prove:
  1. OPERATIONAL 611 exact equality to current public C authority; and
  2. ALL_EXISTING membership/count/lifecycle semantics independently.

Recommended proof correction:

```sql
FULL JOIN (
  SELECT *
  FROM costing.product_sku_readiness_portfolio_item
  WHERE build_id=v_build
    AND product_status='Active'
    AND sku_is_active
    AND NOT coalesce(sku_is_sample,false)
) i
ON i.sku_id=b.sku_id
```

Then require mismatch count = 0.

No canonical/build/business-rule code change is indicated by this diagnosis.

## Production state

Unchanged from the stopped V2.1 attempt:

- public C portfolio RPC still active;
- no public cutover;
- no build/item/incidence rows retained;
- installed private V2.1 builder remains;
- V2 fingerprint remains;
- 44 source epochs/triggers remain;
- CSE-P01 unchanged.

## Next bounded gate

Prepare and independently review a **V2.2 proof-scope correction package only**.

Do not rerun V2.1.

V2.2 should:
- preserve the installed V2.1 builder exactly;
- change only the pre-cutover parity comparison scope;
- retain the same build/freshness/cutover/proof architecture;
- require a fresh production authorization before execution.
