# First governed client-triggered refresh — runbook (PREPARED, NOT EXECUTED) — 2026-10-16 14:20 IST

## 1. Target
- **Period September 2026**: status OPEN, valuation date 2026-09-10 (status DRAFT). The October period does not exist and must not be created for this run.
- **What the user clicks:**
  1. In the costing suite, set the period selector to **September 2026**.
  2. Click the toolbar refresh button.

  This calls `requestStagedCostingRefresh` in `public/shared/js/costing-suite-shell.js`, which runs `rpc_request_costing_refresh` (source UI_TOOLBAR) and then polls `rpc_get_costing_refresh_status`. Runs 118 and 119 were started the same way.
- **Warning:** the client defaults to the current month (October) if no period is selected.

## 2. Ledger switch (needs approval)
Pre-fix found read-only: the ledger has *Registration Charges* at ₹0, but the engine provision is ₹2,400. This is not a user decision, so align it before switch-on:
```sql
update costing.cost_head_policy_ledger set normal_monthly_amount=2400, basis=basis||' | aligned to engine provision 2026-10-16' where head_name='Registration Charges' and effective_to is null and normal_monthly_amount=0;
update costing.cost_head_policy_switch set is_enabled=true, changed_by='Dr. Brahmadathan U', changed_at=now(), note='first governed run <approval ref>';
-- ROLLBACK: update costing.cost_head_policy_switch set is_enabled=false, changed_at=now();
```

## 3. Pre-run checks and job 61
- **Pre-run checks** (all must pass):
  - `select count(*) from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')` returns 0.
  - Cron jobs 60 and 61 both have active = false.
  - The ledger switch is on.
- **Why job 61 is needed:** the client only *requests* a run and polls its status; stages are executed by cron job 61. Run 119's stage times were 0.1 / 37.5 / 82.1 / 33.4 / 27.5 / 0.1 s, but the app's database role (`authenticated`) has an 8 s statement timeout. So the client cannot drive the stages itself.
- **Window:** enable job 61 only for the run, then pause it again. Job 60 stays paused throughout.
```sql
select cron.alter_job(61, active:=true);   -- just before the click
-- after status SUCCESS/FAILED (≈3–5 min):
select cron.alter_job(61, active:=false);
```
The stale PENDING stages belong to FAILED runs and are not picked up (the processor selects only QUEUED or RUNNING runs).

## 4. Expected effect vs run 118 (September, ₹/mo; read-only simulation)
| Pool | Run 118 total | Expected | Δ | Driver |
|---|---|---|---|---|
| FINANCE_ADMIN | 15,60,520 | 2,03,050 | −13,57,470 | Interest excluded (−13,89,595); 3 accounts staff +34,525 |
| PRODUCTION_OVERHEAD | 10,16,035 | 6,70,935 | −3,45,100 | Fuel 4,79,590→1,61,969; Repairs 69,458→41,978 |
| MATERIALS_STORES | 2,64,869 | 2,60,508 | −4,361 | P&F 9,979→5,619; carriage inward unchanged (67,725 reclass waits for material side) |
| DIRECT_LABOUR | 13,27,802 | 13,69,652 | +41,850 | 4 packing technicians |
| ADMIN, QC, MARKETING | — | unchanged | 0 | Central Office method retained; Mess unchanged |

Plus the master-data fixes (material cost per pack, estimated): SKU 859 ≈ ₹2.65; SKU 1277 ≈ ₹1.67; SKU 879 (0.02→0.001 with 32 Kg) is expected to fall sharply.

## 5. Post-run acceptance (read-only, live)
Run `acceptance/first_approved_run_acceptance.sql` (part A, set `:run_id`) and `acceptance/policy_ledger_checks.sql` (part B) via MCP execute_sql with the literal run id.

**Pass criteria:**
- A: checks 1–5 and 7–12 PASS.
- B: checks 13–23 PASS; check 24 is a manual review of the top-cost SKUs and the 3 corrected SKUs.

**Known blocker:** part A check 6 requires the valuation date to be LOCKED or FINAL. September's is DRAFT, so APPROVED cannot be designated until the user locks it (a separate approval).

**APPROVED designation:** only after the user signs off on the acceptance output, via `rpc_designate_costing_run(<run_id>,'APPROVED',...)`.

**If acceptance fails:**
- The run stays non-designated (not APPROVED). Run 118/119 outputs remain intact; designated runs are guarded.
- Turn the ledger switch off.
- Make sure job 61 is paused again.
