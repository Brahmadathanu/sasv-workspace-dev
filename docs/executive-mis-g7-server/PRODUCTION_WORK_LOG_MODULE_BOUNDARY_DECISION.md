# Owner architecture clarification — independent production work log

Owner direction, 24 November 2026. Supersedes the UI/module scope of G7_SINGLE_OPERATIONAL_AUTHORITY_DECISION.md and prior S8 integration proposals. Single authoritative server implementation and stable API naming remain binding.

## Boundaries
- Executive MIS is reporting only: management analytics, progress, exceptions and drill-down into evidence. No production transaction controls or comprehensive operational logging UI inside MIS.
- Product-route-based production logging is a separate canonical operational module (working name Production Work Log; final name subject to owner approval), not three parallel permanent routes or an MIS submodule.
- Production Route Manager remains the authoritative approved route definition. Production Work Log records actual execution per exact product/batch/BMR against that route. Stock ledger and event-SKU records remain authoritative for their respective quantities. No duplicate production or inventory truth.
- Conceive the work log as a batch's digital story: ordered route stages as pages, completion moves to the next applicable page, prior pages remain reviewable, privileged users can make governed corrections. Actual repeats/parallel steps, optional steps, pause/resume, route amendments, incomplete earlier stages, concurrent users and downstream correction consequences require explicit workflow design; do not assume every route is strictly linear.
- Mandatory FG bulk receipt evidence before packaging and authorized measured excess in the same operational interaction remain accepted requirements.
- Existing Add/Edit/Update Log Status remain legacy compatibility during transition, not the intended permanent parallel operating model. Do not implement three new governed handoffs merely to preserve separate entry points. Existing installed _v1 APIs may need temporary adapters; no new version-suffixed business APIs.
- Batch Governance operational functions belong with the independent production logging workflow; MIS may display read-only reporting/evidence, not duplicate operational controls. Review reuse of existing client work before any deletion or relocation.
- Keep installed S2–S7 and production AUDIT unchanged. No new migration, permission assignment, activation, merge, release, or historical backfill authorized by this clarification. PEC release independent.

## Governance checkpoint
G7 remains OPEN 7/11 (64%); G8 parked. Hold prior S8 implementation assumptions until the separate module workflow, ownership, transition and MIS reporting completion boundary are reconciled with owner. Do not count the new module as completed MIS scope or fabricate progress. Retain existing draft PR #526 and evidence pending review. Prepare a distinct production-logging work plan and a bounded MIS reporting completion plan; do not create a new production route engine.
