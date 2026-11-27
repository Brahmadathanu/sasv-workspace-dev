# Superseded drafts (kept for evidence; do not deploy)

| File | Status | Observed defect (reproduced against the PG fixture, 25 Nov 2026) |
|---|---|---|
| `20261125_costing_run_retention_ledger.sql` | superseded by `candidates/R1_run_retention_ledger.sql` | Seeding aborts on the first run with `valuation_date IS NULL` (`null value in column "valuation_month"`); also: no RLS/grants proof, seeded failed/running runs as `DETAILS_AVAILABLE`, mixed planner verdicts into storage state, purge row allowed with no digest. |
| `20261125_governance_evidence_r2a.sql` | superseded by `candidates/R2A_governance_evidence_events.sql` | Baseline compared identity + fingerprint only (no period_start / payload field parity); no fingerprint algorithm id; recursive capture trigger. |
| `20261125_governance_evidence_r2b.sql` | superseded by `candidates/R2B_governance_evidence_capture.sql` | Does not parse (`DO $ BEGIN` / `$ LANGUAGE` single-dollar tags: dozens of syntax errors). Design defects found by review and fixed: pointer written by a nested UPDATE inside the AFTER trigger and authorised by `pg_trigger_depth()>1`; source check demanded equality of fields that the fingerprint does not cover (`regional_basis_status`, `assumption_basis`), which would make the live renewal RPCs fail (tested: `REVIEW_V2` case). |
| `../sql/S3K_STAGE_ONLY_RETENTION_EXECUTOR_REVIEW.sql` and the run-87 archive tools | superseded by owner decision 25 Nov 2026 | Archive-before-delete premise withdrawn; S3K also aborts if `costing_retention` exists, so it must never be applied together with R1+. |
