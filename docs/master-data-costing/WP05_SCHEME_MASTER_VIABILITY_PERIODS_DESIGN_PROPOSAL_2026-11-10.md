# WP05 — Scheme Master "Viability Periods": standalone design proposal (10 November 2026)

**Status: PROPOSAL ONLY — NOT APPROVED, NOT IMPLEMENTED.** Docs-only. Prepared offline from repository source at `main` `85eae297` for issue [#267](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/267) workstream B4. No live query, SQL, UI change, deployment or permission change was made. WP05 OPEN; programme 6/13; historical AE1 #19 stays F; #224 and #264 stay open.

**Hard constraints carried from the owner:** do **not** restore the expensive 34-column list read (`select("*")`) — it was the R11 `57014` shape; do not issue an unreviewed live query; do not silently change what the column displays. Any UI change needs this proposal accepted as its own PR with owner acceptance of the semantics.

## 1. What is actually wrong (source-verified)

| Fact | Source |
|---|---|
| Table header and detail drawer both show a label "Viability Periods" | `public/shared/js/costing-suite-pricing-policy.js` `policyManagerHeaders("scheme-master")` and the drawer row (2 string literals) |
| The list cell and drawer value read `schemeMasterRowNumber(row, ["viability_periods","viability_period_count"])` | same file, exactly two call sites |
| Neither key is a column of `public.v_costing_scheme_master_register` | applied migration `20261108082334` column contract (34 columns) |
| The view's real names are `viability_snapshot_count`, `viability_snapshot_period_count`, `latest_viability_snapshot_period` | same migration |
| The list read (PR #263) requests 31 explicit columns and omits those three | `SCHEME_MASTER_LIST_SELECT` |
| The client file contains **zero** references to the three real server names | contract test `scripts/costing-wp05-overnight/scheme-master-contract.test.mjs` (PR linked from #267) |

**Consequence:** the column has been showing `--` for every scheme **since before PR #263** (the key mismatch pre-dates it; PR #263 only removed the *possibility* of the real values arriving). It is a latent display defect, not a regression introduced by the projection. Showing `--` is also indistinguishable from "this scheme has zero viability periods", which is a **misleading claim**, not just an empty cell.

**Server cost context (already recorded, not re-measured):** the three aggregates come from one `LATERAL` over `costing.sku_scheme_viability_snapshot`; the full-view list read was planner-estimated at 44,021.28 vs 825.48 for the 31-column read, and a 5 s full-column read gave `57014` (R11/R12). The covering index exists but the planner did not choose it (R10).

## 2. Options

| # | Option | Client change | Server change | Data contract | Cost / risk | Reversible |
|---|---|---|---|---|---|---|
| A | **Remove** the column and the drawer row | delete header entry, list `<td>`, drawer row | none | none | Zero extra reads. Loses a placeholder that never carried data. | yes (revert) |
| B | **Explicit "Not loaded in list" display**: keep the label, render a fixed text (e.g. "—" with title "Not loaded in the list view") and stop looking up non-existent keys | change two display sites, remove dead key lookup | none | none | Zero extra reads. Honest about absence; keeps a visible slot for C. | yes |
| C | **Bounded on-demand summary in the detail drawer only**: on opening one scheme, one read for that `scheme_id` returning `viability_snapshot_period_count` (and optionally `latest_viability_snapshot_period`) | new single-row read + loading/error state in drawer; list unchanged | none *if* the existing view filtered by `scheme_id` is acceptably cheap; otherwise a separate small view/RPC (migration, separately approved) | one scalar (count) or two scalars (count + latest period) per opened scheme | **Unmeasured.** R10 records the single-scheme aggregate also did not use the new index; the filtered-view cost has not been established here. A read per drawer open could itself time out. | yes (feature-flag or revert) |
| D | Server-side precomputed summary (materialised/cached per scheme) | read new column/relation | migration + refresh policy | new object | Highest effort; refresh governance and staleness semantics required | partial |

**Rejected without further analysis:** restoring `select("*")` or adding the three fields to the list projection (re-introduces the costed LATERAL for every scheme on every list load — exactly the R11/R12 failure); reading the view unfiltered from the drawer; silently relabelling `viability_snapshot_count` as "Viability Periods" (different meaning, see §3).

## 3. Semantics decision the owner must make (before any option C/D)

The three server fields are *different quantities*:

- `viability_snapshot_count` — `count(*)` of `costing.sku_scheme_viability_snapshot` rows for the scheme (a **row** count, not a period count; row grain not re-verified here).
- `viability_snapshot_period_count` — `count(DISTINCT period_start)` for the scheme. This is the only candidate that matches the label "Viability Periods".
- `latest_viability_snapshot_period` — `max(period_start)`.

**Q-VP-1:** does "Viability Periods" mean (i) count of distinct periods with snapshots, (ii) latest period, or (iii) both (two cells)? **Q-VP-2:** is an approximate/stale value acceptable, or must it be live at drawer-open time? Neither can be inferred from code.

## 4. Recommendation (for owner ruling, not self-approved)

1. **Now (smallest honest fix): Option B**, in a separate small client PR after owner acceptance of the wording. It removes the latent mislead with no performance risk, no server work and no change to the 31-column read.
2. **Only if the owner wants live values:** run a *separately authorised read-only* `EXPLAIN` (no ANALYZE, no execution) of the single-scheme filtered aggregate — the planner evidence in R10 is for the aggregate, not for the filtered view the client would issue — and decide Option C vs D from that cost. No such EXPLAIN is performed by this proposal.
3. Option A is acceptable if the owner prefers an uncluttered table; it is strictly a subset of B's client edit.

## 5. Client and data contract if B is approved

- `policyManagerHeaders("scheme-master")`: header text/title updated; column count unchanged unless A.
- List cell and drawer row: no `schemeMasterRowNumber` lookup of non-existent keys; fixed display string; no new network request.
- `SCHEME_MASTER_LIST_SELECT` **unchanged** (31 columns).
- No change to `sw.js` or cache version is *required* (PPM module is already network-first); any cache-version change is a separate governed decision, not implied.

## 6. Test requirements (all offline, source-level unless stated)

1. Existing `scripts/scheme-master-list-projection.test.mjs` (31-column projection, ordering, pagination) must remain green unchanged.
2. Contract test `scripts/costing-wp05-overnight/scheme-master-contract.test.mjs` is **updated in the implementing PR** (it currently *pins the defect* so a reviewer can see exactly what B/A removes): the "renderer keys never exist" assertions become "no renderer key lookup for non-existent columns"; the display-site count assertion changes with A.
3. New assertion: no `.select("*")`, no reference to the three expensive fields, and no new `costingFrom(...)` call introduced in the Scheme Master list/drawer path.
4. W6 (`scripts/costing-w6-pricing-nav/w6.test.mjs`) pins the PPM controller to `cf41740e`: a controller edit requires the pin to be advanced to the new reviewed commit **in the same PR** (the W6 test is intentionally strict).
5. For C only: mocked-client test proving exactly one filtered read per drawer open, no read on list load, error/timeout (`57014`) renders a non-blocking message and never blanks the drawer; plus owner-run 1280 px read-only network capture (one GET, status, ms).
6. Operator evidence (not CI): covered by the daytime pack, check **D-6** in the [WP05 overnight reconciliation](WP05_OVERNIGHT_RECONCILIATION_AND_PC_ACCEPTANCE_PACK_2026-11-10.md) when that document is merged.

## 7. Security and rollback

No privilege, grant, RLS or view change in A/B. C/D would add a read of an existing permission-gated view (`fn_costing_view_allowed` gate unchanged) or a new object (separate migration + positive/negative role tests, not covered here). Rollback for A/B: revert the client commit; the view, index and data are untouched.

## 8. What this proposal does not do

Does not resolve #19/#224/#264, does not change any gate status, does not authorise any query, deployment, cache bump or Electron release, and does not pre-empt Q-VP-1/Q-VP-2.
