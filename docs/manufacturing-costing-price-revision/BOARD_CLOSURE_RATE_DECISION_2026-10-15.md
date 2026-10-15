# Board price revision — single rate-policy decision docket

Status: **PROVISIONAL MODEL AUTHORIZED; NUMERIC RATES AND APPROVAL REMAIN OPEN.** No client refresh authorized.

## Reconciled manufacturing reference (run 119, 2026-09-01 / valuation 2026-09-10)

- Manufacturing labour ₹706,203.00 monthly.
- Production overhead ₹1,016,035.28166667 monthly (staff ₹41,055.00, expense heads ₹974,980.28166667).
- Total ₹1,722,238.28166667; all ten component drafts conserve source amounts within rounding tolerance.
- Classifications: FIXED candidates labour, OH staff, cleaning, factory, mess, printing/stationery, repairs (7); VARIABLE candidates electricity/water, fuel/gas, Job Work (3). Whole-head assumption not proven empirical fraction; Job Work stays common production OH.
- All ten DRAFT, zero APPROVED. Two draft aggregate budget policies, neither with normal workload / approved_by / approved_at. Live rate gate BLOCKED_CLASSIFICATION_APPROVAL.

## Candidate capacity, NOT a verified manufacturing-completion series

- First-FG-transfer annual frequency-weighted workload reference (1,412 matched from 1,424 unflagged batch identities): manufacturing labour 10,939.40 units/year, overhead 11,897.00 units/year.
- Illustrative monthly normal denominators 911.616667 and 991.416667, respectively. Do not represent as factual plant capacity. Route workload dimension parity and coverage must be independently established.
- Illustrative pure pool divide rates ₹774.67 per labour workload unit and ₹1,024.83 per OH workload unit; neither is approved or proven suitable for fixed/variable absorption. Do NOT enter them as approved numeric rates without sensitivity review.

## Known frozen workload exceptions

- Product 190 Bala Thailam: run119 monthly quantity 113.477 versus preferred batch 240; quantity foundation REVIEW_REQUIRED. Independent Aug 2026 monthly product record 104.832 is a different commercial source and cannot substitute for production output.
- Product 1350 Mahamanjishtadi Kashaya Choornam: run119 monthly quantity 1 versus preferred batch 35; REVIEW_REQUIRED; no matching Jun–Sep 2026 monthly product record from checked source.
- Both exist in manufacturing-labour and OH review populations. Live SKU master identifies product190 with 5 SKUs (3 active) and product1350 with 1 SKU (active): **four active SKUs potentially exposed**, pending exact Board-509 inclusion and monetary materiality test. Do not mutate run119, silently exclude or invent workload.

## Submission-fast decision pathway

1. Document provisional whole-head costing *modelling method* as approved by user; keep numerical rate approval separate.
2. Validate possible variance/sensitivity of candidate workload denominators and any Board-eligible impact of product190/1350.
3. Review and decide the ten whole-head behaviour assumptions and two denominator figures explicitly; if accepted record genuine decision provenance by the authorized actor, through governed write controls. Never invent approver identity.
4. Re-run classification gate; validate approved standard-rate effective-period and pool/route-workload scope parity. The current gate can return REVIEW_REQUIRED_RATE_SCOPE_AND_PERIOD_PARITY even after approval; this is NOT equivalent to production cutover readiness.
5. Validate MC07 product/SKU monetary conservation, packing output driver, and Board MRP register before advising client refresh. Latest Board register cross-check: 21/21 price/date matches.
6. ONLY when all mandatory gates genuinely pass, message **READY — RUN REFRESH FROM CLIENT**. User alone executes new refresh; then audit output and produce Board 509-SKU report.
7. Defer improved voucher-level fixed/variable coefficients, actual BMR batches and finer attribution where not gating and document limitations. Never defer required approval, route denominator correctness, frozen monetary reconciliation or SKU product/pack conversion.
