# Repeat-analysis governance migration parity

Audit date: 2026-10-20

The live server reports these deployed migrations:

- `lab_fg_repeat_analysis_approval_control_v1`
- `lab_repeat_receive_qualified_bmr_fields`
- `lab_repeat_analysis_context_and_review_queue`

No repository migration file on `origin/main` represents any of those three names or their deployed function contracts. This client work-pack therefore adds no SQL and does not attempt to reconstruct, rerun, or reconcile the live implementation.

Server-side reconciliation required: import or otherwise document the authoritative deployed migration SQL and migration-history identifiers after independent review. The client depends on the five deployed `lab.fn_*repeat_analysis*` / `lab.fn_receive_repeat_sample` contracts named in the work-pack.
