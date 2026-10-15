# Decisions, boundaries and open questions
## Confirmed by user
- Filtered 440-SKU copy `price-revision-proposal-filtered` was sent for management review; now proceed with deep independent audit instead of rushing current price proposal.
- Programme must be thoroughly documented in repo; use Grok for maximum autonomous evidence acquisition and planning.
- Audit and architecture must be comprehensive, granular and unambiguous.
## Binding safety decisions inherited from programme
- Do not revise frozen run119 or reinterpret draft policies as approved.
- No live write or refresh without explicit user authorisation; audited changes require gates and rollback.
- This audit is isolated from existing e-Aushadhi, product/master-data UX and price implementation.
## OPEN — require evidence or user/Finance determination
D-001 Financial cost-accounting objective: approved normal-budget periods and inflation/abnormal expense handling.
D-002 Whether fixed/variable/job-work classifications are causal and how each driver is proven.
D-003 Normal capacity definition: transfers vs completed production, actual vs expected yield and period pairing.
D-004 Manufacturing standard cost versus period absorption/variance accounting treatment.
D-005 MC07 exceptions and multi-SKU/unsold minimum batch frequency.
D-006 Governance of price exception rules (currently conservative interim >2x or cost >= MRP screen, not permanent price policy).
D-007 Approval matrix for finance, production, management and Board; no invented signatories.
D-008 Grok execution platform access (GitHub, Supabase read only, tests) and isolation available for runtime; validate capabilities, do not infer.
D-009 Architecture scope and prioritisation after A0–A8 forensic evidence.
D-010 (from A0-F2) Should September 2026 be locked and run 119 declared the frozen reference (period OPEN, valuation DRAFT today), or stay open for another refresh? Owner: Finance/user.
D-011 (from A1-F7) Is Interest Paid (≈₹13.9 lakh/month) part of product cost / internal loaded cost, or excluded as a finance cost?
D-012 (from A1-F2/F3) Which expense basis should a normal monthly budget use: (a) highest month seen (current, ₹9.75 lakh POH), (b) last full FY average (₹6.30 lakh), (c) current-FY average to July (₹7.50 lakh), (d) Finance-approved budget? Includes treatment of the Q1 Fuel & Gas spike (needs Tally vouchers).
D-013 (from A1-F1) Who owns the Tally export and was the switch to month-to-date on 2026-08-08 intentional? Determines how the provision logic must read the source.
D-014 (from A3-F1/F2) Should manufacturing cost per pack come from one batch's cost spread over that batch's output (batch-true) instead of charging a full batch every month (current)? Linked to D-004/D-005.

## Decision entries require
ID / alternatives / quantitative supporting evidence / chosen rationale / authorisation actor and timestamp / effective date / downstream impact and retest. NEVER populate approval actors without an actual decision.

## User decisions on D-010…D-014 and related directions (verbatim; approver Dr. Brahmadathan U; 2026-10-15)
| ID | Decision (verbatim) | Approver | Date |
|---|---|---|---|
| D-010 | Run 119: preserve as immutable historical reference; investigate and document mutation vulnerabilities and propose safeguards (do not alter data or close September). | Dr. Brahmadathan U | 2026-10-15 |
| D-011 | Interest: exclude routine financing interest from manufacturing COP by default; keep financing costs separately visible for profitability; identify exceptional costs whose classification needs Finance confirmation. | Dr. Brahmadathan U | 2026-10-15 |
| D-012 | Normal expenses: the final basis is a Finance-approved normal operating budget backed by reliable actuals. Independently compare full-year history, recent monthly actuals, abnormal expenses and operational capacity; do not auto-substitute last year's average or any estimate. | Dr. Brahmadathan U | 2026-10-15 |
| D-013 | Tally: trace the claimed 8 Aug FYTD-to-MTD switch through source evidence, ETL config and transaction records; identify the export owner where possible; don't assume intent or uniform behaviour across heads. | Dr. Brahmadathan U | 2026-10-15 |
| D-014 | Batches: reject the blanket monthly-batch assumption. Distinguish standard product/batch costing, forecast-based requirements, actual completed batches, and period absorption/variance. The standard cost of unsold or intermittently made products must stay determinable using an appropriate normal batch, avoiding both artificial multiplication and zero-cost outcomes. | Dr. Brahmadathan U | 2026-10-15 |
| DIR-6 | Google Sheets: the 509-SKU original proposal and the user-filtered 440-SKU submission are in Google Drive. Read them directly if any connected tool allows it; never edit them. If no access is possible, say exactly what access is needed. | Dr. Brahmadathan U | 2026-10-15 |
| DIR-7 | Fuel & Gas: investigate everything possible without the export; specify the exact voucher-level evidence needed and draft a precise request for Finance (as a doc, not sent). Don't use the ~Rs13k July figure as a corrected norm. | Dr. Brahmadathan U | 2026-10-15 |
| DIR-8 | Migrations: reconcile the 35 'missing' migrations against main, all feature branches (incl. Jarvis's, read-only) and live history, by identity AND implementation content; separate genuinely missing from renamed/consolidated. | Dr. Brahmadathan U | 2026-10-15 |
Note: these are policy directions, not approvals of any rate, budget or costing run. No policy row in the DB was changed.
