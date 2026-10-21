# Valid purchase-rate age advisory — deployment and verification (21 October 2026)

Owner approved treating trustworthy, eligible purchase rate staleness as an informative provenance warning rather than an approval-blocking issue.

## Implementation
Source: `closure/prepared/PREPARED_20261021_purchase_age_advisory_run_scoped_rm_pm.sql`; branch commit `9c83b07c6346c81a978f6f958190900b6fd0210c`.
Live migration `costing_valid_purchase_age_advisory_20261021` returned SUCCESS. Only run-scoped `fn_build_product_rm_cost_as_of(date,date,bigint)` and `fn_build_sku_pm_cost_as_of(date,date,bigint)` were replaced. Review acceptance is satisfied either by original governed canonical acceptance or **eligible last-purchase age-only advisory**, limited to `rate_source='LAST_PURCHASE'`, `rate_warning_code='STALE_PURCHASE_RATE'`, positive selected rate, rate date no later than valuation date and nonnull source purchase fact ID. RM pre-existing nonblocking-review guard and PM required-missing blocker remain. Hierarchy, prices, BOM, quantities and rate warning counters were not modified. Other manual/fallback/optional issues remain governed.

## Independent live calculation
`select ... from costing.fn_build_sku_material_cost_as_of('2026-10-01','2026-10-20',134)`: 627 SKUs, 627 READY, 0 REVIEW_REQUIRED, 0 BLOCKED, 0 unaccepted review lines. **Frozen** run134 sku_material_cost_snapshot remains 611 READY, 16 REVIEW_REQUIRED; no retrospective rewrite occurred. This is an integration read-only calculation, not a new refresh or G6 signoff. Pricing bridge regional marketing issues remain separate.

## Control limits
This check shows no presently remaining material review SKUs for 20-Oct valuation. It does not certify future negative cases such as missing purchase fact, zero price, future-dated rate or unrelated manual/fallback. No new refresh requested. Preserve prior approved runs. G2 preventive attestation HELD, G6 OPEN and Google Sheets BLOCKED.
