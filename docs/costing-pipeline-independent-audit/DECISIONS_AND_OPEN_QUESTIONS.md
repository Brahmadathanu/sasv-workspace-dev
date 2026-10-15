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
## Decision entries require
ID / alternatives / quantitative supporting evidence / chosen rationale / authorisation actor and timestamp / effective date / downstream impact and retest. NEVER populate approval actors without an actual decision.
