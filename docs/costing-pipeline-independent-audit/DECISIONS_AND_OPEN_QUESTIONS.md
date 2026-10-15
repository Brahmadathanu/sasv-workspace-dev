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
