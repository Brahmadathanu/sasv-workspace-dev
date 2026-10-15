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


## Governance amendment — user directive, 2026-10-15 (canonical decision authority)
**Decision GOV-015 — effective immediately:** The user, supported by the SASV Costing Suite evidence/governance workflow, is the ultimate decision authority for this programme. References requiring external Finance or Production confirmation as a mandatory approval handoff in THIS audit programme are superseded. Grok and ChatGPT are analytical/execution assistants, NOT independent approval principals. The user makes substantive finance, operational, costing and architecture decisions on reproduced evidence and records them in this ledger. The suite enforces those recorded decisions; it does not self-authorise policy. No assumed or fabricated signatures. Other existing programme and regulatory controls remain intact unless separately changed.
**Resolved ownership path:** normal budget, classification, fuel source/consumption treatment, density and SKU conversions, production workload, BOM and related source fixes are examined independently by the agents; alternative calculations and recommendation are prepared; final selection is user-authorised on evidence and entered in an effective-dated decision record. Do not request Finance/Production paperwork merely as an internal audit blocking condition. Withdraw proposed Finance fuel voucher request; continue source ledger reconciliation using available authenticated read-only evidence. Unknown voucher-level consumption remains UNKNOWN, not auto-approved.
**Hard separation:** user policy authority does not equal automated mutation authority. Live writes, production cutover, rate approvals, client refresh, Google Sheet edits, merge/deploy still require explicit user action and verifiable preflight/tests. Historical run119 remains unchanged.
**D-016 — A7 access:** The original 509 Google Sheet is known at spreadsheet ID `1HBte4Y4WFPGWark1jnQvNv_5spMuBA-6Om2KdNltXVM`, tab `price-revision-proposal`; user filtered 440 copy `price-revision-proposal-filtered` in same workbook. ChatGPT Google Drive connector previously accessed original directly. Grok's 401 is a tool/authorization-specific blocker, not evidence the sheet is missing. Attempt bot's own authorized read; obtain scoped viewer permission only if truly necessary. Do not request CSV unless access cannot be established and read-only internal data reconstruction is insufficient. Neither tab may be modified.

## User decisions — 2026-10-15 evening (approver Dr. Brahmadathan U; recorded with ChatGPT/Grok as assistants)
| ID | Decision | Approver | Date |
|---|---|---|---|
| D-017 | Run 119 is to be designated **REFERENCE**, not APPROVED. Designation is a live write; it is **not yet executed** and needs a separate explicit user action after AU-2 is applied. | Dr. Brahmadathan U | 2026-10-15 |
| D-018 | Tally exports must carry explicit `period_from`/`period_to`. The ETL must persist the requested and the returned range, classify each pull FYTD vs MTD (or other explicit window), and **reject** ambiguous or inconsistent results instead of loading them. | Dr. Brahmadathan U | 2026-10-15 |
| D-019 | PR #68 (AU-2) and PR #69 (AU-3) are deployed **separately, never together**. | Dr. Brahmadathan U | 2026-10-15 |
| D-020 | PR #69 stays **additive**; no consumer (e.g. `v_expense_head_monthly_provision` users) is switched to the AU-3 views by that PR. | Dr. Brahmadathan U | 2026-10-15 |
Note: no live write, merge or deploy is authorised by these entries.
