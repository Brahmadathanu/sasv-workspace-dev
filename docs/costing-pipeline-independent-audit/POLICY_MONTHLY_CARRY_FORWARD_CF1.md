# Policy CF-1: Monthly carry-forward of costing acceptances + manual-rate review (DRAFT for approval)
Status: DRAFT, prepared 2026-10-18. Owner: Dr. Brahmadathan U (final authority). Proposed effective: November 2026 period (first use after the October run is approved).
SQL design: `proposals/rate_quality_oct/PROPOSED_monthly_carry_forward_rule_CF1.sql`. UI: AU-8 (section 8).

## 1. Purpose
Acceptances today are scoped to one period and valuation date, so every month restarts from zero: Oct needed 841 material + 65 quantity-driver + 214 regional-marketing decisions. CF-1 carries forward what is unchanged and immaterial. It sends the user only what is new, changed or material.

## 2. Scope
| Kind | Register | Carried by CF-1 |
|---|---|---|
| Material rate review | material_review_acceptance_register | yes (rules 3.1) |
| Monthly quantity driver (default volume) | sales_allocation_quantity_driver_acceptance | yes (3.2) |
| Regional marketing evidence | regional_marketing_evidence_acceptance | yes (3.3) |
| Run approval, valuation-date lock | costing_run_designation / cost_periods | NO, always the user |
| Normal rates, driver policies, cost-head ledger, plans, recurring provisions | effective-dated tables | not needed (carry by date) |

## 3. Rules (all must hold; otherwise the item goes to the user)
Common: a prior-period ACTIVE acceptance exists for the same key; the new run is SUCCESS; chain age < 12 months (3.4); the item is not on the exclusion list (3.5).
### 3.1 Material (key: stock item + material area)
- Same rate_source, manual_rate_id, purchase_fact_id and stock_valuation_source as the accepted evidence.
- |selected rate change| <= 5%.
- Materiality band A_IMMATERIAL or B_MODERATE (band C never auto-carries: true purchase rates may lead Tally).
- If the rate is a manual rate: today <= review_due_on (section 4).
### 3.2 Quantity driver (key: SKU)
- Same monthly_driver_source and default scenario / plan.
- Resolved monthly units within ±10%.
- Plan (if any) not expired; default age < 12 months.
### 3.3 Regional marketing (key: SKU + region)
- Same regional_basis_source and marketing_value_source.
- Per-SKU-region marketing value within ±10%.
### 3.4 Chain expiry
A carried acceptance records `carried_from_id` and `chain_started_on` (the original user decision). When chain age reaches 12 months, the item goes to the user for re-confirmation, even if unchanged.
### 3.5 Exclusions (always the user)
New items or SKUs; source change; band C; tolerance breach; expired manual rate or plan; items the user closed or undid in the previous period; any BLOCKED status.

## 4. Manual material rates: 6-month review
- New column review_due_on = effective_from + 6 months (backfill for the 95 ACTIVE open-ended rates).
- Inside the date the rate stays effective as now. The review date controls carry-forward and visibility only; it never silently changes cost.
- Past the date: material lines using the rate are not auto-carried. They appear in the user list as "manual rate review due", and the user re-confirms (new date +6 months) or replaces the rate.
- Reminder: 30 days before the due date (badge, section 8).

## 5. Thresholds (governed table acceptance_carry_forward_rule, effective-dated)
| Rule | Value tolerance | Bands | Chain |
|---|---|---|---|
| CF1_MATERIAL | 5% | A, B | 12 months |
| CF1_QTY_DRIVER | 10% (units) | - | 12 months |
| CF1_REGIONAL | 10% (value) | - | 12 months |
Changes to thresholds are new effective-dated rows with an approval reference. They are never edited in place.

## 6. Audit
Each carry is a normal ACTIVE acceptance row written through the existing accept RPCs, so the evidence-stamping triggers still fire. It carries:
- acceptance_reason `AUTO-CARRY CF-1 <rule> from #<prior id>`
- approval_reference `CF-1/<policy approval ref>`
- actor: the CF-1 service identity
- carried_from_id, chain_started_on
A per-run summary row records the run id, rule version, counts carried / to user per kind, and the executor.

## 7. Undo
- Per item: "Undo carry" closes the carried acceptance (status CLOSED, reason required, actor = user). The item returns to the user list. Audit retained, nothing deleted.
- Per run: "Undo all carries for run N" closes every CF-1 row of that run (single guarded action).
- Undo before approval changes only control status. A rerun is needed only if the user then changes evidence (rate, BOM, plan).

## 8. Monthly flow and what reaches the user
1. Month opens → first run (job 61 window) → CF-1 PREVIEW (read-only) → CF-1 APPLY (needs module:costing-control-center; can be scheduled after user opt-in).
2. The user sees only the "Needs review" list: new, changed, band C, tolerance breach, expired manual rate/plan, chain at 12 months.
3. After decisions: rerun if evidence changed → acceptance harness → user approves and locks.
Oct back-test: material 645/841 automatic, quantity driver 62/65, regional 207/214.

## 9. AU-8 UI specification (Costing Control Centre)
### 9.1 Carry-forward panel (per period / run)
- Header: run id, valuation date, CF-1 rule version, counts (Carried / Needs review / Closed-undone) for each kind.
- Tabs: **Needs review** (default) | **Carried** | **Undone/closed**.
- Columns: kind, item/SKU (+region), material area, old → new evidence (rate, source, units/value), Δ%, band, reason code (NEW, SOURCE_CHANGED, BAND_C, OVER_TOLERANCE, MANUAL_RATE_DUE, PLAN_EXPIRED, CHAIN_12M), carried_from link, chain start.
- Filters: kind, reason code, band, Δ% range, material area. Export CSV.
### 9.2 Actions
- Needs review: **Accept** (reason required), **Accept selected (bulk)** (reason required, max 200 per action, count confirmation), open **Drill-down** (existing material/SKU route).
- Carried: **Undo carry** (reason required), **Undo all for run** (two-step confirmation).
- No edit of rates, BOMs or batch sizes from this panel. Links go to the governed screens. The RM BOM editor stays read-only until its Apply/Save bug is fixed.
### 9.3 Badges
- Manual rates: `Review due in N days` (amber at ≤30 days), `Review overdue` (red), on the material line, the manual-rate register and the panel.
- Plans and defaults: `Plan expires DATE`, `Default age N/12 months`.
- Acceptances: `Carried (CF-1)` vs `User-accepted`, with a tooltip showing the chain start.
### 9.4 Permissions and server contract
- View: costing viewer. Accept/undo: `module:costing-control-center`. Threshold changes: costing admin plus approval reference.
- Server RPCs (to build): `rpc_carry_forward_period_acceptances(run_id, mode PREVIEW|APPLY)`, `rpc_undo_carry_forward(acceptance_kind, acceptance_id, reason)`, `rpc_undo_carry_forward_run(run_id, reason)`, `rpc_get_carry_forward_panel(run_id)`.
- The UI shows server status text and never computes eligibility client-side.
### 9.5 Acceptance tests (AU-8)
1. PREVIEW writes nothing.
2. APPLY counts equal PREVIEW.
3. A carried row passes the existing matcher for the new valuation date.
4. Undo returns the item to Needs review and the run flag reappears after rerun.
5. Band C never appears under Carried.
6. An overdue manual rate appears under Needs review.
7. Chain-12 forces review.
8. Run 122 / Sep are untouched.

## 10. Not in scope
Approval/lock automation; time-based spreading; Tally issue register; automatic rate refresh from Tally (R3 caveat).
