# WP12 groundwork — eleven-flag OFF/ON sweep and acceptance status — 4 Nov 2026

Test-only. Baseline `main` `43a93ef`. `scripts/costing-wp12-flag-sweep/flag-sweep-browser.test.mjs` (21 Chromium tests) runs the REAL six Costing pages against an inert in-memory backend. Flags exist only in each test context's own `localStorage`; no production flag is touched, nothing is written, no Supabase call is made. Release target unchanged: complete WP00–WP12, then a full Electron release gate; this is groundwork for A3–A5 of the WP12 matrix (PR #145).

## What the sweep proves (mock data)
| Check | Scope |
|---|---|
| 13 states — all OFF, each of the eleven flags alone ON, all ON — × 6 modules (78 page loads) | every page loads without a page error, shows its title, has *exactly* the requested flags in `localStorage` (no page activates a flag), sends no write-like RPC, no table mutation and never reads a `costing.*` base table |
| Independent inventory | six modules, **32 lens ids** and **10 Pricing Policy workspaces** are pinned as a literal that is not derived from the files under test; the route table and the rendered navigation must equal it in every state |
| No flag adds or removes navigation | in all 13 states each module offers the same entries as all-OFF |
| Flag independence of markup | only `COSTING_NAV_GROUPS_V1` changes the navigation markup (grouped, ≥ 2 groups on the five lens modules; Pricing Policy five-group projection); every other flag alone leaves it byte-identical to all-OFF |
| Deep links, all OFF and all ON | every allowed lens of the five lens modules (`?lens=<id>`, 30 entries) and every one of the 10 Pricing Policy workspaces (`?workspace=<id>`) opens as the active entry, error-free, read-only |
| Fallback | unknown ids and another module's default lens fall back to an allowed lens of the requested module, flags OFF and ON, without errors |
Mutation evidence: making `RUN_STATUS` also enable grouped navigation fails the independence test; dropping a lens from the route table fails the inventory and the no-lens-lost tests.

## Not proven here (explicit gates, not waived)
Signed-in role matrix and populated data (A4, A9, A10, A15), live governed decisions (A8 — owner), Windows packaged installer / reopen / updater / rollback (A14), and the per-flag *behavioural* effects that need data or clicks (approval/lock/recalc screens): those are covered by the package suites (`costing-approval`, `costing-recalculation`, `costing-run-status*`, `costing-dialogs`, `costing-table-tools`, `costing-review-worklist`, `costing-draft-run-evidence`, `costing-prm-*`) at mock level only.

## Matrix status after the merged and open work (cloud-runnable rows)
| Row | Status |
|---|---|
| A1 full LF/CRLF/Chromium | per PR heads (see PR bodies) |
| A3 six modules × lenses × flags | this sweep (mock) — signed-in proof outstanding |
| A5 deep links | this sweep |
| A6 review journey | `costing-review-worklist`, `costing-draft-run-evidence` (mock) |
| A7 material acceptance | `costing-material-review-acceptance` (#146) |
| A8 run governance | `costing-approval` (mock) |
| A9 source-remediation journeys | CSA #152 (+ #153/#154/#155 and the F-7/F-8/F-9 fixes, open) |
| A12 responsive | `costing-responsive` |
