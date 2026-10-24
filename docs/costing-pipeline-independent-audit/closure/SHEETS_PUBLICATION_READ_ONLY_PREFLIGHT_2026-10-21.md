# Google Sheets publication preflight — read-only discovery, 21 October 2026

## Preconditions satisfied
Numerical monetary conservation verified for all seven run136 cost pools at correct recipients in `RUN136_SEVEN_POOL_FINANCIAL_CONSERVATION_2026-10-21.md`. Run136 STATUS SUCCESS, 626/627 SKU final READY and one deliberately held Brihat Chagaladi Ghritham SKU1771 IK pricing assumption; 17/17 integrity checks PASS; run135->136 frozen per-SKU amounts 627/627 identical.

## Outstanding independent acceptance gates
`closure/IMPLEMENTATION_RULES.md` §§1,6,7,12,14,15 keep Google Sheets integration and edits BLOCKED before full G6 approval, including source/provenance, permission/concurrency negative tests, authorised run designation, and customer sheet mapping. Historical APPROVED run128 must remain intact. Run136 presently unapproved. Do not interpret numerical conservation alone as publication permission.

## Live Drive read-only discovery
Search on SASV and pricing/costing terms yielded multiple unrelated or historical spreadsheets, including:
- SASV - PRICE LIST (id `1_DKdTWIkyAhykYR_m2KgCpPabQ1a8BLi-sh_Va3E8lA`)
- SASV - TEMPORARY WORK SHEET (id `1HBte4Y4WFPGWark1jnQvNv_5spMuBA-6Om2KdNltXVM`)
- CS - PRODUCT PRICING DATABASE (id `1B-NBD6lmZxfXVnseighCVMV5HsCte-v676KopFbNs98`)
- SBN / SFS PRODUCT PRICING DATABASE, which are **not SASV costing destinations**.
None of these is established by the audit's current authoritative documentation as the intended server-to-Google-Sheets output workbook. Do not infer that a work-in-progress or current price list is the costing audit destination.

## Publication mapping / control checklist
Before writing, recover/agree exact authoritative workbook ID/tab ID, output type (cost sheet vs. SKU pricing vs. downstream price proposal), destination range, 627 SKU ID reconciliation and excluded/held handling, currency precision, frozen valuation/run metadata, separation of IK/OK marketing cost, versioning/idempotency and reversibility, user release authorisation. A direct edit of price lists based only on computed costs would be outside current mandate. Design should read approved frozen Supabase data, never recompute hierarchy/marketing in Sheet formulas, and must refuse unapproved or REVIEW_REQUIRED records unless explicit governed exception.

## Mutations
No Sheets create/update/export/sync, and no changes to run136, approval, designation or period.
