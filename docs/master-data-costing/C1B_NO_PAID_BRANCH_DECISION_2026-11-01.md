# C1B — No paid development branch decision (1 Nov 2026)

Owner decision: Do not create a payable Supabase development branch solely for C1B. Replace the staging dependency with live read-only preflight, independent SQL auditing, and an owner-authorised transactional production deployment followed by immediately controlled functional/permission checks and a narrowly scoped rollback plan.

This does not waive real role/JWT permission verification. Static SQL review and administrator-level queries cannot prove how the view behaves for every authenticated identity. Validate with available authorised application identities after deployment; if no denied-permission identity is available, record the residual coverage gap explicitly and do not claim the security gate fully passed.

No automatic deployment or production write is approved by the decision to omit staging. Preserve approval/run fingerprints, approved-run pricing selection, existing flags, all previous migration restrictions and Claude draft-only workflow.

Next: final SQL and migration review, owner deployment approval, production postflight, then Claude C1B read-only worklist integration. All other items retain parked dependencies.
