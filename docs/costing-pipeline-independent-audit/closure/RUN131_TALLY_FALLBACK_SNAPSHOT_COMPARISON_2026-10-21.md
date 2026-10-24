# Run 131 direct Tally stock comparison — 21 October 2026

Audit-only read; no costing SQL modification, acceptance write, refresh, pricing or Sheets operation.

## Result
Efficient, set-based comparison of mapped Tally RM and PM stock snapshots dated October 16 and October 20, restricted to the previously proven 311 material-review acceptance groups with unchanged numeric rates and changed rate dates.

RM: 104 matched paired items; 104/104 same aggregated weighted valuation rate; 7 different total stock quantity; 0 differences in selected source-line count or mapped Tally item names.
PM: 207 paired items; 207/207 same aggregated weighted valuation rate; 9 different stock quantity; 0 selected source-line/name changes.
Total: 311 paired, 311 same weighted valuation rate, 295 same total quantity, 16 changed total quantity, 0 differing source-line counts or mapped item names.

The material valuation source dates legitimately changed from 16 to 20 October; the selected monetary rate did not. A changed stock quantity alone does not justify re-review of the monetary rate, but old quality warnings remain substantively relevant. The previously deployed same-evidence acceptance matcher intentionally continues to reject these 311 because rate_date differs.

Before any narrowly scoped rate-date continuity migration, verify source stock line rates and eligible acceptance scope, test boundaries (no cross-month/backward or changed numeric rate acceptance), and obtain explicit approval for new policy behaviour. Do not blanket-approve. Historical run128 remains immutable and run131 unapproved; G6 and Sheets still blocked.
