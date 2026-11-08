# WP05-CLD1 Track A — L1 policy-coverage KPI correction design (static, 8 November 2026)

**Status: DESIGN ONLY / PROPOSAL / NOT EXECUTED.** WP05 OPEN; programme 6/13. No SQL was run (not even SELECT), no migration or client code was written, no flag, permission, cache or deployment changed. Authority: issue #234 WP05-CLD1 brief. Evidence labels: `CONFIRMED_IN_REPO`, `OBSERVED_PREVIOUS_RUN`, `NOT_IN_REPO`, `LIVE_UNVERIFIED`, `OWNER_DECISION_PENDING`.

## 1. Finding in one paragraph

`public.v_costing_pricing_business_kpi_summary` (latest repo definition: migration `20261013183522_wp05_s1_kpi_view_rebuild.sql`) builds period/run-scoped costing counts from frozen snapshots, but computes its four **policy** counts in a separate `policy` CTE over `public.v_costing_policy_manager_sku_overview` — a *current* (as-of-now) policy projection with no period or run key — and attaches that single row to every period row with `CROSS JOIN policy p` (`…kpi_view_rebuild.sql:69-73, 97`). Policy numerators are therefore identical for every period, whereas denominators (`total_sku_count`) are run-scoped. `CONFIRMED_IN_REPO`. Whether the live view still equals this definition is `LIVE_UNVERIFIED` (a repository-wide grep finds `v_costing_pricing_business_kpi_summary` in this one migration only; the later TB2 gate migration `20261019134900_tb2_costing_view_permission_gate.sql` re-creates 35 other views but not this one, which carries its own permission gate inside `cur`; live drift outside migrations is not excluded).

## 2. Source-by-source trace

| Item | Source | Evidence | Note |
|---|---|---|---|
| `selling_policy_complete_count` | `count(*) FILTER (WHERE selling_price_policy_id IS NOT NULL)` over `v_costing_policy_manager_sku_overview` | `…kpi_view_rebuild.sql:70` | current projection; no `period_start`/`refresh_run_id`/`valuation_date` |
| `selling_policy_missing_count` | `… IS NULL` same source | `:71` | complement of above over same population |
| `scheme_policy_complete_count` | `ik_selected_scheme_id IS NOT NULL AND ok_selected_scheme_id IS NOT NULL` | `:72` | both regions required |
| `scheme_policy_missing_count` | `ik… IS NULL OR ok… IS NULL` | `:73` | |
| `policy_sku_count` | `count(*)` | `:69` | computed but **not selected** in final list (`:76-95`); not a consumer-visible denominator |
| Final join | `FROM dashboard d LEFT JOIN workbench w ON w.period_start = d.period_start CROSS JOIN policy p` | `:95-97` | `workbench` also keys on `period_start` only (see §6) |
| Run-scoped part (correct) | `cur` = `costing.v_current_successful_costing_refresh_run` gated by `app_has_permission('module:costing-control-center','view')`; summaries join snapshots on `(period_start, valuation_date, refresh_run_id)` | `:4-60` | |
| Policy overview source | `public.v_costing_policy_manager_sku_overview` → `costing.v_costing_policy_manager_sku_overview` (security-gated wrapper, columns incl. `selling_price_policy_id`, `selling_price_effective_from/to`, `selling_price_policy_active`, `ik/ok_selected_scheme_id`) | `20261019134900_tb2_costing_view_permission_gate.sql:671-748` | definition of the inner `costing.` view is `NOT_IN_REPO` here (only its public gate wrapper was read); as-of rule inside it is `LIVE_UNVERIFIED` |

### Consumers (client)
`public/shared/js/costing-suite-control-center.js`: reads `business.selling_policy_complete_count|missing_count`, `scheme_policy_complete_count|missing_count` at ~`:742-753` (risk/colour logic), `:940-941` (`sellingComplete`, `schemeComplete` for the Policy Coverage cards) and `:1168` (key-value panel "Selling Price SKUs", which prints `selling_policy_complete_count`). Denominator is `control.total_sku_count` (`:712, :924, :1132`) with the business `total_pricing_sku_count` as fallback. `CONFIRMED_IN_REPO`.

**Affected UI cells:** Selling Policy Coverage card, Scheme Policy Coverage card, their READY/REVIEW colouring (driven by `*_missing_count`), the dashboard table row, and the "Selling Price SKUs" kv figure. **Not affected:** Costing Readiness / Review / Blocked, Scheme blocked/review rows, workbench counts' run logic (S9 parity is unaffected; consistent with PAR1 §8.5.1).

