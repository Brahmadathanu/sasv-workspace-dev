# October 2026 rate-quality decision pack (run 124; read-only analysis 2026-10-16)
## 1. Why 612 material reviews (Sep: 2)
September's 854 ACTIVE acceptances in costing.material_review_acceptance_register are scoped by period and evidence. fn_material_review_acceptance_matches requires the same period_start AND source_valuation_date AND identical evidence (rate, source, rate date, manual-rate id, purchase-fact id, stock-valuation source, issue/warning codes). A new period or valuation date (2026-10-16) therefore matches none of them. This is by design, not a fault.
## 2. October issues (838 item-issues; value at risk = line value x monthly units = Rs 16.95 L/month)
Bands: A immaterial (<1% of any pack cost and <Rs 1,000/month), B moderate (<5% and <Rs 10,000), C material.
| Issue | A | B | C | Same evidence as an accepted Sep item | C value/month |
|---|---|---|---|---|---|
| Stale purchase rate (432) | 120 | 207 | 105 | 401 | 9.68 L |
| Stock-valuation fallback (334) | 128 | 164 | 42 | 9 (rate date moves daily); 328 within 5% of Sep rate | 1.89 L |
| Manual rate (67) | 31 | 22 | 14 | 66 | 2.70 L |
| Internal-source standard (5) | 2 | 1 | 2 | 0 | 0.12 L |
Top items by impact: Chayilyam (Rs 32,000/kg, Feb rate, Rs 4.24 L/month; SKU 975 pack line Rs 33,769 = 98% of cost: probable BOM qty/UOM error); Mathalam manual Rs 240 (Rs 1.63 L); Gorochanam stock valuation Rs 16.8 L/kg (Rs 0.91 L); Kadukurohini, Athivitayam, Rasam manual Rs 35,000, Pada Kizhangu, Kuzhiyaana (Rs 30, 2024 rate). Full list: classify_run124.sql.
## 3. Proposed rules
Approved policy (existing): acceptances are per period, per valuation date and evidence-bound. The Tally issue register is not used. No time-based spreading.
Provisional (needs your approval):
- R1 Auto-accept (carry): stale or manual with identical evidence to a Sep acceptance, bands A and B: 357 items.
- R2 Auto-accept: stock-valuation fallback with rate within 5% of the Sep-accepted rate, bands A and B: 288 items.
- R3 Refresh rate: band C stale (105): latest Tally purchase voucher (purchase register, not the issue register), else a manual rate with quote evidence. 96 have unchanged Sep evidence and could be carried if you prefer.
- R4 User decision: band C manual (14), C stock valuation (42; 40 within 5%), internal-source (5), new items without Sep evidence (35), plus the Chayilyam BOM check.
Open authorisations: R1/R2 rule approval; the live acceptance writes; an October rerun after acceptance (snapshots are immutable, so the effect needs a new run). Rule-based carry as a standing engine feature belongs to AU-8.
## 4. SQL proposal (NOT applied)
Uses the sanctioned 10-argument costing.rpc_accept_material_review_action (audit fields: accepted_by = user, reason, source evidence), one call per action-queue row, in one transaction with the user's identity (needs auth.uid()):
```sql
begin;
select set_config('request.jwt.claims', json_build_object('sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6','role','authenticated')::text, true);
-- candidate list = R1 + R2 rows from classify_run124.sql, materialised to temp table _carry(stock_item_id, material_area)
select costing.rpc_accept_material_review_action(
  date '2026-10-01', q.stock_item_id, q.material_area, 'REVIEW_REQUIRED', q.recommended_ui_route,
  q.issue_codes, q.warning_codes, q.action_required_summary,
  'Oct 2026 carry per user rule R1/R2 (USER-RULE-RATECARRY-202610): evidence identical to Sep acceptance or SV rate within 5%; materiality band A/B',
  'run 124; source acceptance period 2026-09')
from costing.material_costing_action_queue_snapshot q join _carry c using (stock_item_id, material_area)
where q.period_start='2026-10-01' and q.action_severity='REVIEW_REQUIRED';
-- verify count = expected (645), then commit; otherwise rollback
```
Argument order must be checked against the function signature before execution (date, bigint, text x 8). Then: October rerun (job 61 window) and acceptance.

## 5. Applied 2026-10-17 (user approved R1+R2)
APPLIED_r1r2_acceptance_20261017.sql: an atomic DO block run as the approver identity (auth.uid() verified) through the 10-argument rpc_accept_material_review_action. It aborts unless exactly 645 are accepted and 645 register rows carry valuation 2026-10-16 / run 124. Result: 645 ACTIVE (RM 252, PM 393), every row evidence-fingerprinted by trigger, accepted_by dff17104. September's 854 rows are untouched. Remaining queue: 196 rows. Decision list: evidence/AU5/OCT_band_C_rate_decisions.csv (193 items; bandc.sql). R3 auto-refresh from Tally is withdrawn per the user (Tally may lag real purchase prices).
