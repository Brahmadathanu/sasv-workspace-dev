# Run131 stock valuation fallback forensic continuation — 21 October 2026
Read-only continuation, no Supabase writes, no new refresh.

Inspected live costing.fn_resolve_stock_valuation_as_of. The resolver selects eligible mapped Tally RM/PM/general stock snapshots as of the valuation date, by priority and latest date within priority, and calculates a quantity-weighted valuation rate (or stock value / quantity). Therefore a changed rate_date can reflect an actual newly dated stock snapshot and is not necessarily a cosmetic context-field change.

All 311 date-only material acceptance differences are STOCK_VALUATION fallback: 104 RM affecting 571 qualified drilldown lines and 207 PM affecting 214 lines. Every matching old source rate date 2026-10-16 and new selected date 2026-10-20, with source STOCK_VALUATION unchanged. Example direct resolver comparisons:
RM item 229 Chinni Veru (D): rate 50 on both days, source RM_STOCK_SNAPSHOT, actual valuation_source dates Oct16/Oct20 respectively.
PM item 1611 Label - Dhanwanthararishtam 450 ML: rate 1.17 on both days, source PM_STOCK_SNAPSHOT, actual valuation_source dates Oct16/Oct20.
A bulk SQL comparison calling the resolver twice for all material items timed out (SQLSTATE 57014). No conclusions are asserted about underlying source quantity or line-level equivalence in the full 311 cohort; avoid running the heavy per-item resolver at scale. Prefer efficient set-based source snapshot comparison under bounded time or incremental sample and inspect its execution plan.

Earlier same-evidence in-month matcher migration remains installed; 501 full-identical material approvals match and 325 changed continue to review; no run131 re-execution or designation. All user restrictions: no approval, Sheets, pricing, or G6 signoff without independent reconciliation.
