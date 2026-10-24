# Live G2 route 144 pre-refresh blocker — 20 October 2026

## Read-only live verification
On Supabase project qhmoqtxpeasamtlxaoak, route header costing.production_route_family_route id=144 is route_version=1, status=APPROVED. Live route steps with both recurrence counts >1:

| sequence_no | step_key | expected_occurrence_count | standard_cycle_count | current product |
| --- | --- | ---: | ---: | ---: |
| 40 | SERIAL_THERMAL_EXTRACTION_AND_REPLENISHMENT | 8 | 8 | 64 |
| 50 | SERIAL_COLLECTION_CLOTH_FILTRATION | 8 | 8 | 64 |
| 60 | SERIAL_PRESERVATIVE_ADDITION | 8 | 8 | 64 |
| 70 | SERIAL_CLARIFICATION_HOLD | 8 | 8 | 64 |
| 80 | FG_QUALITY_ASSESSMENT | 8 | 8 | 64 |
| 90 | FG_TRANSFER | 8 | 8 | 64 |

The previously recorded physical owner confirmation is **eight total repetitions**. Existing DL/POH effective-workload expressions multiply both fields; the 64 multiplier is a known, materially wrong workload assumption for these steps. The staged G2 attestation RPC currently requires an explicit acknowledgement of the computed product; it would ask for 64, and therefore **does not repair an erroneous dual 8×8 source**.

## Required prospective treatment
1. Preserve approved family route 144 and protected costing runs 122 and 128 unchanged; do not rewrite an approved route to make the current figures appear valid.
2. Create a governed successor family route from the confirmed physical model, storing 8 total repetitions **once** (a valid factorization such as 8×1 or 1×8, chosen according to actual occurrence/cycle semantics), after reviewing all steps and downstream product inheritance.
3. Validate that the effective-step and product overrides truly inherit the successor route as intended, with no parallel approved overlapping effective periods and no unintended product changes.
4. Verify the updated route's DL and POH workload before/after against a controlled new run, preserving the fixed pool and tracing redistribution among other products. Do not equate a difference in allocation with cash savings.
5. Treat G2 approval attestation as a future bad-data prevention control, **not** as retroactive numerical correction or proof of physical truth.

## Gate
**Pre-refresh numerical-correctness HOLD.** The existing prepared G2 migration is also HELD, uncompiled/unverified at PostgreSQL level. CI-012/CI-034 deployment passed separately and cannot be used to close G2. No production route edit, costing refresh or Sheets integration has been authorised or performed by this check.
