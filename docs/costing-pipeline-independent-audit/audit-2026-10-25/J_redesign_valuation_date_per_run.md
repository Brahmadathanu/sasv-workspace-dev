# J — Redesign: a valuation date for each run, drafts continue after approval, approval supersedes in one step

> **SUPERSEDED by redesign v2.2 (27 Oct 2026).** This document describes an earlier design. For how costing approval, month-end and locking work now, see [COSTING_REDESIGN_V2_CURRENT_STATE.md](../COSTING_REDESIGN_V2_CURRENT_STATE.md). The text below is kept unchanged as history.
Prepared Mon 26 Oct 2026 (IST). Status: **design for review only.** Nothing applied, no migration, no repo change.
Basis: live function, trigger, view and constraint definitions read today with SELECT-only queries on project qhmoqtxpeasamtlxaoak, plus reports G, H and I. CI-039 (the stopgap scheduler fix) is treated as applied.

---
## 0. One-paragraph summary
Every run already carries its own valuation date ("cost-as-of date"), and that date is locked on the run once it is created. What stops your model today is not the run. It is four rules that tie runs to **one date on the month**: (1) a new run in a month with an approved run needs a supersession authorisation (trigger AU2); (2) approval requires the run's date to equal the month's date; (3) supersession is a two-step "authorise, then run, then supersede"; (4) the scheduler (after CI-039) steps aside once a month is approved. The redesign changes those four rules plus the screens and status view. It does **not** change approved-run immutability, fingerprints, the back-dating guard's logic, the approved price feed, or runs 119, 122 and 143.

---
## 1. Current design, verified in live code today

### 1.1 How the date flows
1. Each month has one row in `costing.cost_periods` with `valuation_date`, `valuation_date_status` (DRAFT/LOCKED/FINAL) and `valuation_date_source` (SYSTEM_DEFAULT / GOVERNED_MANUAL / MIGRATION_BACKFILL).
2. When a run is requested, `costing.fn_request_costing_refresh_internal` copies the month's date onto the run (`costing_refresh_run.valuation_date`, `valuation_context_source = CAPTURED_AT_REQUEST`). It refuses if the month isn't OPEN/DRAFT.
3. Trigger `trg_enforce_refresh_run_context_immutable` makes the run's date (and its captured context) unchangeable after creation. **So "a date per run" already exists.**
4. The month's date cannot be changed while a run is QUEUED or RUNNING (both `rpc_set_cost_period_valuation_date` and the scheduler check this). So **during a run, month date = run date is always true.** Several pipeline objects quietly rely on that (see 1.3).

### 1.2 Guards, triggers and rules tied to the month's valuation date

