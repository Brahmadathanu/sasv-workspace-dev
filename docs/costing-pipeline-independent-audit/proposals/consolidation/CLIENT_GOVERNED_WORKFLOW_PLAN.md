# Consolidation plan: client-governed costing workflow (18 Oct 2026, 22:40 IST)
**Status:** PLAN ONLY. The inventory was read-only on the database; nothing was built.
**Trigger:** auditor (ChatGPT) review, 18 Oct. The priority is consolidation, not new rules.
**Goal:** one client-governed monthly cycle:

> create period → draft runs → source review → approve → (supersede if needed) → lock → close

- **Approved values only** reach consumers (screens, Sheets, price plans).
- A draft never silently replaces an approved value.
- Every SKU cost can be explained.
- Locks, reopens and supersessions are done by governed functions from the client, not by one-off SQL.

Evidence for the inventory (all read-only on 18 Oct 2026):
- live function definitions and grants
- `costing_refresh_stage_definition`
- `cost_period_governance_audit`
- `costing_run_fingerprint`, `costing_run_designation`
- `costing_period_refresh_authorization` (0 rows)
- client JS in `public/shared/js/` (branch = main 80c14ab for client code)
- `proposals/price_revision_feed/RUNS_CRON_AND_SHEETS_FEED_FINDINGS_2026-10-18.md`

## 1. Inventory and gap table
Legend: **E** exists and is usable · **P** partial · **M** missing.

