-- AU-3b tests: explicit export-window contract (D-018) + ambiguity/inconsistency rejection paths. SYNTHETIC data only.
\set ON_ERROR_STOP 1
delete from au3_test.result;
delete from public.tally_expenses_snapshot; delete from costing.expense_head_costing_map; delete from costing.cost_periods;
create or replace function au3_test.cls(d text, rf text, rt text, f text, t text, decl text) returns text language sql as
$$ select coalesce(window_basis,'-')||'/'||status from public.fn_tally_classify_export_window(d::date, rf::date, rt::date, f::date, t::date, decl) $$;

-- Classifier truth table
select au3_test.check('C1 FYTD window accepted', au3_test.cls('2026-10-15','2026-04-01','2026-10-15','2026-04-01','2026-10-15','FYTD')='FYTD/ACCEPTED', au3_test.cls('2026-10-15','2026-04-01','2026-10-15','2026-04-01','2026-10-15','FYTD'));
select au3_test.check('C2 MTD window accepted', au3_test.cls('2026-10-15','2026-10-01','2026-10-15','2026-10-01','2026-10-15','MTD')='MTD/ACCEPTED', 'mtd');
select au3_test.check('C3 1-20 April is both FYTD and MTD (accepted for either declaration)', au3_test.cls('2026-04-20','2026-04-01','2026-04-20','2026-04-01','2026-04-20','MTD')='FYTD_AND_MTD/ACCEPTED', 'april');
select au3_test.check('C4 REJECT ambiguous: returned range missing', au3_test.cls('2026-10-15','2026-04-01','2026-10-15',null,null,'FYTD')='-/REJECTED_AMBIGUOUS', 'missing returned');
select au3_test.check('C5 REJECT ambiguous: requested range missing', au3_test.cls('2026-10-15',null,null,'2026-04-01','2026-10-15',null)='-/REJECTED_AMBIGUOUS', 'missing requested');
select au3_test.check('C6 REJECT ambiguous: live 08-08 pattern (window 08-08..08-31 is neither FYTD nor MTD)', au3_test.cls('2026-08-31','2026-08-08','2026-08-31','2026-08-08','2026-08-31',null)='-/REJECTED_AMBIGUOUS', au3_test.cls('2026-08-31','2026-08-08','2026-08-31','2026-08-08','2026-08-31',null));
select au3_test.check('C7 REJECT inconsistent: requested FYTD, Tally returned 08-08..', au3_test.cls('2026-08-31','2026-04-01','2026-08-31','2026-08-08','2026-08-31','FYTD')='-/REJECTED_INCONSISTENT', 'requested<>returned');
select au3_test.check('C8 REJECT inconsistent: period_to <> as_of_date', au3_test.cls('2026-10-15','2026-04-01','2026-10-14','2026-04-01','2026-10-14','FYTD')='-/REJECTED_INCONSISTENT', 'to<>as_of');
select au3_test.check('C9 REJECT inconsistent: from after to', au3_test.cls('2026-10-15','2026-10-16','2026-10-15','2026-10-16','2026-10-15',null)='-/REJECTED_INCONSISTENT', 'from>to');
select au3_test.check('C10 REJECT inconsistent: window crosses FY start', au3_test.cls('2026-04-10','2026-03-01','2026-04-10','2026-03-01','2026-04-10',null)='-/REJECTED_INCONSISTENT', 'cross FY');
select au3_test.check('C11 REJECT inconsistent: declared MTD but dates prove FYTD', au3_test.cls('2026-10-15','2026-04-01','2026-10-15','2026-04-01','2026-10-15','MTD')='FYTD/REJECTED_INCONSISTENT', 'declared vs proven');

