# Run 131 — Rate review cause, read-only forensic checkpoint (21 October 2026)

No database mutations, acceptance carryforward, refresh, financial approval, Sheets operation, or pricing release.

## User question
Why does a genuine rate change require review? A rate change by itself is NOT the reason. The current material-review queue flags source-quality reasons (stale purchase evidence, stock valuation fallback, manual selected rate, internal-source review, optional missing rate). Separately, the acceptance matcher requires exact source valuation date, so old approvals for 16 October do not validate 20 October without a governed carryforward. Preserve the quality control; avoid re-review purely from mechanical revaluation date shifts.

## Verified live run-131 action categories
RM stale purchase 186, stock valuation fallback 117, manual 45, internal-source review 5, optional missing 1.
PM stale purchase 238, stock valuation fallback 215, manual 21, optional missing 2.

## Previous 841 accepted actions by change reason, comparing current action drilldown
STALE_RM_PURCHASE_RATE: 182 unchanged, 7 absent.
RM_STOCK_VALUATION_FALLBACK: 4 unchanged, 104 rate-date-only, 9 numeric rate changed.
RM_MANUAL_RATE_USED: 45 unchanged.
INTERNAL_SOURCE_REVIEW_REQUIRED: 5 numeric rate changed.
OPTIONAL_RM_RATE_MISSING: 1 unchanged.
STALE_PM_PURCHASE_RATE: 238 unchanged, 5 absent.
PM_STOCK_VALUATION_FALLBACK: 8 unchanged, 207 rate-date-only, 2 absent.
PM_MANUAL_RATE_USED: 21 unchanged, 1 absent.
OPTIONAL_PM_RATE_MISSING: 2 unchanged.
Totals: 501 full matched rate/date candidates, 311 rate-date-only (all stock-valuation fallback), 14 changed numeric (9 RM valuation fallback + 5 internal-source), 15 absent. Earlier full-provenance comparison found 501 records matching all six source fields on all qualifying present lines, and 311 date-only records with unchanged numeric/source/IDs.

Interpretation: The 311 date-only cases are highly likely to reflect valuation as-of date semantics, NOT a fresh purchase transaction, but do not assert that as fact until function/source checks. All 14 rate changes are within fallback/internal-source types, rather than fresh purchase-rate sources. The initial acceptance reason is still substantively relevant, even if the new number is mathematically genuine.

## Next control decision
Review rate derivation for stock valuation date shifts, classify acceptance scope by material source/reason, verify old/current line coverage and cost-weighted impact. Do not modify exact valuation-date matcher solely to clear dashboard warnings. Propose a minimal prospective governance scheme, not global auto-acceptance. No acceptance action authorised.
