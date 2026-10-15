-- AU-3 tests on SYNTHETIC data (no real ledger figures are committed). Run via run-local.sh.
\set ON_ERROR_STOP 1
create schema if not exists au3_test;
create table au3_test.result (n serial, test text, outcome text, detail text);
create or replace function au3_test.check(p_test text, p_ok boolean, p_detail text) returns void language sql as
$$ insert into au3_test.result(test,outcome,detail) values (p_test, case when coalesce(p_ok,false) then 'PASS' else 'FAIL' end, p_detail) $$;
insert into costing.readiness_portfolio_source_epoch(source_relation)
select distinct format('%I.%I', n.nspname, c.relname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where t.tgname like 'wp04_readiness_epoch_%' on conflict do nothing;
insert into costing.cost_periods(period_start, period_end, status, valuation_date, valuation_date_source, valuation_date_status, valuation_date_set_at)
values ('2026-10-01','2026-10-31','OPEN','2026-10-10','SYSTEM_DEFAULT','DRAFT',now());
insert into costing.expense_head_costing_map(expense_group, head_name, allocation_pool, include_in_costing, is_active)
values ('Direct Expenses','Power','PRODUCTION_OVERHEAD',true,true),('Indirect Expenses','Rent','ADMIN_OVERHEAD',true,true);
-- Head A=Power, B=Rent. FY25-26: FYTD, partial pull 2026-03-17, FYTD again at FY end.
-- FY26-27: FYTD to 08-07, reset window from 08-08, reset again 09-04 (mirrors the live pattern).
insert into public.tally_expenses_snapshot(as_of_date, expense_group, head_name, net_cb_value, source_key)
select d::date, g, h, v, 'synthetic' from (values
 ('2025-08-28',500,250),('2026-03-17',5,2),('2026-03-31',1200,600),
 ('2026-04-30',100,50),('2026-05-31',250,100),('2026-06-15',300,120),('2026-06-30',400,150),('2026-07-31',600,200),
 ('2026-08-07',650,210),('2026-08-08',20,5),('2026-08-31',180,40),('2026-09-02',200,45),('2026-09-04',10,3),('2026-09-30',150,30)
) x(d,a,b) cross join lateral (values ('Direct Expenses','Power',a::numeric),('Indirect Expenses','Rent',b::numeric)) y(g,h,v);

select au3_test.check('R1 FY start opens FYTD regime', (select basis='FYTD' and window_start='2026-04-01' and window_start_basis='FY_START' from costing.v_tally_snapshot_regime where as_of_date='2026-04-30'), 'regime');
select au3_test.check('R2 2026-08-08 detected as reset window', (select basis='RESET_WINDOW' and window_start='2026-08-08' and window_start_basis='INFERRED_RESET_DATE' from costing.v_tally_snapshot_regime where as_of_date='2026-08-08'), 'regime');
select au3_test.check('R3 2026-08-31 stays in 08-08 window (not FYTD)', (select basis='RESET_WINDOW' and window_start='2026-08-08' from costing.v_tally_snapshot_regime where as_of_date='2026-08-31'), 'regime');
select au3_test.check('R4 2026-09-04 opens a new window', (select window_start='2026-09-04' and (evidence->>'opens_regime')::boolean from costing.v_tally_snapshot_regime where as_of_date='2026-09-04'), 'regime');
select au3_test.check('R5 partial pull 2026-03-17 flagged as window', (select basis='RESET_WINDOW' from costing.v_tally_snapshot_regime where as_of_date='2026-03-17'), 'regime');
select au3_test.check('R6 FY-end 2026-03-31 recognised as FYTD again', (select basis='FYTD' from costing.v_tally_snapshot_regime where as_of_date='2026-03-31'), 'regime');
select au3_test.check('R7 regime count', (select count(distinct regime_seq)=6 from costing.v_tally_snapshot_regime), (select count(distinct regime_seq)::text from costing.v_tally_snapshot_regime));

create temp table n1 as select * from costing.v_tally_expense_head_month_normalised where head_name='Power';
select au3_test.check('N1 Apr-Jul FYTD months differenced and COMPLETE', (select array_agg(month_value order by month_start)='{100,150,150,200}' and bool_and(completeness='COMPLETE') from n1 where month_start between '2026-04-01' and '2026-07-01'), (select string_agg(month_value::text||completeness,',' order by month_start) from n1 where month_start between '2026-04-01' and '2026-07-01'));
select au3_test.check('N2 Aug stitched: FYTD 1-7 Aug (50) + window to 31 Aug (180) = 230', (select month_value=230 from n1 where month_start='2026-08-01'), (select month_value::text from n1 where month_start='2026-08-01'));
select au3_test.check('N3 Aug PROVISIONAL because window start is inferred', (select completeness='PROVISIONAL' and quality_flags='{WINDOW_START_INFERRED}' from n1 where month_start='2026-08-01'), (select quality_flags::text from n1 where month_start='2026-08-01'));
select au3_test.check('N4 Sep = (200-180) + 150 with gap 09-03 flagged', (select month_value=170 and 'GAP_BETWEEN_REGIMES'=any(quality_flags) from n1 where month_start='2026-09-01'), (select month_value::text||quality_flags::text from n1 where month_start='2026-09-01'));
select au3_test.check('N5 lineage records both regimes for Aug', (select jsonb_array_length(lineage)=2 and lineage->0->>'basis'='FYTD' and lineage->1->>'basis'='RESET_WINDOW' and (lineage->1->>'contribution')::numeric=180 from n1 where month_start='2026-08-01'), 'lineage');
select au3_test.check('N6 old-logic defect reproduced: 08-31 value/5 months = 36 vs true Aug 230', (select 180/5.0 = 36 and month_value=230 from n1 where month_start='2026-08-01'), 'live view divides window value by elapsed FY months');

select au3_test.check('P1 running FY = verified FYTD 07-31 (600/4=150); window month-ends 08-31/09-30 not read as FYTD', (select standard_monthly_provision=150 and (lineage->>'months')::int=4 and lineage->>'fytd_snapshot_as_of_date'='2026-07-31' from costing.v_expense_head_monthly_provision_au3 where period_start='2026-10-01' and head_name='Power'), (select standard_monthly_provision::text||lineage::text from costing.v_expense_head_monthly_provision_au3 where period_start='2026-10-01' and head_name='Power'));
select au3_test.check('P2 completed-FY candidate taken only from verified FYTD FY-end snapshot', (select count(*)=1 from costing.v_tally_snapshot_regime where as_of_date='2026-03-31' and basis='FYTD'), 'fy-end');
select au3_test.check('P3 Rent: completed FY 600/12=50 beats running avg 50? tie -> latest FY', (select selected_financial_year_start='2026-04-01' from costing.v_expense_head_monthly_provision_au3 where period_start='2026-10-01' and head_name='Rent'), (select selected_financial_year_start::text||' '||standard_monthly_provision::text from costing.v_expense_head_monthly_provision_au3 where period_start='2026-10-01' and head_name='Rent'));

-- User-confirmed window start overrides inference
insert into costing.tally_snapshot_window_override(as_of_date_from, as_of_date_to, window_start, confirmed_by, reason)
values ('2026-08-08','2026-09-02','2026-08-01','Dr. Brahmadathan U','Tally export confirmed as MTD from 1 Aug (test)');
select au3_test.check('O1 override applied to regime', (select window_start='2026-08-01' and window_start_basis='USER_CONFIRMED' from costing.v_tally_snapshot_regime where as_of_date='2026-08-31'), 'override');
select au3_test.check('O1b with Aug confirmed COMPLETE, FYTD base extended: (600+180)/5=156', (select standard_monthly_provision=156 and lineage->>'basis'='RUNNING_FY_FYTD_PLUS_COMPLETE_MONTHS' from costing.v_expense_head_monthly_provision_au3 where period_start='2026-10-01' and head_name='Power'), (select standard_monthly_provision::text||' '||(lineage->>'basis') from costing.v_expense_head_monthly_provision_au3 where period_start='2026-10-01' and head_name='Power'));
create temp table n2 as select * from costing.v_tally_expense_head_month_normalised where head_name='Power';
select au3_test.check('O2 with confirmed MTD start, Aug=180 COMPLETE (FYTD 1-7 Aug superseded, no double count)', (select month_value=180 and completeness='COMPLETE' from n2 where month_start='2026-08-01'), (select month_value::text||completeness||quality_flags::text from n2 where month_start='2026-08-01'));
do $$ begin
  begin update costing.tally_snapshot_window_override set window_start='2026-08-02'; perform au3_test.check('O3 override table append-only', false, 'update succeeded');
  exception when others then perform au3_test.check('O3 override table append-only', sqlerrm like 'AU3_APPEND_ONLY%', sqlerrm); end;
end $$;
select au3_test.check('S1 no data modified in tally_expenses_snapshot', (select count(*)=28 from public.tally_expenses_snapshot), 'row count');

select n, outcome, test, left(detail,110) detail from au3_test.result order by n;
select count(*) filter (where outcome='PASS') passed, count(*) filter (where outcome<>'PASS') failed from au3_test.result;