-- Load path (as the ETL would call it, service_role)
create or replace function au3_test.stage(d date, g text, f date, t date, decl text, rows jsonb, job uuid default gen_random_uuid()) returns bigint language plpgsql as $$
declare v bigint; begin
  insert into public.tally_expense_export_batch(as_of_date, expense_group, source_key, etl_job_id, requested_from, requested_to, returned_from, returned_to, declared_basis)
  values (d, g, format('raw/%s/%s.xml', d, lower(replace(g,' ','_'))), job, f, t, f, t, decl) returning id into v;
  insert into public.tally_expense_export_staging(batch_id, head_name, net_cb_value) select v, k, (rows->>k)::numeric from jsonb_object_keys(rows) k;
  return v; end $$;
create temp table b as select
  au3_test.stage('2026-07-31','Direct Expenses','2026-04-01','2026-07-31','FYTD','{"Power":600,"Rent":200,"Fuel":400}') b1,
  au3_test.stage('2026-08-31','Direct Expenses','2026-04-01','2026-08-31','FYTD','{}') b_empty,
  au3_test.stage('2026-08-08','Direct Expenses','2026-04-01','2026-08-08','FYTD','{"Power":20,"Rent":5,"Fuel":9}') b_reset,
  au3_test.stage('2026-08-08','Indirect Expenses','2026-08-08','2026-08-08',null,'{"Audit":1}') b_custom;
select * from public.rpc_tally_validate_and_load_expense_batch((select b1 from b));
select au3_test.check('L1 FYTD batch accepted and loaded with lineage', (select count(*)=3 and bool_and(period_from='2026-04-01' and period_to='2026-07-31' and window_basis='FYTD' and export_batch_id=(select b1 from b)) from public.tally_expenses_snapshot where as_of_date='2026-07-31'), 'lineage');
select * from public.rpc_tally_validate_and_load_expense_batch((select b_empty from b));
select au3_test.check('L2 REJECT ambiguous: empty batch (empty export vs failed export indistinguishable)', (select status='REJECTED_AMBIGUOUS' from public.tally_expense_export_batch where id=(select b_empty from b)), (select status_reason from public.tally_expense_export_batch where id=(select b_empty from b)));
select * from public.rpc_tally_validate_and_load_expense_batch((select b_reset from b));
select au3_test.check('L3 REJECT inconsistent: claims FYTD but values fell like a reset (silent source switch)', (select status='REJECTED_INCONSISTENT' from public.tally_expense_export_batch where id=(select b_reset from b)), (select status_reason from public.tally_expense_export_batch where id=(select b_reset from b)));
select au3_test.check('L4 rejected batches never reach the snapshot', not exists(select 1 from public.tally_expenses_snapshot where as_of_date in ('2026-08-08','2026-08-31')), 'none loaded');
select * from public.rpc_tally_validate_and_load_expense_batch((select b_custom from b));
select au3_test.check('L4b REJECT ambiguous: custom window batch', (select status='REJECTED_AMBIGUOUS' from public.tally_expense_export_batch where id=(select b_custom from b)), 'custom');
select au3_test.check('L5 re-validation is a no-op (idempotent)', (select status='REJECTED_INCONSISTENT' and rows_loaded=0 from public.rpc_tally_validate_and_load_expense_batch((select b_reset from b))), 'no-op');
create temp table b2 as select au3_test.stage('2026-07-31','Direct Expenses','2026-04-01','2026-07-31','FYTD','{"Power":610,"Rent":200}') b1b;
select * from public.rpc_tally_validate_and_load_expense_batch((select b1b from b2));
select au3_test.check('L6 corrected reload supersedes earlier batch; head absent from new export removed', (select count(*)=2 and sum(net_cb_value)=810 from public.tally_expenses_snapshot where as_of_date='2026-07-31') and (select status='SUPERSEDED' from public.tally_expense_export_batch where id=(select b1 from b)), 'supersede');
create temp table b3 as select au3_test.stage('2026-09-30','Direct Expenses','2026-09-01','2026-09-30','MTD','{"Power":150,"Rent":50}') bm;
select * from public.rpc_tally_validate_and_load_expense_batch((select bm from b3));
select au3_test.check('L7 MTD batch accepted (explicit window)', (select status='ACCEPTED' and window_basis='MTD' from public.tally_expense_export_batch where id=(select bm from b3)), 'mtd');

