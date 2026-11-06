-- Governed scenario (SYNTHETIC ids/values). Mirrors the live shape in #203/#204: 80/82 old OPEN drafts, 143 approved, 148 newer Oct draft, 149 Nov draft, 150 FAILED.
insert into costing.cost_periods values ('2026-07-01','OPEN','2026-07-31'),('2026-08-01','OPEN','2026-08-31'),('2026-09-01','CLOSED','2026-09-30'),
  ('2026-10-01','OPEN','2026-10-31'),('2026-11-01','OPEN','2026-11-02'),('2026-12-01','OPEN','2026-12-02'),('2027-01-01','OPEN','2027-01-02'),('2027-02-01','OPEN','2027-02-02');
-- (id, period, valuation, status, ctx, finished_at)
insert into costing.costing_refresh_run (id, period_start, valuation_date, overall_status, valuation_context_source, requested_at, finished_at) values
 (80 ,'2026-07-01','2026-07-31','SUCCESS','CAPTURED_AT_REQUEST','2026-08-01 10:00+00','2026-08-01 11:00+00'),
 (82 ,'2026-08-01','2026-08-31','SUCCESS','CAPTURED_AT_REQUEST','2026-09-01 10:00+00','2026-09-01 11:00+00'),
 (122,'2026-09-01','2026-09-30','SUCCESS','CAPTURED_AT_REQUEST','2026-10-01 10:00+00','2026-10-01 11:00+00'),
 (143,'2026-10-01','2026-10-31','SUCCESS','CAPTURED_AT_REQUEST','2026-11-01 10:00+00','2026-11-01 11:00+00'),
 (148,'2026-10-01','2026-10-31','SUCCESS','CAPTURED_AT_REQUEST','2026-11-04 20:00+00','2026-11-04 21:05+00'),
 (149,'2026-11-01','2026-11-02','SUCCESS','CAPTURED_AT_REQUEST','2026-11-04 21:10+00','2026-11-04 22:05+00'),
 (150,'2026-11-01','2026-11-02','FAILED' ,'CAPTURED_AT_REQUEST','2026-11-05 09:00+00',null),
 (155,'2026-12-01','2026-12-02','SUCCESS','CAPTURED_AT_REQUEST','2026-12-03 10:00+00','2026-12-03 11:00+00'),
 (156,'2026-12-01','2026-12-02','SUCCESS','CAPTURED_AT_REQUEST','2026-12-04 10:00+00','2026-12-04 11:00+00'),
 (160,'2027-01-01','2027-01-02','SUCCESS','CAPTURED_AT_REQUEST','2027-01-03 10:00+00','2027-01-03 11:00+00'),
 (161,'2027-02-01','2027-02-02','SUCCESS','CAPTURED_AT_REQUEST','2027-02-03 10:00+00','2027-02-03 11:00+00'),
 (170,'2027-02-01','2027-02-02','SUCCESS','USER_SUPPLIED'       ,'2027-02-04 10:00+00','2027-02-04 11:00+00');
insert into costing.run_designation_stub values (122,'APPROVED'),(143,'APPROVED'),(160,'REVOKED'),(161,'REFERENCE');

-- Source rows for every SUCCESS run x SKUs 41, 42, 105. Stage timestamps all precede finished_at (prime -20m, DL -30m, regional -25m, control -5m).
do $$ declare r record; s bigint; reg text; begin
  for r in select * from costing.costing_refresh_run where overall_status = 'SUCCESS' loop
    foreach s in array array[41, 42, 105] loop
      insert into costing.sku_prime_cost_snapshot values (r.period_start, r.valuation_date, r.id, s,
        case when s = 105 then 'BLOCKED' else 'READY' end, case when s = 42 then 'REVIEW_REQUIRED' else 'READY' end, r.finished_at - interval '20 min', 111.11 + r.id, 222.22);
      insert into costing.sku_internal_material_conversion_snapshot values (r.period_start, r.valuation_date, r.id, s, case when s = 42 then 'REVIEW_REQUIRED' else 'READY' end, 33.33);
      insert into costing.sku_direct_labour_allocation_snapshot values (r.period_start, r.valuation_date, r.id, s,
        case when s = 41 then 'REVIEW_REQUIRED' else 'READY' end, case when s = 41 then 'NO_SKU_SALES_IN_LOOKBACK' else null end,
        case when s = 41 then 'REVIEW_REQUIRED' else 'READY' end, null, 'Resolved: Rs 5,000 salary of Ramesh Kumar approved by finance', 'MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS',
        r.finished_at - interval '30 min', 44.44);
      insert into costing.sku_costing_control_status_snapshot values (r.period_start, r.valuation_date, r.id, s,
        case when s = 105 then 'MATERIAL_COST_BLOCKED' when s = 41 then 'DIRECT_LABOUR_REVIEW_REQUIRED' else 'READY' end,
        case when s = 105 then 'BLOCKER' when s = 41 then 'REVIEW' else 'INFO' end, 'PM rate 55.50 missing for line 7 (contact a@b.example)',
        case when s = 105 then 'BLOCKED' else 'READY' end, r.finished_at - interval '5 min', 111.11 + r.id);
      foreach reg in array array['IK', 'OK'] loop
        insert into costing.sku_regional_marketing_expense_allocation_snapshot values (r.period_start, r.valuation_date, r.id, s, reg,
          case when reg = 'OK' then 'REGION_SCALED_COMMON_BASIS' else 'REGIONAL_ACTUAL_UNITS' end, case when reg = 'OK' and s = 41 then 'REVIEW_REQUIRED' else 'READY' end,
          case when reg = 'OK' and s = 41 then 'REVIEW_REQUIRED' else 'READY' end, 'basis sales Rs 1,20,000 for region ' || reg, r.finished_at - interval '25 min', 1200000.00);
      end loop;
    end loop;
  end loop;
end $$;
-- Run 149 differs from 148 for SKU 41 so cross-run isolation is observable.
update costing.sku_direct_labour_allocation_snapshot set direct_labour_allocation_status = 'READY', allocation_reason_code = null, allocation_basis_status = 'READY' where refresh_run_id = 149 and sku_id = 41;
update costing.sku_costing_control_status_snapshot set first_control_status = 'READY', control_severity = 'INFO' where refresh_run_id = 149 and sku_id = 41;

insert into public.user_permissions_canonical values
 ('00000000-0000-4000-8000-000000000001','module:costing-control-center', true,  false),   -- CCC view only
 ('00000000-0000-4000-8000-000000000002','module:costing-control-center', true,  true),    -- CCC view + edit
 ('00000000-0000-4000-8000-000000000004','module:costing-control-center', false, true),    -- edit flag without view
 ('00000000-0000-4000-8000-000000000005','module:cost-sheet-review',      true,  true);    -- other module only
-- u...03 has no rows at all.