| # | Workflow step | What exists today (DB / client) | State | Gap |
|---|---|---|---|---|
| 1 | **Period creation** with a governed default valuation date | `costing.rpc_ensure_cost_period` inserts OPEN / DRAFT with `fn_default_cost_period_valuation_date` (past month → month end; current → today; future → 1st) and audits `PERIOD_CREATED`. It is called implicitly by the toolbar request (`rpc_request_costing_refresh`, autocreate = true) and by `rpc_set_cost_period_valuation_date`. Job 60 never creates a period | **P** | No explicit "open next month" action. The default valuation date is simply "the day someone first clicked", not a governed rule (e.g. fixed day N or last purchase date). Creation is a side effect of a refresh click |
| 2 | **Valuation-date governance** | `public.rpc_set_cost_period_valuation_date` (OPEN periods only; reason ≥10 chars; audited). Client screen `costing-suite-cost-period-valuation.js` with history (`rpc_get_cost_period_governance_history`) | **E** | None material |
| 3 | **Draft calculation** (scheduled / client-initiated) | Request: `rpc_request_costing_refresh` (toolbar; only OPEN/DRAFT; returns the existing active run instead of duplicating). Processing: `fn_process_next_costing_refresh_stage_internal` (6 stages), driven by **job 61** (paused). `public.rpc_process_next_costing_refresh_stage` is granted to `authenticated`, but the client never calls it. Job 60 (paused) queues one daily run for an OPEN/DRAFT current month | **P** | With job 61 paused, a toolbar click queues a run that never progresses. No "draft" label on runs. A daily cron run on an unapproved month changes what screens show (see 6) |
| 4 | **Source review** | Readiness / review workbench (`v_costing_pricing_material_action_queue_snapshot`), SKU control status, manual-rate manager, control integrity audit, acceptance harness (`acceptance/`), per-run blocked/review/ready counts on `costing_refresh_run` | **P** | No run-level review record ("reviewed by, open exceptions accepted") that approval can require. Known exceptions are kept in docs, not data |
| 5 | **Approval** (designation) | `costing.rpc_designate_costing_run(run, 'APPROVED'/'REFERENCE'/'REVOKED', by, reason)`: requires SUCCESS + captured valuation context; takes a fingerprint; append-only designation; immutability guards on header and rows. **Grant: service_role only** | **P** | No client button and no approval checks in the function (period status, open-review acceptance, fingerprint). Approvals so far were operator SQL |
| 6 | **Draft never silently replaces approved** (screens) | Pointer `v_current_successful_costing_refresh_run`: APPROVED, else latest SUCCESS. All pricing views and explain RPCs default to it | **P** | (a) For a month with no approved run, every new draft becomes "current" with no badge; July/August show this today, and November would. (b) Client "Cost comparison" lens reads `v_cost_sheet_snapshot_sku_monthly_comparison`, which **mixes all runs** in a month (Oct: 475/648 SKUs differ from run 128). (c) No client display of run id / approved / draft status |
| 7 | **Approved-only consumer feed** (Sheets / price plan) | Draft `costing.v_price_revision_feed_approved` (tested read-only, NOT built; user "not yet") | **M** | Nothing approved-only exists in the database |
| 8 | **Supersession** (new run takes the designation; records never deleted) | `costing_period_refresh_authorization` table (append-only, consumable once) + header guard: a new run in a period with an APPROVED run needs an unexpired authorisation. Designation history supports APPROVED → newer APPROVED / REVOKED. Runs are never deleted (delete guard) | **P** | No RPC to *record* an authorisation (0 rows; it would be manual SQL). No single "supersede: approve run N replacing M" action. No client |
| 9 | **Lock** | None. September and October were locked by guarded one-off SQL ("option A"). The audit rows say `GOVERNED_RPC` although no RPC exists | **M** | Needs `rpc_lock_cost_period` (requires an APPROVED run, no active run, fingerprint OK; audited) |
| 10 | **Reopen** | None (`reopened_*` columns exist, unused) | **M** | Needs `rpc_reopen_cost_period` (reason + approval reference; LOCKED → OPEN/DRAFT; keeps the approved designation until superseded; audited) |
| 11 | **Close** | `costing.rpc_close_cost_period` (requires an APPROVED run, no active run, **zero fingerprint drift**; sets CLOSED/FINAL). Grant: service_role only; no client | **P** | **September cannot be closed today**: run 122 shows 1/50 drifted table (`sku_sales_allocation_basis_snapshot`, a false drift from a column added 17 Oct). Run 128: 0/51 |
| 12 | **Per-SKU explainability** | Line traceability (`v_costing_pricing_cost_sheet_line_traceability`, RM line traceability), RM / marketing explain summaries, QC explain, materials-stores explain, route workload explain (all exact-run aware; used by the cost-sheet and route screens). G4 per-step provenance table (empty until the switch is on) | **P** | No single "why this cost" view per SKU and run that joins: rate source per material, batch size and output, workload / volume rule (default, seasonal), capacity and load rule, cost pool and share. Route preview still shows unscaled factors |
| 13 | **Fingerprint integrity** | `fn_compute_run_fingerprint` hashes the **whole row text** of 50+ run-scoped tables; `fn_verify_run_fingerprint` compares with the latest capture | **P** | Adding any column to a snapshot table creates false drift (AU9-P07). This blocks the September close (row 11) |
| 14 | **Cost-component reconciliation** | — | open | The auditor found 9 exceptions in its Sheet tab `price-revision-proposal-run128`. We do not edit Sheets: the list (SKU, component, values) must be shared so it can be traced with W4 |

## 2. Work packages (in order; each needs its own user go-ahead)
Shared rules for all packages:
- Prepared SQL is kept outside `supabase/migrations` and applied via MCP `apply_migration` only after approval.
- Run 122/128 fingerprints and function hashes are checked before and after.
- No change to approved runs.
- No time-based spreading.
- No Sheets edits.

### W1: approved-only selector and consumer feed (first)
- **Changes:**
  - Build `costing.v_price_revision_feed_approved` (latest APPROVED run per month; `is_latest_approved_period`; negative-margin flags).
  - Add `costing.v_costing_period_run_status` (per month: approved run, latest draft, whether a draft is newer than the approved run).
  - Client: show "Approved run N" or "DRAFT run N, not approved" on every costing screen header and the period selector. Repoint the Cost-comparison lens to the approved run (or rebuild that view to filter by the pointer).
  - The existing pointer is left unchanged, so screens keep working.
- **Risk:** low. Additive views and a display change; the comparison-view fix changes one screen's numbers (to the correct ones).
- **User approval:** build and apply the views; the client change (screen wording); the comparison-lens fix. The auditor confirms the feed columns.