-- Regime/normalisation integration: declared windows replace inference
select au3_test.check('R1 declared window used: 2026-09-30 regime = MTD from 09-01 (EXPORT_DECLARED)', (select basis='RESET_WINDOW' and window_start='2026-09-01' and window_start_basis='EXPORT_DECLARED' from costing.v_tally_snapshot_regime where as_of_date='2026-09-30'), (select format('%s %s %s',basis,window_start,window_start_basis) from costing.v_tally_snapshot_regime where as_of_date='2026-09-30'));
select au3_test.check('R2 Sep month from a declared MTD export is COMPLETE (no inference flag)', (select completeness='COMPLETE' and month_value=150 from costing.v_tally_expense_head_month_normalised where head_name='Power' and month_start='2026-09-01'), (select month_value::text||completeness||quality_flags::text from costing.v_tally_expense_head_month_normalised where head_name='Power' and month_start='2026-09-01'));

-- Ambiguous inference signal (legacy data without declared windows)
delete from public.tally_expenses_snapshot;
insert into public.tally_expenses_snapshot(as_of_date, expense_group, head_name, net_cb_value) values
 ('2026-05-31','Direct Expenses','A',100),('2026-05-31','Direct Expenses','B',100),('2026-05-31','Direct Expenses','C',1000),
 ('2026-06-15','Direct Expenses','A',110),('2026-06-15','Direct Expenses','B',120),('2026-06-15','Direct Expenses','C',100),
 ('2026-06-30','Direct Expenses','A',120),('2026-06-30','Direct Expenses','B',130),('2026-06-30','Direct Expenses','C',1100);
select au3_test.check('A1 total fell 76% but only 1 of 3 heads fell -> signal AMBIGUOUS (not silently a reset or FYTD)', (select evidence->>'signal'='AMBIGUOUS' and not (evidence->>'opens_regime')::boolean from costing.v_tally_snapshot_regime where as_of_date='2026-06-15'), (select evidence::text from costing.v_tally_snapshot_regime where as_of_date='2026-06-15'));
select au3_test.check('A2 month containing an ambiguous date is PROVISIONAL (AMBIGUOUS_REGIME_SIGNAL)', (select completeness='PROVISIONAL' and 'AMBIGUOUS_REGIME_SIGNAL'=any(quality_flags) from costing.v_tally_expense_head_month_normalised where head_name='A' and month_start='2026-06-01'), (select quality_flags::text from costing.v_tally_expense_head_month_normalised where head_name='A' and month_start='2026-06-01'));

-- Gate modes on direct (legacy) writes
select au3_test.check('G1 mode OFF (default): legacy direct insert unaffected, nothing logged', (select enforcement_mode='OFF' from public.tally_export_contract_setting) and not exists(select 1 from public.tally_expense_contract_violation), 'off');
update public.tally_export_contract_setting set enforcement_mode='WARN';
insert into public.tally_expenses_snapshot(as_of_date, expense_group, head_name, net_cb_value) values ('2026-07-01','Direct Expenses','A',1);
select au3_test.check('G2 mode WARN: direct insert allowed and logged as a violation', exists(select 1 from public.tally_expense_contract_violation where as_of_date='2026-07-01' and mode='WARN'), 'warn');
update public.tally_export_contract_setting set enforcement_mode='ENFORCE';
do $$ begin
  begin insert into public.tally_expenses_snapshot(as_of_date, expense_group, head_name, net_cb_value) values ('2026-07-02','Direct Expenses','A',1);
        perform au3_test.check('G3 mode ENFORCE: direct insert refused', false, 'insert succeeded');
  exception when others then perform au3_test.check('G3 mode ENFORCE: direct insert refused', sqlerrm like 'TALLY_CONTRACT_ENFORCED%', sqlerrm); end; end $$;
create temp table b4 as select au3_test.stage('2026-10-15','Direct Expenses','2026-10-01','2026-10-15','MTD','{"A":5}') be;
select au3_test.check('G4 mode ENFORCE: validated RPC load still works', (select status='ACCEPTED' and rows_loaded=1 from public.rpc_tally_validate_and_load_expense_batch((select be from b4))), 'rpc ok');
update public.tally_export_contract_setting set enforcement_mode='OFF';

