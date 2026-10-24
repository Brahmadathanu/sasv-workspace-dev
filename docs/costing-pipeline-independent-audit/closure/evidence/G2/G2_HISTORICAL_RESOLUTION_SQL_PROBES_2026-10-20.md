# G2 guarded historical route policy — executable SELECT probes (NOT migration)

**State: candidate read-only probes only. Not deployed, no CREATE OR REPLACE.** Run in an isolated transaction/test database after independent source review. The return signatures of live resolvers could not be re-fetched in this checkpoint; avoid composing a replacement function blindly.

## Family-route candidate inventory
```sql
-- Replace :product_id and :as_of_date with bound parameters in test harness.
WITH selected_family AS (
 SELECT costing.fn_resolve_route_family_for_product(:product_id, :as_of_date) AS family_id
), matches AS (
 SELECT r.id, r.status, r.archived_at, r.effective_from, r.effective_to,
        r.supersedes_route_id,
        CASE WHEN r.archived_at IS NOT NULL THEN 'ARCHIVED_HISTORY'
             WHEN r.status='SUPERSEDED' AND r.effective_to IS NULL THEN 'OPEN_ENDED_SUPERSEDED'
             ELSE 'DATE_CANDIDATE' END AS provenance_class
 FROM costing.production_route_family_route r CROSS JOIN selected_family f
 WHERE r.route_family_id=f.family_id
   AND r.status IN ('APPROVED','SUPERSEDED')
   AND r.effective_from <= :as_of_date
   AND (r.effective_to IS NULL OR r.effective_to >= :as_of_date)
)
SELECT * FROM matches ORDER BY effective_from,id;
```

## Product-route candidate inventory
```sql
SELECT id,status,archived_at,effective_from,effective_to,supersedes_route_id
FROM costing.product_process_route
WHERE product_id=:product_id
  AND status IN ('APPROVED','SUPERSEDED')
  AND effective_from <= :as_of_date
  AND (effective_to IS NULL OR effective_to>=:as_of_date)
ORDER BY effective_from,id;
```

## Guarded decision table
- Frozen recorded snapshot ID: read recorded route ID, retain original source/version regardless of today's status; never re-resolve.
- New prospective submission/approval: preserve strict existing APPROVED + not archived validation/roles.
- Retrospective candidate with one unarchived, nonambiguous APPROVED: eligible subject to other validation.
- Exactly one dated, nonarchived SUPERSEDED candidate: proposed eligibility for historical reconstruction only, subject to approval and checked lineage; no automatic rollout.
- A superseded candidate with NULL effective_to: fail closed.
- Two or more candidates on same date: fail closed (same-day route revisions are not implicitly time-resolved by date-only contracts).
- Archived predecessor: accessible by ID for audit; retrospective recomputation policy **not yet authorized**. Fail closed until explicit archived-route evidentiary handling is approved.
- Never silently select the latest version on historical overlap.

## Regression matrix
- run82 valuation 2026-08-07, route9 effective Jul1-Aug10 but now archived: snapshot-by-ID PASS; retrospective eligibility undecided.
- family32 2026-08-20 (route30 historical isolated); family32 Aug24 (route34+38 conflict).
- product957 Aug25 (72+73 conflict).
- family68 Aug28 (105 open-ended +106).
- family43 Aug28 (archived49 provenance; unarchived82); do not mistake archive-filtered unique live selection for complete lineage.
- run122/128 freeze nonmutation; submit/approve status and authorization unchanged.

## Implementation gates
1. Reconfirm signatures, volatility, dependencies and callers in a clone/test database.
2. Add *new read-only probe helpers* and isolated pgTAP/DO assertion tests before modifying existing resolvers.
3. Simulate all overlap pairs and old run82; compare workload/readiness outputs for strict approval invariance.
4. Produce an explicit rollback and parity report; seek authorisation for any production migration.
5. Preserve existing cost run records; G2/CI-032 HIGH OPEN.