## 3. Observed figures (OBSERVED_PREVIOUS_RUN, PAR1 §8 / PR #240; no new reads)

| Period | Run (denominator source) | Denominator | Selling policy complete | Scheme policy complete |
|---|---|---|---|---|
| Nov 2026 | draft 149 | 628 | 628 | 600 |
| Oct 2026 | approved 143 | 627 | **628** (> denominator) | 600 |

Explanation consistent with source: numerators are one current-projection value (628 selling, 600 scheme) pasted onto both periods; Nov denominator 628 coincides with the current SKU population, Oct run 143 had 627 SKUs, so 628/627 appears. The scheme 600 does not exceed the denominator but is equally a latest-state value, so Oct "600/627" is **not** a statement about run 143. No claim is made that the November numbers are themselves semantically right (they equal the current projection, which is merely the same population as run 149's as-of state).

## 4. Candidate run-scoped sources (what could replace the CROSS JOIN)

| Need | Candidate | Keys | Evidence | Status |
|---|---|---|---|---|
| Selling policy complete, per run | `costing.sku_selling_price_bridge_snapshot` — repo migration `20260801145316_propagate_paired_pricing_status_to_selling_bridge.sql` shows columns `refresh_run_id`, `sku_id`, `policy_resolution_status` (`MISSING`/`AMBIGUOUS`/other), `gst_percent`, regional statuses, resolved against "the frozen valuation date" | `period_start`, `valuation_date`, `refresh_run_id`, `sku_id` (join keys used in `20261013183522…:10-14`) | `CONFIRMED_IN_REPO` for the listed columns; no `CREATE TABLE` in repo | Plausible numerator `policy_resolution_status NOT IN ('MISSING','AMBIGUOUS')`; **exact allowed value set and whether a `selling_price_policy_id` column exists: `NOT_IN_REPO / LIVE UNVERIFIED`** |
| Scheme policy complete, per run | `costing.sku_scheme_viability_snapshot` (used at `:16-17, :31-35`) | same 3 keys + SKU | exists as relation (`CONFIRMED_IN_REPO`); **column list incl. any IK/OK selected-scheme identifiers: `NOT_IN_REPO / LIVE UNVERIFIED`** | Cannot be proven sufficient |
| Per-run SKU population | `costing.sku_pricing_bridge_snapshot` (`total_skus`, `:24`) | same | `CONFIRMED_IN_REPO` | existing denominator |
| Semantic proof needed | that `policy_resolution_status`/scheme columns were computed at the run's frozen `valuation_date` from the **same** rule that `v_costing_policy_manager_sku_overview` uses today, so that the November number does not change on correction | — | `OWNER_DECISION_PENDING` / needs readback | See §7 |

I did **not** invent column names. The Scheme numerator in particular cannot be specified from the repository alone.

## 5. Ranked options

### Option 1 (preferred if proven) — server contract fix: run-scoped policy counts
Rebuild the view's `policy` CTE as a per-`(period_start, valuation_date, refresh_run_id)` aggregate over the frozen snapshots in `cur`, replacing `CROSS JOIN policy p` with a keyed `LEFT JOIN`; `*_missing_count` = snapshot population − complete. Preconditions (all currently **unproven**): (a) readback checklist §7 R1–R4 confirms both snapshot tables carry a per-SKU policy-resolution signal covering both IK and OK schemes; (b) for the latest period the new numerators equal today's 628 / 600 (reference parity) or the delta is explained; (c) owner agrees that "coverage" means *as resolved at the run's frozen valuation date*, not *as of today*.
- Tests (to be defined for a future governed migration; none run now): for each period in `cur`, `complete + missing = total_pricing_sku_count`; Oct `complete ≤ total`; Nov parity with current projection; permission gate preserved (`app_has_permission(...,'view')` and `CURRENT_USER` service/postgres branch retained); column list/order/types unchanged (client reads by name); `security_invoker`/ACL attributes unchanged; no new columns required by `public/shared/js/types/supabase.ts`.
- Rollback: re-apply the exact prior `CREATE OR REPLACE VIEW` from `20261013183522` (captured pre-change `pg_get_viewdef` also to be stored); no data migration involved.
- Governance: separately reviewed prepared SQL (as for SEC-A1/A2 pattern), owner-approved apply, post-apply catalogue check. **Not authorised by this document.**
- Caveats: snapshot values are frozen at run time — old runs created before the policy columns existed (`LIVE_UNVERIFIED`) may have NULLs, producing "missing" rather than the historical truth; materialised/frozen status must not be recomputed retroactively.

### Option 2 — interim client label/hide of historical current-policy counts
In the CCC dashboard, when the selected period ≠ the latest period (or when numerator > denominator), label the Policy Coverage cards "Current policy state (not run-scoped)" or suppress numerator-over-denominator display and colouring for historical periods. No server change; reversible; but it is client code and feature-flag/cache governance applies (service-worker bump, ID-V re-acceptance). Does **not** correct the data; leaves the "Selling Price SKUs" kv figure semantically ambiguous unless also relabelled.

### Option 3 (do nothing, documented) — record L1 as accepted display risk for historical periods with owner milestone. Only valid with explicit owner acceptance.

**Recommendation (not an approval):** execute §7 readbacks first; if R1–R4 pass choose Option 1, else Option 2 as the interim. Decision belongs to the owner: `OWNER_DECISION_PENDING` (queue ID **Q-L1** in the residual document).

## 6. Related scope mismatch noted (not in the brief's numbers, but same pattern)
The `workbench` CTE aggregates `v_costing_pricing_review_workbench_summary_snapshot` by `period_start` only and is joined on `period_start` only (`…kpi_view_rebuild.sql:62-67, 96`), without run/valuation keys. If that snapshot view holds more than one run per period it would mix runs. Whether it does is `LIVE_UNVERIFIED`; flag as readback R5. Not claimed as a defect.

## 7. Proposed SELECT-only live-schema readback checklist (NOT EXECUTED; needs separate owner approval and an approved read-only channel)

```sql
-- R1: live definition of the KPI view (confirm CROSS JOIN policy is still present)
SELECT pg_get_viewdef('public.v_costing_pricing_business_kpi_summary'::regclass, true);

-- R2: columns of the two frozen snapshots (confirm which policy/scheme signals exist)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'costing'
  AND table_name IN ('sku_selling_price_bridge_snapshot','sku_scheme_viability_snapshot')
ORDER BY table_name, ordinal_position;

-- R3: value domain of the selling policy signal per run (read-only aggregate; no SKU identity output)
SELECT refresh_run_id, policy_resolution_status, count(*)
FROM costing.sku_selling_price_bridge_snapshot
WHERE refresh_run_id IN (143, 149)
GROUP BY 1,2 ORDER BY 1,2;

-- R4: per-run population vs current projection (aggregates only)
SELECT period_start, valuation_date, refresh_run_id,
       count(*) AS snapshot_rows, count(DISTINCT sku_id) AS distinct_skus
FROM costing.sku_pricing_bridge_snapshot
WHERE (period_start = DATE '2026-10-01' AND refresh_run_id = 143)
   OR (period_start = DATE '2026-11-01' AND refresh_run_id = 149)
GROUP BY period_start, valuation_date, refresh_run_id ORDER BY period_start;
-- Separate current-policy population count; not assumed identical to per-run SKU grain:
SELECT count(*) AS policy_now_rows FROM public.v_costing_policy_manager_sku_overview;

-- R5: first inspect whether this public view exposes valuation_date/refresh_run_id.
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='v_costing_pricing_review_workbench_summary_snapshot'
ORDER BY ordinal_position;
-- If run keys exist, a separately reviewed query can group by period_start,
-- valuation_date, refresh_run_id and count distinct runs per period.
-- If they do NOT exist, this view alone cannot prove or disprove run-mixing;
-- inspect its live definition and the underlying run-scoped source instead.
```
Notes: R3/R4 filter on run IDs observed in PAR1; R4 assumes the evidenced `sku_id` column and must compare distinct-SKU grain and exact valuation tuple before inferring parity. R5 is deliberately a **column probe**, not yet a multi-run determination. If the view lacks run keys, inspecting its definition and underlying sources requires an additional separately approved SELECT-only readback. Scheme-snapshot value-domain readback cannot be written until R2 returns column names. All five are read-only catalogue/aggregate selects, but a view over `public.*` still needs a permitted role; run only through an owner-approved route, never via a mutating RPC.

## 8. Blocking dependencies / owner decisions
1. Owner choice Option 1 / 2 / 3 and meaning of "coverage" (as-of-run-frozen vs as-of-now).
2. Approval to run R1–R5 (or supply their output).
3. If Option 1: separate governed SQL review/apply track; client colour/label rules for 0-population periods.
4. Nothing here changes the S9 readiness/review/blocker PASS results; no 7/13 or gate-status change.
