# Step 148 — Region-specific membership only viability sheets (23 October 2026)

User directive: IK tab must contain ONLY `MASTER DATA` SKU rows with Price List IK TRUE; OK tab ONLY those with Price List OK TRUE. Remove redundant Price List Eligible column entirely, preserving original workbook-sourced live formulas.

Implemented in existing native Google Sheets workbook `SASV - PRICING & PROMOTIONAL VIABILITY`:
- `PROMOTIONAL VIABILITY - IK` sheetId 1206261003: removed 102 noneligible rows, retaining 525 IK-eligible SKU rows.
- `PROMOTIONAL VIABILITY - OK` sheetId 1206261004: removed 102 noneligible rows, retaining 525 OK-eligible SKU rows.
- Deleted former column J `Price List Eligible` from both. Now A:AK = 37 columns; `Existing MRP` begins J. Formula and row order remain based on original distinct SKU identities, with source reference formulas retaining correct original MASTER DATA row binding despite filtered row compaction.
- After deleting J, corrected row viability, exact required MRP, recommended MRP formulas that previously referenced deleted J; revised them to operate on included rows without eligibility checks. Recalculation confirmed.
- The two tabs are formula-driven only within Google Sheets; no database or underlying MASTER DATA changes.
- QA: each tab exactly 525 rows and 525 unique SKU IDs; precise ordered SKU ID sequence matches independently filtered MASTER DATA by BI/BJ region. Each tab 0 displayed errors across all 37 columns / 525 rows. IK initial target 7% profit-on-MRP: 518 PASS, 7 BELOW TARGET. OK: 517 PASS, 8 BELOW TARGET. Recommended MRP recheck PASS for all 525 in each; statuses consistent with pre-filter counts.
- Eligibility is materialized by actual row membership rather than a redundant display column. Any later changes to price-list eligibility in the database/master will require a controlled rebuild/reconciliation of regional row membership (not an automatic dynamic FILTER implementation), preserving promotion edit sources and user-selected objectives.
