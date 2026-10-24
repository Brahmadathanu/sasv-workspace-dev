-- PROPOSED DESIGN, NOT APPLIED. Governed monthly carry-forward rule CF-1, run after the first SUCCESS run of a period and before user review.
-- Every carried row is a new ACTIVE acceptance for the new period/valuation, reason 'AUTO-CARRY CF-1 from #<prior id>',
-- approval_reference 'CF-1/<policy approval>'. It is auditable and can be closed individually. Chains stop at 12 months, then the user re-confirms.
-- Material (band C never auto-carried: true purchase rates may lead Tally):
--   carry if the prior-period ACTIVE acceptance exists for item+area AND the same rate_source / manual_rate_id / purchase_fact_id / stock_valuation_source
--   AND |rate change| <= 5% AND band in (A_IMMATERIAL, B_MODERATE) AND any manual rate is within its review_due.
-- Quantity driver: carry if same monthly_driver_source/scenario AND units within +/-10% AND any plan is unexpired.
-- Regional marketing: carry if same regional_basis_source + marketing_value_source AND per-SKU-region value within +/-10%.
-- Everything else goes to the user queue (new item, changed source, material, band C, over tolerance).
-- Manual rates: add review_due_on (default effective_from + 6 months). Past due -> not carried, shown to the user.
alter table costing.material_manual_rates add column if not exists review_due_on date;
-- update costing.material_manual_rates set review_due_on = (effective_from + interval '6 months')::date where status='ACTIVE' and review_due_on is null;
create table if not exists costing.acceptance_carry_forward_rule (
  rule_code text primary key, acceptance_kind text not null check (acceptance_kind in ('MATERIAL','QTY_DRIVER','REGIONAL_MARKETING')),
  max_value_change_pct numeric not null, allowed_bands text[], max_chain_months int not null default 12,
  approval_reference text not null, effective_from date not null, effective_to date);
-- insert values ('CF1_MATERIAL','MATERIAL',5,'{A_IMMATERIAL,B_MODERATE}',12,'<USER-APPROVAL>','2026-11-01',null),
--               ('CF1_QTY_DRIVER','QTY_DRIVER',10,null,12,'<USER-APPROVAL>','2026-11-01',null),
--               ('CF1_REGIONAL','REGIONAL_MARKETING',10,null,12,'<USER-APPROVAL>','2026-11-01',null);
-- costing.rpc_carry_forward_period_acceptances(p_refresh_run_id bigint, p_mode text default 'PREVIEW') -> per kind: carried / to_user counts + rows.
--   PREVIEW is read-only; APPLY needs module:costing-control-center and writes through the existing accept RPCs, so the evidence stamping triggers still fire.
