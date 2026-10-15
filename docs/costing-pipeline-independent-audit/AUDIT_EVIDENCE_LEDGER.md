# Audit evidence ledger — append, never erase provenance
| ID | Gate | Assertion / artifact | Evidence type | State at initiation | Next verification |
|---|---|---|---|---|---|
| EV-001 | A0 | Run119 period 2026-09-01 valuation 2026-09-10 frozen | Prior Supabase read-only | HISTORICAL_VERIFIED; recheck live | Query refresh run and immutability guards |
| EV-002 | A0/A4 | 10 draft behaviour heads, none approved; rate cutover blocked | Prior Supabase read-only | HISTORICAL_VERIFIED; recheck live | Signed amount and policy counts |
| EV-003 | A0/A7 | Original 509, screened 440, 69 hold; filtered copy user-created/review-sent | Original sheet checked; filtered copy user report | MIXED_PROVENANCE | Confirm filtered tab unchanged, never modify |
| EV-004 | A3 | SKU193 and 988 batch workload, yield, UOM reference and sensitivity | Prior Supabase preview and derived arithmetic | ANALYTICAL_ONLY | Cross-check batch policy and actual manufacturing records |
| EV-005 | A6 | Stage03 active consumers still legacy; candidate on PR66 unmerged | Prior function source inspection | HISTORICAL_VERIFIED | Current live vs PR file/migration parity |
| EV-006 | A1/A4 | FYTD max-selected expense budgets may bias POH | Prior read-only inspection | UNRESOLVED_P1 | Full head/FY reconciliation and Finance review |
| EV-007 | A0/A10 | MC06-08 read-only shadow candidate/migrations/tests | Feature PR66 repository | COMMITTED_UNTESTED | Check PR branch, isolated DB availability and executable test logs |
| EV-008 | A7 | 440 proposed vs 69 held numerical spreadsheet context | Prior sheet reconciliation | WORKING_SUBMISSION | Compare management version by read-only file access |
| EV-009 | A3/A5 | Two product exceptions 190/1350 | Prior programme handover | UNRESOLVED | Inspect live batch reference and four SKU mappings |

## New evidence row standard
EV-ID / exact observed claim / data source object and Git SHA or SQL query / run, as-of and retrieval timestamp / expected & observed / severity & financial impact / confidence/state / screenshot or query output ref / remediation owner / repeat test status. Query output should exclude secrets and sensitive financial identities.

## Current gate
A0 OPEN. No independent audit PASS, no production deployment or model approval authorised.