| Object | Kind | What it does today | Ties to month date? |
|---|---|---|---|
| `fn_guard_designated_run_header` (trigger `trg_au2_designated_run_header` on `costing_refresh_run`) | Trigger | INSERT: if the month has an APPROVED run, refuses `AU2_PERIOD_HOLDS_APPROVED_RUN` unless an unused supersession authorisation (valid 120 min) exists, then marks it for consumption. UPDATE/DELETE: designated runs (REFERENCE/APPROVED/REVOKED) are immutable | Indirectly: it's what blocks new drafts after approval |
| `fn_after_refresh_run_au2` | Trigger | Consumes the authorisation on insert; captures a RUN_SUCCESS fingerprint when a run succeeds | No |
| `fn_guard_designated_run_rows` | Trigger on snapshot tables | No row of a designated run can be inserted, updated or deleted | No |
| `fn_w2_guard_single_approved` (on `costing_run_designation`) | Trigger | Only one APPROVED run per month | No |
| `fn_guard_append_only` | Trigger | Designation, fingerprint, authorisation and period audit tables are append-only | No |
| `fn_w2_guard_closed_period` (on `cost_periods`) | Trigger | A CLOSED month can't be changed | No |
| `fn_enforce_refresh_run_context_immutable` | Trigger | Run's date and captured context can't change | Run date only |
| `cost_periods` check constraints | Constraints | Date within month; OPEN↔DRAFT, LOCKED↔LOCKED, CLOSED↔FINAL | Yes |
| `fn_w2_run_checks(run, 'APPROVE'/'SUPERSEDE')` (used by approve, supersede, and preflight `rpc_costing_preflight_run`) | Function | Checks: RUN_SUCCESS, NOT_ALREADY_DESIGNATED, PERIOD_OPEN, **VALUATION_DATE_MATCHES (run date = month date)**, NO_ACTIVE_RUN, FINGERPRINT_CAPTURED, FINGERPRINT_CLEAN, HAS_COST_SHEET, NO_BLOCKED_SKUS, NO_UNRESOLVED_REVIEWS; APPROVE adds NO_OTHER_APPROVED_RUN; SUPERSEDE adds HAS_APPROVED_RUN_TO_SUPERSEDE, NEWER_THAN_APPROVED (by finish time), **SUPERSESSION_AUTHORISATION_CONSUMED** | **Yes** |
| `rpc_costing_approve_run` | RPC | First approval of a month only (reason + approval reference) | Via checks |
| `rpc_costing_authorise_supersession` | RPC | Step 1 of replacing an approved run: records a 120-minute, single-use authorisation | Indirect |
| `rpc_costing_supersede_approved_run` | RPC | Step 3: marks old approved run REVOKED and new run APPROVED in one transaction | Via checks |
| `rpc_costing_finalize_monthend_run` | RPC | After month end: approves/supersedes a run whose date = month end **and** month date = month end, then locks | **Yes** |
| `rpc_costing_lock_period` | RPC | Needs an APPROVED run, **approved run date = month date** (`W2_LOCK_VALUATION_DATE_MISMATCH`), no active run, clean fingerprint | **Yes** |
| `rpc_costing_close_period` → `costing.rpc_close_cost_period` | RPC | Needs LOCKED, approved run, clean fingerprint; sets CLOSED/FINAL | No |
| `rpc_costing_reopen_period` | RPC | LOCKED → OPEN; CLOSED never | No |
| `rpc_costing_open_next_period`, `costing.rpc_ensure_cost_period` | RPC | Creates the next month (default date: today for current month, month-end for past, 1st for future) | Sets it |
| `rpc_set_cost_period_valuation_date` | RPC | Manual change; OPEN only, reason ≥10 chars, no active run. Doesn't check for an approved run | Sets it |
| `costing.rpc_request_scheduled_costing_refresh_internal` (jobs 66/67) | Cron function | Weekly (Mon 02:00 IST) current month at today; on the 1st, last month at month end. Moves the month's date to the cutoff, audits it, requests a FULL run. After CI-039: returns SKIPPED_APPROVED_PERIOD when the month has an approved run | **Yes** |
| `fn_frozen_valuation_through()` | Function | "Frozen-through" = the latest of: dates of all APPROVED/REFERENCE runs (any month) and dates of LOCKED/CLOSED months. Today = **22 Oct** (run 143) | Partly (LOCKED/CLOSED months) |
| `fn_guard_effective_date_forward` (on 46 master-data tables via `effective_date_guard_config`) | Trigger | FORWARD_ONLY (9 tables): new effective dates must be ≥ today and > frozen-through. AUDIT_ONLY (37 tables): allowed but logged in `effective_date_backdate_log`. (A NOT_INTO_FROZEN mode exists; no table uses it today) | Via frozen-through |
| `fn_verify_run_fingerprint`, `fn_compute_run_fingerprint`, `rpc_rebaseline_run_fingerprint` | Functions | Hash of each run's rows in 56 run-scoped snapshot tables; captured on success and on every designation | No |

