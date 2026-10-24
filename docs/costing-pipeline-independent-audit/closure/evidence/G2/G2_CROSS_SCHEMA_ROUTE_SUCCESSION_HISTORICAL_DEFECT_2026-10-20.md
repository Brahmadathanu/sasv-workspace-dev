# G2 critical cross-schema route succession defect — 20 Oct 2026

STATUS: VERIFIED READ-ONLY FUNCTION INSPECTION. NO LIVE CHANGE. Severity: HIGH; historical lookup inconsistency.

## Governed functions actually found
Both live RPCs exist in `public` rather than `costing`, which explains the negative earlier `costing`-schema discovery:
- `public.rpc_approve_route_family_route(bigint,text)`
- `public.rpc_supersede_route_family_route(bigint,bigint)`

Both require `public.require_permission('module:production-route-manager',true)` and execute as SECURITY DEFINER. The approval RPC requires REVIEW_REQUIRED status, effective_from, approved parent family, meaningful PRM approval reference, successful `costing.fn_validate_route_family_route`, same-family approved predecessor and period checks. When successor references a predecessor, it UPDATEs the predecessor to `status='SUPERSEDED', effective_to=new.effective_from-1` in the same transaction, then approves the successor. The supersede RPC similarly sets old route status to SUPERSEDED and closes its dates.

## Confirmed executable incompatibility
`costing.fn_resolve_effective_route_family_route(integer,date)` filters `r.status='APPROVED'`, even for historical dates. Thus a valid governed successor transition makes old route 144 invisible to historical date-scoped resolution when marked SUPERSEDED. Data remains, but history-dependent route lookup fails. This is a functional **historical continuity defect**, not a claim that approved costing run 122 or 128 snapshots changed.

## Minimal repair candidate — not approved
Keep approved/closed old route rows and their immutable steps. Change effective-date lookup, **after independently checking every consumer and its assumptions**, to recognize historically valid `SUPERSEDED` routes only within their closed interval, while still requiring the new route to be approved for successor dates. Do not loosen acceptance of DRAFT, REJECTED, INACTIVE or archived routes absent separate justification. Do not create an additional route-selection engine or policy table.

Test old date before successor, boundary day before/at successor, no temporal gaps/overlaps, approval flow, validation failure rollback, route permissions, immutable snapshots, WP04 readiness triggers and DL/POH reproducibility. Investigate other `APPROVED`-only selectors and product/route preview functions too; fixing one resolver alone may be insufficient. Approved historical run data must remain untouched.

Repository searches located `public/shared/js/costing-suite-production-route-helpers.js` with canonical RPC names and existing client smoke tests. The limited earlier schema-catalog search was therefore incomplete, now corrected.

G2 OPEN / CI-032 HIGH. No route version created, no migration, no cron/switch/merge/deploy or pricing action.
