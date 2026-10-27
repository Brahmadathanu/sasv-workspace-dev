# W2: governed period lifecycle (open, approve, lock, reopen, supersede, close) and client buttons. DESIGN ONLY.

> **SUPERSEDED by redesign v2.2 (27 Oct 2026).** This document describes an earlier design. For how costing approval, month-end and locking work now, see [COSTING_REDESIGN_V2_CURRENT_STATE.md](../../COSTING_REDESIGN_V2_CURRENT_STATE.md). The text below is kept unchanged as history.

- **Status:** design and local build plan, 19 Oct 2026 07:45 IST. Nothing has been built and nothing is live.
- **Inputs:** read-only live inventory (`w2_live_inventory_2026-10-19.json`) and the live function definitions.
- **Order approved:** W1 → W5 (done, live) → **W2** → W3 → W4.

## 1. What exists on live today
| Step | Live object | Who can call | Gap |
|---|---|---|---|
| Create period | `costing.rpc_ensure_cost_period(date)`: inserts OPEN / DRAFT with `fn_default_cost_period_valuation_date` (past month → month end; current month → today; future month → 1st); audits PERIOD_CREATED | Neither authenticated nor service_role (internal; called by the refresh request and the valuation-date RPC) | No explicit "open next month" action; the valuation date depends on the click date |
| Valuation date | `public.rpc_set_cost_period_valuation_date` (OPEN only, reason ≥10, audited) + client screen | authenticated + permission `module:costing-control-center` edit | none |
| Draft run | `public.rpc_request_costing_refresh` (OPEN/DRAFT only) | authenticated + edit | none (the job 60/61 schedule is W3) |
| Approve run | `costing.rpc_designate_costing_run(run, APPROVED/REFERENCE/REVOKED, by, reason)` | **service_role only** | No client. `by` is free text. **No pre-checks** (period state, active run, counts). **Allows a second APPROVED run in the same month** (the pointer then picks the later one) |
| Lock | **none** | — | Sep/Oct were locked by one-off SQL; their audit rows say `GOVERNED_RPC` (2 rows) |
| Reopen | **none** (`reopened_*` columns unused) | — | — |
| Authorise supersession | `costing.rpc_authorize_period_refresh(period, by, reason, valid_minutes)` writes `costing_period_refresh_authorization` (append-only, consumed once by the next run's header guard) | service_role only | No client |
| Supersede | none (manual: authorise → refresh → designate) | — | Old approval not revoked automatically, so two APPROVED runs can exist |
| Close | `costing.rpc_close_cost_period(period, by, reason, ref)`: needs APPROVED, no active run, 0 fingerprint drift; sets CLOSED/FINAL | service_role only | No client. Does not require LOCKED first |
| Status for screens | `public.v_costing_pricing_period_run_status` (W1, live) | authenticated + view | none |

Other relevant facts:
- **Permission model:** `public.app_has_permission(target, mode)` / `require_permission(target, need_edit)` over `app_has_permission_core(uid, target, mode)`. Only `module:costing-control-center` view/edit is used for costing today.
- **Guards kept unchanged by W2:**
  - designated-run header and row immutability
  - append-only designation, fingerprint and authorisation tables
  - zero-drift close
  - W1 approved-only feed
- **Current live state** (not changed): Sep and Oct are both **LOCKED** (status LOCKED / LOCKED, not OPEN). Approved runs: Sep 122, Oct 128. No active run. Cron 60/61 paused.

## 2. Proposed functions
All new functions:
- live in schema `costing` as SECURITY DEFINER, with a thin `public.rpc_costing_*` wrapper for the client
- take a per-period advisory lock and require `reason` (≥10 characters) and `approval_reference`
- record the actor from `auth.uid()` plus the display name
- write `costing.cost_period_governance_audit` with event_source `GOVERNED_RPC` and an evidence jsonb
- return the new state

| # | Function | Allowed transition / checks | Audit event |
|---|---|---|---|
| F1 | `rpc_costing_open_period(p_period_start, p_valuation_date default null)` | Only the month after the latest existing period, or a named month (D6). Calls `rpc_ensure_cost_period`, then the valuation date rule (D1). Refuses if the period already exists. | PERIOD_OPENED |
| F2 | `rpc_costing_preflight_approval(p_run)` (read-only) | Returns each check as pass/fail: run SUCCESS + captured context; period OPEN; no QUEUED/RUNNING run; RUN_SUCCESS fingerprint exists and verifies with 0 drift; blocked / review / ready counts; current approved run (if any); newer draft | — |
| F3 | `rpc_costing_approve_run(p_run, reason, ref)` | All F2 checks pass. **No other APPROVED run in the period** (otherwise use F6). BLOCKED SKUs: rule D5. Calls `rpc_designate_costing_run(run,'APPROVED',name,reason)` (it captures the DESIGNATION fingerprint). | RUN_APPROVED (+ counts, fingerprint id) |
| F4 | `rpc_costing_lock_period(p_period, reason, ref)` | OPEN/DRAFT → LOCKED/LOCKED. Needs an APPROVED run, no active run, 0 drift on the approved run. Sets `locked_at/by/reason/approval_reference`. | PERIOD_LOCKED |
| F5 | `rpc_costing_reopen_period(p_period, reason, ref)` | LOCKED → OPEN/DRAFT only (never from CLOSED, D4). The approved run **stays approved** and stays in the feed until superseded. Sets `reopened_*`. | PERIOD_REOPENED |
| F6a | `rpc_costing_authorise_supersession(p_period, reason, ref, p_valid_minutes default 120)` | Period OPEN (reopened) and holds an APPROVED run. Wraps `rpc_authorize_period_refresh`. | SUPERSESSION_AUTHORISED |
| F6b | `rpc_costing_supersede_approved_run(p_new_run, reason, ref)` | New run SUCCESS in the same period and finished after the approved run. Its header consumed a supersession authorisation (`consumed_by_run_id = new run`). F2 checks pass. In **one transaction**: designate the old run REVOKED, then the new run APPROVED. Old rows are kept. | RUN_SUPERSEDED (old, new, authorisation id) |
| F7 | `rpc_costing_close_period(p_period, reason, ref)` | Wraps the existing `rpc_close_cost_period`, unchanged. Plus: period must be LOCKED (D3). Irreversible. | PERIOD_CLOSED |
| H1 | Hardening | Add the truncate guard to `costing_run_fingerprint_rebaseline` (parity gap). Make approval single-valued: F3/F6b are the only client paths, and direct designate stays service_role. Optional: a guard trigger refusing a second effective APPROVED per period. | — |

**Sequence for a correction after lock:** F5 reopen → F6a authorise → refresh (existing) → review → F6b supersede → F4 lock → (later) F7 close.

## 3. Client ("Period & runs" panel)
- **New module** `public/shared/js/costing-period-governance.js`, mounted in the Costing Control Center. No WP07 files are touched.
- **Month list** from `v_costing_pricing_period_run_status`: status, label, approved run, newer draft, active run.
- **Buttons are enabled by state and permission:**
  - Open next month
  - Approve run (shows the F2 preflight checklist first)
  - Lock
  - Reopen
  - Authorise supersession
  - Supersede with run N
  - Close (shows the drift check, then an extra "irreversible" confirmation)
- **Every action** opens a dialog with reason (≥10 chars) and approval reference. It then calls the public wrapper and refreshes the W1 badge and status.
- **Visible to users without permission:** read-only state, with no buttons.

## 4. Local build plan (no live)
1. Extend the `w1w5` fixture:
   - add `cost_period_governance_audit`, `rpc_ensure_cost_period`, `fn_default_cost_period_valuation_date`, `rpc_authorize_period_refresh` and `rpc_request_costing_refresh` (stubbed to insert a run) from the live definitions
   - add a permission stub with allow/deny switches per role
2. Write `PREPARED_W2_governed_period_lifecycle.sql` (outside `supabase/migrations`) with definition-md5 prechecks on every function it wraps.
3. **Tests:**
   - each happy path on a simulated November
   - each refusal: wrong state, active run, drift, second approval, no authorisation, expired authorisation, close from OPEN, reopen from CLOSED, no permission
   - full correction sequence on October (reopen → supersede 128 by a simulated 129 → lock): feed switches only at F6b; run 128 rows unchanged and its fingerprint clean
   - September untouched
   - audit rows complete
   - existing functions unchanged (hash set)
4. Client branch off `costing/w1-approved-run-labels`, with node tests of the button-state logic.
5. Report, then ask for live approval as a separate step.

## 5. Decisions needed
- **D1 Default valuation date** for a newly opened month. Options:
  - (a) keep today's rule (current month → the day it is opened)
  - (b) always the 1st
  - (c) always month end
  - (d) a fixed day of the month
  - Proposed: (a) for the current month, with an explicit date field in F1. Valuation date changes stay governed while the month is OPEN.
- **D2 Roles:** who may open, approve, lock, reopen, authorise supersession, supersede and close.
  - Proposed: a new permission target `module:costing-period-governance`. *Edit* allows open, lock and reopen; *approve*-level, for you only, allows approve, supersede, authorise and close. Refresh requests keep `module:costing-control-center` edit.
  - Also decide whether approval needs a second person (four-eyes).
- **D3 Close requires LOCKED first?** Proposed yes.
- **D4 Reopen after CLOSED?** Proposed never: CLOSED is final, and corrections go into the next month.
- **D5 Approval with exceptions:** proposed to refuse if any BLOCKED SKU, and to allow REVIEW_REQUIRED with the count recorded in the audit (Oct 128 had 37).
- **D6 Open-next scope:** only the month after the latest period (proposed), or any future month?
- **D7 Supersession authorisation** validity (proposed 120 minutes). Should it need a different person from the one who supersedes?
- **D8 September:** it is LOCKED (approved run 122, 0 drift). It stays as is and is not closed, per your instruction. Its close becomes a client action after W2.
- **D9 Feed contract follow-ups:**
  - C1: SELECT-only grants on the public W1 views
  - C2: feed v2 columns
  - C3: fingerprint id column
  - Each could be bundled into the W2 migration or done separately.
