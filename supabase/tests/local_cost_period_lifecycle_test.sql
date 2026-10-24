-- Local only, rolled back.
begin;
\i supabase/migrations_draft/20261016100000_cost_period_lifecycle.sql
do $t$ declare r jsonb; n int; begin
  r:=costing.fn_cost_period_lifecycle_tick('2031-05-10'); assert r->>'status'='PERIOD_NOT_GOVERNED','T1 disabled policy must not create';
  update costing.cost_period_lifecycle_policy set auto_create_current=true, track_draft_valuation_date=true;
  r:=costing.fn_cost_period_lifecycle_tick('2031-05-10'); assert (r->>'created')::bool,'T2 create';
  r:=costing.fn_cost_period_lifecycle_tick('2031-05-10'); assert not (r->>'created')::bool and not (r->>'valuation_date_moved')::bool,'T3 idempotent';
  r:=costing.fn_cost_period_lifecycle_tick('2031-05-20'); assert (r->>'valuation_date_moved')::bool,'T4 tracks';
  assert (select valuation_date from costing.cost_periods where period_start='2031-05-01')='2031-05-20','T4b';
  update costing.cost_periods set valuation_date_source='GOVERNED_MANUAL' where period_start='2031-05-01';
  r:=costing.fn_cost_period_lifecycle_tick('2031-05-25'); assert not (r->>'valuation_date_moved')::bool,'T5 manual untouched';
  update costing.cost_periods set status='LOCKED',valuation_date_status='LOCKED',valuation_date_source='SYSTEM_DEFAULT' where period_start='2031-05-01';
  r:=costing.fn_cost_period_lifecycle_tick('2031-05-26'); assert not (r->>'valuation_date_moved')::bool,'T6 locked untouched';
  select count(*) into n from costing.cost_period_governance_audit where period_start='2031-05-01'; assert n>=2,'T7 audit rows '||n; -- 3 locally: governance trigger also logs the test's manual update
  raise notice 'LIFECYCLE TESTS 7/7 PASS';
end $t$;
rollback;