### W5: fingerprint fix (small; parallel with W1, must precede the W2 close)
- **Changes:**
  - Fingerprint a fixed, captured column list per table (so new nullable columns do not change the hash).
  - Record a one-off, evidenced re-baseline for run 122 (values verified unchanged) as a new fingerprint capture with a reason.
  - Run 128 stays as is.
- **Risk:** low to medium. It touches the integrity check itself, so the auditor should review it.
- **User approval:** the method and the run-122 re-baseline evidence.

### W2: governed period lifecycle functions + client buttons
- **Changes:** new audited RPCs, each with reason, approval reference and actor:
  1. **Open next month**, with a governed default valuation date rule (*user to choose*).
  2. **Approve run** (wrapper over `rpc_designate_costing_run`) with checks: run SUCCESS, period OPEN, no active run, review exceptions recorded, fingerprint captured.
  3. **Lock** (requires APPROVED, no active run, fingerprint OK).
  4. **Reopen** (LOCKED → OPEN/DRAFT; the approved run stays visible until superseded).
  5. **Authorise supersession** (writes `costing_period_refresh_authorization`, time-limited).
  6. **Supersede**: approve the new run replacing the old designation. History is kept and nothing is deleted.
  7. **Close** (existing RPC, exposed with a permission).
  - Client: a "Period & runs" panel with these buttons, behind permission `module:costing-control-center` (edit) plus an approver role.
  - Replaces one-off lock SQL before the **November close**.
- **Risk:** medium. These are governance functions; the main risk is wrong permissions. It touches neither costing maths nor approved data.
- **User approval:** the function design, who may approve/lock/reopen, the valuation-date default rule, and the apply.

### W3: restore cron (job 61 first, job 60 later)
- **Job 61** can come back right after W1. It only advances runs someone requested. Every client-initiated run is a draft, clearly badged, and cannot reach the feed.
- **Job 60** (unattended daily draft) only after W1 **and** W2, once the user accepts one draft per day for the open month.
- **Risk:** low with W1 in place. Without W1, drafts silently become "current" for unapproved months.
- **User approval:** two separate decisions, job 61 and job 60.

### W4: per-SKU explainability view and screen
- **Changes:** `costing.v_sku_cost_explain` (per run and SKU), consolidating existing traceability/explain sources:
  - material lines with selected rate, rate source and date
  - batch size, output and units
  - volume basis (actual, default, seasonal flag)
  - workload rule and loads (capacity / class / fallback; G4 provenance when switched on)
  - each cost pool with its driver share and rupee value
  - Client: an "Explain this cost" drawer on the SKU cost sheet.
  - Use it to resolve the auditor's 9 reconciliation exceptions.
- **Risk:** low (read-only), but the largest piece of work.
- **User approval:** the screen scope.

## 3. Explicitly deferred (to keep complexity down)
- **G4 switch-on** and the November G4 trial. G4 stays installed with the switch OFF; November runs use the run-128 method until W1–W3 are in place and the user decides.
- **G5 / DVS-1** wiring (demand policy stays prepared, not wired), demand events, plant master governance (G6), AU-8 capacity screens.
- **New capacity or rule changes** beyond the live R2 values.
- CF-1 carry-forward and the 6-month manual-rate review (approved, not built). Revisit after W2.
- The price proposal itself (auditor-owned Sheets), regenerated from run 128 by the auditor and fed by W1 once built.

## 4. Decisions needed from the user
1. Approve the **order** W1 → W5 → W2 → W3 → W4 (W5 runs alongside W1).
2. **W1:** build the approved-only feed and run-status view, the client badges, and the Cost-comparison lens fix?
3. **Default valuation date rule** for new months: keep "first click date", or use a fixed rule (e.g. 1st, a fixed day, or month end at close)?
4. **Who may approve, lock, reopen and authorise supersession** in the client (roles)?
5. **Job 61** restore after W1? **Job 60** only after W2?
6. **W5:** fixed-column fingerprint plus an evidenced run-122 re-baseline (needed before September can be CLOSED)?
7. Ask the auditor to share the **9 reconciliation exceptions** (SKU, component, expected vs actual) for tracing.
