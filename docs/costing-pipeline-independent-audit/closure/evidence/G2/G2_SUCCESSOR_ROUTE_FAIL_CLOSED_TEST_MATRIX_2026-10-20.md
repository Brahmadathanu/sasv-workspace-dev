# G2 successor-route fail-closed test matrix (prepared, not executed)

Date 20 October 2026. Status **SPECIFICATION ONLY**. All three read-only live function/trigger catalog requests to inspect route-parent immutability function, route-step triggers and route version RPCs were blocked in this session. Do not assume any insertion or supersession API works until the actual definitions can be read and md5 frozen.

## Established evidence
- Dhanyamlam product51, family101 assignment424 APPROVED; route144 v1 APPROVED from 2026-08-30.
- Parent route immutable trigger, approval reference trigger, and WP04 readiness epoch trigger verified previously.
- Owner confirmed eight actual repetitions, not 8 occurrence × 8 cycle independently. Six source steps1593..1598 show 8×8.
- Frozen run128 DL raw step total174.8, illustrative eight-only 23.6; POH raw step total210, illustrative eight-only 28.
- Legacy G4 OFF; runs122/128 immutable.

## Required isolated tests (not marked PASS)
1. Historical valuation selects route144/v1 and unchanged frozen step factors/snapshot fingerprints; never update historical route row.
2. New, uniquely versioned APPROVED successor at independently approved prospective effective date selects only for eligible future valuations; no overlap or missing effective route.
3. Only source step IDs corresponding to seq40..90 change duplicate recurrence to a single physical eight-count, keeping other step attributes, standard batch and operations unchanged.
4. A route source step is either derived once from base weight × independently verified recurrence × separately justified charges, or is already aggregated: never multiply an already aggregated factor again.
5. Both manufacturing labour and production overhead route results use the same eight-repetition semantics but retain separate scope weights.
6. Other single-dimension repeated products—including 101/41 avarthi and 40-cycle Abhraka—remain unchanged.
7. Approved route assignments and ADD/BYPASS product overrides resolve correctly; changed route affects only legitimate recipients.
8. Reject unsigned route, overlapping effective dates, invalid recurrence, missing lineage, unresolved stage quantities, invalid machine charge units and any active financial fallback that hides missing physical evidence.
9. Full eligible-cohort DL and POH expense conservation, zero-scope and review-required classes, controlled cap behaviour and no new pricing/Sheets actions.
10. WP04 readiness bump and recovery testing with no accidental E-Aushadhi or separate programme mutations.
11. Full dependency inventory, approved rollback/cutover and hard-retirement proof before removing superseded executable path.

## Required read-only source retrieval
```sql
SELECT pg_get_functiondef('costing.fn_route_parent_immutable()'::regprocedure);
SELECT tgname,pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgrelid='costing.production_route_family_route_step'::regclass AND NOT tgisinternal;
SELECT routine_name FROM information_schema.routines
WHERE specific_schema='costing' AND routine_name ILIKE '%route%' AND routine_name ILIKE '%version%';
```

None of these queries succeeded this checkpoint. No version SQL has been asserted as deployable; no integration tests have been run. G2 OPEN, CI-032 HIGH, no live changes.