### 1.3 Pipeline objects that read the **month's** date instead of the run's
These work today only because month date = run date while a run is being built:
- `costing.fn_resolve_sku_commercial_sales_basis_point` and view `costing.v_sku_commercial_sales_basis`: join `cost_periods` and use `cp.valuation_date` as the "management valuation date" for sales assumptions and default policies (the function only returns rows when `cp.valuation_date = p_valuation_date`). Called from readiness (`fn_wp04_c_live_core`, `fn_wp04_readiness_source_fingerprint`).
- `fn_wp04_build_readiness_portfolio`, `rpc_get_product_sku_readiness`, `rpc_get_readiness_governed_periods`, `fn_sku_activation_missing_items` (CI-038 guard: "latest month's date").
- Views reading `cost_periods` for status/period lists: `v_sku_sales_volume_allocation_basis`, `v_staff_cost_pool_monthly`, `v_expense_head_monthly_provision` (+ `_policy`, `_au3`), `v_cost_periods`, `v_pricing_workflow_dashboard_summary`, `v_costing_pricing_business_kpi_summary` (the last two pick dates from run snapshots, so they are safe).
- The job-68 stage processor (`fn_process_next_costing_refresh_stage_internal`) does **not** read `cost_periods` itself; stages receive the run's date. I did not trace every one of the ~20 stage functions line by line.

### 1.4 Live state today
| Month | Status | Month date | Approved | Others |
|---|---|---|---|---|
| Mar, Jun, Jul | OPEN/DRAFT | 31 Mar, 30 Jun, 22 Jul (backfill) | none | old drafts |
| Aug | OPEN/DRAFT | 7 Aug (manual) | none | old drafts |
| Sep | LOCKED | 10 Sep | **122** (vd 10 Sep) | 119 REFERENCE |
| Oct | OPEN/DRAFT | 22 Oct (manual) | **143** (vd 22 Oct) | 128, 136, 140 REVOKED; 10 authorisations all consumed |

Frozen-through = 22 Oct. Price feed `v_price_revision_current_approved_master` = run 143.

### 1.5 How pricing picks the approved run (unchanged by this redesign)
`v_current_successful_costing_refresh_run` ranks each month's successful runs: APPROVED first, then latest success, then REFERENCE. `v_price_revision_current_approved_master` takes the **latest month that has an APPROVED run** (LIMIT 1) and joins the run's own snapshots by run id and the run's own date. Drafts can never appear in it.

---
## 2. Target design (your model)

### 2.1 Plain rules
1. **Every run has its own valuation date.** It is fixed when the run is requested and never changes (already true).
2. **Any number of drafts per month.** A draft never affects pricing.
3. **Exactly one approved run per month** (already enforced).
4. **Approving a newer draft supersedes the current approved run in the same step.** The old run is kept unchanged on record, marked "Superseded by run N". Nothing is deleted or edited.
5. **The weekly job keeps producing drafts even after approval.**
6. **The month's "official date" is simply the approved run's date.** Nobody edits it separately.
7. **Lock is only needed before Close.**

### 2.2 Recommended way to hold the dates (decision D1)
Keep the existing `cost_periods.valuation_date` column, but give it one clear meaning: **"working date"** = the date the next/latest draft is costed at. The scheduler moves it forward each week, as today. The **official date** is read from the approved run and shown alongside it.

Why this rather than deleting the month date: about 15 pipeline and readiness objects (section 1.3) read the month date while a run is built. Because the date can't move during a run, they keep working with **zero changes**. Removing the column would mean rewriting all of them, with a real risk of changing costing results. The screen shows both dates in plain words, so in practice it reads exactly as your model.

At **Lock**, the month's date is set to the approved run's date, so a locked/closed month carries its official date (and the frozen-through rule keeps working).

### 2.3 Run lifecycle
QUEUED → RUNNING → SUCCESS (= "Draft") or FAILED/CANCELLED.
A SUCCESS draft can become **APPROVED** (by a person). An APPROVED run becomes **SUPERSEDED** (stored as the existing REVOKED designation, labelled "Superseded" on screens; decision D4) when a newer draft is approved. A REFERENCE run (only 119) stays as it is. Designated runs (approved, superseded, reference) are immutable forever.

