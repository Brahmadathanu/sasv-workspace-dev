# G2 lean architecture correction — approved overlap guard

READ-ONLY verified the live exclusion constraint `production_route_family_route_no_approved_overlap`: GiST excludes overlapping inclusive effective date ranges within the same family when `status='APPROVED' AND archived_at IS NULL`.

Consequence: the proposed replacement `G2_FAMILY_RESOLVER_AMBIGUITY_GUARD_REVIEW_ONLY_2026-10-20.sql` guards a state the database normally rejects already. Deploying it would change SQL to PL/pgSQL and exception propagation across six direct callers, despite no demonstrated production gap in approved-only selection. **Recommendation: DO NOT PROMOTE the staged ambiguity guard. Retain it only as historical proposal evidence; classify as NOT SELECTED pending contrary evidence.** Do not remove the original resolver or its existing constraint.

Real G2 defect remains retrospective as-of route validity: APPROVED-only filtering loses closed SUPERSEDED history, while blindly admitting it creates same-day and open-ended overlaps. Frozen snapshot access by recorded route ID remains separate. Next: inspect whether retrospective recomputation is actually a governed use case, and design the smallest necessary read path before any function changes. No live writes, G2/CI-032 OPEN.