-- Privileges
grant usage on schema public, au3_test to authenticated; grant execute on all functions in schema au3_test to authenticated; grant insert, select on au3_test.result to authenticated; grant usage on all sequences in schema au3_test to authenticated;
set role authenticated;
do $$ begin
  begin perform public.rpc_tally_validate_and_load_expense_batch(1); perform au3_test.check('P1 authenticated cannot run the loader RPC', false, 'allowed');
  exception when others then perform au3_test.check('P1 authenticated cannot run the loader RPC', sqlerrm like 'permission denied%', sqlerrm); end;
  begin perform 1 from public.tally_expense_export_batch limit 1; perform au3_test.check('P2 authenticated cannot read export batches', false, 'allowed');
  exception when others then perform au3_test.check('P2 authenticated cannot read export batches', sqlerrm like 'permission denied%', sqlerrm); end;
end $$;
reset role;

-- The live ETL writes as service_role (pg_stat_statements, AU-3c). Gate must not break it in any mode.
grant all on table public.tally_expenses_snapshot to service_role; grant usage, select on sequence public.tally_expenses_snapshot_id_seq to service_role;  -- mirrors live
grant usage on schema au3_test to service_role; grant execute on all functions in schema au3_test to service_role; grant insert, select on au3_test.result to service_role; grant usage on all sequences in schema au3_test to service_role;
set role service_role;
do $$ begin
  begin insert into public.tally_expenses_snapshot(as_of_date, expense_group, head_name, net_cb_value) values ('2026-07-03','Direct Expenses','S',1);
        perform au3_test.check('S1 mode OFF: service_role (live ETL) direct insert succeeds', true, 'ok');
  exception when others then perform au3_test.check('S1 mode OFF: service_role (live ETL) direct insert succeeds', false, sqlerrm); end; end $$;
reset role;
update public.tally_export_contract_setting set enforcement_mode='WARN';
set role service_role;
do $$ begin
  begin insert into public.tally_expenses_snapshot(as_of_date, expense_group, head_name, net_cb_value) values ('2026-07-04','Direct Expenses','S',1);
        perform au3_test.check('S2 mode WARN: service_role insert succeeds', true, 'ok');
  exception when others then perform au3_test.check('S2 mode WARN: service_role insert succeeds', false, sqlerrm); end; end $$;
reset role;
select au3_test.check('S2b mode WARN: service_role insert logged as violation', exists(select 1 from public.tally_expense_contract_violation where as_of_date='2026-07-04'), 'logged');
update public.tally_export_contract_setting set enforcement_mode='ENFORCE';
set role service_role;
do $$ begin
  begin insert into public.tally_expenses_snapshot(as_of_date, expense_group, head_name, net_cb_value) values ('2026-07-05','Direct Expenses','S',1);
        perform au3_test.check('S3 mode ENFORCE: service_role direct insert refused by contract (not by a grant error)', false, 'allowed');
  exception when others then perform au3_test.check('S3 mode ENFORCE: service_role direct insert refused by contract (not by a grant error)', sqlerrm like 'TALLY_CONTRACT_ENFORCED%', sqlerrm); end; end $$;
reset role;
create temp table b5 as select au3_test.stage('2026-10-14','Direct Expenses','2026-10-01','2026-10-14','MTD','{"S":7}') be;
grant select on b5 to service_role;
set role service_role;
select au3_test.check('S4 mode ENFORCE: service_role loads through the RPC end-to-end', (select status='ACCEPTED' and rows_loaded=1 from public.rpc_tally_validate_and_load_expense_batch((select be from b5))), 'rpc as service_role');
reset role;
update public.tally_export_contract_setting set enforcement_mode='OFF';

select n, outcome, test, left(detail,110) detail from au3_test.result order by n;
select count(*) filter (where outcome='PASS') passed, count(*) filter (where outcome<>'PASS') failed from au3_test.result;
