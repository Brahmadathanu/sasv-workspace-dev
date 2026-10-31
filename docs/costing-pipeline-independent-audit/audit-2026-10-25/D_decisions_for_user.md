> **SUPERSEDED / HISTORICAL as of 31 Oct 2026 - see [CURRENT_STATE_2026-10-31.md](../../master-data-costing/CURRENT_STATE_2026-10-31.md).** This document is kept for history. Its status lines are not current.

# Decisions for Dr. Brahmadathan U (25 Oct 2026)
All findings are read-only checks of the live database and repo on 25 Oct 2026. Nothing was changed.

## 1. CSE-P01: which sales figure counts when there are several
**What it is.** When the readiness check looks up a SKU's sales basis for a month, the server can find more than one saved sales snapshot for the same SKU and month. Today it simply takes the first one it finds ("limit 1"). That is the ambiguity: no rule says which snapshot is the official one. Parked since 2 Oct (WP02); the related speed fix deliberately did not choose a row.
**Options.**
- A. Latest snapshot wins (most recent saved figures).
- B. The snapshot used by the approved costing run for that month wins; fall back to latest if no approved run.
- C. Leave as is and only show a warning when several rows exist.
**Recommendation: B.** It matches how everything else in costing now works (approved run is the source of truth). It needs a small server change, prepared as a migration with rollback, only after your approval. Not measured yet: how many SKU/months actually have more than one snapshot (I will count before preparing anything).

## 2. PERF-P01: readiness speed
**What I measured** (live query statistics since the last reset; I could not run a timed test myself because these functions require a signed-in user):
| Lookup | Calls | Average | Slowest |
|---|---|---|---|
| Single-SKU readiness (Manage Products) | 89 | 4.9 s | 8.0 s |
| Portfolio readiness list (Control Center) | 77 | 0.3 s | 7.0 s |
| Product gaps | 151 | 0.01 s | 0.04 s |
| Production route readiness | 231 | 0.7 s | 3.0 s |
The single-SKU lookup was about 1.8 s when signed off on 2 Oct; it now averages almost 5 s, above the 3 s goal. The window these statistics cover is unknown.
**Options.** A. Accept for now. B. Precompute readiness after each costing run (fast, but can be a little stale). C. Investigate the single-SKU slowdown first (cheap, read-only), then decide.
**Recommendation: C**, then B only if needed.

## 3. Old open months (Mar, Jun, Jul, Aug 2026)
Live: Mar and Jun are OPEN with no successful run; Jul OPEN with draft run 80; Aug OPEN with draft run 82; Sep LOCKED (run 122); Oct OPEN (run 143).
**What locking does.** It freezes the month's valuation date and records who locked it and why; it can be reopened. Closing is final and only possible after locking.
**Important limit.** The server only allows locking a month that has an approved run. Jul and Aug have only old drafts (built before the current rules), and Mar/Jun have none. So locking them would first mean approving runs 80/82, which would put old, pre-policy numbers on record as "approved". I advise against that.
**Risk of leaving them open:** low. Prices and Sheets use the approved October run; old open months only clutter screens and could confuse the future period panel.
**Recommendation:** keep them open for now, and have the period panel (CW-01) label them "historical draft, not used for pricing". If you want them gone, a separate server rule to mark pre-September months as "archived without approval" can be designed later (needs your approval).

## 4. WP10: does the server block incomplete SKUs?
**No.** On `product_skus` the only rules are: an active SKU must belong to an active product; inactive SKUs are forced off both price lists; a product cannot be deactivated while it has active SKUs; basic required fields (product, pack size, unit). Nothing checks costing completeness (BOM, route, rates) at creation. WP03 only shows guidance. Costing itself still fails safe (incomplete SKUs show as needing review, never priced).
**Question for you:** block creation of incomplete SKUs, or keep warning only? Recommendation: **warn only**, because SKUs are usually created before their BOM and route exist; instead add a "new SKUs still incomplete after N days" list to the readiness screen.