### 2.4 What the weekly / month-end job does
| Situation | Action |
|---|---|
| Month has no approved run | Same as today: move working date to today, request draft |
| Month already has an approved run | **New:** same as above. Draft is created and labelled "newer draft, not in use". Approved run untouched |
| New month (first Monday, or the 1st if it is a Monday) | Create the month (working date = that day), request first draft (CI-039 behaviour kept) |
| 1st of month (month end of previous month) | If previous month is OPEN: move its working date to month end and request a month-end draft, **even if approved**. If LOCKED/CLOSED: skip quietly |
| Previous month unapproved | Nothing extra. It stays a draft month; the month-end draft is the natural candidate. A health warning lists months that ended with no approved run |
| A run is QUEUED/RUNNING in that month | Skip (ACTIVE_RUN_PRESENT), as today |
| Same cutoff already drafted | Skip (EXISTING_RUN), as today |
| A scheduled run failed and nothing later succeeded | Skip (UNRESOLVED_AUTOMATION_FAILURE), as today, and the health check raises it |
| Cutoff earlier than working date | Skip (WOULD_BACKDATE_VALUATION), as today |

### 2.5 Approval = supersede in one step
One action, "Approve this run", with **reason** and **approval reference** (both required, as today). Before it, a read-only **impact preview** that the approver must open; its token is passed to approval so nobody can approve without having seen it:
- current approved run and date → new run and date;
- **"Back-dating cut-off moves from 22 Oct to X. After this, rates and policies effective on or before X can no longer be entered."** (only for the 9 FORWARD_ONLY tables; the 37 AUDIT_ONLY tables will log rather than refuse);
- SKU-by-SKU change vs the current approved run: material, conversion, overheads, manufacturing cost, loaded cost, selling price, profit (IK/OK); counts of SKUs that changed, and the top changes by amount and by %;
- READY / REVIEW / BLOCKED counts (approval still requires zero BLOCKED and zero unresolved REVIEW);
- **staleness**: master-data entries made after this draft was costed that would have changed it (section 4.4). If any exist, approval needs an extra "approve anyway" acknowledgement, or better, wait for the next draft.

