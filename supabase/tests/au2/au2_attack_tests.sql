-- AU-2 adversarial tests (A6 spec). LOCAL PARITY DB ONLY. Synthetic fixtures; never run against production.
\set ON_ERROR_STOP on
set client_min_messages = warning;
create schema if not exists au2_test;
create table au2_test.result (n serial, test text, outcome text, detail text);
create or replace function au2_test.expect_error(p_test text, p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    insert into au2_test.result(test,outcome,detail) values (p_test, case when sqlerrm ~ p_pattern then 'PASS' else 'FAIL' end, left(sqlerrm,160));
    return;
  end;
  insert into au2_test.result(test,outcome,detail) values (p_test,'FAIL','statement succeeded but should have been refused');
end $$;
create or replace function au2_test.expect_ok(p_test text, p_sql text) returns void language plpgsql as $$
begin execute p_sql; insert into au2_test.result(test,outcome,detail) values (p_test,'PASS','ok');
exception when others then insert into au2_test.result(test,outcome,detail) values (p_test,'FAIL',left(sqlerrm,160)); end $$;
create or replace function au2_test.check(p_test text, p_cond boolean, p_detail text) returns void language sql as $$
  insert into au2_test.result(test,outcome,detail) values (p_test, case when p_cond then 'PASS' else 'FAIL' end, p_detail) $$;

grant usage on schema au2_test to authenticated, anon;
grant execute on all functions in schema au2_test to authenticated, anon;
grant insert, select on au2_test.result to authenticated, anon;
grant usage on all sequences in schema au2_test to authenticated, anon;
-- Fixture: register readiness-epoch source relations (live has these rows; schema-only DB does not)
insert into costing.readiness_portfolio_source_epoch(source_relation)
select distinct format('%I.%I', n.nspname, c.relname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where t.tgname like 'wp04_readiness_epoch_%' on conflict do nothing;
-- Fixtures: Sep-2026 OPEN/DRAFT; run 119 built while RUNNING then marked SUCCESS
insert into costing.cost_periods(period_start, period_end, status, valuation_date, valuation_date_source, valuation_date_status, valuation_date_set_at)
values ('2026-09-01','2026-09-30','OPEN','2026-09-10','GOVERNED_MANUAL','DRAFT',now()),
       ('2026-10-01','2026-10-31','OPEN','2026-10-10','SYSTEM_DEFAULT','DRAFT',now());
insert into costing.costing_refresh_run(id, period_start, requested_scope, source_trigger, overall_status, valuation_date,
  period_status_at_request, valuation_date_status_at_request, valuation_context_source, valuation_context_captured_at, requested_at, finished_at)
values (119,'2026-09-01','FULL_COSTING_REFRESH','MANUAL','RUNNING','2026-09-10','OPEN','DRAFT','CAPTURED_AT_REQUEST',now(),now(),now());
insert into costing.sku_manufacturing_cop_snapshot(period_start, valuation_date, refresh_run_id, allocation_basis_snapshot_id, sku_id, product_id, manufacturing_cop_per_sku, manufacturing_cop_status)
values ('2026-09-01','2026-09-10',119,1,193,184,5185.65,'READY'),('2026-09-01','2026-09-10',119,1,988,783,4623.05,'READY');
insert into costing.sku_prime_cost_snapshot(period_start, valuation_date, refresh_run_id, allocation_basis_snapshot_id, sku_id, product_id) values ('2026-09-01','2026-09-10',119,1,193,184);
insert into costing.sku_overhead_allocation_snapshot(period_start, valuation_date, refresh_run_id, allocation_basis_snapshot_id, sku_id, product_id)
select '2026-09-01','2026-09-10',119,1,193,184;
update costing.costing_refresh_run set overall_status='SUCCESS', finished_at=now() where id=119;
select setval(pg_get_serial_sequence('costing.costing_refresh_run','id'), 119);

select au2_test.check('T00 fingerprint auto-captured at SUCCESS',
  exists(select 1 from costing.costing_run_fingerprint where refresh_run_id=119 and purpose='RUN_SUCCESS'), 'RUN_SUCCESS fingerprint row');
create temp table fp0 as select costing.fn_compute_run_fingerprint(119) fp;

-- Pre-designation: terminal-run guard already protects the 15 newly guarded tables
select au2_test.expect_error('T01 UPDATE SUCCESS-run COP row refused (terminal guard, pre-designation)',
  $q$update costing.sku_manufacturing_cop_snapshot set manufacturing_cop_per_sku=1 where refresh_run_id=119$q$, 'prohibited for terminal refresh run');

select au2_test.expect_ok('T02 designate run 119 REFERENCE (user recorded by name)',
  $q$select costing.rpc_designate_costing_run(119,'REFERENCE','Dr. Brahmadathan U','D-010 immutable historical reference')$q$);

select au2_test.expect_error('T03 new Sep-2026 refresh request refused (period holds REFERENCE run)',
  $q$insert into costing.costing_refresh_run(period_start, requested_scope, source_trigger, overall_status, valuation_date, period_status_at_request, valuation_date_status_at_request, valuation_context_source, valuation_context_captured_at) values ('2026-09-01','FULL_COSTING_REFRESH','UI_TOOLBAR','QUEUED','2026-09-10','OPEN','DRAFT','CAPTURED_AT_REQUEST',now())$q$,
  'AU2_PERIOD_HOLDS_DESIGNATED_RUN');

select au2_test.expect_error('T04 COP refresh RPC re-pointed at run 119 refused',
  $q$select * from costing.rpc_refresh_sku_manufacturing_cop_snapshot('2026-09-01'::date,'2026-09-10'::date,119::bigint)$q$, 'AU2_DESIGNATED_RUN_IMMUTABLE|prohibited for terminal|AU2_');

select au2_test.expect_error('T05a UPDATE run-119 COP row refused', $q$update costing.sku_manufacturing_cop_snapshot set manufacturing_cop_per_sku=1 where refresh_run_id=119$q$, 'AU2_DESIGNATED_RUN_IMMUTABLE|terminal');
select au2_test.expect_error('T05b DELETE run-119 prime row refused', $q$delete from costing.sku_prime_cost_snapshot where refresh_run_id=119$q$, 'AU2_DESIGNATED_RUN_IMMUTABLE|terminal');
select au2_test.expect_error('T05c INSERT new row into run 119 refused', $q$insert into costing.sku_overhead_allocation_snapshot(period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,sku_id,product_id) values ('2026-09-01','2026-09-10',119,1,1,1)$q$, 'AU2_DESIGNATED_RUN_IMMUTABLE|terminal');
select au2_test.expect_error('T05d TRUNCATE snapshot refused', $q$truncate costing.sku_manufacturing_cop_snapshot$q$, 'AU2_SNAPSHOT_TRUNCATE_PROHIBITED');
select au2_test.expect_error('T05e re-point row away from run 119 refused', $q$update costing.sku_manufacturing_cop_snapshot set refresh_run_id=null, valuation_date=null, allocation_basis_snapshot_id=null where refresh_run_id=119$q$, 'AU2_DESIGNATED_RUN_IMMUTABLE|terminal');
select au2_test.expect_error('T05f UPDATE on a previously-guarded table (cost_pool) for run 119 refused',
  $q$insert into costing.cost_pool_monthly_snapshot(refresh_run_id) values (119)$q$, 'AU2_DESIGNATED_RUN_IMMUTABLE|terminal|null value');
select au2_test.expect_error('T06 run-119 header status change refused', $q$update costing.costing_refresh_run set overall_status='RUNNING' where id=119$q$, 'AU2_DESIGNATED_RUN_IMMUTABLE');
select au2_test.expect_error('T06b run-119 delete refused', $q$delete from costing.costing_refresh_run where id=119$q$, 'AU2_DESIGNATED_RUN_IMMUTABLE');
select au2_test.expect_error('T07 designation table is append-only', $q$update costing.costing_run_designation set designation='APPROVED'$q$, 'AU2_APPEND_ONLY');
select au2_test.expect_error('T07b fingerprint table is append-only', $q$delete from costing.costing_run_fingerprint$q$, 'AU2_APPEND_ONLY');

-- Concurrency (A6 test 4): only one QUEUED/RUNNING run per period+scope
select au2_test.expect_ok('T08a first Oct run queued', $q$insert into costing.costing_refresh_run(id,period_start, requested_scope, source_trigger, overall_status, valuation_date, period_status_at_request, valuation_date_status_at_request, valuation_context_source, valuation_context_captured_at) values (200,'2026-10-01','FULL_COSTING_REFRESH','CRON_DAILY','QUEUED','2026-10-10','OPEN','DRAFT','CAPTURED_AT_REQUEST',now())$q$);
select au2_test.expect_error('T08b second concurrent Oct run refused', $q$insert into costing.costing_refresh_run(id,period_start, requested_scope, source_trigger, overall_status, valuation_date, period_status_at_request, valuation_date_status_at_request, valuation_context_source, valuation_context_captured_at) values (201,'2026-10-01','FULL_COSTING_REFRESH','UI_TOOLBAR','QUEUED','2026-10-10','OPEN','DRAFT','CAPTURED_AT_REQUEST',now())$q$, 'uq_costing_refresh_run_one_active_period_scope|duplicate key');

-- Killed stage (A6 test 5): partial rows of a FAILED run never become current
update costing.costing_refresh_run set overall_status='RUNNING' where id=200;
insert into costing.sku_manufacturing_cop_snapshot(period_start, valuation_date, refresh_run_id, allocation_basis_snapshot_id, sku_id, product_id) values ('2026-10-01','2026-10-10',200,1,193,184);
update costing.costing_refresh_run set overall_status='FAILED', error_message='simulated kill' where id=200;
select au2_test.check('T09 FAILED run with partial rows not selected as current',
  not exists(select 1 from costing.v_current_successful_costing_refresh_run where refresh_run_id=200), 'Oct has no current run');
select au2_test.expect_ok('T09b FAILED (non-designated) run rows still cleanable', $q$delete from costing.sku_manufacturing_cop_snapshot where refresh_run_id=200$q$);

-- Unauthorised caller (A6 test 6)
grant usage on schema costing to authenticated;
set role authenticated;
select au2_test.expect_error('T10a authenticated cannot designate', $q$select costing.rpc_designate_costing_run(119,'APPROVED','x','attempted self approval')$q$, 'permission denied');
select au2_test.expect_error('T10b authenticated cannot authorise supersession', $q$select costing.rpc_authorize_period_refresh('2026-09-01','x','attempted bypass xx')$q$, 'permission denied');
select au2_test.expect_error('T10c authenticated cannot close period', $q$select costing.rpc_close_cost_period('2026-09-01','x','attempted close xxxx','ref')$q$, 'permission denied');
select au2_test.expect_error('T10d authenticated cannot write snapshots directly', $q$delete from costing.sku_manufacturing_cop_snapshot$q$, 'permission denied');
reset role;

-- Governed supersession (deliberate run selection)
select au2_test.expect_ok('T11a user records supersession authorisation', $q$select costing.rpc_authorize_period_refresh('2026-09-01','Dr. Brahmadathan U','test supersession for AU-2',30)$q$);
select au2_test.expect_ok('T11b authorised Sep request accepted (run 120)', $q$insert into costing.costing_refresh_run(id,period_start, requested_scope, source_trigger, overall_status, valuation_date, period_status_at_request, valuation_date_status_at_request, valuation_context_source, valuation_context_captured_at) values (120,'2026-09-01','FULL_COSTING_REFRESH','UI_TOOLBAR','QUEUED','2026-09-10','OPEN','DRAFT','CAPTURED_AT_REQUEST',now())$q$);
select au2_test.check('T11c authorisation consumed by run 120', exists(select 1 from costing.costing_period_refresh_authorization where consumed_by_run_id=120), 'consumed_by_run_id=120');
update costing.costing_refresh_run set overall_status='SUCCESS', finished_at=now()+interval '1 minute' where id=120;
select au2_test.expect_error('T11d authorisation is single-use', $q$insert into costing.costing_refresh_run(id,period_start, requested_scope, source_trigger, overall_status, valuation_date, period_status_at_request, valuation_date_status_at_request, valuation_context_source, valuation_context_captured_at) values (121,'2026-09-01','FULL_COSTING_REFRESH','UI_TOOLBAR','QUEUED','2026-09-10','OPEN','DRAFT','CAPTURED_AT_REQUEST',now())$q$, 'AU2_PERIOD_HOLDS_DESIGNATED_RUN');
select au2_test.check('T12 current run = designated 119 even though 120 finished later',
  (select refresh_run_id=119 and selection_basis='REFERENCE' from costing.v_current_successful_costing_refresh_run where period_start='2026-09-01'),
  (select format('current=%s basis=%s', refresh_run_id, selection_basis) from costing.v_current_successful_costing_refresh_run where period_start='2026-09-01'));

-- Period close
select au2_test.expect_error('T13a close refused with only REFERENCE designation', $q$select costing.rpc_close_cost_period('2026-09-01','Dr. Brahmadathan U','close september test','TEST-REF')$q$, 'AU2_CLOSE_REQUIRES_APPROVED_RUN');
select au2_test.expect_ok('T13b designate 119 APPROVED', $q$select costing.rpc_designate_costing_run(119,'APPROVED','Dr. Brahmadathan U','approved reference for close test')$q$);
select au2_test.expect_error('T13c close refused without evidence', $q$select costing.rpc_close_cost_period('2026-09-01','','short','')$q$, 'AU2_CLOSE_EVIDENCE_REQUIRED');
select au2_test.expect_ok('T13d governed close succeeds', $q$select costing.rpc_close_cost_period('2026-09-01','Dr. Brahmadathan U','close september test','TEST-REF')$q$);
select au2_test.check('T13e period CLOSED/FINAL with evidence', (select status='CLOSED' and valuation_date_status='FINAL' and close_approval_reference like '%run=119%' from costing.cost_periods where period_start='2026-09-01'), 'cost_periods row');
select au2_test.expect_error('T13f closing twice refused', $q$select costing.rpc_close_cost_period('2026-09-01','Dr. Brahmadathan U','close september test','TEST-REF')$q$, 'AU2_PERIOD_ALREADY_CLOSED');
select au2_test.check('T12b current run = APPROVED 119', (select refresh_run_id=119 and selection_basis='APPROVED' from costing.v_current_successful_costing_refresh_run where period_start='2026-09-01'), 'approved wins');

-- Fingerprint unchanged after all attacks (A6 test 7)
select au2_test.check('T14 run-119 fingerprint unchanged after all attacks', costing.fn_compute_run_fingerprint(119) = (select fp from fp0), 'compute vs pre-attack');
select au2_test.check('T14b verify function reports zero drift', not exists(select 1 from costing.fn_verify_run_fingerprint(119) where not matches), 'fn_verify_run_fingerprint');

select n, outcome, test, detail from au2_test.result order by n;
select count(*) filter (where outcome='PASS') as passed, count(*) filter (where outcome='FAIL') as failed from au2_test.result;