Checks at approval (replacing today's): run SUCCESS; not already designated; month OPEN; no active run; fingerprint captured and clean; cost sheet present; no blocked; no unresolved reviews; **run date ≥ current approved run's date** (new; stops the cut-off moving backwards); **run finished after the current approved run** (kept); impact-preview token matches. Dropped: "run date = month date" and "supersession authorisation consumed".

### 2.6 What the approved feed shows
Unchanged: the latest month with an approved run, that run's own date. When a newer draft is approved, the feed switches to it in the same transaction. Drafts never show.

### 2.7 How pricing is protected
- Only a named person can approve, with reason + reference + preview seen.
- Approved and superseded runs stay immutable (header, rows, fingerprints).
- One approved run per month (trigger).
- A full audit row (`RUN_SUPERSEDED` / `RUN_APPROVED`) stores old run, new run, counts, checks, and the preview summary.
- The frozen-through cut-off only moves forward.

### 2.8 Lock / close policy
- **Approval = frozen numbers.** No monthly lock needed.
- **Lock** only to prepare a Close (quarter or year end, audit sign-off). Lock sets the month date to the approved run's date and checks fingerprints. While locked, no drafts (the scheduler skips). Reopen allowed; Close is final.
- Old open months (Mar, Jun, Jul, Aug): stay open, labelled "historical draft, not used for pricing" (your earlier decision).

---
## 3. Exact change list

| # | Object | Change | Why |
|---|---|---|---|
| 1 | `fn_guard_designated_run_header` (INSERT branch) | Stop requiring a supersession authorisation for a new run in an approved month. Still record in `request_note` "created while run N is approved". UPDATE/DELETE immutability unchanged | Lets drafts continue after approval. Safe because drafts can't touch pricing |
| 2 | `fn_w2_run_checks` | Remove VALUATION_DATE_MATCHES and SUPERSESSION_AUTHORISATION_CONSUMED; add RUN_DATE_NOT_BEFORE_APPROVED and (optional) PREVIEW_ACKNOWLEDGED; add STALENESS (warning, or block unless acknowledged — D3). Unify APPROVE/SUPERSEDE (keep both modes accepted for old callers) | Your model |
| 3 | `rpc_costing_approve_run` | If the month already has an approved run, revoke it ("Superseded by run N") and approve the new one in the same transaction (same steps as today's supersede RPC). New optional parameter `p_preview_token` | One-step approval |
| 4 | `rpc_costing_supersede_approved_run` | Becomes a thin wrapper calling the new approve | Backward compatibility |
| 5 | `rpc_costing_authorise_supersession` | Kept but no longer needed; returns a notice "not required" (or is retired later). The authorisation table stays as history | Compatibility, audit history |
| 6 | **New** `rpc_costing_preview_approval_impact(run)` (read-only, SECURITY DEFINER, costing-control-center permission) | Returns the preview in 2.5 and a token (hash of run ids + counts + date) | Warning and per-SKU impact |
| 7 | **New** `costing.fn_costing_run_input_staleness(run)` | Lists entries in `effective_date_backdate_log` (and, if confirmed, rate tables) logged after the run's `valuation_context_captured_at` with effective date ≤ run's date | Staleness check |
| 8 | `costing.rpc_request_scheduled_costing_refresh_internal` | Remove CI-039's SKIPPED_APPROVED_PERIOD branch (drafts continue). Keep all other skips, the CRON_SCHEDULED audit, Monday-1st handling. Audit reason text says "working date" | Weekly drafts after approval |
| 9 | `rpc_set_cost_period_valuation_date` | Refuse a working date earlier than the approved run's date (a draft costed before the approved date can never be approved) | Prevents useless drafts |
| 10 | `rpc_costing_lock_period` | Instead of failing on date mismatch, set the month date to the approved run's date as part of locking (audited `VALUATION_DATE_CHANGED` with source GOVERNED_RPC, reason "aligned to approved run at lock") | Month date = approved date when it matters |
| 11 | `rpc_costing_finalize_monthend_run` | Require only run date = month end; approval goes through the new one-step approve | Remove the month-date dependency |
| 12 | `costing.v_costing_period_run_status` and `public.v_costing_pricing_period_run_status` | **Add** columns (append at the end, existing ones unchanged): `approved_valuation_date`, `working_valuation_date` (= current `valuation_date`), `latest_draft_valuation_date`, `newer_draft_count`. Labels: "Approved run 143 (22 Oct) in use · newer draft 151 (31 Oct) for review" | Clear screen picture |
| 13 | `cost_period_governance_audit` event types | Add `RUN_APPROVED_WITH_SUPERSESSION` (or reuse `RUN_SUPERSEDED`, D4) and `APPROVAL_IMPACT_PREVIEWED` (optional). Constraint widened only | Audit trail |
| 14 | Health check (new view + daily cron, from report H phase 2) | Raise: scheduled job errors, UNRESOLVED_AUTOMATION_FAILURE, month ended without approved run, newer draft older than 14 days not reviewed | Minimal manual oversight |
| — | **Not changed** | `fn_frozen_valuation_through`, `fn_guard_effective_date_forward`, all fingerprint functions, `fn_guard_designated_run_rows`, `fn_w2_guard_single_approved`, `fn_enforce_refresh_run_context_immutable`, `fn_request_costing_refresh_internal`, `v_price_revision_current_approved_master`, `v_current_successful_costing_refresh_run`, close/reopen, the 56 snapshot tables, all stage functions, the readiness functions (they keep reading the working date, which is what they want) | Minimises risk |

### 3.1 Backward compatibility
- **Runs 119, 122, 143:** no row, header or designation touched. Their dates are already on the run. Any future supersession of 143 happens only on a natural approval by you.
- **September (LOCKED, date 10 Sep = run 122):** unaffected; scheduler skips locked months.
- **Old open months:** unchanged; the scheduler never targets them.
- **October:** after the change, the 1 Nov month-end job (if job 67 is resumed) would move October's *working* date 22 → 31 Oct and make a natural October draft. Run 143 stays approved and in the feed until you decide.
- **Authorisation table:** stays with its 10 consumed rows.

### 3.2 Fingerprints
No existing fingerprint changes. No fingerprint function changes. New captures happen only for new runs (on success) and on new designations, exactly as today. When 143 is eventually superseded, a new DESIGNATION capture row is *added* for it (existing behaviour); its earlier captures stay. Run 119's known sales-allocation mismatch is untouched and remains a separate item.

### 3.3 W1 run-status view and W2 period RPCs
- W1 (`v_costing_pricing_period_run_status`): extra columns only; `display_state` APPROVED_NEWER_DRAFT will become the normal state for approved months. Badge text needs updating.
- W2: approve (changed), supersede (wrapper), authorise (no-op), lock (aligns date), finalize (relaxed), close/reopen/open-next (unchanged), preflight (`rpc_costing_preflight_run` returns the new check list).

### 3.4 Client code (`/workspace/audit-wt/public/shared/js`, main at c7f5030)
Directly touched by the redesign:
- `costing-run-status-badge.js` (reads the W1 view): new labels and both dates.
- `costing-suite-cost-period-valuation-helpers.js` and `costing-suite-cost-period-valuation.js` (read `v_cost_periods`, `rpc_get_cost_period_valuation_context`, call `rpc_set_cost_period_valuation_date`): rename the field to "Working date", show "Official (approved) date", explain the scheduler.
- `costing-suite-control-center.js`, `costing-suite-shell.js`: home/period panels showing run status.
- `types/supabase.ts`: regenerate.
Read run `valuation_date` for display only (check, probably no change): `costing-suite-cost-sheet.js`, `-material-cost.js`, `-readiness.js`, `-commercial-sales-assumptions.js`, `-production-route*.js`, `-qc-*`, `-materials-stores-*`.
**No client file calls the approve/supersede/lock RPCs today**; approvals are done from the back end. A new "Approve run" screen with the impact preview is new client work (phase 4).
Test scripts to update: `scripts/costing-run-status/run-status-badge.test.mjs`, `scripts/cost-period-valuation-*.mjs`.

### 3.5 e-Aushadhi
Expected none. The e-Aushadhi functions found (preflight/stage RPCs) are a separate pipeline; I did not find them referencing cost periods, run status or these RPCs, but I did not read every e-Aushadhi function body.

---
## 4. Risks and edge cases

| Case | What happens | Mitigation |
|---|---|---|
| Two runs at once in a month | Already prevented: advisory lock per month, ACTIVE_RUN_PRESENT, approve refuses while a run is active | Keep |
| Back-dated entries between two draft dates | E.g. approved 2 Nov, draft 9 Nov, someone enters a rate effective 5 Nov on 12 Nov. The 9 Nov draft didn't see it | Staleness check flags it at approval; the next weekly draft picks it up |
| Draft older than the approved run | e.g. manual working date set back | Blocked: working date can't go before approved date; approval refuses a run dated before the approved one |
| Approving a draft whose inputs changed after it was costed | Numbers would not be reproducible from current master data alone (they are reproducible from the frozen snapshot) | Staleness list in preview; D3 decides warn vs block |
| Cut-off moves forward on approval | FORWARD_ONLY tables refuse entries ≤ new date; already true today | Preview warning; only moves forward |
| Scheduler retries / reruns | EXISTING_RUN idempotency per cutoff; unresolved failure blocks further drafts until a later success | Health check makes failures visible |
| Timezone | Cron in UTC (20:30 UTC = 02:00 IST); dates use `fn_india_business_date()` and the guard uses Asia/Kolkata | No change; acceptance test around midnight IST |
| Monday the 1st | Two runs queued for different months (CI-039) | Check job-68 ordering before 1 Feb 2027 |
| Load and storage | ~5 full runs per month instead of 1–2 | Size it (unknown). Option: retention rule for unapproved, never-designated drafts older than N months (D5). Designated runs are never removed |
| Month ends unapproved | Pricing stays on the last approved month | Health warning |
| Someone approves without reading | | Preview token required |
| Failure mode of each guard | All raise an error and roll back the whole transaction; nothing is half-done | As today |

---
## 5. Phased plan

| Phase | Name | Scope | Tests | Rollback |
|---|---|---|---|---|
| 0 | CI-039 (stopgap) | Being applied now | Done | Prepared |
| 1 | **CI-040 approval redesign** | Items 2, 3, 4, 5, 6, 7, 13 (approve = supersede, preview, staleness, checks) | Local copy: first approval; approval with existing approved run; refuse older-dated run; refuse missing preview token; refuse with blocked SKUs; staleness flagged; old SUPERSEDE call still works; audit rows correct; 143 fingerprint identical | Restore previous function bodies (pre-images saved); constraint widened only |
| 2 | **CI-041 drafts after approval** | Items 1, 8, 9 (AU2 insert, scheduler, manual working date) | Local: draft created in approved month; approved run and feed unchanged; idempotency; locked month skipped; Monday-1st; frozen-through unchanged by drafts | Restore AU2 trigger function and CI-039 scheduler body; drafts already made stay as inert drafts |
| 3 | **CI-042 lock/finalize + status view** | Items 10, 11, 12 | Local: lock aligns month date to approved date, audits it, fingerprint check; status view columns; acceptance SQL on live (SELECT only) | Restore function and view bodies (view columns are additive) |
| 4 | **CI-043 health check** | Item 14 | Local + live read-only | Drop job and view |
| 5 | Client (Cursor, plan mode first) | Run-status badge, period panel ("Working date" / "Official date"), Approve screen with preview, Superseded label | Acceptance: "An approver can see what changes per SKU and the new cut-off before approving; approval needs reason and reference; drafts show as 'not in use'; the price list never changes until approval" | Revert PR |

**Order and timing (safe sequence, no artificial supersession):**
1. **Today:** this document; then (on your OK) prepare CI-040–042 SQL, pre-images, rollback and a local test kit. Preparation only.
2. **Apply, with your authorisation, before Sat 31 Oct:** CI-040, then CI-041, then CI-042, each with fingerprint capture of 119/122/143 before and after, and Jarvis informed.
3. **Sun 1 Nov 02:00 (job 67, if resumed):** natural October month-end draft at 31 Oct. Validates "draft after approval" on a real run. 143 stays approved; feed unchanged. You may then preview its impact (read-only) and decide whether to approve.
4. **Mon 2 Nov:** natural first November draft (CI-037 profit columns' first natural run).
5. **Mon 9 Nov onward:** weekly November drafts; first November approval is a normal approval; any later one is a natural one-step supersession. That is the validation of the new approval path.
6. If authorisation comes after 1 Nov, the same steps validate on the November runs.
7. Client work (phase 5) follows; the server rules are safe even before screens change, because approvals are back-end today.

---
## 6. Decisions needed from you
1. **D1 — Keep the month's date as a "working date" and show the approved run's date as the official date** (instead of removing the month date). *Recommend yes:* same outcome for you, far less risk.
2. **D2 — Approval needs the impact preview to have been opened (token).** *Recommend yes.*
3. **D3 — If entries were made after a draft was costed (stale draft): warn and require "approve anyway", or block.** *Recommend warn + acknowledgement*, because the next weekly draft will be along within a week.
4. **D4 — Show superseded runs as "Superseded" but keep the stored value REVOKED.** *Recommend yes* (no constraint or trigger changes to immutability rules).
5. **D5 — Retention: keep all drafts, or remove never-approved drafts older than e.g. 12 months.** *Recommend keep all for now*, decide after measuring storage.
6. **D6 — Resume job 67 so the 1 Nov October month-end draft happens naturally.** *Recommend yes, after CI-040/041 are applied.*
7. **D7 — Lock only before Close, in quarterly batches.** *Recommend yes.*

---
## 7. Honest unknowns
- I did not trace every one of the ~20 stage functions; I verified the stage processor doesn't read `cost_periods` and that the period-reading objects (1.3) rely on month date = run date during a run, which the design preserves.
- Whether material-rate and stock-valuation tables are covered by `effective_date_guard_config` (affects the staleness check's completeness) is not confirmed.
- Whether the master-data tables have reliable "entered at" timestamps for a full staleness check; the back-date log covers only AUDIT_ONLY tables.
- Storage and job-68 time for ~5 runs a month are not measured.
- Job-68 ordering of two queued runs for different months (Monday the 1st) is untested.
- Run 119's sales-allocation fingerprint mismatch remains open and unrelated.
- Exact SQL is not written yet; this is the design. Effort estimate: CI-040 largest (preview + per-SKU diff), CI-041 small, CI-042 small–medium.
